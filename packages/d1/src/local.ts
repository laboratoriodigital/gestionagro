/**
 * D1 local para las pruebas del CORE y de las celdas: el mismo SQLite de workerd que usa
 * `wrangler dev`, levantado con `getPlatformProxy` y sin persistencia (bitácora agro, «Lo que el
 * terreno enseñó»: el Miniflare que trae wrangler 4.144 es una alfa con otra API).
 *
 * Lo que este instrumento NO imita (P17):
 * - los límites del plan gratuito: 50 consultas por invocación, filas escritas al día, tamaño;
 * - la latencia y las réplicas de lectura de D1 en Cloudflare;
 * - `wrangler d1 migrations apply`: aquí las migraciones se parten por «;» al final de línea y
 *   se corren en orden. Que wrangler las acepte se comprueba en el despliegue a staging (P16).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import type { BaseD1 } from './index.ts';

export const RAIZ = join(import.meta.dirname, '..', '..', '..');
export const dirMigraciones = (base: 'core' | 'celda') =>
  join(RAIZ, 'infrastructure', 'migraciones', base);

/**
 * Sentencias de un archivo SQL, sin comentarios de línea. Una sentencia termina en «;» al final
 * de una línea, salvo dentro de un `CREATE TRIGGER … BEGIN … END;`, que llega completo.
 */
export function sentenciasDe(sql: string): string[] {
  const sentencias: string[] = [];
  let actual: string[] = [];
  let enTrigger = false;
  for (const linea of sql.split(/\r?\n/)) {
    if (linea.trim().startsWith('--')) continue;
    if (actual.length === 0 && /^\s*CREATE\s+TRIGGER\b/i.test(linea)) enTrigger = true;
    actual.push(linea);
    const cierra = enTrigger ? /^\s*END\s*;\s*$/i.test(linea) : /;\s*$/.test(linea);
    if (cierra) {
      sentencias.push(actual.join('\n').trim().replace(/;$/, ''));
      actual = [];
      enTrigger = false;
    }
  }
  const resto = actual.join('\n').trim();
  if (resto) sentencias.push(resto);
  return sentencias.filter(Boolean);
}

export const migraciones = (base: 'core' | 'celda'): string[] =>
  readdirSync(dirMigraciones(base))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dirMigraciones(base), f), 'utf8'));

/**
 * Base local con las migraciones aplicadas. `configuracion` es la ruta (desde la raíz) del
 * wrangler.jsonc que declara el binding.
 */
export async function baseLocal(opciones: {
  configuracion: string;
  binding: string;
  base: 'core' | 'celda';
}): Promise<{ db: BaseD1; cerrar: () => Promise<void> }> {
  const proxy = await getPlatformProxy<Record<string, BaseD1>>({
    configPath: join(RAIZ, opciones.configuracion),
    persist: false,
  });
  const db = proxy.env[opciones.binding];
  if (!db) throw new Error(`${opciones.configuracion} no declara el binding ${opciones.binding}`);
  for (const sql of migraciones(opciones.base)) {
    for (const sentencia of sentenciasDe(sql)) await db.prepare(sentencia).run();
  }
  return { db, cerrar: () => proxy.dispose() };
}

/** Vacía las tablas en el orden dado (dependencias primero), para que cada prueba arranque igual. */
export async function vaciar(db: BaseD1, tablas: readonly string[]): Promise<void> {
  for (const tabla of tablas) await db.prepare(`DELETE FROM ${tabla}`).run();
}
