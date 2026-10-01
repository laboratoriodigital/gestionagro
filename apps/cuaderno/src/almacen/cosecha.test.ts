/**
 * Cosecha (HU-E6.1) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeRegistro, ErrorDeValidacion } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarAplicacion } from './aplicaciones.ts';
import { type DatosCosechaGuardada, guardarCosecha, leerCategorias } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { crearPersona } from './personas.ts';

/** 10/12/2026 a las 9:30 en Bogotá. */
const APLICADO = new Date('2026-12-10T14:30:00Z');
const en = (iso: string) => () => new Date(iso);
const motivos = (e: unknown) =>
  e instanceof ErrorDeValidacion ? e.campos.map((c) => `${c.campo}: ${c.motivo}`) : [String(e)];

const ETIQUETA = {
  tipo: 'fitosanitario',
  registro_ica: null,
  ingrediente_activo: null,
  unidad: 'mL',
  reentrada_horas: 4,
  permitido_ecologico: null,
} as const;

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.map((x) => ({
        tipo: x.tipo,
        nombre: x.nombre,
        area_m2: x.area_m2,
        capacidad_plantas: null,
      })),
    );
    const [area, otra] = areas;
    if (!area || !otra) throw new Error('la finca de prueba necesita dos áreas');
    const p = f.personas[0];
    if (!p) throw new Error('sin personas');
    const persona = await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol });
    const base = {
      areaId: area.id,
      cantidad: 120.5,
      unidad: 'kg',
      categoria: 'Primera',
      descarte: 4,
      personaIds: [persona.id],
    };
    const aplicar = async (carencia: number | null, cuando = APLICADO) => {
      const insumo = await crearInsumo(db, finca.id, {
        ...ETIQUETA,
        nombre_comercial: `Producto ${carencia ?? 'sin carencia'}`,
        carencia_dias: carencia,
      });
      await guardarAplicacion(
        db,
        finca.id,
        [area.id],
        {
          insumoId: insumo.id,
          dosis: 2,
          dosisUnidad: 'cm³ por litro',
          volumenMezclaL: null,
          equipo: null,
          personaIds: [persona.id],
        },
        { ahora: () => cuando },
      );
    };
    return { db, finca, area, otra, persona, base, aplicar };
  }

  it('CA1 y CA3: cantidad, unidad, calidad del catálogo y descarte; en modo tablero', async () => {
    const { db, finca, area, persona, base } = await preparar();
    const r = await guardarCosecha(
      db,
      finca.id,
      { ...base, unidad: 'tallos' },
      { ahora: () => APLICADO },
    );
    expect(r).toMatchObject({
      tipo: 'cosecha',
      origen: 'tablero',
      area_ids: [area.id],
      persona_ids: [persona.id],
    });
    expect(r.datos as DatosCosechaGuardada).toMatchObject({
      cantidad: 120.5,
      unidad: 'tallos',
      categoria: 'Primera',
      descarte: 4,
      carenciaConfirmada: null,
    });
    await guardarCosecha(
      db,
      finca.id,
      { ...base, categoria: ' primera ', descarte: null, personaIds: [] },
      { ahora: () => APLICADO },
    );
    expect((await leerCategorias(db, finca.id)).map((c) => c.nombre)).toEqual(['Primera']);
  });

  it('el descarte no puede pasar lo cosechado; cantidad 0 no se guarda', async () => {
    const { db, finca, base } = await preparar();
    expect(
      motivos(
        await guardarCosecha(db, finca.id, { ...base, descarte: 200 }).catch((e: unknown) => e),
      ),
    ).toEqual(['descarte: no puede ser mayor que lo cosechado']);
    const cero = await guardarCosecha(db, finca.id, { ...base, cantidad: 0, descarte: null }).catch(
      (e: unknown) => e,
    );
    expect(cero).toBeInstanceOf(ErrorDeRegistro);
    expect(await db.registro.where('tipo').equals('cosecha').count()).toBe(0);
  });

  it('CA2: dentro de la carencia bloquea con el motivo y la fecha; confirmado, queda en el registro', async () => {
    const { db, finca, base, aplicar } = await preparar();
    await aplicar(3);
    const doce = en('2026-12-12T15:00:00Z');
    const error = await guardarCosecha(db, finca.id, base, { ahora: doce }).catch(
      (e: unknown) => e,
    );
    expect(motivos(error)).toEqual([
      'carencia: En carencia hasta el 13/12 por Producto 3: no se debe cosechar',
    ]);
    expect(await db.registro.where('tipo').equals('cosecha').count()).toBe(0);

    const r = await guardarCosecha(
      db,
      finca.id,
      { ...base, confirmarCarencia: true },
      { ahora: doce },
    );
    expect((r.datos as DatosCosechaGuardada).carenciaConfirmada).toEqual({
      tipo: 'hasta',
      hasta: '2026-12-13',
      insumos: ['Producto 3'],
    });
    // El 13/12 ya se puede: no hay bloqueo ni confirmación que guardar.
    const trece = await guardarCosecha(db, finca.id, base, { ahora: en('2026-12-13T15:00:00Z') });
    expect((trece.datos as DatosCosechaGuardada).carenciaConfirmada).toBeNull();
  });

  it('CA2: con carencia desconocida también bloquea; la otra área no', async () => {
    const { db, finca, base, otra, aplicar } = await preparar();
    await aplicar(null);
    const tarde = en('2027-03-01T15:00:00Z');
    expect(
      motivos(await guardarCosecha(db, finca.id, base, { ahora: tarde }).catch((e: unknown) => e)),
    ).toEqual([
      'carencia: Carencia desconocida de Producto sin carencia: no se sabe cuándo se puede cosechar',
    ]);
    const libre = await guardarCosecha(
      db,
      finca.id,
      { ...base, areaId: otra.id },
      { ahora: tarde },
    );
    expect((libre.datos as DatosCosechaGuardada).carenciaConfirmada).toBeNull();
  });

  it('corregir una cosecha se evalúa en el momento de la cosecha, no en el de la corrección', async () => {
    const { db, finca, base, aplicar } = await preparar();
    const original = await guardarCosecha(db, finca.id, base, {
      ahora: en('2026-12-14T15:00:00Z'),
    });
    await aplicar(5, new Date('2026-12-20T14:30:00Z')); // después de cosechar
    const corregida = await guardarCosecha(
      db,
      finca.id,
      { ...base, cantidad: 118 },
      { ahora: en('2026-12-21T15:00:00Z'), corrige: original },
    );
    expect(corregida.anula_id).toBe(original.id);
    expect((corregida.datos as DatosCosechaGuardada).carenciaConfirmada).toBeNull();
  });
});
