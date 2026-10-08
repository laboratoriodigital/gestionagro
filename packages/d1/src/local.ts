/**
 * D1 local para las pruebas del CORE y de las celdas. Dos instrumentos (HU-C11.7): el SQLite de
 * workerd que usa `wrangler dev`, levantado con `getPlatformProxy` y sin persistencia (bitácora
 * agro, «Lo que el terreno enseñó»: el Miniflare que trae wrangler 4.144 es una alfa con otra API),
 * y una base en proceso sobre `node:sqlite` (`./sqlite.ts`), unas mil veces más rápida por
 * sentencia. Los PR usan la segunda; `main` y las pruebas que prueban D1 mismo, la primera.
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
import { baseEnMemoria } from './sqlite.ts';

export const RAIZ = join(import.meta.dirname, '..', '..', '..');
/** Las migraciones de cada base: el CORE, la celda del agro y el shard del parqueadero (HU-Q7.2). */
export type Base = 'core' | 'celda' | 'parqueadero';
export const dirMigraciones = (base: Base) => join(RAIZ, 'infrastructure', 'migraciones', base);

/**
 * Sentencias de un archivo SQL, sin comentarios de línea. Una sentencia termina en «;» al final
 * de una línea (con o sin un comentario `--` después), salvo dentro de un
 * `CREATE TRIGGER … BEGIN … END;`, que llega completo.
 */
export function sentenciasDe(sql: string): string[] {
  const sentencias: string[] = [];
  let actual: string[] = [];
  let enTrigger = false;
  for (let linea of sql.split(/\r?\n/)) {
    if (linea.trim().startsWith('--')) continue;
    // Una línea en blanco antes del trigger no lo esconde (el shard del parqueadero la tiene).
    const empieza = actual.every((l) => l.trim() === '');
    if (empieza && /^\s*CREATE\s+TRIGGER\b/i.test(linea)) enTrigger = true;
    // «('punto');  -- puesto de trabajo» también cierra.
    if (!enTrigger) linea = linea.replace(/;\s*--[^']*$/, ';');
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

export const migraciones = (base: Base): string[] =>
  readdirSync(dirMigraciones(base))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dirMigraciones(base), f), 'utf8'));

/**
 * Con qué se prueba (HU-C11.7): `sqlite` es la base en proceso de `./sqlite.ts`, rápida; `workerd`
 * es el D1 local de `getPlatformProxy`, fiel y lento (12 a 14 ms por sentencia). Manda la prueba si
 * lo pide (las que prueban D1 mismo piden `workerd`), después `D1_INSTRUMENTO` (el CI de `main` pone
 * `workerd`), y si no, `sqlite`.
 */
export type Instrumento = 'sqlite' | 'workerd';

export function instrumentoDe(pedido?: Instrumento): Instrumento {
  if (pedido) return pedido;
  const variable = process.env['D1_INSTRUMENTO']?.trim();
  if (variable === 'workerd' || variable === 'sqlite') return variable;
  if (variable) throw new Error(`D1_INSTRUMENTO=«${variable}»: tiene que ser sqlite o workerd`);
  return 'sqlite';
}

/**
 * Base local con las migraciones aplicadas. `configuracion` es la ruta (desde la raíz) del
 * wrangler.jsonc que declara el binding; con `sqlite` no se usa, pero se valida igual.
 */
export async function baseLocal(opciones: {
  configuracion: string;
  binding: string;
  base: Base;
  instrumento?: Instrumento;
}): Promise<{ db: BaseD1; cerrar: () => Promise<void> }> {
  let db: BaseD1 | undefined;
  let cerrar: () => Promise<void>;
  if (instrumentoDe(opciones.instrumento) === 'sqlite') {
    ({ db, cerrar } = baseEnMemoria());
  } else {
    const proxy = await getPlatformProxy<Record<string, BaseD1>>({
      configPath: join(RAIZ, opciones.configuracion),
      persist: false,
    });
    db = proxy.env[opciones.binding];
    cerrar = () => proxy.dispose();
  }
  if (!db) throw new Error(`${opciones.configuracion} no declara el binding ${opciones.binding}`);
  for (const sql of migraciones(opciones.base)) {
    for (const sentencia of sentenciasDe(sql)) await db.prepare(sentencia).run();
  }
  return { db, cerrar };
}

/** Vacía las tablas en el orden dado (dependencias primero), para que cada prueba arranque igual. */
export async function vaciar(db: BaseD1, tablas: readonly string[]): Promise<void> {
  for (const tabla of tablas) await db.prepare(`DELETE FROM ${tabla}`).run();
}
