/**
 * Nombres que el sitio y el cuaderno comparten sin depender uno del otro (P2): si uno cambia,
 * el otro también.
 */
import { describe, expect, it } from 'vitest';
import { NOMBRE_POR_DEFECTO } from '../../apps/cuaderno/src/almacen/db.ts';
import { BASE_APP } from '../../apps/cuaderno/src/rutas.ts';
import {
  BASE_DEL_CUADERNO,
  cuadernoEnUso,
  REGISTRAR_EN_CUADERNO,
} from '../../apps/sitio/src/islas/cuaderno.ts';

describe('la calculadora apunta al cuaderno real (HU-E2.7)', () => {
  it('busca la base de IndexedDB con el nombre que usa el cuaderno', () => {
    expect(BASE_DEL_CUADERNO).toBe(NOMBRE_POR_DEFECTO);
  });

  it('reconoce el cuaderno aunque la finca activa sea otra (HU-E4.7), y nada más', async () => {
    const con = (nombres: string[]) =>
      ({ databases: async () => nombres.map((name) => ({ name, version: 1 })) }) as IDBFactory;
    expect(await cuadernoEnUso(con([BASE_DEL_CUADERNO]))).toBe(true);
    expect(await cuadernoEnUso(con([`${NOMBRE_POR_DEFECTO}-0193a`]))).toBe(true);
    expect(await cuadernoEnUso(con(['gestionagro-cuadernos', 'otra']))).toBe(false);
  });

  it('lleva la lectura a la ruta Registrar del cuaderno', () => {
    expect(REGISTRAR_EN_CUADERNO).toBe(`${BASE_APP}registrar/`);
  });
});
