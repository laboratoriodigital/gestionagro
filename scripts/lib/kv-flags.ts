/**
 * KV de flags de la celda y claves de kill switch (HU-E8.1, ARQUITECTURA §5.5 y §8.2).
 *
 * El despliegue, antes de publicar el Worker:
 * 1. asegura el namespace `<producto>-c{N}-flags` (con `-staging` en staging): lo crea si no existe;
 * 2. crea `ks:<product.id>` en `encendido` para cada contrato con `kill_switch: true` **si
 *    falta**. Una clave que ya existe no se toca: un despliegue nunca vuelve a encender lo que
 *    el dueño apagó (CA2);
 * 3. arma la configuración de wrangler con el id del namespace en un archivo fuera de git. El id
 *    depende de la cuenta: no se escribe en el repositorio (ADR-6).
 *
 * Funciones con `fetch` inyectado, para probarlas sin tocar Cloudflare.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { claveKillSwitch, ENCENDIDO } from '../../packages/kill-switch/src/index.ts';
import type { Destino, Fetch } from './despliegue.ts';
import type { Producto } from './productos.ts';
import { RAIZ } from './repo.ts';

const API = 'https://api.cloudflare.com/client/v4';
export const BINDING_FLAGS = 'FLAGS';
const PERMISO_KV = '«Account → Workers KV Storage: Edit»';

/** `agro-c0-flags`; una celda de otro producto lleva su nombre: `parqueadero-c2-flags` (HU-Q7.2). */
export const nombreKvFlags = (celdaId: string, destino: Destino, producto = 'agro'): string =>
  `${producto}-${celdaId}-flags${destino === 'staging' ? '-staging' : ''}`;

/** Claves que el despliegue asegura: una por contrato con `kill_switch: true` (CA2, P2). */
export const clavesDeKillSwitch = (productos: readonly Pick<Producto, 'id' | 'kill_switch'>[]) =>
  productos.filter((p) => p.kill_switch).map((p) => claveKillSwitch(p.id));

const sinPermiso = (estado: number) => estado === 401 || estado === 403;

async function pedirJson(fetchFn: Fetch, url: string, token: string, init: RequestInit = {}) {
  const r = await fetchFn(url, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  let cuerpo: { success?: boolean; result?: unknown; result_info?: { total_pages?: number } };
  try {
    cuerpo = (await r.json()) as typeof cuerpo;
  } catch {
    cuerpo = {};
  }
  return { estado: r.status, cuerpo };
}

/** Id del namespace con ese título; lo crea si no existe. Lanza con el permiso que falta. */
export async function asegurarNamespace(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  titulo: string,
): Promise<{ id: string; creado: boolean }> {
  const base = `${API}/accounts/${cuenta}/storage/kv/namespaces`;
  for (let pagina = 1; ; pagina++) {
    const r = await pedirJson(fetchFn, `${base}?per_page=100&page=${pagina}`, token);
    if (sinPermiso(r.estado)) throw new Error(`al token le falta ${PERMISO_KV}`);
    if (r.estado !== 200)
      throw new Error(`no se pudo listar los KV de la cuenta (HTTP ${r.estado})`);
    const lista = (r.cuerpo.result as { id: string; title: string }[] | undefined) ?? [];
    const encontrado = lista.find((n) => n.title === titulo);
    if (encontrado) return { id: encontrado.id, creado: false };
    if (pagina >= (r.cuerpo.result_info?.total_pages ?? 1) || lista.length === 0) break;
  }
  const r = await pedirJson(fetchFn, base, token, {
    method: 'POST',
    body: JSON.stringify({ title: titulo }),
  });
  const id = (r.cuerpo.result as { id?: string } | undefined)?.id;
  if (sinPermiso(r.estado)) throw new Error(`al token le falta ${PERMISO_KV}`);
  if (r.estado !== 200 || !id)
    throw new Error(`no se pudo crear el KV ${titulo} (HTTP ${r.estado})`);
  return { id, creado: true };
}

/** Crea en `encendido` las claves que faltan. Las que existen no se leen ni se escriben de nuevo. */
export async function asegurarClaves(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  namespaceId: string,
  claves: readonly string[],
): Promise<{ creadas: string[]; existentes: string[] }> {
  const valores = `${API}/accounts/${cuenta}/storage/kv/namespaces/${namespaceId}/values`;
  const creadas: string[] = [];
  const existentes: string[] = [];
  for (const clave of claves) {
    const url = `${valores}/${encodeURIComponent(clave)}`;
    const actual = await fetchFn(url, { headers: { authorization: `Bearer ${token}` } });
    if (sinPermiso(actual.status)) throw new Error(`al token le falta ${PERMISO_KV}`);
    if (actual.status === 200) {
      existentes.push(clave);
      continue;
    }
    if (actual.status !== 404) {
      throw new Error(`no se pudo leer ${clave} (HTTP ${actual.status}); no se tocó nada más`);
    }
    const r = await fetchFn(url, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'text/plain' },
      body: ENCENDIDO,
    });
    if (r.status !== 200) throw new Error(`no se pudo crear ${clave} (HTTP ${r.status})`);
    creadas.push(clave);
  }
  return { creadas, existentes };
}

/**
 * Configuración de wrangler para desplegar: la generada (`wranglerDelSitio`) más el KV de flags
 * del destino. Solo el destino que se despliega lleva el binding.
 */
export function configDeDespliegue(
  generada: Record<string, unknown>,
  destino: Destino,
  namespaceId: string,
): Record<string, unknown> {
  const kv = [{ binding: BINDING_FLAGS, id: namespaceId }];
  if (destino === 'produccion') return { ...generada, kv_namespaces: kv };
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  return { ...generada, env: { ...env, staging: { ...env['staging'], kv_namespaces: kv } } };
}

/** Archivo fuera de git (ver .gitignore) junto a wrangler.jsonc: las rutas relativas siguen valiendo. */
export const ARCHIVO_DESPLIEGUE = 'wrangler.despliegue.jsonc';

export function escribirConfigDeDespliegue(config: Record<string, unknown>): string {
  const ruta = join(RAIZ, 'apps', 'sitio', ARCHIVO_DESPLIEGUE);
  writeFileSync(
    ruta,
    `// Armado por scripts/desplegar.ts para un despliegue. No va a git: lleva el id del KV.\n${JSON.stringify(config, null, 2)}\n`,
  );
  return ruta;
}
