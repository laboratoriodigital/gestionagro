/**
 * Los componentes propios del panel (HU-T3.5): un dato de una persona nunca llega completo al
 * HTML, el color de un estado siempre va con su texto, y un formulario dice todos sus errores a la
 * vez.
 */
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { cabecerasDelPanel, origenesDelCore } from '../../../../../scripts/armar-panel-tienda.ts';
import {
  DatoTapado,
  ESTADOS_DE_PEDIDO,
  Estado,
  esActual,
  taparCelular,
  taparCorreo,
  taparNombre,
  validarTodo,
} from './index.ts';

describe('datos tapados (TIENDA §12.5)', () => {
  it('el nombre: la primera palabra y la inicial de la segunda', () => {
    expect(taparNombre('Persona de Prueba')).toBe('Persona D.');
    expect(taparNombre('  persona   ensayo  ')).toBe('persona E.');
    expect(taparNombre('Persona')).toBe('Persona');
    expect(taparNombre('')).toBe('');
  });

  it('el celular: los tres primeros y los cuatro últimos, con o sin +57', () => {
    expect(taparCelular('+57 300 123 4567')).toBe('300 ••• 4567');
    expect(taparCelular('3001234567')).toBe('300 ••• 4567');
    expect(taparCelular('12')).toBe('•••');
  });

  it('el correo: la primera letra y el dominio', () => {
    expect(taparCorreo('ensayo@ejemplo.co')).toBe('e•••@ejemplo.co');
    expect(taparCorreo('sin-arroba')).toBe('•••');
  });

  it('❌ el valor completo no aparece en el HTML', () => {
    const html = render(
      <p>
        <DatoTapado tipo="nombre" valor="Persona de Prueba" />
        <DatoTapado tipo="celular" valor="+57 300 123 4567" />
        <DatoTapado tipo="correo" valor="ensayo@ejemplo.co" />
      </p>,
    );
    expect(html).not.toMatch(/Prueba|123 4567|ensayo@/);
  });
});

describe('estados de un pedido (HU-T3.5 CA1)', () => {
  it('cada estado tiene texto, y el tono va en la clase', () => {
    for (const id of Object.keys(ESTADOS_DE_PEDIDO)) {
      const { texto, tono } = ESTADOS_DE_PEDIDO[id] ?? { texto: '', tono: '' };
      expect(texto).not.toBe('');
      expect(render(<Estado id={id} />)).toBe(
        `<span class="estado estado--${tono}">${texto}</span>`,
      );
    }
  });

  it('un estado que no se conoce se muestra neutro, con su nombre', () => {
    expect(render(<Estado id="en_bodega" />)).toBe(
      '<span class="estado estado--neutro">en_bodega</span>',
    );
  });
});

describe('validarTodo', () => {
  it('devuelve todos los errores a la vez, en el orden de las reglas', () => {
    const v = { nombre: '', precio: 'x' };
    expect(
      validarTodo(v, [
        { campo: 'nombre', mirar: (x) => (x.nombre ? null : 'Escribe el nombre.') },
        { campo: 'precio', mirar: (x) => (/^\d+$/.test(x.precio) ? null : 'Escribe el precio.') },
      ]),
    ).toEqual([
      { campo: 'nombre', mensaje: 'Escribe el nombre.' },
      { campo: 'precio', mensaje: 'Escribe el precio.' },
    ]);
  });
});

describe('la navegación', () => {
  it('Inicio solo en la raíz; cada sección con sus pantallas de adentro', () => {
    expect(esActual('/', '/')).toBe(true);
    expect(esActual('/', '/pedidos/')).toBe(false);
    expect(esActual('/pedidos/', '/pedidos/1001/')).toBe(true);
  });
});

describe('las cabeceras del panel', () => {
  it('la CSP deja conectarse al mismo origen y a los dos CORE de celdas.json, nada más', () => {
    const core = origenesDelCore();
    expect(core).toHaveLength(2);
    const csp = cabecerasDelPanel(core).match(/Content-Security-Policy: (.*)/)?.[1] ?? '';
    expect(csp).toContain(`connect-src 'self' ${core.join(' ')};`);
    // HU-T13.4: Turnstile, solo su origen, como programa y como marco.
    // HU-T13.5: el programa de Bold para pagar el plan, solo como programa.
    expect(csp).toContain(
      "script-src 'self' https://challenges.cloudflare.com https://checkout.bold.co;",
    );
    expect(csp).toContain('frame-src https://challenges.cloudflare.com;');
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(cabecerasDelPanel(core)).toContain('X-Robots-Tag: noindex');
  });
});
