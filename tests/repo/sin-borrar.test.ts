/**
 * Nadie borra un registro (ADR-4, HU-E3.12 CA3). Corregir es escribir otro con `anula_id`.
 * Esta guardia falla si el código de las apps o paquetes borra de la tabla `registro` (el
 * cuaderno) o de `registros` (la caja del parqueadero), o si reescribe un registro de la caja:
 * en el parqueadero, ni `put` ni `update` sobre lo que ya existe (HU-Q3.7 CA3).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

/** `registro` o `registros` y, en la misma sentencia, un borrado de Dexie. */
const BORRA_REGISTRO = /\bregistros?\b[^;]*?\.(?:delete|bulkDelete|clear)\(/;

/** `registros` de la caja y, en la misma sentencia, una escritura que pisa lo que ya había. */
const REESCRIBE_REGISTROS = /\bregistros\b[^;]*?\.(?:put|bulkPut|update|modify)\(/;

const tocaRegistros = (codigo: string) =>
  BORRA_REGISTRO.test(codigo) || REESCRIBE_REGISTROS.test(codigo);

/**
 * Borrados permitidos, uno por uno y con su motivo. Ninguno toca la nube: el registro sigue en la
 * celda y en los teléfonos de quien puede verlo.
 */
const EXCEPCIONES = [
  {
    archivo: 'apps/cuaderno/src/almacen/recepcion.ts',
    fragmento: 'await db.registro.bulkDelete(ids.filter((id) => !pendientes.has(id)));',
    motivo:
      'si a una persona le quitan un rol, su teléfono deja de guardar los registros que ya no puede ver (los despachos llevan precios, HU-E4.5 y HU-E6.3)',
  },
] as const;

/** Los comentarios dicen «registros» sin tocarlos: la guardia lee solo el código. */
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sinExcepciones = (rel: string) =>
  sinComentarios(
    EXCEPCIONES.filter((e) => e.archivo === rel).reduce(
      (texto, e) => texto.replace(e.fragmento, ''),
      readFileSync(join(RAIZ, rel), 'utf8'),
    ),
  );

describe('ningún código borra registros', () => {
  it.each([
    ['await db.registro.delete(id);'],
    ['await db.registro.bulkDelete(ids);'],
    ["await db.registro.where('tipo').equals('clima').delete();"],
    ['db.registro\n  .where("fecha_agronomica")\n  .below(x)\n  .delete()'],
    ['await db.registro.clear();'],
    // La caja del parqueadero: la tabla en plural (HU-Q3.7 CA3).
    ['await db.registros.delete(id);'],
    ["await db.registros.where('tipo').equals('entrada').delete();"],
    ['await db.registros.put(registro);'],
    ['await db.registros.update(id, { datos });'],
    ['await db.registros.bulkPut(filas);'],
  ])('la guardia atrapa «%s»', (codigo) => {
    expect(tocaRegistros(codigo)).toBe(true);
  });

  it.each([
    ['oyentes.delete(oyente);'],
    ['await db.registro.add(registro); await db.outbox.delete(op.id);'],
    ['await db.registros.add(anulacion); await db.estadias.delete(r.id);'],
    ['await db.registros.bulkAdd(nuevos);'],
  ])('la guardia deja pasar «%s»', (codigo) => {
    expect(tocaRegistros(codigo)).toBe(false);
  });

  it('apps/ y packages/ no borran de `registro` ni de `registros`, ni los reescriben', () => {
    const archivos = listarArchivos(
      (rel) => /^(apps|packages)\/.+\.(ts|tsx)$/.test(rel) && !/\.test\.tsx?$/.test(rel),
    );
    expect(archivos.length).toBeGreaterThan(20);
    const culpables = archivos.filter((rel) => tocaRegistros(sinExcepciones(rel)));
    expect(culpables).toEqual([]);
  });

  it('cada excepción sigue en su archivo (si no, se borra de la lista)', () => {
    for (const e of EXCEPCIONES) {
      expect(readFileSync(join(RAIZ, e.archivo), 'utf8')).toContain(e.fragmento);
    }
  });
});
