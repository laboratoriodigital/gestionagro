/**
 * HU-T0.3: los umbrales de validación de la Tienda, escritos antes de medir (estudio §16.3 [V8]).
 * Cada métrica tiene su umbral, cada cuánto se mide y de dónde sale; lo que no se puede anticipar
 * dice por qué (CA3).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

interface Metrica {
  id: string;
  nombre: string;
  definicion: string;
  umbral?: string;
  frecuencia?: string;
  fuente?: string;
  porDefinir?: string;
}
interface Validacion {
  estado: 'propuesta' | 'fijada';
  fijada: string | null;
  metricas: Metrica[];
}

const leer = (): Validacion =>
  JSON.parse(readFileSync(join(RAIZ, 'content', 'tienda', 'validacion.json'), 'utf8'));

/** Lo que falta en una métrica; vacío si está completa. */
function faltasDe(m: Metrica): string[] {
  if (m.porDefinir !== undefined) {
    return m.porDefinir.trim().length < 40 || /por definir/i.test(m.porDefinir)
      ? [`${m.id}: dice que se define después, pero no por qué`]
      : [];
  }
  const faltas: string[] = [];
  if (!m.umbral || /por definir|pendiente|\?/i.test(m.umbral)) faltas.push(`${m.id}: sin umbral`);
  if (!m.frecuencia || !['semanal', 'mensual'].includes(m.frecuencia))
    faltas.push(`${m.id}: sin frecuencia`);
  if (!m.fuente) faltas.push(`${m.id}: sin fuente`);
  return faltas;
}

describe('los umbrales de validación (HU-T0.3)', () => {
  it('CA1: están las métricas del estudio, cada una con umbral, frecuencia y fuente', () => {
    const v = leer();
    expect(v.metricas.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        'pago-real',
        'soporte-por-comercio',
        'retencion',
        'confiabilidad-del-cobro',
        'activacion',
        'costo-por-uso',
      ]),
    );
    expect(v.metricas.flatMap(faltasDe)).toEqual([]);
    expect(new Set(v.metricas.map((m) => m.id)).size).toBe(v.metricas.length);
  });

  it('una propuesta no tiene fecha; una fijada, sí', () => {
    const v = leer();
    if (v.estado === 'fijada') expect(v.fijada).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    else expect(v.fijada).toBeNull();
  });

  it('❌ CA3: sin umbral, o con «por definir» sin motivo, no pasa', () => {
    const base = { id: 'x', nombre: 'X', definicion: 'Algo' };
    expect(faltasDe({ ...base, frecuencia: 'semanal', fuente: 'tablero' })).toEqual([
      'x: sin umbral',
    ]);
    expect(
      faltasDe({ ...base, umbral: 'por definir', frecuencia: 'semanal', fuente: 'f' }),
    ).toEqual(['x: sin umbral']);
    expect(faltasDe({ ...base, porDefinir: 'por definir' })).toEqual([
      'x: dice que se define después, pero no por qué',
    ]);
  });
});
