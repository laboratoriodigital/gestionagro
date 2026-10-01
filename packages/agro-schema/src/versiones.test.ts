import { describe, expect, it } from 'vitest';
import muestras from '../contratos/app-0.1.0.json' with { type: 'json' };
import { ESQUEMAS_DE_DATOS, validarRegistro } from './registro.ts';
import { aVersionVigente, VERSION_VIGENTE, VersionSinTraductor } from './versiones.ts';

describe('traductores de versión (HU-E5.5)', () => {
  it.each(
    Object.entries(ESQUEMAS_DE_DATOS).flatMap(([tipo, versiones]) =>
      Object.keys(versiones).map((v) => [tipo, Number(v)] as const),
    ),
  )('%s v%i tiene camino hasta la versión vigente', (tipo, v) => {
    const pasos = Array.from({ length: (VERSION_VIGENTE[tipo] ?? v) - v }, (_, i) => v + i);
    expect(() => {
      for (const n of pasos) aVersionVigente(tipo, n, {});
    }).not.toThrow();
  });

  it('un riego v1 llega a v2 con la duración «no anotada», nunca 0, y valida como v2', () => {
    const riegoV1 = muestras.registros.find((r) => r.tipo === 'riego' && r.v === 1);
    if (!riegoV1) throw new Error('falta la muestra de riego v1');
    const { v, datos } = aVersionVigente('riego', 1, riegoV1.datos);
    expect(v).toBe(2);
    expect(datos).toMatchObject({ duracionMin: null });
    expect(() => validarRegistro({ ...riegoV1, v, datos })).not.toThrow();
  });

  it('cada muestra publicada, llevada a la versión vigente, valida (P10)', () => {
    for (const r of muestras.registros) {
      const vigente = aVersionVigente(r.tipo, r.v, r.datos);
      expect(() => validarRegistro({ ...r, ...vigente }), `${r.tipo} v${r.v}`).not.toThrow();
    }
  });

  it('un tipo desconocido lo dice, no inventa datos (P1)', () => {
    expect(() => aVersionVigente('inventado', 1, {})).toThrow(VersionSinTraductor);
  });
});
