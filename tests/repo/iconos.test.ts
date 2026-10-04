import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import marca from '../../content/marca.json' with { type: 'json' };
import {
  CARPETA_ICONOS,
  cajaDe,
  cobertura,
  figuraDe,
  generar,
  ICONOS,
} from '../../scripts/generar-iconos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

describe('íconos y marca (HU-E3.1, CA4; marca CultivoPro)', () => {
  it('los del repositorio son exactamente los que genera el script (P2)', () => {
    for (const [ruta, datos] of generar()) {
      const enRepo = readFileSync(join(RAIZ, ruta));
      expect(enRepo.equals(datos), `${ruta}: corre «node scripts/generar-iconos.ts»`).toBe(true);
    }
  });

  it.each(ICONOS)('$archivo es un PNG de $lado×$lado', ({ archivo, lado }) => {
    const png = readFileSync(join(CARPETA_ICONOS, archivo));
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([lado, lado]);
  });

  it('la hoja de marca.json se lee entera: cabe en la caja de 24 y no queda vacía', () => {
    const hoja = figuraDe(marca.hoja.d);
    const caja = cajaDe(hoja);
    expect(caja.x0).toBeGreaterThanOrEqual(0);
    expect(caja.y0).toBeGreaterThanOrEqual(0);
    expect(caja.x0 + caja.ancho).toBeLessThanOrEqual(24);
    expect(caja.y0 + caja.alto).toBeLessThanOrEqual(24);
    // Rellenada en 24 × 24, la hoja cubre una parte razonable del cuadro (ni vacía ni todo).
    const total = cobertura(hoja, 24, 24).reduce((s, c) => s + c, 0);
    expect(total).toBeGreaterThan(24 * 24 * 0.25);
    expect(total).toBeLessThan(24 * 24 * 0.75);
  });

  it('control: un cuadrado de 10 × 10 cubre exactamente 100 píxeles', () => {
    const cuadrado = figuraDe('M2 2L12 2L12 12L2 12Z');
    const total = cobertura(cuadrado, 16, 16).reduce((s, c) => s + c, 0);
    expect(total).toBeCloseTo(100, 6);
  });
});
