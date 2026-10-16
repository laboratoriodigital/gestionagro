/**
 * HU-C10.1: el adaptador de correo con Gmail por su API. Sin configuración responde «no
 * disponible» y no toca la red (CA3); cada respuesta que no sea un envío aceptado es
 * `enviado: false` con su motivo. Con un `fetch` de mentira: nada sale a la red.
 */
import { describe, expect, it } from 'vitest';
import {
  armarMensaje,
  type ConfiguracionGmail,
  type Correo,
  conCupo,
  correoGmail,
  palabrasCodificadas,
  problemaDelCorreo,
} from './index.ts';

const CONF = {
  clienteId: 'cliente-de-prueba',
  clienteSecreto: 'secreto-de-prueba',
  refresh: 'refresh-de-prueba',
  remitente: 'envios@ensayo.example',
} satisfies ConfiguracionGmail;

const CORREO: Correo = {
  para: 'compradora@ensayo.example',
  asunto: 'Tu pedido PRB234 en Comercio Ensayo Uno',
  texto: 'Hola, Ensayo Dos Compradora:\nRecibimos tu pedido.\nCalle de prueba 99',
  nombre: 'Comercio Ensayo Uno',
  responderA: 'comercio@ensayo.example',
};

type Llamada = { url: string; init: RequestInit | undefined };

/** Google de mentira: responde en orden lo que se le dé; una función lanza como la red caída. */
function googleFalso(respuestas: (Response | (() => never))[]) {
  const llamadas: Llamada[] = [];
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const r = respuestas.shift();
    if (r === undefined) throw new Error(`llamada de más a ${url}`);
    if (typeof r === 'function') r();
    return r as Response;
  }) as unknown as typeof fetch;
  return { llamadas, fetchFalso };
}

const TOKEN = () => Response.json({ access_token: 'acceso-1', expires_in: 3599 });
const ENVIADO = (id = 'msg-1') => Response.json({ id, threadId: id, labelIds: ['SENT'] });
const ERROR = (status: number, reason: string) =>
  Response.json({ error: { code: status, errors: [{ reason }], message: 'algo' } }, { status });

/** El mensaje que llegó a Gmail, decodificado del `raw` en base64url. */
function mensajeEnviado(l: Llamada): string {
  const { raw } = JSON.parse(String(l.init?.body)) as { raw: string };
  expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  return Buffer.from(raw, 'base64url').toString('utf8');
}

/** Lee las palabras codificadas de un encabezado, para comparar con el texto original. */
const leerPalabras = (h: string) =>
  [...h.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)]
    .map((m) => Buffer.from(m[1] ?? '', 'base64').toString('utf8'))
    .join('');

const encabezado = (mensaje: string, nombre: string) =>
  (mensaje.split('\r\n\r\n')[0] ?? '')
    .replace(/\r\n /g, ' ')
    .split('\r\n')
    .find((l) => l.startsWith(`${nombre}: `))
    ?.slice(nombre.length + 2);

describe('HU-C10.1 · @ed1/correo con Gmail', () => {
  it.each(['clienteId', 'clienteSecreto', 'refresh', 'remitente'] as const)(
    'CA3 ❌ · sin %s responde «no disponible» y no toca la red',
    async (falta) => {
      const g = googleFalso([TOKEN(), ENVIADO()]);
      const correo = correoGmail({ ...CONF, [falta]: undefined }, g.fetchFalso);
      expect(correo.disponible).toBe(false);
      expect(await correo.enviar(CORREO)).toEqual({
        enviado: false,
        motivo: 'no-disponible',
        detalle: 'falta la configuración de Gmail',
      });
      expect(g.llamadas).toEqual([]);
    },
  );

  it('CA1 · cambia el refresh por un acceso y envía el MIME con el nombre de la tienda y Reply-To al comercio', async () => {
    const g = googleFalso([TOKEN(), ENVIADO('msg-prb234')]);
    const correo = correoGmail(CONF, g.fetchFalso);
    expect(correo.disponible).toBe(true);
    expect(await correo.enviar(CORREO)).toEqual({ enviado: true, id: 'msg-prb234' });

    const [token, envio] = g.llamadas as [Llamada, Llamada];
    expect(token.url).toBe('https://oauth2.googleapis.com/token');
    expect(Object.fromEntries(new URLSearchParams(String(token.init?.body)))).toEqual({
      client_id: 'cliente-de-prueba',
      client_secret: 'secreto-de-prueba',
      refresh_token: 'refresh-de-prueba',
      grant_type: 'refresh_token',
    });
    expect(envio.url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(new Headers(envio.init?.headers).get('authorization')).toBe('Bearer acceso-1');

    const m = mensajeEnviado(envio);
    // Calculado aparte: base64('Comercio Ensayo Uno vía Laboratorio Digital'), 44 bytes.
    expect(encabezado(m, 'From')).toBe(
      '=?UTF-8?B?Q29tZXJjaW8gRW5zYXlvIFVubyB2w61hIExhYm9yYXRvcmlvIERpZ2l0YWw=?= <envios@ensayo.example>',
    );
    expect(encabezado(m, 'To')).toBe('<compradora@ensayo.example>');
    expect(encabezado(m, 'Reply-To')).toBe('<comercio@ensayo.example>');
    expect(leerPalabras(encabezado(m, 'Subject') ?? '')).toBe(CORREO.asunto);
    expect(encabezado(m, 'Content-Type')).toBe('text/plain; charset=UTF-8');
    const cuerpo = m.split('\r\n\r\n')[1] ?? '';
    expect(Buffer.from(cuerpo, 'base64').toString('utf8')).toBe(
      'Hola, Ensayo Dos Compradora:\r\nRecibimos tu pedido.\r\nCalle de prueba 99',
    );
  });

  it('sin nombre sale de Laboratorio Digital, y sin responderA no lleva Reply-To', () => {
    const { nombre: _n, responderA: _r, ...sinNombre } = CORREO;
    const m = armarMensaje(sinNombre, CONF.remitente);
    expect(leerPalabras(encabezado(m, 'From') ?? '')).toBe('Laboratorio Digital');
    expect(encabezado(m, 'Reply-To')).toBeUndefined();
  });

  it('reusa el acceso en el segundo envío, y con un 401 pide otro una sola vez', async () => {
    const g = googleFalso([
      TOKEN(),
      ENVIADO('a'),
      ERROR(401, 'authError'),
      Response.json({ access_token: 'acceso-2' }),
      ENVIADO('b'),
    ]);
    const correo = correoGmail(CONF, g.fetchFalso);
    expect(await correo.enviar(CORREO)).toEqual({ enviado: true, id: 'a' });
    expect(await correo.enviar(CORREO)).toEqual({ enviado: true, id: 'b' });
    expect(g.llamadas.map((l) => new URL(l.url).host)).toEqual([
      'oauth2.googleapis.com',
      'gmail.googleapis.com',
      'gmail.googleapis.com',
      'oauth2.googleapis.com',
      'gmail.googleapis.com',
    ]);
    expect(new Headers(g.llamadas[4]?.init?.headers).get('authorization')).toBe('Bearer acceso-2');
  });

  it('CA3 ❌ · ninguna respuesta que no sea un envío aceptado cuenta como enviado', async () => {
    const casos: [string, (Response | (() => never))[], string][] = [
      ['permiso vencido', [ERROR(400, 'invalid_grant')], 'no-disponible'],
      [
        'cliente equivocado',
        [Response.json({ error: 'invalid_client' }, { status: 401 })],
        'no-disponible',
      ],
      ['Google caído al pedir acceso', [new Response('', { status: 503 })], 'falla'],
      [
        'dos 401 seguidos',
        [TOKEN(), ERROR(401, 'authError'), TOKEN(), ERROR(401, 'authError')],
        'no-disponible',
      ],
      ['429', [TOKEN(), ERROR(429, 'rateLimitExceeded')], 'tope'],
      ['tope diario de Gmail', [TOKEN(), ERROR(403, 'dailyLimitExceeded')], 'tope'],
      [
        'sin el permiso gmail.send',
        [TOKEN(), ERROR(403, 'insufficientPermissions')],
        'no-disponible',
      ],
      ['destinatario rechazado', [TOKEN(), ERROR(400, 'invalidArgument')], 'rechazado'],
      ['Gmail caído', [TOKEN(), new Response('', { status: 500 })], 'falla'],
      ['200 sin id', [TOKEN(), Response.json({})], 'falla'],
      [
        'la red se cae al enviar',
        [
          TOKEN(),
          () => {
            throw new TypeError('network error');
          },
        ],
        'falla',
      ],
    ];
    for (const [caso, respuestas, motivo] of casos) {
      const g = googleFalso(respuestas);
      const r = await correoGmail(CONF, g.fetchFalso).enviar(CORREO);
      expect({ caso, r }).toMatchObject({ caso, r: { enviado: false, motivo } });
      // El detalle va al log: nunca lleva el token, el secreto ni el texto del correo.
      const detalle = r.enviado ? '' : r.detalle;
      for (const secreto of [
        'acceso-1',
        'secreto-de-prueba',
        'refresh-de-prueba',
        'Calle de prueba',
      ]) {
        expect(detalle).not.toContain(secreto);
      }
      expect(respuestas).toEqual([]);
    }
  });

  it('❌ · un salto de línea o dos direcciones no salen: no se puede colar otro encabezado', async () => {
    const malos: Correo[] = [
      { ...CORREO, asunto: 'Hola\r\nBcc: otra@ensayo.example' },
      { ...CORREO, nombre: 'Comercio\nBcc: otra@ensayo.example' },
      { ...CORREO, para: 'compradora@ensayo.example, otra@ensayo.example' },
      { ...CORREO, para: 'Ensayo Dos <compradora@ensayo.example>' },
      { ...CORREO, para: 'compradora@ensayo.example\r\nBcc: otra@ensayo.example' },
      { ...CORREO, responderA: 'comercio@ensayo.example>\r\nBcc: <otra@ensayo.example' },
      { ...CORREO, asunto: '   ' },
      { ...CORREO, texto: '' },
    ];
    const g = googleFalso([]);
    for (const c of malos) {
      expect(problemaDelCorreo(c)).not.toBeNull();
      expect(await correoGmail(CONF, g.fetchFalso).enviar(c)).toMatchObject({
        enviado: false,
        motivo: 'invalido',
      });
    }
    expect(g.llamadas).toEqual([]);
    expect(problemaDelCorreo(CORREO)).toBeNull();
  });

  it('un asunto largo se parte en palabras de 75 caracteres o menos, sin partir una letra', () => {
    const asunto = `${'Ñandú '.repeat(20)}— pedido PRB234 · ¡gracias!`;
    const h = palabrasCodificadas(asunto);
    const palabras = h.split('\r\n ');
    expect(palabras.length).toBeGreaterThan(1);
    for (const p of palabras) {
      expect(p.length).toBeLessThanOrEqual(75);
      const b = Buffer.from(p.slice(10, -2), 'base64');
      // Cada palabra decodifica sola a UTF-8 válido: ninguna corta una letra por la mitad.
      expect(new TextDecoder('utf-8', { fatal: true }).decode(b)).toBeTypeOf('string');
    }
    expect(leerPalabras(h)).toBe(asunto);
  });

  it('el cuerpo va en líneas de 76, y con html lleva las dos versiones', () => {
    const texto = 'Una línea larga del resumen diario. '.repeat(40);
    const m = armarMensaje(
      { ...CORREO, texto, html: '<p>Hola, <b>Ensayo Dos</b></p>' },
      CONF.remitente,
    );
    expect(m.split('\r\n').every((l) => l.length <= 998)).toBe(true);
    expect(encabezado(m, 'Content-Type')).toBe(
      'multipart/alternative; boundary="=_ed1_correo_alternativa"',
    );
    const partes = m.split('--=_ed1_correo_alternativa');
    expect(partes).toHaveLength(4);
    const [, plano, html] = partes as [string, string, string];
    expect(plano).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(html).toContain('Content-Type: text/html; charset=UTF-8');
    const lineas = (plano.split('\r\n\r\n')[1] ?? '').trim().split('\r\n');
    expect(lineas.every((l) => l.length <= 76)).toBe(true);
    expect(Buffer.from(lineas.join(''), 'base64').toString('utf8')).toBe(texto);
    expect(Buffer.from((html.split('\r\n\r\n')[1] ?? '').trim(), 'base64').toString('utf8')).toBe(
      '<p>Hola, <b>Ensayo Dos</b></p>',
    );
  });
});

describe('HU-C10.1 · el cupo delante del proveedor', () => {
  it('sin cupo responde «tope» y no llama a Gmail', async () => {
    const g = googleFalso([]);
    const correo = conCupo(correoGmail(CONF, g.fetchFalso), async () => false);
    expect(await correo.enviar(CORREO)).toMatchObject({ enviado: false, motivo: 'tope' });
    expect(g.llamadas).toEqual([]);
  });

  it('con cupo envía, y ni un correo mal armado ni un proveedor sin configurar lo gastan', async () => {
    let tomados = 0;
    const tomar = async () => {
      tomados++;
      return true;
    };
    const g = googleFalso([TOKEN(), ENVIADO()]);
    expect(await conCupo(correoGmail(CONF, g.fetchFalso), tomar).enviar(CORREO)).toEqual({
      enviado: true,
      id: 'msg-1',
    });
    expect(tomados).toBe(1);
    await conCupo(correoGmail(CONF, g.fetchFalso), tomar).enviar({ ...CORREO, para: 'no-es' });
    const sin = conCupo(correoGmail({}, g.fetchFalso), tomar);
    expect(sin.disponible).toBe(false);
    expect(await sin.enviar(CORREO)).toMatchObject({ enviado: false, motivo: 'no-disponible' });
    expect(tomados).toBe(1);
  });
});
