/**
 * Los topes legales de cada ciudad (`content/parqueadero/topes.json`, PARQUEADERO §9.1, HU-Q1.2).
 * El CI valida el archivo con este esquema: pesos enteros, la norma y una vigencia que no sea
 * futura (CA3). La caja los lee sin zod (`apps/parqueadero-sitio/src/caja/topes.ts`).
 */
import { z } from 'zod';
import { fechaLocal, texto } from './comunes.ts';
import { NOMBRES_DE_VEHICULO } from './tipos.ts';

const pesosEnteros = z.int('debe ser un número entero de pesos').min(0);

export const topesDeCiudades = z.strictObject({
  $comentario: z.string().optional(),
  ciudades: z
    .array(
      z.strictObject({
        ciudad: texto.max(30),
        norma: texto.min(5, 'falta la norma que fija el tope'),
        vigente_desde: fechaLocal,
        /** El minuto que empieza se cobra entero (§9.1). */
        minuto_iniciado: z.boolean(),
        topes: z
          .array(
            z.strictObject({
              vehiculo: z.enum(NOMBRES_DE_VEHICULO),
              por_minuto: pesosEnteros,
              con_sello_de_oro: pesosEnteros.nullable(),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export type TopesDeCiudades = z.infer<typeof topesDeCiudades>;

/** Lo que está mal en el archivo; vacío = se puede publicar. `hoy` es `AAAA-MM-DD` (P8). */
export function problemasDeTopes(entrada: unknown, hoy: string): string[] {
  const r = topesDeCiudades.safeParse(entrada);
  if (!r.success) {
    return r.error.issues.map((i) => `«${i.path.join('.') || '(archivo)'}» ${i.message}`);
  }
  return r.data.ciudades
    .filter((c) => c.vigente_desde > hoy)
    .map(
      (c) =>
        `«${c.ciudad}» empieza a regir el ${c.vigente_desde}: una vigencia futura no se publica`,
    );
}
