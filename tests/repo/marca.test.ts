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

  it('el título del cuaderno dice la marca antes de que cargue el código', () => {
    const html = readFileSync(join(RAIZ, 'apps', 'cuaderno', 'index.html'), 'utf8');
    expect(html).toContain(`<title>${marca.nombre} · ${marca.cuaderno}</title>`);
  });
});
