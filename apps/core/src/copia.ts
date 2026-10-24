/**
 * La copia semanal fuera de Cloudflare (HU-C11.4, ADR-30), en el cron del CORE (decisión del dueño
 * del 23 oct 2026). Plan de salida de ED1 §20.3: si la cuenta de Cloudflare queda suspendida, lo de
 * todos los productos sigue en el Google Drive del dueño, cifrado con una llave que no vive en Google.
 *
 * Cada vuelta del cron de 15 minutos hace **un paso**, para caber en el plan gratuito (10 ms de CPU y
 * 50 llamadas por invocación):
 *
 * 1. Al empezar la semana (lunes, Bogotá) anota una fila `pendiente` por base (`copia_base`).
 * 2. Toma una base pendiente: la exporta con la API de D1 (`/export`, esperando su `signed_url`), la
 *    cifra (`copia-formato.ts`), la sube a la carpeta de la app en el Drive del dueño y la vuelve a
 *    bajar para abrirla y comparar su huella. Solo así queda `hecha`.
 * 3. Con todas hechas, el cierre: rota las copias viejas (8 semanales y una por mes) y mira la cuota
 *    de Drive (aviso al 70 %, leyendo la cuota de Drive y no un contador propio, P7).
 *
 * Lo que falla se reintenta en la vuelta siguiente, hasta 3 veces; a la tercera, aviso por Telegram
 * con la causa (CA3). Sin la configuración no hace nada ni escribe nada.
 *
 * El permiso de Drive es `drive.file`: la app solo ve lo que ella crea, nunca el resto del Drive del
 * dueño. Lo da el dueño una vez (`scripts/copia/permiso-de-drive.ts`). El token de Cloudflare es
 * uno de propósito (HU-C11.5), solo para exportar las bases.
 */
import type { BaseD1 } from '@ed1/d1';
import { enviarTelegram, type Telegram } from '@ed1/telegram';
import {
  BASES_DE_CELDAS,
  CopiaIlegible,
  cifrarCopia,
  descifrarCopia,
  importarLlave,
  nombreDelArchivo,
  semanaDe,
  semanasQueSeQuedan,
} from './copia-formato.ts';

export interface EnvDeCopia {
  DESTINO?: string;
  COPIA_LLAVE?: string;
  COPIA_DRIVE_CLIENTE_ID?: string;
  COPIA_DRIVE_CLIENTE_SECRETO?: string;
  COPIA_DRIVE_REFRESH?: string;
  COPIA_CF_TOKEN?: string;
  COPIA_CF_CUENTA?: string;
}

export const INTENTOS_POR_BASE = 3;
/** Un volcado más grande no cabe con holgura en la memoria del Worker: se avisa y no se sube. */
export const TOPE_DEL_VOLCADO = 50 * 1024 * 1024;
export const ESPERAS_DEL_EXPORT = 10;
export const AVISO_DE_CUOTA = 0.7;
const CIERRE = '_cierre';
/** El motivo que queda si la vuelta no llega a anotar ni el éxito ni la falla. */
export const CORTADA = 'la vuelta del cron se cortó antes de terminar';
const CF = 'https://api.cloudflare.com/client/v4';
const TOKEN_DE_GOOGLE = 'https://oauth2.googleapis.com/token';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const SUBIR = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id';
const CARPETA = 'application/vnd.google-apps.folder';

export const carpetaDelDestino = (destino: string | undefined) =>
  destino === 'produccion'
    ? 'Laboratorio Digital · copias semanales'
    : 'Laboratorio Digital · copias semanales (staging)';

export type ResultadoDelPaso =
  | { estado: 'sin-configurar' }
  | { estado: 'al-dia' }
  | { estado: 'hecha'; base: string; bytes: number }
  | { estado: 'cierre'; borradas: number; cuota: number | null }
  | { estado: 'fallida'; base: string; motivo: string };

export interface DependenciasDeLaCopia {
  fetch: typeof fetch;
  /** Cuánto esperar entre preguntas al export; las pruebas no esperan. */
  esperar?: (ms: number) => Promise<void>;
  bases?: readonly string[];
  telegram?: Telegram;
}

const configurada = (env: EnvDeCopia) =>
  Boolean(
    env.COPIA_LLAVE &&
      env.COPIA_DRIVE_CLIENTE_ID &&
      env.COPIA_DRIVE_CLIENTE_SECRETO &&
      env.COPIA_DRIVE_REFRESH &&
      env.COPIA_CF_TOKEN &&
      env.COPIA_CF_CUENTA,
  );

class FallaDeLaCopia extends Error {
  override name = 'FallaDeLaCopia';
}

async function json(r: Response): Promise<Record<string, unknown>> {
  const d = (await r.json().catch(() => null)) as unknown;
  return d !== null && typeof d === 'object' ? (d as Record<string, unknown>) : {};
}

/** Un paso de la copia de esta semana. Lo llama el cron del CORE en cada vuelta. */
export async function pasoDeLaCopia(
  db: BaseD1,
  env: EnvDeCopia,
  dep: DependenciasDeLaCopia,
  ahora: number,
): Promise<ResultadoDelPaso> {
  if (!configurada(env)) return { estado: 'sin-configurar' };
  const semana = semanaDe(ahora);
  const bases = dep.bases ?? BASES_DE_CELDAS(env.DESTINO);
  const iso = new Date(ahora).toISOString();
  const { results } = await db
    .prepare('SELECT base, estado, intentos FROM copia_base WHERE semana = ?')
    .bind(semana)
    .all<{ base: string; estado: string; intentos: number }>();
  // Al empezar la semana, o si celdas.json ganó una base a mitad de semana.
  const anotadas = new Set(results.map((r) => r.base));
  if (![...bases, CIERRE].every((b) => anotadas.has(b))) {
    await db.batch(
      [...bases, CIERRE].map((nombre) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO copia_base (semana, base, estado, actualizado) VALUES (?, ?, 'pendiente', ?)",
          )
          .bind(semana, nombre, iso),
      ),
    );
    return pasoDeLaCopia(db, env, dep, ahora);
  }
  // Una base que sigue `pendiente` con sus intentos agotados es una vuelta que el cron cortó tres
  // veces a mitad de camino: nadie llegó a anotarla como fallida. Se anota ahora y se avisa.
  for (const r of results) {
    if (r.estado !== 'pendiente' || r.intentos < INTENTOS_POR_BASE) continue;
    await db
      .prepare(
        "UPDATE copia_base SET estado = 'fallida', actualizado = ? WHERE semana = ? AND base = ?",
      )
      .bind(iso, semana, r.base)
      .run();
    r.estado = 'fallida';
    await avisarFalla(dep, r.base, semana, CORTADA);
  }
  const porHacer = (r: { estado: string; intentos: number }) =>
    r.estado !== 'hecha' && r.intentos < INTENTOS_POR_BASE;
  // En el orden de celdas.json: el CORE primero. Una base que agotó sus intentos ya avisó y no
  // detiene a las demás ni al cierre.
  const siguiente = bases
    .map((b) => results.find((r) => r.base === b))
    .find((r) => r !== undefined && porHacer(r));
  const cierre = results.find((r) => r.base === CIERRE);
  if (!siguiente && !(cierre && porHacer(cierre))) return { estado: 'al-dia' };
  const base = siguiente?.base ?? CIERRE;
  const intentos = (siguiente ?? cierre)?.intentos ?? 0;
  const drive = conDrive(env, dep.fetch);
  // El intento se anota antes de empezar: si el cron corta la vuelta (tiempo o CPU), la base no
  // queda como si nadie la hubiera tocado, y a la tercera se avisa (bitácora core 15).
  await db
    .prepare(
      "UPDATE copia_base SET estado = 'pendiente', intentos = intentos + 1, motivo = ?, actualizado = ? WHERE semana = ? AND base = ?",
    )
    .bind(CORTADA, iso, semana, base)
    .run();
  try {
    if (base === CIERRE) {
      const r = await cerrarLaSemana(drive, env, dep);
      await db
        .prepare(
          "UPDATE copia_base SET estado = 'hecha', motivo = NULL, actualizado = ? WHERE semana = ? AND base = ?",
        )
        .bind(iso, semana, CIERRE)
        .run();
      return { estado: 'cierre', ...r };
    }
    const llave = await importarLlave(env.COPIA_LLAVE ?? '');
    const volcado = await exportar(env, dep, base);
    const { archivo, manifiesto } = await cifrarCopia(llave, { base, semana, volcado });
    const id = await drive.subir(
      await drive.carpeta(carpetaDelDestino(env.DESTINO)),
      nombreDelArchivo(semana, base),
      archivo,
    );
    // CA3: la copia que se dejó se vuelve a bajar y se abre; si no cuadra, no queda como hecha.
    const bajada = await drive.bajar(id);
    const abierta = await descifrarCopia(llave, { base, semana }, bajada);
    if (abierta.manifiesto.huella !== manifiesto.huella) {
      throw new CopiaIlegible('la copia en Drive no es la que se subió');
    }
    await db
      .prepare(
        "UPDATE copia_base SET estado = 'hecha', bytes = ?, huella = ?, filas = ?, archivo = ?, motivo = NULL, actualizado = ? WHERE semana = ? AND base = ?",
      )
      .bind(
        archivo.length,
        manifiesto.huella,
        JSON.stringify(manifiesto.filas),
        id,
        iso,
        semana,
        base,
      )
      .run();
    return { estado: 'hecha', base, bytes: archivo.length };
  } catch (e) {
    const motivo =
      e instanceof FallaDeLaCopia || e instanceof CopiaIlegible || e instanceof RangeError
        ? e.message
        : `falla inesperada (${(e as Error).name})`;
    await db
      .prepare(
        "UPDATE copia_base SET estado = 'fallida', motivo = ?, actualizado = ? WHERE semana = ? AND base = ?",
      )
      .bind(motivo, iso, semana, base)
      .run();
    console.error(`agro-core: la copia de ${base} no salió (${motivo})`);
    if (intentos + 1 >= INTENTOS_POR_BASE) await avisarFalla(dep, base, semana, motivo);
    return { estado: 'fallida', base, motivo };
  }
}

async function avisarFalla(
  dep: DependenciasDeLaCopia,
  base: string,
  semana: string,
  motivo: string,
): Promise<void> {
  if (!dep.telegram) return;
  await enviarTelegram(
    dep.telegram,
    `La copia semanal fuera de Cloudflare de ${base} (semana del ${semana}) no salió tras ${INTENTOS_POR_BASE} intentos: ${motivo}. Revisa docs/runbooks/copia-en-drive.md.`,
    dep.fetch,
  );
}

/** Exporta una base con la API de D1 y devuelve el volcado SQL. */
async function exportar(
  env: EnvDeCopia,
  dep: DependenciasDeLaCopia,
  base: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const cuenta = `${CF}/accounts/${env.COPIA_CF_CUENTA}/d1/database`;
  const cabeceras = {
    authorization: `Bearer ${env.COPIA_CF_TOKEN}`,
    'content-type': 'application/json',
  };
  const lista = await dep.fetch(`${cuenta}?name=${encodeURIComponent(base)}`, {
    headers: cabeceras,
  });
  if (lista.status === 401 || lista.status === 403) {
    throw new FallaDeLaCopia(`el token de la copia no puede leer las bases (${lista.status})`);
  }
  const encontradas = (await json(lista))['result'] as
    | { uuid?: string; name?: string }[]
    | undefined;
  const id = encontradas?.find((b) => b.name === base)?.uuid;
  if (!id) throw new FallaDeLaCopia(`la base ${base} no existe en la cuenta`);
  let bookmark: string | undefined;
  const esperar = dep.esperar ?? ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  // El export se cancela si nadie pregunta por él: se pregunta en la misma vuelta hasta tenerlo.
  for (let i = 0; i <= ESPERAS_DEL_EXPORT; i++) {
    const r = await dep.fetch(`${cuenta}/${id}/export`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({
        output_format: 'polling',
        ...(bookmark ? { current_bookmark: bookmark } : {}),
      }),
    });
    const d = await json(r);
    if (r.status === 401 || r.status === 403) {
      throw new FallaDeLaCopia(`el token de la copia no puede exportar ${base} (${r.status})`);
    }
    if (!r.ok) throw new FallaDeLaCopia(`Cloudflare no exportó ${base} (${r.status})`);
    // La forma de la API: `result.status`, `result.at_bookmark` y, al terminar, el enlace un nivel
    // más adentro, en `result.result.signed_url` (bitácora core 16).
    const resultado = (d['result'] ?? {}) as {
      at_bookmark?: string;
      status?: string;
      error?: string;
      result?: { signed_url?: string };
    };
    if (resultado.status === 'error') {
      throw new FallaDeLaCopia(
        `Cloudflare no exportó ${base}: ${resultado.error ?? 'sin causa en la respuesta'}`,
      );
    }
    const enlace = resultado.result?.signed_url;
    if (enlace) {
      const bajada = await dep.fetch(enlace);
      if (!bajada.ok) throw new FallaDeLaCopia(`no se pudo bajar el volcado de ${base}`);
      const largo = Number(bajada.headers.get('content-length') ?? '0');
      if (largo > TOPE_DEL_VOLCADO) {
        throw new FallaDeLaCopia(
          `el volcado de ${base} mide ${Math.round(largo / 1e6)} MB, más de lo que la copia cabe a hacer en el plan gratuito`,
        );
      }
      const bytes = new Uint8Array(await bajada.arrayBuffer());
      if (bytes.length > TOPE_DEL_VOLCADO) {
        throw new FallaDeLaCopia(`el volcado de ${base} pasa de 50 MB`);
      }
      return bytes;
    }
    bookmark = resultado.at_bookmark ?? bookmark;
    await esperar(3000);
  }
  throw new FallaDeLaCopia(`el export de ${base} no terminó en ${ESPERAS_DEL_EXPORT} preguntas`);
}

interface Drive {
  carpeta(nombre: string): Promise<string>;
  subir(carpeta: string, nombre: string, contenido: Uint8Array): Promise<string>;
  bajar(id: string): Promise<Uint8Array<ArrayBuffer>>;
  listar(carpeta: string): Promise<{ id: string; name: string }[]>;
  borrar(id: string): Promise<void>;
  cuota(): Promise<number | null>;
}

/** Lo que la copia usa de Drive, con `drive.file`. El acceso se pide una vez por vuelta. */
function conDrive(env: EnvDeCopia, fetchFn: typeof fetch): Drive {
  let acceso: string | null = null;
  const token = async () => {
    if (acceso) return acceso;
    const r = await fetchFn(TOKEN_DE_GOOGLE, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.COPIA_DRIVE_CLIENTE_ID ?? '',
        client_secret: env.COPIA_DRIVE_CLIENTE_SECRETO ?? '',
        refresh_token: env.COPIA_DRIVE_REFRESH ?? '',
        grant_type: 'refresh_token',
      }).toString(),
    });
    const d = await json(r);
    if (!r.ok || typeof d['access_token'] !== 'string') {
      throw new FallaDeLaCopia(
        `el permiso del Drive del dueño no sirve (${r.status}): hay que volver a darlo con scripts/copia/permiso-de-drive.ts`,
      );
    }
    acceso = d['access_token'];
    return acceso;
  };
  const pedir = async (url: string, init: RequestInit = {}) => {
    const r = await fetchFn(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string>),
        authorization: `Bearer ${await token()}`,
      },
    });
    if (!r.ok) throw new FallaDeLaCopia(`Drive respondió ${r.status}`);
    return r;
  };
  const buscar = async (q: string) =>
    ((
      await json(
        await pedir(
          `${DRIVE}/files?${new URLSearchParams({ q, fields: 'files(id,name)', pageSize: '1000', spaces: 'drive' })}`,
        ),
      )
    )['files'] ?? []) as { id: string; name: string }[];
  return {
    async carpeta(nombre) {
      const comillas = nombre.replace(/'/g, "\\'");
      const [hallada] = await buscar(
        `name = '${comillas}' and mimeType = '${CARPETA}' and trashed = false`,
      );
      if (hallada) return hallada.id;
      const r = await pedir(`${DRIVE}/files?fields=id`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nombre, mimeType: CARPETA }),
      });
      const id = (await json(r))['id'];
      if (typeof id !== 'string') throw new FallaDeLaCopia('Drive no devolvió la carpeta');
      return id;
    },
    async subir(carpeta, nombre, contenido) {
      const frontera = `ed1-copia-${crypto.randomUUID()}`;
      const cabeza = new TextEncoder().encode(
        `--${frontera}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nombre, parents: [carpeta] })}\r\n--${frontera}\r\nContent-Type: application/octet-stream\r\n\r\n`,
      );
      const pie = new TextEncoder().encode(`\r\n--${frontera}--\r\n`);
      const cuerpo = new Uint8Array(cabeza.length + contenido.length + pie.length);
      cuerpo.set(cabeza);
      cuerpo.set(contenido, cabeza.length);
      cuerpo.set(pie, cabeza.length + contenido.length);
      const r = await pedir(SUBIR, {
        method: 'POST',
        headers: { 'content-type': `multipart/related; boundary=${frontera}` },
        body: cuerpo,
      });
      const id = (await json(r))['id'];
      if (typeof id !== 'string') throw new FallaDeLaCopia('Drive no devolvió el archivo subido');
      return id;
    },
    async bajar(id) {
      return new Uint8Array(await (await pedir(`${DRIVE}/files/${id}?alt=media`)).arrayBuffer());
    },
    listar: (carpeta) => buscar(`'${carpeta}' in parents and trashed = false`),
    async borrar(id) {
      await pedir(`${DRIVE}/files/${id}`, { method: 'DELETE' });
    },
    async cuota() {
      const d = await json(await pedir(`${DRIVE}/about?fields=storageQuota`));
      const q = (d['storageQuota'] ?? {}) as { limit?: string; usage?: string };
      const limite = Number(q.limit);
      return limite > 0 ? Number(q.usage) / limite : null;
    },
  };
}

/** El cierre de la semana: rotar (CA1c) y mirar la cuota de Drive. */
async function cerrarLaSemana(
  drive: Drive,
  env: EnvDeCopia,
  dep: DependenciasDeLaCopia,
): Promise<{ borradas: number; cuota: number | null }> {
  const carpeta = await drive.carpeta(carpetaDelDestino(env.DESTINO));
  const archivos = (await drive.listar(carpeta)).filter((a) =>
    /^\d{4}-\d{2}-\d{2}_.+\.sql\.ed1$/.test(a.name),
  );
  const quedan = semanasQueSeQuedan(archivos.map((a) => a.name.slice(0, 10)));
  let borradas = 0;
  for (const a of archivos) {
    if (quedan.has(a.name.slice(0, 10))) continue;
    await drive.borrar(a.id);
    borradas++;
  }
  // P7: la cuota la dice Drive, contando todo lo que el Drive del dueño ya tiene.
  const cuota = await drive.cuota();
  if (cuota !== null && cuota >= AVISO_DE_CUOTA && dep.telegram) {
    await enviarTelegram(
      dep.telegram,
      `El Google Drive de las copias va en el ${Math.round(cuota * 100)} % de su espacio. Libera espacio o amplíalo antes de que las copias dejen de caber.`,
      dep.fetch,
    );
  }
  return { borradas, cuota };
}
