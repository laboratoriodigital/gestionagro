/**
 * HU-T3.3 y HU-T3.4: los archivos comunes de la vitrina. Las fuentes son las del ecosistema (D-T2),
 * pesan poco y no vienen de terceros; nada táctil mide menos de 48 px; la isla no trae tipos ni
 * dependencias; y la release es la huella del contenido.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { archivosDeLaVitrina } from '../../scripts/armar-vitrina.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const { release, archivos } = archivosDeLaVitrina();
const texto = (ruta: string) => archivos.get(ruta)?.toString('utf8') ?? '';

describe('la tipografía de la vitrina (HU-T3.3, D-T2)', () => {
  const fuentes = [...archivos].filter(([r]) => r.endsWith('.woff2'));

  it('son Geist y Geist Mono, las del ecosistema, con su licencia al lado', () => {
    expect(fuentes.map(([r]) => r).sort()).toEqual([
      'fuentes/geist-mono.woff2',
      'fuentes/geist.woff2',
    ]);
    expect(texto('fuentes/OFL.txt')).toContain('SIL OPEN FONT LICENSE');
  });

  it('❌ ninguna pasa de 35 KB y entre todas no pasan de 70 KB por página (CA2, CA3)', () => {
    for (const [ruta, bytes] of fuentes) expect(bytes.length, ruta).toBeLessThanOrEqual(35 * 1024);
    expect(fuentes.reduce((s, [, b]) => s + b.length, 0)).toBeLessThanOrEqual(70 * 1024);
  });

  it('❌ ninguna fuente se pide a un tercero, y el respaldo ajusta entre 95 y 115 %', () => {
    const css = texto('vitrina.css');
    expect(css).not.toMatch(/url\(\s*['"]?https?:/);
    expect(css).not.toMatch(/@import/);
    const ajustes = [...css.matchAll(/size-adjust:\s*([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(ajustes.length).toBeGreaterThan(0);
    for (const a of ajustes) expect(a).toBeGreaterThanOrEqual(95);
    for (const a of ajustes) expect(a).toBeLessThanOrEqual(115);
    expect(css).toContain('font-display: swap');
  });

  it('la hoja de la vitrina no trae otra fuente: el estilo «Editorial» es la misma Geist', () => {
    const hoja = readFileSync(join(RAIZ, 'apps/tienda-sitio/vitrina/vitrina.css'), 'utf8');
    expect(hoja).not.toMatch(/font-family:(?!\s*var\()/);
    expect(hoja).not.toMatch(/serif/i);
  });
});

describe('los componentes (HU-T3.4)', () => {
  it('❌ nada táctil mide menos de 48 px (CA4)', () => {
    const hoja = readFileSync(join(RAIZ, 'apps/tienda-sitio/vitrina/vitrina.css'), 'utf8');
    for (const selector of [
      '.pildora span',
      '.boton',
      '.franja__buscar',
      '.buscador input',
      '.coincidencia a',
      '.tarjeta a',
      '.buscar input',
    ]) {
      const i = hoja.indexOf(`${selector} {`);
      expect(i, selector).toBeGreaterThan(-1);
      const bloque = hoja.slice(i, hoja.indexOf('}', i));
      const alto = /min-height:\s*(\d+)px/.exec(bloque)?.[1];
      expect(Number(alto), selector).toBeGreaterThanOrEqual(48);
    }
  });

  it('la isla es JavaScript sin tipos, sin dependencias y entre sus propios módulos', () => {
    for (const ruta of ['vitrina.js', 'seleccion.js', 'buscar.js']) {
      const js = texto(ruta);
      expect(js.length, ruta).toBeGreaterThan(0);
      for (const m of js.matchAll(/from '([^']+)'/g)) expect(m[1]).toMatch(/^\.\/[a-z-]+\.js$/);
      expect(js).not.toMatch(/:\s*(string|number|boolean)\b[,)=]/);
    }
  });

  it('la release es la huella del contenido: la misma con los mismos archivos', () => {
    expect(release).toMatch(/^[0-9a-f]{12}$/);
    expect(archivosDeLaVitrina().release).toBe(release);
  });
});
