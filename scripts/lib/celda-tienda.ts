/**
 * La celda de la Tienda en el despliegue (HU-T2.4, TIENDA-3.0 §3.1). Solo staging hasta que la
 * Tienda salga a producción (HU-T2.9); en staging, en cada despliegue de `main`, como la celda del
 * parqueadero.
 *
 * Lo que el despliegue prepara, en orden:
 * 1. las bases D1 del shard y de control (`tienda_c1_s1_staging`, `tienda_control_staging`). Antes
 *    de migrar una base con datos, `foreign_key_check` tiene que salir vacío (CA4, bitácora core 2);
 * 2. los nombres reservados de `dominios.json` en la base de control (HU-T2.2 CA3), sin pisar una
 *    tienda que ya tenga ese nombre: la base lo rechaza con el nombre (P1);
 * 3. el KV de flags con los kill switches del producto, creados en «encendido» solo si faltan, y el
 *    KV `TIENDA_HOSTS` del despacho;
 * 4. solo en staging, los dos comercios de prueba (HU-T2.6): su siembra en el shard y en la base
 *    de control y sus direcciones `<slug>--staging` en `TIENDA_HOSTS`;
 * 5. la API, el despacho y el panel, con el secreto del despacho y la KEK por stdin;
 * 6. la prueba de humo: la salud de las dos bases por el panel, la página «sin tienda» del despacho,
 *    que la API no responda por fuera de sus bindings (CA4) y, en staging, que cada comercio de
 *    prueba responda en su dirección.
 *
 * Funciones puras o con `fetch` inyectado, para probarlas sin tocar Cloudflare.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ComercioDeEnsayo,
  ENSAYOS,
  hostDeStaging,
  hostsDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '../../packages/tienda-schema/src/ensayos.ts';
import type { Celda } from './celdas.ts';
import type { Destino, Fetch } from './despliegue.ts';
import { CORREO_GMAIL } from './publicacion.ts';
import { RAIZ } from './repo.ts';

export const ARCHIVO_DESPLIEGUE_TIENDA = 'wrangler.despliegue.jsonc';
export const ARCHIVO_SQL_RESERVADOS = 'reservados.despliegue.sql';
export const ARCHIVO_SQL_SIEMBRA_SHARD = 'siembra-shard.despliegue.sql';
export const ARCHIVO_SQL_SIEMBRA_CONTROL = 'siembra-control.despliegue.sql';
export const SECRETO_DESPACHO = 'SECRETO_DESPACHO';
export const SECRETO_KEK = 'TIENDA_KEK_V1';
/** HU-T17.6: los secretos de las KEK. La de número más alto es la vigente; las demás, para abrir. */
export const PATRON_SECRETO_KEK = /^TIENDA_KEK_V([1-9][0-9]?)$/;
/** `TIENDA_KEK_V2` → `v2`: el id que la tabla `llave` guarda en `kek_id`. */
export const idDeLaKek = (secreto: string) => `v${PATRON_SECRETO_KEK.exec(secreto)?.[1] ?? '?'}`;

/** Si este despliegue prepara la celda de la Tienda: staging siempre; producción, con HU-T2.9. */
export const preparaLaTienda = (destino: Destino, productos: ReadonlySet<string>): boolean =>
  destino === 'staging' || productos.has('tienda');

/** `tienda-c1-hosts` (con `-staging` en staging): el KV que lee el despacho (TIENDA §5.6). */
export const nombreKvHosts = (celdaId: string, destino: Destino): string =>
  `tienda-${celdaId}-hosts${destino === 'staging' ? '-staging' : ''}`;

/** Los nombres de `.app` que reservan los proyectos y las marcas (`infrastructure/dominios.json`, P2). */
export function reservadosDeDominios(): { proyecto: string[]; marca: string[] } {
  const d = JSON.parse(readFileSync(join(RAIZ, 'infrastructure', 'dominios.json'), 'utf8')) as {
    reservados_app: { proyecto: string[]; marca: string[] };
  };
  return d.reservados_app;
}

const texto = (valor: string) => `'${valor.replaceAll("'", "''")}'`;

/**
 * Los reservados de `dominios.json` como SQL para la base de control. Un nombre que ya está
 * reservado no se toca (`ON CONFLICT DO NOTHING`); uno que ya tiene tienda hace fallar el lote con
 * `slug-en-uso`, porque reservarlo le quitaría la dirección a un comercio (PLATAFORMA §3.4).
 */
export function sentenciasDeReservados(reservados: {
  proyecto: readonly string[];
  marca: readonly string[];
}): string[] {
  const filas = [
    ...reservados.proyecto.map((n) => [n, 'proyecto'] as const),
    ...reservados.marca.map((n) => [n, 'marca'] as const),
  ];
  return filas.map(
    ([nombre, motivo]) =>
      `INSERT INTO slug_reservado (slug, motivo) VALUES (${texto(nombre)}, ${texto(motivo)}) ON CONFLICT (slug) DO NOTHING;`,
  );
}

export function escribirReservados(sentencias: readonly string[]): string {
  const ruta = join(RAIZ, 'apps', 'tienda-api', ARCHIVO_SQL_RESERVADOS);
  writeFileSync(ruta, `${sentencias.join('\n')}\n`);
  return ruta;
}

/**
 * Los comercios de prueba que se siembran en ese destino: los dos en staging, **ninguno** en
 * producción (HU-T2.6 CA3).
 */
export const ensayosDelDestino = (destino: Destino): readonly ComercioDeEnsayo[] =>
  destino === 'staging' ? ENSAYOS : [];

/**
 * El correo del dueño en el CORE de staging (HU-T2.10 CA2, decisión del dueño del 15 oct 2026): un
 * secreto del ambiente de GitHub, nunca el repositorio, porque es un dato de una persona (P4).
 */
export const SECRETO_CORREO_DUENO = 'TIENDA_CORREO_DUENO_STAGING';

/** Un correo que puede ir dentro de un SQL y de una línea de comandos sin escaparse de ellos. */
const CORREO = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function correoDelDueno(
  entorno: Readonly<Record<string, string | undefined>>,
): { ok: true; correo: string | null } | { ok: false; motivo: string } {
  const correo = entorno[SECRETO_CORREO_DUENO]?.trim();
  if (!correo) return { ok: true, correo: null };
  if (!CORREO.test(correo)) {
    return {
      ok: false,
      motivo: `${SECRETO_CORREO_DUENO} no es un correo; corrígelo en el ambiente`,
    };
  }
  return { ok: true, correo };
}

/**
 * Las organizaciones de los comercios de prueba en el CORE de staging (HU-T2.10 CA2): con los ids
 * del fixture, en la celda de la Tienda y su primer shard. Una que ya existe no se toca: su plan
 * puede haber cambiado en una prueba de pagos.
 *
 * El dueño queda de propietario de las dos si su correo ya tiene cuenta en ese CORE: la membresía
 * pide el usuario, y el usuario nace al entrar por primera vez. Si todavía no entró, no se crea
 * nada a su nombre; entra una vez (el panel le dice «sin tienda») y el siguiente despliegue lo suma.
 */
export function ensayosEnElCore(
  comercios: readonly ComercioDeEnsayo[],
  celda: Pick<Celda, 'id' | 'shards'>,
  correo: string | null,
  ahora: string,
): string[] {
  if (comercios.length === 0) return [];
  const [shard] = celda.shards;
  if (!shard) throw new Error(`${celda.id}: no tiene shards para los comercios de prueba`);
  if (correo !== null && !CORREO.test(correo)) throw new Error('el correo del dueño no es válido');
  return comercios.flatMap((c) => [
    'INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ' +
      `(${texto(c.org)}, 'tienda', ${texto(c.nombre)}, 'tienda', ${texto(c.plan)}, ${texto(celda.id)}, ${texto(shard)}, 1, ${texto(ahora)}) ` +
      'ON CONFLICT (id) DO NOTHING;',
    ...(correo === null
      ? []
      : [
          'INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) ' +
            `SELECT id, ${texto(c.org)}, 'tienda', 'propietario', ${texto(ahora)} FROM usuario ` +
            `WHERE lower(email) = lower(${texto(correo)}) ON CONFLICT (usuario_id, org_id) DO NOTHING;`,
        ]),
  ]);
}

/** Cuántas de las organizaciones de prueba existen en el CORE y en cuántas el dueño es propietario. */
export function consultaDeEnsayosEnElCore(
  comercios: readonly ComercioDeEnsayo[],
  correo: string | null,
): string {
  const ids = comercios.map((c) => texto(c.org)).join(', ');
  const propietario =
    correo === null
      ? '0'
      : `(SELECT count(*) FROM membresia m JOIN usuario u ON u.id = m.usuario_id WHERE m.org_id IN (${ids}) AND m.rol = 'propietario' AND lower(u.email) = lower(${texto(correo)}))`;
  return `SELECT (SELECT count(*) FROM organizacion WHERE id IN (${ids}) AND producto = 'tienda') AS orgs, ${propietario} AS propias`;
}

/** Lo que el despliegue dice de los comercios de prueba en el CORE. Solo falla si faltan. */
export function notaDeEnsayosEnElCore(
  esperadas: number,
  fila: { orgs?: unknown; propias?: unknown } | undefined,
  correo: string | null,
): { ok: boolean; nota: string } {
  const orgs = Number(fila?.orgs ?? 0);
  const propias = Number(fila?.propias ?? 0);
  if (orgs !== esperadas) {
    return {
      ok: false,
      nota: `comercios de prueba en el CORE: ${orgs} de ${esperadas} organizaciones (HU-T2.10 CA2)`,
    };
  }
  if (correo === null) {
    return {
      ok: true,
      nota: `comercios de prueba en el CORE: ${orgs} organizaciones, sin propietario (falta ${SECRETO_CORREO_DUENO})`,
    };
  }
  return {
    ok: true,
    nota:
      propias === esperadas
        ? `comercios de prueba en el CORE: ${orgs} organizaciones, el dueño es propietario`
        : `comercios de prueba en el CORE: ${orgs} organizaciones; el correo del dueño todavía no tiene cuenta en staging. Entra una vez al panel de staging y vuelve a desplegar`,
  };
}

/** La siembra de staging en dos archivos para `wrangler d1 execute --file` (fuera de git). */
export function escribirSiembra(celda: Celda, ahora: string): { shard: string; control: string } {
  const dir = join(RAIZ, 'apps', 'tienda-api');
  writeFileSync(
    join(dir, ARCHIVO_SQL_SIEMBRA_SHARD),
    `${siembraDelShard(ENSAYOS, ahora).join('\n')}\n`,
  );
  writeFileSync(
    join(dir, ARCHIVO_SQL_SIEMBRA_CONTROL),
    `${siembraDelControl(ENSAYOS, celda.id, ahora).join('\n')}\n`,
  );
  return { shard: ARCHIVO_SQL_SIEMBRA_SHARD, control: ARCHIVO_SQL_SIEMBRA_CONTROL };
}

/**
 * Escribe las direcciones de staging en `TIENDA_HOSTS`. Siempre las reescribe: el KV se deriva de
 * la base de control (P2), y la siembra es la misma en cada despliegue.
 */
export async function escribirHosts(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  namespaceId: string,
  entradas: readonly [string, string][],
): Promise<void> {
  for (const [clave, valor] of entradas) {
    const r = await fetchFn(
      `https://api.cloudflare.com/client/v4/accounts/${cuenta}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(clave)}`,
      { method: 'PUT', headers: { authorization: `Bearer ${token}` }, body: valor },
    );
    if (r.status !== 200)
      throw new Error(`no se pudo escribir ${clave} en TIENDA_HOSTS (HTTP ${r.status})`);
  }
}

/** Las entradas de `TIENDA_HOSTS` de los comercios de prueba de una celda. */
export const hostsDeLaCelda = (celda: Celda): [string, string][] => {
  const [shard] = celda.shards;
  if (!shard) throw new Error(`${celda.id}: no tiene shards`);
  return hostsDeStaging(ENSAYOS, celda.id, shard);
};

/** Cuántas veces se vuelve a pedir mientras una tienda sube por tandas (bitácora tienda3 30). */
export const TANDAS_DE_LOS_ENSAYOS = 20;

/**
 * Publica a los comercios de prueba en staging, por el panel y con el secreto del despacho en
 * `x-ensayo` (HU-T4.4). Una tienda grande sube por tandas: mientras responda 202, se vuelve a
 * pedir (bitácora tienda3 30). Una frase por falla.
 */
export async function publicarEnsayos(
  fetchFn: Fetch,
  panel: string,
  secreto: string,
): Promise<string[]> {
  let r: Response | undefined;
  for (let tanda = 1; tanda <= TANDAS_DE_LOS_ENSAYOS; tanda++) {
    try {
      r = await fetchFn(`${panel}/api/ensayo/publicar`, {
        method: 'POST',
        headers: { 'x-ensayo': secreto },
      });
    } catch (e) {
      return [`publicar a los comercios de prueba: no respondió (${(e as Error).message})`];
    }
    if (r.status !== 202) break;
  }
  if (!r) return ['publicar a los comercios de prueba: no se pidió'];
  if (r.status === 202)
    return [
      `publicar a los comercios de prueba: después de ${TANDAS_DE_LOS_ENSAYOS} tandas todavía faltaban archivos`,
    ];
  if (r.status === 200) return [];
  let detalle = '';
  try {
    detalle = JSON.stringify(await r.json()).slice(0, 500);
  } catch {
    detalle = 'sin JSON';
  }
  return [`publicar a los comercios de prueba respondió ${r.status}: ${detalle}`];
}

/**
 * HU-T4.6 CA2: sube los archivos comunes de la release al almacén de la celda, por el panel y con el
 * secreto del despacho en `x-despliegue`, para que el despacho los siga sirviendo cuando el
 * siguiente despliegue cambie sus assets. Una frase por falla.
 */
export async function subirRelease(
  fetchFn: Fetch,
  panel: string,
  secreto: string,
  release: string,
  archivos: ReadonlyMap<string, Uint8Array>,
): Promise<string[]> {
  let r: Response;
  try {
    r = await fetchFn(`${panel}/api/despliegue/vitrina`, {
      method: 'POST',
      headers: { 'x-despliegue': secreto, 'content-type': 'application/json' },
      body: JSON.stringify({
        release,
        archivos: Object.fromEntries(
          [...archivos].map(([ruta, bytes]) => [ruta, Buffer.from(bytes).toString('base64')]),
        ),
      }),
    });
  } catch (e) {
    return [`subir la release ${release} de la vitrina: no respondió (${(e as Error).message})`];
  }
  if (r.ok) return [];
  const detalle = await r.text().catch(() => '');
  return [
    `subir la release ${release} de la vitrina respondió ${r.status}: ${detalle.slice(0, 300)}`,
  ];
}

/** Lo que dice la API de las llaves de la celda después de reenvolver (HU-T17.6). */
export interface UsoDeLasKeks {
  vigente: string | null;
  cargadas: string[];
  reenvueltas: number;
  enUso: Record<string, number>;
  quedan: number;
  /** Las DEK que la vigente sola no abre; `null` si no se comprobó (una sola KEK o quedan). */
  ilegibles: number | null;
}

/**
 * HU-T17.6 CA1: pide a la API que reenvuelva con la KEK vigente hasta que ninguna DEK quede con otra,
 * de a unas vueltas por llamada. Devuelve cuántas usa cada KEK al final.
 */
export async function reenvolverEnLaCelda(
  fetchFn: Fetch,
  panel: string,
  secreto: string,
  llamadas = 20,
): Promise<{ uso: UsoDeLasKeks | null; fallas: string[] }> {
  let uso: UsoDeLasKeks | null = null;
  let reenvueltas = 0;
  for (let i = 0; i < llamadas; i++) {
    let r: Response;
    try {
      r = await fetchFn(`${panel}/api/despliegue/llaves`, {
        method: 'POST',
        headers: { 'x-despliegue': secreto },
      });
    } catch (e) {
      return { uso, fallas: [`reenvolver las llaves: no respondió (${(e as Error).message})`] };
    }
    if (!r.ok) {
      const detalle = await r.text().catch(() => '');
      return {
        uso,
        fallas: [`reenvolver las llaves respondió ${r.status}: ${detalle.slice(0, 300)}`],
      };
    }
    uso = (await r.json()) as UsoDeLasKeks;
    reenvueltas += uso.reenvueltas;
    if (uso.quedan === 0 || uso.reenvueltas === 0) break;
  }
  return { uso: uso ? { ...uso, reenvueltas } : null, fallas: [] };
}

/**
 * HU-T17.6 CA2: las KEK que se borran del Worker porque salieron del ambiente de GitHub. Una que
 * todavía envuelve alguna DEK no se borra: el despliegue falla, lo dice y no borra ninguna.
 */
export function kekQueSeRetiran(
  enElWorker: readonly string[],
  enGithub: readonly string[],
  enUso: Readonly<Record<string, number>>,
  ilegibles: number | null = null,
): { borrar: string[]; fallas: string[] } {
  const salen = enElWorker.filter((s) => PATRON_SECRETO_KEK.test(s) && !enGithub.includes(s));
  const fallas = salen.flatMap((s) => {
    const n = enUso[idDeLaKek(s)] ?? 0;
    return n > 0
      ? [
          `${s} salió del ambiente de GitHub, pero todavía envuelve ${n} llave(s) de las tiendas: no se borra del Worker. Vuelve a ponerla en el ambiente, o espera a que el despliegue termine de reenvolver (docs/runbooks/tienda-rotar-la-kek.md)`,
        ]
      : [];
  });
  if (salen.length > 0 && ilegibles !== null && ilegibles > 0) {
    fallas.push(
      `la KEK vigente no abre ${ilegibles} llave(s) de las tiendas: no se borra ninguna KEK del Worker. Es un incidente: no retires la vieja (docs/runbooks/tienda-rotar-la-kek.md)`,
    );
  }
  return { borrar: fallas.length > 0 ? [] : salen, fallas };
}

/** Lo que el despliegue agrega a la configuración generada: ids de bases y de KV (fuera de git). */
export interface DespliegueDeLaTienda {
  bases: Readonly<Record<string, string>>;
  flagsId: string;
  hostsId: string;
  /** Las claves públicas del CORE del destino (HU-T2.8). */
  clavesCore: readonly unknown[];
  /** La release de los archivos comunes de la vitrina con que hornea la API (HU-T3.3). */
  vitrinaRelease: string;
  /** La cuenta de Cloudflare: el freno de R2 mide la suya (bitácora tienda3 27). */
  cuenta: string;
}

/** La configuración de la API con los ids de este despliegue, solo en el destino que se prepara. */
export function configDeLaApi(
  generada: Record<string, unknown>,
  destino: Destino,
  d: DespliegueDeLaTienda,
): Record<string, unknown> {
  const agregar = (bloque: Record<string, unknown>) => ({
    ...bloque,
    d1_databases: (bloque['d1_databases'] as { binding: string }[]).map((b) => {
      const id = d.bases[b.binding];
      if (!id) throw new Error(`falta el id de la base ${b.binding}`);
      return { ...b, database_id: id };
    }),
    kv_namespaces: [
      { binding: 'FLAGS', id: d.flagsId },
      { binding: 'TIENDA_HOSTS', id: d.hostsId },
    ],
    vars: {
      ...(bloque['vars'] as Record<string, string>),
      CORE_CLAVES: JSON.stringify(d.clavesCore),
      VITRINA_RELEASE: d.vitrinaRelease,
      CF_CUENTA: d.cuenta,
    },
  });
  return enDestino(generada, destino, agregar);
}

/** La configuración del despacho con los KV de hosts y de flags de este despliegue (HU-T2.7). */
export function configDelSitio(
  generada: Record<string, unknown>,
  destino: Destino,
  kv: { hostsId: string; flagsId: string },
): Record<string, unknown> {
  return enDestino(generada, destino, (bloque) => ({
    ...bloque,
    kv_namespaces: [
      { binding: 'TIENDA_HOSTS', id: kv.hostsId },
      { binding: 'FLAGS', id: kv.flagsId },
    ],
  }));
}

function enDestino(
  generada: Record<string, unknown>,
  destino: Destino,
  agregar: (bloque: Record<string, unknown>) => Record<string, unknown>,
): Record<string, unknown> {
  if (destino === 'produccion') return agregar(generada);
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  return { ...generada, env: { ...env, staging: agregar(env['staging'] ?? {}) } };
}

/** Fuera de git (ver .gitignore): lleva ids de bases y de KV (ADR-6). */
export function escribirDespliegue(app: 'tienda-api' | 'tienda-sitio', config: object): string {
  const ruta = join(RAIZ, 'apps', app, ARCHIVO_DESPLIEGUE_TIENDA);
  writeFileSync(
    ruta,
    `// Armado por scripts/desplegar.ts para un despliegue. No va a git: lleva ids.\n${JSON.stringify(config, null, 2)}\n`,
  );
  return ruta;
}

/**
 * Los secretos de cada Worker, de los secretos del ambiente de GitHub. Sin el del despacho no se
 * despliega: la API no respondería a nadie y la prueba de humo no diría por qué (P1). La KEK es
 * opcional hasta que algo cifre (HU-T11.1): sin ella, la salud dice «falta».
 */
export function secretosDeLaTienda(
  entorno: Readonly<Record<string, string | undefined>>,
):
  | { ok: true; api: Record<string, string>; frente: Record<string, string>; conKek: boolean }
  | { ok: false; motivo: string } {
  const despacho = entorno[SECRETO_DESPACHO]?.trim();
  if (!despacho) {
    return {
      ok: false,
      motivo: `falta ${SECRETO_DESPACHO} en el ambiente de GitHub: el dueño corre «node scripts/tienda/generar-secretos.ts --ambiente <staging|produccion>» (docs/runbooks/secretos-de-la-tienda.md)`,
    };
  }
  // HU-T17.6: todas las KEK del ambiente; rotar es agregar la siguiente.
  const keks = Object.fromEntries(
    Object.entries(entorno).flatMap(([k, v]) =>
      PATRON_SECRETO_KEK.test(k) && v?.trim() ? [[k, v.trim()]] : [],
    ),
  );
  // HU-T17.1: el aviso de la tarea diaria; sin Telegram, la tarea lo dice en el registro.
  // HU-T14.3: los correos por Gmail, opcionales igual; sin ellos, la API dice «no disponible».
  // Bitácora tienda3 27: el token de métricas del freno de R2; sin él, la tarea queda en falla.
  const telegram = Object.fromEntries(
    (
      ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', ...CORREO_GMAIL, 'CF_METRICAS_TOKEN'] as const
    ).flatMap((k) => {
      const v = entorno[k]?.trim();
      return v ? [[k, v]] : [];
    }),
  );
  return {
    ok: true,
    api: { [SECRETO_DESPACHO]: despacho, ...keks, ...telegram },
    frente: { [SECRETO_DESPACHO]: despacho },
    conKek: Object.keys(keks).length > 0,
  };
}

/**
 * La dirección workers.dev que tendría la API si se publicara ahí: el subdominio de la cuenta con el
 * nombre de la API. Sirve para comprobar que **no** responde (CA4). El subdominio sale del panel de
 * staging, que sí vive en workers.dev: el de producción tiene su dominio (`panel.`), y de él salía
 * `tienda-api-c1.laboratorio-digital.app`, que no existe (bitácora tienda3 14).
 */
export function urlQueNoDebeResponder(celda: Celda, destino: Destino): string {
  const panel = new URL(celda.api_staging);
  const sufijo = panel.hostname.split('.').slice(1).join('.');
  return `https://tienda-api-${celda.id}${destino === 'staging' ? '-staging' : ''}.${sufijo}`;
}

/**
 * La prueba de humo: la salud de las dos bases por el panel, la portada del panel, la página «sin
 * tienda» del despacho y que la API no responda en workers.dev. Una frase por falla; los avisos
 * (la KEK que falta) no son fallas.
 */
export async function humoDeLaTienda(
  fetchFn: Fetch,
  urls: { panel: string; sitio: string; apiPorFuera: string },
  ensayos: readonly ComercioDeEnsayo[] = [],
  /** HU-T2.9 CA3: el ambiente del destino; la API tiene que decir el mismo y sus comercios de prueba. */
  esperado?: { ambiente: Destino },
): Promise<{ fallas: string[]; avisos: string[] }> {
  const fallas: string[] = [];
  const avisos: string[] = [];
  const pedir = async (url: string) => {
    try {
      return await fetchFn(url, { redirect: 'manual' });
    } catch (e) {
      fallas.push(`${url}: no respondió (${(e as Error).message})`);
      return null;
    }
  };
  const salud = await pedir(`${urls.panel}/api/salud`);
  if (salud) {
    let cuerpo: {
      estado?: string;
      motivo?: string;
      kek?: string;
      ambiente?: string | null;
      comerciosDePrueba?: number;
    } = {};
    try {
      cuerpo = (await salud.json()) as typeof cuerpo;
    } catch {
      // Abajo: sin JSON es una falla.
    }
    if (salud.status !== 200 || cuerpo.estado !== 'ok') {
      fallas.push(
        `${urls.panel}/api/salud respondió ${salud.status} (${cuerpo.estado ?? 'sin JSON'}${cuerpo.motivo ? `: ${cuerpo.motivo}` : ''})`,
      );
    } else {
      if (cuerpo.kek !== 'ok') {
        avisos.push(`la KEK de la Tienda: ${cuerpo.kek ?? '?'} (nada se cifra todavía)`);
      }
      if (esperado && cuerpo.ambiente !== esperado.ambiente) {
        fallas.push(
          `${urls.panel} es la API de «${cuerpo.ambiente ?? 'sin ambiente'}», pero el despliegue era a ${esperado.ambiente}: el destino, el dominio y el ambiente no coinciden`,
        );
      }
      if (esperado && cuerpo.comerciosDePrueba !== ensayos.length) {
        fallas.push(
          esperado.ambiente === 'produccion'
            ? `hay ${cuerpo.comerciosDePrueba ?? '?'} comercios de prueba en producción: nunca se siembran allí (HU-T2.6 CA3)`
            : `hay ${cuerpo.comerciosDePrueba ?? '?'} comercios de prueba en ${esperado.ambiente}, y se esperaban ${ensayos.length}`,
        );
      }
    }
  }
  const portada = await pedir(`${urls.panel}/`);
  if (
    portada &&
    (portada.status !== 200 || !(await portada.text()).includes('El panel de tu tienda'))
  ) {
    fallas.push(`${urls.panel}/ respondió ${portada.status} sin la portada del panel`);
  }
  const sinTienda = await pedir(`${urls.sitio}/`);
  if (
    sinTienda &&
    (sinTienda.status !== 404 ||
      !(await sinTienda.text()).includes('Esta dirección no tiene tienda'))
  ) {
    fallas.push(`${urls.sitio}/ respondió ${sinTienda.status} sin la página «sin tienda»`);
  }
  const porFuera = await pedir(`${urls.apiPorFuera}/api/salud`);
  if (porFuera && porFuera.status !== 404) {
    fallas.push(
      `${urls.apiPorFuera} respondió ${porFuera.status}: la API de la Tienda no puede tener workers.dev (CA4)`,
    );
  }
  // HU-T2.6: cada comercio de prueba responde en su dirección, con su nombre: el despacho resolvió
  // el Host en TIENDA_HOSTS y la API confió en la tienda que le pasó.
  for (const e of ensayos) {
    const url = `https://${hostDeStaging(e.slug)}/api/v1/tienda`;
    const r = await pedir(url);
    if (!r) continue;
    let nombre: unknown;
    try {
      nombre = ((await r.json()) as { nombre?: unknown }).nombre;
    } catch {
      nombre = undefined;
    }
    if (r.status !== 200 || nombre !== e.nombre) {
      fallas.push(`${url} respondió ${r.status} sin el nombre de ${e.nombre}`);
    }
    // HU-T4.4: su portada, horneada y servida desde el almacén por el despacho.
    const suPortada = await pedir(`https://${hostDeStaging(e.slug)}/`);
    if (
      suPortada &&
      (suPortada.status !== 200 || !(await suPortada.text()).includes(`<h1>${e.nombre}</h1>`))
    ) {
      fallas.push(
        `https://${hostDeStaging(e.slug)}/ respondió ${suPortada.status} sin la portada de ${e.nombre}`,
      );
    }
  }
  return { fallas, avisos };
}
