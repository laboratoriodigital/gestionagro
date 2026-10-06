/**
 * HU-C5.1: meses calendario en Bogotá. La misma batería corre en este proceso y en otro con
 * `TZ=Pacific/Kiritimati` (UTC+14): el resultado no depende de la zona del sistema (CA3).
 */
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CASOS_DE_MESES } from './calendario.casos.ts';
import { sumarMeses } from './calendario.ts';
import { nuevoVencimiento } from './pagos.ts';

describe('HU-C5.1 · meses calendario en Bogotá', () => {
  it.each(CASOS_DE_MESES)('$nombre', ({ desde, meses, esperado }) => {
    expect(sumarMeses(Date.parse(desde), meses)).toBe(Date.parse(esperado));
  });

  it('CA3 · la batería da lo mismo con TZ=Pacific/Kiritimati', () => {
    const modulo = new URL('./calendario.ts', import.meta.url).href;
    const casos = new URL('./calendario.casos.ts', import.meta.url).href;
    const codigo = [
      `const { sumarMeses } = await import(${JSON.stringify(modulo)});`,
      `const { CASOS_DE_MESES } = await import(${JSON.stringify(casos)});`,
      'const malos = CASOS_DE_MESES.filter((c) => sumarMeses(Date.parse(c.desde), c.meses) !== Date.parse(c.esperado)).map((c) => c.nombre);',
      'console.log(JSON.stringify({ zona: Intl.DateTimeFormat().resolvedOptions().timeZone, malos }));',
    ].join('\n');
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', codigo], {
      env: { ...process.env, TZ: 'Pacific/Kiritimati' },
      encoding: 'utf8',
    });
    expect(r.stderr).toBe('');
    expect(JSON.parse(r.stdout)).toEqual({ zona: 'Pacific/Kiritimati', malos: [] });
  });

  it('el vencimiento de un pago suma meses calendario desde hoy o desde el vencimiento vigente', () => {
    const hoy = Date.parse('2027-01-31T10:00:00-05:00');
    expect(nuevoVencimiento(null, hoy, 1)).toBe(
      new Date(Date.parse('2027-02-28T10:00:00-05:00')).toISOString(),
    );
    // Vigente hasta el 15 de marzo: un mes más es el 15 de abril, no 30 días.
    const vigente = new Date(Date.parse('2027-03-15T10:00:00-05:00')).toISOString();
    expect(nuevoVencimiento(vigente, hoy, 1)).toBe(
      new Date(Date.parse('2027-04-15T10:00:00-05:00')).toISOString(),
    );
  });
});
