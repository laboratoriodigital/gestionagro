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

/** El nombre con que el texto nombra al encargado mientras su razón social no está (HU-T18.6). */
export const NOMBRE_DEL_ENCARGADO = 'Laboratorio Digital';

const ETIQUETAS_DEL_ENCARGADO: Readonly<Record<keyof DatosDelEncargado, string>> = {
  nombre: 'razón social',
  identificacion: 'identificación',
  domicilio: 'domicilio',
  correo: 'correo',
  telefono: 'teléfono',
};

/**
 * HU-T18.6 CA2: los datos del encargado que faltan, en palabras. El texto sale sin ellos; esta
 * lista es la que el dueño completa en `content/tienda/privacidad/politica.json`.
 */
export const datosQueFaltan = (e: DatosDelEncargado): string[] =>
  (Object.keys(ETIQUETAS_DEL_ENCARGADO) as (keyof DatosDelEncargado)[])
    .filter((k) => !e[k])
    .map((k) => ETIQUETAS_DEL_ENCARGADO[k]);

/** Los datos de quien responde que sí están, con su etiqueta, en orden: la política los muestra así. */
export const datosQueHay = (e: DatosDelEncargado): [etiqueta: string, valor: string][] =>
  (
    [
      ['Nombre', e.nombre],
      ['Identificación', e.identificacion],
      ['Domicilio', e.domicilio],
      ['Correo', e.correo],
      ['Teléfono', e.telefono],
    ] as const
  ).flatMap(([etiqueta, valor]) => (valor ? [[etiqueta, valor] as [string, string]] : []));

/**
 * Un texto con sus `{campo}` llenos. HU-T18.6 CA2: un dato que falta no se inventa ni se deja a la
 * vista; su frase («teléfono {telefono}») se omite de la lista separada por comas que la lleva.
 */
export function llenarConLoQueHay(
  texto: string,
  valores: Readonly<Record<string, string | null>>,
): string {
  const falta = (frase: string) =>
    [...frase.matchAll(/\{(\w+)\}/g)].some((m) => !valores[m[1] as string]);
  const punto = texto.endsWith('.') ? '.' : '';
  const frases = (punto ? texto.slice(0, -1) : texto).split(', ').filter((f) => !falta(f));
  return `${frases.join(', ')}${punto}`.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? '');
}

/** El texto de los términos o de la custodia, con los datos del encargado que hay (HU-T18.6 CA2). */
export function textoParaAceptar(
  plantilla: PlantillaDelComercio,
  encargado: DatosDelEncargado,
  cual: CualTexto,
): TextoParaAceptar {
  const valores: Record<string, string | null> = {
    encargado: encargado.nombre ?? NOMBRE_DEL_ENCARGADO,
    identificacion: encargado.identificacion,
    domicilio: encargado.domicilio,
    correo: encargado.correo,
    telefono: encargado.telefono,
  };
  const llenar = (t: string) => llenarConLoQueHay(t, valores);
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
