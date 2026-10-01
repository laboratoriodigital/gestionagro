/**
 * D1 local para las pruebas del CORE (HU-E4.1, CA4): el mismo SQLite de workerd que usa
 * `wrangler dev`, levantado con `getPlatformProxy` y sin persistencia.
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
import type { BaseD1 } from './d1.ts';

const RAIZ = join(import.meta.dirname, '..', '..', '..');
export const DIR_MIGRACIONES = join(RAIZ, 'infrastructure', 'migraciones', 'core');

/** Sentencias de un archivo SQL, sin comentarios de línea. */
export function sentenciasDe(sql: string): string[] {
  return sql
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const migraciones = (): string[] =>
  readdirSync(DIR_MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(DIR_MIGRACIONES, f), 'utf8'));

export async function baseLocal(): Promise<{ db: BaseD1; cerrar: () => Promise<void> }> {
  const proxy = await getPlatformProxy<{ DB: BaseD1 }>({
    configPath: join(RAIZ, 'apps', 'core', 'wrangler.jsonc'),
    persist: false,
  });
  const db = proxy.env.DB;
  for (const sql of migraciones()) {
    for (const sentencia of sentenciasDe(sql)) await db.prepare(sentencia).run();
  }
  return { db, cerrar: () => proxy.dispose() };
}

/** Vacía las tablas en orden de dependencias, para que cada prueba arranque igual. */
export async function vaciar(db: BaseD1): Promise<void> {
  for (const tabla of [
    'invitacion',
    'membresia',
    'sesion',
    'identidad',
    'organizacion',
    'usuario',
    'celda',
  ]) {
    await db.prepare(`DELETE FROM ${tabla}`).run();
  }
}
