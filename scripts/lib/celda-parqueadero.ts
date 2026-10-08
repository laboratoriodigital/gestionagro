/**
 * Las celdas del parqueadero en el despliegue (HU-Q7.2 y HU-Q7.4, PARQUEADERO §10, §12 y §14).
 *
 * Lo que el despliegue prepara, por celda y solo en staging:
 * 1. una base D1 por shard (`parqueadero_c2_s1_staging`), con las migraciones de
 *    `infrastructure/migraciones/parqueadero`;
 * 2. el KV de flags de la celda (`parqueadero-c2-flags-staging`) con los kill switches que el
 *    producto declara en `infrastructure/productos.json` (HU-Q7.13), creados en «encendido» solo si
 *    faltan: un despliegue nunca vuelve a encender lo que el dueño apagó;
 * 3. una prueba de humo que solo lee: las tablas del shard están;
 * 4. el Worker de su API (`parqueadero-api-c2-staging`, HU-Q7.4), con las claves públicas del CORE
 *    y el origen de la caja, y su prueba de humo: `/api/salud` y `/api/v1/*` sin token da 401;
 * 5. la llave de recibos de la celda (HU-Q8.1), solo si el Worker no tiene una, y la caja de
 *    staging con esa llave pública dentro de `/r/` (HU-Q8.2).
 *
 * En producción no prepara nada todavía: el dueño autorizó staging, y producción espera la
 * publicación del parqueadero en la nube (HU-Q7.12).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Producto } from '@ed1/productos';
import { resultadosDeLaSalida } from './d1-core.ts';
import type { Destino } from './despliegue.ts';
import { RAIZ } from './repo.ts';

export const ARCHIVO_DESPLIEGUE_PARQUEADERO = 'wrangler.despliegue.jsonc';

/**
 * Las tablas de datos del shard (migración 0001): si están, las migraciones se aplicaron. La
 * consulta va sin comillas internas, como la del CORE, para que sirva igual en cualquier shell.
 */
export const TABLAS_DEL_SHARD = [
  'catalogo',
  'cuarentena',
  'dispositivo',
  'entidad_historial',
  'purga',
  'registro',
] as const;
export const CONSULTA_HUMO_SHARD = 'SELECT name FROM pragma_table_list ORDER BY name';

/** La nota de producción mientras la celda espera su publicación (HU-Q7.12). */
export const notaSinProduccion = (celdaId: string) =>
  `celda ${celdaId} del parqueadero: en producción todavía no se prepara (espera su publicación, HU-Q7.12; staging sí)`;

/**
 * Las celdas que el despliegue escribe en el directorio del CORE: en producción, sin las del
 * parqueadero, para que ninguna organización caiga en una celda sin API (HU-Q7.12 las publica).
 */
export const celdasDelDirectorio = <C extends { producto: string }>(
  celdas: readonly C[],
  destino: Destino,
): C[] => celdas.filter((c) => destino === 'staging' || c.producto !== 'parqueadero');

/**
 * Si este despliegue prepara las celdas del parqueadero. Staging despliega siempre lo que llegó a
 * main, como la caja de staging, aunque su lista de productos sea la de siempre (core y agro);
 * producción, solo cuando el parqueadero se publica (y hoy se limita a la nota de producción).
 */
export const preparaLasCeldasDelParqueadero = (
  destino: Destino,
  productos: ReadonlySet<string>,
): boolean => destino === 'staging' || productos.has('parqueadero');

/** Lo que el despliegue agrega a la configuración generada de una celda del parqueadero. */
export interface DespliegueDeLaCelda {
  /** Id de la base de cada shard, por nombre de shard. */
  bases: Readonly<Record<string, string>>;
  flagsId: string;
  clavesCore: readonly unknown[];
  origenesApp: readonly string[];
}

/** La configuración generada con lo de este despliegue, solo en el destino que se prepara. */
export function configDeLaCeldaDelParqueadero(
  generada: Record<string, unknown>,
  destino: Destino,
  despliegue: DespliegueDeLaCelda,
): Record<string, unknown> {
  const agregar = (bloque: Record<string, unknown>) => ({
    ...bloque,
    d1_databases: (bloque['d1_databases'] as { binding: string }[]).map((b) => {
      const id = despliegue.bases[b.binding];
      if (!id) throw new Error(`falta el id de la base del shard ${b.binding}`);
      return { ...b, database_id: id };
    }),
    kv_namespaces: [{ binding: 'FLAGS', id: despliegue.flagsId }],
    vars: {
      ...(bloque['vars'] as Record<string, string>),
      CORE_CLAVES: JSON.stringify(despliegue.clavesCore),
      ORIGENES_APP: despliegue.origenesApp.join(','),
    },
  });
  if (destino === 'produccion') return agregar(generada);
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  return { ...generada, env: { ...env, staging: agregar(env['staging'] ?? {}) } };
}

/** Los orígenes de la caja en ese destino (`productos.json`, `app.origenes`): los únicos del CORS. */
export function origenesDeLaCaja(producto: Producto | undefined, destino: Destino): string[] {
  const origenes = producto?.app.origenes;
  if (!origenes || typeof origenes === 'string') {
    throw new Error(
      `${producto?.id ?? 'el producto'} no declara los orígenes de su app en productos.json`,
    );
  }
  return [origenes[destino]];
}

/** Fuera de git (ver .gitignore): lleva los ids de las bases (ADR-6). */
export function escribirDespliegueDelParqueadero(config: Record<string, unknown>): string {
  const ruta = join(RAIZ, 'apps', 'parqueadero-api', ARCHIVO_DESPLIEGUE_PARQUEADERO);
  writeFileSync(
    ruta,
    `// Armado por scripts/desplegar.ts para un despliegue. No va a git: lleva ids de bases.\n${JSON.stringify(config, null, 2)}\n`,
  );
  return ruta;
}

/**
 * Lee la salida de `wrangler d1 execute --json` con `CONSULTA_HUMO_SHARD`: las tablas que faltan,
 * o `null` si la salida no se pudo leer (entonces no se sabe, y la prueba falla: P1).
 */
export function tablasQueFaltan(salida: string): string[] | null {
  const lotes = resultadosDeLaSalida(salida);
  if (lotes === null) return null;
  const hay = new Set(lotes.flat().map((f) => String(f['name'])));
  return TABLAS_DEL_SHARD.filter((t) => !hay.has(t));
}

/** La llave con que la celda certifica las cajas (HU-Q8.1, PARQUEADERO §11.4). */
export const SECRETO_DE_RECIBOS = 'CELDA_RECIBO_PRIVATE_KEY';

/**
 * Los secretos del Worker de la celda: la llave de recibos, **solo si el Worker no tiene una**
 * (HU-Q8.1 CA3). Cambiarla haría que los certificados ya emitidos dejen de verificarse en `/r/`, y
 * con ellos todos los recibos firmados. Se genera una vez y nunca se reemplaza.
 */
export async function secretosDeLaCeldaDelParqueadero(
  existentes: readonly string[],
  nuevaClave: () => Promise<string>,
): Promise<{ secretos: Record<string, string>; claveNueva: boolean }> {
  if (existentes.includes(SECRETO_DE_RECIBOS)) return { secretos: {}, claveNueva: false };
  return { secretos: { [SECRETO_DE_RECIBOS]: await nuevaClave() }, claveNueva: true };
}
