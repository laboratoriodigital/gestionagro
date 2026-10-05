/**
 * Exportar e importar (HU-E3.13) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 *
 * Lo que fake-indexeddb NO imita (P17): un teléfono sin espacio a mitad de la importación. La
 * falla a mitad se inyecta con un hook de Dexie.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type AgroExportV1, hashDeFilas, TABLAS_EXPORTADAS } from '@ed1/agro-schema';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../../../../tests/fixtures/fincas.ts';
import { guardarAplicacion } from './aplicaciones.ts';
import { agregarCultivo, agregarVariedad, iniciarCiclo } from './ciclos.ts';
import { guardarClima } from './clima.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno, type CuadernoDb } from './db.ts';
import { crearFincaConAreas, editarArea } from './finca.ts';
import { crearInsumo } from './insumos.ts';
import { guardarLabor } from './labores.ts';
import { crearPersona, definirJornal, editarPersona } from './personas.ts';
import {
  analizarArchivo,
  csvDeTipo,
  ErrorDeImportacion,
  exportarTodo,
  importar,
} from './respaldo.ts';
import { guardarRiego } from './riego.ts';

const RAIZ = join(import.meta.dirname, '..', '..', '..', '..');
const DIA = new Date('2026-12-10T15:00:00Z');
const ahora = () => DIA;
const vacia = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });

/** Un cuaderno con todo: catálogos, historial de versiones y los cuatro tipos de registro. */
async function cuadernoLleno(f: FincaDePrueba) {
  const db = vacia();
  const { finca, areas } = await crearFincaConAreas(
    db,
    { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
    f.areas.map((x) => ({
      tipo: x.tipo,
      nombre: x.nombre,
      area_m2: x.area_m2,
      capacidad_plantas: null,
    })),
    { ahora },
  );
  const [a] = areas;
  if (!a) throw new Error('sin áreas');
  await editarArea(db, a.id, { area_m2: a.area_m2 + 10 }, { ahora }); // deja historial
  const personas = [];
  for (const p of f.personas) personas.push(await crearPersona(db, finca.id, p, { ahora }));
  const [p0] = personas;
  if (!p0) throw new Error('sin personas');
  await definirJornal(db, p0.id, 60_000, '2026-12-01', { ahora });
  const insumos = [];
  for (const i of f.insumos) insumos.push(await crearInsumo(db, finca.id, i, { ahora }));
  const cultivo = await agregarCultivo(db, finca.id, f.cultivo.nombre, { ahora });
  await agregarVariedad(db, cultivo.id, f.cultivo.variedad, { ahora });
  await iniciarCiclo(
    db,
    {
      fincaId: finca.id,
      areaId: a.id,
      cultivo: f.cultivo.nombre,
      variedad: f.cultivo.variedad,
      fechaTrasplante: '2026-10-15',
      plantas: null,
    },
    { ahora },
  );
  const clima = await guardarClima(
    db,
    finca.id,
    a.id,
    { temperaturaC: 24.5, humedadRelativaPct: 70, temperaturaHojaC: null },
    { ahora },
  );
  await guardarClima(
    db,
    finca.id,
    a.id,
    { temperaturaC: 25, humedadRelativaPct: 70, temperaturaHojaC: null },
    { ahora: () => new Date(DIA.getTime() + 60_000), corrige: clima },
  );
  await guardarRiego(
    db,
    finca.id,
    areas.map((x) => x.id),
    {
      unidad: 'mL_gotero',
      volumenAplicado: 500,
      duracionMin: 12.5,
      volumenDrenado: null,
      ceEntradaDsM: 2.1,
      phEntrada: null,
      ceDrenajeDsM: null,
      phDrenaje: null,
    },
    { ahora },
  );
  await guardarLabor(
    db,
    finca.id,
    { areaId: a.id, labor: 'Deshoje', personaIds: [p0.id], horasPorPersona: 1.5 },
    { ahora },
  );
  const [i0] = insumos;
  if (!i0) throw new Error('sin insumos');
  await guardarAplicacion(
    db,
    finca.id,
    [a.id],
    {
      insumoId: i0.id,
      dosis: 2,
      dosisUnidad: 'cm³; por litro', // con «;», que en CSV va entre comillas
      volumenMezclaL: 20,
      equipo: '=bomba', // una «fórmula» que Excel no debe ejecutar
      personaIds: [p0.id],
    },
    { ahora },
  );
  const [, b] = areas;
  await guardarCosecha(
    db,
    finca.id,
    {
      areaId: b?.id ?? a.id,
      cantidad: 120.5,
      unidad: 'kg',
      categoria: 'Primera',
      descarte: null,
      personaIds: [p0.id],
    },
    { ahora },
  );
  return { db, finca, areas, personas };
}

const conteos = async (db: CuadernoDb) =>
  Object.fromEntries(
    await Promise.all(TABLAS_EXPORTADAS.map(async (t) => [t, await db.table(t).count()] as const)),
  );

const motivos = async (p: Promise<unknown>) => {
  const e = await p.catch((x: unknown) => x);
  return e instanceof ErrorDeImportacion ? e.motivos : [`(otro: ${String(e)})`];
};

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  it('CA1: exporta todas las tablas con recuento y huella; el archivo cumple schemas/agro-export.schema.json', async () => {
    const { db, finca } = await cuadernoLleno(f);
    const archivo = await exportarTodo(db, { app: '0.1.0', ahora });
    expect(archivo).toMatchObject({ formato: 'agro-export', version: 1, finca_id: finca.id });
    expect(Object.keys(archivo.tablas)).toEqual(TABLAS_EXPORTADAS);
    expect(archivo.tablas).not.toHaveProperty('outbox');
    for (const t of TABLAS_EXPORTADAS) {
      expect(archivo.tablas[t].recuento, t).toBe(await db.table(t).count());
      expect(archivo.tablas[t].recuento, `${t} no debería estar vacía`).toBeGreaterThan(0);
    }
    const esquema = JSON.parse(
      readFileSync(join(RAIZ, 'schemas', 'agro-export.schema.json'), 'utf8'),
    );
    const validar = new Ajv2020({ allErrors: true, strict: false }).compile(esquema);
    // Se valida lo que de verdad se escribe en el archivo: el texto JSON, no el objeto.
    expect(validar(JSON.parse(JSON.stringify(archivo))), JSON.stringify(validar.errors)).toBe(true);
  });

  it('CA3: exportar e importar en otro teléfono vacío da los mismos recuentos y huellas', async () => {
    const origen = await cuadernoLleno(f);
    const texto = JSON.stringify(await exportarTodo(origen.db, { app: '0.1.0', ahora }));
    const destino = vacia();
    const resumen = await analizarArchivo(destino, texto);
    expect(Object.values(resumen.tablas).every((t) => t.existentes === 0)).toBe(true);
    await importar(destino, resumen);
    const otra = await exportarTodo(destino, { app: '0.1.0', ahora });
    const a = JSON.parse(texto) as AgroExportV1;
    for (const t of TABLAS_EXPORTADAS) {
      expect(otra.tablas[t].recuento, t).toBe(a.tablas[t].recuento);
      expect(otra.tablas[t].hash, t).toBe(a.tablas[t].hash);
    }
    expect(await destino.outbox.count()).toBe(0);
  });

  it('la huella no depende del orden de las filas: un archivo reordenado por otra herramienta sigue valiendo', async () => {
    const origen = await cuadernoLleno(f);
    const archivo = await exportarTodo(origen.db, { app: '0.1.0', ahora });
    for (const t of TABLAS_EXPORTADAS) archivo.tablas[t].filas.reverse();
    const resumen = await analizarArchivo(vacia(), JSON.stringify(archivo));
    expect(resumen.tablas.registro.nuevas).toBe(archivo.tablas.registro.recuento);
  });

  it('CA2: importar une: agrega lo que falta y no reemplaza lo que ya está; repetir no duplica', async () => {
    const origen = await cuadernoLleno(f);
    const primero = JSON.stringify(await exportarTodo(origen.db, { app: '0.1.0', ahora }));
    const destino = vacia();
    await importar(destino, await analizarArchivo(destino, primero));
    // En el destino se renombra una persona; en el origen se registra algo nuevo.
    const p0 = origen.personas[0];
    if (!p0) throw new Error('sin personas');
    await editarPersona(destino, p0.id, { nombre: 'Nombre cambiado aquí' }, { ahora });
    const nuevo = await guardarClima(
      origen.db,
      origen.finca.id,
      origen.areas[0]?.id ?? '',
      { temperaturaC: 22, humedadRelativaPct: 80, temperaturaHojaC: null },
      { ahora: () => new Date(DIA.getTime() + 3_600_000) },
    );
    const segundo = JSON.stringify(await exportarTodo(origen.db, { app: '0.1.0', ahora }));
    const resumen = await analizarArchivo(destino, segundo);
    expect(resumen.tablas.registro.nuevas).toBe(1);
    expect(resumen.tablas.persona.nuevas).toBe(0);
    const agregadas = await importar(destino, resumen);
    expect(agregadas.registro).toBe(1);
    expect(await destino.registro.get(nuevo.id)).toBeDefined();
    expect((await destino.persona.get(p0.id))?.nombre).toBe('Nombre cambiado aquí');
    const antes = await conteos(destino);
    await importar(destino, await analizarArchivo(destino, segundo));
    expect(await conteos(destino)).toEqual(antes);
  });

  it('P21: un archivo cortado, editado o de otra finca no escribe nada y dice por qué', async () => {
    const origen = await cuadernoLleno(f);
    const archivo = await exportarTodo(origen.db, { app: '0.1.0', ahora });
    const texto = JSON.stringify(archivo);
    const destino = vacia();
    expect(await motivos(analizarArchivo(destino, texto.slice(0, texto.length / 2)))).toEqual([
      'el archivo no es JSON válido; puede estar cortado',
    ]);
    expect(await motivos(analizarArchivo(destino, '{"formato":"otra-cosa"}'))).toEqual([
      'no es un respaldo del cuaderno (agro-export)',
    ]);

    const editado = structuredClone(archivo);
    const r0 = editado.tablas.registro.filas.find((r) => r.tipo === 'clima') as {
      datos: Record<string, unknown>;
    };
    // Un valor válido pero distinto: solo la huella lo delata.
    r0.datos = { ...r0.datos, temperaturaC: 30 };
    expect(await motivos(analizarArchivo(destino, JSON.stringify(editado)))).toEqual([
      'la tabla registro no coincide con su huella: el archivo se modificó o se dañó',
    ]);

    const sinUna = structuredClone(archivo);
    sinUna.tablas.area.filas.pop();
    expect(await motivos(analizarArchivo(destino, JSON.stringify(sinUna)))).toEqual([
      `la tabla area dice ${archivo.tablas.area.recuento} filas y trae ${archivo.tablas.area.recuento - 1}`,
    ]);

    // Huella recalculada, pero el dato no cumple su esquema: lo atrapa la validación del tipo.
    const invalido = structuredClone(archivo);
    const clima = invalido.tablas.registro.filas.find((r) => r.tipo === 'clima') as {
      datos: Record<string, unknown>;
    };
    clima.datos = { ...clima.datos, temperaturaC: 'veinte' };
    invalido.tablas.registro.hash = await hashDeFilas(invalido.tablas.registro.filas);
    const m = await motivos(analizarArchivo(destino, JSON.stringify(invalido)));
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/^registro \d+: «datos\.temperaturaC»/);

    const otra = await cuadernoLleno(f);
    expect(await motivos(analizarArchivo(otra.db, texto))).toEqual([
      `el respaldo es de otra finca, aunque también se llama «${f.finca.nombre}». Para no mezclarlas, ábrelo en un cuaderno vacío: otro navegador o una ventana de incógnito`,
    ]);
    expect(Object.values(await conteos(destino)).every((n) => n === 0)).toBe(true);
  });

  it('P21: si la escritura falla a mitad, no queda nada a medias', async () => {
    const origen = await cuadernoLleno(f);
    const texto = JSON.stringify(await exportarTodo(origen.db, { app: '0.1.0', ahora }));
    const destino = vacia();
    const resumen = await analizarArchivo(destino, texto);
    // Las tablas de catálogo ya se escribieron cuando llega la de registros, y ahí falla.
    destino.registro.hook('creating', () => {
      throw new Error('Disco lleno (inyectado)');
    });
    await expect(importar(destino, resumen)).rejects.toThrow();
    expect(Object.values(await conteos(destino)).every((n) => n === 0)).toBe(true);
  });

  it('CA4: el CSV abre en Excel en español: BOM, «;», coma decimal, comillas y sin fórmulas', async () => {
    const { db, finca } = await cuadernoLleno(f);
    const clima = await csvDeTipo(db, finca.id, 'clima');
    expect(clima.startsWith('﻿Fecha;Hora;Área;Ciclo;Estado;Temperatura (°C);')).toBe(true);
    expect(clima.endsWith('\r\n')).toBe(true);
    const filas = clima.slice(1).trim().split('\r\n');
    expect(filas).toHaveLength(3);
    expect(filas[1]).toMatch(/^10\/12\/2026;10:00;[^;]+;[^;]+;anulado;24,5;70;;/);
    expect(filas[2]).toMatch(/;vigente;25;70;;/);
    const cosecha = await csvDeTipo(db, finca.id, 'cosecha');
    expect(cosecha).toContain(';vigente;120,5;kg;Primera;;;');
    const riego = await csvDeTipo(db, finca.id, 'riego');
    expect(riego).toContain(';mL por gotero;500;12,5;;;2,1;;;');
    const aplicacion = await csvDeTipo(db, finca.id, 'aplicacion');
    expect(aplicacion).toContain(';2;"cm³; por litro";20;\'=bomba;');
  });
});
