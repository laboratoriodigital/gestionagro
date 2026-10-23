/**
 * Entrar con un enlace al correo (HU-C10.2) contra un D1 local y un Gmail falso: pedir, ver, abrir
 * y canjear, como lo hará la cuenta. Que el correo llegue a un buzón de verdad que no es de Google
 * es la aceptación de HC7 y se comprueba en staging (P16).
 */
import type { BaseD1 } from '@ed1/d1';
import { generarClavePrivada, hashDe } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import {
  cargarProductos as cargarRegistro,
  catalogoDelRepositorio,
} from '../../../scripts/lib/registro-productos.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDelCatalogo } from './catalogo.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import { correoDelCore, REMITENTE_DEL_CORE } from './correo.ts';
import type { ProveedorGoogle } from './entrar.ts';
import { VIDA_ENLACE_MS } from './entrar-con-correo.ts';
import { POLITICA_VIGENTE } from './politica.ts';
import { CATALOGO } from './productos.ts';
import { crearApp, type Env } from './worker.ts';

const APP = 'https://agro.ejemplo.test';
const CORE = 'https://core.ejemplo.test';
const VUELTA = `${APP}/agro/app/cuenta/`;
const T0 = Date.UTC(2026, 9, 23, 15);

let db: BaseD1;
let cerrar: () => Promise<void>;
let clave: string;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  clave = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());

const googleFalso: ProveedorGoogle = {
  urlDeAutorizacion: (state, _v, redirect) =>
    new URL(`https://accounts.google.test/?state=${state}&redirect_uri=${redirect}`),
  identidad: async (code) => {
    if (code !== 'code-bueno') throw new Error('code inválido');
    return { sub: 'google-sub-1', email: 'Ensayo@Example.com', nombre: 'Persona Ensayo' };
  },
};

/** Los correos que «salieron» por el Gmail falso, leídos del MIME. */
let enviados: { para: string; de: string; texto: string }[] = [];
let gmailResponde = 200;
const decodificar = (b64: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0)),
  );
const fetchFalso: typeof fetch = async (entrada, init) => {
  const url = String(entrada instanceof Request ? entrada.url : entrada);
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    return Response.json({ access_token: 'acceso-de-prueba' });
  }
  if (url.startsWith('https://gmail.googleapis.com/')) {
    if (gmailResponde !== 200) return Response.json({}, { status: gmailResponde });
    const raw = (JSON.parse(String(init?.body)) as { raw: string }).raw;
    const mime = decodificar(raw.replace(/-/g, '+').replace(/_/g, '/'));
    // La parte de texto plano: la que sigue a su encabezado, hasta la frontera.
    const cuerpo =
      /Content-Type: text\/plain[^\r]*\r\nContent-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/.exec(
        mime,
      )?.[1] ?? '';
    enviados.push({
      para: /^To: <(.+)>$/m.exec(mime)?.[1] ?? '',
      de: /^From: .*<(.+)>$/m.exec(mime)?.[1] ?? '',
      texto: decodificar(cuerpo.replace(/\r\n/g, '')),
    });
    return Response.json({ id: `m-${enviados.length}` });
  }
  return new Response('no esperado', { status: 599 });
};

let reloj = T0;
let env: Env;
let limitePorIp = true;
const app = crearApp({ google: () => googleFalso, ahora: () => reloj, fetch: fetchFalso });
const pedir = (ruta: string, init: RequestInit = {}) =>
  app.fetch(new Request(`${CORE}${ruta}`, init), env);
const post = (ruta: string, cuerpo: unknown, origen = APP) =>
  pedir(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: origen },
    body: JSON.stringify(cuerpo),
  });
const pedirEnlace = (correo: string, extra: Record<string, unknown> = {}) =>
  post('/api/core/auth/correo/pedir', {
    correo,
    vuelta: VUELTA,
    politica: POLITICA_VIGENTE,
    ...extra,
  });
/** El código del último enlace que salió: lo que la persona toca en su correo. */
const ultimoEnlace = () => {
  const texto = enviados.at(-1)?.texto ?? '';
  const enlace = /(https:\/\/\S+#enlace=\S+)/.exec(texto)?.[1] ?? '';
  return { enlace, codigo: enlace.split('#enlace=')[1] ?? '' };
};

beforeEach(async () => {
  await vaciarCore(db);
  for (const s of [
    ...sentenciasDelCatalogo(catalogoDelRepositorio(cargarRegistro()), '2026-10-06T00:00:00.000Z'),
    ...sentenciasDeCeldas(cargarCeldas().celdas, 'staging'),
  ])
    await db.prepare(s).run();
  reloj = T0;
  enviados = [];
  gmailResponde = 200;
  limitePorIp = true;
  env = {
    DB: db,
    CORE_JWT_PRIVATE_KEY: clave,
    GOOGLE_CLIENT_ID: 'cliente',
    GOOGLE_CLIENT_SECRET: 'secreto',
    ORIGENES_APP: APP,
    CORREO_GMAIL_CLIENTE_ID: 'cliente-gmail',
    CORREO_GMAIL_CLIENTE_SECRETO: 'secreto-gmail',
    CORREO_GMAIL_REFRESH: 'refresh-gmail',
    CORREO_GMAIL_REMITENTE: 'envios@gmail.test',
    LIMITE_CORREO: { limit: async () => ({ success: limitePorIp }) },
  };
});

/** Pide el enlace, lo abre desde la cuenta y canjea el código en la app, como la persona. */
async function entrarConCorreo(correo: string) {
  expect((await pedirEnlace(correo)).status).toBe(200);
  const { codigo } = ultimoEnlace();
  const abierto = await post('/api/core/auth/correo/abrir', { enlace: codigo }, CORE);
  expect(abierto.status).toBe(200);
  const { vuelta } = (await abierto.json()) as { vuelta: string };
  expect(vuelta.startsWith(`${VUELTA}#entrar=`)).toBe(true);
  const canje = await post('/api/core/auth/canje', {
    codigo: vuelta.split('#entrar=')[1],
    dispositivo: 'telefono-1',
  });
  expect(canje.status).toBe(200);
  return (await canje.json()) as { usuario: { email: string; nombre: string }; refresh: string };
}

describe('HU-C10.2 · pedir el enlace', () => {
  it('CA1: responde lo mismo para un correo con cuenta y para uno sin cuenta, y a los dos les llega el enlace', async () => {
    // Una persona que ya entró con Google.
    const ida = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    await pedir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const conCuenta = await pedirEnlace('ensayo@example.com');
    const sinCuenta = await pedirEnlace('nadie@example.com');
    expect(conCuenta.status).toBe(sinCuenta.status);
    const a = (await conCuenta.json()) as { estado: string; motivo: string };
    const b = (await sinCuenta.json()) as { estado: string; motivo: string };
    expect(a.estado).toBe(b.estado);
    expect(a.motivo.replace('ensayo@example.com', '·')).toBe(
      b.motivo.replace('nadie@example.com', '·'),
    );
    expect(enviados.map((e) => e.para)).toEqual(['ensayo@example.com', 'nadie@example.com']);
  });

  it('CA2: el enlace lleva el código en el fragmento de la cuenta, y la base guarda solo su huella', async () => {
    await pedirEnlace('  Rosa@Example.COM ');
    const { enlace, codigo } = ultimoEnlace();
    expect(enlace.startsWith(`${CORE}/entrar/correo/#enlace=`)).toBe(true);
    expect(enviados[0]?.para).toBe('rosa@example.com');
    const filas = await db.prepare('SELECT * FROM enlace_correo').all<Record<string, string>>();
    expect(filas.results).toHaveLength(1);
    const fila = filas.results[0] ?? {};
    expect(fila['codigo_hash']).toBe(await hashDe(codigo));
    expect(JSON.stringify(filas.results)).not.toContain(codigo);
    expect(Date.parse(fila['expira'] ?? '') - Date.parse(fila['creado'] ?? '')).toBe(
      VIDA_ENLACE_MS,
    );
    // El registro del correo no guarda la dirección.
    const correos = await db.prepare('SELECT * FROM correo_del_core').all();
    expect(JSON.stringify(correos.results)).not.toContain('rosa@example.com');
  });

  it.each([
    ['sin la política vigente', { politica: 'vieja' }],
    ['con una vuelta de otro sitio', { vuelta: 'https://malo.test/agro/app/' }],
    ['de un producto que no existe', { producto: 'inventado' }],
  ])('se rechaza %s y no sale ningún correo', async (_caso, extra) => {
    expect((await pedirEnlace('rosa@example.com', extra)).status).toBe(400);
    expect(enviados).toHaveLength(0);
  });

  it.each(['sin-arroba', 'dos@uno.test,otra@dos.test', 'rosa@example.com\r\nBcc: otra@malo.test'])(
    'CA3 ❌: «%s» no es una dirección y no sale de aquí',
    async (correo) => {
      const r = await pedirEnlace(correo);
      expect(r.status).toBe(400);
      expect(enviados).toHaveLength(0);
    },
  );

  it('CA3 ❌: el cuarto enlace al mismo correo en una hora se rechaza; pasada la hora, vuelve a salir', async () => {
    for (let i = 0; i < 3; i++) expect((await pedirEnlace('rosa@example.com')).status).toBe(200);
    const cuarto = await pedirEnlace('ROSA@example.com');
    expect(cuarto.status).toBe(429);
    expect(enviados).toHaveLength(3);
    reloj += 60 * 60 * 1000 + 1;
    expect((await pedirEnlace('rosa@example.com')).status).toBe(200);
  });

  it('CA3 ❌: por encima del límite por IP se rechaza sin tocar la base', async () => {
    limitePorIp = false;
    const r = await pedirEnlace('rosa@example.com');
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('60');
    expect((await db.prepare('SELECT count(*) AS n FROM enlace_correo').first())?.['n']).toBe(0);
  });

  it('CA3 de HU-C10.1 ❌: sin la configuración del correo dice «no disponible» y no deja un enlace que nadie recibió', async () => {
    const { CORREO_GMAIL_REFRESH: _sinRefresh, ...sinGmail } = env;
    env = sinGmail;
    const r = await pedirEnlace('rosa@example.com');
    expect(r.status).toBe(503);
    expect(((await r.json()) as { estado: string }).estado).toBe('no-disponible');
    expect((await db.prepare('SELECT count(*) AS n FROM enlace_correo').first())?.['n']).toBe(0);
  });

  it('si el proveedor falla, dice «no disponible» y el intento no cuenta para el tope de la persona', async () => {
    gmailResponde = 503;
    for (let i = 0; i < 4; i++) expect((await pedirEnlace('rosa@example.com')).status).toBe(503);
    gmailResponde = 200;
    expect((await pedirEnlace('rosa@example.com')).status).toBe(200);
  });
});

describe('HU-C10.2 · abrir el enlace', () => {
  it('entra con una cuenta nueva, con el correo como nombre, y la entrada queda en la auditoría', async () => {
    const sesion = await entrarConCorreo('rosa@example.com');
    expect(sesion.usuario).toEqual({ nombre: 'rosa@example.com', email: 'rosa@example.com' });
    const hecho = await db
      .prepare("SELECT detalle FROM auditoria WHERE accion = 'entrada'")
      .first<{ detalle: string }>();
    expect(JSON.parse(hecho?.detalle ?? '{}')).toEqual({ proveedor: 'correo' });
    const aceptada = await db
      .prepare('SELECT producto, version FROM aceptacion_politica')
      .first<{ producto: string; version: string }>();
    expect(aceptada).toEqual({ producto: 'agro', version: POLITICA_VIGENTE });
  });

  it('quien ya entró con Google y entra con su correo es la misma persona, no una cuenta nueva', async () => {
    const ida = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    await pedir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const sesion = await entrarConCorreo('ensayo@example.com');
    expect(sesion.usuario.nombre).toBe('Persona Ensayo');
    expect((await db.prepare('SELECT count(*) AS n FROM usuario').first())?.['n']).toBe(1);
    const identidades = await db
      .prepare('SELECT proveedor, sub FROM identidad ORDER BY proveedor')
      .all<{ proveedor: string; sub: string }>();
    expect(identidades.results).toEqual([
      { proveedor: 'correo', sub: 'ensayo@example.com' },
      { proveedor: 'google', sub: 'google-sub-1' },
    ]);
    // La segunda vez no escribe identidad ni usuario.
    await entrarConCorreo('ensayo@example.com');
    expect((await db.prepare('SELECT count(*) AS n FROM identidad').first())?.['n']).toBe(2);
  });

  it('ver dice para quién es sin gastarlo; abrir lo gasta', async () => {
    await pedirEnlace('rosa@example.com');
    const { codigo } = ultimoEnlace();
    for (let i = 0; i < 2; i++) {
      const visto = await post('/api/core/auth/correo/ver', { enlace: codigo }, CORE);
      expect(await visto.json()).toEqual({
        estado: 'vigente',
        correo: 'rosa@example.com',
        producto: 'CultivoPro',
      });
    }
    expect((await post('/api/core/auth/correo/abrir', { enlace: codigo }, CORE)).status).toBe(200);
    expect((await post('/api/core/auth/correo/ver', { enlace: codigo }, CORE)).status).toBe(410);
  });

  it('CA3 ❌: un enlace usado no sirve otra vez', async () => {
    await pedirEnlace('rosa@example.com');
    const { codigo } = ultimoEnlace();
    expect((await post('/api/core/auth/correo/abrir', { enlace: codigo }, CORE)).status).toBe(200);
    const otra = await post('/api/core/auth/correo/abrir', { enlace: codigo }, CORE);
    expect(otra.status).toBe(410);
    expect((await db.prepare('SELECT count(*) AS n FROM sesion').first())?.['n']).toBe(1);
  });

  it('CA3 ❌: a los 15 minutos el enlace venció, y uno inventado tampoco sirve', async () => {
    await pedirEnlace('rosa@example.com');
    const { codigo } = ultimoEnlace();
    reloj += VIDA_ENLACE_MS;
    expect((await post('/api/core/auth/correo/abrir', { enlace: codigo }, CORE)).status).toBe(410);
    expect((await post('/api/core/auth/correo/abrir', { enlace: 'inventado' }, CORE)).status).toBe(
      410,
    );
    expect((await db.prepare('SELECT count(*) AS n FROM usuario').first())?.['n']).toBe(0);
  });

  it('el código de entrada que entrega solo se canjea desde la app de su producto', async () => {
    await pedirEnlace('rosa@example.com');
    const { codigo } = ultimoEnlace();
    const abierto = await post('/api/core/auth/correo/abrir', { enlace: codigo }, CORE);
    const { vuelta } = (await abierto.json()) as { vuelta: string };
    const desdeOtra = await post(
      '/api/core/auth/canje',
      { codigo: vuelta.split('#entrar=')[1], dispositivo: 'x' },
      'https://malo.test',
    );
    expect(desdeOtra.status).toBe(403);
  });
});

describe('HU-C10.1 · el remitente de cada producto', () => {
  const resendFalso = () => {
    const llamadas: { from: string; to: string[] }[] = [];
    const f: typeof fetch = async (_url, init) => {
      llamadas.push(JSON.parse(String(init?.body)) as { from: string; to: string[] });
      return Response.json({ id: 'r-1' });
    };
    return { f, llamadas };
  };
  const producto = (id: string) => {
    const p = CATALOGO.productos.find((x) => x.id === id);
    if (!p) throw new Error(id);
    return p;
  };

  it('producción manda con Resend: TiendaPro desde su dominio y con su nombre; los demás, desde el CORE', async () => {
    const { f, llamadas } = resendFalso();
    const entorno = { DESTINO: 'produccion', RESEND_API_KEY: 're_prueba' };
    const correo = { para: 'rosa@example.com', asunto: 'a', texto: 't' };
    await correoDelCore(entorno, producto('tienda'), f).enviar(correo);
    await correoDelCore(entorno, producto('agro'), f).enviar(correo);
    expect(llamadas.map((l) => l.from)).toEqual([
      '"TiendaPro" <avisos@tiendapro.co>',
      `"CultivoPro vía Laboratorio Digital" <${REMITENTE_DEL_CORE}>`,
    ]);
  });

  it('❌ producción sin la clave de Resend no cae a Gmail: dice «no disponible»', async () => {
    const f = vi.fn<typeof fetch>();
    const correo = correoDelCore(
      { DESTINO: 'produccion', CORREO_GMAIL_REFRESH: 'r', CORREO_GMAIL_REMITENTE: 'x@gmail.test' },
      producto('agro'),
      f,
    );
    expect(correo.proveedor).toBe('resend');
    expect(correo.disponible).toBe(false);
    expect(
      await correo.enviar({ para: 'rosa@example.com', asunto: 'a', texto: 't' }),
    ).toMatchObject({ enviado: false, motivo: 'no-disponible' });
    expect(f).not.toHaveBeenCalled();
  });
});
