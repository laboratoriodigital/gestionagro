/** D1 local del CORE para sus pruebas (ver `@ed1/d1/local`, P17). */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';

export const baseDelCore = () =>
  baseLocal({ configuracion: 'apps/core/wrangler.jsonc', binding: 'DB', base: 'core' });

/** En orden de dependencias. */
export const vaciarCore = (db: BaseD1) =>
  vaciar(db, [
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
