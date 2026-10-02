/**
 * Disponibilidad para la Tienda del ecosistema (HU-E6.5): un CSV con lo que queda de cada lote
 * (cosechado menos despachado, HU-E6.3), para actualizar el catálogo sin volver a contar. No hay
 * conexión entre los dos sistemas (CA2): el archivo se descarga y se importa en la hoja.
 *
 * Formato v1 (propuesto por el cuaderno; la Tienda lo confirma al importarlo, P9):
 * - UTF-8 con BOM, separado por comas, filas terminadas en CRLF y comillas según RFC 4180.
 * - Columnas: producto, categoria, disponible, unidad, lote, cosechado_desde, cosechado_hasta, finca.
 * - Una fila por lote con saldo mayor que cero. `disponible` con punto decimal (hasta 3 cifras),
 *   como lo lee `Number()`; las fechas en `AAAA-MM-DD`.
 * - Un lote sin cultivo deja `producto` vacío: no se inventa (P1).
 * - Una celda que empieza con `=`, `+`, `-`, `@`, tabulador o retorno lleva un apóstrofo delante,
 *   para que la hoja no la ejecute como fórmula.
 */
import type { DatosLote, Lote } from './lotes.ts';

export const COLUMNAS_DE_DISPONIBILIDAD = [
  'producto',
  'categoria',
  'disponible',
  'unidad',
  'lote',
  'cosechado_desde',
  'cosechado_hasta',
  'finca',
] as const;

/** Una celda segura para una hoja de cálculo: sin fórmulas y con comillas si hace falta. */
export function celda(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** Cantidad con punto decimal y sin ceros de más: 12.5, 3, 0.125. */
const cantidad = (n: number) => String(Math.round(n * 1000) / 1000);

export interface FilaDeDisponibilidad {
  producto: string;
  categoria: string;
  disponible: number;
  unidad: string;
  lote: string;
  cosechado_desde: string;
  cosechado_hasta: string;
  finca: string;
}

/** Las filas: un lote con saldo por fila, en el orden de los lotes. */
export function filasDeDisponibilidad(
  lotes: readonly Lote[],
  finca: string,
): FilaDeDisponibilidad[] {
  return lotes
    .filter((l) => l.saldo > 0)
    .map((l) => {
      const fechas = l.cosechas.map((c) => c.fecha).sort();
      return {
        producto: (l.registro.datos as DatosLote).cultivo ?? '',
        categoria: [...new Set(l.cosechas.map((c) => c.categoria))].join(' y '),
        disponible: l.saldo,
        unidad: l.unidad,
        lote: l.codigo,
        cosechado_desde: fechas[0] ?? '',
        cosechado_hasta: fechas.at(-1) ?? '',
        finca,
      };
    });
}

/** El archivo completo, listo para descargar. */
export function disponibilidadCsv(lotes: readonly Lote[], finca: string): string {
  const filas = filasDeDisponibilidad(lotes, finca).map((f) =>
    COLUMNAS_DE_DISPONIBILIDAD.map((c) =>
      celda(c === 'disponible' ? cantidad(f.disponible) : f[c]),
    ).join(','),
  );
  return `﻿${[COLUMNAS_DE_DISPONIBILIDAD.join(','), ...filas].join('\r\n')}\r\n`;
}
