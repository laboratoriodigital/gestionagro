/**
 * API de la celda en el despliegue (HU-E5.1, ARQUITECTURA §5.5).
 *
 * Por cada celda, antes de publicar su Worker, el despliegue:
 * 1. asegura una base D1 por shard (`agro_c0_s1`, con `_staging` en staging);
 * 2. asegura el KV de flags de la celda y sus claves de kill switch (`ks:agro-cuaderno`);
 * 3. lee la clave pública del CORE del mismo destino (`/api/core/claves`): la celda verifica los
 *    tokens con ella, sin llamar al CORE (ADR-10);
 * 4. arma la configuración con los ids, fuera de git (ADR-6), y aplica las migraciones a cada
 *    shard.
 * Funciones con `fetch` inyectado, para probarlas sin tocar Cloudflare.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Destino, Fetch } from './despliegue.ts';
import { RAIZ } from './repo.ts';

export const ARCHIVO_DESPLIEGUE_CELDA = 'wrangler.despliegue.jsonc';

/** Claves públicas que publica el CORE. Lanza si no hay ninguna: una celda sin clave no sirve. */
export async function clavesDelCore(fetchFn: Fetch, urlCore: string): Promise<unknown[]> {
  let r: Response;
  try {
    r = await fetchFn(`${urlCore}/api/core/claves`);
  } catch (e) {
    throw new Error(
      `el CORE (${urlCore}) no respondió al pedir su clave pública: ${(e as Error).message}`,
    );
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { claves?: unknown[] };
  if (r.status !== 200 || !Array.isArray(cuerpo.claves) || cuerpo.claves.length === 0) {
    throw new Error(
      `el CORE (${urlCore}) no entregó su clave pública (HTTP ${r.status}); despliega el CORE primero`,
    );
  }
  return cuerpo.claves;
}

export function configDeLaCelda(
  generada: Record<string, unknown>,
  destino: Destino,
  despliegue: {
    /** Id de la base de cada shard, por nombre de shard. */
    bases: Readonly<Record<string, string>>;
    flagsId: string;
    clavesCore: readonly unknown[];
    origenesApp: readonly string[];
    /** Cuenta de Cloudflare cuyas cuotas mide el vigía (HU-E8.2). */
    cuenta: string;
  },
): Record<string, unknown> {
  const agregar = (bloque: Record<string, unknown>) => {
    const d1 = (bloque['d1_databases'] as { binding: string }[]).map((b) => {
      const id = despliegue.bases[b.binding];
      if (!id) throw new Error(`falta el id de la base del shard ${b.binding}`);
      return { ...b, database_id: id };
    });
    return {
      ...bloque,
      d1_databases: d1,
      kv_namespaces: [{ binding: 'FLAGS', id: despliegue.flagsId }],
      vars: {
        ...(bloque['vars'] as Record<string, string>),
        CORE_CLAVES: JSON.stringify(despliegue.clavesCore),
        ORIGENES_APP: despliegue.origenesApp.join(','),
        CF_CUENTA: despliegue.cuenta,
      },
    };
  };
  if (destino === 'produccion') return agregar(generada);
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  return { ...generada, env: { ...env, staging: agregar(env['staging'] ?? {}) } };
}

export function escribirDespliegueCelda(config: Record<string, unknown>): void {
  writeFileSync(
    join(RAIZ, 'apps', 'api-celda', ARCHIVO_DESPLIEGUE_CELDA),
    `// Armado por scripts/desplegar.ts para un despliegue. No va a git: lleva ids de bases y KV.\n${JSON.stringify(config, null, 2)}\n`,
  );
}

/**
 * Prueba de humo de la celda: los shards responden con su migración, y `/api/v1/*` rechaza a quien
 * no trae token. Solo lee; nunca escribe en un shard (P11).
 */
export async function humoCelda(fetchFn: Fetch, base: string, shards: number): Promise<string[]> {
  const fallas: string[] = [];
  try {
    const salud = await fetchFn(`${base}/api/salud`);
    const cuerpo = (await salud.json().catch(() => ({}))) as { shards?: number; motivo?: string };
    if (salud.status !== 200) {
      fallas.push(`/api/salud: respondió ${salud.status} (${cuerpo.motivo ?? 'sin motivo'})`);
    } else if (cuerpo.shards !== shards) {
      fallas.push(
        `/api/salud: la celda tiene ${String(cuerpo.shards)} shards y celdas.json ${shards}`,
      );
    }
    const sinToken = await fetchFn(`${base}/api/v1/yo`);
    if (sinToken.status !== 401) {
      fallas.push(`/api/v1/yo sin token: respondió ${sinToken.status}, se esperaba 401`);
    }
  } catch (e) {
    fallas.push(`la celda no respondió (${(e as Error).message})`);
  }
  return fallas;
}

/**
 * Secretos del Worker de la celda:
 * - `CF_METRICAS_TOKEN` (HU-E8.2), si está en GitHub. Si falta, se avisa: el vigía no puede medir.
 * - `CELDA_QR_PRIVATE_KEY` (HU-E6.4), **solo si el Worker no tiene una**: cambiarla haría que las
 *   etiquetas ya impresas dejen de verificarse.
 */
export async function secretosDeLaCelda(
  existentes: readonly string[],
  tokenMetricas: string | undefined,
  nombreSecretoMetricas: string,
  nuevaClave: () => Promise<string>,
): Promise<{ secretos: Record<string, string>; avisos: string[]; claveNueva: boolean }> {
  const claveNueva = !existentes.includes('CELDA_QR_PRIVATE_KEY');
  return {
    secretos: {
      ...(tokenMetricas ? { CF_METRICAS_TOKEN: tokenMetricas } : {}),
      ...(claveNueva ? { CELDA_QR_PRIVATE_KEY: await nuevaClave() } : {}),
    },
    avisos: tokenMetricas
      ? []
      : [
          `⚠ falta el secreto ${nombreSecretoMetricas}: el vigía de cuota no puede medir y dejará la celda en «alerta»`,
        ],
    claveNueva,
  };
}
