/**
 * HU-C6.3: los componentes base. Se renderizan a HTML como lo haría Astro (sin JavaScript en el
 * navegador) y se mira el HTML: estados, accesibilidad y nada que la CSP bloquee.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VNode } from 'preact';
import { render } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import {
  Aviso,
  Boton,
  Campo,
  Confirmacion,
  Contenido,
  Encabezado,
  type EstadoDeContenido,
  Etiqueta,
  Grupo,
  PaginaDeError,
  Pie,
  ResumenDeErrores,
  Tarjeta,
} from './index.ts';

const html = (v: VNode) => render(v);

const INICIO = { texto: 'Inicio', href: '/', actual: true };
const ENLACES = [INICIO, { texto: 'Seguridad', href: '/seguridad' }];

/** Una muestra de cada componente, en sus estados. */
const MUESTRAS = {
  etiqueta: <Etiqueta>RAD-2026-0001</Etiqueta>,
  'botón primario': <Boton>Guardar</Boton>,
  'botón enlace': (
    <Boton href="/seguir" variante="secundario">
      Seguir
    </Boton>
  ),
  'botón ocupado': <Boton ocupado>Guardando</Boton>,
  'botón deshabilitado': (
    <Boton deshabilitado={{ motivo: 'Primero acepta la política.', id: 'm1' }}>Continuar</Boton>
  ),
  'aviso de peligro': <Aviso tono="peligro" titulo="No se pudo guardar" />,
  tarjeta: (
    <Tarjeta titulo="Tus sesiones" pie={<Boton variante="texto">Ver todas</Boton>}>
      <p>Dos equipos.</p>
    </Tarjeta>
  ),
  campo: (
    <Campo
      id="correo"
      nombre="correo"
      etiqueta="Correo"
      tipo="email"
      requerido
      error="Falta el correo."
    />
  ),
  resumen: <ResumenDeErrores errores={[{ campo: 'correo', mensaje: 'Falta el correo.' }]} />,
  grupo: (
    <Grupo titulo="Tus datos">
      <Campo id="n" nombre="n" etiqueta="Nombre" />
    </Grupo>
  ),
  encabezado: <Encabezado marca="ED1" inicio="/" enlaces={ENLACES} />,
  pie: <Pie enlaces={ENLACES} nota="Hecho en Colombia." />,
  confirmación: (
    <Confirmacion
      abrir="Cerrar todas las sesiones"
      consecuencia="Vas a tener que entrar otra vez en cada equipo."
      confirmar="Sí, cerrarlas"
      accion="/sesiones/cerrar"
    />
  ),
  'página de error': (
    <PaginaDeError
      codigo="404"
      titulo="Esta página no existe"
      texto="Quizá cambió de lugar."
      volver={INICIO}
    />
  ),
  'contenido cargando': (
    <Contenido
      estado={{ tipo: 'cargando' }}
      titulo="Sesiones"
      vacio={{ porque: 'x' }}
      elemento={() => null}
    />
  ),
} satisfies Record<string, VNode>;

describe('HU-C6.3 · nada que la CSP bloquee', () => {
  it.each(Object.entries(MUESTRAS))(
    '%s: sin estilos en línea, sin scripts ni manejadores',
    (_, v) => {
      const h = html(v);
      expect(h).not.toMatch(/\sstyle=/);
      expect(h).not.toMatch(/<script/i);
      expect(h).not.toMatch(/\son[a-z]+=/i);
    },
  );

  it('control negativo: un estilo en línea sí se detecta', () => {
    expect(html(<p style={{ color: 'red' }}>x</p>)).toMatch(/\sstyle=/);
  });
});

describe('HU-C6.3 · botón', () => {
  it('deshabilitado dice por qué, junto al botón y asociado al lector de pantalla', () => {
    const h = html(MUESTRAS['botón deshabilitado']);
    expect(h).toContain('disabled');
    expect(h).toContain('aria-describedby="m1"');
    expect(h).toContain('id="m1"');
    expect(h).toContain('Primero acepta la política.');
  });

  it('ocupado no se puede tocar dos veces y lo anuncia', () => {
    const h = html(MUESTRAS['botón ocupado']);
    expect(h).toContain('disabled');
    expect(h).toContain('aria-busy="true"');
  });

  it('un enlace deshabilitado deja de ser enlace: no se puede seguir', () => {
    const h = html(
      <Boton href="/pagar" deshabilitado={{ motivo: 'Falta el plan.', id: 'm2' }}>
        Pagar
      </Boton>,
    );
    expect(h).not.toContain('href=');
    expect(h).toContain('<button');
  });

  it('por defecto es type="button": no envía un formulario por accidente', () => {
    expect(html(<Boton>Ver</Boton>)).toContain('type="button"');
  });
});

describe('HU-C6.3 · formulario', () => {
  it('el error va junto al campo y el campo lo anuncia', () => {
    const h = html(
      <Campo
        id="tel"
        nombre="tel"
        etiqueta="Teléfono"
        ayuda="Con indicativo."
        error="Ese número no existe."
      />,
    );
    expect(h).toContain('aria-invalid="true"');
    expect(h).toContain('aria-describedby="tel-ayuda tel-error"');
    expect(h).toContain('id="tel-error"');
    expect(h).toContain('for="tel"');
  });

  it('sin error no hay aria-invalid ni referencias colgando', () => {
    const h = html(<Campo id="tel" nombre="tel" etiqueta="Teléfono" />);
    expect(h).not.toContain('aria-invalid');
    expect(h).not.toContain('aria-describedby');
    expect(h).toContain('(opcional)');
  });

  it('el resumen muestra todos los errores a la vez, cada uno con su enlace', () => {
    const h = html(
      <ResumenDeErrores
        errores={[
          { campo: 'nombre', mensaje: 'Falta el nombre.' },
          { campo: 'correo', mensaje: 'Ese correo no parece completo.' },
          { campo: 'tel', mensaje: 'Falta el teléfono.' },
        ]}
      />,
    );
    expect(h).toContain('Falta corregir 3 cosas');
    expect(h.match(/<li>/g)).toHaveLength(3);
    expect(h).toContain('href="#correo"');
    expect(h).toContain('role="alert"');
  });

  it('sin errores, el resumen no ocupa lugar', () => {
    expect(html(<ResumenDeErrores errores={[]} />)).toBe('');
  });
});

describe('HU-C6.3 · contenido: cargando, vacío y error son distintos (CA3)', () => {
  const pintar = (estado: EstadoDeContenido<string>) =>
    html(
      <Contenido
        estado={estado}
        titulo="Sesiones"
        vacio={{
          porque: 'No tienes sesiones abiertas en otros equipos.',
          accion: <Boton>Entrar</Boton>,
        }}
        elemento={(s) => <Etiqueta>{s}</Etiqueta>}
      />,
    );

  it('mientras carga no dice «no hay»', () => {
    const h = pintar({ tipo: 'cargando' });
    expect(h).toContain('Cargando sesiones');
    expect(h).not.toContain('No tienes sesiones');
    expect(h).toContain('role="status"');
  });

  it('vacío dice por qué y qué hacer', () => {
    const h = pintar({ tipo: 'listo', elementos: [] });
    expect(h).toContain('No tienes sesiones abiertas');
    expect(h).toContain('Entrar');
  });

  it('el error dice la causa y no se confunde con vacío', () => {
    const h = pintar({ tipo: 'error', causa: 'No pudimos leer tus sesiones. Revisa tu conexión.' });
    expect(h).toContain('No pudimos leer');
    expect(h).not.toContain('No tienes sesiones');
    expect(h).toContain('role="alert"');
  });

  it('con elementos, una lista con su nombre', () => {
    const h = pintar({ tipo: 'listo', elementos: ['Portátil', 'Teléfono'] });
    expect(h).toContain('aria-label="Sesiones"');
    expect(h.match(/<li /g)).toHaveLength(2);
  });

  it('el compilador no deja construir «vacío» mientras carga', () => {
    // @ts-expect-error: «cargando» no tiene elementos; si los tuviera, la unión no protegería nada.
    const imposible: EstadoDeContenido<string> = { tipo: 'cargando', elementos: [] };
    expect(imposible.tipo).toBe('cargando');
  });
});

describe('HU-C6.3 · marco', () => {
  it('el encabezado marca la página actual y pliega el menú sin JavaScript', () => {
    const h = html(MUESTRAS.encabezado);
    expect(h).toContain('aria-current="page"');
    expect(h).toContain('<details');
    expect(h).toContain('aria-label="Principal"');
  });

  it('lo irreversible pide un segundo paso que explica la consecuencia', () => {
    const h = html(MUESTRAS.confirmación);
    expect(h).toMatch(/<details[^>]*>\s*<summary/);
    expect(h).toContain('Vas a tener que entrar otra vez');
    expect(h).toContain('method="post"');
    expect(h).toContain('type="submit"');
  });

  it('la página de error tiene un solo h1 y una salida', () => {
    const h = html(MUESTRAS['página de error']);
    expect(h.match(/<h1/g)).toHaveLength(1);
    expect(h).toContain('href="/"');
  });

  it('un aviso de peligro interrumpe; uno de éxito espera su turno', () => {
    expect(html(<Aviso tono="peligro" titulo="x" />)).toContain('role="alert"');
    expect(html(<Aviso tono="exito" titulo="x" />)).toContain('role="status"');
  });
});

describe('HU-C6.3 · la hoja de estilos', () => {
  const css = readFileSync(join(import.meta.dirname, '..', 'componentes.css'), 'utf8');

  it('cada clase que pinta un componente tiene su estilo', () => {
    const usadas = new Set(
      Object.values(MUESTRAS)
        .flatMap((v) =>
          [...html(v).matchAll(/class="([^"]+)"/g)].flatMap((m) => (m[1] ?? '').split(' ')),
        )
        .filter((c) => c.startsWith('ed1-')),
    );
    const sinEstilo = [...usadas].filter((c) => !css.includes(`.${c}`));
    expect(sinEstilo).toEqual([]);
  });

  it('los objetivos táctiles miden lo que dice el token', () => {
    expect(css.match(/min-height: var\(--objetivo-tactil\)/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
