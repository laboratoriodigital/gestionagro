/**
 * PDF de la carpeta de cumplimiento (HU-E9.2, CA1): se arma en el teléfono con pdf-lib, sin
 * servidor. Este módulo se carga solo al pedir la carpeta, y su trozo no va en la precarga del
 * service worker: quien no la usa no descarga pdf-lib (ED1 budget-first).
 *
 * - Hojas horizontales; cada sección es una tabla que pasa de hoja sin cortar filas y repite su
 *   encabezado. Cada hoja dice la finca, el periodo, la fecha de generación y «Página n de N».
 * - Los anulados van en gris y dicen «anulado» (CA1).
 * - La fuente estándar del PDF solo escribe caracteres latinos: lo demás (un emoji en una nota)
 *   se cambia por «?» en vez de romper la carpeta.
 */
import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import type { Carpeta, SeccionDeCarpeta } from './carpeta.ts';

export type Papel = 'carta' | 'a4';
export const TAMANO: Record<Papel, [number, number]> = { carta: [792, 612], a4: [842, 595] };

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.45, 0.45, 0.45);
const RAYA = rgb(0.75, 0.75, 0.75);
const MARGEN = 30;
const TAM = 7;
const INTERLINEA = 8.5;

/** Windows-1252, lo que escribe la fuente estándar del PDF, fuera del ASCII imprimible y Latin-1. */
const EXTRA_WIN_ANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Texto que la fuente estándar puede escribir. */
export function apto(texto: string): string {
  return [...texto.replace(/−/g, '-').replace(/[\r\n\t]+/g, ' ')]
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || EXTRA_WIN_ANSI.has(ch)
        ? ch
        : '?';
    })
    .join('');
}

/** Parte un texto en renglones que caben en `ancho`; una palabra más larga se corta. */
export function renglones(texto: string, fuente: PDFFont, ancho: number): string[] {
  const cabe = (t: string) => fuente.widthOfTextAtSize(t, TAM) <= ancho;
  const lineas: string[] = [];
  let actual = '';
  for (const entera of apto(texto).split(' ')) {
    let palabra = entera;
    while (!cabe(palabra) && palabra.length > 1) {
      let n = palabra.length - 1;
      while (n > 1 && !cabe(palabra.slice(0, n))) n--;
      if (actual) lineas.push(actual);
      actual = '';
      lineas.push(palabra.slice(0, n));
      palabra = palabra.slice(n);
    }
    const junto = actual ? `${actual} ${palabra}` : palabra;
    if (cabe(junto)) actual = junto;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  lineas.push(actual);
  return lineas;
}

const fechaCorta = (f: string) => f.split('-').reverse().join('/');

export async function pdfDeCarpeta(
  carpeta: Carpeta,
  papel: Papel,
  generada: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(apto(`Registros de ${carpeta.finca}`));
  doc.setCreator('Gestión Agro');
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const [ancho, alto] = TAMANO[papel];
  const util = ancho - 2 * MARGEN;
  const periodo = `del ${fechaCorta(carpeta.desde)} al ${fechaCorta(carpeta.hasta)}`;

  let hoja: PDFPage = doc.addPage([ancho, alto]);
  let y = 0;
  const encabezado = () => {
    hoja.drawText(apto(carpeta.finca), {
      x: MARGEN,
      y: alto - MARGEN - 12,
      size: 13,
      font: negrita,
    });
    const lugar = carpeta.municipio ? ` · ${carpeta.municipio}` : '';
    hoja.drawText(
      apto(`Registros de la finca para el periodo ${periodo}${lugar} · generada el ${generada}`),
      {
        x: MARGEN,
        y: alto - MARGEN - 26,
        size: 8,
        font: normal,
        color: GRIS,
      },
    );
    y = alto - MARGEN - 44;
  };
  const nuevaHoja = () => {
    hoja = doc.addPage([ancho, alto]);
    encabezado();
  };
  encabezado();
  hoja.drawText(
    apto(
      'Registros de la finca para el periodo, tal como se anotaron en el cuaderno de campo. Este documento no certifica el cumplimiento de ninguna norma.',
    ),
    { x: MARGEN, y, size: 8, font: normal },
  );
  y -= 18;

  const dibujarSeccion = (s: SeccionDeCarpeta) => {
    const anchoCol = util / Math.max(1, s.columnas.length);
    const filaDe = (celdas: string[], fuente: PDFFont) =>
      celdas.map((c) => renglones(c, fuente, anchoCol - 4));
    const altoDe = (partes: string[][]) =>
      Math.max(...partes.map((p) => p.length)) * INTERLINEA + 4;
    const cabecera = filaDe(s.columnas, negrita);
    const dibujarFila = (partes: string[][], fuente: PDFFont, color = NEGRO) => {
      const h = altoDe(partes);
      partes.forEach((lineas, j) => {
        lineas.forEach((l, k) => {
          hoja.drawText(l, {
            x: MARGEN + j * anchoCol + 2,
            y: y - 2 - (k + 1) * INTERLINEA + 2,
            size: TAM,
            font: fuente,
            color,
          });
        });
      });
      y -= h;
      hoja.drawLine({
        start: { x: MARGEN, y },
        end: { x: ancho - MARGEN, y },
        thickness: 0.4,
        color: RAYA,
      });
    };
    // Título, cabecera y al menos una fila juntos: un título solo al pie de la hoja no sirve.
    const primera = s.filas[0] ? altoDe(filaDe(s.filas[0].celdas, normal)) : INTERLINEA;
    if (y - 16 - altoDe(cabecera) - primera < MARGEN + 14) nuevaHoja();
    hoja.drawText(apto(`${s.titulo} (${s.filas.length})`), {
      x: MARGEN,
      y: y - 11,
      size: 10,
      font: negrita,
    });
    y -= 16;
    dibujarFila(cabecera, negrita);
    if (s.filas.length === 0) {
      hoja.drawText('Sin registros en el periodo.', {
        x: MARGEN + 2,
        y: y - INTERLINEA,
        size: TAM,
        font: normal,
        color: GRIS,
      });
      y -= INTERLINEA + 4;
    }
    for (const f of s.filas) {
      const partes = filaDe(f.celdas, normal);
      if (y - altoDe(partes) < MARGEN + 14) {
        nuevaHoja();
        hoja.drawText(apto(`${s.titulo} (continúa)`), {
          x: MARGEN,
          y: y - 11,
          size: 10,
          font: negrita,
        });
        y -= 16;
        dibujarFila(cabecera, negrita);
      }
      dibujarFila(partes, normal, f.anulado ? GRIS : NEGRO);
    }
    if (s.nota) {
      if (y - INTERLINEA - 4 < MARGEN + 14) nuevaHoja();
      hoja.drawText(apto(s.nota), {
        x: MARGEN,
        y: y - INTERLINEA - 1,
        size: TAM,
        font: normal,
        color: GRIS,
      });
      y -= INTERLINEA + 4;
    }
    y -= 12;
  };

  for (const s of carpeta.secciones) dibujarSeccion(s);

  // «Página n de N» y el pie, cuando ya se sabe cuántas hojas hay.
  const hojas = doc.getPages();
  hojas.forEach((h, i) => {
    h.drawText(
      apto(
        `Página ${i + 1} de ${hojas.length} · ${carpeta.finca} · ${periodo} · Generada con el cuaderno de campo Gestión Agro`,
      ),
      { x: MARGEN, y: MARGEN - 14, size: 7, font: normal, color: GRIS },
    );
  });
  return doc.save();
}
