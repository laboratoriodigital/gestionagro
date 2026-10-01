/**
 * Entrar con Google (HU-E4.2, CA1, CA3, CA4 y CA5 del lado del CORE) contra un D1 local y un
 * Google falso. Lo que el D1 local no imita: ver `@gestionagro/d1/local` (P17). Que Google acepte el
 * cliente y la dirección de regreso se comprueba en staging (P16).
 */

import type { BaseD1, SentenciaD1 } from '@gestionagro/d1';
import {
  type ClavePublica,
  generarClavePrivada,
  hashDe,
  verificarAcceso,
} from '@gestionagro/tokens';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import type { ProveedorGoogle } from './entrar.ts';
import { crearOrganizacion } from './repositorio.ts';
import { VIDA_CODIGO_MS } from './sesiones.ts';
import { crearApp, type Env } from './worker.ts';

const APP = 'https://agro.ejemplo.test';
const CORE = 'https://core.ejemplo.test';
const VUELTA = `${APP}/agro/app/cuenta/`;
const T0 = Date.UTC(2026, 9, 1, 12);

let db: BaseD1;
let cerrar: () => Promise<void>;
let clave: string;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  clave = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());

/** Cuenta las sentencias que escriben (CA3). */
function contandoEscrituras(base: BaseD1) {
  const cuenta = { escrituras: 0 };
  // D1 solo acepta sus propias sentencias en batch: cada envoltorio recuerda la real.
  const reales = new WeakMap<SentenciaD1, { sql: string; real: SentenciaD1 }>();
  const envolver = (sql: string, s: SentenciaD1): SentenciaD1 => {
    const escribe = /^\s*(INSERT|UPDATE|DELETE)/i.test(sql);
    const envoltorio = {
      bind: (...v) => envolver(sql, s.bind(...v)),
      first: (...a) => {
        if (escribe) cuenta.escrituras++;
        return s.first(...a);
      },
      all: (...a) => {
        if (escribe) cuenta.escrituras++;
        return s.all(...a);
      },
      run: () => {
        if (escribe) cuenta.escrituras++;
        return s.run();
      },
    } as SentenciaD1;
    reales.set(envoltorio, { sql, real: s });
    return envoltorio;
  };
  const envuelta: BaseD1 = {
    prepare: (sql) => envolver(sql, base.prepare(sql)),
    batch: (sentencias) => {
      const lote = sentencias.map((s) => reales.get(s) ?? { sql: '', real: s });
      cuenta.escrituras += lote.filter((x) => /^\s*(INSERT|UPDATE|DELETE)/i.test(x.sql)).length;
      return base.batch(lote.map((x) => x.real));
    },
  };
  return { db: envuelta, cuenta };
}

const googleFalso = (sub = 'google-sub-1'): ProveedorGoogle => ({
  urlDeAutorizacion: (state, _verifier, redirect) =>
    new URL(
      `https://accounts.google.test/o/oauth2/auth?state=${state}&redirect_uri=${encodeURIComponent(redirect)}`,
    ),
  identidad: async (code) => {
    if (code !== 'code-bueno') throw new Error('code inválido');
    return { sub, email: 'ensayo@example.com', nombre: 'Persona Ensayo' };
  },
});

let reloj = T0;
let cuenta: { escrituras: number };
let env: Env;
const app = crearApp({ google: () => googleFalso(), ahora: () => reloj });
const pedir = (ruta: string, init: RequestInit = {}) =>
  app.fetch(new Request(`${CORE}${ruta}`, init), env);
const post = (ruta: string, cuerpo: unknown, origen = APP) =>
  pedir(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: origen },
    body: JSON.stringify(cuerpo),
  });

beforeEach(async () => {
  await vaciarCore(db);
  for (const s of sentenciasDeCeldas(cargarCeldas().celdas, 'staging')) await db.prepare(s).run();
  reloj = T0;
  const contado = contandoEscrituras(db);
  cuenta = contado.cuenta;
  env = {
    DB: contado.db,
    CORE_JWT_PRIVATE_KEY: clave,
    GOOGLE_CLIENT_ID: 'cliente',
    GOOGLE_CLIENT_SECRET: 'secreto',
    ORIGENES_APP: `${APP}, http://localhost:4321`,
  };
});
afterEach(() => vi.restoreAllMocks());

/** Inicio + regreso de Google: devuelve el código de entrada del fragmento. */
async function entrarConGoogle(): Promise<string> {
  const ida = await pedir(`/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}`);
  const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
  const vuelta = await pedir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
    headers: { cookie },
  });
  const destino = vuelta.headers.get('location') ?? '';
  expect(destino.startsWith(`${VUELTA}#entrar=`)).toBe(true);
  return destino.split('#entrar=')[1] ?? '';
}

const clavePublica = async () =>
  ((await (await pedir('/api/core/claves')).json()) as { claves: ClavePublica[] })
    .claves[0] as ClavePublica;

interface Sesion {
  acceso: string;
  acceso_vence: number;
  refresh: string | null;
  org_id: string | null;
  aviso: string | null;
  organizaciones: { org_id: string; rol: string }[];
}

describe('inicio: solo vuelve a pantallas del cuaderno', () => {
  it.each([
    ['otro sitio', 'https://malo.test/agro/app/'],
    ['fuera del cuaderno', `${APP}/herramientas/agro/`],
    ['sin vuelta', ''],
  ])('rechaza %s', async (_caso, vuelta) => {
    const r = await pedir(`/api/core/auth/google/inicio?vuelta=${encodeURIComponent(vuelta)}`);
    expect(r.status).toBe(400);
  });

  it('manda a Google con la dirección de regreso del CORE y guarda el estado en una cookie protegida', async () => {
    const r = await pedir(`/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}`);
    expect(r.status).toBe(302);
    const google = new URL(r.headers.get('location') ?? '');
    expect(google.searchParams.get('redirect_uri')).toBe(`${CORE}/api/core/auth/google/callback`);
    expect(r.headers.get('set-cookie')).toMatch(/HttpOnly/);
    expect(r.headers.get('set-cookie')).toMatch(/Secure/);
    expect(r.headers.get('set-cookie')).toMatch(/SameSite=Lax/);
  });
});

describe('CA1 · entrar, canjear y recibir los tokens', () => {
  it('el código de entrada da un access de 12 h firmado con Ed25519 y un refresh de 60 días', async () => {
    const codigo = await entrarConGoogle();
    const r = await post('/api/core/auth/canje', { codigo, dispositivo: 'telefono-1' });
    expect(r.status).toBe(200);
    const s = (await r.json()) as Sesion;
    expect(s.refresh).toBeTruthy();
    expect(s.acceso_vence - T0).toBe(12 * 60 * 60 * 1000);
    const reclamos = await verificarAcceso(await clavePublica(), s.acceso, T0);
    expect(reclamos).toMatchObject({ org: null, rol: null, celda: null });
  });

  it('con una organización, el token trae org, rol, celda, shard y anillo', async () => {
    const codigo = await entrarConGoogle();
    const usuario = await db.prepare('SELECT id FROM usuario').first<{ id: string }>();
    await crearOrganizacion(db, {
      propietarioId: usuario?.id ?? '',
      nombre: 'Finca Ensayo Uno',
      tipo: 'finca',
    });
    const s = (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })
    ).json()) as Sesion;
    const reclamos = await verificarAcceso(await clavePublica(), s.acceso, T0);
    expect(reclamos).toMatchObject({
      rol: 'propietario',
      celda: 'c0',
      shard: 'agro_c0_s1',
      anillo: 1,
    });
    expect(reclamos.org).toBe(s.org_id);
  });

  it('el código sirve una sola vez y vence a los 2 minutos', async () => {
    const codigo = await entrarConGoogle();
    expect((await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })).status).toBe(200);
    expect((await post('/api/core/auth/canje', { codigo, dispositivo: 't2' })).status).toBe(401);
    const otro = await entrarConGoogle();
    reloj = T0 + VIDA_CODIGO_MS + 1;
    const r = await post('/api/core/auth/canje', { codigo: otro, dispositivo: 't1' });
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ motivo: expect.stringContaining('ya se usó o venció') });
  });

  it('volver con un state distinto o cancelar en Google regresa a la app con el motivo, sin sesión', async () => {
    const ida = await pedir(`/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}`);
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const otro = await pedir('/api/core/auth/google/callback?code=code-bueno&state=otro', {
      headers: { cookie },
    });
    expect(otro.headers.get('location')).toBe(`${VUELTA}#entrar-error=invalida`);
    const cancelada = await pedir('/api/core/auth/google/callback?error=access_denied', {
      headers: { cookie },
    });
    expect(cancelada.headers.get('location')).toBe(`${VUELTA}#entrar-error=cancelada`);
    expect((await db.prepare('SELECT count(*) AS n FROM sesion').first<{ n: number }>())?.n).toBe(
      0,
    );
  });
});

describe('CA3 · el refresh se rota a lo sumo una vez al día', () => {
  it('diez renovaciones el mismo día no escriben; al día siguiente, una rotación', async () => {
    const codigo = await entrarConGoogle();
    const primera = (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })
    ).json()) as Sesion;
    cuenta.escrituras = 0;
    for (let i = 1; i <= 10; i++) {
      reloj = T0 + i * 60 * 60 * 1000; // cada hora
      const s = (await (
        await post('/api/core/auth/refrescar', { refresh: primera.refresh })
      ).json()) as Sesion;
      expect(s.refresh).toBeNull();
    }
    expect(cuenta.escrituras).toBe(0);
    reloj = T0 + 25 * 60 * 60 * 1000;
    const rotada = (await (
      await post('/api/core/auth/refrescar', { refresh: primera.refresh })
    ).json()) as Sesion;
    expect(rotada.refresh).toBeTruthy();
    expect(cuenta.escrituras).toBe(1);
    // El refresh viejo ya no sirve; el nuevo, sí.
    expect((await post('/api/core/auth/refrescar', { refresh: primera.refresh })).status).toBe(401);
    expect((await post('/api/core/auth/refrescar', { refresh: rotada.refresh })).status).toBe(200);
  });

  it('una sesión revocada lo dice en palabras', async () => {
    const codigo = await entrarConGoogle();
    const s = (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })
    ).json()) as Sesion;
    await db.prepare("UPDATE sesion SET revocado = '2026-10-01T13:00:00Z'").run();
    const r = await post('/api/core/auth/refrescar', { refresh: s.refresh });
    expect(r.status).toBe(401);
    expect(await r.json()).toMatchObject({ motivo: expect.stringContaining('fue retirado') });
  });

  it('pedir una organización ajena no pierde el refresh: responde con aviso', async () => {
    const codigo = await entrarConGoogle();
    const s = (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })
    ).json()) as Sesion;
    reloj = T0 + 25 * 60 * 60 * 1000;
    const r = await post('/api/core/auth/refrescar', { refresh: s.refresh, org_id: 'ajena' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      aviso: 'No perteneces a la organización pedida.',
      org_id: null,
    });
  });
});

describe('CA4 · ningún token en una URL ni en el log; D1 guarda solo hashes', () => {
  it('el código va en el fragmento; los tokens, en cuerpos; nada secreto en el log ni en claro en D1', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const codigo = await entrarConGoogle();
    const s = (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })
    ).json()) as Sesion;
    const secretos = [codigo, s.acceso, s.refresh ?? ''];
    const escrito = [...log.mock.calls, ...error.mock.calls].flat().map(String).join('\n');
    for (const secreto of secretos) expect(escrito).not.toContain(secreto);
    const filas = JSON.stringify((await db.prepare('SELECT * FROM sesion').all()).results);
    expect(filas).not.toContain(s.refresh ?? '');
    expect(filas).toContain(await hashDe(s.refresh ?? ''));
  });
});

describe('CORS, configuración y kill switch', () => {
  it('solo el cuaderno puede leer el canje desde el navegador', async () => {
    const pre = (origen: string) =>
      pedir('/api/core/auth/canje', {
        method: 'OPTIONS',
        headers: { origin: origen, 'access-control-request-method': 'POST' },
      });
    expect((await pre(APP)).headers.get('access-control-allow-origin')).toBe(APP);
    expect((await pre('https://malo.test')).headers.get('access-control-allow-origin')).toBeNull();
  });

  it('sin un secreto responde 503 y nombra cuál falta en el log, no en la respuesta', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    env = { ...env, GOOGLE_CLIENT_SECRET: '' };
    const r = await pedir(`/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}`);
    expect(r.status).toBe(503);
    expect(error.mock.calls.flat().join(' ')).toContain('GOOGLE_CLIENT_SECRET');
  });

  it('con ks:agro-core apagado, entrar responde 503 y la salud sigue en 200', async () => {
    env = {
      ...env,
      FLAGS: { get: async (k: string) => (k === 'ks:agro-core' ? 'apagado' : null) },
    };
    const r = await post('/api/core/auth/canje', { codigo: 'x', dispositivo: 't1' });
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('120');
    expect((await pedir('/api/core/salud')).status).toBe(200);
  });
});

describe('HU-E4.3 · crear la organización de la finca del teléfono', () => {
  const crear = (acceso: string | null, cuerpo: unknown) =>
    pedir('/api/core/organizaciones', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: APP,
        ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    });
  const ORG = '0199a1b2-0000-7000-8000-000000000001';

  async function sesionNueva(): Promise<Sesion> {
    const codigo = await entrarConGoogle();
    return (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: 't1' })
    ).json()) as Sesion;
  }

  it('crea la organización con la persona como propietaria; renovar con org_id da el token y la API de su celda', async () => {
    const s = await sesionNueva();
    const r = await crear(s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ org_id: ORG, nombre: 'Finca Ensayo Uno', ya_existia: false });
    const renovada = (await (
      await post('/api/core/auth/refrescar', { refresh: s.refresh, org_id: ORG })
    ).json()) as Sesion & { url_api: string };
    const reclamos = await verificarAcceso(await clavePublica(), renovada.acceso, T0);
    expect(reclamos).toMatchObject({
      org: ORG,
      rol: 'propietario',
      celda: 'c0',
      shard: 'agro_c0_s1',
    });
    expect(renovada.url_api).toBe(cargarCeldas().celdas[0]?.api_staging);
  });

  it('reintentar con el mismo id no crea otra (la respuesta se pudo perder sin señal)', async () => {
    const s = await sesionNueva();
    await crear(s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
    const otra = await crear(s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
    expect(otra.status).toBe(200);
    expect(await otra.json()).toMatchObject({ ya_existia: true });
    expect(
      (await db.prepare('SELECT count(*) AS n FROM organizacion').first<{ n: number }>())?.n,
    ).toBe(1);
  });

  it('el id de una finca ajena no da acceso a ella', async () => {
    const s = await sesionNueva();
    await crear(s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
    const ajeno = crearApp({ google: () => googleFalso('google-sub-2'), ahora: () => reloj });
    const pedirAjeno = (ruta: string, init: RequestInit) =>
      ajeno.fetch(new Request(`${CORE}${ruta}`, init), env);
    const ida = await pedirAjeno(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}`,
      {},
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    const vuelta = await pedirAjeno(
      `/api/core/auth/google/callback?code=code-bueno&state=${state}`,
      { headers: { cookie } },
    );
    const codigo = (vuelta.headers.get('location') ?? '').split('#entrar=')[1];
    const s2 = (await (
      await pedirAjeno('/api/core/auth/canje', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo, dispositivo: 't2' }),
      })
    ).json()) as Sesion;
    const r = await crear(s2.acceso, { id: ORG, nombre: 'Finca Ensayo Dos' });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ motivo: 'Esa finca es de otra cuenta.' });
  });

  it('sin token responde 401; sin id válido, 400', async () => {
    expect((await crear(null, { id: ORG, nombre: 'Finca Ensayo Uno' })).status).toBe(401);
    const s = await sesionNueva();
    expect((await crear(s.acceso, { id: 'no-es-uuid', nombre: 'Finca Ensayo Uno' })).status).toBe(
      400,
    );
  });
});
