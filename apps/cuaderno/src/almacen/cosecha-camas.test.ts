/**
 * Carencia con camas y surcos (revisión del dueño, 3 oct 2026): lo aplicado en una cama impide
 * cosechar su nave entera, lo aplicado en la nave impide cosechar sus camas, y una cama vecina no
 * se bloquea (P1). Sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarAplicacion } from './aplicaciones.ts';
import { bloqueoPorCarencia, motivoDelBloqueo } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas, crearSubarea } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { crearPersona } from './personas.ts';

const APLICADO = () => new Date('2026-12-10T14:30:00Z');
const AL_OTRO_DIA = new Date('2026-12-11T15:00:00Z');

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    const [nave] = areas;
    if (!nave) throw new Error('sin nave');
    const cama = (n: number) =>
      crearSubarea(db, nave.id, {
        tipo: 'cama',
        nombre: `Cama ${n}`,
        area_m2: 40,
        capacidad_plantas: null,
      });
    const c1 = await cama(1);
    const c2 = await cama(2);
    const persona = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo', rol: 'operario' });
    const insumo = (nombre: string, carencia: number | null) =>
      crearInsumo(db, finca.id, {
        tipo: 'fitosanitario',
        registro_ica: null,
        ingrediente_activo: null,
        unidad: 'mL',
        carencia_dias: carencia,
        reentrada_horas: 4,
        permitido_ecologico: null,
        nombre_comercial: nombre,
      });
    const aplicar = (areaId: string, insumoId: string) =>
      guardarAplicacion(
        db,
        finca.id,
        [areaId],
        {
          insumoId,
          dosis: 2,
          dosisUnidad: 'mL/L',
          volumenMezclaL: 20,
          equipo: null,
          personaIds: [persona.id],
        },
        { ahora: APLICADO },
      );
    const bloqueo = (areaId: string) =>
      bloqueoPorCarencia(db, finca.id, areaId, AL_OTRO_DIA).then((b) =>
        b ? motivoDelBloqueo(b) : null,
      );
    return { nave, c1, c2, insumo, aplicar, bloqueo };
  }

  it('aplicado en la Cama 2: no se cosecha la nave ni esa cama; la Cama 1 sí', async () => {
    const { nave, c1, c2, insumo, aplicar, bloqueo } = await preparar();
    const tres = await insumo('Producto Tres Días', 3);
    await aplicar(c2.id, tres.id);
    expect(await bloqueo(nave.id)).toBe(
      'En carencia hasta el 13/12 por Producto Tres Días en Cama 2: no se debe cosechar',
    );
    expect(await bloqueo(c2.id)).toBe(
      'En carencia hasta el 13/12 por Producto Tres Días: no se debe cosechar',
    );
    expect(await bloqueo(c1.id)).toBeNull();
  });

  it('aplicado en la nave: tampoco se cosechan sus camas', async () => {
    const { nave, c1, insumo, aplicar, bloqueo } = await preparar();
    const tres = await insumo('Producto Tres Días', 3);
    await aplicar(nave.id, tres.id);
    expect(await bloqueo(c1.id)).toBe(
      'En carencia hasta el 13/12 por Producto Tres Días en Nave 1: no se debe cosechar',
    );
  });

  it('manda lo más restrictivo: la carencia desconocida de una cama sobre la fecha de la nave', async () => {
    const { nave, c2, insumo, aplicar, bloqueo } = await preparar();
    await aplicar(nave.id, (await insumo('Producto Tres Días', 3)).id);
    await aplicar(c2.id, (await insumo('Producto Sin Etiqueta', null)).id);
    expect(await bloqueo(nave.id)).toBe(
      'Carencia desconocida de Producto Sin Etiqueta en Cama 2: no se sabe cuándo se puede cosechar',
    );
  });
});
