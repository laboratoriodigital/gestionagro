/**
 * Piezas comunes de los esquemas del parqueadero. Las reglas son las del cuaderno (P1): ningún
 * campo de dinero ni de medida tiene `default`, y «no se anotó» se escribe `null`, nunca 0.
 */
import { id } from '@ed1/ids';
import { z } from 'zod';

z.config(z.locales.es());

/** El id de todo registro y catálogo, un UUIDv7 (`@ed1/ids`, neutro). */
export { id };

export const texto = z.string().trim().min(1, 'no puede estar vacío');

/** Texto corto opcional: nulo si no se escribió, nunca la cadena vacía. */
export const notaCorta = (max: number) =>
  z.string().trim().min(1, 'si no hay nota, va nula').max(max, `es de máximo ${max} letras`);

/** Instante UTC en ISO 8601 con zona (`…Z`). */
export const instante = z.iso.datetime({ error: 'debe ser un instante ISO 8601 en UTC' });

/** Día local del parqueadero, `AAAA-MM-DD`, que además existe en el calendario. */
export const fechaLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'debe tener el formato AAAA-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'no es una fecha que exista');

/** Pesos enteros, 0 o más (las reglas de `@ed1/dinero`): nunca un decimal. */
export const pesos = z.int('debe ser un valor entero en pesos').min(0, 'no puede ser negativo');

/** La serie de una caja: de 1 a 3 letras o dígitos (anexo A, `dispositivo.serie`). */
export const serie = z.string().regex(/^[A-Z0-9]{1,3}$/, 'debe ser de 1 a 3 letras o dígitos');

/** La placa como la escribe el teclado de la caja: mayúsculas y dígitos, sin espacios. */
export const placa = z
  .string()
  .regex(/^[A-Z0-9]{1,10}$/, 'debe ser de 1 a 10 letras mayúsculas o dígitos, sin espacios');

/** Hora local `HH:MM` de 00:00 a 23:59. */
export const horaLocal = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'debe tener el formato HH:MM (00:00 a 23:59)');

/** Metadatos de un catálogo: la última escritura gana, con historial (ADR-4, anexo A). */
export const metaDeCatalogo = {
  id,
  /** Nulo mientras el parqueadero vive solo en la caja; se llena al reclamarlo (M1). */
  org_id: id.nullable(),
  version: z.int().min(1),
  actualizado: instante,
};
