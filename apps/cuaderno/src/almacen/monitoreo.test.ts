/**
 * Monitoreo de plagas y enfermedades (HU-E3.11) sobre fake-indexeddb, con las dos fincas de
 * prueba (P4). La compresión de la foto necesita un navegador: está en la e2e.
 */
import { ErrorDeValidacion } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import {
  comoPlan,
  cuotaDeFotos,
  type DatosMonitoreo,
  type DatosMonitoreoGuardado,
  guardarMonitoreo,
  plagasConocidas,
  TAMANO_MAXIMO_FOTO,
} from './monitoreo.ts';

const HOY = () => new Date('2027-03-27T15:00:00Z');
const motivos = (e: unknown) =>
  e instanceof ErrorDeValidacion ? e.campos.map((c) => c.motivo) : [String(e)];
const foto = (bytes = 40_000) => ({
  datos: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
  tipo: 'image/webp',
});

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_n, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
    );
    const base: DatosMonitoreo = {
      areaId: areas[0]?.id ?? '',
      plaga: 'Plaga Ensayo',
      clase: 'plaga',
      metodo: 'trampa',
      nivel: 'medio',
      cantidad: 12,
      nota: '',
      foto: null,
    };
    return { db, finca, base };
  }

  it('CA1: guarda qué se vio, cómo se midió y el nivel; sube como cualquier registro', async () => {
    const { db, finca, base } = await preparar();
    const r = await guardarMonitoreo(
      db,
      finca.id,
      { ...base, plaga: '  Plaga   Ensayo ' },
      { ahora: HOY },
    );
    expect(r.datos).toEqual({
      plaga: 'Plaga Ensayo',
      clase: 'plaga',
      metodo: 'trampa',
      nivel: 'medio',
      cantidad: 12,
      foto_id: null,
      nota: null,
      plantasRevisadas: null,
      plantasAfectadas: null,
    } satisfies DatosMonitoreoGuardado);
    expect(r.v).toBe(2);
    expect(await db.outbox.get(r.id)).toBeDefined();
    // Plantas revisadas y afectadas: la incidencia del muestreo (revisión del dueño, 3 oct 2026).
    const conPlantas = await guardarMonitoreo(
      db,
      finca.id,
      { ...base, metodo: 'conteo', plantasRevisadas: 20, plantasAfectadas: 3 },
      { ahora: HOY },
    );
    expect(conPlantas.datos).toMatchObject({ plantasRevisadas: 20, plantasAfectadas: 3 });
    // Más afectadas que revisadas, o afectadas sin revisadas, no se guarda (P1).
    await expect(
      guardarMonitoreo(
        db,
        finca.id,
        { ...base, plantasRevisadas: 5, plantasAfectadas: 6 },
        { ahora: HOY },
      ),
    ).rejects.toThrow(/no pueden ser más que las revisadas/);
    await expect(
      guardarMonitoreo(db, finca.id, { ...base, plantasAfectadas: 2 }, { ahora: HOY }),
    ).rejects.toThrow(/escribe cuántas plantas revisaste/);
    // Observar sin contar no guarda una cantidad.
    const obs = await guardarMonitoreo(
      db,
      finca.id,
      { ...base, metodo: 'observacion' },
      { ahora: HOY },
    );
    expect((obs.datos as DatosMonitoreoGuardado).cantidad).toBeNull();
  });

  it('CA1: el catálogo es lo ya anotado, el más reciente primero, sin repetir', async () => {
    const { db, finca, base } = await preparar();
    await guardarMonitoreo(db, finca.id, { ...base, plaga: 'Plaga Ensayo' }, { ahora: HOY });
    await guardarMonitoreo(
      db,
      finca.id,
      { ...base, plaga: 'Enfermedad Ensayo', clase: 'enfermedad' },
      {
        ahora: () => new Date('2027-03-27T16:00:00Z'),
      },
    );
    await guardarMonitoreo(
      db,
      finca.id,
      { ...base, plaga: 'plaga ensayo' },
      {
        ahora: () => new Date('2027-03-27T17:00:00Z'),
      },
    );
    expect(await plagasConocidas(db, finca.id)).toEqual([
      { nombre: 'plaga ensayo', clase: 'plaga' },
      { nombre: 'Enfermedad Ensayo', clase: 'enfermedad' },
    ]);
  });

  it('pide lo que falta, en palabras', async () => {
    const { db, finca, base } = await preparar();
    const e = await guardarMonitoreo(db, finca.id, {
      ...base,
      plaga: ' ',
      clase: '',
      metodo: '',
      nivel: '',
    }).catch((x: unknown) => x);
    expect(motivos(e)).toEqual([
      'escribe qué viste',
      'elige si es plaga o enfermedad',
      'elige cómo lo mediste',
      'elige el nivel',
    ]);
  });

  it('CA2: la foto queda en el teléfono con el registro, y el registro solo lleva su id', async () => {
    const { db, finca, base } = await preparar();
    const r = await guardarMonitoreo(
      db,
      finca.id,
      { ...base, foto: foto() },
      { ahora: HOY, plan: 'finca' },
    );
    const id = (r.datos as DatosMonitoreoGuardado).foto_id;
    expect(id).toBeTruthy();
    const guardada = await db.foto.get(id ?? '');
    expect(guardada).toMatchObject({ registro_id: r.id, tipo: 'image/webp', tamano: 40_000 });
    expect(JSON.stringify(r)).not.toContain('image/webp');
  });

  it('CA2: una foto de más de 150 KB no se guarda, ni el registro', async () => {
    const { db, finca, base } = await preparar();
    const e = await guardarMonitoreo(
      db,
      finca.id,
      {
        ...base,
        foto: foto(TAMANO_MAXIMO_FOTO + 1),
      },
      { plan: 'finca' },
    ).catch((x: unknown) => x);
    expect(motivos(e)).toEqual(['la foto pesa más de 150 KB']);
    expect(await db.registro.count()).toBe(0);
  });

  it('CA3: las fotos son del plan Finca (ARQUITECTURA §2.4): el gratuito no adjunta, y lo dice', async () => {
    const { db, finca, base } = await preparar();
    expect(await cuotaDeFotos(db, 'gratuito', HOY)).toEqual({ usadas: 0, limite: 0 });
    const e = await guardarMonitoreo(db, finca.id, { ...base, foto: foto() }, { ahora: HOY }).catch(
      (x: unknown) => x,
    );
    expect(motivos(e)).toEqual(['las fotos de monitoreo vienen con el plan Finca']);
    // Sin foto, el monitoreo se guarda igual.
    await guardarMonitoreo(db, finca.id, base, { ahora: HOY });
    expect(comoPlan('plan-que-no-existe')).toBe('gratuito');
  });

  it('CA3: «x de y fotos este mes» del plan; sin cupo no guarda la foto', async () => {
    const { db, finca, base } = await preparar();
    expect((await cuotaDeFotos(db, 'finca', HOY)).limite).toBe(120);
    await db.foto.bulkAdd(
      Array.from({ length: 120 }, (_, i) => ({
        id: `f${i}`,
        registro_id: 'r',
        tipo: 'image/webp',
        datos: new Blob([]),
        tamano: 1,
        creado: '2027-03-10T15:00:00.000Z',
      })),
    );
    // Una del mes pasado no cuenta.
    await db.foto.add({
      id: 'vieja',
      registro_id: 'r',
      tipo: 'image/webp',
      datos: new Blob([]),
      tamano: 1,
      creado: '2027-02-27T15:00:00.000Z',
    });
    expect(await cuotaDeFotos(db, 'finca', HOY)).toEqual({ usadas: 120, limite: 120 });
    const e = await guardarMonitoreo(
      db,
      finca.id,
      { ...base, foto: foto() },
      {
        ahora: HOY,
        plan: 'finca',
      },
    ).catch((x: unknown) => x);
    expect(motivos(e)).toEqual([
      'ya usaste las 120 fotos de este mes; guarda el monitoreo sin foto',
    ]);
  });
});
