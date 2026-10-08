/**
 * Las celdas del parqueadero en el despliegue (HU-Q7.2, PARQUEADERO §10 y §14).
 *
 * Una celda del parqueadero todavía no tiene Worker: su API llega con HU-Q7.4. Lo que el despliegue
 * prepara, por celda y solo en staging:
 * 1. una base D1 por shard (`parqueadero_c2_s1_staging`), con las migraciones de
 *    `infrastructure/migraciones/parqueadero`;
 * 2. el KV de flags de la celda (`parqueadero-c2-flags-staging`) con los kill switches que el
 *    producto declara en `infrastructure/productos.json` (HU-Q7.13), creados en «encendido» solo si
 *    faltan: un despliegue nunca vuelve a encender lo que el dueño apagó;
 * 3. una prueba de humo que solo lee: las tablas del shard están.
 *
 * En producción no prepara nada todavía: el dueño autorizó staging, y producción espera la API
 * (HU-Q7.4) y la publicación del parqueadero en la nube (HU-Q7.12).
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** La nota de producción mientras la celda espera su API (HU-Q7.4) y su publicación (HU-Q7.12). */
export const notaSinProduccion = (celdaId: string) =>
  `celda ${celdaId} del parqueadero: en producción todavía no se prepara (su API llega con HU-Q7.4; staging sí)`;

/**
 * Las celdas que el despliegue escribe en el directorio del CORE: en producción, sin las del
 * parqueadero, para que ninguna organización caiga en una celda sin API (HU-Q7.12 las publica).
 */
export const celdasDelDirectorio = <C extends { producto: string }>(
  celdas: readonly C[],
  destino: Destino,
): C[] => celdas.filter((c) => destino === 'staging' || c.producto !== 'parqueadero');

/** La configuración generada con el id de la base de cada shard, solo en el destino que se prepara. */
export function configDeLaCeldaDelParqueadero(
  generada: Record<string, unknown>,
  destino: Destino,
  bases: Readonly<Record<string, string>>,
): Record<string, unknown> {
  const agregar = (bloque: Record<string, unknown>) => ({
    ...bloque,
    d1_databases: (bloque['d1_databases'] as { binding: string }[]).map((b) => {
      const id = bases[b.binding];
      if (!id) throw new Error(`falta el id de la base del shard ${b.binding}`);
      return { ...b, database_id: id };
    }),
  });
  if (destino === 'produccion') return agregar(generada);
  const env = generada['env'] as Record<string, Record<string, unknown>>;
  return { ...generada, env: { ...env, staging: agregar(env['staging'] ?? {}) } };
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
