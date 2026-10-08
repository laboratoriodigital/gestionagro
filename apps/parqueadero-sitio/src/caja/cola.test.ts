/**
 * La cola de salida (HU-Q7.5 CA1) y la señal de la nube en la cabecera. Las vueltas contra la celda
 * de verdad, con dos cajas, están en `tests/integracion/parqueadero-dos-cajas.test.ts`.
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it, vi } from 'vitest';
import {
  abrirTurno,
  anular,
  type Contexto,
  guardarPin,
  guardarSede,
  guardarTarifa,
  registrarEntrada,
  registrarSalida,
} from './almacen.ts';
import { abrirBase } from './datos.ts';
import { crearNube } from './nube.ts';
import { senalDeLaNube } from './senales.ts';
import { turnoAbierto } from './turno.ts';

const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & Record<'id' | 'org_id' | 'version' | 'actualizado' | 'entidad', unknown>;
  return resto;
};

const ENTRADA = {
  placa: 'ABC123',
  vehiculo: 'carro' as const,
  placaConfirmada: false,
  novedades: [],
  fotos: [],
};
const EFECTIVO = {
  perdido: false,
  medio: 'efectivo',
  recibido: 50_000,
  motivoCortesia: null,
} as const;

async function caja({ vinculada }: { vinculada: boolean }) {
  let ms = Date.UTC(2026, 9, 6, 23, 5);
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  const db = abrirBase(`cola-${uuidv7()}`);
  if (vinculada) {
    await db.meta.put({ clave: 'nube', api: 'https://api.ejemplo.test', acceso: 'token' });
  }
  await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_MOTO), null, ctx);
  await abrirTurno(db, { operador: 'Caja 1', base: 100_000 }, ctx);
  return { db, ctx, avanzar: (min: number) => (ms += min * 60_000) };
}

describe('la cola de salida (HU-Q7.5 CA1)', () => {
  it('una caja sin cuenta, como las de v0.2.x, no llena la cola (P10)', async () => {
    const { db, ctx } = await caja({ vinculada: false });
    await registrarEntrada(db, ENTRADA, ctx);
    expect(await db.registros.count()).toBe(2);
    expect(await db.outbox.count()).toBe(0);
  });

  it('con la caja vinculada, cada registro y cada versión de un catálogo entra a la cola', async () => {
    const { db, ctx, avanzar } = await caja({ vinculada: true });
    const entrada = await registrarEntrada(db, ENTRADA, ctx);
    avanzar(30);
    const salida = await registrarSalida(db, entrada.id, EFECTIVO, ctx);
    await guardarPin(db, '2468');
    const anulacion = await anular(
      db,
      salida.id,
      { motivo: 'cobro de prueba', pin: '2468', operador: 'Caja 1' },
      ctx,
    );
    const carro = await db.catalogos
      .filter((c) => c.entidad === 'tarifa' && 'vehiculo' in c && c.vehiculo === 'carro')
      .first();
    const editada = await guardarTarifa(
      db,
      { ...sinMeta(TARIFA_CARRO), valor: 200 },
      carro?.id ?? null,
      ctx,
    );
    const cola = await db.outbox.orderBy('creado').toArray();
    const ids = cola.map((o) => o.id);
    // Sede, dos tarifas, turno, entrada, salida, anulación y la tarifa editada: su versión 2.
    expect(cola).toHaveLength(8);
    expect(ids.slice(4, 7)).toEqual([entrada.id, salida.id, anulacion.id]);
    expect(ids.at(-1)).toBe(`${editada.id}@v2`);
    expect(cola.at(-1)).toMatchObject({ entidad: 'tarifa', version: 2 });
  });

  it('si la cola no se puede escribir, el registro tampoco: misma transacción (❌)', async () => {
    const { db, ctx } = await caja({ vinculada: true });
    const antes = await db.registros.count();
    vi.spyOn(db.outbox, 'bulkPut').mockRejectedValueOnce(new Error('disco lleno'));
    await expect(registrarEntrada(db, ENTRADA, ctx)).rejects.toThrow('disco lleno');
    expect(await db.registros.count()).toBe(antes);
    expect(await db.estadias.count()).toBe(0);
    // Y el número no se gastó: la siguiente entrada es la A-000001.
    expect((await registrarEntrada(db, ENTRADA, ctx)).consecutivo).toBe(1);
  });
});

describe('el turno es de esta caja (HU-Q7.5)', () => {
  it('la apertura de otra caja que bajó de la nube no abre el turno de esta', async () => {
    const { db, ctx } = await caja({ vinculada: true });
    const propio = await turnoAbierto(db);
    const otra = propio?.apertura;
    if (!otra) throw new Error('falta la apertura');
    // La apertura de otra caja, más reciente, como llega en la bajada.
    await db.registros.add({
      ...otra,
      id: ctx.nuevoId(),
      dispositivo_id: 'otra-caja',
      instante_evento: new Date(ctx.reloj()).toISOString(),
    });
    const t = await turnoAbierto(db);
    expect(t?.apertura.id).toBe(otra.id);
    expect(t?.numero).toBe(1);
  });
});

describe('la nube sin cuenta no hace nada (P10)', () => {
  it('no carga la sincronización ni sale a la red, y la cabecera no muestra la señal', async () => {
    const { db } = await caja({ vinculada: false });
    let pedidos = 0;
    const fetchFn = (async () => {
      pedidos++;
      return new Response('{}');
    }) as unknown as typeof fetch;
    const nube = crearNube(db, { reloj: Date.now, app: '0.3.0', fetchFn });
    expect(await nube.ahora()).toEqual({ tipo: 'sin-vincular' });
    nube.detener();
    expect(pedidos).toBe(0);
    expect(senalDeLaNube(false, 0, { tipo: 'sin-vincular' })).toBeNull();
  });
});

describe('la señal de la nube', () => {
  const resultado = (estado: 'sin-senal' | 'sin-sesion' | 'error') => ({
    tipo: 'resultado' as const,
    envio: { estado, enviados: 0, rechazados: 0, motivo: '' } as never,
    cuando: 0,
  });

  it('dice cuánto queda en este dispositivo y por qué no ha salido', () => {
    expect(senalDeLaNube(true, 0, { tipo: 'sin-vincular' })?.texto).toBe('Todo en la nube');
    // HU-Q7.11 CA3: sin los términos no baja nada; «Todo en la nube» sería falso aunque no falte subir.
    expect(senalDeLaNube(true, 0, { tipo: 'sin-terminos' })).toEqual({
      texto: 'Nube en pausa: acepte los términos',
      tono: 'error',
    });
    expect(senalDeLaNube(true, 3, { tipo: 'enviando' })?.texto).toBe('Enviando a la nube…');
    expect(senalDeLaNube(true, 3, resultado('sin-senal'))?.texto).toBe(
      '3 en este dispositivo, sin señal',
    );
    expect(senalDeLaNube(true, 3, resultado('sin-sesion'))).toEqual({
      texto: '3 en este dispositivo: entre de nuevo',
      tono: 'error',
    });
    expect(senalDeLaNube(true, 1, resultado('error'))?.tono).toBe('error');
  });
});
