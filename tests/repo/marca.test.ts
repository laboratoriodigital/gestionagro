/**
 * La marca pública vive en `content/marca.json` (P2): CultivoPro desde el 3 oct 2026. Ningún
 * archivo de las apps dice el nombre anterior, y lo que el teléfono muestra antes de cargar el
 * código (el título de la pestaña) dice la marca.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import marca from '../../content/marca.json' with { type: 'json' };
import { RAIZ } from '../../scripts/lib/repo.ts';

const ANTERIOR = /Gesti[oó]n Agro/i;
const EXTENSIONES = /\.(ts|tsx|astro|html|json|yaml|css|md)$/;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    if (['node_modules', 'dist', '.wrangler', '.astro'].includes(nombre)) return [];
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return EXTENSIONES.test(nombre) ? [ruta] : [];
  });
}

describe('la marca (content/marca.json)', () => {
  it('es CultivoPro', () => {
    expect(marca.nombre).toBe('CultivoPro');
  });

  it('ningún archivo de las apps ni del contenido dice el nombre anterior', () => {
    const conElAnterior = [...archivos(join(RAIZ, 'apps')), ...archivos(join(RAIZ, 'content'))]
      .filter((f) => !f.endsWith('marca.json'))
      .filter((f) => ANTERIOR.test(readFileSync(f, 'utf8')));
    expect(conElAnterior).toEqual([]);
  });

  it('el sitio tiene favicon, y los archivos del logo están donde los enlaza la guía del vendedor', () => {
    const base = readFileSync(join(RAIZ, 'apps', 'sitio', 'src', 'layouts', 'Base.astro'), 'utf8');
    expect(base).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml" />');
    const publico = join(RAIZ, 'apps', 'sitio', 'public');
    expect(statSync(join(publico, 'favicon.svg')).size).toBeGreaterThan(0);
    for (const f of [
      'cultivopro-hoja.svg',
      'cultivopro-hoja-512.png',
      'cultivopro-icono.svg',
      'cultivopro-icono-512.png',
      'cultivopro-logo.svg',
      'cultivopro-logo-1560.png',
      'cultivopro-logo-blanco.svg',
      'cultivopro-logo-blanco-1560.png',
    ]) {
      expect(statSync(join(publico, 'marca', f)).size, f).toBeGreaterThan(0);
    }
  });

  it('el título del cuaderno dice la marca antes de que cargue el código', () => {
    const html = readFileSync(join(RAIZ, 'apps', 'cuaderno', 'index.html'), 'utf8');
    expect(html).toContain(`<title>${marca.nombre} · ${marca.cuaderno}</title>`);
  });
});
