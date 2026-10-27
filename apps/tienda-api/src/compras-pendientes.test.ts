/**
 * HU-P1.1 (sprint PF1): las compras sin terminar. Contra el shard local: sin la casilla no se guarda
 * nada, el contacto va cifrado, solo en el plan que lo incluye, sale en el panel a las 2 horas y la
 * purga la borra cuando vence o cuando ya es un pedido.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  contactoDeRecordar,
  listarComprasPendientes,
  marcarEscrita,
  purgarComprasPendientes,
  recordarCompra,
} from './compras-pendientes.ts';
import { kekDelEntorno } from './llaves.ts';

const AHORA = '2026-10-27T15:00:00.000Z';
const TRES_HORAS_DESPUES = '2026-10-27T18:00:00.000Z';
const UNO = ENSAYO_UNO.org;
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 7)).toString('base64');
const M = 'v-camisa-m-arena';
let shard: BaseD1;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => cerrar?.());

const plan = (p: string) =>
  shard.prepare('UPDATE tienda SET plan = ? WHERE org_id = ?').bind(p, UNO).run();
const pedido = (codigo: string, contacto: string, acepta = true) => ({
  codigo,
  lineas: [{ variante: M, cantidad: 2 }],
  contacto,
  acepta,
});
const filas = async () =>
  (
    await shard
      .prepare(
        'SELECT codigo, sobre, total_cop FROM compra_pendiente WHERE org_id = ? ORDER BY codigo',
      )
      .bind(UNO)
      .all<{ codigo: string; sobre: ArrayBuffer; total_cop: number }>()
  ).results;
const quien = (instante: string) => ({ db: shard, org: UNO, actor: 'usuario:prueba', instante });

describe('HU-P1.1 · las compras sin terminar', () => {
  it('el contacto: un celular de Colombia o un correo; ❌ lo demás no', () => {
    expect(contactoDeRecordar('300 123 4567')).toEqual({
      tipo: 'whatsapp',
      valor: '+573001234567',
    });
    expect(contactoDeRecordar('+57 3001234567')).toEqual({
      tipo: 'whatsapp',
      valor: '+573001234567',
    });
    expect(contactoDeRecordar('Ana@Ejemplo.test')).toEqual({
      tipo: 'correo',
      valor: 'ana@ejemplo.test',
    });
    expect(contactoDeRecordar('12345')).toBeNull();
    expect(contactoDeRecordar('<script>')).toBeNull();
  });

  it('❌ en el plan Gratis no se guarda; ❌ sin la casilla tampoco', async () => {
    const kek = await kekDelEntorno(KEK);
    await plan('gratis');
    expect(await recordarCompra(shard, UNO, kek, pedido('ABC123', '3001234567'), AHORA)).toEqual({
      estado: 'plan',
    });
    await plan('pro');
    expect(
      await recordarCompra(shard, UNO, kek, pedido('ABC123', '3001234567', false), AHORA),
    ).toEqual({ estado: 'olvidado' });
    expect(await filas()).toEqual([]);
  });

  it('con la casilla: el total del servidor y el contacto cifrado; sale en el panel a las 2 horas', async () => {
    const kek = await kekDelEntorno(KEK);
    await plan('pro');
    expect(
      await recordarCompra(shard, UNO, kek, pedido('ABC123', 'ana@ejemplo.test'), AHORA),
    ).toEqual({ estado: 'guardado' });
    const [f] = await filas();
    expect(f?.total_cop).toBe(258000);
    expect(new TextDecoder().decode(new Uint8Array(f?.sobre ?? new ArrayBuffer(0)))).not.toContain(
      'ana@',
    );
    // Recién dejada no sale; a las 3 horas sí, con su contacto.
    expect(await listarComprasPendientes(quien(AHORA), kek)).toEqual([]);
    const [c] = await listarComprasPendientes(quien(TRES_HORAS_DESPUES), kek);
    expect(c).toMatchObject({
      codigo: 'ABC123',
      totalCop: 258000,
      productos: ['2 × Camisa de lino (M, Arena)'],
      contacto: { tipo: 'correo', valor: 'ana@ejemplo.test' },
    });
    // «Ya le escribí» la saca de la lista.
    expect(await marcarEscrita(quien(TRES_HORAS_DESPUES), 'ABC123')).toBe(true);
    expect(await listarComprasPendientes(quien(TRES_HORAS_DESPUES), kek)).toEqual([]);
  });

  it('❌ la que ya es un pedido no sale, y la purga la borra; la vencida también', async () => {
    const kek = await kekDelEntorno(KEK);
    await plan('pro');
    await recordarCompra(shard, UNO, kek, pedido('XYZ789', '3001234567'), AHORA);
    await recordarCompra(shard, UNO, kek, pedido('QRS456', '3001234567'), AHORA);
    // Un pedido anotado en el panel con el mismo código: la compra se terminó.
    await shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, subtotal_cop, total_cop, cambiado_por, creado, actualizado)
         VALUES (?, 'pedido-xyz', 'XYZ789', 5001, 'pendiente', 'panel', 258000, 258000, 'usuario:prueba', ?, ?)`,
      )
      .bind(UNO, AHORA, AHORA)
      .run();
    const codigos = (await listarComprasPendientes(quien(TRES_HORAS_DESPUES), kek)).map(
      (c) => c.codigo,
    );
    expect(codigos).toContain('QRS456');
    expect(codigos).not.toContain('XYZ789');
    await purgarComprasPendientes(shard, UNO, TRES_HORAS_DESPUES).run();
    expect((await filas()).map((f) => f.codigo)).not.toContain('XYZ789');
    await purgarComprasPendientes(shard, UNO, '2026-12-01T00:00:00.000Z').run();
    expect(await filas()).toEqual([]);
  });
});
