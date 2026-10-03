/**
 * Guardias de la política de tratamiento de datos (HU-E0.5) y de la CSP del cuaderno
 * (ARQUITECTURA §9). Lo que la app hace de verdad frente a la política se prueba en el navegador
 * (`tests/e2e/politica.spec.ts`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { POLITICA_VIGENTE } from '../../apps/core/src/politica.ts';
import {
  conexionesDelCuaderno,
  cspDelCuaderno,
  textoDeCabeceras,
} from '../../scripts/lib/cabeceras.ts';
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

const politicaCompleta = JSON.parse(
  readFileSync(join(RAIZ, 'content', 'agro', 'privacidad', 'politica.json'), 'utf8'),
) as { scripts_al_pagar?: string[]; encargados: { proveedor: string }[] };

describe('CSP del cuaderno (ARQUITECTURA §9)', () => {
  const csp = cspDelCuaderno(cargarCeldas());

  it('solo código propio: sin comodines, sin «unsafe-*», sin scripts de terceros', () => {
    // El programa de pago que declara la política (HU-E0.7) es lo único ajeno, y solo como script.
    const declarados = politicaCompleta.scripts_al_pagar ?? [];
    expect(declarados).toEqual(['https://checkout.bold.co']);
    expect(politicaCompleta.encargados.map((e) => e.proveedor)).toContain('Bold');
    expect(/script-src ([^;]+)/.exec(csp)?.[1]).toBe(["'self'", ...declarados].join(' '));
    const sinElPago = declarados.reduce((t, o) => t.split(o).join(''), csp);
    expect(sinElPago).not.toMatch(/\*|unsafe-|https?:(?!\/\/agro-)/);
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

describe('cabeceras de las páginas públicas (revisión de seguridad, 3 oct 2026)', () => {
  const texto = textoDeCabeceras(cargarCeldas());
  const reglas = new Map(
    texto
      .split(/\n(?=\/)/)
      .filter((b) => b.startsWith('/'))
      .map((b) => {
        const [ruta, ...lineas] = b.trim().split('\n');
        return [
          ruta ?? '',
          Object.fromEntries(
            lineas.map((l) =>
              l
                .trim()
                .split(/: (.*)/s)
                .slice(0, 2),
            ),
          ),
        ];
      }),
  );

  it.each(['/agro/app/*', '/agro/t/*', '/agro/privacidad/*', '/herramientas/*'])(
    '%s no se deja enmarcar y lleva nosniff y HTTPS obligatorio',
    (ruta) => {
      const r = reglas.get(ruta) as Record<string, string> | undefined;
      expect(r?.['Content-Security-Policy']).toContain("frame-ancestors 'none'");
      expect(r?.['Content-Security-Policy']).toContain("object-src 'none'");
      expect(r?.['X-Content-Type-Options']).toBe('nosniff');
      expect(r?.['Strict-Transport-Security']).toMatch(/^max-age=\d{8,}/);
    },
  );

  it('la página del QR, que muestra datos de afuera, solo ejecuta su script propio', () => {
    const csp = (reglas.get('/agro/t/*') as Record<string, string>)['Content-Security-Policy'];
    expect(csp).toContain("default-src 'none'");
    expect(/script-src ([^;]+)/.exec(csp ?? '')?.[1]).toBe("'self'");
  });

  it('ninguna regla pisa a otra: el cuaderno conserva su Referrer-Policy estricta', () => {
    const rutas = [...reglas.keys()];
    for (const a of rutas)
      for (const b of rutas) if (a !== b) expect(a.startsWith(b.replace('*', ''))).toBe(false);
    expect((reglas.get('/agro/app/*') as Record<string, string>)['Referrer-Policy']).toBe(
      'no-referrer',
    );
  });
});
