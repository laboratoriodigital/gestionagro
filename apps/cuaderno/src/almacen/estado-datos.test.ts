/**
 * Dónde está cada dato (HU-E3.14) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarClima } from './clima.ts';
import { abrirCuaderno } from './db.ts';
import { resumenDeDatos, textoIndicador } from './estado-datos.ts';
import { crearFincaConAreas } from './finca.ts';
import { pedirPersistencia } from './persistencia.ts';

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  it('cuenta los registros que siguen en el teléfono, aparte de los cambios de configuración', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.map((a) => ({
        tipo: a.tipo,
        nombre: a.nombre,
        area_m2: a.area_m2,
        capacidad_plantas: null,
      })),
    );
    expect(await resumenDeDatos(db)).toMatchObject({
      soloAqui: 0,
      cambiosSoloAqui: 1 + f.areas.length,
    });
    const area = areas[0];
    if (!area) throw new Error('sin áreas');
    await guardarClima(db, finca.id, area.id, {
      temperaturaC: 24,
      humedadRelativaPct: 70,
      temperaturaHojaC: null,
    });
    await guardarClima(db, finca.id, area.id, {
      temperaturaC: 28,
      humedadRelativaPct: 55,
      temperaturaHojaC: null,
    });
    expect((await resumenDeDatos(db)).soloAqui).toBe(2);
  });
});

describe('riesgo del almacenamiento', () => {
  it.each([
    ['concedida', false],
    ['negada', true],
    ['no-disponible', true],
  ] as const)('persistencia %s → riesgo %s', async (estado, riesgo) => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    await pedirPersistencia(db, {
      persist: async (): Promise<boolean> => {
        if (estado === 'no-disponible') throw new Error('no soportado');
        return estado === 'concedida';
      },
    });
    expect((await resumenDeDatos(db)).almacenamientoEnRiesgo).toBe(riesgo);
  });

  it('si todavía no se preguntó, no alarma', async () => {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    expect((await resumenDeDatos(db)).almacenamientoEnRiesgo).toBe(false);
  });
});

describe('texto del indicador', () => {
  it.each([
    [0, 'Sin registros pendientes'],
    [1, '1 registro solo en este teléfono'],
    [7, '7 registros solo en este teléfono'],
  ])('%d → «%s»', (soloAqui, texto) => {
    expect(textoIndicador({ soloAqui })).toBe(texto);
  });
});
