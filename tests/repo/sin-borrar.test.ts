/**
 * Nadie borra un registro (ADR-4, HU-E3.12 CA3). Corregir es escribir otro con `anula_id`.
 * Esta guardia falla si el código de las apps o paquetes borra de la tabla `registro`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

/** `registro` y, en la misma sentencia, un borrado de Dexie. */
const BORRA_REGISTRO = /\bregistro\b[^;]*?\.(?:delete|bulkDelete|clear)\(/;

describe('ningún código borra registros', () => {
  it.each([
    ['await db.registro.delete(id);'],
    ['await db.registro.bulkDelete(ids);'],
    ["await db.registro.where('tipo').equals('clima').delete();"],
    ['db.registro\n  .where("fecha_agronomica")\n  .below(x)\n  .delete()'],
    ['await db.registro.clear();'],
  ])('la guardia atrapa «%s»', (codigo) => {
    expect(BORRA_REGISTRO.test(codigo)).toBe(true);
  });

  it.each([
    ['oyentes.delete(oyente);'],
    ['await db.registro.add(registro); await db.outbox.delete(op.id);'],
  ])('la guardia deja pasar «%s»', (codigo) => {
    expect(BORRA_REGISTRO.test(codigo)).toBe(false);
  });

  it('apps/ y packages/ no borran de `registro`', () => {
    const archivos = listarArchivos(
      (rel) => /^(apps|packages)\/.+\.(ts|tsx)$/.test(rel) && !/\.test\.tsx?$/.test(rel),
    );
    expect(archivos.length).toBeGreaterThan(20);
    const culpables = archivos.filter((rel) =>
      BORRA_REGISTRO.test(readFileSync(join(RAIZ, rel), 'utf8')),
    );
    expect(culpables).toEqual([]);
  });
});
