/** D1 local del CORE para sus pruebas (ver `@ed1/d1/local`, P17). */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, type Instrumento, vaciar } from '@ed1/d1/local';

/** `instrumento`: lo piden las pruebas que prueban D1 mismo (HU-C11.7); las demás usan el de turno. */
export const baseDelCore = (instrumento?: Instrumento) =>
  baseLocal({
    configuracion: 'apps/core/wrangler.jsonc',
    binding: 'DB',
    base: 'core',
    ...(instrumento ? { instrumento } : {}),
  });

/** En orden de dependencias. */
export const vaciarCore = (db: BaseD1) =>
  vaciar(db, [
    'auditoria',
    'pago',
    'interes_plan',
    'invitacion',
    'membresia',
    'sesion',
    'aceptacion_politica',
    'identidad',
    'organizacion',
    'usuario',
    'celda',
  ]);
