/**
 * Aislamiento de tenant (HU-E4.5, CA3; ARQUITECTURA §9): cada consulta SQL del Worker de la celda
 * filtra por el `org_id` del token. La prueba lee el código, no lo ejecuta: una consulta nueva sin
 * filtro falla aquí antes de llegar a una base con datos de otras fincas.
 *
 * Reglas, por cada tabla con datos de una organización:
 * - `FROM tabla` y `UPDATE tabla`: su WHERE (hasta cerrar el paréntesis en una subconsulta) dice
 *   `org_id = ?`.
 * - `INSERT INTO tabla (…)`: la lista de columnas lleva `org_id`.
 *
 * Las excepciones van con su motivo, una por una.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLAS_DEL_SHARD } from '../../apps/api-celda/src/worker.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const DIR = join(RAIZ, 'apps', 'api-celda', 'src');

const EXCEPCIONES: Record<string, string> = {
  'select id, org_id from registro where id in':
    'busca el id en todas las organizaciones para saber si otra ya lo usa; el resultado solo se compara con la organización del token y nunca sale en la respuesta (push.ts)',
  'select id, org_id, entidad, version, datos from catalogo where id in':
    'lo mismo para los catálogos: detectar un id ajeno y mandarlo a cuarentena (push.ts)',
};

const normal = (sql: string) =>
  sql
    .replace(/\$\{[^}]*\}/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** Las consultas de un archivo: el texto de cada `.prepare(…)`. */
function consultasDe(codigo: string): string[] {
  return [...codigo.matchAll(/\.prepare\(\s*(['"`])([\s\S]*?)\1/g)].map((m) => normal(m[2] ?? ''));
}

/** Desde `inicio` hasta el paréntesis que cierra la subconsulta, o hasta el final. */
function alcance(sql: string, inicio: number): string {
  let nivel = 0;
  for (let i = inicio; i < sql.length; i++) {
    if (sql[i] === '(') nivel++;
    if (sql[i] === ')' && --nivel < 0) return sql.slice(inicio, i);
  }
  return sql.slice(inicio);
}

/** Qué le falta a la consulta, o null si filtra por organización. */
function faltaOrg(sql: string): string | null {
  if (Object.keys(EXCEPCIONES).some((e) => sql.startsWith(e))) return null;
  const tablas = TABLAS_DEL_SHARD.join('|');
  for (const m of sql.matchAll(
    new RegExp(`\\binsert(?: or \\w+)? into (${tablas}) \\(([^)]*)\\)`, 'g'),
  )) {
    if (!/\borg_id\b/.test(m[2] ?? '')) return `INSERT en ${m[1]} sin la columna org_id`;
  }
  for (const m of sql.matchAll(new RegExp(`\\b(?:from|update) (${tablas})\\b`, 'g'))) {
    const parte = alcance(sql, m.index ?? 0);
    if (!/\bwhere\b.*\b(?:\w+\.)?org_id = \?/.test(parte))
      return `${m[0]} sin «where … org_id = ?»`;
  }
  return null;
}

const archivos = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
const consultas = archivos.flatMap((archivo) =>
  consultasDe(readFileSync(join(DIR, archivo), 'utf8')).map((sql) => ({ archivo, sql })),
);

describe('CA3 · toda consulta de la celda filtra por el org_id del token', () => {
  it('encuentra las consultas (si el patrón deja de verlas, esta prueba no probaría nada)', () => {
    expect(consultas.length).toBeGreaterThanOrEqual(10);
    expect(new Set(consultas.map((c) => c.archivo))).toEqual(
      new Set(['push.ts', 'pull.ts', 'qr.ts', 'worker.ts']),
    );
  });

  it.each(consultas.map((c) => [c.archivo, c.sql.slice(0, 70), c.sql] as const))(
    '%s: %s…',
    (_archivo, _inicio, sql) => {
      expect(faltaOrg(sql)).toBeNull();
    },
  );

  it('cada excepción sigue existiendo en el código (si no, se borra de la lista)', () => {
    for (const e of Object.keys(EXCEPCIONES)) {
      expect(consultas.some((c) => c.sql.startsWith(e))).toBe(true);
    }
  });

  it('la regla ve los defectos (control negativo)', () => {
    expect(faltaOrg('select seq, datos from catalogo where seq > ? order by seq')).toMatch(
      /from catalogo/,
    );
    expect(faltaOrg('insert into cuarentena (id, motivo) values (?, ?)')).toMatch(
      /INSERT en cuarentena/,
    );
    expect(
      faltaOrg(
        'insert into registro (id, org_id, seq) values (?, ?, (select coalesce(max(seq), 0) + 1 from registro))',
      ),
    ).toMatch(/from registro/);
    expect(faltaOrg('select count(*) as n from registro where org_id = ?')).toBeNull();
  });
});
