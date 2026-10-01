/**
 * Guardias de la política de tratamiento de datos (HU-E0.5) y de la CSP del cuaderno
 * (ARQUITECTURA §9). Lo que la app hace de verdad frente a la política se prueba en el navegador
 * (`tests/e2e/politica.spec.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLITICA_VIGENTE } from '../../apps/core/src/politica.ts';
import { conexionesDelCuaderno, cspDelCuaderno } from '../../scripts/lib/cabeceras.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const politica = JSON.parse(
  readFileSync(join(RAIZ, 'content', 'agro', 'privacidad', 'politica.json'), 'utf8'),
) as {
  version: string;
  estado: string;
  revision: string;
  responsable: Record<string, string | null>;
};

describe('política de tratamiento de datos (CA4)', () => {
  it('tiene versión y un estado conocido; el CORE pide aceptar esa misma versión (P2)', () => {
    expect(politica.version).toMatch(/^\d+$/);
    expect(['borrador', 'vigente']).toContain(politica.estado);
    expect(POLITICA_VIGENTE).toBe(politica.version);
  });

  it('no pasa a «vigente» sin los datos del responsable ni con la revisión del abogado pendiente', () => {
    if (politica.estado !== 'vigente') {
      expect(politica.revision).toBe('requiere revisión de abogado');
      return;
    }
    const faltan = Object.entries(politica.responsable).filter(([, v]) => !v?.trim());
    expect(faltan.map(([k]) => k)).toEqual([]);
    expect(politica.revision).not.toContain('requiere');
  });
});

describe('CSP del cuaderno (ARQUITECTURA §9)', () => {
  const csp = cspDelCuaderno(cargarCeldas());

  it('solo código propio: sin comodines, sin «unsafe-*», sin scripts de terceros', () => {
    expect(csp).not.toMatch(/\*|unsafe-|https?:(?!\/\/agro-)/);
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });

  it('solo se conecta al CORE y a las API de las celdas de celdas.json (P2)', () => {
    const config = cargarCeldas();
    expect(conexionesDelCuaderno(config)).toEqual(
      [
        ...new Set([
          config.core.url,
          config.core.url_staging,
          ...config.celdas.flatMap((c) => [c.api, c.api_staging]),
        ]),
      ].sort(),
    );
  });
});
