/**
 * Formato `parqueadero-export/1` (HU-Q1.3 CA2, PARQUEADERO §5.3 regla 6): todo lo de una caja en un
 * JSON, más un CSV para Excel. Es el respaldo de M0, que se comparte al cerrar el turno, y la carga
 * al reclamar el parqueadero en M1 (P2): el mismo archivo para las dos cosas.
 *
 * Cada tabla trae su recuento y el SHA-256 de sus filas en forma canónica: un archivo cortado o
 * editado a mano se detecta antes de escribir nada (P21). Las fotos no van: viven en la caja hasta
 * M2 (§5.5, bitácora parqueadero 8).
 */
import { z } from 'zod';
import { catalogo, versionAnterior } from './catalogos.ts';
import { id, instante, serie } from './comunes.ts';
import { type Registro, registroBase } from './registro.ts';
import { numeroDeRecibo, VEHICULOS } from './tipos.ts';

const tabla = <T extends z.ZodType>(fila: T) =>
  z.strictObject({
    recuento: z.int().min(0),
    hash: z.string().regex(/^[0-9a-f]{64}$/, 'debe ser un SHA-256 en hexadecimal'),
    filas: z.array(fila),
  });

export const parqueaderoExportV1 = z.strictObject({
  formato: z.literal('parqueadero-export'),
  version: z.literal(1),
  generado: instante,
  /** Versión de la caja que lo escribió. */
  app: z.string().min(1),
  dispositivo: z.strictObject({ id: z.string().min(1), serie }),
  /** La sede del archivo; nula si la caja aún no tiene sus datos legales. */
  sede_id: id.nullable(),
  tablas: z.strictObject({
    catalogo: tabla(catalogo),
    registro: tabla(registroBase),
    historial: tabla(versionAnterior),
  }),
});

export type ParqueaderoExportV1 = z.infer<typeof parqueaderoExportV1>;
export type TablaExportada = keyof ParqueaderoExportV1['tablas'];
export const TABLAS_EXPORTADAS: readonly TablaExportada[] = ['catalogo', 'registro', 'historial'];

/** JSON con las claves ordenadas a todo nivel: el mismo dato da siempre el mismo texto. */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor !== null && typeof valor === 'object') {
    const obj = valor as Record<string, unknown>;
    const claves = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    return `{${claves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(valor);
}

/** SHA-256 de las filas ordenadas por id, en forma canónica. No depende del orden de lectura. */
export async function hashDeFilas(filas: readonly { id: string }[]): Promise<string> {
  const ordenadas = [...filas].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const bytes = new TextEncoder().encode(jsonCanonico(ordenadas));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ContenidoDeExport {
  readonly generado: string;
  readonly app: string;
  readonly dispositivo: { readonly id: string; readonly serie: string };
  readonly sede_id: string | null;
  readonly catalogo: readonly { id: string }[];
  readonly registro: readonly { id: string }[];
  readonly historial: readonly { id: string }[];
}

/** Arma el archivo y lo valida contra su esquema antes de entregarlo: nunca un respaldo roto. */
export async function armarExport(c: ContenidoDeExport): Promise<ParqueaderoExportV1> {
  const t = async (filas: readonly { id: string }[]) => ({
    recuento: filas.length,
    hash: await hashDeFilas(filas),
    filas: [...filas],
  });
  return parqueaderoExportV1.parse({
    formato: 'parqueadero-export',
    version: 1,
    generado: c.generado,
    app: c.app,
    dispositivo: c.dispositivo,
    sede_id: c.sede_id,
    tablas: {
      catalogo: await t(c.catalogo),
      registro: await t(c.registro),
      historial: await t(c.historial),
    },
  });
}

/**
 * Lo que está mal en un archivo: el esquema, un recuento o un hash que no coinciden. Vacío = el
 * archivo es el que se escribió.
 */
export async function verificarExport(entrada: unknown): Promise<string[]> {
  const r = parqueaderoExportV1.safeParse(entrada);
  if (!r.success) {
    return r.error.issues.map((i) => `«${i.path.join('.') || '(archivo)'}» ${i.message}`);
  }
  const problemas: string[] = [];
  for (const nombre of TABLAS_EXPORTADAS) {
    const t = r.data.tablas[nombre];
    if (t.recuento !== t.filas.length) {
      problemas.push(`«${nombre}» dice ${t.recuento} filas y trae ${t.filas.length}`);
    }
    if ((await hashDeFilas(t.filas)) !== t.hash) {
      problemas.push(`«${nombre}» no coincide con su huella: el archivo se cortó o se editó`);
    }
  }
  return problemas;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha y hora locales con un desfase fijo, sin la API de formatos (§5.6): Colombia es UTC−5. */
function fechaYHora(iso: string, desfaseMin: number): [string, string] {
  const d = new Date(Date.parse(iso) + desfaseMin * 60_000);
  return [
    `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`,
    `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`,
  ];
}

/** Una celda de CSV: entre comillas si hace falta, y sin fórmulas (`=`, `+`, `-`, `@`). */
export function celdaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  let s = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export const COLUMNAS_CSV = [
  'numero',
  'tipo',
  'fecha',
  'hora',
  'placa',
  'vehiculo',
  'minutos',
  'total',
  'medio_pago',
  'anulado',
  'id',
] as const;

/**
 * Los registros en CSV para Excel en español: punto y coma, BOM de UTF-8 y una fila por registro,
 * en el orden de los instantes. `anulado` dice «sí» si otro registro lo anula.
 */
export function csvDeRegistros(registros: readonly Registro[], desfaseMin = -300): string {
  const anulados = new Set(registros.map((r) => r.anula_id).filter((x) => x !== null));
  const ordenados = [...registros].sort((a, b) =>
    a.instante_evento < b.instante_evento ? -1 : a.instante_evento > b.instante_evento ? 1 : 0,
  );
  const filas = ordenados.map((r) => {
    const d = (r.datos ?? {}) as Record<string, unknown>;
    const [fecha, hora] = fechaYHora(r.instante_evento, desfaseMin);
    const vehiculo = typeof d['vehiculo'] === 'string' ? d['vehiculo'] : null;
    return [
      r.serie !== null && r.consecutivo !== null ? numeroDeRecibo(r.serie, r.consecutivo) : null,
      r.tipo,
      fecha,
      hora,
      typeof d['placa'] === 'string' ? d['placa'] : null,
      vehiculo && vehiculo in VEHICULOS
        ? VEHICULOS[vehiculo as keyof typeof VEHICULOS].nombre
        : null,
      typeof d['minutos'] === 'number' ? d['minutos'] : null,
      typeof d['total'] === 'number'
        ? d['total']
        : typeof d['valor'] === 'number'
          ? d['valor']
          : null,
      typeof d['medio_pago'] === 'string' ? d['medio_pago'] : null,
      anulados.has(r.id) ? 'sí' : 'no',
      r.id,
    ]
      .map(celdaCsv)
      .join(';');
  });
  return `﻿${[COLUMNAS_CSV.join(';'), ...filas].join('\r\n')}\r\n`;
}
