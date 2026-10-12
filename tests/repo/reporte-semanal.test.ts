/**
 * Reporte semanal (HU-E8.3, CA3 y CA4) con Cloudflare falso: solo agregados, cada sección que no
 * se puede leer lo dice, y nunca pide nombres ni correos.
 */
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buscadorDeGoogle,
  comoMarkdown,
  consumoDeLaNube,
  cuentasDelCore,
  eventosDeHerramientas,
  tokensV1,
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

describe('Google (Search Console), con una cuenta de servicio de verdad y Google falso', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const clave = JSON.stringify({
    client_email: 'lector@proyecto.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  });
  const PROPIEDAD = 'sc-domain:cultivopro.co';
  const FILAS_TOTAL = { rows: [{ clicks: 3, impressions: 120, ctr: 0.025, position: 14.26 }] };

  /** Google falso: valida la firma del JWT y responde a cada consulta según sus dimensiones. */
  function google(opciones: { acceso?: boolean; datos?: boolean } = {}) {
    const { acceso = true, datos = true } = opciones;
    const consultas: { startDate: string; endDate: string; dimensions?: string[] }[] = [];
    let jwt: { cabecera: Record<string, string>; reclamos: Record<string, unknown> } | null = null;
    const fn = (async (url: string, init?: RequestInit) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        const asercion = new URLSearchParams(String(init?.body)).get('assertion') ?? '';
        const [h, c, f] = asercion.split('.') as [string, string, string];
        const valida = createVerify('RSA-SHA256')
          .update(`${h}.${c}`)
          .verify(publicKey, Buffer.from(f, 'base64url'));
        if (!valida) return Response.json({ error: 'invalid_grant' }, { status: 400 });
        jwt = {
          cabecera: JSON.parse(Buffer.from(h, 'base64url').toString()),
          reclamos: JSON.parse(Buffer.from(c, 'base64url').toString()),
        };
        return Response.json({ access_token: 'tok' });
      }
      if (!acceso) return Response.json({ error: { message: 'sin permiso' } }, { status: 403 });
      const cuerpo = JSON.parse(String(init?.body)) as (typeof consultas)[number];
      consultas.push(cuerpo);
      const cabeceras = (init?.headers ?? {}) as Record<string, string>;
      expect(cabeceras['authorization']).toBe('Bearer tok');
      if (!datos) return Response.json({});
      const [dimension] = cuerpo.dimensions ?? [];
      if (dimension === 'query') {
        return Response.json({
          rows: [
            { keys: ['periodo de carencia'], clicks: 2, impressions: 80, position: 9 },
            { keys: ['consulta rara de una persona'], clicks: 0, impressions: 1, position: 40 },
          ],
        });
      }
      if (dimension === 'page') {
        return Response.json({
          rows: [
            { keys: ['https://cultivopro.co/herramientas/agro/'], clicks: 3, impressions: 120 },
          ],
        });
      }
      return Response.json(
        cuerpo.startDate < '2026-09-27'
          ? { rows: [{ clicks: 1, impressions: 60, position: 20 }] }
          : FILAS_TOTAL,
      );
    }) as unknown as typeof fetch;
    return { fn, consultas, jwt: () => jwt };
  }

  it('firma el JWT con RS256 para el alcance de solo lectura y compara esta semana con la anterior', async () => {
    const g = google();
    const s = await buscadorDeGoogle(g.fn, clave, PROPIEDAD, AHORA);
    expect(g.jwt()?.cabecera).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(g.jwt()?.reclamos).toMatchObject({
      iss: 'lector@proyecto.iam.gserviceaccount.com',
      scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      aud: 'https://oauth2.googleapis.com/token',
    });
    expect(s.lineas[0]).toBe(
      '- Impresiones: 120 (antes 60) · clics: 3 (antes 1) · posición media: 14,3',
    );
    // «Esta semana» termina anteayer (Search Console tarda ~2 días): del 27/09 al 03/10 (7 días).
    expect(g.consultas[0]).toMatchObject({ startDate: '2026-09-27', endDate: '2026-10-03' });
    expect(g.consultas[1]).toMatchObject({ startDate: '2026-09-20', endDate: '2026-09-26' });
  });

  it('nombra solo las consultas con 10 impresiones o más, y las páginas propias', async () => {
    const s = await buscadorDeGoogle(google().fn, clave, PROPIEDAD, AHORA);
    expect(s.lineas.join('\n')).toContain('«periodo de carencia» (80)');
    expect(s.lineas.join('\n')).not.toContain('consulta rara');
    expect(s.lineas.at(-1)).toBe(
      '- Páginas con más impresiones: https://cultivopro.co/herramientas/agro/ (120)',
    );
  });

  it('sin datos dice por qué y no inventa ceros', async () => {
    const s = await buscadorDeGoogle(google({ datos: false }).fn, clave, PROPIEDAD, AHORA);
    expect(s.lineas).toHaveLength(1);
    expect(s.lineas[0]).toContain('Sin datos todavía');
    expect(s.lineas[0]).not.toContain('Impresiones: 0');
  });

  it('sin acceso a la propiedad dice a quién agregar; una clave rota o incompleta, también', async () => {
    const sin = await buscadorDeGoogle(google({ acceso: false }).fn, clave, PROPIEDAD, AHORA);
    expect(sin.lineas[0]).toContain(
      'lector@proyecto.iam.gserviceaccount.com no tiene acceso a sc-domain:cultivopro.co',
    );
    expect((await buscadorDeGoogle(google().fn, '{roto', PROPIEDAD, AHORA)).lineas[0]).toContain(
      'no es un JSON válido',
    );
    expect(
      (await buscadorDeGoogle(google().fn, '{"client_email":"a@b"}', PROPIEDAD, AHORA)).lineas[0],
    ).toContain('le faltan client_email o private_key');
    const otra = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    const ajena = JSON.stringify({
      client_email: 'x@y',
      private_key: otra.export({ type: 'pkcs8', format: 'pem' }).toString(),
    });
    expect((await buscadorDeGoogle(google().fn, ajena, PROPIEDAD, AHORA)).lineas[0]).toContain(
      'Google no dio acceso a la cuenta de servicio (invalid_grant)',
    );
  });

  it('el issue ya no la lista como «lo que todavía no se mide» cuando la sección existe', () => {
    const conGoogle = comoMarkdown(
      [{ titulo: 'Google (Search Console, impresiones y clics de la semana)', lineas: ['- x'] }],
      '2026-10-05',
    );
    expect(conGoogle).not.toContain('Lo que todavía no se mide');
    expect(comoMarkdown([{ titulo: 'Otra', lineas: [] }], '2026-10-05')).toContain(
      'Lo que todavía no se mide',
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

describe('HU-C4.5 · tokens v1 de la semana', () => {
  const kvs = [
    { nombre: 'c0 producción', titulo: 'agro-c0-flags' },
    { nombre: 'c0 staging', titulo: 'agro-c0-flags-staging' },
  ];
  const lista = {
    result: [
      { id: 'p', title: 'agro-c0-flags' },
      { id: 's', title: 'agro-c0-flags-staging' },
    ],
  };

  it('dice los días con marca de cada destino, y ninguno cuando no hay', async () => {
    const { fn, pedidos } = cloudflare((url) =>
      url.endsWith('namespaces?per_page=100')
        ? { estado: 200, json: lista }
        : url.includes('/s/values/tokens_v1%3A2026-10-03')
          ? { estado: 200, json: 1 }
          : { estado: 404, json: {} },
    );
    const s = await tokensV1(fn, 't', 'c', kvs, AHORA);
    expect(s.lineas).toEqual([
      '- c0 producción: ningún día con tokens v1.',
      '- c0 staging: días con tokens v1: 2026-10-03.',
    ]);
    // Una lista y siete días por destino; solo lecturas.
    expect(pedidos).toHaveLength(15);
  });

  it('un KV que no responde no se cuenta como «ningún día» (P1)', async () => {
    const { fn } = cloudflare((url) =>
      url.endsWith('namespaces?per_page=100')
        ? { estado: 200, json: lista }
        : { estado: 500, json: {} },
    );
    expect((await tokensV1(fn, 't', 'c', kvs, AHORA)).lineas[0]).toMatch(
      /^No se pudo leer: KV respondió 500/,
    );
    expect((await tokensV1(fn, '', 'c', kvs, AHORA)).lineas[0]).toMatch(
      /falta el secreto CF_API_TOKEN/,
    );
  });
});
