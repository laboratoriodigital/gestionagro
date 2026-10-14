/**
 * Bitácora parqueadero 42: las entregas pendientes se ven, y salen de la lista cuando el recibo
 * sale. Antes solo se contaban y el número nunca bajaba.
 */
import 'fake-indexeddb/auto';
import type { Registro } from '@ed1/parqueadero-schema';
import { describe, expect, it } from 'vitest';
import { registrarEntrega } from './almacen.ts';
import { abrirBase, type EntregaPendiente } from './datos.ts';
import { agruparPendientes, leerPendientes, quitarPendientes } from './pendientes.ts';

const R1 = '0192e9a0-0000-7000-8000-000000000101';
const E1 = '0192e9a0-0000-7000-8000-000000000102';
const D1 = '0192e9a0-0000-7000-8000-000000000103';

const entrega = (cambios: Partial<EntregaPendiente>): EntregaPendiente => ({
  trabajoId: 't',
  canal: 'papel',
  motivo: 'fuera_de_alcance',
  detalle: '',
  creadaEn: 0,
  ...cambios,
});

describe('las entregas pendientes, por recibo', () => {
  it('una fila por recibo con cuántas veces no salió; la más reciente arriba', () => {
    const grupos = agruparPendientes([
      entrega({ id: 1, reciboId: 'a', creadaEn: 10, motivo: 'sin_permiso' }),
      entrega({ id: 2, reciboId: 'b', creadaEn: 20 }),
      entrega({ id: 3, reciboId: 'a', creadaEn: 30 }),
      entrega({ id: 4, creadaEn: 5 }),
    ]);
    expect(grupos.map((g) => [g.reciboId, g.ids, g.veces, g.ultima.creadaEn])).toEqual([
      ['a', [1, 3], 2, 30],
      ['b', [2], 1, 20],
      [null, [4], 1, 5],
    ]);
    expect(grupos[0]?.ultima.motivo).toBe('fuera_de_alcance');
  });

  it('un recibo que sale en papel sale de la lista; el cajero puede quitar los demás', async () => {
    const db = abrirBase(`prueba-${Math.random()}`);
    const recibo = { id: R1, dispositivo_id: D1, estadia_id: E1 } as Registro;
    await db.registros.add({
      ...recibo,
      tipo: 'entrada',
      serie: 'A',
      consecutivo: 1,
      datos: { placa: 'XYZ98' },
    } as unknown as Registro);
    await db.entregas_pendientes.bulkAdd([
      entrega({ reciboId: R1, creadaEn: 1 }),
      entrega({ reciboId: R1, creadaEn: 2 }),
      entrega({ trabajoId: 'prueba', creadaEn: 3 }),
    ]);
    const antes = await leerPendientes(db);
    expect(antes.map((p) => [p.reciboId, p.veces, p.registro?.id ?? null])).toEqual([
      [null, 1, null],
      [R1, 2, R1],
    ]);

    let n = 0;
    const ctx = { reloj: () => 100, nuevoId: () => `0192e9a0-0000-7000-8000-00000000000${n++}` };
    // ❌ Un papel que no salió no la quita.
    await registrarEntrega(
      db,
      recibo,
      { canal: 'papel', copia: false, camino: null, resultado: 'fallido' },
      ctx,
    );
    expect(await db.entregas_pendientes.count()).toBe(3);
    await registrarEntrega(
      db,
      recibo,
      { canal: 'papel', copia: false, camino: null, resultado: 'enviado' },
      ctx,
    );
    const despues = await leerPendientes(db);
    expect(despues.map((p) => p.reciboId)).toEqual([null]);

    await quitarPendientes(db, despues[0]?.ids ?? []);
    expect(await db.entregas_pendientes.count()).toBe(0);
  });
});
