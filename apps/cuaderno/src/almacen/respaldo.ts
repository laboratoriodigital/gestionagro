/**
 * Exportar e importar todo el cuaderno (HU-E3.13).
 *
 * - Exporta en `agro-export` v1 (JSON con recuento y SHA-256 por tabla) y en CSV por tipo de
 *   registro para Excel en español (CA1, CA4).
 * - Importar **une**: agrega lo que falta por id y no reemplaza nada (CA2). El archivo entero se
 *   revisa antes de escribir; la escritura es una sola transacción: un archivo cortado o una falla
 *   a mitad no dejan la base a medias (P21).
 * - La cola de salida y los datos propios del teléfono (`meta`) no viajan: son de cada teléfono.
 *   Lo importado no entra a la cola: ya salió del teléfono que lo registró (E5 decide la subida).
 */
import {
  type AgroExportV1,
  agroExportV1,
  type Ciclo,
  ErrorDeValidacion,
  hashDeFilas,
  type Registro,
  TABLAS_EXPORTADAS,
  type TablaExportada,
  validarRegistro,
} from '@gestionagro/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb } from './db.ts';

export class ErrorDeImportacion extends Error {
  override readonly name = 'ErrorDeImportacion';
  readonly motivos: readonly string[];
  constructor(motivos: readonly string[]) {
    super(`No se importó nada: ${motivos.join('; ')}`);
    this.motivos = motivos;
  }
}

type Filas = { id: string }[];

const tablaDe = (db: CuadernoDb, t: TablaExportada) => db.table<{ id: string }, string>(t);

export async function exportarTodo(
  db: CuadernoDb,
  { ahora = () => new Date(), app }: { ahora?: () => Date; app: string },
): Promise<AgroExportV1> {
  const [finca] = await db.finca.toArray();
  if (!finca) throw new Error('No hay finca que exportar');
  // Una lectura consistente de todas las tablas. La huella se calcula afuera: esperar a
  // crypto.subtle dentro de la transacción la cerraría antes de tiempo (Dexie).
  const leidas = new Map<TablaExportada, Filas>();
  await db.transaction(
    'r',
    TABLAS_EXPORTADAS.map((t) => tablaDe(db, t)),
    async () => {
      for (const t of TABLAS_EXPORTADAS) leidas.set(t, await tablaDe(db, t).toArray());
    },
  );
  const tablas: Record<string, { recuento: number; hash: string; filas: Filas }> = {};
  for (const [t, filas] of leidas) {
    tablas[t] = { recuento: filas.length, hash: await hashDeFilas(filas), filas };
  }
  return {
    formato: 'agro-export',
    version: 1,
    generado: ahora().toISOString(),
    app,
    finca_id: finca.id,
    tablas: tablas as AgroExportV1['tablas'],
  };
}

export interface ResumenDeImportacion {
  archivo: AgroExportV1;
  /** Por tabla: filas que se agregarían y filas que ya están (se conservan las de aquí). */
  tablas: Record<TablaExportada, { nuevas: number; existentes: number }>;
}

/**
 * Lee y revisa el archivo completo sin escribir nada: forma, versión, recuentos, hashes, cada
 * registro con el esquema de su tipo y versión, y que sea de la misma finca. Lanza
 * `ErrorDeImportacion` con todos los motivos.
 */
export async function analizarArchivo(
  db: CuadernoDb,
  texto: string,
): Promise<ResumenDeImportacion> {
  let json: unknown;
  try {
    json = JSON.parse(texto.replace(/^﻿/, ''));
  } catch {
    throw new ErrorDeImportacion(['el archivo no es JSON válido; puede estar cortado']);
  }
  const cabecera = json as { formato?: unknown; version?: unknown } | null;
  if (cabecera?.formato !== 'agro-export') {
    throw new ErrorDeImportacion(['no es un respaldo del cuaderno (agro-export)']);
  }
  if (cabecera.version !== 1) {
    throw new ErrorDeImportacion([
      `es un respaldo de versión ${String(cabecera.version)}; esta app lee la versión 1. Actualiza la app.`,
    ]);
  }
  const forma = agroExportV1.safeParse(json);
  if (!forma.success) {
    throw new ErrorDeImportacion(
      forma.error.issues.slice(0, 5).map((i) => `«${i.path.join('.')}» ${i.message}`),
    );
  }
  const archivo = forma.data;
  const motivos: string[] = [];
  for (const t of TABLAS_EXPORTADAS) {
    const { recuento, hash, filas } = archivo.tablas[t];
    if (filas.length !== recuento) {
      motivos.push(`la tabla ${t} dice ${recuento} filas y trae ${filas.length}`);
    } else if ((await hashDeFilas(filas)) !== hash) {
      motivos.push(`la tabla ${t} no coincide con su huella: el archivo se modificó o se dañó`);
    }
  }
  archivo.tablas.registro.filas.forEach((r, i) => {
    try {
      validarRegistro(r);
    } catch (e) {
      if (e instanceof ErrorDeValidacion) {
        motivos.push(
          `registro ${i + 1}: ${e.campos.map((c) => `«${c.campo}» ${c.motivo}`).join(', ')}`,
        );
      } else throw e;
    }
  });
  const [aqui] = await db.finca.toArray();
  if (aqui && aqui.id !== archivo.finca_id) {
    const nombre = archivo.tablas.finca.filas.find((f) => f.id === archivo.finca_id)?.nombre;
    // Dos fincas con el mismo nombre confunden: se dice que son distintas (revisión del dueño,
    // 3 oct 2026), y en todo caso cómo cargar el respaldo sin mezclarlas.
    const cual =
      nombre === aqui.nombre
        ? `el respaldo es de otra finca, aunque también se llama «${nombre}»`
        : `el respaldo es de otra finca${nombre ? ` («${nombre}»)` : ''}; este teléfono ya tiene «${aqui.nombre}»`;
    motivos.push(
      `${cual}. Para no mezclarlas, ábrelo en un cuaderno vacío: otro navegador o una ventana de incógnito`,
    );
  }
  if (motivos.length > 0) throw new ErrorDeImportacion(motivos);

  const tablas = {} as ResumenDeImportacion['tablas'];
  for (const t of TABLAS_EXPORTADAS) {
    const filas = archivo.tablas[t].filas as Filas;
    const existentes = await tablaDe(db, t)
      .where('id')
      .anyOf(filas.map((f) => f.id))
      .count();
    tablas[t] = { nuevas: filas.length - existentes, existentes };
  }
  return { archivo, tablas };
}

/**
 * Agrega lo que falta, en una sola transacción. Lo que ya existe no se toca: si aquí hay una
 * versión distinta del mismo catálogo, se conserva la de aquí (CA2). Devuelve cuántas filas
 * agregó por tabla.
 */
export async function importar(
  db: CuadernoDb,
  resumen: ResumenDeImportacion,
): Promise<Record<TablaExportada, number>> {
  const agregadas = {} as Record<TablaExportada, number>;
  await conEscritura(() =>
    db.transaction(
      'rw',
      TABLAS_EXPORTADAS.map((t) => tablaDe(db, t)),
      async () => {
        for (const t of TABLAS_EXPORTADAS) {
          const filas = resumen.archivo.tablas[t].filas as Filas;
          const tabla = tablaDe(db, t);
          const ya = new Set(
            (
              await tabla
                .where('id')
                .anyOf(filas.map((f) => f.id))
                .primaryKeys()
            ).map(String),
          );
          const nuevas = filas.filter((f) => !ya.has(f.id));
          await tabla.bulkAdd(nuevas);
          agregadas[t] = nuevas.length;
        }
      },
    ),
  );
  return agregadas;
}

// ——— CSV para Excel en español (CA4) ———

/** Excel en español separa con «;» y lee UTF-8 solo si el archivo empieza con BOM (P3). */
const SEPARADOR = ';';
const BOM = '﻿';

const numero = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n).replace('.', ',');

/** Texto seguro: entre comillas si hace falta, y sin fórmulas que Excel ejecute (=, +, -, @). */
function celda(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * Una columna de un tipo de registro. La comparten el CSV para Excel y la carpeta en PDF
 * (HU-E9.2, P2): el valor es el texto limpio, y cada formato aplica su escape al escribir.
 */
export interface ColumnaDeRegistro {
  titulo: string;
  /** Texto listo para leer; los números van con coma decimal. */
  valor: (r: Registro, c: ContextoDeRegistros) => string;
}

export interface ContextoDeRegistros {
  areas: Map<string, string>;
  personas: Map<string, string>;
  ciclos: Map<string, Ciclo>;
  anulados: Set<string>;
}

const d = (r: Registro) => r.datos as Record<string, unknown>;
const num = (campo: string) => (r: Registro) => numero(d(r)[campo] as number | null | undefined);
const txt = (campo: string) => (r: Registro) => String(d(r)[campo] ?? '');
const personasDe = (r: Registro, c: ContextoDeRegistros) =>
  r.persona_ids.map((id) => c.personas.get(id) ?? id).join(', ');

export const COLUMNAS_COMUNES: ColumnaDeRegistro[] = [
  { titulo: 'Fecha', valor: (r) => r.fecha_agronomica.split('-').reverse().join('/') },
  { titulo: 'Hora', valor: (r) => HORA.format(new Date(r.instante_evento)) },
  { titulo: 'Área', valor: (r, c) => r.area_ids.map((a) => c.areas.get(a) ?? a).join(', ') },
  {
    titulo: 'Ciclo',
    valor: (r, c) => {
      const ciclo = r.ciclo_id ? c.ciclos.get(r.ciclo_id) : undefined;
      return ciclo ? `${ciclo.cultivo} ${ciclo.variedad} (${ciclo.fecha_trasplante})` : '';
    },
  },
  { titulo: 'Estado', valor: (r, c) => (c.anulados.has(r.id) ? 'anulado' : 'vigente') },
];

export const COLUMNAS_CSV: Record<string, ColumnaDeRegistro[]> = {
  clima: [
    { titulo: 'Temperatura (°C)', valor: num('temperaturaC') },
    { titulo: 'Humedad relativa (%)', valor: num('humedadRelativaPct') },
    { titulo: 'Temperatura de hoja (°C)', valor: num('temperaturaHojaC') },
    { titulo: 'DPV (kPa)', valor: num('dpvKPa') },
  ],
  riego: [
    {
      titulo: 'Unidad',
      valor: (r) => (d(r)['unidad'] === 'mL_gotero' ? 'mL por gotero' : 'L por área'),
    },
    { titulo: 'Volumen aplicado', valor: num('volumenAplicado') },
    { titulo: 'Duración (min)', valor: num('duracionMin') },
    { titulo: 'Volumen drenado', valor: num('volumenDrenado') },
    { titulo: 'Drenaje (%)', valor: num('drenajePct') },
    { titulo: 'CE entrada (dS/m)', valor: num('ceEntradaDsM') },
    { titulo: 'pH entrada', valor: num('phEntrada') },
    { titulo: 'CE drenaje (dS/m)', valor: num('ceDrenajeDsM') },
    { titulo: 'pH drenaje', valor: num('phDrenaje') },
  ],
  labor: [
    { titulo: 'Labor', valor: txt('labor') },
    { titulo: 'Horas por persona', valor: num('horasPorPersona') },
    { titulo: 'Personas', valor: personasDe },
  ],
  aplicacion: [
    { titulo: 'Insumo', valor: txt('insumo') },
    { titulo: 'Dosis (según etiqueta)', valor: num('dosis') },
    { titulo: 'Unidad de dosis', valor: txt('dosisUnidad') },
    { titulo: 'Mezcla (L)', valor: num('volumenMezclaL') },
    { titulo: 'Equipo', valor: txt('equipo') },
    { titulo: 'Carencia (días)', valor: num('carenciaDias') },
    { titulo: 'Reentrada (horas)', valor: num('reentradaHoras') },
    { titulo: 'Quién aplicó', valor: personasDe },
  ],
  cosecha: [
    { titulo: 'Cantidad', valor: num('cantidad') },
    { titulo: 'Unidad', valor: txt('unidad') },
    { titulo: 'Calidad', valor: txt('categoria') },
    { titulo: 'Descarte', valor: num('descarte') },
    {
      titulo: 'Cosechada en carencia',
      valor: (r) => {
        const k = d(r)['carenciaConfirmada'] as { hasta: string | null; insumos: string[] } | null;
        if (!k) return '';
        const hasta = k.hasta ? `hasta ${k.hasta.split('-').reverse().join('/')}` : 'desconocida';
        return `sí, ${hasta} (${k.insumos.join(', ')})`;
      },
    },
    { titulo: 'Quién cosechó', valor: personasDe },
  ],
  monitoreo: [
    { titulo: 'Plaga o enfermedad', valor: txt('plaga') },
    { titulo: 'Tipo', valor: (r) => (d(r)['clase'] === 'enfermedad' ? 'enfermedad' : 'plaga') },
    {
      titulo: 'Cómo se midió',
      valor: (r) =>
        ({ trampa: 'trampa', conteo: 'conteo en plantas', observacion: 'observación' })[
          String(d(r)['metodo'])
        ] ?? '',
    },
    { titulo: 'Nivel', valor: txt('nivel') },
    { titulo: 'Cantidad', valor: num('cantidad') },
    { titulo: 'Foto', valor: (r) => (d(r)['foto_id'] ? 'sí' : '') },
    { titulo: 'Nota', valor: txt('nota') },
    { titulo: 'Quién', valor: personasDe },
  ],
};

export const TIPOS_CSV = Object.keys(COLUMNAS_CSV);

/** Nombres de áreas, personas y ciclos, y qué registros fueron corregidos. */
export async function contextoDeRegistros(
  db: CuadernoDb,
  registros: readonly Registro[],
): Promise<ContextoDeRegistros> {
  return {
    areas: new Map((await db.area.toArray()).map((a) => [a.id, a.nombre])),
    personas: new Map((await db.persona.toArray()).map((p) => [p.id, p.nombre])),
    ciclos: new Map((await db.ciclo.toArray()).map((c) => [c.id, c])),
    anulados: new Set(
      registros.map((r) => r.anula_id).filter((x): x is string => typeof x === 'string'),
    ),
  };
}

/**
 * CSV de un tipo de registro, del más viejo al más nuevo, con vigentes y anulados (la columna
 * «Estado» los distingue): la traza completa, como en el historial.
 */
export async function csvDeTipo(db: CuadernoDb, fincaId: string, tipo: string): Promise<string> {
  const propias = COLUMNAS_CSV[tipo];
  if (!propias) throw new Error(`No hay CSV para el tipo «${tipo}»`);
  const columnas = [...COLUMNAS_COMUNES, ...propias];
  const registros = (
    await db.registro
      .where('tipo')
      .equals(tipo)
      .filter((r) => r.finca_id === fincaId)
      .toArray()
  ).sort((a, b) => a.instante_evento.localeCompare(b.instante_evento) || a.id.localeCompare(b.id));
  const contexto = await contextoDeRegistros(db, registros);
  // Los números van sin celda() para no anteponer «'» a un negativo: Excel los lee como número.
  const escapar = (v: string) => (/^-?\d+(,\d+)?$/.test(v) ? v : celda(v));
  const lineas = [
    columnas.map((c) => celda(c.titulo)).join(SEPARADOR),
    ...registros.map((r) => columnas.map((c) => escapar(c.valor(r, contexto))).join(SEPARADOR)),
  ];
  return `${BOM}${lineas.join('\r\n')}\r\n`;
}
