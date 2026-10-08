/**
 * Los términos de la nube y el contrato de transmisión en la caja (HU-Q7.11; PARQUEADERO §13.2).
 * El texto vive en `content/parqueadero/privacidad/terminos.json` y los datos del encargado en
 * `politica.json` (P2): aquí solo se arman y se guarda cuándo se aceptaron.
 *
 * - **CA1:** antes de entrar con la cuenta, la caja dice qué sube a la nube y qué no, y pide
 *   aceptarlos. La aceptación queda en `meta` con su versión y su hora, y la celda la guarda en la
 *   fila de la caja (`registrarTerminos`), una vez por versión.
 * - **CA3:** una caja vinculada sin la versión vigente no sincroniza (`nube.ts`) y lo dice; la
 *   celda tampoco la atiende (`?terminos=` en cada pedido).
 */
import politica from '../../../../content/parqueadero/privacidad/politica.json' with {
  type: 'json',
};
import plantilla from '../../../../content/parqueadero/privacidad/terminos.json' with {
  type: 'json',
};
import type { BaseDeLaCaja } from './datos.ts';

export const VERSION_DE_LOS_TERMINOS: string = plantilla.version;

/** Lo que se muestra antes de aceptar. */
export interface Terminos {
  readonly version: string;
  readonly sube: readonly string[];
  readonly noSale: readonly string[];
  readonly aceptar: string;
  readonly secciones: readonly (readonly [string, string])[];
}

const POR_COMPLETAR = 'por completar';

/** Los términos con los datos del encargado; lo que falta en `politica.json` dice «por completar». */
export function terminos(): Terminos {
  const r = politica.responsable;
  const valores: Record<string, string> = {
    encargado: r.nombre ?? `Laboratorio Digital (razón social ${POR_COMPLETAR})`,
    identificacion: r.identificacion ?? POR_COMPLETAR,
    domicilio: r.domicilio ?? POR_COMPLETAR,
    correo: r.correo ?? POR_COMPLETAR,
    telefono: r.telefono ?? POR_COMPLETAR,
  };
  const llenar = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => valores[k] ?? '');
  return {
    version: plantilla.version,
    sube: plantilla.sube,
    noSale: plantilla.no_sale,
    aceptar: plantilla.aceptar,
    secciones: plantilla.secciones.map((s) => [s.titulo, llenar(s.texto)] as const),
  };
}

export type EstadoDeLosTerminos =
  /** Aceptó la vigente y la celda ya la tiene. */
  | 'al-dia'
  /** Aceptó la vigente; falta dejarla dicha en la celda. */
  | 'por-registrar'
  /** Nunca los aceptó, o aceptó una versión anterior. */
  | 'sin-aceptar';

export async function estadoDeLosTerminos(
  db: Pick<BaseDeLaCaja, 'meta'>,
): Promise<EstadoDeLosTerminos> {
  const m = await db.meta.get('terminos');
  if (m?.clave !== 'terminos' || m.version !== VERSION_DE_LOS_TERMINOS) return 'sin-aceptar';
  return m.registrados === VERSION_DE_LOS_TERMINOS ? 'al-dia' : 'por-registrar';
}

/** Quien está en la caja aceptó la versión vigente, en nombre del parqueadero (CA1). */
export async function aceptarTerminos(
  db: Pick<BaseDeLaCaja, 'meta'>,
  ahora: () => number,
): Promise<void> {
  await db.meta.put({
    clave: 'terminos',
    version: VERSION_DE_LOS_TERMINOS,
    aceptados: ahora(),
    registrados: null,
  });
}

/** Un pedido a la celda dice qué versión aceptó la caja; los del CORE no la llevan. */
export const conTerminos = (url: string): string =>
  url.includes('/api/v1/')
    ? `${url}${url.includes('?') ? '&' : '?'}terminos=${encodeURIComponent(VERSION_DE_LOS_TERMINOS)}`
    : url;

/**
 * Deja dicho en la celda cuándo se aceptaron (CA1). `true` si quedó; `false` si la celda todavía
 * no conoce la caja (se intenta en la vuelta siguiente). Lanza sin señal.
 */
export async function registrarTerminos(
  db: Pick<BaseDeLaCaja, 'meta'>,
  destino: { readonly api: string; readonly acceso: string; readonly dispositivo: string },
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const m = await db.meta.get('terminos');
  if (m?.clave !== 'terminos' || m.version !== VERSION_DE_LOS_TERMINOS) return false;
  const r = await fetchFn(conTerminos(`${destino.api}/api/v1/terminos`), {
    method: 'POST',
    headers: { authorization: `Bearer ${destino.acceso}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      dispositivo: destino.dispositivo,
      version: m.version,
      aceptados: new Date(m.aceptados).toISOString(),
    }),
  });
  if (!r.ok) return false;
  await db.meta.put({ ...m, registrados: m.version });
  return true;
}
