/**
 * Aplicaciones y vencimientos (HU-E3.10) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeValidacion } from '@ed1/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import {
  type DatosAplicacionGuardada,
  estadosPorArea,
  guardarAplicacion,
  textoCarencia,
  textoReentrada,
} from './aplicaciones.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { crearInsumo, editarInsumo } from './insumos.ts';
import { crearPersona } from './personas.ts';

/** 10/12/2026 a las 9:30 en Bogotá (14:30 UTC). */
const APLICADO = new Date('2026-12-10T14:30:00Z');
const en = (iso: string) => () => new Date(iso);

const ETIQUETA = {
  tipo: 'fitosanitario',
  registro_ica: 'REG-ENSAYO-0099',
  ingrediente_activo: 'Sustancia de ensayo',
  unidad: 'mL',
  permitido_ecologico: null,
} as const;

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
        capacidad_plantas: null,
      })),
    );
    const p = f.personas[0];
    if (!p) throw new Error('sin personas');
    const persona = await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol });
    const tres = await crearInsumo(db, finca.id, {
      ...ETIQUETA,
      nombre_comercial: 'Producto Tres Días',
      carencia_dias: 3,
      reentrada_horas: 4,
    });
    const area = areas[areas.length - 1];
    if (!area) throw new Error('sin áreas');
    const base = {
      insumoId: tres.id,
      dosis: 2,
      dosisUnidad: 'cm³ por litro',
      volumenMezclaL: 20,
      equipo: 'Bomba de espalda',
      personaIds: [persona.id],
    };
    return { db, finca, areas, area, tres, base };
  }

  it('CA1: carencia de 3 días aplicada el 10/12 → no cosechar hasta el 13/12; reentrada 4 h después', async () => {
    const { db, finca, area, base } = await preparar();
    const [r] = await guardarAplicacion(db, finca.id, [area.id], base, { ahora: () => APLICADO });
    expect(r).toMatchObject({ tipo: 'aplicacion', origen: 'tablero', area_ids: [area.id] });
    expect(r?.datos as DatosAplicacionGuardada).toMatchObject({
      insumo: 'Producto Tres Días',
      dosis: 2,
      dosisUnidad: 'cm³ por litro',
      carenciaDias: 3,
      reentradaHoras: 4,
    });
    const e = (await estadosPorArea(db, finca.id, APLICADO)).get(area.id);
    expect(e && textoCarencia(e.carencia)).toBe('No cosechar hasta el 13/12 (Producto Tres Días)');
    expect(e && textoReentrada(e.reentrada)).toBe(
      'Reentrada desde 10/12/2026 13:30 (Producto Tres Días)',
    );
  });

  it('CA1: el 12/12 sigue la carencia; el 13/12 ya se puede cosechar; pasadas 4 h, se puede entrar', async () => {
    const { db, finca, area, base } = await preparar();
    await guardarAplicacion(db, finca.id, [area.id], base, { ahora: () => APLICADO });
    const el = async (iso: string) =>
      (await estadosPorArea(db, finca.id, new Date(iso))).get(area.id);
    expect((await el('2026-12-10T18:29:00Z'))?.reentrada.tipo).toBe('desde');
    expect((await el('2026-12-10T18:30:00Z'))?.reentrada.tipo).toBe('libre');
    // 12/12 a las 23:59 en Bogotá = 13/12 04:59 UTC: aún no se cosecha (P8).
    expect((await el('2026-12-13T04:59:00Z'))?.carencia.tipo).toBe('hasta');
    expect((await el('2026-12-13T05:00:00Z'))?.carencia.tipo).toBe('libre');
  });

  it('CA3: una aplicación a las 22:30 de Bogotá cuenta en el día local, no en el UTC', async () => {
    const { db, finca, area, base } = await preparar();
    // 10/12 22:30 en Bogotá es 11/12 03:30 UTC. Contar desde el 11 daría el 14/12.
    await guardarAplicacion(db, finca.id, [area.id], base, { ahora: en('2026-12-11T03:30:00Z') });
    const e = (await estadosPorArea(db, finca.id, new Date('2026-12-11T04:00:00Z'))).get(area.id);
    expect(e?.carencia).toMatchObject({ tipo: 'hasta', fecha: '2026-12-13' });
  });

  it('con varias aplicaciones manda la que vence más tarde', async () => {
    const { db, finca, area, base, tres } = await preparar();
    const larga = await crearInsumo(db, finca.id, {
      ...ETIQUETA,
      nombre_comercial: 'Producto Diez Días',
      carencia_dias: 10,
      reentrada_horas: 1,
    });
    await guardarAplicacion(
      db,
      finca.id,
      [area.id],
      { ...base, insumoId: larga.id },
      { ahora: () => APLICADO },
    );
    await guardarAplicacion(
      db,
      finca.id,
      [area.id],
      { ...base, insumoId: tres.id },
      { ahora: en('2026-12-11T14:30:00Z') },
    );
    const e = (await estadosPorArea(db, finca.id, new Date('2026-12-11T15:00:00Z'))).get(area.id);
    expect(e?.carencia).toMatchObject({ fecha: '2026-12-20', insumo: 'Producto Diez Días' });
    expect(e?.reentrada).toMatchObject({ insumo: 'Producto Tres Días' });
  });

  it('CA4: carencia desconocida bloquea en rojo hasta completar el insumo; la etiqueta copiada no cambia después', async () => {
    const { db, finca, areas, area, base, tres } = await preparar();
    const sinCarencia = await crearInsumo(db, finca.id, {
      ...ETIQUETA,
      nombre_comercial: 'Producto Sin Carencia',
      carencia_dias: null,
      reentrada_horas: null,
    });
    await guardarAplicacion(
      db,
      finca.id,
      [area.id],
      { ...base, insumoId: sinCarencia.id },
      { ahora: () => APLICADO },
    );
    // Ni una conocida antes ni una después tapan la desconocida: sigue sin saberse cuándo cosechar.
    await guardarAplicacion(db, finca.id, [area.id], base, { ahora: en('2026-12-09T14:30:00Z') });
    // Una aplicación conocida después no tapa la desconocida: sigue sin saberse cuándo cosechar.
    await guardarAplicacion(db, finca.id, [area.id], base, { ahora: en('2026-12-11T14:30:00Z') });
    const conLaConocidaVigente = new Date('2026-12-11T15:00:00Z');
    expect(
      (await estadosPorArea(db, finca.id, conLaConocidaVigente)).get(area.id)?.carencia.tipo,
    ).toBe('desconocida');
    const meses = new Date('2027-03-01T15:00:00Z');
    let e = (await estadosPorArea(db, finca.id, meses)).get(area.id);
    expect(e && textoCarencia(e.carencia)).toBe(
      'Carencia desconocida de Producto Sin Carencia: no cosechar hasta completarla en Insumos',
    );
    expect(e?.reentrada.tipo).toBe('desconocida');

    await editarInsumo(db, sinCarencia.id, { carencia_dias: 5, reentrada_horas: 2 });
    e = (await estadosPorArea(db, finca.id, APLICADO)).get(area.id);
    expect(e?.carencia).toMatchObject({ tipo: 'hasta', fecha: '2026-12-15' });

    // Lo ya aplicado conserva la carencia de su etiqueta aunque el insumo se corrija después.
    await guardarAplicacion(db, finca.id, [area.id], base, { ahora: () => APLICADO });
    await editarInsumo(db, tres.id, { carencia_dias: 30 });
    e = (await estadosPorArea(db, finca.id, APLICADO)).get(area.id);
    expect(e?.carencia).toMatchObject({ fecha: '2026-12-15' });
    expect(
      (await estadosPorArea(db, finca.id, APLICADO)).has(
        areas.find((a) => a.id !== area.id)?.id ?? '-',
      ),
    ).toBe(false);
  });

  it('la misma mezcla en todas las áreas deja un registro por área', async () => {
    const { db, finca, areas, base } = await preparar();
    const guardados = await guardarAplicacion(
      db,
      finca.id,
      areas.map((a) => a.id),
      base,
      { ahora: () => APLICADO },
    );
    expect(guardados.map((r) => r.area_ids[0])).toEqual(areas.map((a) => a.id));
    const estados = await estadosPorArea(db, finca.id, APLICADO);
    for (const a of areas) expect(estados.get(a.id)?.carencia.tipo).toBe('hasta');
  });

  it('sin área, sin responsable o con un insumo de otra finca no se guarda y nombra los campos', async () => {
    const { db, finca, base } = await preparar();
    const error = await guardarAplicacion(db, finca.id, [], {
      ...base,
      personaIds: [],
      insumoId: 'otro',
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDeValidacion);
    expect((error as ErrorDeValidacion).campos.map((c) => c.campo)).toEqual([
      'area_ids',
      'persona_ids',
      'insumo_id',
    ]);
    expect(await db.registro.count()).toBe(0);
  });
});
