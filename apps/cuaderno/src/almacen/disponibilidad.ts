/**
 * Disponibilidad para la Tienda del ecosistema (HU-E6.5): un CSV con lo que queda de cada producto
 * (cosechado menos despachado, HU-E6.3), para actualizar el catálogo sin volver a contar. No hay
 * conexión entre los dos sistemas (CA2): el archivo se descarga y se importa en la hoja.
 *
 * Formato v2: las columnas de la pestaña «Catálogo» de la Tienda, con su nombre y en su orden
 * visible (CONTRATOS de la Tienda, §4; la hoja las lee por nombre). Lo confirmó el dueño el 3 oct
 * 2026. La v1 (una fila por lote, con columnas propias) no se podía pegar en la hoja.
 * - UTF-8 con BOM, separado por comas, filas terminadas en CRLF y comillas según RFC 4180.
 * - La Tienda vende productos, no lotes: una fila por cultivo y categoría de cosecha, con la suma
 *   de los lotes con saldo. Los lotes van en `Referencia` y las fechas en `Descripción`.
 * - `Stock` es un entero en la Tienda: unidades de «1 kg» (o de la unidad de la cosecha), sin la
 *   fracción. Un producto con menos de una unidad no sale.
 * - `Precio` va vacío: el precio de la tienda lo pone quien vende, y el de un despacho a un cliente
 *   no es el de la tienda (P1). La Tienda no publica un producto sin precio, y así lo dice.
 * - `ID` en minúsculas, sin tildes, con guiones (la regla de la Tienda), del cultivo y la categoría:
 *   el mismo producto sale con el mismo ID cada vez.
 * - Un lote sin cultivo no sale: no se le inventa un nombre. La pantalla dice cuántos quedaron fuera.
 * - Una celda que empieza con `=`, `+`, `-`, `@`, tabulador o retorno lleva un apóstrofo delante,
 *   para que la hoja no la ejecute como fórmula.
 */
import type { DatosLote, Lote } from './lotes.ts';

export const COLUMNAS_DE_DISPONIBILIDAD = [
  'ID',
  'Nombre',
  'Categoría',
  'Formato',
  'Precio',
  'Precio antes',
  'Stock',
  'Umbral bajo',
  'Variantes',
  'Imágenes',
  'Descripción',
  'Destacado',
  'Activo',
  'Referencia',
] as const;

type Columna = (typeof COLUMNAS_DE_DISPONIBILIDAD)[number];
export type FilaDeDisponibilidad = Record<Columna, string>;

/** Topes de la Tienda para las celdas que se llenan aquí. */
const MAXIMO = { ID: 60, Referencia: 60 } as const;

/** Una celda segura para una hoja de cálculo: sin fórmulas y con comillas si hace falta. */
export function celda(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** «Tomate cherry», «Primera» → «tomate-cherry-primera» (letras, números y guiones). */
export function idDeProducto(...partes: string[]): string {
  return partes
    .join(' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAXIMO.ID)
    .replace(/^-+|-+$/g, '');
}

/** Los códigos de lote que caben en `Referencia`; si no caben todos, «… y N más». */
function referencia(codigos: string[]): string {
  let texto = '';
  for (const [i, c] of codigos.entries()) {
    const resto = codigos.length - i - 1;
    const siguiente = texto ? `${texto} ${c}` : c;
    const cola = resto > 0 ? ` y ${resto} más` : '';
    if (`${siguiente}${cola}`.length > MAXIMO.Referencia) {
      return `${texto} y ${codigos.length - i} más`;
    }
    texto = siguiente;
  }
  return texto;
}

const ddmm = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;

const cultivoDe = (l: Lote) => (l.registro.datos as DatosLote).cultivo;
const categoriaDe = (l: Lote) => [...new Set(l.cosechas.map((c) => c.categoria))].join(' y ');

/** Lotes con saldo que no salen en el archivo porque no tienen cultivo. */
export const lotesSinCultivo = (lotes: readonly Lote[]): number =>
  lotes.filter((l) => l.saldo > 0 && !cultivoDe(l)).length;

/** Las filas: una por cultivo, categoría y unidad, en el orden en que aparecen los lotes. */
export function filasDeDisponibilidad(
  lotes: readonly Lote[],
  finca: string,
): FilaDeDisponibilidad[] {
  const grupos = new Map<string, Lote[]>();
  for (const l of lotes) {
    const cultivo = cultivoDe(l);
    if (l.saldo <= 0 || !cultivo) continue;
    const clave = JSON.stringify([cultivo, categoriaDe(l), l.unidad]);
    grupos.set(clave, [...(grupos.get(clave) ?? []), l]);
  }
  return [...grupos.values()].flatMap((grupo) => {
    const [primero] = grupo;
    if (!primero) return [];
    const cultivo = cultivoDe(primero) ?? '';
    const categoria = categoriaDe(primero);
    const stock = Math.floor(grupo.reduce((s, l) => s + l.saldo, 0) + 1e-9);
    if (stock < 1) return [];
    const fechas = grupo.flatMap((l) => l.cosechas.map((c) => c.fecha)).sort();
    const desde = fechas[0];
    const hasta = fechas.at(-1);
    const cuando =
      desde && hasta
        ? desde === hasta
          ? ` el ${ddmm(desde)}`
          : ` entre el ${ddmm(desde)} y el ${ddmm(hasta)}`
        : '';
    return [
      {
        ID: idDeProducto(cultivo, categoria),
        Nombre: categoria ? `${cultivo} (${categoria})` : cultivo,
        Categoría: cultivo,
        Formato: `1 ${primero.unidad}`,
        Precio: '',
        'Precio antes': '',
        Stock: String(stock),
        'Umbral bajo': '',
        Variantes: '',
        Imágenes: '',
        Descripción: `Cosechado en ${finca}${cuando}.`,
        Destacado: 'No',
        Activo: 'Sí',
        Referencia: referencia(grupo.map((l) => l.codigo)),
      },
    ];
  });
}

/** El archivo completo, listo para descargar. */
export function disponibilidadCsv(lotes: readonly Lote[], finca: string): string {
  const filas = filasDeDisponibilidad(lotes, finca).map((f) =>
    COLUMNAS_DE_DISPONIBILIDAD.map((c) => celda(f[c])).join(','),
  );
  return `﻿${[COLUMNAS_DE_DISPONIBILIDAD.join(','), ...filas].join('\r\n')}\r\n`;
}
