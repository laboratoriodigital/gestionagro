/**
 * HU-C2.2: la dimensión de producto (migración 0006) en el D1 local de workerd, no solo en
 * `node:sqlite` (P17). Los cruces imposibles entre productos los rechaza la base (R3), y un segundo
 * producto entra con datos, sin migración (ADR-20). Que el código v0 siga funcionando con la 0006
 * lo prueba el resto de la batería del CORE, que corre sobre la misma base.
 */
import type { BaseD1 } from '@ed1/d1';
import { PERIODOS } from '@ed1/productos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDelCore } from './base-de-prueba.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
const ejecutar = async (sql: string) => {
  for (const s of sql
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean))
    await db.prepare(s).run();
};

beforeAll(async () => {
  // Prueba D1 mismo: siempre en workerd, nunca en el instrumento en proceso (HU-C11.7, P17).
  ({ db, cerrar } = await baseDelCore('workerd'));
  // El agro, como lo escribe el código v0 (sin producto: lo pone el DEFAULT de la 0006).
  await ejecutar(`
    INSERT INTO celda (id, url_api, estado, anillo_despliegue, shards) VALUES ('c0', 'https://api-c0', 'activa', 0, '["agro_c0_s1"]');
    INSERT INTO usuario (id, nombre, email, creado) VALUES ('u1', 'Persona Uno', 'uno@example.com', '2026-10-01T00:00:00.000Z'), ('u2', 'Persona Dos', 'dos@example.com', '2026-10-01T00:00:00.000Z');
    INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('o1', 'Finca Ensayo Uno', 'finca', 'finca', 'c0', 'agro_c0_s1', 1, '2026-10-01T00:00:00.000Z');
    INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u1', 'o1', 'propietario', '2026-10-01T00:00:00.000Z')
  `);
  // Un segundo producto, como lo sembrará el despliegue desde productos.json (HU-C2.3).
  await ejecutar(`
    INSERT INTO producto (id, nombre, estado, actualizado) VALUES ('ensayo', 'Producto Ensayo', 'activo', '2026-10-05T00:00:00.000Z');
    INSERT INTO producto_tipo (producto, tipo) VALUES ('ensayo', 'comercio');
    INSERT INTO producto_rol (producto, rol, administra, invitable) VALUES ('ensayo', 'propietario', 1, 1), ('ensayo', 'colaborador', 0, 1);
    INSERT INTO plan (producto, id, nombre, gratuito, estado) VALUES ('ensayo', 'gratis', 'Gratis', 1, 'activo'), ('ensayo', 'entrada', 'Entrada', 0, 'activo');
    INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('ensayo', 'entrada', 1, 29900, '2026-10-05T00:00:00.000Z');
    INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES ('c1', 'ensayo', 'https://api-c1', 'activa', 0, '["ensayo_c1_s1"]');
    INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t1', 'ensayo', 'Comercio Ensayo Uno', 'comercio', 'gratis', 'c1', 'ensayo_c1_s1', 1, '2026-10-05T00:00:00.000Z');
    INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u1', 't1', 'ensayo', 'propietario', '2026-10-05T00:00:00.000Z')
  `);
}, 60_000);
afterAll(async () => cerrar?.());

describe('la dimensión de producto en D1 (HU-C2.2)', () => {
  it('lo escrito por el código v0 queda del agro, activo', async () => {
    expect(
      await db.prepare("SELECT producto, estado FROM organizacion WHERE id = 'o1'").first(),
    ).toEqual({ producto: 'agro', estado: 'activa' });
  });

  it('los periodos sembrados son los de @ed1/productos (P2)', async () => {
    const { results } = await db
      .prepare('SELECT meses FROM periodo ORDER BY meses')
      .all<{ meses: number }>();
    expect(results.map((r) => r.meses)).toEqual([...PERIODOS]);
  });

  it('un periodo nuevo entra con dos INSERT, sin rehacer ninguna tabla (PC1)', async () => {
    await ejecutar(`
      INSERT INTO periodo (meses, nombre) VALUES (24, 'bienal');
      INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('ensayo', 'entrada', 24, 560000, '2026-10-05T00:00:00.000Z')
    `);
    expect(
      await db
        .prepare('SELECT COUNT(*) AS n FROM plan_precio WHERE meses = 24')
        .first<{ n: number }>(),
    ).toEqual({ n: 1 });
  });

  it.each([
    [
      'un rol del agro en un espacio de otro producto',
      "INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u2', 't1', 'ensayo', 'operario', 'x')",
    ],
    [
      'una membresía v0, sin producto, en un espacio de otro producto',
      "INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u2', 't1', 'colaborador', 'x')",
    ],
    [
      'un espacio con un plan del agro',
      "INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t2', 'ensayo', 'X', 'comercio', 'finca', 'c1', 'ensayo_c1_s1', 2, 'x')",
    ],
    [
      'un espacio en una celda del agro',
      "INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t3', 'ensayo', 'X', 'comercio', 'gratis', 'c0', 'agro_c0_s1', 2, 'x')",
    ],
    [
      'un pago de otro producto a nombre de una finca',
      "INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p9', 'ensayo', 'bold', 'o1', 'u1', 'entrada', 1, 29900, 'pruebas', 'esperando', 'x', 'x')",
    ],
    [
      'un pago por 2 meses, que no es un periodo',
      "INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES ('p8', 'ensayo', 'bold', 't1', 'u1', 'entrada', 2, 59800, 'pruebas', 'esperando', 'x', 'x')",
    ],
    [
      'un espacio de otro producto con el tipo «finca»',
      "INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t4', 'ensayo', 'X', 'finca', 'gratis', 'c1', 'ensayo_c1_s1', 2, 'x')",
    ],
  ])('la base rechaza %s, por una clave foránea', async (_caso, sql) => {
    // La razón exacta: un rechazo por otra causa (una clave única) no prueba el producto (P5).
    await expect(db.prepare(sql).run()).rejects.toThrow(/FOREIGN KEY constraint failed/);
  });

  it('la base rechaza un precio por debajo del mínimo de Bold, por su CHECK', async () => {
    await expect(
      db
        .prepare(
          "INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('ensayo', 'entrada', 1, 500, 'y')",
        )
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('después de todo, ninguna fila huérfana', async () => {
    expect(
      await db.prepare('SELECT COUNT(*) AS n FROM pragma_foreign_key_check').first<{ n: number }>(),
    ).toEqual({ n: 0 });
  });
});
