/** D1 local del CORE para sus pruebas (ver `@gestionagro/d1/local`, P17). */
import type { BaseD1 } from '@gestionagro/d1';
import { baseLocal, vaciar } from '@gestionagro/d1/local';

export const baseDelCore = () =>
  baseLocal({ configuracion: 'apps/core/wrangler.jsonc', binding: 'DB', base: 'core' });

/** En orden de dependencias. */
export const vaciarCore = (db: BaseD1) =>
  vaciar(db, [
    'interes_plan',
    'invitacion',
    'membresia',
    'sesion',
    'identidad',
    'organizacion',
    'usuario',
    'celda',
  ]);
