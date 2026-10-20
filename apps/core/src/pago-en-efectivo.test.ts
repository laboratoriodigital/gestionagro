/**
 * HU-C5.8: el pago del plan en efectivo que registra el dueño. Queda como uno de Bold (su fila,
 * su periodo, la auditoría y la misma regla de vencimiento), con `proveedor = 'efectivo'`.
 */
import type { BaseD1 } from '@ed1/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import {
  type PedidoEnEfectivo,
  planearPagoEnEfectivo,
  registrarPagoEnEfectivo,
} from './pago-en-efectivo.ts';
import { CATALOGO } from './productos.ts';
import { planesDeLaCelda } from './servicio.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
const AHORA = Date.UTC(2026, 9, 20, 15);
const DIA = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
let n = 0;
const nuevoId = () => `0192e9a0-0000-7000-8000-${String(++n).padStart(12, '0')}`;

const pedido = (cambios: Partial<PedidoEnEfectivo> = {}): PedidoEnEfectivo => ({
  cliente: 'dueno@parqueadero.co',
  producto: 'parqueadero',
  plan: 'parqueadero',
  meses: 12,
  monto_cop: null,
  nota: 'Pagó el año en la oficina, recibo 001',
  registra: 'sebasurrego',
  ambiente: 'produccion',
  ...cambios,
});

const ejecutar = async (sql: string) => {
  for (const s of sql
    .split(';\n')
    .map((x) => x.trim())
    .filter(Boolean))
    await db.prepare(s).run();
};

beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
}, 60_000);
afterAll(async () => {
  await vaciarCore(db);
  await cerrar?.();
});

beforeEach(async () => {
  await vaciarCore(db);
  await ejecutar(`
    INSERT OR IGNORE INTO producto (id, nombre, estado, actualizado) VALUES ('parqueadero', 'Parqueadero', 'activo', '2026-10-01T00:00:00.000Z');
    INSERT OR IGNORE INTO producto_tipo (producto, tipo) VALUES ('parqueadero', 'parqueadero');
    INSERT OR IGNORE INTO producto_rol (producto, rol, administra, invitable) VALUES ('parqueadero', 'propietario', 1, 1), ('parqueadero', 'cajero', 0, 1);
    INSERT OR IGNORE INTO plan (producto, id, nombre, gratuito, estado) VALUES ('parqueadero', 'gratis', 'Gratis', 1, 'activo'), ('parqueadero', 'parqueadero', 'Parqueadero', 0, 'activo');
    INSERT OR IGNORE INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('parqueadero', 'parqueadero', 1, 29900, '2026-10-01T00:00:00.000Z'), ('parqueadero', 'parqueadero', 12, 299000, '2026-10-01T00:00:00.000Z');
    INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES ('c2', 'parqueadero', 'https://api-c2', 'activa', 0, '["parqueadero_c2_s1"]');
    INSERT INTO usuario (id, nombre, email, creado) VALUES ('u1', 'Dueño del Parqueadero', 'Dueno@Parqueadero.co', '2026-10-01T00:00:00.000Z'), ('u2', 'Cajero', 'cajero@parqueadero.co', '2026-10-01T00:00:00.000Z');
    INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('p1', 'parqueadero', 'Parqueadero Ensayo', 'parqueadero', 'gratis', 'c2', 'parqueadero_c2_s1', 1, '2026-10-01T00:00:00.000Z');
    INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u1', 'p1', 'parqueadero', 'propietario', '2026-10-01T00:00:00.000Z'), ('u2', 'p1', 'parqueadero', 'cajero', '2026-10-02T00:00:00.000Z')
  `);
});

describe('el pago del plan en efectivo (HU-C5.8)', () => {
  it('la vista previa dice lo que haría y no escribe nada', async () => {
    const r = await planearPagoEnEfectivo(db, pedido(), AHORA);
    expect(r).toMatchObject({
      ok: true,
      plan: {
        organizacion: { id: 'p1', nombre: 'Parqueadero Ensayo' },
        plan: 'parqueadero',
        meses: 12,
        monto_cop: 299000,
        antes: { plan: 'gratis', vence: null },
        desde: iso(AHORA),
        vence: '2027-10-20T15:00:00.000Z',
      },
    });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM pago').first()).toEqual({ n: 0 });
  });

  it('registra el pago aprobado, activa el plan un año y lo audita con quién lo registró', async () => {
    const r = await registrarPagoEnEfectivo(db, pedido(), AHORA, nuevoId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(
      await db.prepare('SELECT plan, plan_vence FROM organizacion WHERE id = ?').bind('p1').first(),
    ).toEqual({ plan: 'parqueadero', plan_vence: '2027-10-20T15:00:00.000Z' });
    expect(
      await db
        .prepare(
          'SELECT proveedor, usuario_id, estado, monto_cop, meses, motivo, periodo_desde, periodo_hasta FROM pago WHERE id = ?',
        )
        .bind(r.pago_id)
        .first(),
    ).toEqual({
      proveedor: 'efectivo',
      usuario_id: 'u1',
      estado: 'aprobado',
      monto_cop: 299000,
      meses: 12,
      motivo: 'Pagó el año en la oficina, recibo 001',
      periodo_desde: iso(AHORA),
      periodo_hasta: '2027-10-20T15:00:00.000Z',
    });
    const auditoria = await db
      .prepare("SELECT usuario_id, detalle FROM auditoria WHERE accion = 'pago_cerrado'")
      .first<{ usuario_id: string; detalle: string }>();
    expect(auditoria?.usuario_id).toBe('u1');
    expect(JSON.parse(auditoria?.detalle ?? '{}')).toMatchObject({
      proveedor: 'efectivo',
      registra: 'sebasurrego',
      monto_cop: 299000,
    });
    // La celda lo recibe en la vuelta de cada hora, como un pago de Bold (HU-C5.6).
    const planes = await planesDeLaCelda(db, CATALOGO, 'c2', AHORA, iso(AHORA - DIA));
    expect(planes.map((p) => [p.org_id, p.plan])).toEqual([['p1', 'parqueadero']]);
  });

  it('con el plan vigente, suma desde su vencimiento; con el id de la organización también sirve', async () => {
    const vence = iso(AHORA + 10 * DIA);
    await ejecutar(
      `UPDATE organizacion SET plan = 'parqueadero', plan_vence = '${vence}' WHERE id = 'p1'`,
    );
    const r = await registrarPagoEnEfectivo(
      db,
      pedido({ cliente: 'p1', meses: 1, monto_cop: 25000 }),
      AHORA,
      nuevoId,
    );
    expect(r).toMatchObject({
      ok: true,
      plan: { desde: vence, monto_cop: 25000, precio_cop: 29900 },
    });
    expect(
      await db.prepare('SELECT plan_vence FROM organizacion WHERE id = ?').bind('p1').first(),
    ).toEqual({ plan_vence: '2026-11-30T15:00:00.000Z' });
  });

  it('❌ no registra lo que no cuadra, y no escribe nada', async () => {
    const casos: [Partial<PedidoEnEfectivo>, RegExp][] = [
      [{ cliente: 'nadie@parqueadero.co' }, /no administra ninguna/],
      [{ cliente: 'cajero@parqueadero.co' }, /no administra ninguna/],
      [{ cliente: 'p9' }, /No hay una organización p9/],
      [{ plan: 'gratis' }, /no se paga/],
      [{ plan: 'oro' }, /no tiene un plan oro/],
      [{ meses: 6 }, /no tiene precio por 6 meses/],
      [{ meses: 7 }, /No hay un periodo de 7 meses/],
      [{ nota: ' ' }, /Escriba una nota/],
      [{ producto: 'agro' }, /no administra ninguna organización del producto agro/],
    ];
    for (const [cambio, motivo] of casos) {
      const r = await registrarPagoEnEfectivo(db, pedido(cambio), AHORA, nuevoId);
      expect(r.ok ? 'registró' : r.motivo).toMatch(motivo);
    }
    expect(await db.prepare('SELECT COUNT(*) AS n FROM pago').first()).toEqual({ n: 0 });
    expect(
      await db.prepare('SELECT plan FROM organizacion WHERE id = ?').bind('p1').first(),
    ).toEqual({ plan: 'gratis' });
  });

  it('❌ una organización suspendida no recibe el plan', async () => {
    await ejecutar("UPDATE organizacion SET estado = 'suspendida' WHERE id = 'p1'");
    const r = await registrarPagoEnEfectivo(db, pedido(), AHORA, nuevoId);
    expect(r.ok ? 'registró' : r.motivo).toMatch(/suspendida/);
  });

  it('❌ si la organización cambió entre leer y escribir, el pago queda rechazado y el plan no se toca', async () => {
    // Una base que cambia la organización justo antes del lote, como otro pago a la vez.
    const entrometida: BaseD1 = {
      prepare: (sql) => db.prepare(sql),
      async batch(sentencias) {
        await db
          .prepare(
            "UPDATE organizacion SET plan_vence = '2026-12-01T00:00:00.000Z' WHERE id = 'p1'",
          )
          .run();
        return db.batch(sentencias);
      },
    };
    const r = await registrarPagoEnEfectivo(entrometida, pedido(), AHORA, nuevoId);
    expect(r.ok ? 'registró' : r.motivo).toMatch(/cambió mientras/);
    expect(
      await db.prepare('SELECT plan, plan_vence FROM organizacion WHERE id = ?').bind('p1').first(),
    ).toEqual({ plan: 'gratis', plan_vence: '2026-12-01T00:00:00.000Z' });
    expect(await db.prepare('SELECT estado FROM pago').first()).toEqual({ estado: 'rechazado' });
    expect(await db.prepare('SELECT COUNT(*) AS n FROM auditoria').first()).toEqual({ n: 0 });
  });
});
