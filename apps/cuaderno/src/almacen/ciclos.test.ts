/**
 * Ciclos de cultivo (HU-E3.4) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 * El reloj se fija: «hoy» es el 15/01/2027 en Bogotá (P8).
 */
import { type Area, ErrorDeValidacion, uuidv7 } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import {
  agregarCultivo,
  agregarVariedad,
  cerrarCiclo,
  cicloActivoDe,
  diasDesdeTrasplante,
  iniciarCiclo,
  leerCultivos,
} from './ciclos.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas, crearSubarea } from './finca.ts';
import { guardarRegistro } from './guardar.ts';

const HOY = new Date('2027-01-15T15:00:00Z');
const ahora = () => HOY;
const campos = (e: unknown) =>
  e instanceof ErrorDeValidacion
    ? e.campos.map((c) => c.campo)
    : [`(no es ErrorDeValidacion: ${String(e)})`];

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.map((a) => ({
        tipo: a.tipo,
        nombre: a.nombre,
        area_m2: a.area_m2,
        capacidad_plantas: a.plantas,
      })),
    );
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora });
    const area = areas[0] as Area;
    const datos = {
      fincaId: finca.id,
      areaId: area.id,
      cultivo: f.cultivo.nombre,
      variedad: f.cultivo.variedad,
      fechaTrasplante: '2026-10-15',
      plantas: f.areas[0]?.plantas ?? null,
    };
    return { db, finca, area, areas, datos };
  }

  it('CA1: el ciclo queda activo en el área y es el de sus registros por defecto', async () => {
    const { db, area, datos } = await preparar();
    const ciclo = await iniciarCiclo(db, datos, { ahora });
    expect(ciclo).toMatchObject({ estado: 'activo', fecha_fin: null, area_ids: [area.id] });
    expect((await cicloActivoDe(db, area.id))?.id).toBe(ciclo.id);
  });

  it('CA1: un área no tiene dos ciclos activos', async () => {
    const { db, datos } = await preparar();
    await iniciarCiclo(db, datos, { ahora });
    expect(campos(await iniciarCiclo(db, datos, { ahora }).catch((e: unknown) => e))).toEqual([
      'area_ids',
    ]);
  });

  it('CA2: cultivo y variedad salen del catálogo; agregar una variedad no requiere código', async () => {
    const { db, finca, datos } = await preparar();
    expect(
      campos(
        await iniciarCiclo(db, { ...datos, variedad: 'Nueva' }, { ahora }).catch((e: unknown) => e),
      ),
    ).toEqual(['variedad']);
    const [cultivo] = await leerCultivos(db, finca.id);
    await agregarVariedad(db, cultivo?.id ?? '', 'Nueva', { ahora });
    await agregarVariedad(db, cultivo?.id ?? '', ' nueva ', { ahora }); // repetida: no se duplica
    expect((await leerCultivos(db, finca.id))[0]?.variedades).toEqual([
      f.cultivo.variedad,
      'Nueva',
    ]);
    await expect(
      iniciarCiclo(db, { ...datos, variedad: 'nueva' }, { ahora }),
    ).resolves.toMatchObject({
      variedad: 'Nueva',
    });
  });

  it('CA2: un cultivo que no está en el catálogo no se acepta', async () => {
    const { db, datos } = await preparar();
    expect(
      campos(
        await iniciarCiclo(db, { ...datos, cultivo: 'Inventado' }, { ahora }).catch(
          (e: unknown) => e,
        ),
      ),
    ).toEqual(['cultivo']);
  });

  it('CA3: cerrar pide confirmación y fecha; después el área queda libre', async () => {
    const { db, area, datos } = await preparar();
    const ciclo = await iniciarCiclo(db, datos, { ahora });
    expect(
      campos(
        await cerrarCiclo(db, ciclo.id, '2027-01-10', false, { ahora }).catch((e: unknown) => e),
      ),
    ).toEqual(['confirmado']);
    expect(
      campos(
        await cerrarCiclo(db, ciclo.id, '2026-10-01', true, { ahora }).catch((e: unknown) => e),
      ),
    ).toEqual(['fecha_fin']);
    const cerrado = await cerrarCiclo(db, ciclo.id, '2027-01-10', true, { ahora });
    expect(cerrado).toMatchObject({ estado: 'cerrado', fecha_fin: '2027-01-10', version: 2 });
    expect(await cicloActivoDe(db, area.id)).toBeUndefined();
  });

  it('CA3: un registro sobre un ciclo cerrado se rechaza, salvo confirmación explícita', async () => {
    const { db, finca, area, datos } = await preparar();
    const ciclo = await iniciarCiclo(db, datos, { ahora });
    await cerrarCiclo(db, ciclo.id, '2027-01-10', true, { ahora });
    const registro = {
      id: uuidv7(),
      org_id: null,
      finca_id: finca.id,
      area_ids: [area.id],
      ciclo_id: ciclo.id,
      tipo: 'clima',
      v: 1,
      fecha_agronomica: '2027-01-12',
      instante_evento: '2027-01-12T14:00:00.000Z',
      autor_usuario_id: null,
      persona_ids: [],
      dispositivo_id: 'telefono-prueba',
      origen: 'manual',
      anula_id: null,
      datos: { temperaturaC: 24, humedadRelativaPct: 70, temperaturaHojaC: null, dpvKPa: 0.895 },
    };
    const error = await guardarRegistro(db, registro).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['ciclo_id']);
    expect(String((error as Error).message)).toContain('10/01/2027');
    expect(await db.registro.count()).toBe(0);
    await expect(
      guardarRegistro(db, registro, { confirmarCicloCerrado: true }),
    ).resolves.toMatchObject({
      ciclo_id: ciclo.id,
    });
  });

  it('CA4: días desde el trasplante en días agronómicos, cruzando fin de mes y de año', async () => {
    const { db, datos } = await preparar();
    const ciclo = await iniciarCiclo(db, datos, { ahora });
    expect(diasDesdeTrasplante(ciclo, new Date('2026-11-01T15:00:00Z'))).toBe(17);
    expect(diasDesdeTrasplante(ciclo, new Date('2027-01-01T04:30:00Z'))).toBe(77); // 31/12 23:30 en Bogotá
    expect(diasDesdeTrasplante(ciclo, HOY)).toBe(92);
  });

  it('un ciclo no va en una cama ni con trasplante en el futuro', async () => {
    const { db, area, datos } = await preparar();
    const cama = await crearSubarea(db, area.id, {
      tipo: 'cama',
      nombre: 'Cama 1',
      area_m2: 20,
      capacidad_plantas: null,
    });
    expect(
      campos(
        await iniciarCiclo(db, { ...datos, areaId: cama.id }, { ahora }).catch((e: unknown) => e),
      ),
    ).toEqual(['area_ids']);
    expect(
      campos(
        await iniciarCiclo(db, { ...datos, fechaTrasplante: '2027-01-16' }, { ahora }).catch(
          (e: unknown) => e,
        ),
      ),
    ).toEqual(['fecha_trasplante']);
  });
});
