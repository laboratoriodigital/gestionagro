import { afterEach, describe, expect, it } from 'vitest';
import {
  CAUSAS,
  causaDe,
  cuandoVuelve,
  DATOS_A_SALVO,
  mensajeDePausa,
} from './mensajes-de-pausa.ts';

const BOGOTA_1859 = Date.UTC(2026, 9, 1, 23, 59); // 1 oct, 18:59 en Bogotá
const BOGOTA_1901 = Date.UTC(2026, 9, 2, 0, 1); // 1 oct, 19:01 en Bogotá (ya es 2 oct en UTC)

describe('HU-E8.6 · catálogo de mensajes de pausa', () => {
  it.each(CAUSAS)('«%s» dice qué pasó, que los datos están a salvo y qué hacer (CA2)', (causa) => {
    const m = mensajeDePausa(causa, { ahora: BOGOTA_1859 });
    expect(m.que.length).toBeGreaterThan(10);
    expect(m.datos).toBe(DATOS_A_SALVO);
    expect(m.hacer.length).toBeGreaterThan(10);
  });

  it('«bloqueo» y «esencial» dicen hasta qué hora, en hora de Colombia', () => {
    expect(mensajeDePausa('bloqueo', { ahora: BOGOTA_1859 }).que).toContain(
      'hasta las 19:00 de hoy (hora de Colombia)',
    );
    expect(mensajeDePausa('esencial', { ahora: BOGOTA_1901 }).que).toContain(
      'hasta las 19:00 de mañana (hora de Colombia)',
    );
  });
});

describe('CA3 · la hora de reanudación es el reinicio de la cuota, en dos husos (P8)', () => {
  const tzOriginal = process.env['TZ'];
  afterEach(() => {
    if (tzOriginal === undefined) delete process.env['TZ'];
    else process.env['TZ'] = tzOriginal;
  });

  it.each([['America/Bogota'], ['Pacific/Kiritimati']])('con el teléfono en %s', (zona) => {
    process.env['TZ'] = zona;
    expect(mensajeDePausa('bloqueo', { ahora: BOGOTA_1859 }).que).toContain('las 19:00 de hoy');
    expect(mensajeDePausa('bloqueo', { ahora: BOGOTA_1901 }).que).toContain('las 19:00 de mañana');
    // 04:30 en Bogotá son las 23:30 en Kiritimati: el día que cuenta es el de Colombia.
    expect(mensajeDePausa('bloqueo', { ahora: Date.UTC(2026, 9, 1, 9, 30) }).que).toContain(
      'las 19:00 de hoy',
    );
  });

  it('a fin de mes y de año también cambia de día bien', () => {
    expect(cuandoVuelve(Date.UTC(2027, 0, 1), Date.UTC(2026, 11, 31, 23, 30))).toBe(
      'las 19:00 de hoy',
    );
    expect(cuandoVuelve(Date.UTC(2027, 0, 2), Date.UTC(2027, 0, 1, 1))).toBe('las 19:00 de mañana');
  });
});

describe('qué causa corresponde a cada respuesta de la nube', () => {
  const resultado = (envio: object, recepcion?: object) =>
    ({ tipo: 'resultado', resultado: envio, recepcion, cuando: 0 }) as Parameters<
      typeof causaDe
    >[0];

  it.each([
    [
      'kill switch',
      resultado({ estado: 'esperar', enviados: 0, rechazados: 0, ms: 120_000, causa: 'apagado' }),
      'apagado',
    ],
    [
      'cuota agotada',
      resultado({
        estado: 'esperar',
        enviados: 0,
        rechazados: 0,
        ms: 1,
        causa: 'bloqueo',
        reanuda: '2026-10-02T00:00:00.000Z',
      }),
      'bloqueo',
    ],
    [
      '429 sin causa',
      resultado({ estado: 'esperar', enviados: 0, rechazados: 0, ms: 30_000 }),
      'espera',
    ],
    ['sin señal', resultado({ estado: 'sin-senal', enviados: 0, rechazados: 0 }), 'sin-senal'],
    [
      'protocolo viejo',
      resultado({ estado: 'error', enviados: 0, rechazados: 0, motivo: 'x', causa: 'protocolo' }),
      'app-vieja',
    ],
    [
      'pedido de actualizar',
      resultado({ estado: 'al-dia', enviados: 1, rechazados: 0, actualizar: 'vieja' }),
      'app-vieja',
    ],
    [
      'bajar en esencial',
      resultado(
        { estado: 'al-dia', enviados: 0, rechazados: 0 },
        {
          estado: 'esperar',
          recibidos: 0,
          conflictos: 0,
          ms: 60_000,
          motivo: '',
          causa: 'esencial',
        },
      ),
      'esencial',
    ],
    [
      'celda en ahorro',
      resultado(
        { estado: 'al-dia', enviados: 0, rechazados: 0 },
        { estado: 'al-dia', recibidos: 0, conflictos: 0, nivel: 'ahorro' },
      ),
      'ahorro',
    ],
  ])('%s → %s', (_caso, estado, causa) => {
    expect(causaDe(estado)?.causa).toBe(causa);
  });

  it('todo al día no es una pausa', () => {
    expect(
      causaDe(
        resultado(
          { estado: 'al-dia', enviados: 2, rechazados: 0 },
          { estado: 'al-dia', recibidos: 1, conflictos: 0 },
        ),
      ),
    ).toBeNull();
  });

  it('la hora que da la celda manda sobre la calculada', () => {
    const c = causaDe(
      resultado({
        estado: 'esperar',
        enviados: 0,
        rechazados: 0,
        ms: 1,
        causa: 'bloqueo',
        reanuda: '2026-10-02T00:00:00.000Z',
      }),
    );
    expect(c?.reanuda).toBe(Date.UTC(2026, 9, 2));
  });
});
