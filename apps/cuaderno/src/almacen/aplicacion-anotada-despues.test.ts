/**
 * Una aplicación anotada después de hecha (HU-E10.2): la carencia cuenta desde cuándo se aplicó,
 * no desde cuándo se anotó (P1, P8). Sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeValidacion, instanteDeUuidv7, instanteEnColombia } from '@ed1/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { estadosPorArea, guardarAplicacion, textoCarencia } from './aplicaciones.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { crearPersona } from './personas.ts';

/** Se anota el 11/12/2026 a las 20:00 en Colombia. */
const ANOTADO = new Date('2026-12-12T01:00:00Z');
const enColombia = (fecha: string, hora: string) => {
  const ms = instanteEnColombia(fecha, hora);
  if (ms === null) throw new Error('fecha de prueba inválida');
  return new Date(ms);
};

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    const [nave] = areas;
    if (!nave) throw new Error('falta el área');
    const insumo = await crearInsumo(db, finca.id, {
      tipo: 'fitosanitario',
      registro_ica: null,
      ingrediente_activo: null,
      unidad: 'mL',
      carencia_dias: 3,
      reentrada_horas: 12,
      permitido_ecologico: null,
      nombre_comercial: 'Producto Tres Días',
    });
    const persona = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo', rol: 'operario' });
    const aplicar = (cuando: Date | undefined) =>
      guardarAplicacion(
        db,
        finca.id,
        [nave.id],
        {
          insumoId: insumo.id,
          dosis: 2,
          dosisUnidad: 'mL/L',
          volumenMezclaL: 20,
          equipo: null,
          personaIds: [persona.id],
        },
        { ahora: () => ANOTADO, cuando },
      );
    return { db, finca, nave, aplicar };
  }

  it('aplicada el 10/12 a las 7:00 y anotada el 11/12 en la noche: no cosechar hasta el 13/12', async () => {
    const { db, finca, nave, aplicar } = await preparar();
    const [r] = await aplicar(enColombia('2026-12-10', '07:00'));
    expect(r).toMatchObject({
      fecha_agronomica: '2026-12-10',
      instante_evento: '2026-12-10T12:00:00.000Z',
    });
    // El id sigue diciendo cuándo se anotó.
    expect(instanteDeUuidv7(r?.id ?? '')).toBe(ANOTADO.getTime());
    const e = (await estadosPorArea(db, finca.id, ANOTADO)).get(nave.id);
    expect(e && textoCarencia(e.carencia)).toBe('No cosechar hasta el 13/12 (Producto Tres Días)');
  });

  it('control negativo: sin «cuando», cuenta desde que se anotó (el 11/12): hasta el 14/12', async () => {
    const { db, finca, nave, aplicar } = await preparar();
    await aplicar(undefined);
    const e = (await estadosPorArea(db, finca.id, ANOTADO)).get(nave.id);
    expect(e && textoCarencia(e.carencia)).toBe('No cosechar hasta el 14/12 (Producto Tres Días)');
  });

  it.each([
    ['en el futuro', '2026-12-12', '09:00', 'no puede ser en el futuro'],
    ['de hace más de 90 días (el año mal escrito)', '2025-12-10', '07:00', 'revisa la fecha'],
  ])('%s se rechaza con el motivo (P1)', async (_c, fecha, hora, motivo) => {
    const { aplicar } = await preparar();
    const error = await aplicar(enColombia(fecha, hora)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeValidacion);
    expect((error as ErrorDeValidacion).campos.map((c) => c.motivo).join(' ')).toContain(motivo);
  });
});
