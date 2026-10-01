import { describe, expect, it } from 'vitest';
import { crearColector, type Entorno } from './index.ts';

/** Entorno falso: cuenta las solicitudes y deja disparar el «ocultar» a mano. */
function entornoDePrueba() {
  const enviados: { url: string; datos: string }[] = [];
  const oyentes: (() => void)[] = [];
  const entorno: Entorno = {
    sendBeacon: (url, datos) => {
      enviados.push({ url, datos });
      return true;
    },
    alOcultar: (fn) => {
      oyentes.push(fn);
    },
  };
  const ocultar = () => {
    for (const fn of oyentes) fn();
  };
  return { entorno, enviados, ocultar };
}

describe('eventos en lote (HU-E1.6, CA2)', () => {
  it('una sesión completa sale en UNA sola solicitud', () => {
    const { entorno, enviados, ocultar } = entornoDePrueba();
    const c = crearColector({ producto: 'agro-calculadora-dpv', entorno });
    c.registrar('tool.opened');
    c.registrar('tool.completed');
    c.registrar('tool.shared');
    c.registrar('tool.shared');
    c.registrar('tool.next_step');
    // visibilitychange y pagehide llegan los dos al cerrar en Android: sigue siendo una.
    ocultar();
    ocultar();
    expect(enviados).toHaveLength(1);
    expect(enviados[0]?.url).toBe('/api/eventos');
    expect(JSON.parse(enviados[0]?.datos ?? '')).toEqual({
      v: 1,
      producto: 'agro-calculadora-dpv',
      eventos: { 'tool.opened': 1, 'tool.completed': 1, 'tool.shared': 2, 'tool.next_step': 1 },
    });
  });

  it('tool.completed cuenta solo la primera vez', () => {
    const { entorno } = entornoDePrueba();
    const c = crearColector({ producto: 'x', entorno });
    c.registrar('tool.completed');
    c.registrar('tool.completed');
    expect(c.pendientes()).toEqual({ 'tool.completed': 1 });
  });

  it('sin eventos no se gasta una solicitud', () => {
    const { entorno, enviados, ocultar } = entornoDePrueba();
    crearColector({ producto: 'x', entorno });
    ocultar();
    expect(enviados).toHaveLength(0);
  });

  it('lo registrado después del envío no dispara otra solicitud', () => {
    const { entorno, enviados, ocultar } = entornoDePrueba();
    const c = crearColector({ producto: 'x', entorno });
    c.registrar('tool.opened');
    ocultar();
    c.registrar('tool.completed');
    ocultar();
    expect(enviados).toHaveLength(1);
    expect(c.enviado()).toBe(true);
  });

  it('el lote no lleva nada más que producto, nombres y cuentas (P13)', () => {
    const { entorno, enviados, ocultar } = entornoDePrueba();
    const c = crearColector({ producto: 'x', entorno });
    c.registrar('tool.opened');
    ocultar();
    expect(Object.keys(JSON.parse(enviados[0]?.datos ?? '{}')).sort()).toEqual([
      'eventos',
      'producto',
      'v',
    ]);
  });
});
