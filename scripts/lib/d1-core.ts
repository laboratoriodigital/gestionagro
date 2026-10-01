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
  baseId: string,
): Record<string, unknown> {
  const conId = (bases: unknown) =>
    (bases as Record<string, unknown>[]).map((b) => ({ ...b, database_id: baseId }));
  if (destino === 'produccion') {
    return { ...generada, d1_databases: conId(generada['d1_databases']) };
  }
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  const staging = env['staging'] ?? {};
  return {
    ...generada,
    env: { ...env, staging: { ...staging, d1_databases: conId(staging['d1_databases']) } },
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
