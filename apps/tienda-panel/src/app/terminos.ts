/**
 * Los textos que acepta el comercio (HU-T7.2 y HU-T11.2): los términos del servicio con el
 * contrato de transmisión, y la custodia de sus llaves de Bold. La API los arma y da su huella; el
 * panel los muestra tal cual y, al aceptar, devuelve la huella del texto que se leyó: si cambió
 * mientras tanto, la API responde «cambiado» y la pantalla vuelve a leerlo.
 */
import { type Conexion, pedirAlPanel } from './api.ts';
import { opNueva } from './catalogo.ts';

export type CualTexto = 'terminos' | 'custodia';

export interface TextoDelComercio {
  cual: CualTexto;
  version: string;
  aceptar: string;
  secciones: [titulo: string, texto: string][];
  huella: string;
}

export interface TerminosDelPanel {
  fecha: string;
  estado: string;
  revision: string;
  terminos: TextoDelComercio & { aceptados: boolean };
  custodia: TextoDelComercio & { aceptada: boolean };
}

export const leerTerminos = (c: Conexion) => pedirAlPanel<TerminosDelPanel>(c, 'terminos');

export const aceptarTexto = (c: Conexion, texto: Pick<TextoDelComercio, 'cual' | 'huella'>) =>
  pedirAlPanel<{ estado: 'guardado' }>(c, 'terminos/aceptar', {
    cuerpo: { op: opNueva(), cual: texto.cual, huella: texto.huella },
  });

/** «19 de octubre de 2026», sin depender del idioma del teléfono. */
export function fechaLegible(iso: string): string {
  const MESES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const [a, m, d] = iso.split('-').map(Number);
  return a && m && d ? `${d} de ${MESES[m - 1]} de ${a}` : iso;
}
