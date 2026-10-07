/**
 * El aviso de privacidad de la sede (HU-Q4.4; PARQUEADERO §8.3 y §13.2). El texto vive en
 * `content/parqueadero/privacidad/aviso.json` y en ningún otro lado (P2): aquí solo se llena con
 * los datos legales de la sede y se vuelve pantalla o papel.
 */
import type { Bloque } from '@ed1/impresion';
import type { Sede } from '@ed1/parqueadero-schema';
import plantilla from '../../../../content/parqueadero/privacidad/aviso.json' with { type: 'json' };

export const VERSION_DEL_AVISO: string = plantilla.version;

type DatosLegales = Pick<Sede, 'nombre' | 'nit' | 'direccion' | 'ciudad' | 'telefono'> & {
  readonly org_id?: string | null;
  readonly aviso_privacidad?: Sede['aviso_privacidad'];
};

/** La sede aceptó la versión vigente del aviso: ya puede pedir números (HU-Q4.4 CA2). */
export const avisoAceptado = (sede: Pick<Sede, 'aviso_privacidad'> | null): boolean =>
  sede?.aviso_privacidad?.version === VERSION_DEL_AVISO;

export interface AvisoArmado {
  readonly titulo: string;
  readonly parrafos: readonly string[];
  readonly politica: { readonly titulo: string; readonly secciones: readonly [string, string][] };
  readonly version: string;
}

/**
 * El aviso y la política con los datos de la sede. «sin_cuenta» solo se dice en una caja sin
 * cuenta (estudio §13.5): con `org_id`, los datos ya suben a la nube y la frase sería falsa.
 */
export function avisoDeLaSede(sede: DatosLegales): AvisoArmado {
  const aceptado = sede.aviso_privacidad?.aceptado;
  const valores: Record<string, string> = {
    nombre: sede.nombre,
    nit: sede.nit,
    direccion: sede.direccion,
    ciudad: sede.ciudad,
    telefono: sede.telefono,
    fecha_aceptacion: aceptado ? aceptado.slice(0, 10) : 'día en que la sede la acepte',
  };
  const llenar = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? '');
  const sinCuenta = !sede.org_id;
  return {
    titulo: plantilla.aviso.titulo,
    parrafos: plantilla.aviso.parrafos
      .map((p) => (p === '{sin_cuenta}' ? (sinCuenta ? plantilla.sin_cuenta : '') : llenar(p)))
      .filter(Boolean),
    politica: {
      titulo: plantilla.politica.titulo,
      secciones: plantilla.politica.secciones.map((s) => [s.titulo, llenar(s.texto)]),
    },
    version: plantilla.version,
  };
}

/** El aviso para la PT-210, para ponerlo a la vista en la caja (HU-Q4.4 CA2). */
export function bloquesDelAviso(a: AvisoArmado): Bloque[] {
  return [
    { tipo: 'texto', texto: a.titulo.toUpperCase(), alinear: 'centro', negrita: true },
    { tipo: 'regla' },
    ...a.parrafos.flatMap((p): Bloque[] => [
      { tipo: 'texto', texto: p },
      { tipo: 'espacio', lineas: 1 },
    ]),
    { tipo: 'texto', texto: `Versión ${a.version}`, alinear: 'centro' },
  ];
}
