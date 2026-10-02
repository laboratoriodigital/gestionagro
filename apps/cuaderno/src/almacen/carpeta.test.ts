/**
 * Carpeta de cumplimiento (HU-E9.2) sobre fake-indexeddb, con las dos fincas de prueba (P4): las
 * secciones, el periodo, los anulados marcados, los caracteres que la fuente del PDF no escribe y
 * el tiempo con 6 meses de registros (CA3).
 */
import { type Registro, uuidv7 } from '@gestionagro/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarAplicacion } from './aplicaciones.ts';
import { armarCarpeta, TIPOS_DE_LA_CARPETA } from './carpeta.ts';
import { apto, pdfDeCarpeta, renglones } from './carpeta-pdf.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { registrarDespacho } from './despachos.ts';
import { crearFincaConAreas } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { armarLote } from './lotes.ts';
import { guardarMonitoreo } from './monitoreo.ts';
import { crearPersona } from './personas.ts';

const el = (fecha: string) => () => new Date(`${fecha}T15:00:00Z`);
const PERIODO = { desde: '2026-09-01', hasta: '2026-09-30' };

describe('texto que la fuente del PDF puede escribir', () => {
  it('conserva tildes, eñes y signos latinos; cambia lo demás por «?»', () => {
    expect(apto('Señor Núñez · 30 °C — ¿sí?')).toBe('Señor Núñez · 30 °C — ¿sí?');
    expect(apto('Trampa llena 🐛')).toBe('Trampa llena ?');
    expect(apto('−5')).toBe('-5');
    expect(apto('línea 1\nlínea 2')).toBe('línea 1 línea 2');
  });

  it('parte en renglones que caben, y una palabra larguísima también', async () => {
    const fuente = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    const lineas = renglones(`Producto ${'A'.repeat(80)} final`, fuente, 60);
    expect(lineas.length).toBeGreaterThan(3);
    for (const l of lineas) expect(fuente.widthOfTextAtSize(l, 7)).toBeLessThanOrEqual(60);
    expect(lineas.join('').replace(/ /g, '')).toBe(`Producto${'A'.repeat(80)}final`);
  });
});

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
      carencia_dias: 1,
      reentrada_horas: 4,
      permitido_ecologico: null,
      nombre_comercial: 'Producto Ensayo',
    });
    const persona = await crearPersona(db, finca.id, { nombre: 'Persona Ensayo', rol: 'operario' });
    const aplicar = (fecha: string, dosis = 2, corrige?: Registro) =>
      guardarAplicacion(
        db,
        finca.id,
        [nave.id],
        {
          insumoId: insumo.id,
          dosis,
          dosisUnidad: 'mL/L',
          volumenMezclaL: 20,
          equipo: null,
          personaIds: [persona.id],
        },
        { ahora: el(fecha), corrige },
      );
    return { db, finca, nave, aplicar };
  }

  it('CA1: secciones por tipo, solo el periodo, y el anulado marcado junto a su corrección', async () => {
    const { db, finca, nave, aplicar } = await preparar();
    const [vieja] = await aplicar('2026-09-05');
    await aplicar('2026-09-06', 3, vieja); // corrige la del 5
    await aplicar('2026-08-20'); // fuera del periodo
    await guardarMonitoreo(
      db,
      finca.id,
      {
        areaId: nave.id,
        plaga: 'Mosca blanca',
        clase: 'plaga',
        metodo: 'trampa',
        nivel: 'medio',
        cantidad: 12,
        nota: 'Trampa llena 🐛',
        foto: null,
      },
      { ahora: el('2026-09-10') },
    );
    const cosecha = await guardarCosecha(
      db,
      finca.id,
      {
        areaId: nave.id,
        cantidad: 40,
        unidad: 'kg',
        categoria: 'Primera',
        descarte: null,
        personaIds: [],
      },
      { ahora: el('2026-09-12') },
    );
    const lote = await armarLote(db, finca.id, [cosecha.id], { ahora: el('2026-09-12') });
    await registrarDespacho(
      db,
      finca.id,
      {
        cliente: { nombre: 'Cliente Ensayo', tipo: 'restaurante' },
        lineas: [{ loteId: lote.id, cantidad: 10 }],
        precioUnitario: 3000,
        medioPago: 'efectivo',
      },
      { ahora: el('2026-09-13') },
    );

    const c = await armarCarpeta(db, finca.id, PERIODO);
    expect(c).toMatchObject({ finca: f.finca.nombre, desde: '2026-09-01', hasta: '2026-09-30' });
    expect(c.secciones.map((s) => [s.titulo, s.filas.length])).toEqual([
      ['Aplicaciones', 2],
      ['Riegos', 0],
      ['Monitoreo de plagas y enfermedades', 1],
      ['Cosechas', 1],
      ['Lotes de venta', 1],
      ['Despachos', 1],
    ]);
    const aplicaciones = c.secciones[0];
    const estado = aplicaciones?.columnas.indexOf('Estado') ?? -1;
    expect(aplicaciones?.filas.map((x) => [x.anulado, x.celdas[estado]])).toEqual([
      [true, 'anulado'],
      [false, 'vigente'],
    ]);
    expect(aplicaciones?.nota).toContain('Nada se borra');
    expect(c.secciones[5]?.filas[0]?.celdas).toContain('Cliente Ensayo');

    // El PDF se arma aunque una nota traiga un emoji, y dice que no certifica ninguna norma.
    const bytes = await pdfDeCarpeta(c, 'carta', '02/10/2026 09:00');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(pdf.getTitle()).toBe(`Registros de ${f.finca.nombre}`);
  });

  it('CA3: 6 meses de registros se arman en poco tiempo (referencia para gama baja)', async () => {
    const { db, finca, nave } = await preparar();
    // Seis meses: 2 riegos, 1 aplicación y 1 cosecha al día, escritos de una vez.
    const registros: Registro[] = [];
    for (let dia = 0; dia < 182; dia++) {
      const fecha = new Date(Date.UTC(2026, 3, 1 + dia, 15)).toISOString();
      const base = {
        org_id: null,
        finca_id: finca.id,
        area_ids: [nave.id],
        ciclo_id: null,
        v: 1,
        fecha_agronomica: fecha.slice(0, 10),
        instante_evento: fecha,
        autor_usuario_id: null,
        persona_ids: [],
        dispositivo_id: 'telefono-prueba',
        origen: 'manual' as const,
        anula_id: null,
      };
      for (let k = 0; k < 2; k++) {
        registros.push({
          ...base,
          id: uuidv7(() => Date.parse(fecha) + k),
          tipo: 'riego',
          v: 2,
          datos: {
            unidad: 'L_area',
            volumenAplicado: 120,
            duracionMin: 30,
            volumenDrenado: 30,
            drenajePct: 25,
            ceEntradaDsM: 2.1,
            phEntrada: 6.2,
            ceDrenajeDsM: 2.8,
            phDrenaje: 6.5,
          },
        });
      }
      registros.push({
        ...base,
        id: uuidv7(() => Date.parse(fecha) + 5),
        tipo: 'aplicacion',
        v: 2,
        datos: {
          insumo_id: 'x',
          insumo: 'Producto Ensayo con un nombre comercial largo',
          dosis: 2,
          dosisUnidad: 'mL/L',
          volumenMezclaL: 20,
          equipo: 'Bomba de espalda',
          carenciaDias: 3,
          reentradaHoras: 12,
          cantidadUsada: null,
        },
      });
      registros.push({
        ...base,
        id: uuidv7(() => Date.parse(fecha) + 7),
        tipo: 'cosecha',
        v: 2,
        datos: {
          cantidad: 85.5,
          unidad: 'kg',
          categoria_id: 'y',
          categoria: 'Primera',
          descarte: 4,
          horasPorPersona: null,
          carenciaConfirmada: null,
        },
      });
    }
    await db.registro.bulkAdd(registros);
    const inicio = performance.now();
    const c = await armarCarpeta(db, finca.id, { desde: '2026-04-01', hasta: '2026-09-29' });
    const pdf = await PDFDocument.load(await pdfDeCarpeta(c, 'a4', '02/10/2026 09:00'));
    const ms = performance.now() - inicio;
    expect(c.secciones.find((s) => s.titulo === 'Riegos')?.filas).toHaveLength(364);
    expect(pdf.getPageCount()).toBeGreaterThan(10);
    // En un computador de desarrollo; un teléfono de gama baja es unas 4 veces más lento: < 10 s.
    expect(ms).toBeLessThan(2_500);
  });
});

describe('la carpeta trae las secciones de la auditoría', () => {
  it('aplicaciones, riegos, monitoreo y cosechas, y después la trazabilidad', () => {
    expect(TIPOS_DE_LA_CARPETA.map((t) => t.tipo)).toEqual([
      'aplicacion',
      'riego',
      'monitoreo',
      'cosecha',
    ]);
  });
});
