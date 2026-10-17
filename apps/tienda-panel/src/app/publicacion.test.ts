/** HU-T10.4: dónde se arregla cada falla de la compuerta y cómo se dice cada versión. */
import { describe, expect, it } from 'vitest';
import {
  avanceDe,
  enlaceDe,
  esperaAntesDeLeer,
  resumenDe,
  sePuedeVolver,
  type VersionDelPanel,
} from './publicacion.ts';

const v = (extra: Partial<VersionDelPanel> = {}): VersionDelPanel => ({
  version: 2,
  estado: 'reemplazada',
  autor: 'Tú',
  automatica: false,
  pedida: '2026-10-15T15:00:00.000Z',
  publicada: '2026-10-15T15:00:05.000Z',
  archivos: 34,
  motivo: null,
  ...extra,
});

describe('publicar y las versiones', () => {
  it('cada falla de la compuerta lleva a donde se arregla', () => {
    expect(enlaceDe('Ajustes › Contacto')).toBe('/mas/ajustes/contacto/');
    expect(enlaceDe('Ajustes › Medición')).toBe('/mas/ajustes/medicion/');
    expect(enlaceDe('Ajustes')).toBe('/mas/ajustes/');
    expect(enlaceDe('Productos y Colecciones')).toBe('/productos/');
    expect(enlaceDe('Envíos')).toBe('/mas/venta/');
    expect(enlaceDe('Soporte')).toBeNull();
  });

  it('el resumen dice cuál ve la tienda, las automáticas y las que no salieron', () => {
    expect(resumenDe(v({ estado: 'publicada' }), 2)).toBe('La que ve la tienda · 34 archivos');
    expect(resumenDe(v({ automatica: true, autor: 'La tienda' }), 3)).toBe(
      'Existencias al día · 34 archivos',
    );
    expect(
      resumenDe(v({ estado: 'fallida', archivos: null, motivo: JSON.stringify([{}, {}]) }), 1),
    ).toBe('No se publicó: faltaba corregir 2 cosas');
    expect(resumenDe(v({ estado: 'fallida', motivo: 'R2 no respondió' }), 1)).toBe(
      'No se publicó: algo falló al subirla y la tienda siguió como estaba',
    );
    expect(resumenDe(v({ estado: 'horneando' }), 1)).toBe('Publicando…');
  });

  it('❌ no se vuelve a la que ya se ve, ni a una que no salió o que todavía se hornea', () => {
    expect(sePuedeVolver(v(), 3)).toBe(true);
    expect(sePuedeVolver(v({ estado: 'publicada' }), 2)).toBe(false);
    expect(sePuedeVolver(v({ estado: 'fallida' }), 3)).toBe(false);
    expect(sePuedeVolver(v({ estado: 'horneando' }), 3)).toBe(false);
  });

  it('❌ a una versión purgada no se vuelve, y el resumen dice por qué (bitácora tienda3 28)', () => {
    const purgada = v({ purgada: '2026-10-17T02:00:00.000Z' });
    expect(sePuedeVolver(purgada, 3)).toBe(false);
    expect(resumenDe(purgada, 3)).toBe(
      '34 archivos · Ya no se puede volver a ella: tenía más de 90 días',
    );
  });

  it('mientras se hornea, la lista se lee cada vez más espaciado, hasta un minuto (bitácora tienda3 27)', () => {
    expect([0, 1, 2, 3, 4, 5, 30].map(esperaAntesDeLeer)).toEqual([
      3000, 6000, 12_000, 24_000, 48_000, 60_000, 60_000,
    ]);
  });

  it('una tienda grande dice cuánto falta mientras sube por tandas (bitácora tienda3 30)', () => {
    expect(avanceDe(null)).toBe(
      'Publicando: revisando tu tienda, armándola y subiendo lo que cambió…',
    );
    expect(avanceDe(3421)).toBe(
      'Publicando por partes, porque tu tienda es grande: faltan 3.421 archivos. No cierres esta página.',
    );
    expect(avanceDe(1)).toContain('faltan 1 archivo.');
  });
});
