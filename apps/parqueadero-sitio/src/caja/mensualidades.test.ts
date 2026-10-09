/**
 * Cobrar una mensualidad en la caja (HU-Q8.4): un recibo con el número siguiente, dentro del turno,
 * que suma vigencia sin el PIN; anulado, deja de sumarla.
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import {
  abrirTurno,
  anular,
  type Contexto,
  cobrarMensualidad,
  guardarAbonado,
  guardarPin,
  guardarSede,
  guardarTarifa,
  leerAbonados,
  NoSeCobra,
  pagosDelAbonado,
  registrarEntrada,
} from './almacen.ts';
import { abrirBase } from './datos.ts';
import { SinTurno } from './turno.ts';

const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & {
    id: unknown;
    org_id: unknown;
    version: unknown;
    actualizado: unknown;
    entidad: unknown;
  };
  return resto;
};

async function caja() {
  // 20 de octubre de 2026, 12:00 en Bogotá.
  let ms = Date.UTC(2026, 9, 20, 17, 0);
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  const db = abrirBase(`mensualidades-${uuidv7()}`);
  await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await guardarPin(db, '2468');
  const abonado = await guardarAbonado(
    db,
    {
      placa: 'JKL456',
      vehiculo: 'carro',
      plan: 'mes',
      referencia: null,
      desde: '2026-10-20',
      hasta: '2026-10-31',
      valor: 300_000,
      activo: true,
    },
    null,
    '2468',
    ctx,
  );
  return { db, ctx, abonado };
}

const NOVIEMBRE = {
  desde: '2026-11-01',
  hasta: '2026-11-30',
  valor: 300_000,
  medio: 'efectivo',
} as const;

describe('cobrar una mensualidad (HU-Q8.4)', () => {
  it('❌ sin turno no cobra, ni a un abonado inactivo', async () => {
    const { db, ctx, abonado } = await caja();
    await expect(cobrarMensualidad(db, abonado.id, NOVIEMBRE, ctx)).rejects.toThrow(SinTurno);
    await abrirTurno(db, { operador: 'Caja 1', base: 0 }, ctx);
    await guardarAbonado(db, { ...sinMeta(abonado), activo: false }, abonado.id, '2468', ctx);
    await expect(cobrarMensualidad(db, abonado.id, NOVIEMBRE, ctx)).rejects.toThrow(NoSeCobra);
    expect(await db.registros.where('tipo').equals('pago_abonado').count()).toBe(0);
  });

  it('toma el número siguiente de la caja y alarga la vigencia sin tocar el catálogo', async () => {
    const { db, ctx, abonado } = await caja();
    await abrirTurno(db, { operador: 'Caja 1', base: 0 }, ctx);
    const entrada = await registrarEntrada(
      db,
      { placa: 'ABC123', vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
      ctx,
    );
    const pago = await cobrarMensualidad(db, abonado.id, NOVIEMBRE, ctx);
    expect([entrada.consecutivo, pago.consecutivo]).toEqual([1, 2]);
    expect(pago).toMatchObject({ tipo: 'pago_abonado', serie: 'A', fecha_local: '2026-10-20' });
    expect((await leerAbonados(db))[0]).toMatchObject({ desde: '2026-10-20', hasta: '2026-11-30' });
    expect((await db.catalogos.get(abonado.id))?.version).toBe(1);
    expect((await pagosDelAbonado(db, abonado.id)).map((p) => p.id)).toEqual([pago.id]);
  });

  it('❌ una mensualidad anulada deja de sumar vigencia', async () => {
    const { db, ctx, abonado } = await caja();
    await abrirTurno(db, { operador: 'Caja 1', base: 0 }, ctx);
    const pago = await cobrarMensualidad(db, abonado.id, NOVIEMBRE, ctx);
    await anular(db, pago.id, { motivo: 'cobró dos veces', pin: '2468', operador: 'Caja 1' }, ctx);
    expect((await leerAbonados(db))[0]?.hasta).toBe('2026-10-31');
    expect(await pagosDelAbonado(db, abonado.id)).toEqual([]);
  });
});
