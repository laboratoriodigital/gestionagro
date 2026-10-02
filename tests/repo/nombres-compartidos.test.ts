/**
 * Nombres que el sitio y el cuaderno comparten sin depender uno del otro (P2): si uno cambia,
 * el otro también.
 */
import { describe, expect, it } from 'vitest';
import { NOMBRE_POR_DEFECTO } from '../../apps/cuaderno/src/almacen/db.ts';
import { BASE_APP } from '../../apps/cuaderno/src/rutas.ts';
import { BASE_DEL_CUADERNO, REGISTRAR_EN_CUADERNO } from '../../apps/sitio/src/islas/cuaderno.ts';

describe('la calculadora apunta al cuaderno real (HU-E2.7)', () => {
  it('busca la base de IndexedDB con el nombre que usa el cuaderno', () => {
    expect(BASE_DEL_CUADERNO).toBe(NOMBRE_POR_DEFECTO);
  });

  it('lleva la lectura a la ruta Registrar del cuaderno', () => {
    expect(REGISTRAR_EN_CUADERNO).toBe(`${BASE_APP}registrar/`);
  });
});
