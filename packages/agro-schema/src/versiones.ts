/**
 * Versiones de los registros (HU-E5.5, ADR-13, P10).
 *
 * La API acepta todas las versiones que alguna app publicada escribió y las guarda tal como
 * llegan: un dato de campo nunca se reescribe al recibirlo. Para leerlos todos igual (reportes,
 * carpeta, costos), cada versión se traduce a la vigente paso a paso: v1 → v2 → … Cada paso
 * dice qué significa el campo que falta; nunca inventa una medida (P1).
 */
import { ESQUEMAS_DE_DATOS } from './registro.ts';

/** La versión más alta de cada tipo, la que escribe la app actual. */
export const VERSION_VIGENTE: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(ESQUEMAS_DE_DATOS).map(([tipo, versiones]) => [
    tipo,
    Math.max(...Object.keys(versiones).map(Number)),
  ]),
);

type Paso = (datos: Record<string, unknown>) => Record<string, unknown>;

/** `TRADUCTORES[tipo][n]` lleva la versión n a la n + 1. Una prueba exige que no falte ninguno. */
export const TRADUCTORES: Readonly<Record<string, Readonly<Record<number, Paso>>>> = {
  riego: {
    // v2 agregó la duración. Un riego v1 no la anotó: «no se anotó», que no es 0 minutos.
    1: (d) => ({ ...d, duracionMin: null }),
  },
  aplicacion: {
    // v2 agregó la cantidad usada (HU-E7.1). Una aplicación v1 no la anotó: «no se anotó», que no
    // es 0; esa aplicación no descuenta de bodega ni suma costo, y la pantalla lo dice.
    1: (d) => ({ ...d, cantidadUsada: null }),
  },
  monitoreo: {
    // v2 agregó las plantas revisadas y afectadas. Un monitoreo v1 no las contó: nulo, no 0.
    1: (d) => ({ ...d, plantasRevisadas: null, plantasAfectadas: null }),
  },
  cosecha: {
    // v2 agregó las horas de cada persona (HU-E7.4). Una cosecha v1 no las anotó: «no se
    // anotó», que no es 0 horas; no entra al rendimiento por operario, y la pantalla lo cuenta.
    1: (d) => ({ ...d, horasPorPersona: null }),
  },
};

export class VersionSinTraductor extends Error {
  override name = 'VersionSinTraductor';
}

/** Lleva los datos de un registro de su versión a la vigente. Lanza si falta un paso. */
export function aVersionVigente(
  tipo: string,
  v: number,
  datos: unknown,
): { v: number; datos: unknown } {
  const vigente = VERSION_VIGENTE[tipo];
  if (vigente === undefined) throw new VersionSinTraductor(`Tipo de registro desconocido: ${tipo}`);
  let actual = datos as Record<string, unknown>;
  for (let n = v; n < vigente; n++) {
    const paso = TRADUCTORES[tipo]?.[n];
    if (!paso) throw new VersionSinTraductor(`Falta el traductor de ${tipo} v${n} a v${n + 1}`);
    actual = paso(actual);
  }
  return { v: vigente, datos: actual };
}
