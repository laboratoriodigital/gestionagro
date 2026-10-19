/**
 * HU-T14.3 (PLATAFORMA §4.11): el permiso de Gmail se da una vez con un script. Sin Google, GitHub
 * ni teclado: el «navegador» de mentira vuelve al servidor de 127.0.0.1 como lo haría Google, y el
 * canje del código es un `fetch` de mentira. Los cuatro secretos van a `gh` por stdin y ninguno sale
 * en lo que el script dice. Cada caso malo es su control negativo (P5).
 */
import { describe, expect, it } from 'vitest';
import {
  ALCANCES,
  correoDelIdToken,
  darPermiso,
  type Mundo,
} from '../../scripts/correo/permiso-de-gmail.ts';
import { CORREO_GMAIL } from '../../scripts/lib/publicacion.ts';

const ID = '1234-abc.apps.googleusercontent.com';
const SECRETO = 'GOCSPX-secreto-de-prueba';
const REFRESH = '1//refresh-de-prueba';

const idToken = (carga: object) =>
  `e30.${Buffer.from(JSON.stringify(carga)).toString('base64url')}.firma`;

interface Opciones {
  ghLee?: boolean;
  ghGuarda?: boolean;
  /** Lo que Google pone en la vuelta: `code` o `error`. */
  vuelta?: Record<string, string>;
  /** Cambia el `state` de la vuelta, como un tercero que adivina. */
  otroState?: boolean;
  canje?: { status?: number; cuerpo: Record<string, unknown> };
  pruebaStatus?: number;
  id?: string;
}

function mundo(o: Opciones = {}) {
  const guardados: Record<string, string> = {};
  const dicho: string[] = [];
  const pedidos: { url: string; cuerpo: URLSearchParams }[] = [];
  let autorizar: URL | null = null;
  const respuestas = [o.id ?? ID, SECRETO];
  const m: Mundo = {
    gh(argumentos, entrada) {
      if (argumentos[1] === 'list') {
        return o.ghLee === false ? { ok: false, salida: 'HTTP 404' } : { ok: true, salida: '[]' };
      }
      if (o.ghGuarda === false) return { ok: false, salida: 'HTTP 403: sin permiso' };
      guardados[argumentos[2] ?? ''] = entrada ?? '';
      return { ok: true, salida: '' };
    },
    preguntar: async () => respuestas.shift() ?? '',
    abrir(url) {
      autorizar = new URL(url);
      const vuelta = new URL(autorizar.searchParams.get('redirect_uri') ?? '');
      const state = o.otroState ? 'otro' : (autorizar.searchParams.get('state') ?? '');
      for (const [k, v] of Object.entries({ state, ...(o.vuelta ?? { code: 'codigo-1' }) }))
        vuelta.searchParams.set(k, v);
      void fetch(vuelta).then(async (r) => {
        await r.text();
        // Tras un `state` ajeno, Google vuelve con el de verdad.
        if (o.otroState) {
          vuelta.searchParams.set('state', autorizar?.searchParams.get('state') ?? '');
          await (await fetch(vuelta)).text();
        }
      });
    },
    decir: (t) => dicho.push(t),
    async fetch(url, init) {
      const cuerpo = new URLSearchParams(String(init?.body ?? ''));
      pedidos.push({ url, cuerpo });
      if (cuerpo.get('grant_type') === 'refresh_token') {
        return new Response('{"access_token":"a"}', { status: o.pruebaStatus ?? 200 });
      }
      const c = o.canje ?? {
        cuerpo: {
          refresh_token: REFRESH,
          scope: ALCANCES,
          id_token: idToken({ email: 'envios@ensayo.example', email_verified: true }),
        },
      };
      return new Response(JSON.stringify(c.cuerpo), { status: c.status ?? 200 });
    },
  };
  return { m, guardados, dicho, pedidos, autorizar: () => autorizar };
}

describe('el permiso de Gmail (HU-T14.3)', () => {
  it('pide gmail.send con PKCE, comprueba el permiso y guarda los cuatro secretos por stdin', async () => {
    const w = mundo();
    const r = await darPermiso('staging', w.m);
    expect(r).toEqual({ ok: true, remitente: 'envios@ensayo.example' });
    expect(w.guardados).toEqual({
      CORREO_GMAIL_CLIENTE_ID: ID,
      CORREO_GMAIL_CLIENTE_SECRETO: SECRETO,
      CORREO_GMAIL_REFRESH: REFRESH,
      CORREO_GMAIL_REMITENTE: 'envios@ensayo.example',
    });
    expect(Object.keys(w.guardados)).toEqual([...CORREO_GMAIL]);
    const a = w.autorizar();
    expect(a?.origin + (a?.pathname ?? '')).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(a?.searchParams.get('scope')).toBe(ALCANCES);
    expect(a?.searchParams.get('access_type')).toBe('offline');
    expect(a?.searchParams.get('code_challenge_method')).toBe('S256');
    expect(a?.searchParams.get('redirect_uri')).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    // El verificador del canje es el del reto, y el permiso se prueba como lo hará el Worker.
    const [canje, prueba] = w.pedidos;
    expect(canje?.cuerpo.get('code')).toBe('codigo-1');
    expect(canje?.cuerpo.get('code_verifier')).toHaveLength(64);
    expect(prueba?.cuerpo.get('refresh_token')).toBe(REFRESH);
    // Ningún secreto sale en lo que dice el script.
    const todo = w.dicho.join('\n');
    for (const s of [SECRETO, REFRESH]) expect(todo).not.toContain(s);
  });

  it('una vuelta con otro state no cuenta: espera la de Google', async () => {
    const w = mundo({ otroState: true });
    expect((await darPermiso('staging', w.m)).ok).toBe(true);
    expect(w.pedidos.filter((p) => p.cuerpo.get('code'))).toHaveLength(1);
  });

  it('sin gh o con un cliente mal copiado, no abre el navegador', async () => {
    const sinGh = mundo({ ghLee: false });
    expect((await darPermiso('staging', sinGh.m)).motivo).toMatch(/gh auth status/);
    const malId = mundo({ id: 'no-es-un-cliente' });
    expect((await darPermiso('staging', malId.m)).motivo).toMatch(/googleusercontent/);
    expect(sinGh.autorizar()).toBeNull();
    expect(malId.autorizar()).toBeNull();
  });

  it('si Google niega el permiso o el canje falla, no guarda nada', async () => {
    const casos: [Opciones, RegExp][] = [
      [{ vuelta: { error: 'access_denied' } }, /access_denied/],
      [{ canje: { status: 400, cuerpo: { error: 'invalid_grant' } } }, /invalid_grant/],
      [{ canje: { cuerpo: { scope: ALCANCES } } }, /permiso duradero/],
      [{ canje: { cuerpo: { refresh_token: REFRESH, scope: 'openid email' } } }, /enviar correos/],
      [
        {
          canje: {
            cuerpo: {
              refresh_token: REFRESH,
              scope: ALCANCES,
              id_token: idToken({ email: 'x@ensayo.example', email_verified: false }),
            },
          },
        },
        /correo verificado/,
      ],
      [{ pruebaStatus: 400 }, /no sirvió/],
    ];
    for (const [o, motivo] of casos) {
      const w = mundo(o);
      const r = await darPermiso('staging', w.m);
      expect(r.ok).toBe(false);
      expect(r.motivo).toMatch(motivo);
      expect(w.guardados).toEqual({});
    }
  });

  it('si gh no guarda, lo dice', async () => {
    const r = await darPermiso('produccion', mundo({ ghGuarda: false }).m);
    expect(r.motivo).toMatch(/no pudo guardar CORREO_GMAIL_CLIENTE_ID: HTTP 403/);
  });

  it('el correo del id_token solo cuenta verificado', () => {
    expect(correoDelIdToken(idToken({ email: 'a@b.example', email_verified: true }))).toBe(
      'a@b.example',
    );
    expect(correoDelIdToken(idToken({ email: 'a@b.example' }))).toBeNull();
    expect(correoDelIdToken('basura')).toBeNull();
  });
});
