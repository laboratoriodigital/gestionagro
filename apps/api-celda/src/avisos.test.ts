/**
 * Alertas al dueño por Telegram (HU-E8.3) con Telegram falso: solo cuando cambia lo que hay que
 * decir, y si falla se reintenta en la vuelta siguiente sin silenciarse.
 */
import { describe, expect, it } from 'vitest';
import { avisarSiCambio, CLAVE_ULTIMO_AVISO, enviarTelegram, mensajeDelVigia } from './avisos.ts';
import type { KvDeFlags, Vigilancia } from './vigia.ts';
import { vueltaDelVigia } from './worker.ts';

const TELEGRAM = { token: 'token-bot', chat: '12345' };
const CONTEXTO = { celda: 'c0', destino: 'produccion', telegram: TELEGRAM };

function kvFalso(inicial: Record<string, string> = {}) {
  const valores = new Map(Object.entries(inicial));
  const kv: KvDeFlags = {
    get: async (clave) => valores.get(clave) ?? null,
    put: async (clave, valor) => {
      valores.set(clave, valor);
    },
  };
  return { kv, valores };
}

function telegramFalso(
  respuesta: { estado: number; cuerpo?: unknown } | 'sin-red' = { estado: 200 },
) {
  const enviados: { url: string; cuerpo: { chat_id: string; text: string } }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    if (respuesta === 'sin-red') throw new TypeError('Failed to fetch');
    enviados.push({ url, cuerpo: JSON.parse(String(init?.body)) });
    return Response.json(respuesta.cuerpo ?? { ok: true }, { status: respuesta.estado });
  }) as unknown as typeof fetch;
  return { fn, enviados };
}

const vigilancia = (extra: Partial<Vigilancia> = {}): Vigilancia => ({
  uso: { d1_filas_escritas: 80, workers_solicitudes: 12 },
  fallas: [],
  antes: 'alerta',
  nivel: 'ahorro',
  escrito: true,
  ...extra,
});

describe('CA1 · el mensaje dice nivel, cuota y causa', () => {
  it('con el nivel, lo que pasa, la cuota más usada y lo que no se pudo medir', () => {
    expect(mensajeDelVigia(vigilancia({ fallas: ['KV: timeout'] }), 'c0', 'produccion')).toBe(
      [
        'Celda c0: nivel AHORRO (antes alerta).',
        'Las fotos y los eventos de herramientas se pausan; los teléfonos revisan cada 60 min.',
        'Cuota más usada: filas escritas en D1, 80 % de hoy.',
        'No se pudo medir: KV: timeout.',
      ].join('\n'),
    );
    expect(mensajeDelVigia(vigilancia(), 'c0', 'staging')).toMatch(/^\[staging\] Celda c0/);
  });
});

describe('solo cuando cambia lo que hay que decir', () => {
  it('avisa una vez; la misma situación no se repite; un cambio sí', async () => {
    const { kv } = kvFalso();
    const { fn, enviados } = telegramFalso();
    expect(await avisarSiCambio(kv, vigilancia(), CONTEXTO, fn)).toBe('enviado');
    expect(await avisarSiCambio(kv, vigilancia({ escrito: false }), CONTEXTO, fn)).toBe(
      'sin-cambio',
    );
    expect(await avisarSiCambio(kv, vigilancia({ nivel: 'esencial' }), CONTEXTO, fn)).toBe(
      'enviado',
    );
    expect(enviados).toHaveLength(2);
    expect(enviados[0]?.cuerpo.chat_id).toBe('12345');
  });
});

describe('CA2 · si Telegram falla, no se silencia y se reintenta', () => {
  it.each([
    [
      { estado: 401, cuerpo: { description: 'Unauthorized' } },
      'Telegram respondió 401: Unauthorized',
    ],
    ['sin-red' as const, 'Telegram no respondió'],
  ])('%o: dice el motivo y no guarda la firma', async (respuesta, motivo) => {
    const { kv, valores } = kvFalso();
    const r = await avisarSiCambio(kv, vigilancia(), CONTEXTO, telegramFalso(respuesta).fn);
    expect(r).toContain(motivo);
    expect(valores.has(CLAVE_ULTIMO_AVISO)).toBe(false);
    // La vuelta siguiente, con Telegram de vuelta, lo envía.
    expect(await avisarSiCambio(kv, vigilancia(), CONTEXTO, telegramFalso().fn)).toBe('enviado');
  });

  it('sin token o sin chat lo dice como falla, no como «sin cambio»', async () => {
    expect(await enviarTelegram({ token: undefined, chat: '1' }, 'x')).toBe(
      'faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID',
    );
  });
});

describe('la vuelta del vigía avisa sin tumbarse', () => {
  it('mide, escribe el nivel y deja la alerta en el resultado; el token nunca va al log', async () => {
    const { kv } = kvFalso();
    const registros: string[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => registros.push(a.join(' '));
    try {
      const v = await vueltaDelVigia(
        { FLAGS: kv, CELDA: 'c0', TELEGRAM_BOT_TOKEN: 'token-secreto', TELEGRAM_CHAT_ID: '1' },
        Date.UTC(2026, 9, 1, 15),
        telegramFalso({ estado: 500 }).fn,
      );
      // Sin token de métricas: alerta, y la alerta a Telegram falló (500).
      expect(v?.nivel).toBe('alerta');
      expect(v?.aviso).toContain('Telegram respondió 500');
    } finally {
      console.error = original;
    }
    expect(registros.join('\n')).not.toContain('token-secreto');
  });
});
