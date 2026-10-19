/**
 * Lo que el comercio acepta en el panel (HU-T7.2 y HU-T11.2, TIENDA-3.0 §9.2 y §14.3): los términos
 * del servicio con el contrato de transmisión, y la cláusula de custodia de sus llaves de Bold.
 *
 * El texto vive en `content/tienda/comercio/terminos.json` y los datos del encargado en
 * `content/tienda/privacidad/politica.json`. Aquí solo se arman, para que el panel muestre y la API
 * compare exactamente el mismo texto (P2): la aceptación guarda la huella (SHA-256) del texto que
 * se leyó, y una huella distinta de la vigente es otra versión, que hay que volver a aceptar.
 *
 * Puro: recibe los dos JSON como parámetros, sin leer archivos ni la red.
 */

export type CualTexto = 'terminos' | 'custodia';

interface Seccion {
  readonly titulo: string;
  readonly texto: string;
}

export interface PlantillaDelComercio {
  readonly version: string;
  readonly fecha: string;
  readonly estado: string;
  readonly revision: string;
  readonly aceptar: string;
  readonly secciones: readonly Seccion[];
  readonly custodia: {
    readonly version: string;
    readonly aceptar: string;
    readonly secciones: readonly Seccion[];
  };
}

export interface DatosDelEncargado {
  readonly nombre: string | null;
  readonly identificacion: string | null;
  readonly domicilio: string | null;
  readonly correo: string | null;
  readonly telefono: string | null;
}

export interface TextoParaAceptar {
  readonly cual: CualTexto;
  readonly version: string;
  /** La frase de la casilla, que nunca viene marcada. */
  readonly aceptar: string;
  readonly secciones: readonly (readonly [titulo: string, texto: string])[];
  /** El texto entero, como se guarda su huella: títulos, textos y la frase de la casilla. */
  readonly texto: string;
}

export const POR_COMPLETAR = 'por completar';

/** El texto de los términos o de la custodia, con los datos del encargado; lo que falta dice «por completar». */
export function textoParaAceptar(
  plantilla: PlantillaDelComercio,
  encargado: DatosDelEncargado,
  cual: CualTexto,
): TextoParaAceptar {
  const valores: Record<string, string> = {
    encargado: encargado.nombre ?? `Laboratorio Digital (razón social ${POR_COMPLETAR})`,
    identificacion: encargado.identificacion ?? POR_COMPLETAR,
    domicilio: encargado.domicilio ?? POR_COMPLETAR,
    correo: encargado.correo ?? POR_COMPLETAR,
    telefono: encargado.telefono ?? POR_COMPLETAR,
  };
  const llenar = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? `{${k}}`);
  const fuente = cual === 'terminos' ? plantilla : plantilla.custodia;
  const secciones = fuente.secciones.map((s) => [s.titulo, llenar(s.texto)] as const);
  const texto = [
    `${cual} ${fuente.version}`,
    ...secciones.map(([t, x]) => `## ${t}\n\n${x}`),
    fuente.aceptar,
  ].join('\n\n');
  return { cual, version: fuente.version, aceptar: fuente.aceptar, secciones, texto: `${texto}\n` };
}

/** La huella del texto aceptado: SHA-256 en hexadecimal, igual en el navegador y en el Worker. */
export async function huellaDelTexto(texto: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
