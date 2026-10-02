import { describe, expect, it } from 'vitest';
import { esHerramienta } from '../../apps/sitio/src/lib/seo.ts';
import { type ContenidoLeido, leerContenido, revisarCalidad } from '../../scripts/lib/calidad.ts';
import { cargarProductos, type Producto } from '../../scripts/lib/productos.ts';

const herramientas = cargarProductos().filter(esHerramienta);
const dpv = herramientas.find((p) => p.id === 'agro-calculadora-dpv') as Producto;
const contenidoDpv = leerContenido(dpv.carpeta);

describe('control de calidad de las herramientas (ED1 §12.2)', () => {
  it('hay al menos una herramienta', () => {
    expect(herramientas.length).toBeGreaterThan(0);
  });

  it.each(herramientas.map((p) => [p.id, p] as const))('%s pasa el control', (_id, p) => {
    expect(revisarCalidad(p, leerContenido(p.carpeta))).toEqual([]);
  });
});

describe('cada regla se ve en rojo con su defecto (P5)', () => {
  const con = (cambio: (c: ContenidoLeido) => ContenidoLeido, producto: Producto = dpv) =>
    revisarCalidad(producto, cambio(structuredClone(contenidoDpv))).join(' | ');

  it('sin «Ejemplo resuelto»', () => {
    expect(
      con((c) => ({
        ...c,
        markdown: c.markdown.map((m) => m.replace('## Ejemplo resuelto', '## Ejemplo')),
      })),
    ).toContain('falta la sección «Ejemplo resuelto»');
  });

  it('con un ejemplo resuelto sin números', () => {
    expect(
      con((c) => ({
        ...c,
        markdown: c.markdown.map((m) =>
          m.includes('## Ejemplo resuelto') ? '## Ejemplo resuelto\n\nMide y escribe.\n' : m,
        ),
      })),
    ).toContain('el ejemplo resuelto no trae números');
  });

  it('con menos de 5 preguntas frecuentes', () => {
    expect(
      con((c) => ({
        ...c,
        pagina: c.pagina && { ...c.pagina, preguntas: c.pagina.preguntas.slice(0, 4) },
      })),
    ).toContain('tiene 4 preguntas frecuentes');
  });

  it('con una respuesta de relleno', () => {
    expect(
      con((c) => ({
        ...c,
        pagina: c.pagina && {
          ...c.pagina,
          preguntas: c.pagina.preguntas.map((q, i) =>
            i === 0 ? { ...q, respuesta: 'Depende.' } : q,
          ),
        },
      })),
    ).toContain('es demasiado corta');
  });

  it('sin pagina.yaml', () => {
    expect(con((c) => ({ ...c, pagina: null }))).toContain('falta pagina.yaml');
  });

  it('con una plantilla casi vacía', () => {
    expect(con((c) => ({ ...c, markdown: ['## Para qué sirve\n\nPronto.'] }))).toContain(
      'palabras; el mínimo es 300',
    );
  });

  it('con jerga interna en lo que lee el productor', () => {
    expect(
      con((c) => ({ ...c, markdown: [...c.markdown, 'Ver HU-E2.2 en packages/agro-calc.'] })),
    ).toContain('jerga interna');
  });

  it('con una fuente sin año o sin relacionados', () => {
    expect(con((c) => c, { ...dpv, fuentes: ['Un blog'] })).toContain('no tiene año');
    expect(con((c) => c, { ...dpv, relacionados: [] })).toContain('no declara relacionados');
  });
});
