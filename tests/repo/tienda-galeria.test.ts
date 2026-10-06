import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { contraste } from '../../packages/ui/src/v2/tokens.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

/**
 * La galería de la Tienda 3.0 (HU-T3.1, BACKLOG_TIENDA3 §5): prototipos estáticos de la vitrina
 * y del panel. Se mide aquí lo que §5.1 y §5.6 prometen, sobre los archivos, no sobre la vista.
 */
const DIR = join(RAIZ, 'packages', 'ui', 'galeria-tienda');
const PANTALLAS = [
  'index.html',
  'portada-editorial.html',
  'portada-catalogo.html',
  'ficha.html',
  'carrito.html',
  'seguimiento.html',
  'panel-pedidos.html',
  'panel-pedido.html',
];
const leer = (f: string) => readFileSync(join(DIR, f), 'utf8');
const gz = (texto: string) => gzipSync(texto).length;

/** Lo que una página de la Tienda no puede llevar (CSP `'self'` sin `'unsafe-inline'`, TIENDA §11.4). */
function faltasDeHtml(html: string): string[] {
  const faltas: string[] = [];
  if (!/<html lang="es-CO"/.test(html)) faltas.push('sin lang="es-CO"');
  if (!/<meta name="robots" content="noindex">/.test(html)) faltas.push('sin noindex');
  if (/<script\b/i.test(html)) faltas.push('lleva <script>');
  if (/<style\b/i.test(html)) faltas.push('lleva <style> en línea');
  if (/\sstyle=/i.test(html)) faltas.push('lleva un atributo style');
  if (/(href|src)="https?:\/\//i.test(html)) faltas.push('pide algo a un tercero');
  return faltas;
}

describe('la galería de la Tienda (HU-T3.1)', () => {
  it('tiene las pantallas de la dirección visual', () => {
    for (const f of [...PANTALLAS, 'vitrina.css', 'panel.css'])
      expect(existsSync(join(DIR, f)), f).toBe(true);
    expect(
      readdirSync(DIR)
        .filter((f) => f.endsWith('.html'))
        .sort(),
    ).toEqual([...PANTALLAS].sort());
  });

  it.each(PANTALLAS)('%s: sin scripts, sin estilos en línea, sin terceros y con noindex', (f) => {
    expect(faltasDeHtml(leer(f))).toEqual([]);
  });

  it('distingue: atrapa cada falta en una página mala', () => {
    const mala =
      '<html lang="en"><head><style>a{}</style></head><body style="x"><script src="https://x.test/a.js"></script></body></html>';
    expect(faltasDeHtml(mala)).toEqual([
      'sin lang="es-CO"',
      'sin noindex',
      'lleva <script>',
      'lleva <style> en línea',
      'lleva un atributo style',
      'pide algo a un tercero',
    ]);
  });

  it('las hojas no piden nada a un tercero', () => {
    for (const f of ['vitrina.css', 'panel.css']) {
      expect(leer(f)).not.toMatch(/url\(\s*['"]?https?:|@import/);
    }
  });

  it('dentro del presupuesto de §5.6: HTML < 50 KB y CSS ≤ 20 KB con gzip, tokens incluidos', () => {
    for (const f of PANTALLAS) expect(Buffer.byteLength(leer(f)), f).toBeLessThan(50_000);
    const tokens = readFileSync(join(RAIZ, 'packages/ui/src/v2/tokens.css'), 'utf8');
    const fuentes = readFileSync(join(RAIZ, 'packages/ui/src/v2/fuentes.css'), 'utf8');
    expect(gz(tokens + fuentes + leer('vitrina.css'))).toBeLessThanOrEqual(20_000);
    expect(gz(tokens + fuentes + leer('panel.css'))).toBeLessThanOrEqual(20_000);
  });

  it('cada acento pasa 4,5:1 sobre blanco y con su texto encima: se calcula, no se afirma (P18)', () => {
    const css = leer('vitrina.css') + leer('panel.css');
    const bloques = [...css.matchAll(/\{([^}]*--acento:\s*(#[0-9a-f]{6})[^}]*)\}/gi)];
    expect(bloques.length).toBeGreaterThanOrEqual(3);
    for (const [, cuerpo, acento] of bloques) {
      const texto = /--acento-texto:\s*(#[0-9a-f]{6})/i.exec(cuerpo ?? '')?.[1] ?? '#ffffff';
      const fondo = texto.toLowerCase() === '#ffffff' ? '#ffffff' : '#0b0b0a';
      expect(contraste(acento as string, fondo), `${acento} sobre ${fondo}`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contraste(texto, acento as string), `${texto} sobre ${acento}`).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});
