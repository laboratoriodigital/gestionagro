/**
 * Reporte semanal (HU-E8.3, CA3 y CA4) con Cloudflare falso: solo agregados, cada sección que no
 * se puede leer lo dice, y nunca pide nombres ni correos.
 */
import { describe, expect, it } from 'vitest';
import {
  comoMarkdown,
  consumoDeLaNube,
  cuentasDelCore,
  eventosDeHerramientas,
} from '../../scripts/reporte-semanal.ts';

const AHORA = Date.UTC(2026, 9, 5, 12);

function cloudflare(responder: (url: string, cuerpo: string) => { estado: number; json: unknown }) {
  const pedidos: { url: string; cuerpo: string }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const cuerpo = String(init?.body ?? '');
    pedidos.push({ url, cuerpo });
    const r = responder(url, cuerpo);
    return Response.json(r.json, { status: r.estado });
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

describe('herramientas: eventos agregados por producto, esta semana y la anterior', () => {
  it('suma con el intervalo de muestreo y compara con la semana anterior', async () => {
    const { fn, pedidos } = cloudflare((_u, sql) => ({
      estado: 200,
      json: {
        data: sql.includes("INTERVAL '14'")
          ? [{ producto: 'agro-calculadora-dpv', e0: 80, e1: 30, e2: 2, e3: 1 }]
          : [{ producto: 'agro-calculadora-dpv', e0: 120, e1: 45, e2: 5, e3: 3 }],
      },
    }));
    const s = await eventosDeHerramientas(fn, 't', 'c', 'agro_eventos');
    expect(s.lineas).toEqual([
      '- agro-calculadora-dpv: tool.opened 120 (antes 80) · tool.completed 45 (antes 30) · tool.shared 5 (antes 2) · tool.next_step 3 (antes 1) · completado 38 % (antes 38 %)',
    ]);
    expect(pedidos[0]?.cuerpo).toContain('SUM(_sample_interval * double1)');
  });

  it('un dataset con un nombre raro no se mete en el SQL', async () => {
    const { fn, pedidos } = cloudflare(() => ({ estado: 200, json: { data: [] } }));
    const s = await eventosDeHerramientas(fn, 't', 'c', 'x; DROP');
    expect(s.lineas[0]).toContain('nombre de dataset inválido');
    expect(pedidos).toEqual([]);
  });
});

describe('cuentas del CORE: solo conteos', () => {
  it('cuentas, nuevas, fincas, equipo y retorno a 30 días; la consulta no pide nombres ni correos', async () => {
    const { fn, pedidos } = cloudflare((url) =>
      url.includes('?name=')
        ? { estado: 200, json: { result: [{ uuid: 'db-1', name: 'agro_core' }] } }
        : {
            estado: 200,
            json: {
              result: [
                {
                  results: [
                    {
                      cuentas: 12,
                      nuevas: 3,
                      fincas: 4,
                      equipo: 5,
                      antiguas: 8,
                      volvieron: 6,
                      interesadas: 3,
                      interes_finca: 2,
                      interes_exportador: 1,
                      interes_cadena: 0,
                    },
                  ],
                },
              ],
            },
          },
    );
    const s = await cuentasDelCore(fn, 't', 'c', 'agro_core', AHORA);
    expect(s.lineas).toEqual([
      '- Cuentas: 12 (nuevas esta semana: 3)',
      '- Fincas en la nube: 4 · personas invitadas a equipos: 5',
      '- Retorno a 30 días (cuentas de más de 30 días que usaron la app en los últimos 30): 6 de 8 (75 %)',
      '- Intención de pago (tocaron «Me interesa» en la lista de espera): 3 fincas de 12 cuentas (25 %) · Finca 2, Exportador 1, Cadena 0',
    ]);
    const consulta = JSON.parse(pedidos[1]?.cuerpo ?? '{}') as { sql: string };
    expect(consulta.sql).not.toMatch(/\bnombre\b|\bemail\b/);
  });

  it('una base que no existe o no responde se dice, no se reporta como cero', async () => {
    const vacia = cloudflare(() => ({ estado: 200, json: { result: [] } }));
    expect((await cuentasDelCore(vacia.fn, 't', 'c', 'agro_core', AHORA)).lineas).toEqual([
      'No se pudo leer: no existe la base agro_core.',
    ]);
    const caida = cloudflare(() => ({ estado: 403, json: {} }));
    expect((await cuentasDelCore(caida.fn, 't', 'c', 'agro_core', AHORA)).lineas[0]).toContain(
      'D1 respondió 403',
    );
  });
});

describe('consumo de la nube y el issue', () => {
  it('suma la semana con las consultas del vigía y dice las fallas', async () => {
    const { fn, pedidos } = cloudflare((_u, cuerpo) =>
      cuerpo.includes('workersInvocationsAdaptive')
        ? {
            estado: 200,
            json: {
              data: {
                viewer: {
                  accounts: [{ workersInvocationsAdaptive: [{ sum: { requests: 7000 } }] }],
                },
              },
            },
          }
        : { estado: 200, json: { data: null, errors: [{ message: 'unknown field' }] } },
    );
    const s = await consumoDeLaNube(fn, 't', 'c', AHORA);
    expect(s.lineas).toEqual([
      '- workers solicitudes: 7.000 en la semana (1.000 al día)',
      '- D1: no se pudo leer (unknown field)',
    ]);
    expect(JSON.parse(pedidos[0]?.cuerpo ?? '{}').variables.desde).toBe('2026-09-28T12:00:00.000Z');
  });

  it('el issue dice que son solo agregados y lo que todavía no se mide', () => {
    const md = comoMarkdown([{ titulo: 'Prueba', lineas: ['- uno'] }], '2026-10-05');
    expect(md).toContain('Solo métricas agregadas: ningún dato de fincas ni de personas.');
    expect(md).toContain('## Prueba');
    expect(md).toContain('Search Console');
    // La intención de pago ya se mide (HU-E0.6): no figura como pendiente.
    expect(md).not.toContain('Intención de pago: llega');
  });
});
