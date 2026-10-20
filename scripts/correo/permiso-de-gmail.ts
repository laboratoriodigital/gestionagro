/**
 * `node scripts/correo/permiso-de-gmail.ts --ambiente staging|produccion` (HU-C10.1 WI-C10.1.3,
 * HU-T14.3, PLATAFORMA §4.11): el dueño da una sola vez el permiso de enviar correos con la cuenta de
 * Gmail de Laboratorio Digital, y el script guarda en el ambiente de GitHub los cuatro secretos que
 * lee el despliegue: `CORREO_GMAIL_CLIENTE_ID`, `CORREO_GMAIL_CLIENTE_SECRETO`, `CORREO_GMAIL_REFRESH`
 * y `CORREO_GMAIL_REMITENTE`.
 *
 * 1. Pide el id y el secreto del cliente de OAuth «de escritorio» de esa cuenta, aparte del de
 *    «entrar con Google», para que el permiso de enviar nunca se le pida a un usuario.
 * 2. Abre el navegador en el permiso de Google (`gmail.send`, y el correo de la cuenta para saber
 *    el remitente), con PKCE y `state`, y recibe el código en esta misma máquina
 *    (`http://127.0.0.1:<puerto>`): nada pasa por un servidor de afuera.
 * 3. Cambia el código por el permiso duradero (refresh), comprueba que sirve pidiendo un acceso con
 *    él, y guarda los cuatro con `gh`, por stdin. **Ninguno sale en la pantalla.**
 *
 * Volver a correrlo reemplaza los cuatro: es la forma de renovar un permiso vencido o revocado.
 * Node y `gh`, sin shell (P3: corre en Windows). Los pasos están en `docs/runbooks/correo-de-gmail.md`.
 */
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { CORREO_GMAIL } from '../lib/publicacion.ts';

export const AMBIENTES = ['staging', 'produccion'] as const;
export type Ambiente = (typeof AMBIENTES)[number];

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
export const ALCANCES = 'openid email https://www.googleapis.com/auth/gmail.send';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Lo que el script necesita del mundo: inyectable para probarlo sin Google, GitHub ni teclado. */
export interface Mundo {
  gh(argumentos: string[], entrada?: string): { ok: boolean; salida: string };
  /** Con `oculta`, lo que se escribe no sale en la pantalla. */
  preguntar(pregunta: string, oculta?: boolean): Promise<string>;
  /** Abre el navegador en la dirección; si no puede, la dice para copiarla. */
  abrir(url: string): void;
  decir(texto: string): void;
  fetch: Fetch;
}

const base64url = (b: Buffer) => b.toString('base64url');

/** El correo del `id_token`, si Google dice que está verificado. */
export function correoDelIdToken(idToken: string): string | null {
  try {
    const carga = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString()) as {
      email?: string;
      email_verified?: boolean;
    };
    return carga.email && carga.email_verified ? carga.email : null;
  } catch {
    return null;
  }
}

/** Espera la vuelta de Google en 127.0.0.1; devuelve el código si el `state` es el que se mandó. */
function esperarLaVuelta(
  state: string,
  minutos = 5,
): Promise<{ puerto: number; codigo: Promise<string> }> {
  return new Promise((listo, mal) => {
    let resolver: (c: string) => void = () => undefined;
    let rechazar: (e: Error) => void = () => undefined;
    const codigo = new Promise<string>((ok, no) => {
      resolver = ok;
      rechazar = no;
    });
    const servidor = createServer((pedido, respuesta) => {
      const u = new URL(pedido.url ?? '/', 'http://127.0.0.1');
      const html = (texto: string) => {
        respuesta.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        respuesta.end(`<!doctype html><meta charset="utf-8"><p>${texto}</p>`);
      };
      if (u.searchParams.get('state') !== state) {
        html('Esta vuelta no es la que esperaba el script. Cierra esta pestaña.');
        return;
      }
      const c = u.searchParams.get('code');
      if (!c) {
        html('Google no dio el permiso. Puedes cerrar esta pestaña y volver a la terminal.');
        rechazar(
          new Error(`Google no dio el permiso (${u.searchParams.get('error') ?? 'sin código'})`),
        );
      } else {
        html('Listo: vuelve a la terminal. Puedes cerrar esta pestaña.');
        resolver(c);
      }
      servidor.close();
    });
    const plazo = setTimeout(() => {
      servidor.close();
      rechazar(new Error(`pasaron ${minutos} minutos sin la vuelta de Google`));
    }, minutos * 60_000);
    codigo.finally(() => clearTimeout(plazo)).catch(() => undefined);
    servidor.on('error', mal);
    servidor.listen(0, '127.0.0.1', () => {
      const direccion = servidor.address();
      if (!direccion || typeof direccion === 'string') return mal(new Error('sin puerto'));
      listo({ puerto: direccion.port, codigo });
    });
  });
}

export interface Resultado {
  ok: boolean;
  remitente?: string;
  motivo?: string;
}

export async function darPermiso(ambiente: Ambiente, mundo: Mundo): Promise<Resultado> {
  const lista = mundo.gh(['secret', 'list', '--env', ambiente, '--json', 'name']);
  if (!lista.ok) {
    return {
      ok: false,
      motivo: `gh no pudo leer el ambiente «${ambiente}». Revisa «gh auth status» y que el ambiente exista.`,
    };
  }
  const clienteId = (await mundo.preguntar('Id del cliente de OAuth (de escritorio): ')).trim();
  const clienteSecreto = (
    await mundo.preguntar('Secreto de ese cliente (no se ve al pegarlo): ', true)
  ).trim();
  if (!/\.apps\.googleusercontent\.com$/.test(clienteId) || clienteSecreto.length < 10) {
    return {
      ok: false,
      motivo:
        'el id del cliente termina en «.apps.googleusercontent.com» y el secreto viene con él: cópialos de Google Cloud › APIs y servicios › Credenciales.',
    };
  }
  const state = base64url(randomBytes(24));
  const verificador = base64url(randomBytes(48));
  const reto = base64url(createHash('sha256').update(verificador).digest());
  const vuelta = await esperarLaVuelta(state);
  const redirect = `http://127.0.0.1:${vuelta.puerto}`;
  const url = `${AUTORIZAR}?${new URLSearchParams({
    client_id: clienteId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: ALCANCES,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: reto,
    code_challenge_method: 'S256',
  })}`;
  mundo.decir(
    'Se abre el navegador. Entra con la cuenta de Gmail que envía los correos y acepta el permiso.',
  );
  mundo.abrir(url);
  let codigo: string;
  try {
    codigo = await vuelta.codigo;
  } catch (e) {
    return { ok: false, motivo: (e as Error).message };
  }
  const canje = await mundo.fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clienteId,
      client_secret: clienteSecreto,
      code: codigo,
      code_verifier: verificador,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    }),
  });
  const t = (await canje.json().catch(() => ({}))) as {
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
  };
  if (!canje.ok) {
    return { ok: false, motivo: `Google no cambió el código (${t.error ?? canje.status})` };
  }
  if (!t.refresh_token) {
    return {
      ok: false,
      motivo:
        'Google no dio el permiso duradero. Quita el acceso de esta app en https://myaccount.google.com/permissions y vuelve a correr el script.',
    };
  }
  if (!t.scope?.split(' ').includes('https://www.googleapis.com/auth/gmail.send')) {
    return {
      ok: false,
      motivo:
        'el permiso no incluye enviar correos. Vuelve a correr el script y, en la pantalla de Google, marca la casilla «Enviar correo electrónico en tu nombre» (o «Seleccionar todo») antes de Continuar.',
    };
  }
  const remitente = t.id_token ? correoDelIdToken(t.id_token) : null;
  if (!remitente) return { ok: false, motivo: 'Google no dijo el correo verificado de la cuenta.' };
  // El permiso sirve: con él se pide un acceso, como lo hará el Worker.
  const prueba = await mundo.fetch(TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clienteId,
      client_secret: clienteSecreto,
      refresh_token: t.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!prueba.ok)
    return { ok: false, motivo: `el permiso no sirvió para pedir un acceso (${prueba.status})` };
  const valores: Record<(typeof CORREO_GMAIL)[number], string> = {
    CORREO_GMAIL_CLIENTE_ID: clienteId,
    CORREO_GMAIL_CLIENTE_SECRETO: clienteSecreto,
    CORREO_GMAIL_REFRESH: t.refresh_token,
    CORREO_GMAIL_REMITENTE: remitente,
  };
  for (const nombre of CORREO_GMAIL) {
    const g = mundo.gh(['secret', 'set', nombre, '--env', ambiente], valores[nombre]);
    if (!g.ok) {
      return {
        ok: false,
        motivo: `gh no pudo guardar ${nombre}: ${g.salida.trim().slice(0, 200)}`,
      };
    }
  }
  return { ok: true, remitente };
}

function mundoReal(): Mundo {
  // Una salida que se calla mientras se pega el secreto.
  let callada = false;
  const salida = new Writable({
    write(trozo, codificacion, listo) {
      if (!callada) process.stdout.write(trozo, codificacion);
      listo();
    },
  });
  const rl = createInterface({ input: process.stdin, output: salida, terminal: true });
  return {
    gh(argumentos, entrada) {
      const r = spawnSync('gh', argumentos, {
        encoding: 'utf8',
        ...(entrada === undefined ? {} : { input: entrada }),
      });
      return { ok: r.status === 0, salida: `${r.stdout ?? ''}${r.stderr ?? ''}` };
    },
    async preguntar(p, oculta) {
      process.stdout.write(p);
      callada = oculta === true;
      try {
        return await rl.question('');
      } finally {
        if (callada) process.stdout.write('\n');
        callada = false;
      }
    },
    abrir(url) {
      const [comando, argumentos]: [string, string[]] =
        process.platform === 'win32'
          ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
          : process.platform === 'darwin'
            ? ['open', [url]]
            : ['xdg-open', [url]];
      if (spawnSync(comando, argumentos).status !== 0)
        console.log(`Abre esta dirección en el navegador:\n${url}`);
    },
    decir: (t) => console.log(t),
    fetch: (url, init) => fetch(url, init),
  };
}

if (process.argv[1]?.endsWith('permiso-de-gmail.ts')) {
  const i = process.argv.indexOf('--ambiente');
  const ambiente = process.argv[i + 1] as Ambiente | undefined;
  if (i < 0 || !ambiente || !AMBIENTES.includes(ambiente)) {
    console.error('❌ Uso: node scripts/correo/permiso-de-gmail.ts --ambiente staging|produccion');
    process.exit(1);
  }
  const r = await darPermiso(ambiente, mundoReal());
  if (r.ok) {
    console.log(
      `✅ Permiso guardado en «${ambiente}»: los correos salen desde ${r.remitente} en el próximo despliegue.`,
    );
  } else console.error(`❌ ${r.motivo}`);
  process.exit(r.ok ? 0 : 1);
}
