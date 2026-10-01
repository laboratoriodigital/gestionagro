import { describe, expect, it } from 'vitest';
import {
  guardarLecturaPendiente,
  tomarLecturaPendiente,
  VIGENCIA_MS,
} from './lectura-pendiente.ts';

function enMemoria() {
  const datos = new Map<string, string>();
  const almacen = {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
  };
  return { datos, de: () => almacen };
}

const T0 = Date.parse('2026-12-10T15:00:00Z');

describe('lectura pendiente de la calculadora (HU-E2.7)', () => {
  it('se guarda sin finca y se toma una sola vez', () => {
    const m = enMemoria();
    guardarLecturaPendiente({ t: '24.5', hr: '70', th: '22' }, T0, m.de);
    expect(tomarLecturaPendiente(T0 + 60_000, m.de)).toEqual({ t: '24.5', hr: '70', th: '22' });
    expect(tomarLecturaPendiente(T0 + 120_000, m.de)).toBeNull();
  });

  it('vencida a las 2 horas no se usa: se fecharía con la hora equivocada (P1)', () => {
    const m = enMemoria();
    guardarLecturaPendiente({ t: '24', hr: '70' }, T0, m.de);
    expect(tomarLecturaPendiente(T0 + VIGENCIA_MS + 1, m.de)).toBeNull();
    expect(m.datos.size).toBe(0);
  });

  it('un reloj que retrocede o un dato dañado no producen valores', () => {
    const m = enMemoria();
    guardarLecturaPendiente({ t: '24', hr: '70' }, T0, m.de);
    expect(tomarLecturaPendiente(T0 - 1, m.de)).toBeNull();
    m.datos.set('gestionagro.lectura-pendiente', '{roto');
    expect(tomarLecturaPendiente(T0, m.de)).toBeNull();
    m.datos.set(
      'gestionagro.lectura-pendiente',
      JSON.stringify({ guardada: T0, t: 24, hr: '70'.repeat(10), extra: 'x' }),
    );
    expect(tomarLecturaPendiente(T0, m.de)).toEqual({ hr: '707070707070' });
  });

  it('sin almacenamiento local no falla', () => {
    const roto = () => {
      throw new Error('bloqueado');
    };
    expect(() => guardarLecturaPendiente({ t: '24' }, T0, roto)).not.toThrow();
    expect(tomarLecturaPendiente(T0, roto)).toBeNull();
  });
});
