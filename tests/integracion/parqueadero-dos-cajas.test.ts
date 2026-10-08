/**
 * La caja sincroniza sin cortar una venta (HU-Q7.5), con el arnés de cajas contra la celda del
 * parqueadero en memoria y Ensayo Uno (P4): lo de cada caja sube una vez, dos cajas sin red se
 * juntan sin números repetidos ni perdidos (CA3), un corte a mitad no pierde ni duplica (CA4) y lo
 * que la celda no acepta queda en la caja con su motivo.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { abrir, type Entorno, vaciarShard } from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import {
  type Contexto,
  cotizar,
  registrarEntrada,
  registrarSalida,
} from '../../apps/parqueadero-sitio/src/caja/almacen.ts';
import type { BaseDeLaCaja } from '../../apps/parqueadero-sitio/src/caja/datos.ts';
import { enviarPendientes } from '../../apps/parqueadero-sitio/src/caja/sincronizar.ts';
import { turnoAbierto } from '../../apps/parqueadero-sitio/src/caja/turno.ts';
import { type Caja, caja, configurar, contar, red, turno } from './parqueadero-arnes.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

const entrar = (c: Caja, matricula: string) =>
  registrarEntrada(
    c.db,
    { placa: matricula, vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
    c.ctx,
  );

async function salir(db: BaseDeLaCaja, ctx: Contexto, estadiaId: string) {
  const q = await cotizar(db, estadiaId, ctx.reloj(), false);
  return registrarSalida(
    db,
    estadiaId,
    {
      perdido: false,
      medio: 'efectivo',
      recibido: q.liquidacion.total + 1_000,
      motivoCortesia: null,
    },
    ctx,
    q.salida,
  );
}

const placa = (serie: string, i: number) => `${serie}${serie}${serie}${String(100 + i)}`;
const ids = async (c: Caja) => (await c.db.registros.toCollection().primaryKeys()).sort();

/** Una caja configurada que ya subió sus ajustes, y otra que los bajó: el parqueadero listo. */
async function dosCajas() {
  const a = await caja(e, 'A');
  await configurar(a);
  await a.sincronizar(red(e).fn);
  const b = await caja(e, 'B');
  await b.sincronizar(red(e).fn);
  await turno(a);
  await turno(b);
  return { a, b };
}

describe('lo de una caja sube a la celda', () => {
  it('cada registro y cada catálogo sube una vez, con los mismos números, y la cola queda vacía', async () => {
    const a = await caja(e, 'A');
    await configurar(a);
    await turno(a);
    for (let i = 0; i < 3; i++) await entrar(a, placa('A', i));
    expect(await a.db.outbox.count()).toBe(1 + 2 + 1 + 3); // sede, dos tarifas, turno, entradas
    await a.sincronizar(red(e).fn);
    expect(await a.db.outbox.count()).toBe(0);
    expect(await contar(e, 'registro')).toBe(4);
    expect(await contar(e, 'catalogo')).toBe(3);
    expect(await contar(e, 'cuarentena')).toBe(0);
    const numeros = await e.db
      .prepare(
        "SELECT serie || '-' || consecutivo AS n FROM registro WHERE serie IS NOT NULL ORDER BY consecutivo",
      )
      .all<{ n: string }>();
    expect(numeros.results.map((r) => r.n)).toEqual(['A-1', 'A-2', 'A-3']);
    // Otra vuelta no manda nada.
    const otra = red(e);
    await a.sincronizar(otra.fn);
    expect(otra.pedidos).toEqual(['/api/v1/sync/pull']);
  });
});

describe('CA3 · dos cajas sin red se juntan sin números repetidos ni perdidos', () => {
  it('20 entradas y 20 salidas en cada caja, sin red; al volver la señal las dos quedan iguales', async () => {
    const { a, b } = await dosCajas();
    for (const c of [a, b]) {
      for (let i = 0; i < 20; i++) {
        const r = await entrar(c, placa(c.serie, i));
        c.avanzar(30);
        await salir(c.db, c.ctx, r.id);
      }
      // Sin señal: la caja registra igual y nada sale de su cola.
      await expect(c.sincronizar(red(e, { sinSenal: true }).fn)).rejects.toThrow('sin-senal');
      expect(await c.db.outbox.count()).toBe(41); // el turno, 20 entradas y 20 salidas
    }
    await a.sincronizar(red(e).fn);
    await b.sincronizar(red(e).fn);
    await a.sincronizar(red(e).fn);

    expect(await a.db.outbox.count()).toBe(0);
    expect(await b.db.outbox.count()).toBe(0);
    expect(await ids(a)).toEqual(await ids(b));
    expect(await a.db.registros.count()).toBe(82); // los dos turnos y 40 recibos por caja
    expect(await contar(e, 'registro')).toBe(82);
    expect(await contar(e, 'cuarentena')).toBe(0);
    // Cada serie con sus 40 números, del 1 al 40, una vez.
    for (const serie of ['A', 'B']) {
      const r = await e.db
        .prepare(
          'SELECT count(*) AS n, count(DISTINCT consecutivo) AS distintos, min(consecutivo) AS desde, max(consecutivo) AS hasta FROM registro WHERE serie = ?',
        )
        .bind(serie)
        .first<{ n: number; distintos: number; desde: number; hasta: number }>();
      expect(r).toEqual({ n: 40, distintos: 40, desde: 1, hasta: 40 });
    }
    // Ningún vehículo quedó adentro en ninguna de las dos.
    expect(await a.db.estadias.count()).toBe(0);
    expect(await b.db.estadias.count()).toBe(0);
  }, 120_000);

  it('un carro que entra por una caja sale por la otra, y la primera lo ve salir', async () => {
    const { a, b } = await dosCajas();
    const r = await entrar(a, 'ABC123');
    await a.sincronizar(red(e).fn);
    await b.sincronizar(red(e).fn);
    expect((await b.db.estadias.get(r.id))?.numero).toBe('A-000001');
    b.avanzar(45);
    const s = await salir(b.db, b.ctx, r.id);
    expect(s.serie).toBe('B');
    await b.sincronizar(red(e).fn);
    await a.sincronizar(red(e).fn);
    expect(await a.db.estadias.get(r.id)).toBeUndefined();
    expect(await a.db.registros.get(s.id)).toBeDefined();
  });

  it('el turno de cada caja es suyo: lo que baja de la otra no lo abre ni lo cierra', async () => {
    const { a, b } = await dosCajas();
    await a.sincronizar(red(e).fn);
    await b.sincronizar(red(e).fn);
    expect((await turnoAbierto(a.db))?.operador).toBe('Caja A');
    expect((await turnoAbierto(b.db))?.operador).toBe('Caja B');
    expect((await turnoAbierto(b.db))?.numero).toBe(1);
  });
});

describe('CA4 ❌ · la red cortada a mitad de un envío no pierde ni duplica', () => {
  it('la celda guardó el lote pero la respuesta no llegó: la cola queda igual y el reenvío es «duplicado»', async () => {
    const a = await caja(e, 'A');
    await configurar(a);
    await turno(a);
    for (let i = 0; i < 30; i++) await entrar(a, placa('A', i));
    const antes = await a.db.outbox.count();
    // El segundo lote llega a la celda y se escribe; su respuesta se pierde.
    const cortada = red(e, { perderRespuesta: 2 });
    await expect(a.sincronizar(cortada.fn)).rejects.toThrow('sin-senal');
    const quedan = await a.db.outbox.count();
    expect(quedan).toBeGreaterThan(0);
    expect(quedan).toBeLessThan(antes);
    await a.sincronizar(red(e).fn);
    expect(await a.db.outbox.count()).toBe(0);
    expect(await contar(e, 'registro')).toBe(31);
    expect(await contar(e, 'cuarentena')).toBe(0);
  });

  it('con ks:parqueadero apagado la caja espera, registra igual y no pierde nada', async () => {
    const a = await caja(e, 'A');
    await configurar(a);
    const pausa = red(e, { flags: { 'ks:parqueadero': 'apagado' } });
    const r = await enviarPendientes(a.db, a.destino, { fetchFn: pausa.fn });
    expect(r).toMatchObject({ estado: 'esperar', ms: 120_000 });
    expect(await a.db.outbox.count()).toBe(3);
    await turno(a);
    expect(await a.db.outbox.count()).toBe(4);
  });
});

describe('lo que la celda no acepta', () => {
  it('va a cuarentena con su motivo, sale de la cola y el dato sigue en la caja', async () => {
    // Una caja que nadie dio de alta en la celda (HU-Q7.7): su serie no es de ningún dispositivo.
    const { a } = await dosCajas();
    const c = await caja(e, 'C', { conAlta: false });
    await c.sincronizar(red(e).fn);
    await turno(c);
    const r = await entrar(c, 'XYZ987');
    await entrar(a, 'ABC123');
    await c.sincronizar(red(e).fn);
    await a.sincronizar(red(e).fn);
    expect((await c.db.rechazos.get(r.id))?.motivo).toBe(
      'La nube lo rechazó: la serie del recibo no es la del dispositivo que lo hizo',
    );
    expect(await c.db.outbox.count()).toBe(0);
    expect(await c.db.registros.get(r.id)).toBeDefined();
    // Lo de las otras cajas entra igual: una operación mala no frena el lote.
    expect(await contar(e, 'registro', "serie = 'A'")).toBe(1);
    expect(await contar(e, 'cuarentena')).toBe(1);
  });
});
