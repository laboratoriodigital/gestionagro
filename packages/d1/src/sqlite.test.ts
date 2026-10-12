/**
 * HU-C11.7: el instrumento en proceso imita lo que el código usa de D1. Lo que no imita está
 * escrito en `./sqlite.ts`; la batería entera corre también en workerd en el CI de main (P17).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { instrumentoDe } from './local.ts';
import { baseEnMemoria } from './sqlite.ts';

const original = process.env['D1_INSTRUMENTO'];
afterEach(() => {
  if (original === undefined) delete process.env['D1_INSTRUMENTO'];
  else process.env['D1_INSTRUMENTO'] = original;
});

describe('qué instrumento se usa', () => {
  it('manda lo que pide la prueba; después la variable; si no, el de proceso', () => {
    process.env['D1_INSTRUMENTO'] = 'workerd';
    expect(instrumentoDe('sqlite')).toBe('sqlite');
    expect(instrumentoDe()).toBe('workerd');
    delete process.env['D1_INSTRUMENTO'];
    expect(instrumentoDe()).toBe('sqlite');
  });

  it('una variable mal escrita no cae callada a un instrumento (P1)', () => {
    process.env['D1_INSTRUMENTO'] = 'workerD';
    expect(() => instrumentoDe()).toThrow(/tiene que ser sqlite o workerd/);
  });
});

describe('la base en proceso se comporta como D1 en lo que el código usa', () => {
  const base = async () => {
    const { db, cerrar } = baseEnMemoria();
    await db.prepare('CREATE TABLE p (id INTEGER PRIMARY KEY, activo INTEGER)').run();
    await db
      .prepare('CREATE TABLE h (id INTEGER PRIMARY KEY, p INTEGER NOT NULL REFERENCES p (id))')
      .run();
    return { db, cerrar };
  };

  it('las claves foráneas están encendidas, y el error lleva el prefijo de D1', async () => {
    const { db } = await base();
    await expect(db.prepare('INSERT INTO h (id, p) VALUES (1, 99)').run()).rejects.toThrow(
      /^D1_ERROR: FOREIGN KEY constraint failed/,
    );
  });

  it('un ?1 repetido liga el mismo valor en las dos partes, como D1 (Node 22.20 o posterior)', async () => {
    // Con Node 22.18 y 22.19, `node:sqlite` responde «column index out of range» (bitácora
    // parqueadero 35); la celda del parqueadero lo usa para el org_id del token (bitácora 31).
    const { db } = await base();
    await db.prepare('INSERT INTO p (id, activo) VALUES (1, 1), (2, 0)').run();
    const fila = await db
      .prepare('SELECT (SELECT COUNT(*) FROM p WHERE activo = ?1) AS n FROM p WHERE id = ?1')
      .bind(1)
      .first();
    expect(fila).toEqual({ n: 1 });
  });

  it('un lote es todo o nada, y cada sentencia dice cuántas filas cambió', async () => {
    const { db } = await base();
    const r = await db.batch([
      db.prepare('INSERT INTO p (id, activo) VALUES (1, 1), (2, 1)'),
      db.prepare('UPDATE p SET activo = 0 WHERE id = 2'),
      db.prepare('SELECT id FROM p ORDER BY id'),
    ]);
    expect(r.map((x) => x.meta.changes)).toEqual([2, 1, 0]);
    expect(r[2]?.results).toEqual([{ id: 1 }, { id: 2 }]);
    await expect(
      db.batch([
        db.prepare('INSERT INTO p (id, activo) VALUES (3, 1)'),
        db.prepare('INSERT INTO h (id, p) VALUES (1, 99)'),
      ]),
    ).rejects.toThrow(/FOREIGN KEY/);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM p WHERE id = 3').first()).toEqual({ n: 0 });
  });

  it('bind convierte booleanos a 1/0 y rechaza undefined como D1', async () => {
    const { db } = await base();
    await db.prepare('INSERT INTO p (id, activo) VALUES (?, ?)').bind(1, true).run();
    expect(await db.prepare('SELECT activo FROM p WHERE id = 1').first()).toEqual({ activo: 1 });
    await expect(
      db.prepare('INSERT INTO p (id, activo) VALUES (?, ?)').bind(2, undefined).run(),
    ).rejects.toThrow(/D1_TYPE_ERROR/);
  });

  it('first sin filas es null, y las filas son objetos comunes', async () => {
    const { db } = await base();
    expect(await db.prepare('SELECT id FROM p WHERE id = 1').first()).toBeNull();
    await db.prepare('INSERT INTO p (id, activo) VALUES (1, 0)').run();
    const fila = await db.prepare('SELECT id FROM p').first();
    expect(Object.getPrototypeOf(fila)).toBe(Object.prototype);
  });
});
