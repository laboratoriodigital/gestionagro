/**
 * Lotes de venta (HU-E6.2) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeValidacion, uuidv7 } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { armarLote, cosechasSinLote, inicialDe, leerLotes, siguienteCodigo } from './lotes.ts';

/** 27/03/2027 a las 10:00 en Bogotá. */
const HOY = () => new Date('2027-03-27T15:00:00Z');
const LUEGO = () => new Date('2027-03-27T15:05:00Z');
const motivos = (e: unknown) =>
  e instanceof ErrorDeValidacion ? e.campos.map((c) => c.motivo) : [String(e)];

describe('el código corto (CA1)', () => {
  it('inicial del cultivo sin tilde; M si hay varios o ninguno', () => {
    expect(inicialDe(['Tomate', 'tomate '])).toBe('T');
    expect(inicialDe(['Ágave'])).toBe('A');
    expect(inicialDe(['Tomate', 'Pepino'])).toBe('M');
    expect(inicialDe([null])).toBe('M');
  });

  it('el mes va en letras: 01/10 no se confunde con 0110', () => {
    expect(siguienteCodigo([], 'T', '2026-10-01')).toBe('T-01OCT-1');
    expect(siguienteCodigo([], 'T', '2027-01-10')).toBe('T-10ENE-1');
  });

  it('el consecutivo sigue al mayor visto ese día con esa inicial, aunque falten números', () => {
    expect(siguienteCodigo([], 'T', '2027-03-27')).toBe('T-27MAR-1');
    expect(
      siguienteCodigo(['T-27MAR-1', 'T-27MAR-4', 'P-27MAR-9', 'T-26MAR-7'], 'T', '2027-03-27'),
    ).toBe('T-27MAR-5');
  });
});

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.slice(0, 2).map((x) => ({
        tipo: x.tipo,
        nombre: x.nombre,
        area_m2: x.area_m2,
        capacidad_plantas: null,
      })),
    );
    const [a1, a2] = areas;
    if (!a1 || !a2) throw new Error('faltan áreas');
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora: HOY });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora: HOY });
    for (const a of [a1, a2]) {
      await iniciarCiclo(
        db,
        {
          fincaId: finca.id,
          areaId: a.id,
          cultivo: f.cultivo.nombre,
          variedad: f.cultivo.variedad,
          fechaTrasplante: '2026-12-01',
          plantas: null,
        },
        { ahora: HOY },
      );
    }
    const cosechar = (
      areaId: string,
      cantidad: number,
      descarte: number | null = null,
      unidad = f.cultivo.unidad_cosecha,
    ) =>
      guardarCosecha(
        db,
        finca.id,
        { areaId, cantidad, unidad, categoria: 'Primera', descarte, personaIds: [] },
        { ahora: HOY },
      );
    return { db, finca, a1, a2, cosechar };
  }

  it('CA1 y CA3: arma el lote con código, cantidad vendible y de qué áreas y fechas viene', async () => {
    const { db, finca, a1, a2, cosechar } = await preparar();
    const c1 = await cosechar(a1.id, 30, 2);
    const c2 = await cosechar(a2.id, 12.5);
    await armarLote(db, finca.id, [c1.id, c2.id], { ahora: HOY });
    const [lote] = await leerLotes(db, finca.id);
    const inicial = f.cultivo.nombre.normalize('NFD')[0]?.toUpperCase();
    expect(lote).toMatchObject({
      codigo: `${inicial}-27MAR-1`,
      cantidad: 40.5,
      unidad: f.cultivo.unidad_cosecha,
      avisos: [],
    });
    expect(lote?.origen).toEqual([
      { area: a1.nombre, fechas: ['2027-03-27'] },
      { area: a2.nombre, fechas: ['2027-03-27'] },
    ]);
    expect(lote?.registro.area_ids.sort()).toEqual([a1.id, a2.id].sort());
    expect(await db.outbox.get(lote?.registro.id ?? '')).toBeDefined(); // sube como cualquier registro
    expect(await cosechasSinLote(db, finca.id)).toEqual([]);
    // El segundo lote del día sigue el consecutivo.
    const c3 = await cosechar(a1.id, 5);
    await armarLote(db, finca.id, [c3.id], { ahora: LUEGO });
    expect((await leerLotes(db, finca.id)).map((l) => l.codigo)).toEqual([
      `${inicial}-27MAR-2`,
      `${inicial}-27MAR-1`,
    ]);
  });

  it('CA2: una cosecha que ya está en un lote no entra en otro, y lo dice', async () => {
    const { db, finca, a1, cosechar } = await preparar();
    const c1 = await cosechar(a1.id, 30);
    const c2 = await cosechar(a1.id, 10);
    const primero = await armarLote(db, finca.id, [c1.id], { ahora: HOY });
    const codigo = (primero.datos as { codigo: string }).codigo;
    const intento = armarLote(db, finca.id, [c1.id, c2.id], { ahora: HOY });
    await expect(intento).rejects.toThrow(ErrorDeValidacion);
    expect(motivos(await intento.catch((e: unknown) => e))).toEqual([
      `la cosecha de ${a1.nombre} del 27/03 ya está en el lote ${codigo}`,
    ]);
    expect(await leerLotes(db, finca.id)).toHaveLength(1);
  });

  it('no mezcla unidades ni arma un lote vacío o de puro descarte', async () => {
    const { db, finca, a1, a2, cosechar } = await preparar();
    const kg = await cosechar(a1.id, 10, null, 'kg');
    const cajas = await cosechar(a2.id, 3, null, 'cajas');
    expect(
      motivos(await armarLote(db, finca.id, [kg.id, cajas.id]).catch((e: unknown) => e)),
    ).toEqual(['no se mezclan unidades en un lote (kg y cajas)']);
    expect(motivos(await armarLote(db, finca.id, []).catch((e: unknown) => e))).toEqual([
      'elige al menos una cosecha',
    ]);
    const descarte = await cosechar(a1.id, 4, 4, 'kg');
    expect(motivos(await armarLote(db, finca.id, [descarte.id]).catch((e: unknown) => e))).toEqual([
      'todo lo elegido fue descarte; no queda nada para vender',
    ]);
    expect((await cosechasSinLote(db, finca.id)).map((c) => c.id)).not.toContain(descarte.id);
  });

  it('corregir un lote conserva el código y libera las cosechas que salen', async () => {
    const { db, finca, a1, cosechar } = await preparar();
    const c1 = await cosechar(a1.id, 30);
    const c2 = await cosechar(a1.id, 10);
    const lote = await armarLote(db, finca.id, [c1.id, c2.id], { ahora: HOY });
    await armarLote(db, finca.id, [c1.id], { ahora: HOY, corrige: lote });
    const lotes = await leerLotes(db, finca.id);
    expect(lotes).toHaveLength(1);
    expect(lotes[0]).toMatchObject({
      codigo: (lote.datos as { codigo: string }).codigo,
      cantidad: 30,
    });
    expect((await cosechasSinLote(db, finca.id)).map((c) => c.id)).toEqual([c2.id]);
  });

  it('dos teléfonos sin señal: el mismo código o la misma cosecha en dos lotes se ven y se avisan', async () => {
    const { db, finca, a1, cosechar } = await preparar();
    const c1 = await cosechar(a1.id, 30);
    const c2 = await cosechar(a1.id, 10);
    const primero = await armarLote(db, finca.id, [c1.id], { ahora: HOY });
    // Lo que bajó de otro teléfono que no veía el primero: mismo código y la misma cosecha.
    await db.registro.add({
      ...primero,
      id: uuidv7(() => LUEGO().getTime()),
      dispositivo_id: 'otro-telefono',
      datos: { ...(primero.datos as object), cosecha_ids: [c1.id, c2.id], cantidad: 40 },
    });
    const [nuevo, viejo] = await leerLotes(db, finca.id);
    const codigo = (primero.datos as { codigo: string }).codigo;
    expect(viejo).toMatchObject({ codigo, avisos: [] });
    expect(nuevo?.codigo).toBe(`${codigo}B`);
    expect(nuevo?.avisos).toEqual([
      `Otro teléfono armó sin señal un lote con el código ${codigo}. Este se llama ${codigo}B para no confundirlos.`,
      `La cosecha de ${a1.nombre} del 27/03 también está en el lote ${codigo}, que se armó antes. Corrige este lote.`,
    ]);
  });
});
