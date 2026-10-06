/**
 * Base D1 del CORE en el despliegue (HU-E4.1, ARQUITECTURA §5.4 y §7.4).
 *
 * Antes de publicar el Worker del CORE, el despliegue:
 * 1. asegura la base `agro_core` (con `_staging` en staging): la crea si no existe;
 * 2. arma la configuración de wrangler con el id de la base en un archivo fuera de git: el id
 *    depende de la cuenta y no va al repositorio (ADR-6);
 * 3. aplica las migraciones de `infrastructure/migraciones/core/` (`wrangler d1 migrations apply`);
 * 4. sincroniza la tabla `celda` desde celdas.json (`apps/core/src/celdas.ts`, P2).
 *
 * Funciones con `fetch` inyectado, para probarlas sin tocar Cloudflare.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Destino, Fetch } from './despliegue.ts';
import { RAIZ } from './repo.ts';

const API = 'https://api.cloudflare.com/client/v4';
const PERMISO_D1 = '«Account → D1: Edit»';

export const nombreD1Core = (base: string, destino: Destino): string =>
  `${base}${destino === 'staging' ? '_staging' : ''}`;

const sinPermiso = (estado: number) => estado === 401 || estado === 403;

async function pedirJson(fetchFn: Fetch, url: string, token: string, init: RequestInit = {}) {
  const r = await fetchFn(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  let cuerpo: { result?: unknown };
  try {
    cuerpo = (await r.json()) as typeof cuerpo;
  } catch {
    cuerpo = {};
  }
  return { estado: r.status, cuerpo };
}

/** Id (uuid) de la base con ese nombre; la crea si no existe. Lanza con el permiso que falta. */
export async function asegurarBaseD1(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  nombre: string,
): Promise<{ id: string; creada: boolean }> {
  const base = `${API}/accounts/${cuenta}/d1/database`;
  // El filtro `name` de la API busca por contenido: se exige el nombre exacto.
  const r = await pedirJson(
    fetchFn,
    `${base}?name=${encodeURIComponent(nombre)}&per_page=100`,
    token,
  );
  if (sinPermiso(r.estado)) throw new Error(`al token le falta ${PERMISO_D1}`);
  if (r.estado !== 200) throw new Error(`no se pudo listar las bases D1 (HTTP ${r.estado})`);
  const lista = (r.cuerpo.result as { uuid: string; name: string }[] | undefined) ?? [];
  const existente = lista.find((b) => b.name === nombre);
  if (existente) return { id: existente.uuid, creada: false };
  const c = await pedirJson(fetchFn, base, token, {
    method: 'POST',
    body: JSON.stringify({ name: nombre }),
  });
  if (sinPermiso(c.estado)) throw new Error(`al token le falta ${PERMISO_D1}`);
  const id = (c.cuerpo.result as { uuid?: string } | undefined)?.uuid;
  if (c.estado !== 200 || !id)
    throw new Error(`no se pudo crear la base ${nombre} (HTTP ${c.estado})`);
  return { id, creada: true };
}

/**
 * Configuración de wrangler para desplegar el CORE: la generada (`wranglerDelCore`) con el id de
 * la base en el destino que se despliega. El otro destino queda sin id.
 */
export function configDelCore(
  generada: Record<string, unknown>,
  destino: Destino,
  despliegue: {
    baseId: string;
    /** KV de flags de la celda, para el kill switch `ks:agro-core` (HU-E4.2). */
    flagsId: string;
    /** Orígenes del cuaderno que pueden entrar (CORS y `vuelta`). */
    origenesApp: readonly string[];
  },
): Record<string, unknown> {
  const agregar = (bloque: Record<string, unknown>) => ({
    ...bloque,
    d1_databases: (bloque['d1_databases'] as Record<string, unknown>[]).map((b) => ({
      ...b,
      database_id: despliegue.baseId,
    })),
    kv_namespaces: [{ binding: 'FLAGS', id: despliegue.flagsId }],
    // DESTINO: staging atiende además los productos de prueba (HU-C3.7); producción, nunca.
    vars: { ORIGENES_APP: despliegue.origenesApp.join(','), DESTINO: destino },
  });
  if (destino === 'produccion') return agregar(generada);
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  return { ...generada, env: { ...env, staging: agregar(env['staging'] ?? {}) } };
}

/**
 * Secretos que el despliegue carga en el Worker del CORE (ARQUITECTURA §7.5). La clave de firma
 * se genera solo si el Worker no tiene una: cambiarla invalidaría todas las sesiones.
 *
 * Bold (HU-E0.7) es opcional: sin sus dos llaves, pagar en línea dice «no disponible» y lo demás
 * sigue. Con una sola, falla: media configuración no cobra (P1). Staging usa las de pruebas y
 * producción las de producción; el ambiente viaja con ellas.
 */
export async function secretosDelCore(
  existentes: readonly string[],
  google: { id: string | undefined; secreto: string | undefined },
  nuevaClave: () => Promise<string>,
  bold: {
    identidad: string | undefined;
    secreta: string | undefined;
    ambiente: 'pruebas' | 'produccion';
  } | null = null,
): Promise<Record<string, string>> {
  const sufijo = bold?.ambiente === 'produccion' ? 'PRODUCCION' : 'PRUEBAS';
  const mediaBold = bold && Boolean(bold.identidad) !== Boolean(bold.secreta);
  const faltan = [
    ...(google.id ? [] : ['GOOGLE_CLIENT_ID']),
    ...(google.secreto ? [] : ['GOOGLE_CLIENT_SECRET']),
    ...(mediaBold && !bold.identidad ? [`BOLD_IDENTIDAD_${sufijo}`] : []),
    ...(mediaBold && !bold.secreta ? [`BOLD_SECRETA_${sufijo}`] : []),
  ];
  if (faltan.length > 0) {
    throw new Error(
      `falta el secreto ${faltan.join(' y ')} en GitHub (Settings → Secrets and variables → Actions)`,
    );
  }
  return {
    GOOGLE_CLIENT_ID: google.id ?? '',
    GOOGLE_CLIENT_SECRET: google.secreto ?? '',
    ...(bold?.identidad && bold.secreta
      ? {
          BOLD_IDENTIDAD: bold.identidad,
          BOLD_SECRETA: bold.secreta,
          BOLD_AMBIENTE: bold.ambiente,
        }
      : {}),
    ...(existentes.includes('CORE_JWT_PRIVATE_KEY')
      ? {}
      : { CORE_JWT_PRIVATE_KEY: await nuevaClave() }),
  };
}

/** Archivos fuera de git (ver .gitignore), junto a wrangler.jsonc del CORE. */
export const ARCHIVO_DESPLIEGUE_CORE = 'wrangler.despliegue.jsonc';
export const ARCHIVO_SQL_CELDAS = join('.wrangler', 'celdas.sql');

export function escribirDespliegueCore(
  config: Record<string, unknown>,
  sentenciasCeldas: readonly string[],
): void {
  const dir = join(RAIZ, 'apps', 'core');
  writeFileSync(
    join(dir, ARCHIVO_DESPLIEGUE_CORE),
    `// Armado por scripts/desplegar.ts para un despliegue. No va a git: lleva el id de la base.\n${JSON.stringify(config, null, 2)}\n`,
  );
  mkdirSync(join(dir, '.wrangler'), { recursive: true });
  writeFileSync(join(dir, ARCHIVO_SQL_CELDAS), `${sentenciasCeldas.join('\n')}\n`);
}

/**
 * Antes de migrar, la base no puede tener filas huérfanas (HU-C2.2, CA4b; bitácora core 2): la
 * guarda de las migraciones que rehacen tablas revisa TODA la base, y una huérfana vieja haría
 * fallar la migración por algo que no hizo. Se pregunta con la función de tabla, que D1 acepta
 * (HU-C2.1), y sin comillas internas para que el comando sirva igual en cualquier shell.
 */
export const CONSULTA_HUERFANAS = 'SELECT * FROM pragma_foreign_key_check LIMIT 20';

/**
 * Las filas de cada consulta en la salida de `wrangler d1 execute --json`, en orden, o `null` si la
 * salida no se pudo leer o alguna consulta no tuvo éxito: entonces no se sabe (P1). La salida puede
 * traer texto antes del JSON (wrangler escribe a qué base se conecta).
 */
export function resultadosDeLaSalida(salida: string): Record<string, unknown>[][] | null {
  const inicio = salida.indexOf('[');
  const fin = salida.lastIndexOf(']');
  if (inicio < 0 || fin < inicio) return null;
  try {
    const lotes = JSON.parse(salida.slice(inicio, fin + 1)) as {
      results?: Record<string, unknown>[];
      success?: boolean;
    }[];
    if (!Array.isArray(lotes) || lotes.some((l) => l.success === false || !l.results)) return null;
    return lotes.map((l) => l.results ?? []);
  } catch {
    return null;
  }
}

/**
 * Lee la salida de `wrangler d1 execute --json` con `CONSULTA_HUERFANAS`. Devuelve una frase por
 * huérfana, o `null` si la salida no se pudo leer: entonces no se sabe, y no se migra (P1).
 */
export function huerfanasDeLaSalida(salida: string): string[] | null {
  const lotes = resultadosDeLaSalida(salida);
  if (lotes === null) return null;
  return lotes
    .flat()
    .map(
      (f) =>
        `${String(f['table'] ?? '?')} (fila ${String(f['rowid'] ?? '?')}) apunta a una fila de ${String(f['parent'] ?? '?')} que no existe`,
    );
}
