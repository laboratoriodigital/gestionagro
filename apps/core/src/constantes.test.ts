import { describe, expect, it } from 'vitest';
import { killSwitchesDelCore } from './constantes.ts';

describe('los kill switches que asegura el despliegue del CORE (HU-C3.6)', () => {
  it('el de todo el CORE con sus dos nombres, el de pagos y uno por producto', () => {
    expect(killSwitchesDelCore(['agro', 'tienda'])).toEqual([
      'agro-core',
      'core',
      'core:pagos',
      'core:agro',
      'core:tienda',
    ]);
  });
});
