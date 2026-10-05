/**
 * Batería de caos de la sincronización (HU-E5.6). Rompe la sincronización a propósito, con las
 * dos fincas de prueba (P4), y al final de cada caso exige la misma regla (CA2): cada registro
 * creado en cualquier teléfono existe exactamente una vez en la celda y en todos los teléfonos, y
 * no queda nada pendiente.
 *
 * Cada caso, además, comprueba en el medio la protección que lo hace pasar; el pull request dice
 * con qué defecto puesto se vio cada uno en rojo (CA4, P5).
 *
 * Usa el arnés de teléfonos simulados (`tests/integracion/arnes.ts`): la API real de la celda con
 * el D1 local de wrangler y el cuaderno real sobre fake-indexeddb. Lo que no imita (P17): la red
 * de verdad, los límites de D1 en Cloudflare y el CORE.
 */
import { uuidv7 } from '@ed1/agro-schema';
import type { BaseD1 } from '@ed1/d1';
import { APP_MINIMA } from '@ed1/sync';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { enviarPendientes } from '../../apps/cuaderno/src/almacen/envio.ts';
import { editarArea } from '../../apps/cuaderno/src/almacen/finca.ts';
import { recibirCambios } from '../../apps/cuaderno/src/almacen/recepcion.ts';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import {
  anotar,
  type Celda,
  invariante,
  montarCelda,
  sinDiferencias,
  T0,
  telefonoConFinca,
  telefonoNuevo,
} from '../integracion/arnes.ts';

const UN_DIA = 24 * 60 * 60 * 1000;

let c: Celda;
beforeAll(async () => {
  c = await montarCelda();
}, 60_000);
afterAll(async () => c?.cerrar());
beforeEach(async () => {
  await c.vaciar();
  c.reloj.ahora = T0;
});

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  /** Un teléfono con la finca ya en la nube y otro de la misma cuenta que la bajó. */
  async function dosTelefonos() {
    const a = await telefonoConFinca(c, f, 0);
    await a.sincronizar(c.red().fn);
    const b = await telefonoNuevo(c, a.org);
    await b.sincronizar(c.red().fn);
    return { a, b };
  }

  it('1 · lote duplicado: la red entrega cada envío dos veces y nada se duplica', async () => {
    const { a, b } = await dosTelefonos();
    const creados = await anotar(a.db, 30);
    await a.sincronizar(c.red({ duplicar: true }).fn);
    // Protección: el mismo id no entra dos veces (INSERT OR IGNORE por id).
    expect(await c.contar('registro')).toBe(30);
    await b.sincronizar(c.red({ duplicar: true }).fn);
    expect(await invariante(c, [a.db, b.db], creados)).toEqual(sinDiferencias(2));
  }, 60_000);

  it('2 · corte a la mitad: la respuesta del segundo lote no llega', async () => {
    const { a, b } = await dosTelefonos();
    const creados = await anotar(a.db, 40); // dos lotes
    const cortada = await enviarPendientes(a.db, a.destino, {
      fetchFn: c.red({ cortarDespuesDe: 1 }).fn,
    });
    // Protección: sin respuesta no sale nada de la cola, aunque la celda ya lo tenga.
    expect(cortada.estado).toBe('sin-senal');
    expect(await a.db.outbox.count()).toBe(15);
    expect(await c.contar('registro')).toBe(40);
    await a.sincronizar(c.red().fn);
    await b.sincronizar(c.red().fn);
    expect(await invariante(c, [a.db, b.db], creados)).toEqual(sinDiferencias(2));
  }, 60_000);

  it('3 · dos teléfonos sin señal anotan y editan lo mismo; luego vuelve la señal', async () => {
    const { a, b } = await dosTelefonos();
    const area = (await a.db.area.toArray())[0];
    if (!area) throw new Error('sin área');
    const deA = await anotar(a.db, 6, T0 + 1000);
    const deB = await anotar(b.db, 7, T0 + 2000);
    await editarArea(a.db, area.id, { nombre: 'Editada en A' });
    await editarArea(b.db, area.id, { nombre: 'Editada en B' });
    // Protección: sin señal nada sale y nada se pierde.
    const sinSenal = await enviarPendientes(a.db, a.destino, {
      fetchFn: c.red({ sinSenal: true }).fn,
    });
    expect(sinSenal.estado).toBe('sin-senal');
    await a.sincronizar(c.red().fn);
    await b.sincronizar(c.red().fn);
    await a.sincronizar(c.red().fn);
    expect(await invariante(c, [a.db, b.db], [...deA, ...deB])).toEqual(sinDiferencias(2));
    // Ninguna versión del área se perdió: la otra quedó como conflicto (HU-E5.4 decidirá).
    const historial = await c.db
      .prepare("SELECT datos FROM entidad_historial WHERE entidad = 'area'")
      .all<{ datos: string }>();
    const nombres = historial.results.map((r) => JSON.parse(r.datos).nombre);
    const vigente = await c.db
      .prepare('SELECT datos FROM catalogo WHERE id = ?')
      .bind(area.id)
      .first<{ datos: string }>();
    expect([...nombres, JSON.parse(vigente?.datos ?? '{}').nombre]).toEqual(
      expect.arrayContaining(['Editada en A', 'Editada en B']),
    );
  }, 60_000);

  it('4 · reloj del teléfono adelantado un día: se guarda tal cual y se marca (CA3, P8)', async () => {
    const { a, b } = await dosTelefonos();
    const creados = await anotar(a.db, 3, T0 + UN_DIA);
    const r = await enviarPendientes(a.db, a.destino, { fetchFn: c.red().fn });
    // Protección: no se corrige la hora en silencio; se avisa al teléfono.
    expect(r).toMatchObject({ estado: 'al-dia', relojCorrido: true });
    const guardado = await c.db
      .prepare('SELECT instante_evento FROM registro LIMIT 1')
      .first<{ instante_evento: string }>();
    expect(Date.parse(guardado?.instante_evento ?? '')).toBeGreaterThanOrEqual(T0 + UN_DIA);
    expect(await a.db.meta.get('reloj_corrido')).toBeTruthy();
    await b.sincronizar(c.red().fn);
    expect(await invariante(c, [a.db, b.db], creados)).toEqual(sinDiferencias(2));
  }, 60_000);

  it('5 · app vieja: un teléfono con la versión 0.0.1 y un riego v1 sube igual', async () => {
    const { a, b } = await dosTelefonos();
    const creados = await anotar(a.db, 2);
    // Lo que una app vieja dejó en la cola: un riego de la versión 1, sin duración.
    const area = (await a.db.area.toArray())[0];
    const finca = await a.db.finca.toCollection().first();
    const id = uuidv7(() => T0 + 5000);
    await a.db.registro.add({
      id,
      org_id: null,
      finca_id: finca?.id ?? '',
      area_ids: [area?.id ?? ''],
      ciclo_id: null,
      tipo: 'riego',
      v: 1,
      fecha_agronomica: '2026-10-01',
      instante_evento: new Date(T0).toISOString(),
      autor_usuario_id: null,
      persona_ids: [],
      dispositivo_id: 'telefono-viejo',
      origen: 'manual',
      anula_id: null,
      datos: {
        unidad: 'L_area',
        volumenAplicado: 100,
        volumenDrenado: null,
        drenajePct: null,
        ceEntradaDsM: null,
        phEntrada: null,
        ceDrenajeDsM: null,
        phDrenaje: null,
      },
    });
    await a.db.outbox.add({
      id,
      entidad: 'registro',
      entidad_id: id,
      version: 1,
      op: 'crear',
      creado: new Date(T0).toISOString(),
    });
    const r = await enviarPendientes(a.db, { ...a.destino, app: '0.0.1' }, { fetchFn: c.red().fn });
    // Protección: se acepta todo y solo se pide actualizar (ADR-13).
    expect(r).toMatchObject({ estado: 'al-dia', rechazados: 0, actualizar: expect.any(String) });
    expect(APP_MINIMA).not.toBe('0.0.1');
    await b.sincronizar(c.red().fn);
    expect(await invariante(c, [a.db, b.db], [...creados, id])).toEqual(sinDiferencias(2));
  }, 60_000);

  it('6 · celda en «esencial»: los registros suben, bajar espera hasta que pase', async () => {
    const { a, b } = await dosTelefonos();
    const creados = [...(await anotar(a.db, 4)), ...(await anotar(b.db, 3, T0 + 9000))];
    const esencial = { nivel: 'esencial' };
    await enviarPendientes(a.db, a.destino, { fetchFn: c.red({ flags: esencial }).fn });
    await enviarPendientes(b.db, b.destino, { fetchFn: c.red({ flags: esencial }).fn });
    // Protección: en «esencial» el push sigue y el pull se pausa con su causa.
    expect(await c.contar('registro')).toBe(7);
    const pausa = await recibirCambios(a.db, a.destino, { fetchFn: c.red({ flags: esencial }).fn });
    expect(pausa).toMatchObject({ estado: 'esperar', causa: 'esencial' });
    await a.sincronizar(c.red().fn);
    await b.sincronizar(c.red().fn);
    expect(await invariante(c, [a.db, b.db], creados)).toEqual(sinDiferencias(2));
  }, 60_000);

  it('7 · token vencido sin señal: se sigue anotando; con señal y sesión nueva, sube todo', async () => {
    const { a, b } = await dosTelefonos();
    c.reloj.ahora = T0 + 13 * 60 * 60 * 1000; // el access de 12 h ya venció
    const creados = await anotar(a.db, 5, c.reloj.ahora);
    const sinSenal = await enviarPendientes(a.db, a.destino, {
      fetchFn: c.red({ sinSenal: true }).fn,
    });
    expect(sinSenal.estado).toBe('sin-senal');
    // Protección: con señal pero sin sesión, la celda dice 401 y la cola queda igual.
    const sinSesion = await enviarPendientes(a.db, a.destino, { fetchFn: c.red().fn });
    expect(sinSesion.estado).toBe('sin-sesion');
    expect(await a.db.outbox.count()).toBe(5);
    const renovado = { ...a.destino, acceso: await c.acceso(a.org, c.reloj.ahora) };
    await enviarPendientes(a.db, renovado, { fetchFn: c.red().fn });
    const bRenovado = { ...b.destino, acceso: await c.acceso(a.org, c.reloj.ahora) };
    await recibirCambios(b.db, bRenovado, { fetchFn: c.red().fn });
    expect(await invariante(c, [a.db, b.db], creados)).toEqual(sinDiferencias(2));
  }, 60_000);

  it('8 · cuota de D1 agotada (simulada): ni la celda ni el teléfono pierden nada', async () => {
    const { a, b } = await dosTelefonos();
    const creados = await anotar(a.db, 8);
    // a) El vigía marcó «bloqueo»: la celda no intenta escribir y dice hasta cuándo.
    const bloqueo = await enviarPendientes(a.db, a.destino, {
      fetchFn: c.red({ flags: { nivel: 'bloqueo' } }).fn,
    });
    expect(bloqueo).toMatchObject({ estado: 'esperar', causa: 'bloqueo' });
    // b) D1 rechaza la escritura antes de que el vigía se entere.
    const d1Agotada: BaseD1 = {
      prepare: (sql) => c.db.prepare(sql),
      batch: async () => {
        throw new Error('D1_ERROR: Exceeded maximum daily rows written');
      },
    };
    const rechazo = await enviarPendientes(a.db, a.destino, {
      fetchFn: c.red({ base: d1Agotada }).fn,
    });
    // La celda lo dice como falla suya, en JSON y con espera; no como falta de señal (bitácora agro 23).
    expect(rechazo).toMatchObject({ estado: 'esperar', causa: 'falla-celda' });
    // Protección: nada salió de la cola y la celda no tiene nada a medias.
    expect(await a.db.outbox.count()).toBe(8);
    expect(await c.contar('registro')).toBe(0);
    await a.sincronizar(c.red().fn);
    await b.sincronizar(c.red().fn);
    expect(await invariante(c, [a.db, b.db], creados)).toEqual(sinDiferencias(2));
  }, 60_000);
});
