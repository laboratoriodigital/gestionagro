/**
 * Lo que ahorra, leído de la caja (HU-Q8.6): las entregas que anota la caja cuadran con los eventos
 * de HU-Q5.3 que cuenta para el sitio (CA2), y sin el costo de la sede no hay pesos (P1).
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { leerAhorro } from './ahorro.ts';
import {
  abrirTurno,
  type Contexto,
  guardarSede,
  guardarTarifa,
  registrarEntrada,
  registrarEntrega,
} from './almacen.ts';
import { abrirBase } from './datos.ts';

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

// Martes 6 de octubre de 2026, 13:05 en Bogotá.
const HOY = '2026-10-06';

async function caja(costo_papel: number | null) {
  let ms = Date.UTC(2026, 9, 6, 18, 5);
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  const db = abrirBase(`ahorro-${uuidv7()}`);
  await guardarSede(db, { ...sinMeta(SEDE_ENSAYO_UNO), costo_papel }, null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await abrirTurno(db, { operador: 'Caja 1', base: 0 }, ctx);
  const entrada = (placa: string) =>
    registrarEntrada(
      db,
      { placa, vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
      ctx,
    );
  return { db, ctx, entrada };
}

const PAPEL = { canal: 'papel', copia: false, camino: 'bluetooth', resultado: 'enviado' } as const;
const WHATSAPP = { canal: 'whatsapp', copia: false, autorizado: true } as const;

describe('lo que ahorra el parqueadero, en la caja (HU-Q8.6)', () => {
  it('las entregas cuadran con los eventos de HU-Q5.3 del periodo (CA2)', async () => {
    const { db, ctx, entrada } = await caja(12);
    const [a, b, c, d] = [
      await entrada('AAA111'),
      await entrada('BBB222'),
      await entrada('CCC333'),
      await entrada('DDD444'),
    ];
    // A: papel que no salió y salió a la segunda, más una copia.
    await registrarEntrega(db, a, PAPEL, ctx);
    await registrarEntrega(db, a, { ...PAPEL, resultado: 'fallido' }, ctx);
    await registrarEntrega(db, a, PAPEL, ctx);
    await registrarEntrega(db, a, { ...PAPEL, copia: true }, ctx);
    // B: por WhatsApp. C: abierto en WhatsApp y marcado «No se envió» (CA3). D: en la pantalla.
    await registrarEntrega(db, b, { ...WHATSAPP, resultado: 'abierto' }, ctx);
    await registrarEntrega(db, c, { ...WHATSAPP, resultado: 'abierto' }, ctx);
    await registrarEntrega(db, c, { ...WHATSAPP, resultado: 'no_enviado' }, ctx);
    await registrarEntrega(
      db,
      d,
      { canal: 'pantalla', copia: false, resultado: 'confirmado' },
      ctx,
    );

    const { periodos, costo } = await leerAhorro(db, HOY);
    const semana = periodos.find((p) => p.nombre === 'Esta semana');
    const eventos = await db.meta.get('eventos');
    const conteos = eventos?.clave === 'eventos' ? eventos.conteos : {};
    expect(semana?.anotadas).toEqual({
      papel: conteos['recibo.papel'] ?? 0,
      copia: conteos['recibo.copia'] ?? 0,
      whatsapp: conteos['recibo.whatsapp'] ?? 0,
      pantalla: conteos['recibo.pantalla'] ?? 0,
    });
    expect(semana?.anotadas).toEqual({ papel: 2, copia: 1, whatsapp: 2, pantalla: 1 });
    // Cada recibo una vez: C no cuenta como digital, aunque se abrió WhatsApp (CA3).
    expect(semana).toMatchObject({
      recibos: 4,
      papel: 1,
      whatsapp: 1,
      pantalla: 1,
      sinEntrega: 1,
      sinPapel: 2,
      pesos: 24,
    });
    expect(costo).toBe(12);
    expect(periodos.find((p) => p.nombre === 'Mes pasado')?.recibos).toBe(0);
  });

  it('❌ sin el costo por recibo de la sede no hay pesos, ni siquiera $0 (P1)', async () => {
    const { db, ctx, entrada } = await caja(null);
    const r = await entrada('EEE555');
    await registrarEntrega(db, r, { ...WHATSAPP, resultado: 'abierto' }, ctx);
    const { periodos, costo } = await leerAhorro(db, HOY);
    expect(costo).toBeNull();
    expect(periodos[0]).toMatchObject({ sinPapel: 1, pesos: null });
  });
});
