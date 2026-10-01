/**
 * Dos teléfonos de la misma finca (HU-E5.3) con el arnés de teléfonos simulados y las dos fincas
 * de prueba (P4): un teléfono nuevo baja todo el historial (CA4), cada uno ve lo del otro, y una
 * edición pendiente nunca la pisa lo que baja (CA2).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { guardarClima } from '../../apps/cuaderno/src/almacen/clima.ts';
import { editarArea } from '../../apps/cuaderno/src/almacen/finca.ts';
import { leerCursor, recibirCambios } from '../../apps/cuaderno/src/almacen/recepcion.ts';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { type Celda, montarCelda, T0, telefonoConFinca, telefonoNuevo } from './arnes.ts';

let c: Celda;
beforeAll(async () => {
  c = await montarCelda();
}, 60_000);
afterAll(async () => c?.cerrar());
beforeEach(async () => c.vaciar());

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  it('CA4: un teléfono nuevo de la misma cuenta baja toda la finca, en varias páginas, sin nada en su cola', async () => {
    const a = await telefonoConFinca(c, f, 230);
    await a.sincronizar(c.red().fn);
    const b = await telefonoNuevo(c, a.org);
    const { fn, lotes } = c.red();
    await b.sincronizar(fn);
    expect(lotes.length).toBeGreaterThanOrEqual(2); // más de una página de 200
    expect((await b.db.finca.toArray()).map((x) => x.nombre)).toEqual([f.finca.nombre]);
    expect(await b.db.area.count()).toBe(2);
    expect(await b.db.registro.count()).toBe(230);
    expect(await b.db.outbox.count()).toBe(0); // lo que baja no vuelve a subir
    expect(await leerCursor(b.db)).toEqual({ registro: 230, catalogo: 3 });
  }, 60_000); // 230 registros que suben y bajan: con toda la suite en paralelo pasa de 5 s

  it('cada teléfono ve lo que anotó el otro, una sola vez', async () => {
    const a = await telefonoConFinca(c, f, 2);
    await a.sincronizar(c.red().fn);
    const b = await telefonoNuevo(c, a.org);
    await b.sincronizar(c.red().fn);
    const area = (await b.db.area.toArray())[0];
    if (!area) throw new Error('sin área');
    await guardarClima(b.db, a.finca.id, area.id, {
      temperaturaC: 26,
      humedadRelativaPct: 60,
      temperaturaHojaC: null,
    });
    await b.sincronizar(c.red().fn);
    await a.sincronizar(c.red().fn);
    await a.sincronizar(c.red().fn); // otra vuelta no trae nada nuevo
    expect(await a.db.registro.count()).toBe(3);
    expect(await b.db.registro.count()).toBe(3);
    expect(await c.contar('registro')).toBe(3);
  });

  it('CA2: lo que baja no pisa una edición pendiente; las dos versiones quedan', async () => {
    const a = await telefonoConFinca(c, f, 0);
    await a.sincronizar(c.red().fn);
    const b = await telefonoNuevo(c, a.org);
    await b.sincronizar(c.red().fn);
    const area = a.areas[0];
    if (!area) throw new Error('sin área');
    // Los dos editan la misma área sin señal; B sube primero.
    await editarArea(a.db, area.id, { nombre: 'Nombre del teléfono A' });
    await editarArea(b.db, area.id, { nombre: 'Nombre del teléfono B' });
    await b.sincronizar(c.red().fn);
    // A baja antes de subir (la app sube primero; aquí se fuerza el orden malo a propósito).
    const bajada = await recibirCambios(a.db, a.destino, { fetchFn: c.red().fn, ahora: () => T0 });
    expect(bajada).toMatchObject({ estado: 'al-dia', conflictos: 1 });
    expect((await a.db.area.get(area.id))?.nombre).toBe('Nombre del teléfono A');
    const guardada = await a.db.historial.get(`${area.id}@v2#nube`);
    expect(guardada?.datos).toMatchObject({ nombre: 'Nombre del teléfono B' });
    // Cuando A sube, la celda guarda su versión como conflicto: ninguna se pierde.
    await a.sincronizar(c.red().fn);
    expect(await c.contar('entidad_historial')).toBeGreaterThanOrEqual(2); // la v1 editada y el conflicto
    const conflictos = await c.db
      .prepare("SELECT datos FROM entidad_historial WHERE motivo = 'conflicto'")
      .all<{ datos: string }>();
    expect(conflictos.results.map((r) => JSON.parse(r.datos).nombre)).toEqual([
      'Nombre del teléfono A',
    ]);
  });

  it('la celda no escribe nada para atender los pulls', async () => {
    const a = await telefonoConFinca(c, f, 5);
    await a.sincronizar(c.red().fn);
    const filas = async () =>
      (
        await c.db
          .prepare(
            'SELECT (SELECT count(*) FROM registro) + (SELECT count(*) FROM catalogo) + (SELECT count(*) FROM entidad_historial) + (SELECT count(*) FROM cuarentena) AS n',
          )
          .first<{ n: number }>()
      )?.n;
    const antes = await filas();
    const b = await telefonoNuevo(c, a.org);
    await recibirCambios(b.db, b.destino, { fetchFn: c.red().fn });
    await recibirCambios(b.db, b.destino, { fetchFn: c.red().fn });
    expect(await filas()).toBe(antes);
  });
});
