import { describe, expect, it } from 'vitest';
import {
  asignarUbicacion,
  type CeldaDelDirectorio,
  PILOTOS_MAXIMOS,
  SinCeldaDisponible,
} from './asignacion.ts';

const celda = (id: string, extra: Partial<CeldaDelDirectorio> = {}): CeldaDelDirectorio => ({
  id,
  estado: 'activa',
  anillo_despliegue: 0,
  shards: [`agro_${id}_s1`],
  ...extra,
});

describe('asignarUbicacion (CA3)', () => {
  it('elige la celda activa con menos organizaciones', () => {
    const u = asignarUbicacion(
      [celda('c0'), celda('c1')],
      [{ celda_id: 'c0', shard: 'agro_c0_s1', organizaciones: 3 }],
      0,
    );
    expect(u).toEqual({ celda_id: 'c1', shard: 'agro_c1_s1', anillo: 1 });
  });

  it('a carga igual gana el anillo de despliegue menor y después el id, en orden numérico', () => {
    expect(
      asignarUbicacion([celda('c1', { anillo_despliegue: 1 }), celda('c2')], [], 0).celda_id,
    ).toBe('c2');
    expect(asignarUbicacion([celda('c10'), celda('c2')], [], 0).celda_id).toBe('c2');
  });

  it('dentro de la celda, el shard con menos organizaciones; a carga igual, el primero de la lista', () => {
    const c0 = celda('c0', { shards: ['agro_c0_s1', 'agro_c0_s2'] });
    expect(asignarUbicacion([c0], [], 0).shard).toBe('agro_c0_s1');
    expect(
      asignarUbicacion([c0], [{ celda_id: 'c0', shard: 'agro_c0_s1', organizaciones: 1 }], 0).shard,
    ).toBe('agro_c0_s2');
  });

  it('no elige celdas «fuera» ni celdas sin shards, aunque estén vacías', () => {
    const u = asignarUbicacion(
      [celda('c1', { estado: 'fuera' }), celda('c2', { shards: [] }), celda('c3')],
      [{ celda_id: 'c3', shard: 'agro_c3_s1', organizaciones: 50 }],
      0,
    );
    expect(u.celda_id).toBe('c3');
  });

  it(`las primeras ${PILOTOS_MAXIMOS} organizaciones son pilotos (anillo 1); las demás, anillo 2`, () => {
    expect(asignarUbicacion([celda('c0')], [], PILOTOS_MAXIMOS - 1).anillo).toBe(1);
    expect(asignarUbicacion([celda('c0')], [], PILOTOS_MAXIMOS).anillo).toBe(2);
  });

  it('sin celda posible lanza y dice por qué; nunca cae en una celda por defecto (P1)', () => {
    const intento = () =>
      asignarUbicacion([celda('c0', { estado: 'fuera' }), celda('c1', { shards: [] })], [], 0);
    expect(intento).toThrow(SinCeldaDisponible);
    expect(intento).toThrow('c0 está «fuera»; c1 no tiene shards');
    expect(() => asignarUbicacion([], [], 0)).toThrow('el directorio está vacío');
  });
});
