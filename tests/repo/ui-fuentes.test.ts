/**
 * HU-C6.2, ADR-29: Geist y Geist Mono autoalojadas, recortadas y con su licencia. Lo que se mide
 * es lo que se descarga, no lo que se cree (P18).
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';
import {
  ajusteDeTamano,
  FUENTES,
  hojaDeFuentes,
  METRICAS,
} from '../../scripts/recortar-fuentes.ts';

const CARPETA = join(RAIZ, 'packages', 'ui', 'src', 'v2');
const TOPE_POR_FUENTE = 35 * 1024;
const TOPE_TOTAL = 70 * 1024;

describe('las fuentes autoalojadas', () => {
  it.each(FUENTES.map((f) => f.destino))('%s es woff2 y pesa menos de 35 KB', (destino) => {
    const archivo = readFileSync(join(CARPETA, 'fuentes', destino));
    expect(archivo.toString('latin1', 0, 4)).toBe('wOF2');
    expect(archivo.length).toBeLessThan(TOPE_POR_FUENTE);
  });

  it('las dos juntas pesan menos de 70 KB (el presupuesto de BACKLOG_CORE §4.7)', () => {
    const total = FUENTES.reduce(
      (suma, f) => suma + statSync(join(CARPETA, 'fuentes', f.destino)).size,
      0,
    );
    expect(total).toBeLessThan(TOPE_TOTAL);
  });

  it('la licencia SIL Open Font License va junto a los archivos', () => {
    const licencia = readFileSync(join(CARPETA, 'fuentes', 'OFL.txt'), 'utf8');
    expect(licencia).toContain('SIL Open Font License, Version 1.1');
  });
});

describe('la hoja @font-face', () => {
  const hoja = readFileSync(join(CARPETA, 'fuentes.css'), 'utf8');

  it('es la que genera el script (P2)', () => {
    expect(hoja).toBe(hojaDeFuentes());
  });

  it('solo pide fuentes del mismo origen y con font-display: swap', () => {
    const urls = [...hoja.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
    expect(urls).toEqual(FUENTES.map((f) => `./fuentes/${f.destino}`));
    expect(hoja.match(/font-display: swap;/g)).toHaveLength(FUENTES.length);
    expect(hoja).not.toMatch(/https?:\/\//);
  });

  it('el ajuste del respaldo es razonable: Geist ocupa casi lo mismo que Arial', () => {
    const ajuste = ajusteDeTamano(METRICAS.geist, METRICAS.arial);
    expect(ajuste).toBeGreaterThan(0.95);
    expect(ajuste).toBeLessThan(1.15);
    // Control negativo (bitácora core 5): con el ancho medio del TTF variable (xAvgCharWidth),
    // el ajuste salía de 131 %, y esta prueba lo atrapa.
    expect(ajusteDeTamano({ ...METRICAS.geist, ancho: 615 }, METRICAS.arial)).toBeGreaterThan(1.15);
  });

  it('los tokens nombran primero la fuente propia y después su respaldo ajustado', () => {
    const tokens = readFileSync(join(CARPETA, 'tokens.css'), 'utf8');
    expect(tokens).toContain("--fuente-sans: 'Geist', 'Geist Respaldo',");
    expect(tokens).toContain("--fuente-mono: 'Geist Mono', 'Geist Mono Respaldo',");
  });
});
