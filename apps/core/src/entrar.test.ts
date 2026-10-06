/**
 * Entrar con Google (HU-E4.2, CA1, CA3, CA4 y CA5 del lado del CORE) contra un D1 local y un
 * Google falso. Lo que el D1 local no imita: ver `@ed1/d1/local` (P17). Que Google acepte el
 * cliente y la dirección de regreso se comprueba en staging (P16).
 */

import { createHash } from 'node:crypto';
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { type ClavePublica, generarClavePrivada, hashDe, verificarAcceso } from '@ed1/tokens';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import type { ProveedorGoogle } from './entrar.ts';
import { conciliarPagos } from './pagos.ts';
import { POLITICA_VIGENTE } from './politica.ts';
import { crearOrganizacion } from './repositorio.ts';
import { VIDA_CODIGO_MS } from './sesiones.ts';
import { crearApp, type Env, proveedorDePagoDe } from './worker.ts';

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
  const ida = await pedir(
    `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
  );
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
    const r = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(vuelta)}&politica=${POLITICA_VIGENTE}`,
    );
    expect(r.status).toBe(400);
  });

  it('manda a Google con la dirección de regreso del CORE y guarda el estado en una cookie protegida', async () => {
    const r = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
    );
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
    const ida = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
    );
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
    const r = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
    );
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

  // HU-C3.6: un kill switch por producto y uno para los pagos (PLATAFORMA §4.10).
  const conApagado = (llave: string) => {
    env = { ...env, FLAGS: { get: async (k: string) => (k === llave ? 'apagado' : null) } };
  };

  it.each(['ks:core', 'ks:core:agro'])('con %s apagado, entrar responde 503', async (llave) => {
    conApagado(llave);
    const r = await post('/api/core/auth/canje', { codigo: 'x', dispositivo: 't1' });
    expect(r.status).toBe(503);
    expect(((await r.json()) as { motivo: string }).motivo).toMatch(/Entrar está en pausa/);
  });

  it('el kill switch de otro producto no apaga el agro (control negativo)', async () => {
    conApagado('ks:core:ensayo');
    const r = await post('/api/core/auth/canje', { codigo: 'x', dispositivo: 't1' });
    expect(r.status).not.toBe(503);
  });

  it('con ks:core:pagos apagado, pagar responde 503 y entrar sigue funcionando', async () => {
    conApagado('ks:core:pagos');
    const pago = await post('/api/core/pago/crear', { plan: 'finca' });
    expect(pago.status).toBe(503);
    expect(((await pago.json()) as { motivo: string }).motivo).toMatch(/Pagar está en pausa/);
    const entrar = await post('/api/core/auth/canje', { codigo: 'x', dispositivo: 't1' });
    expect(entrar.status).not.toBe(503);
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
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
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

describe('HU-E0.5 CA3 · aceptar la política al entrar', () => {
  it('sin aceptar la política vigente no se inicia el ingreso', async () => {
    const sin = await pedir(`/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}`);
    expect(sin.status).toBe(400);
    expect(await sin.text()).toContain(`versión ${POLITICA_VIGENTE}`);
    const vieja = await pedir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=0`,
    );
    expect(vieja.status).toBe(400);
  });

  it('la cuenta nueva guarda la versión aceptada y la fecha', async () => {
    await entrarConGoogle();
    const u = await db.prepare('SELECT politica_version, politica_aceptada FROM usuario').first();
    expect(u).toEqual({
      politica_version: POLITICA_VIGENTE,
      politica_aceptada: new Date(T0).toISOString(),
    });
  });

  it('volver a entrar con la misma versión no escribe; una cuenta sin aceptación la recibe', async () => {
    await entrarConGoogle();
    await db.prepare('UPDATE usuario SET politica_version = NULL, politica_aceptada = NULL').run();
    reloj = T0 + 60_000;
    await entrarConGoogle();
    const u = await db.prepare('SELECT politica_version, politica_aceptada FROM usuario').first();
    expect(u).toEqual({
      politica_version: POLITICA_VIGENTE,
      politica_aceptada: new Date(T0 + 60_000).toISOString(),
    });
    cuenta.escrituras = 0;
    await entrarConGoogle();
    // Solo la sesión nueva (1 escritura); la aceptación no se reescribe.
    expect(cuenta.escrituras).toBe(1);
  });
});

describe('HU-E4.4 · invitar al equipo por WhatsApp', () => {
  const ORG = '0199a1b2-0000-7000-8000-0000000000e1';

  /** Entra con la cuenta de Google `sub` y devuelve su sesión (sin organización). */
  async function sesionDe(sub: string): Promise<Sesion> {
    const otra = crearApp({ google: () => googleFalso(sub), ahora: () => reloj });
    const ir = (ruta: string, init: RequestInit = {}) =>
      otra.fetch(new Request(`${CORE}${ruta}`, init), env);
    const ida = await ir(
      `/api/core/auth/google/inicio?vuelta=${encodeURIComponent(VUELTA)}&politica=${POLITICA_VIGENTE}`,
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    const vuelta = await ir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const codigo = (vuelta.headers.get('location') ?? '').split('#entrar=')[1];
    return (await (
      await post('/api/core/auth/canje', { codigo, dispositivo: sub })
    ).json()) as Sesion;
  }

  const conToken = (ruta: string, acceso: string | null, cuerpo: unknown) =>
    pedir(ruta, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: APP,
        ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    });

  /** El propietario: crea la finca y renueva hacia ella. */
  async function propietario(): Promise<Sesion> {
    const s = await sesionDe('google-propietario');
    await conToken('/api/core/organizaciones', s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
    return (await (
      await post('/api/core/auth/refrescar', { refresh: s.refresh, org_id: ORG })
    ).json()) as Sesion;
  }

  async function invitar(rol = 'operario') {
    const p = await propietario();
    const r = await conToken('/api/core/invitaciones', p.acceso, { rol });
    return { p, r, cuerpo: (await r.json()) as { codigo: string; expira: string } };
  }

  it('CA1: el propietario crea un código de un uso que vence en 7 días; D1 guarda solo su hash', async () => {
    const { r, cuerpo } = await invitar();
    expect(r.status).toBe(201);
    expect(Date.parse(cuerpo.expira) - T0).toBe(7 * 24 * 60 * 60 * 1000);
    const filas = JSON.stringify((await db.prepare('SELECT * FROM invitacion').all()).results);
    expect(filas).not.toContain(cuerpo.codigo);
    expect(filas).toContain(await hashDe(cuerpo.codigo));
  });

  it('solo el propietario invita, y con un rol válido', async () => {
    const sinFinca = await sesionDe('google-otro');
    expect(
      (await conToken('/api/core/invitaciones', sinFinca.acceso, { rol: 'operario' })).status,
    ).toBe(403);
    expect((await conToken('/api/core/invitaciones', null, { rol: 'operario' })).status).toBe(401);
    const p = await propietario();
    expect((await conToken('/api/core/invitaciones', p.acceso, { rol: 'jefe' })).status).toBe(400);
  });

  it('CA2 y CA3: «ver» dice finca, rol, quién invita y hasta cuándo; el código va en el cuerpo, no en la URL', async () => {
    const { cuerpo } = await invitar('supervisor');
    const r = await post('/api/core/invitaciones/ver', { codigo: cuerpo.codigo });
    expect(await r.json()).toMatchObject({
      estado: 'vigente',
      finca: 'Finca Ensayo Uno',
      rol: 'supervisor',
      invita: 'Persona Ensayo',
    });
    expect((await pedir(`/api/core/invitaciones/ver?codigo=${cuerpo.codigo}`)).status).toBe(404);
    const mala = await post('/api/core/invitaciones/ver', { codigo: 'inventado' });
    expect(mala.status).toBe(410);
    expect(await mala.json()).toMatchObject({
      motivo: expect.stringContaining('Pídele a quien te invitó'),
    });
  });

  it('CA4: al aceptar, la persona queda con su rol y su token lo dice', async () => {
    const { cuerpo } = await invitar('operario');
    const operario = await sesionDe('google-operario');
    const r = await conToken('/api/core/invitaciones/aceptar', operario.acceso, {
      codigo: cuerpo.codigo,
    });
    expect(await r.json()).toEqual({ org_id: ORG, finca: 'Finca Ensayo Uno', rol: 'operario' });
    const renovada = (await (
      await post('/api/core/auth/refrescar', { refresh: operario.refresh, org_id: ORG })
    ).json()) as Sesion;
    expect(await verificarAcceso(await clavePublica(), renovada.acceso, T0)).toMatchObject({
      org: ORG,
      rol: 'operario',
    });
  });

  it('CA1 y CA3: sirve una sola vez; usada o vencida dice por qué y a quién pedir otra', async () => {
    const { cuerpo } = await invitar();
    const uno = await sesionDe('google-uno');
    await conToken('/api/core/invitaciones/aceptar', uno.acceso, { codigo: cuerpo.codigo });
    // La misma persona otra vez: no falla, ya es suya.
    expect(
      await (
        await conToken('/api/core/invitaciones/aceptar', uno.acceso, { codigo: cuerpo.codigo })
      ).json(),
    ).toMatchObject({ ya_aceptada: true });
    const dos = await sesionDe('google-dos');
    const usada = await conToken('/api/core/invitaciones/aceptar', dos.acceso, {
      codigo: cuerpo.codigo,
    });
    expect(usada.status).toBe(410);
    expect(await usada.json()).toMatchObject({
      motivo: 'Este enlace ya se usó. Pídele a Persona Ensayo que te mande uno nuevo.',
    });

    const otra = await invitar();
    reloj = T0 + 7 * 24 * 60 * 60 * 1000 + 1;
    const vencida = await post('/api/core/invitaciones/ver', { codigo: otra.cuerpo.codigo });
    expect(await vencida.json()).toMatchObject({
      motivo: 'Este enlace venció. Pídele a Persona Ensayo que te mande uno nuevo.',
    });
  });

  it('dos teléfonos con el mismo enlace al mismo tiempo: entra uno solo', async () => {
    const { cuerpo } = await invitar();
    const [a, b] = [await sesionDe('google-a'), await sesionDe('google-b')];
    const respuestas = await Promise.all([
      conToken('/api/core/invitaciones/aceptar', a.acceso, { codigo: cuerpo.codigo }),
      conToken('/api/core/invitaciones/aceptar', b.acceso, { codigo: cuerpo.codigo }),
    ]);
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 410]);
    expect(
      (
        await db
          .prepare("SELECT count(*) AS n FROM membresia WHERE rol = 'operario'")
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });

  it('quien ya es parte de la finca no gasta la invitación', async () => {
    const { p, cuerpo } = await invitar();
    const r = await conToken('/api/core/invitaciones/aceptar', p.acceso, { codigo: cuerpo.codigo });
    expect(r.status).toBe(409);
    expect(
      (await db.prepare('SELECT usada FROM invitacion').first<{ usada: string | null }>())?.usada,
    ).toBeNull();
  });

  describe('HU-E4.6 · revocar un teléfono o una persona, y cambiar roles', () => {
    /** Propietario y un operario que aceptó su invitación. */
    async function equipo() {
      const { p, cuerpo } = await invitar('operario');
      const o = await sesionDe('google-operario');
      await conToken('/api/core/invitaciones/aceptar', o.acceso, { codigo: cuerpo.codigo });
      const miembros = (await (await conToken('/api/core/equipo/ver', p.acceso, {})).json()) as {
        miembros: { usuario_id: string; nombre: string; rol: string; tu: boolean }[];
      };
      const operario = miembros.miembros.find((m) => !m.tu);
      if (!operario) throw new Error('sin operario');
      return { p, o, operario, miembros: miembros.miembros };
    }
    const tokenDe = async (s: Sesion) =>
      verificarAcceso(
        await clavePublica(),
        (
          (await (
            await post('/api/core/auth/refrescar', { refresh: s.refresh, org_id: ORG })
          ).json()) as Sesion
        ).acceso,
        reloj,
      );

    it('el propietario ve quién tiene acceso y con qué rol', async () => {
      const { miembros } = await equipo();
      expect(miembros.map((m) => [m.rol, m.tu])).toEqual(
        expect.arrayContaining([
          ['propietario', true],
          ['operario', false],
        ]),
      );
    });

    it('cambiar el rol: el token siguiente lo trae', async () => {
      const { p, o, operario } = await equipo();
      const r = await conToken('/api/core/equipo/rol', p.acceso, {
        usuario_id: operario.usuario_id,
        rol: 'supervisor',
      });
      expect(r.status).toBe(200);
      expect(await tokenDe(o)).toMatchObject({ org: ORG, rol: 'supervisor' });
    });

    it('CA1 y CA3: quitar a alguien: su próximo token ya no trae la finca; sus datos no se tocan', async () => {
      const { p, o, operario } = await equipo();
      const r = await conToken('/api/core/equipo/quitar', p.acceso, {
        usuario_id: operario.usuario_id,
      });
      expect(r.status).toBe(200);
      expect(await tokenDe(o)).toMatchObject({ org: null });
      // La cuenta sigue existiendo: lo que anotó vive en la celda, no en la membresía.
      expect(
        (
          await db
            .prepare('SELECT count(*) AS n FROM usuario WHERE id = ?')
            .bind(operario.usuario_id)
            .first<{ n: number }>()
        )?.n,
      ).toBe(1);
    });

    it('solo el propietario maneja el equipo, y nadie se cambia ni se quita a sí mismo', async () => {
      const { p, o, operario } = await equipo();
      for (const ruta of [
        '/api/core/equipo/ver',
        '/api/core/equipo/quitar',
        '/api/core/equipo/rol',
      ]) {
        const renovada = (await (
          await post('/api/core/auth/refrescar', { refresh: o.refresh, org_id: ORG })
        ).json()) as Sesion;
        expect(
          (
            await conToken(ruta, renovada.acceso, {
              usuario_id: operario.usuario_id,
              rol: 'propietario',
            })
          ).status,
        ).toBe(403);
      }
      const propio = (await verificarAcceso(await clavePublica(), p.acceso, reloj)).sub;
      expect(
        (await conToken('/api/core/equipo/quitar', p.acceso, { usuario_id: propio })).status,
      ).toBe(400);
      expect(
        (await conToken('/api/core/equipo/rol', p.acceso, { usuario_id: propio, rol: 'operario' }))
          .status,
      ).toBe(400);
    });

    it('CA1: retirar un teléfono: su refresh deja de servir; los demás teléfonos siguen', async () => {
      const uno = await sesionDe('google-dueno');
      const dos = await sesionDe('google-dueno');
      const vistos = (await (await conToken('/api/core/telefonos/ver', uno.acceso, {})).json()) as {
        telefonos: { id: string; dispositivo: string }[];
      };
      expect(vistos.telefonos).toHaveLength(2);
      const [perdido] = vistos.telefonos;
      if (!perdido) throw new Error('sin teléfonos');
      expect(
        (await conToken('/api/core/telefonos/retirar', uno.acceso, { id: perdido.id })).status,
      ).toBe(200);
      const quedan = (await (await conToken('/api/core/telefonos/ver', uno.acceso, {})).json()) as {
        telefonos: unknown[];
      };
      expect(quedan.telefonos).toHaveLength(1);
      const r1 = await post('/api/core/auth/refrescar', { refresh: uno.refresh });
      const r2 = await post('/api/core/auth/refrescar', { refresh: dos.refresh });
      expect([r1.status, r2.status].sort()).toEqual([200, 401]);
      // Nadie retira teléfonos de otra cuenta.
      const ajeno = await sesionDe('google-ajeno');
      const [otro] = quedan.telefonos as { id: string }[];
      expect(
        (await conToken('/api/core/telefonos/retirar', ajeno.acceso, { id: otro?.id })).status,
      ).toBe(404);
    });
  });

  describe('HU-E0.6 · lista de espera de planes', () => {
    it('CA1: el propietario marca «Me interesa» sin cobro; repetirlo no escribe otra vez', async () => {
      const p = await propietario();
      const r = await conToken('/api/core/interes', p.acceso, { plan: 'finca' });
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ plan: 'finca', nuevo: true });
      // Repetido: INSERT OR IGNORE no escribe ninguna fila, que es lo que D1 cuenta.
      const otra = await conToken('/api/core/interes', p.acceso, { plan: 'finca' });
      expect(await otra.json()).toEqual({ plan: 'finca', nuevo: false });
      await conToken('/api/core/interes', p.acceso, { plan: 'exportador' });
      // Dos planes, dos filas, aunque se tocó tres veces (presupuesto ≤ 50 escrituras al día).
      const filas = await db
        .prepare('SELECT org_id, plan FROM interes_plan ORDER BY plan')
        .all<{ org_id: string; plan: string }>();
      expect(filas.results).toEqual([
        { org_id: ORG, plan: 'exportador' },
        { org_id: ORG, plan: 'finca' },
      ]);
      const vistos = await conToken('/api/core/interes/ver', p.acceso, {});
      expect(await vistos.json()).toEqual({ planes: ['exportador', 'finca'] });
    });

    it('solo el propietario: un operario no es intención de pago de la finca', async () => {
      const { cuerpo } = await invitar('operario');
      const o = await sesionDe('google-operario');
      await conToken('/api/core/invitaciones/aceptar', o.acceso, { codigo: cuerpo.codigo });
      const renovada = (await (
        await post('/api/core/auth/refrescar', { refresh: o.refresh, org_id: ORG })
      ).json()) as Sesion;
      const r = await conToken('/api/core/interes', renovada.acceso, { plan: 'finca' });
      expect(r.status).toBe(403);
    });

    it.each([
      ['sin sesión', null, { plan: 'finca' }, 401],
      ['un plan que no existe', 'propietario', { plan: 'oro' }, 400],
      ['el plan gratuito', 'propietario', { plan: 'gratuito' }, 400],
    ] as const)('%s se rechaza', async (_c, quien, cuerpo, estado) => {
      const acceso = quien ? (await propietario()).acceso : null;
      expect((await conToken('/api/core/interes', acceso, cuerpo)).status).toBe(estado);
    });

    it('una cuenta sin finca en la nube no puede avisar todavía', async () => {
      const s = await sesionDe('google-sin-finca');
      expect((await conToken('/api/core/interes', s.acceso, { plan: 'finca' })).status).toBe(403);
      expect(await (await conToken('/api/core/interes/ver', s.acceso, {})).json()).toEqual({
        planes: [],
      });
    });
  });

  describe('HU-E0.7 · pagar el plan Finca con Bold', () => {
    const IDENTIDAD = 'identidad-pruebas';
    const SECRETA = 'secreta-pruebas';
    const VUELTA_PAGO = `${APP}/agro/app/planes/`;
    /** Lo que contesta el Bold falso a la consulta de una orden; se cambia en cada prueba. */
    let bold: { status: number; cuerpo: unknown };
    let consultas: string[];
    const boldFalso = (async (url: string | URL | Request, init?: RequestInit) => {
      consultas.push(`${String(url)} ${new Headers(init?.headers).get('authorization')}`);
      return Response.json(bold.cuerpo, { status: bold.status });
    }) as typeof fetch;
    const conBold = crearApp({ google: () => googleFalso(), ahora: () => reloj, fetch: boldFalso });
    const pagar = (ruta: string, acceso: string | null, cuerpo: unknown) =>
      conBold.fetch(
        new Request(`${CORE}${ruta}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: APP,
            ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
          },
          body: JSON.stringify(cuerpo),
        }),
        env,
      );
    const aprobado = (total = 39000) => ({
      status: 200,
      cuerpo: { payment_status: 'APPROVED', total, transaction_id: 'TX-ENSAYO-1' },
    });
    interface Cobro {
      orden: string;
      pruebas: boolean;
      checkout: Record<string, string>;
    }
    async function cobro(acceso: string): Promise<Cobro> {
      const r = await pagar('/api/core/pago/crear', acceso, { plan: 'finca', vuelta: VUELTA_PAGO });
      expect(r.status).toBe(200);
      return (await r.json()) as Cobro;
    }
    /** El plan de la finca según una sesión renovada; guarda el refresh si rotó (una vez al día). */
    const planDeLaFinca = async (quien: { refresh: string }) => {
      const r = (await (
        await post('/api/core/auth/refrescar', { refresh: quien.refresh, org_id: ORG })
      ).json()) as {
        refresh: string | null;
        organizaciones: { org_id: string; plan: string; plan_vence: string | null }[];
      };
      if (r.refresh) quien.refresh = r.refresh;
      return r.organizaciones.find((o) => o.org_id === ORG);
    };

    /** El propietario, con un refresh que sirve: si renovar no lo rotó, sigue el de la entrada. */
    async function duena(): Promise<{ acceso: string; refresh: string }> {
      const s = await sesionDe('google-propietario');
      await conToken('/api/core/organizaciones', s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
      const r = (await (
        await post('/api/core/auth/refrescar', { refresh: s.refresh, org_id: ORG })
      ).json()) as Sesion;
      return { acceso: r.acceso, refresh: r.refresh ?? s.refresh ?? '' };
    }

    beforeEach(() => {
      env = { ...env, BOLD_IDENTIDAD: IDENTIDAD, BOLD_SECRETA: SECRETA, BOLD_AMBIENTE: 'pruebas' };
      bold = { status: 404, cuerpo: { message: 'NO_TRANSACTION_FOUND' } };
      consultas = [];
    });

    it('CA1: el CORE pone el monto de planes.json y firma el cobro como pide Bold', async () => {
      const p = await duena();
      const c = await cobro(p.acceso);
      expect(c.pruebas).toBe(true);
      expect(c.checkout).toMatchObject({
        orderId: c.orden,
        currency: 'COP',
        amount: '39000',
        apiKey: IDENTIDAD,
        redirectionUrl: `${VUELTA_PAGO}?pago=${c.orden}`,
      });
      expect(c.orden).toMatch(/^agro-[0-9a-f-]{36}$/);
      const esperada = createHash('sha256').update(`${c.orden}39000COP${SECRETA}`).digest('hex');
      expect(c.checkout['integritySignature']).toBe(esperada);
      // La llave secreta nunca sale del CORE.
      expect(JSON.stringify(c)).not.toContain(SECRETA);
      const fila = await db
        .prepare('SELECT estado, monto_cop, plan FROM pago WHERE id = ?')
        .bind(c.orden)
        .first();
      expect(fila).toEqual({ estado: 'esperando', monto_cop: 39000, plan: 'finca' });
    });

    it('CA2 y CA3: aprobado activa el plan un mes; confirmar otra vez no cobra ni extiende', async () => {
      const p = await duena();
      const c = await cobro(p.acceso);
      // Antes de que Bold sepa algo: sigue esperando y el plan no cambia.
      const espera = await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      expect(await espera.json()).toMatchObject({ estado: 'esperando' });
      expect((await planDeLaFinca(p))?.plan).toBe('gratuito');

      bold = aprobado();
      const r = await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      const vence = new Date(T0 + 30 * 24 * 3600 * 1000).toISOString();
      expect(await r.json()).toEqual({
        estado: 'aprobado',
        motivo: null,
        plan: 'finca',
        plan_vence: vence,
      });
      expect(consultas.at(-1)).toBe(
        `https://payments.api.bold.co/v2/payment-voucher/${c.orden} x-api-key ${IDENTIDAD}`,
      );
      const otra = await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      expect(await otra.json()).toMatchObject({ estado: 'aprobado', plan_vence: vence });
      expect(consultas).toHaveLength(2); // la segunda confirmación no le pregunta a Bold
      expect(await planDeLaFinca(p)).toMatchObject({ plan: 'finca', plan_vence: vence });
    });

    it('pagar antes de vencer suma el mes al vencimiento, no a hoy', async () => {
      const p = await duena();
      bold = aprobado();
      for (const _vez of [1, 2]) {
        const c = await cobro(p.acceso);
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
        reloj += 3600 * 1000;
      }
      expect((await planDeLaFinca(p))?.plan_vence).toBe(
        new Date(T0 + 60 * 24 * 3600 * 1000).toISOString(),
      );
    });

    it('CA4: al vencer, la finca vuelve al plan gratuito sin tocar nada más', async () => {
      const p = await duena();
      bold = aprobado();
      const c = await cobro(p.acceso);
      await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      reloj = T0 + 30 * 24 * 3600 * 1000 - 1;
      expect((await planDeLaFinca(p))?.plan).toBe('finca');
      reloj = T0 + 30 * 24 * 3600 * 1000;
      expect(await planDeLaFinca(p)).toMatchObject({ plan: 'gratuito', plan_vence: null });
    });

    it.each([
      ['otro monto', aprobado(1000), 'revisar'],
      ['rechazado', { status: 200, cuerpo: { payment_status: 'REJECTED' } }, 'rechazado'],
      ['en proceso', { status: 200, cuerpo: { payment_status: 'PENDING' } }, 'esperando'],
    ] as const)('%s: no activa el plan y dice por qué', async (_c, respuesta, estado) => {
      const p = await duena();
      const c = await cobro(p.acceso);
      bold = respuesta;
      const r = (await (
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden })
      ).json()) as { estado: string; motivo: string };
      expect(r.estado).toBe(estado);
      expect(r.motivo.length).toBeGreaterThan(10);
      expect((await planDeLaFinca(p))?.plan).toBe('gratuito');
    });

    it('Bold caído: el pago sigue esperando y se puede verificar después', async () => {
      const p = await duena();
      const c = await cobro(p.acceso);
      bold = { status: 500, cuerpo: {} };
      const r = await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      expect(await r.json()).toMatchObject({ estado: 'esperando' });
      bold = aprobado();
      const despues = await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      expect(await despues.json()).toMatchObject({ estado: 'aprobado' });
    });

    it('CA1: solo el propietario paga; un operario no', async () => {
      const { cuerpo } = await invitar('operario');
      const o = await sesionDe('google-operario');
      await conToken('/api/core/invitaciones/aceptar', o.acceso, { codigo: cuerpo.codigo });
      const renovada = (await (
        await post('/api/core/auth/refrescar', { refresh: o.refresh, org_id: ORG })
      ).json()) as Sesion;
      const r = await pagar('/api/core/pago/crear', renovada.acceso, {
        plan: 'finca',
        vuelta: VUELTA_PAGO,
      });
      expect(r.status).toBe(403);
    });

    it.each([
      ['sin sesión', false, { plan: 'finca', vuelta: VUELTA_PAGO }, 401],
      ['un plan sin cobro en línea', true, { plan: 'exportador', vuelta: VUELTA_PAGO }, 400],
      ['el gratuito', true, { plan: 'gratuito', vuelta: VUELTA_PAGO }, 400],
      [
        'una vuelta fuera del cuaderno',
        true,
        { plan: 'finca', vuelta: 'https://otro.test/x' },
        400,
      ],
      ['una vuelta a otra ruta', true, { plan: 'finca', vuelta: `${APP}/admin/` }, 400],
    ] as const)('%s se rechaza', async (_c, conSesion, cuerpo, estado) => {
      const acceso = conSesion ? (await duena()).acceso : null;
      expect((await pagar('/api/core/pago/crear', acceso, cuerpo)).status).toBe(estado);
    });

    it('nadie confirma el pago de otra finca', async () => {
      const p = await duena();
      const c = await cobro(p.acceso);
      const otra = await sesionDe('google-otra-finca');
      const ORG2 = '0199a1b2-0000-7000-8000-0000000000e2';
      await conToken('/api/core/organizaciones', otra.acceso, {
        id: ORG2,
        nombre: 'Finca Ensayo Dos',
      });
      const suya = (await (
        await post('/api/core/auth/refrescar', { refresh: otra.refresh, org_id: ORG2 })
      ).json()) as Sesion;
      bold = aprobado();
      const r = await pagar('/api/core/pago/confirmar', suya.acceso, { orden: c.orden });
      expect(r.status).toBe(404);
      expect((await planDeLaFinca(p))?.plan).toBe('gratuito');
    });

    it('la conciliación activa el plan de quien pagó y no volvió a la pantalla', async () => {
      const p = await duena();
      const c = await cobro(p.acceso);
      const proveedor = proveedorDePagoDe(env, boldFalso);
      // Sin noticias todavía: no cierra nada.
      expect(await conciliarPagos(db, proveedor, reloj)).toEqual({ revisados: 1, cerrados: 0 });
      bold = aprobado();
      expect(await conciliarPagos(db, proveedor, reloj)).toEqual({ revisados: 1, cerrados: 1 });
      expect((await planDeLaFinca(p))?.plan).toBe('finca');
      // Ya no queda nada esperando: la siguiente vuelta es una sola lectura.
      expect(await conciliarPagos(db, proveedor, reloj)).toEqual({ revisados: 0, cerrados: 0 });
      // Y confirmar después contesta lo mismo, sin preguntar otra vez.
      const antes = consultas.length;
      const r = await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      expect(await r.json()).toMatchObject({ estado: 'aprobado', plan: 'finca' });
      expect(consultas).toHaveLength(antes);
    });

    it('un día sin noticias: el cobro queda vencido y el plan no cambia', async () => {
      const p = await duena();
      await cobro(p.acceso);
      reloj += 24 * 3600 * 1000 + 1;
      const proveedor = proveedorDePagoDe(env, boldFalso);
      expect(await conciliarPagos(db, proveedor, reloj)).toEqual({ revisados: 1, cerrados: 1 });
      const fila = await db.prepare('SELECT estado, producto, proveedor FROM pago').first();
      expect(fila).toEqual({ estado: 'vencido', producto: 'agro', proveedor: 'bold' });
    });

    it('sin llaves, la conciliación no consulta nada', async () => {
      expect(await conciliarPagos(db, null, reloj)).toEqual({ revisados: 0, cerrados: 0 });
      expect(consultas).toEqual([]);
    });

    it('sin las llaves de Bold, pagar no está disponible y nada más cambia', async () => {
      const { BOLD_SECRETA: _sinSecreta, ...sinSecreta } = env;
      env = sinSecreta;
      const p = await duena();
      const r = await pagar('/api/core/pago/crear', p.acceso, {
        plan: 'finca',
        vuelta: VUELTA_PAGO,
      });
      expect(r.status).toBe(503);
      expect(await r.json()).toMatchObject({ estado: 'no-disponible' });
    });
  });
});
