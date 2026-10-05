/**
 * Historial y corrección sin borrar (HU-E3.12) sobre fake-indexeddb, con las dos fincas (P4).
 */
import { ErrorDeRegistro, type Registro, uuidv7 } from '@ed1/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { estadosPorArea, guardarAplicacion } from './aplicaciones.ts';
import { agregarCultivo, agregarVariedad, cerrarCiclo, iniciarCiclo } from './ciclos.ts';
import { guardarClima } from './clima.ts';
import { historial, ultimosRegistros } from './consultas.ts';
import { abrirCuaderno } from './db.ts';
import { crearFincaConAreas } from './finca.ts';
import { guardarRegistro } from './guardar.ts';
import { crearInsumo } from './insumos.ts';
import { guardarLabor, horasDelDia } from './labores.ts';
import { crearPersona } from './personas.ts';
import { guardarRiego } from './riego.ts';

const DIA = new Date('2026-12-10T14:30:00Z');
const despues = (min: number) => () => new Date(DIA.getTime() + min * 60_000);
const CLIMA = { temperaturaC: 24, humedadRelativaPct: 70, temperaturaHojaC: null };
const RIEGO = {
  unidad: 'mL_gotero',
  volumenAplicado: 500,
  duracionMin: 10,
  volumenDrenado: 150,
  ceEntradaDsM: null,
  phEntrada: null,
  ceDrenajeDsM: null,
  phDrenaje: null,
} as const;
const campos = (e: unknown) =>
  e instanceof ErrorDeRegistro ? e.campos.map((c) => c.motivo) : [`(otro: ${String(e)})`];

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
    const [a, b] = areas;
    if (!a || !b) throw new Error('la finca de prueba necesita dos áreas');
    return { db, finca, a, b };
  }

  it('CA2: corregir escribe otro registro con anula_id; el vigente reemplaza al anterior y conserva el evento', async () => {
    const { db, finca, a } = await preparar();
    const original = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: () => DIA });
    const corregido = await guardarClima(
      db,
      finca.id,
      'otra-area-ignorada',
      { ...CLIMA, temperaturaC: 26 },
      { ahora: despues(60 * 48), corrige: original },
    );
    expect(corregido).toMatchObject({
      anula_id: original.id,
      area_ids: [a.id],
      fecha_agronomica: original.fecha_agronomica,
      instante_evento: original.instante_evento,
    });
    expect(corregido.id).not.toBe(original.id);
    // Nada se borró: los dos siguen guardados, y los dos van a la cola de salida.
    expect(await db.registro.count()).toBe(2);
    expect(await db.outbox.filter((o) => o.entidad === 'registro').count()).toBe(2);
    expect((await ultimosRegistros(db, finca.id, ['clima'])).map((r) => r.id)).toEqual([
      corregido.id,
    ]);
    const [entrada, ...resto] = await historial(db, finca.id, {
      desde: '2026-12-01',
      hasta: '2026-12-31',
    });
    expect(resto).toEqual([]);
    expect(entrada?.registro.id).toBe(corregido.id);
    expect(entrada?.anteriores.map((r) => r.id)).toEqual([original.id]);
  });

  it('CA2: una cadena de correcciones; corregir otra vez una versión ya corregida se rechaza', async () => {
    const { db, finca, a } = await preparar();
    const v1 = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: () => DIA });
    const v2 = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: despues(1), corrige: v1 });
    const error = await guardarClima(db, finca.id, a.id, CLIMA, {
      ahora: despues(2),
      corrige: v1,
    }).catch((e: unknown) => e);
    expect(campos(error)).toEqual(['ese registro ya se corrigió; corrige la versión vigente']);
    const v3 = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: despues(3), corrige: v2 });
    const [entrada] = await historial(db, finca.id, { desde: '2026-12-10', hasta: '2026-12-10' });
    expect(entrada?.registro.id).toBe(v3.id);
    expect(entrada?.anteriores.map((r) => r.id)).toEqual([v2.id, v1.id]);
  });

  it('una corrección de otro tipo o que apunta a un registro inexistente se rechaza', async () => {
    const { db, finca, a } = await preparar();
    const clima = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: () => DIA });
    const [riego] = await guardarRiego(db, finca.id, [a.id], RIEGO, { ahora: () => DIA });
    if (!riego) throw new Error('sin riego');
    const comoRiego: Registro = { ...riego, id: uuidv7(), anula_id: clima.id };
    expect(campos(await guardarRegistro(db, comoRiego).catch((e: unknown) => e))).toEqual([
      'una corrección debe ser del mismo tipo y la misma finca',
    ]);
    const huerfana: Registro = { ...riego, id: uuidv7(), anula_id: uuidv7() };
    expect(campos(await guardarRegistro(db, huerfana).catch((e: unknown) => e))).toEqual([
      'el registro que se corrige no existe en este teléfono',
    ]);
  });

  it('corregir un riego queda en su única área aunque el original se guardó en varias a la vez', async () => {
    const { db, finca, a, b } = await preparar();
    const [ra] = await guardarRiego(db, finca.id, [a.id, b.id], RIEGO, { ahora: () => DIA });
    if (!ra) throw new Error('sin riego');
    const corregidos = await guardarRiego(
      db,
      finca.id,
      [a.id, b.id],
      { ...RIEGO, volumenAplicado: 600 },
      { ahora: despues(5), corrige: ra },
    );
    expect(corregidos.map((r) => r.area_ids)).toEqual([[a.id]]);
    const vigentes = await ultimosRegistros(db, finca.id, ['riego']);
    expect(vigentes).toHaveLength(2);
  });

  it('corregir las horas de una labor no las suma dos veces ni dispara el aviso de 12 h', async () => {
    const { db, finca, a } = await preparar();
    const p = f.personas[0];
    if (!p) throw new Error('sin personas');
    const persona = await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol });
    const datos = { areaId: a.id, labor: 'Deshoje', personaIds: [persona.id], horasPorPersona: 8 };
    const original = await guardarLabor(db, finca.id, datos, { ahora: () => DIA });
    await guardarLabor(
      db,
      finca.id,
      { ...datos, horasPorPersona: 10 },
      { ahora: despues(60), corrige: original },
    );
    expect(await horasDelDia(db, finca.id, persona.id, '2026-12-10')).toBe(10);
  });

  it('corregir una aplicación: los vencimientos usan solo la vigente', async () => {
    const { db, finca, a } = await preparar();
    const p = f.personas[0];
    if (!p) throw new Error('sin personas');
    const persona = await crearPersona(db, finca.id, { nombre: p.nombre, rol: p.rol });
    const etiqueta = {
      tipo: 'fitosanitario',
      registro_ica: null,
      ingrediente_activo: null,
      unidad: 'mL',
      reentrada_horas: 4,
      permitido_ecologico: null,
    } as const;
    const diez = await crearInsumo(db, finca.id, {
      ...etiqueta,
      nombre_comercial: 'Producto Diez Días',
      carencia_dias: 10,
    });
    const tres = await crearInsumo(db, finca.id, {
      ...etiqueta,
      nombre_comercial: 'Producto Tres Días',
      carencia_dias: 3,
    });
    const datos = {
      insumoId: diez.id,
      dosis: 2,
      dosisUnidad: 'cm³ por litro',
      volumenMezclaL: null,
      equipo: null,
      personaIds: [persona.id],
    };
    const [mal] = await guardarAplicacion(db, finca.id, [a.id], datos, { ahora: () => DIA });
    await guardarAplicacion(
      db,
      finca.id,
      [a.id],
      { ...datos, insumoId: tres.id },
      { ahora: despues(10), corrige: mal },
    );
    expect((await estadosPorArea(db, finca.id, DIA)).get(a.id)?.carencia).toMatchObject({
      fecha: '2026-12-13',
      insumo: 'Producto Tres Días',
    });
  });

  it('corregir un registro de un ciclo ya cerrado no pide confirmación: es su traza', async () => {
    const { db, finca, a } = await preparar();
    const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora: () => DIA });
    await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora: () => DIA });
    const ciclo = await iniciarCiclo(
      db,
      {
        fincaId: finca.id,
        areaId: a.id,
        cultivo: f.cultivo.nombre,
        variedad: f.cultivo.variedad,
        fechaTrasplante: '2026-10-15',
        plantas: null,
      },
      { ahora: () => DIA },
    );
    const original = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: () => DIA });
    expect(original.ciclo_id).toBe(ciclo.id);
    await cerrarCiclo(db, ciclo.id, '2026-12-11', true, { ahora: despues(60 * 24) });
    const corregido = await guardarClima(db, finca.id, a.id, CLIMA, {
      ahora: despues(60 * 25),
      corrige: original,
    });
    expect(corregido.ciclo_id).toBe(ciclo.id);
  });

  it('CA1: el historial filtra por área, tipo y rango de fechas (ambas incluidas)', async () => {
    const { db, finca, a, b } = await preparar();
    const en = (iso: string) => () => new Date(iso);
    const ca = await guardarClima(db, finca.id, a.id, CLIMA, { ahora: en('2026-12-01T15:00:00Z') });
    const cb = await guardarClima(db, finca.id, b.id, CLIMA, { ahora: en('2026-12-05T15:00:00Z') });
    const [ra] = await guardarRiego(db, finca.id, [a.id], RIEGO, {
      ahora: en('2026-12-05T16:00:00Z'),
    });
    // 31/12 a las 21:00 en Bogotá ya es 1/1 en UTC: cuenta el 31 (P8).
    const tarde = await guardarClima(db, finca.id, a.id, CLIMA, {
      ahora: en('2027-01-01T02:00:00Z'),
    });
    const ids = async (filtro: Parameters<typeof historial>[2]) =>
      (await historial(db, finca.id, filtro)).map((e) => e.registro.id);
    expect(await ids({ desde: '2026-12-01', hasta: '2026-12-31' })).toEqual([
      tarde.id,
      ra?.id,
      cb.id,
      ca.id,
    ]);
    expect(await ids({ desde: '2026-12-02', hasta: '2026-12-05' })).toEqual([ra?.id, cb.id]);
    expect(await ids({ desde: '2026-12-01', hasta: '2026-12-31', areaId: a.id })).toEqual([
      tarde.id,
      ra?.id,
      ca.id,
    ]);
    expect(await ids({ desde: '2026-12-01', hasta: '2026-12-31', tipo: 'riego' })).toEqual([
      ra?.id,
    ]);
  });
});
