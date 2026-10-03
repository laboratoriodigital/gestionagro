/**
 * PDF de la tabla de DPV (HU-E2.3, CA3): se arma en el navegador con pdf-lib, sin servidor. Una
 * sola hoja horizontal, carta o A4. Este módulo se carga solo al pedir el PDF: la página de la
 * calculadora no paga su peso.
 *
 * Legible en blanco y negro (CA1): cada nivel lleva un gris distinto y una marca escrita
 * (--, -, +, ++). La fuente estándar del PDF solo tiene caracteres latinos: nada de símbolos raros.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import marcaPublica from '../../../../content/marca.json' with { type: 'json' };
import { MARCA, NOMBRE_NIVEL, type TablaDpv } from './tabla-dpv.ts';

export type Papel = 'carta' | 'a4';

/** Ancho × alto en puntos, horizontal. */
export const TAMANO: Record<Papel, [number, number]> = {
  carta: [792, 612],
  a4: [842, 595],
};

/** Tonos claros: en color se distinguen y en blanco y negro dan grises distintos. */
const RELLENO = {
  bajo: rgb(0.62, 0.76, 0.93),
  'algo-bajo': rgb(0.84, 0.9, 0.98),
  'en-rango': rgb(1, 1, 1),
  'algo-alto': rgb(0.99, 0.87, 0.7),
  alto: rgb(0.96, 0.66, 0.45),
} as const;

const NEGRO = rgb(0, 0, 0);
const GRIS = rgb(0.45, 0.45, 0.45);

export async function pdfDeTabla(
  tabla: TablaDpv,
  papel: Papel,
  cultivo: string | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Tabla de DPV');
  doc.setCreator(marcaPublica.nombre);
  const [ancho, alto] = TAMANO[papel];
  const hoja = doc.addPage([ancho, alto]);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const margen = 36;

  const titulo = cultivo ? `DPV del aire (kPa) para ${cultivo}` : 'DPV del aire (kPa)';
  hoja.drawText(titulo, { x: margen, y: alto - margen - 14, size: 16, font: negrita });
  hoja.drawText(
    'Filas: temperatura del aire (°C). Columnas: humedad relativa (%). Busca tu lectura en el cruce.',
    { x: margen, y: alto - margen - 32, size: 9, font: normal, color: GRIS },
  );

  // Cuadrícula: una columna de encabezado y una celda por humedad.
  const arriba = alto - margen - 52;
  const leyendaAlto = 40;
  const filas = tabla.temperaturas.length + 1;
  const columnas = tabla.humedades.length + 1;
  const anchoCelda = (ancho - 2 * margen) / columnas;
  const altoCelda = Math.min(28, (arriba - margen - leyendaAlto) / filas);
  const celda = (fila: number, columna: number) => ({
    x: margen + columna * anchoCelda,
    y: arriba - (fila + 1) * altoCelda,
  });
  const texto = (t: string, fila: number, columna: number, tam: number, bold = false) => {
    const fuente = bold ? negrita : normal;
    const { x, y } = celda(fila, columna);
    const w = fuente.widthOfTextAtSize(t, tam);
    hoja.drawText(t, {
      x: x + (anchoCelda - w) / 2,
      y: y + (altoCelda - tam) / 2 + 1,
      size: tam,
      font: fuente,
      color: NEGRO,
    });
  };

  texto('°C \\ %', 0, 0, 9, true);
  for (const [j, hr] of tabla.humedades.entries()) texto(`${hr} %`, 0, j + 1, 10, true);
  tabla.temperaturas.forEach((t, i) => {
    texto(`${t} °C`, i + 1, 0, 10, true);
    tabla.humedades.forEach((_, j) => {
      const c = tabla.celdas[i]?.[j];
      if (!c) return;
      const { x, y } = celda(i + 1, j + 1);
      hoja.drawRectangle({
        x,
        y,
        width: anchoCelda,
        height: altoCelda,
        color: c.nivel ? RELLENO[c.nivel] : rgb(1, 1, 1),
        borderColor: GRIS,
        borderWidth: 0.5,
      });
      const marca = c.nivel ? MARCA[c.nivel] : '';
      texto(marca ? `${c.texto} ${marca}` : c.texto, i + 1, j + 1, 10, c.nivel === 'en-rango');
    });
  });

  // Leyenda y fuente, debajo de la tabla.
  const abajo = arriba - filas * altoCelda - 16;
  if (tabla.etapa) {
    const partes = (['bajo', 'algo-bajo', 'en-rango', 'algo-alto', 'alto'] as const).map(
      (n) => `${MARCA[n] || '(sin marca)'} ${NOMBRE_NIVEL[n]}`,
    );
    hoja.drawText(`Nivel para el cultivo: ${partes.join('   ·   ')}`, {
      x: margen,
      y: abajo,
      size: 9,
      font: normal,
    });
    // La fuente es larga: se parte en renglones para que no se salga de la hoja.
    const renglones: string[] = [];
    for (const palabra of `Rango de referencia: ${tabla.etapa.fuente}`.split(' ')) {
      const ultimo = renglones.at(-1);
      const junto = ultimo === undefined ? palabra : `${ultimo} ${palabra}`;
      if (ultimo !== undefined && normal.widthOfTextAtSize(junto, 8) <= ancho - 2 * margen) {
        renglones[renglones.length - 1] = junto;
      } else renglones.push(palabra);
    }
    renglones.slice(0, 3).forEach((r, i) => {
      hoja.drawText(r, { x: margen, y: abajo - 13 - i * 10, size: 8, font: normal, color: GRIS });
    });
  }
  hoja.drawText(
    'DPV calculado con la ecuación 11 de FAO-56. Referencia para decidir; la decisión es tuya. cultivopro.co',
    { x: margen, y: margen - 12, size: 8, font: normal, color: GRIS },
  );
  return doc.save();
}
