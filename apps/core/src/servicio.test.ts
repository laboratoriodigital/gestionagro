/**
 * HU-C5.6: lo que el CORE le da a una celda por su service binding. Sin `desde`, el plan de todas
 * sus organizaciones (la vuelta diaria, que recoge los vencimientos); con `desde`, solo las que
 * tuvieron un pago aprobado después (la vuelta de cada hora, CA2).
 */
import type { BaseD1 } from '@ed1/d1';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { ServicioDelCore } from './entrada-de-servicio.ts';
import { CATALOGO } from './productos.ts';
import { planesDeLaCelda } from './servicio.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
const AHORA = Date.UTC(2026, 11, 1, 12);
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

const sembrar = async () => {
  const filas = [
    "INSERT INTO celda (id, url_api, estado, anillo_despliegue, shards) VALUES ('c0', 'https://api-c0', 'activa', 0, '[\"agro_c0_s1\"]'), ('c7', 'https://api-c7', 'activa', 0, '[\"agro_c7_s1\"]')",
    "INSERT INTO usuario (id, nombre, email, creado) VALUES ('u1', 'Persona Uno', 'uno@example.com', '2026-10-01')",
    // Pagó hace una hora: la vuelta de cada hora la trae.
    `INSERT INTO organizacion (id, nombre, tipo, plan, plan_vence, celda_id, shard, anillo, creado) VALUES ('o-pago', 'Finca Pagada', 'finca', 'finca', '${iso(AHORA + 180 * DIA)}', 'c0', 'agro_c0_s1', 1, '2026-10-01')`,
    // Pagó hace meses y ya venció: solo la vuelta diaria la baja al gratuito.
    `INSERT INTO organizacion (id, nombre, tipo, plan, plan_vence, celda_id, shard, anillo, creado) VALUES ('o-vencida', 'Finca Vencida', 'finca', 'finca', '${iso(AHORA - 2 * DIA)}', 'c0', 'agro_c0_s1', 1, '2026-10-01')`,
    "INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('o-gratis', 'Finca Gratis', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-10-01')",
    // De otra celda: nunca sale para c0.
    `INSERT INTO organizacion (id, nombre, tipo, plan, plan_vence, celda_id, shard, anillo, creado) VALUES ('o-otra', 'Finca de Otra Celda', 'finca', 'finca', '${iso(AHORA + 30 * DIA)}', 'c7', 'agro_c7_s1', 1, '2026-10-01')`,
    `INSERT INTO pago (id, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado) VALUES
      ('p1', 'bold', 'o-pago', 'u1', 'finca', 6, 100000, 'pruebas', 'aprobado', '${iso(AHORA - 2 * 3600_000)}', '${iso(AHORA - 3600_000)}'),
      ('p2', 'bold', 'o-vencida', 'u1', 'finca', 1, 20000, 'pruebas', 'aprobado', '2026-10-01', '2026-10-01'),
      ('p3', 'bold', 'o-gratis', 'u1', 'finca', 1, 20000, 'pruebas', 'rechazado', '${iso(AHORA - 3600_000)}', '${iso(AHORA - 3600_000)}'),
      ('p4', 'bold', 'o-otra', 'u1', 'finca', 1, 20000, 'pruebas', 'aprobado', '${iso(AHORA - 3600_000)}', '${iso(AHORA - 3600_000)}')`,
  ];
  for (const sql of filas) await db.prepare(sql).run();
};

beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  await vaciarCore(db);
  await sembrar();
}, 60_000);
afterAll(async () => {
  await vaciarCore(db);
  await cerrar?.();
});

describe('HU-C5.6 · los planes de una celda', () => {
  it('la vuelta diaria trae todas las de la celda, con el vencido ya en el gratuito', async () => {
    expect(await planesDeLaCelda(db, CATALOGO, 'c0', AHORA)).toEqual([
      { org_id: 'o-gratis', shard: 'agro_c0_s1', plan: 'gratuito', plan_vence: null },
      {
        org_id: 'o-pago',
        shard: 'agro_c0_s1',
        plan: 'finca',
        plan_vence: iso(AHORA + 180 * DIA),
      },
      { org_id: 'o-vencida', shard: 'agro_c0_s1', plan: 'gratuito', plan_vence: null },
    ]);
  });

  it('la vuelta de cada hora trae solo las de un pago aprobado después de «desde» (CA2)', async () => {
    const planes = await planesDeLaCelda(db, CATALOGO, 'c0', AHORA, iso(AHORA - 3 * 3600_000));
    expect(planes.map((p) => p.org_id)).toEqual(['o-pago']);
  });

  it('una celda sin organizaciones recibe una lista vacía, no un error', async () => {
    expect(await planesDeLaCelda(db, CATALOGO, 'c9', AHORA)).toEqual([]);
  });

  it('la entrada RPC responde lo mismo con el catálogo de su destino', async () => {
    const servicio = new ServicioDelCore({}, { DB: db, DESTINO: 'staging' });
    const planes = await servicio.planes('c0', '2026-11-01T00:00:00.000Z');
    expect(planes.map((p) => p.org_id)).toEqual(['o-pago']);
    expect((await servicio.planes('c0', null)).length).toBe(3);
  });
});
