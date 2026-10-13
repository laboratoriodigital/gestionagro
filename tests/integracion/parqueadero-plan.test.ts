/**
 * HU-Q7.10 CA3 ❌: un plan vencido nunca detiene una entrada, un cobro ni un recibo. Con el plan
 * gratuito en el token (el que pone el CORE pasada la gracia), la caja registra y cobra igual, la
 * celda no recibe nada y la caja lo dice; pagado, lo de la caja sube entero, sin repetir números.
 * La caja y el Worker de la celda en el mismo proceso, con el D1 local de c2.
 */
import 'fake-indexeddb/auto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrir,
  type Entorno,
  token,
  vaciarShard,
} from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import {
  cotizar,
  registrarEntrada,
  registrarSalida,
} from '../../apps/parqueadero-sitio/src/caja/almacen.ts';
import { senalDeLaNube } from '../../apps/parqueadero-sitio/src/caja/senales.ts';
import { enviarPendientes } from '../../apps/parqueadero-sitio/src/caja/sincronizar.ts';
import { caja, configurar, contar, red, turno } from './parqueadero-arnes.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

describe('con el plan vencido la caja trabaja igual y la nube espera (HU-Q7.10 CA3 ❌)', () => {
  it('registra y cobra, no sube nada, y al pagar sube todo con sus números', async () => {
    const a = await caja(e, 'A');
    await configurar(a);
    await turno(a);
    const vencido = { ...a.destino, acceso: await token(e, { plan: 'gratis' }) };

    // Entra y sale un carro con el plan vencido: la caja no pregunta a la nube para nada de eso.
    const entrada = await registrarEntrada(
      a.db,
      { placa: 'ABC123', vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
      a.ctx,
    );
    a.avanzar(90);
    const q = await cotizar(a.db, entrada.id, a.ctx.reloj(), false);
    const salida = await registrarSalida(
      a.db,
      entrada.id,
      {
        perdido: false,
        medio: 'efectivo',
        recibido: q.liquidacion.total + 1_000,
        motivoCortesia: null,
      },
      a.ctx,
      q.salida,
    );
    expect(salida.consecutivo).toBe(2);

    const pendientes = await a.db.outbox.count();
    const r = await enviarPendientes(a.db, vencido, { fetchFn: red(e).fn });
    expect(r).toMatchObject({ estado: 'sin-plan', motivo: expect.stringContaining('en pausa') });
    expect(await contar(e, 'registro')).toBe(0);
    expect(await a.db.outbox.count()).toBe(pendientes);
    expect(senalDeLaNube(true, pendientes, { tipo: 'resultado', envio: r, cuando: 0 })).toEqual({
      texto: 'Nube en pausa: el plan no está al día',
      tono: 'error',
    });

    // Pagado (el acceso nuevo trae el plan): sube todo, una vez, con la serie y sus números.
    await a.sincronizar(red(e).fn);
    expect(await a.db.outbox.count()).toBe(0);
    const numeros = await e.db
      .prepare('SELECT consecutivo FROM registro WHERE serie = ? ORDER BY consecutivo')
      .bind('A')
      .all<{ consecutivo: number }>();
    expect(numeros.results.map((x) => x.consecutivo)).toEqual([1, 2]);
  });
});
