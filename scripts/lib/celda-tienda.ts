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
import { RAIZ } from './repo.ts';

export const ARCHIVO_DESPLIEGUE_TIENDA = 'wrangler.despliegue.jsonc';
export const ARCHIVO_SQL_RESERVADOS = 'reservados.despliegue.sql';
export const ARCHIVO_SQL_SIEMBRA_SHARD = 'siembra-shard.despliegue.sql';
export const ARCHIVO_SQL_SIEMBRA_CONTROL = 'siembra-control.despliegue.sql';
export const SECRETO_DESPACHO = 'SECRETO_DESPACHO';
export const SECRETO_KEK = 'TIENDA_KEK_V1';

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

/** Lo que el despliegue agrega a la configuración generada: ids de bases y de KV (fuera de git). */
export interface DespliegueDeLaTienda {
  bases: Readonly<Record<string, string>>;
  flagsId: string;
  hostsId: string;
  /** Las claves públicas del CORE del destino (HU-T2.8). */
  clavesCore: readonly unknown[];
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
  const kek = entorno[SECRETO_KEK]?.trim();
  return {
    ok: true,
    api: { [SECRETO_DESPACHO]: despacho, ...(kek ? { [SECRETO_KEK]: kek } : {}) },
    frente: { [SECRETO_DESPACHO]: despacho },
    conKek: Boolean(kek),
  };
}

/**
 * La dirección workers.dev que tendría la API si se publicara ahí: la del panel con el nombre de la
 * API. Sirve para comprobar que **no** responde (CA4).
 */
export function urlQueNoDebeResponder(celda: Celda, destino: Destino): string {
  const panel = new URL(destino === 'staging' ? celda.api_staging : celda.api);
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
    let cuerpo: { estado?: string; motivo?: string; kek?: string } = {};
    try {
      cuerpo = (await salud.json()) as typeof cuerpo;
    } catch {
      // Abajo: sin JSON es una falla.
    }
    if (salud.status !== 200 || cuerpo.estado !== 'ok') {
      fallas.push(
        `${urls.panel}/api/salud respondió ${salud.status} (${cuerpo.estado ?? 'sin JSON'}${cuerpo.motivo ? `: ${cuerpo.motivo}` : ''})`,
      );
    } else if (cuerpo.kek !== 'ok') {
      avisos.push(`la KEK de la Tienda: ${cuerpo.kek ?? '?'} (nada se cifra todavía)`);
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
  }
  return { fallas, avisos };
}
