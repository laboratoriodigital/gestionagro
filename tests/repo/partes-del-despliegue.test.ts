/**
 * HU-C11.3 CA2 (opción B del dueño, 12 oct 2026): el despliegue va por partes, en orden, y cada
 * parte recibe solo sus secretos. La prueba ata el flujo de GitHub a `SECRETOS_DE_LA_PARTE`:
 * agregar un secreto a un paso que no lo usa la pone en rojo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  PARTES,
  parteDe,
  productosADesplegar,
  productosDeLaParte,
  SECRETOS_DE_LA_PARTE,
} from '../../scripts/lib/publicacion.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

interface Paso {
  name?: string;
  run?: string;
  env?: Record<string, string>;
}

const pasos = (
  parse(readFileSync(join(RAIZ, '.github', 'workflows', 'desplegar-destino.yml'), 'utf8')) as {
    jobs: { desplegar: { steps: Paso[] } };
  }
).jobs.desplegar.steps;

/** Los secretos que un paso recibe: los `${{ secrets.X }}` de su `env`. */
const secretosDe = (p: Paso) =>
  Object.values(p.env ?? {})
    .map((v) => /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/.exec(String(v))?.[1])
    .filter((s): s is string => Boolean(s))
    .sort();

const pasosDelDespliegue = pasos.filter((p) => p.run?.includes('scripts/desplegar.ts'));

describe('HU-C11.3 CA2 · el despliegue por partes', () => {
  it('un paso por parte, en orden: CORE, agro, parqueadero y Tienda', () => {
    expect(pasosDelDespliegue.map((p) => /--parte (\w+)/.exec(p.run ?? '')?.[1])).toEqual([
      ...PARTES,
    ]);
  });

  it.each(PARTES.map((p) => [p] as const))(
    'la parte %s recibe exactamente sus secretos',
    (parte) => {
      const paso = pasosDelDespliegue.find((p) => p.run?.includes(`--parte ${parte}`));
      expect(paso).toBeDefined();
      expect(secretosDe(paso as Paso)).toEqual([...SECRETOS_DE_LA_PARTE[parte]].sort());
    },
  );

  it('❌ · las llaves de Bold y de Google solo llegan al CORE; Telegram, al CORE y al agro', () => {
    for (const paso of pasosDelDespliegue) {
      const s = secretosDe(paso);
      const esCore = paso.run?.includes('--parte core');
      expect(s.some((x) => x.startsWith('BOLD_') || x.startsWith('GOOGLE_'))).toBe(Boolean(esCore));
      // El vigía de la celda (HU-E8.3) y los radicados de la Ley 1581 (HU-C7.7); el parqueadero y la
      // Tienda, no.
      expect(s.some((x) => x.startsWith('TELEGRAM_'))).toBe(
        Boolean(paso.run?.includes('--parte core') || paso.run?.includes('--parte agro')),
      );
      // La KEK y el secreto del despacho solo llegan a la Tienda (HU-T2.4).
      expect(s.some((x) => x === 'TIENDA_KEK_V1' || x === 'SECRETO_DESPACHO')).toBe(
        Boolean(paso.run?.includes('--parte tienda')),
      );
    }
    // Ningún otro paso del trabajo recibe secretos de Cloudflare ni de las apps.
    const otros = pasos.filter((p) => !pasosDelDespliegue.includes(p));
    expect(otros.flatMap(secretosDe)).toEqual([]);
  });

  it('una parte despliega solo su producto, si está en la lista', () => {
    const todos = productosADesplegar(undefined);
    expect([...productosDeLaParte(todos, 'core')]).toEqual(['core']);
    expect([...productosDeLaParte(todos, 'parqueadero')]).toEqual([]);
    expect([...productosDeLaParte(productosADesplegar('agro'), 'core')]).toEqual([]);
    expect([...productosDeLaParte(todos, undefined)].sort()).toEqual(['agro', 'core']);
    expect([...productosDeLaParte(todos, 'tienda')]).toEqual([]);
    expect(() => parteDe('vitrina')).toThrow(/parte desconocida/);
  });
});
