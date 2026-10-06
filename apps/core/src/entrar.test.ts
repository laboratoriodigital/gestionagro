/**
 * Entrar con Google (HU-E4.2, CA1, CA3, CA4 y CA5 del lado del CORE) contra un D1 local y un
 * Google falso. Lo que el D1 local no imita: ver `@ed1/d1/local` (P17). Que Google acepte el
 * cliente y la dirección de regreso se comprueba en staging (P16).
 */

import { createHash } from 'node:crypto';
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import type { Producto } from '@ed1/productos';
import {
  type ClavePublica,
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
  hashDe,
  verificarAcceso,
} from '@ed1/tokens';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import {
  cargarProductosDePrueba,
  registroDelDestino,
} from '../../../scripts/lib/productos-de-prueba.ts';
import { catalogoDelRepositorio } from '../../../scripts/lib/registro-productos.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sumarMeses } from './calendario.ts';
import { type ProductoDelCatalogo, sentenciasDelCatalogo } from './catalogo.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import type { ProveedorGoogle } from './entrar.ts';
import { conciliarPagos, creditoAlCambiar } from './pagos.ts';
import { POLITICA_VIGENTE } from './politica.ts';
import { CATALOGO, CATALOGO_DE_STAGING, type CatalogoDelCore } from './productos.ts';
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

describe('HU-C3.1 · entrar con producto', () => {
  const ENSAYO = 'https://ensayo.ejemplo.test';
  const catalogo: CatalogoDelCore = {
    productos: [
      ...CATALOGO.productos,
      {
        id: 'ensayo',
        nombre: 'Producto Ensayo',
        estado: 'activo',
        app: { origenes: { produccion: ENSAYO, staging: ENSAYO }, rutas_de_vuelta: ['/panel/'] },
        tipos: ['comercio'],
        roles: [{ id: 'propietario', administra: true, invitable: true }],
        planes: 'content/agro/cuaderno/planes.json',
        politica: 'content/agro/privacidad/politica.json',
        prefijo_de_cobro: 'ensayo',
        gracia_dias: 7,
        presupuesto: { usd_mes: 10, al_agotarse: [] },
      },
      { ...CATALOGO.productos[0], id: 'dormido', estado: 'pausado' } as Producto,
    ],
    politicas: { ...CATALOGO.politicas, ensayo: 'e1', dormido: 'd1' },
    planes: CATALOGO.planes,
  };
  const conEnsayo = crearApp({ google: () => googleFalso(), ahora: () => reloj, catalogo });
  const ir = (ruta: string, init: RequestInit = {}) =>
    conEnsayo.fetch(new Request(`${CORE}${ruta}`, init), env);
  const inicioCon = (producto: string | null, vuelta: string, politica: string) =>
    ir(
      `/api/core/auth/google/inicio?${producto ? `producto=${producto}&` : ''}vuelta=${encodeURIComponent(vuelta)}&politica=${politica}`,
    );

  beforeEach(async () => {
    await db
      .prepare(
        "INSERT OR IGNORE INTO producto (id, nombre, estado, actualizado) VALUES ('ensayo', 'Producto Ensayo', 'activo', '2026-10-06')",
      )
      .run();
  });

  /** Entra al producto de ensayo y devuelve el código de entrada. */
  async function entrarAEnsayo(): Promise<string> {
    const ida = await inicioCon('ensayo', `${ENSAYO}/panel/`, 'e1');
    expect(ida.status).toBe(302);
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    const vuelta = await ir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const destino = vuelta.headers.get('location') ?? '';
    expect(destino.startsWith(`${ENSAYO}/panel/#entrar=`)).toBe(true);
    return destino.split('#entrar=')[1] ?? '';
  }

  it('sin producto es el agro: el cuaderno instalado entra como siempre (P10)', async () => {
    expect((await inicioCon(null, VUELTA, POLITICA_VIGENTE)).status).toBe(302);
  });

  it('CA4: rechaza una vuelta de otro producto, en los dos sentidos', async () => {
    expect((await inicioCon('agro', `${ENSAYO}/panel/`, POLITICA_VIGENTE)).status).toBe(400);
    expect((await inicioCon('ensayo', VUELTA, 'e1')).status).toBe(400);
    // Y una ruta que no es de vuelta, aunque el origen sea el suyo.
    expect((await inicioCon('ensayo', `${ENSAYO}/otra/`, 'e1')).status).toBe(400);
  });

  it('CA4: rechaza la política de otro producto, un producto pausado y uno que no existe', async () => {
    const otraPolitica = await inicioCon('ensayo', `${ENSAYO}/panel/`, POLITICA_VIGENTE);
    expect(otraPolitica.status).toBe(400);
    expect(await otraPolitica.text()).toContain('versión e1');
    const pausado = await inicioCon('dormido', VUELTA, 'd1');
    expect(await pausado.text()).toContain('en pausa');
    expect(await (await inicioCon('fantasma', VUELTA, 'x')).text()).toContain('no existe');
  });

  it('CA2 y CA3: la sesión nace con su producto, con su política aceptada, y la entrada se audita con él', async () => {
    const codigo = await entrarAEnsayo();
    expect(
      await db.prepare("SELECT producto FROM sesion WHERE dispositivo = 'sin-canjear'").first(),
    ).toEqual({ producto: 'ensayo' });
    expect(
      await db.prepare('SELECT producto, version FROM aceptacion_politica').all(),
    ).toMatchObject({ results: [{ producto: 'ensayo', version: 'e1' }] });
    // La política del agro (usuario.politica_*) no la escribe otro producto.
    expect(await db.prepare('SELECT politica_version FROM usuario').first()).toEqual({
      politica_version: null,
    });
    expect(
      await db.prepare("SELECT producto FROM auditoria WHERE accion = 'entrada'").first(),
    ).toEqual({ producto: 'ensayo' });
    expect(codigo).not.toBe('');
  });

  it('CA3 ❌: el canje desde la app de otro producto se rechaza sin gastar el código', async () => {
    const codigo = await entrarAEnsayo();
    const desdeElAgro = await ir('/api/core/auth/canje', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: APP },
      body: JSON.stringify({ codigo, dispositivo: 't1' }),
    });
    expect(desdeElAgro.status).toBe(403);
    expect(await desdeElAgro.json()).toMatchObject({ estado: 'otro-producto' });
    const desdeSuApp = await ir('/api/core/auth/canje', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ENSAYO },
      body: JSON.stringify({ codigo, dispositivo: 't1' }),
    });
    expect(desdeSuApp.status).toBe(200);
  });
});

describe('HU-C3.2 · organizaciones, invitaciones y equipo por producto', () => {
  const ENSAYO = 'https://ensayo.ejemplo.test';
  const ORG = '0199a1b2-0000-7000-8000-00000000c302';
  // El rol que administra no se llama «propietario»: si el código lo tuviera escrito, esto falla.
  const ensayo: ProductoDelCatalogo = {
    id: 'ensayo',
    nombre: 'Producto Ensayo',
    estado: 'activo',
    tipos: ['comercio'],
    roles: [
      { id: 'dueno', administra: true, invitable: false },
      { id: 'colaborador', administra: false, invitable: true },
    ],
    planes: [
      { id: 'gratis', nombre: 'Gratis', gratuito: true },
      { id: 'vitrina', nombre: 'Vitrina', cobro: { '1': 25000 } },
    ],
  };
  const catalogo: CatalogoDelCore = {
    productos: [
      ...CATALOGO.productos,
      {
        ...(CATALOGO.productos[0] as Producto),
        id: 'ensayo',
        nombre: 'Producto Ensayo',
        prefijo_de_cobro: 'ensayo',
        app: { origenes: { produccion: ENSAYO, staging: ENSAYO }, rutas_de_vuelta: ['/panel/'] },
        tipos: ensayo.tipos,
        roles: ensayo.roles,
      },
    ],
    politicas: { ...CATALOGO.politicas, ensayo: 'e1' },
    planes: {
      ...CATALOGO.planes,
      ensayo: [
        { id: 'gratis', nombre: 'Gratis', gratuito: true },
        { id: 'vitrina', nombre: 'Vitrina', cobro_mensual_cop: 25000 },
      ],
    },
  };
  const app2 = crearApp({
    google: () => googleFalso('google-dueno'),
    ahora: () => reloj,
    catalogo,
  });
  const ir = (ruta: string, init: RequestInit = {}) =>
    app2.fetch(new Request(`${CORE}${ruta}`, init), env);
  const conToken = (ruta: string, acceso: string, cuerpo: unknown) =>
    ir(ruta, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ENSAYO,
        authorization: `Bearer ${acceso}`,
      },
      body: JSON.stringify(cuerpo),
    });

  /** Un espacio del producto de ensayo, con quien entra como su «dueno», y su token. */
  /** El refresh vigente de la última sesión de `dueno()` (HU-C4.4). */
  let refreshDelDueno = '';
  async function dueno(): Promise<string> {
    for (const s of sentenciasDelCatalogo([ensayo], '2026-10-06T00:00:00.000Z')) {
      await db.prepare(s).run();
    }
    const ida = await ir(
      `/api/core/auth/google/inicio?producto=ensayo&vuelta=${encodeURIComponent(`${ENSAYO}/panel/`)}&politica=e1`,
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    const vuelta = await ir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const codigo = (vuelta.headers.get('location') ?? '').split('#entrar=')[1];
    const canje = (await (
      await ir('/api/core/auth/canje', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ENSAYO },
        body: JSON.stringify({ codigo, dispositivo: 'panel' }),
      })
    ).json()) as Sesion;
    const usuario = (await db.prepare('SELECT id FROM usuario').first<{ id: string }>())?.id;
    for (const s of [
      "INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES ('c9', 'ensayo', 'https://api-c9', 'activa', 0, '[\"ensayo_c9_s1\"]')",
      `INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('${ORG}', 'ensayo', 'Comercio Ensayo', 'comercio', 'gratis', 'c9', 'ensayo_c9_s1', 1, '2026-10-06')`,
      `INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('${usuario}', '${ORG}', 'ensayo', 'dueno', '2026-10-06')`,
    ]) {
      await db.prepare(s).run();
    }
    const conOrg = (await (
      await ir('/api/core/auth/refrescar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ENSAYO },
        body: JSON.stringify({ refresh: canje.refresh, org_id: ORG }),
      })
    ).json()) as Sesion;
    refreshDelDueno = conOrg.refresh ?? canje.refresh ?? '';
    return conOrg.acceso;
  }

  it('CA3: administra el rol con «administra», aunque no se llame propietario', async () => {
    const acceso = await dueno();
    const r = await conToken('/api/core/invitaciones', acceso, { rol: 'colaborador' });
    expect(r.status).toBe(201);
    expect((await conToken('/api/core/equipo/ver', acceso, {})).status).toBe(200);
    expect((await conToken('/api/core/auditoria/ver', acceso, {})).status).toBe(200);
  });

  it('CA2: solo roles invitables del producto de la organización; un rol del agro no se ofrece', async () => {
    const acceso = await dueno();
    expect((await conToken('/api/core/invitaciones', acceso, { rol: 'operario' })).status).toBe(
      400,
    );
    // «dueno» administra, pero no se da por invitación.
    expect((await conToken('/api/core/invitaciones', acceso, { rol: 'dueno' })).status).toBe(400);
  });

  it('la invitación y la membresía nacen con el producto de la organización', async () => {
    const acceso = await dueno();
    const { codigo } = (await (
      await conToken('/api/core/invitaciones', acceso, { rol: 'colaborador' })
    ).json()) as { codigo: string };
    expect(await db.prepare('SELECT producto, rol FROM invitacion').first()).toEqual({
      producto: 'ensayo',
      rol: 'colaborador',
    });
    expect(codigo).toBeTruthy();
  });

  describe('HU-C4.4 · refresh por producto', () => {
    const FINCA = '0199a1b2-0000-7000-8000-00000000c404';
    const OTRO = '0199a1b2-0000-7000-8000-00000000c405';
    const refrescarDesde = (origen: string, refresh: string, org_id?: string) =>
      ir('/api/core/auth/refrescar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: origen },
        body: JSON.stringify({ refresh, ...(org_id ? { org_id } : {}) }),
      });
    /** La misma persona, también en una finca del agro. */
    async function tambienEnElAgro() {
      const usuario = (await db.prepare('SELECT id FROM usuario').first<{ id: string }>())?.id;
      await db
        .prepare(
          "INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES (?, 'agro', 'Finca', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-11-30')",
        )
        .bind(FINCA)
        .run();
      await db
        .prepare(
          "INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES (?, ?, 'agro', 'propietario', '2026-11-30')",
        )
        .bind(usuario, FINCA)
        .run();
    }

    it('CA1 · solo entrega organizaciones del producto de la sesión', async () => {
      await dueno();
      await tambienEnElAgro();
      const r = await refrescarDesde(ENSAYO, refreshDelDueno);
      expect(r.status).toBe(200);
      const sesion = (await r.json()) as Sesion & { organizaciones: { org_id: string }[] };
      expect(sesion.organizaciones.map((o) => o.org_id)).toEqual([ORG]);
      // Pedir la finca del agro con la sesión de ensayo no da un token de esa finca.
      const pedida = (await (await refrescarDesde(ENSAYO, refreshDelDueno, FINCA)).json()) as {
        org_id: string | null;
        aviso: string | null;
      };
      expect(pedida.org_id).not.toBe(FINCA);
      expect(pedida.aviso).toBe('No perteneces a la organización pedida.');
    });

    it('CA2 ❌ · desde la app de otro producto: 403, en la auditoría, y el refresh sigue sirviéndole a su dueño', async () => {
      await dueno();
      const r = await refrescarDesde(APP, refreshDelDueno);
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({ estado: 'otro-producto' });
      expect(
        await db
          .prepare("SELECT producto, detalle FROM auditoria WHERE accion = 'refresh_rechazado'")
          .first(),
      ).toEqual({ producto: 'ensayo', detalle: JSON.stringify({ origen: APP }) });
      expect((await refrescarDesde(ENSAYO, refreshDelDueno)).status).toBe(200);
      // Sin Origin tampoco.
      expect(
        (
          await ir('/api/core/auth/refrescar', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ refresh: refreshDelDueno }),
          })
        ).status,
      ).toBe(403);
    });

    it('CA3 · con dos organizaciones del mismo producto, sin pedir una no hay token de ninguna', async () => {
      await dueno();
      const usuario = (await db.prepare('SELECT id FROM usuario').first<{ id: string }>())?.id;
      await db
        .prepare(
          "INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES (?, 'ensayo', 'Otro comercio', 'comercio', 'gratis', 'c9', 'ensayo_c9_s1', 1, '2026-11-30')",
        )
        .bind(OTRO)
        .run();
      await db
        .prepare(
          "INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES (?, ?, 'ensayo', 'colaborador', '2026-11-30')",
        )
        .bind(usuario, OTRO)
        .run();
      const sinPedir = (await (await refrescarDesde(ENSAYO, refreshDelDueno)).json()) as Sesion & {
        org_id: string | null;
      };
      expect(sinPedir.org_id).toBeNull();
      expect(await verificarAcceso(await clavePublica(), sinPedir.acceso, reloj)).toMatchObject({
        org: null,
      });
      const pidiendo = (await (await refrescarDesde(ENSAYO, refreshDelDueno, OTRO)).json()) as {
        org_id: string;
      };
      expect(pidiendo.org_id).toBe(OTRO);
    });
  });

  describe('HU-C3.5 · CORS y origen por producto', () => {
    const FINCA = '0199a1b2-0000-7000-8000-00000000c305';
    /** Un token del agro con una finca del agro, firmado con la clave del CORE de la prueba. */
    async function delAgro(): Promise<string> {
      const usuario =
        (await db.prepare('SELECT id FROM usuario').first<{ id: string }>())?.id ?? '';
      await db
        .prepare(
          "INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES (?, 'agro', 'Finca', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-11-17')",
        )
        .bind(FINCA)
        .run();
      await db
        .prepare(
          "INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES (?, ?, 'agro', 'propietario', '2026-11-17')",
        )
        .bind(usuario, FINCA)
        .run();
      const datos = {
        sub: usuario,
        org: FINCA,
        rol: 'propietario',
        celda: 'c0',
        shard: 'agro_c0_s1',
        anillo: 1,
      };
      return (await firmarAcceso(await firmanteDesde(clave), datos, reloj)).token;
    }
    const desde = (origen: string, acceso: string) =>
      ir('/api/core/equipo/ver', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: origen,
          authorization: `Bearer ${acceso}`,
        },
        body: '{}',
      });

    it('CA1 · CORS deja leer a la app de cada producto del catálogo, y a ninguna otra', async () => {
      const preflight = (origen: string) =>
        ir('/api/core/equipo/ver', {
          method: 'OPTIONS',
          headers: { origin: origen, 'access-control-request-method': 'POST' },
        });
      expect((await preflight(ENSAYO)).headers.get('access-control-allow-origin')).toBe(ENSAYO);
      expect((await preflight(APP)).headers.get('access-control-allow-origin')).toBe(APP);
      expect(
        (await preflight('https://otra.ejemplo.test')).headers.get('access-control-allow-origin'),
      ).toBeNull();
    });

    it('CA2 ❌ · cada sesión solo desde la app de su producto, aunque la otra esté en la unión', async () => {
      const deEnsayo = await dueno();
      const agro = await delAgro();
      const matriz = [
        { sesion: 'agro', origen: APP, estado: 200 },
        { sesion: 'agro', origen: ENSAYO, estado: 403 },
        { sesion: 'ensayo', origen: ENSAYO, estado: 200 },
        { sesion: 'ensayo', origen: APP, estado: 403 },
      ];
      const obtenido = [];
      for (const caso of matriz) {
        const r = await desde(caso.origen, caso.sesion === 'agro' ? agro : deEnsayo);
        obtenido.push({ ...caso, estado: r.status });
        if (r.status === 403) expect(await r.json()).toMatchObject({ estado: 'otro-producto' });
      }
      expect(obtenido).toEqual(matriz);
    });

    it('sin Origin, una sesión con producto no se usa', async () => {
      const deEnsayo = await dueno();
      const r = await ir('/api/core/equipo/ver', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${deEnsayo}` },
        body: '{}',
      });
      expect(r.status).toBe(403);
    });
  });

  describe('HU-C3.4 · interés y pagos con los planes del producto', () => {
    const conPago = crearApp({
      google: () => googleFalso('google-dueno'),
      ahora: () => reloj,
      catalogo,
      fetch: (async () => Response.json({}, { status: 404 })) as typeof fetch,
    });
    const pagar = (ruta: string, acceso: string, cuerpo: unknown) =>
      conPago.fetch(
        new Request(`${CORE}${ruta}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: ENSAYO,
            authorization: `Bearer ${acceso}`,
          },
          body: JSON.stringify(cuerpo),
        }),
        { ...env, BOLD_IDENTIDAD: 'i', BOLD_SECRETA: 's', BOLD_AMBIENTE: 'pruebas' },
      );

    it('CA1 · «Me interesa» acepta los planes de pago de su producto y nace con él', async () => {
      const acceso = await dueno();
      const r = await conToken('/api/core/interes', acceso, { plan: 'vitrina' });
      expect(r.status).toBe(200);
      expect(await db.prepare('SELECT producto, plan FROM interes_plan').first()).toEqual({
        producto: 'ensayo',
        plan: 'vitrina',
      });
      // El gratuito no tiene lista de espera.
      expect((await conToken('/api/core/interes', acceso, { plan: 'gratis' })).status).toBe(400);
    });

    it('CA1 · el cobro usa el plan, el prefijo y la pantalla de vuelta del producto', async () => {
      const acceso = await dueno();
      const r = await pagar('/api/core/pago/crear', acceso, {
        plan: 'vitrina',
        vuelta: `${ENSAYO}/panel/planes`,
      });
      expect(r.status).toBe(200);
      const { orden } = (await r.json()) as { orden: string };
      expect(orden).toMatch(/^ensayo-/);
      expect(
        await db
          .prepare('SELECT producto, plan, monto_cop, meses FROM pago WHERE id = ?')
          .bind(orden)
          .first(),
      ).toEqual({ producto: 'ensayo', plan: 'vitrina', monto_cop: 25000, meses: 1 });
    });

    it('CA2 ❌ · un plan de otro producto se rechaza en la API, y una vuelta a otra app también', async () => {
      const acceso = await dueno();
      expect((await conToken('/api/core/interes', acceso, { plan: 'finca' })).status).toBe(400);
      expect(
        (await pagar('/api/core/pago/crear', acceso, { plan: 'finca', vuelta: `${ENSAYO}/panel/` }))
          .status,
      ).toBe(400);
      expect(
        (
          await pagar('/api/core/pago/crear', acceso, {
            plan: 'vitrina',
            vuelta: `${APP}/agro/app/planes/`,
          })
        ).status,
      ).toBe(400);
      expect(await db.prepare('SELECT count(*) AS n FROM pago').first()).toEqual({ n: 0 });
    });

    it('CA2 ❌ · y en la base: el plan de otro producto no entra aunque alguien lo escriba a mano', async () => {
      await dueno();
      const usuario = (await db.prepare('SELECT id FROM usuario').first<{ id: string }>())?.id;
      await expect(
        db
          .prepare(
            "INSERT INTO interes_plan (usuario_id, org_id, producto, plan, creado) VALUES (?, ?, 'ensayo', 'finca', '2026-11-17')",
          )
          .bind(usuario, ORG)
          .run(),
      ).rejects.toThrow(/FOREIGN KEY/);
    });
  });

  it('CA4 ❌: el producto del cuerpo no manda: crear una organización nunca la crea en otro producto', async () => {
    // Con tokens v2 (HU-C4.3) el producto es el `aud` de la sesión: aunque el cuerpo diga «agro»,
    // la organización nace en el producto de la sesión, con su tipo.
    const acceso = await dueno();
    const r = await conToken('/api/core/organizaciones', acceso, {
      id: '0199a1b2-0000-7000-8000-00000000c303',
      nombre: 'Comercio Ensayo Dos',
      producto: 'agro',
    });
    expect(r.status).toBe(201);
    expect(
      await db
        .prepare(
          "SELECT producto, tipo FROM organizacion WHERE id = '0199a1b2-0000-7000-8000-00000000c303'",
        )
        .first(),
    ).toEqual({ producto: 'ensayo', tipo: 'comercio' });
  });
});

describe('HU-C7.3 · entrar a la cuenta y salir', () => {
  // La cuenta vive en el mismo origen que el CORE: en staging, el del CORE de staging.
  const CUENTA = 'https://agro-core-staging.laboratoriodigital-la.workers.dev';
  // El despliegue copia el catálogo a la base; aquí, el producto de la cuenta como lo copiaría.
  beforeEach(async () => {
    const productoCuenta = {
      id: 'cuenta',
      nombre: 'Laboratorio Digital',
      estado: 'activo' as const,
      tipos: [],
      roles: [],
      planes: [],
    };
    for (const sql of sentenciasDelCatalogo([productoCuenta], '2026-10-06T00:00:00.000Z'))
      await db.prepare(sql).run();
  });
  const desde = (ruta: string, cuerpo: unknown, origen = CUENTA) =>
    pedir(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: origen },
      body: JSON.stringify(cuerpo),
    });

  async function entrarALaCuenta(): Promise<Sesion> {
    const ida = await pedir(
      `/api/core/auth/google/inicio?producto=cuenta&vuelta=${encodeURIComponent(`${CUENTA}/`)}&politica=1`,
    );
    expect(ida.status).toBe(302);
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    const vuelta = await pedir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const destino = vuelta.headers.get('location') ?? '';
    expect(destino.startsWith(`${CUENTA}/#entrar=`)).toBe(true);
    const r = await desde('/api/core/auth/canje', {
      codigo: destino.split('#entrar=')[1],
      dispositivo: 'navegador',
    });
    expect(r.status).toBe(200);
    return (await r.json()) as Sesion;
  }

  it('CA1 · entra con la política de la cuenta, vuelve a la cuenta y no trae organizaciones', async () => {
    const sesion = (await entrarALaCuenta()) as Sesion & { organizaciones: unknown[] };
    expect(sesion.organizaciones).toEqual([]);
    expect(await db.prepare('SELECT producto, version FROM aceptacion_politica').first()).toEqual({
      producto: 'cuenta',
      version: '1',
    });
    expect(await db.prepare('SELECT producto FROM sesion').first()).toEqual({ producto: 'cuenta' });
    // Sin aceptar la política de la cuenta (la del agro es otra) no se entra.
    expect(
      (
        await pedir(
          `/api/core/auth/google/inicio?producto=cuenta&vuelta=${encodeURIComponent(`${CUENTA}/`)}&politica=${POLITICA_VIGENTE}`,
        )
      ).status,
    ).toBe(400);
  });

  it('CA3 · salir cierra la sesión en el CORE: el refresh ya no renueva', async () => {
    const { refresh } = await entrarALaCuenta();
    expect((await desde('/api/core/auth/refrescar', { refresh })).status).toBe(200);
    const r = await desde('/api/core/auth/salir', { refresh });
    expect(await r.json()).toEqual({ estado: 'fuera' });
    expect((await desde('/api/core/auth/refrescar', { refresh })).status).toBe(401);
    // Salir otra vez no es un error.
    expect((await desde('/api/core/auth/salir', { refresh })).status).toBe(200);
  });

  it('salir desde la app de otro producto no cierra nada', async () => {
    const { refresh } = await entrarALaCuenta();
    expect((await desde('/api/core/auth/salir', { refresh }, APP)).status).toBe(403);
    expect((await desde('/api/core/auth/refrescar', { refresh })).status).toBe(200);
  });

  it('CA4 ❌ · el token de la cuenta no trae organización: ninguna celda lo acepta', async () => {
    const { acceso } = await entrarALaCuenta();
    const reclamos = await verificarAcceso(await clavePublica(), acceso, reloj);
    expect(reclamos).toMatchObject({ org: null, celda: null, shard: null, aud: 'cuenta' });
  });

  it('una sesión de la cuenta no crea organizaciones: la cuenta no tiene', async () => {
    const { acceso } = await entrarALaCuenta();
    const r = await pedir('/api/core/organizaciones', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: CUENTA,
        authorization: `Bearer ${acceso}`,
      },
      body: JSON.stringify({ id: '0199a1b2-0000-7000-8000-00000000c731', nombre: 'Algo' }),
    });
    expect(r.status).toBe(403);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM organizacion').first()).toEqual({ n: 0 });
  });
});

describe('HU-C3.7 · CA2: la misma persona en dos productos, cada sesión con lo suyo', () => {
  const ENSAYO = 'https://ed1-ensayo-staging.laboratoriodigital-la.workers.dev';
  const FINCA = '0199a1b2-0000-7000-8000-00000000c371';
  const COMERCIO = '0199a1b2-0000-7000-8000-00000000c372';
  const enStaging = crearApp({
    google: () => googleFalso('google-la-misma'),
    ahora: () => reloj,
    catalogo: CATALOGO_DE_STAGING,
  });
  const ir = (ruta: string, init: RequestInit = {}) =>
    enStaging.fetch(new Request(`${CORE}${ruta}`, init), env);
  const enviar = (ruta: string, origen: string, cuerpo: unknown, acceso?: string) =>
    ir(ruta, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: origen,
        ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    });

  // Como el despliegue de staging: el catálogo con los de prueba y sus celdas de directorio.
  beforeEach(async () => {
    const prueba = cargarProductosDePrueba();
    for (const sql of [
      ...sentenciasDelCatalogo(
        catalogoDelRepositorio(registroDelDestino('staging')),
        '2026-10-06T00:00:00.000Z',
      ),
      ...sentenciasDeCeldas([...cargarCeldas().celdas, ...prueba.celdas], 'staging'),
    ]) {
      await db.prepare(sql).run();
    }
  });

  async function entrar(consulta: string, origen: string, vuelta: string): Promise<Sesion> {
    const ida = await ir(
      `/api/core/auth/google/inicio?${consulta}&vuelta=${encodeURIComponent(vuelta)}`,
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const state = new URL(ida.headers.get('location') ?? '').searchParams.get('state');
    const regreso = await ir(`/api/core/auth/google/callback?code=code-bueno&state=${state}`, {
      headers: { cookie },
    });
    const codigo = (regreso.headers.get('location') ?? '').split('#entrar=')[1];
    return (await (
      await enviar('/api/core/auth/canje', origen, { codigo, dispositivo: origen })
    ).json()) as Sesion;
  }

  it('entra al agro y a ensayo, crea un espacio en cada uno y cada sesión ve solo lo suyo', async () => {
    const agro = await entrar(`politica=${POLITICA_VIGENTE}`, APP, VUELTA);
    const ensayo = await entrar('producto=ensayo&politica=1', ENSAYO, `${ENSAYO}/`);
    expect(
      (await enviar('/api/core/organizaciones', APP, { id: FINCA, nombre: 'Finca' }, agro.acceso))
        .status,
    ).toBe(201);
    expect(
      (
        await enviar(
          '/api/core/organizaciones',
          ENSAYO,
          { id: COMERCIO, nombre: 'Comercio' },
          ensayo.acceso,
        )
      ).status,
    ).toBe(201);
    const deAgro = (await (
      await enviar('/api/core/auth/refrescar', APP, { refresh: agro.refresh })
    ).json()) as Sesion & {
      organizaciones: { org_id: string }[];
    };
    const deEnsayo = (await (
      await enviar('/api/core/auth/refrescar', ENSAYO, { refresh: ensayo.refresh })
    ).json()) as Sesion & { organizaciones: { org_id: string }[] };
    expect(deAgro.organizaciones.map((o) => o.org_id)).toEqual([FINCA]);
    expect(deEnsayo.organizaciones.map((o) => o.org_id)).toEqual([COMERCIO]);
    // Una sola organización por sesión: el token ya la lleva, con su producto y su celda.
    expect(await verificarAcceso(await clavePublica(), deEnsayo.acceso, reloj)).toMatchObject({
      aud: 'ensayo',
      org: COMERCIO,
      rol: 'dueno',
      celda: 'c9',
      plan: 'gratis',
    });
    expect(await verificarAcceso(await clavePublica(), deAgro.acceso, reloj)).toMatchObject({
      aud: 'agro',
      org: FINCA,
      celda: 'c0',
    });
    // Y el refresh de una no sirve desde la app de la otra.
    expect(
      (await enviar('/api/core/auth/refrescar', APP, { refresh: ensayo.refresh })).status,
    ).toBe(403);
  });

  describe('HU-C7.4 · mis espacios en todos los productos, desde la cuenta', () => {
    const CUENTA = 'https://agro-core-staging.laboratoriodigital-la.workers.dev';
    async function conDosEspacios() {
      const agro = await entrar(`politica=${POLITICA_VIGENTE}`, APP, VUELTA);
      const ensayo = await entrar('producto=ensayo&politica=1', ENSAYO, `${ENSAYO}/`);
      await enviar('/api/core/organizaciones', APP, { id: FINCA, nombre: 'Finca' }, agro.acceso);
      await enviar(
        '/api/core/organizaciones',
        ENSAYO,
        { id: COMERCIO, nombre: 'Comercio' },
        ensayo.acceso,
      );
      const deLaCuenta = await entrar('producto=cuenta&politica=1', CUENTA, `${CUENTA}/`);
      return { agro, deLaCuenta };
    }
    const espacios = (acceso: string, origen = CUENTA) =>
      enviar('/api/core/cuenta/espacios', origen, {}, acceso);

    it('CA1 · una tarjeta por organización, de los dos productos, con a dónde abrirla', async () => {
      const { deLaCuenta } = await conDosEspacios();
      const r = await espacios(deLaCuenta.acceso);
      expect(r.status).toBe(200);
      expect((await r.json()) as unknown).toEqual({
        espacios: [
          {
            org_id: FINCA,
            nombre: 'Finca',
            producto: 'agro',
            producto_nombre: 'CultivoPro',
            rol: 'propietario',
            plan: 'gratuito',
            plan_nombre: 'Gratis',
            plan_vence: null,
            abrir: `${APP}/agro/app/`,
          },
          {
            org_id: COMERCIO,
            nombre: 'Comercio',
            producto: 'ensayo',
            producto_nombre: 'Ensayo',
            rol: 'dueno',
            plan: 'gratis',
            plan_nombre: 'Gratis',
            plan_vence: null,
            abrir: `${ENSAYO}/`,
          },
        ],
      });
    });

    it('solo con un token de la cuenta: el de una app ve lo suyo por su lado, no todo', async () => {
      const { agro } = await conDosEspacios();
      expect((await espacios(agro.acceso, APP)).status).toBe(403);
    });

    it('CA3 ❌ · nunca un espacio sin membresía: quitarla lo saca de la lista', async () => {
      const { deLaCuenta } = await conDosEspacios();
      await db.prepare('DELETE FROM membresia WHERE org_id = ?').bind(COMERCIO).run();
      const { espacios: lista } = (await (await espacios(deLaCuenta.acceso)).json()) as {
        espacios: { org_id: string }[];
      };
      expect(lista.map((x) => x.org_id)).toEqual([FINCA]);
    });
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
        // Como el navegador: un POST de otro origen siempre lleva Origin (HU-C3.1 lo exige).
        headers: { 'content-type': 'application/json', origin: APP },
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
    // La sesión nueva y la fila de auditoría de la entrada (HU-C2.4); la aceptación no se reescribe.
    expect(cuenta.escrituras).toBe(2);
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

  describe('HU-C4.3 · el CORE emite tokens v2', () => {
    const leer = async (acceso: string) => verificarAcceso(await clavePublica(), acceso, reloj);

    it('CA1 · ed1-core, ver 2, aud del producto de la organización, plan y auth_time', async () => {
      const entrada = reloj;
      const p = await propietario();
      expect(await leer(p.acceso)).toMatchObject({
        iss: 'ed1-core',
        ver: 2,
        aud: 'agro',
        org: ORG,
        plan: 'gratuito',
        plan_vence: null,
        auth_time: Math.floor(entrada / 1000),
      });
    });

    it('sin organización, el aud es el producto de la sesión y no hay plan', async () => {
      const s = await sesionDe('google-sin-finca');
      const r = await leer(s.acceso);
      expect(r).toMatchObject({ iss: 'ed1-core', aud: 'agro', org: null });
      expect(r.plan).toBeUndefined();
    });

    it('CA3 ❌ · renovar no cambia auth_time: solo entrar con Google lo hace', async () => {
      const entrada = reloj;
      const s = await sesionDe('google-propietario');
      await conToken('/api/core/organizaciones', s.acceso, { id: ORG, nombre: 'Finca Ensayo Uno' });
      reloj += 2 * 24 * 60 * 60 * 1000; // pasa la rotación diaria del refresh
      const r = (await (
        await post('/api/core/auth/refrescar', { refresh: s.refresh, org_id: ORG })
      ).json()) as Sesion;
      expect(r.refresh).toBeTruthy();
      expect(r.refresh).not.toBe(s.refresh);
      expect((await leer(r.acceso)).auth_time).toBe(Math.floor(entrada / 1000));
      expect((await leer(r.acceso)).iat).toBe(Math.floor(reloj / 1000));
    });

    it('CA2 · un token v1 ya emitido sigue sirviendo hasta su exp', async () => {
      const p = await propietario();
      const usuario = (await leer(p.acceso)).sub;
      const v1 = (
        await firmarAcceso(
          await firmanteDesde(clave),
          {
            sub: usuario,
            org: ORG,
            rol: 'propietario',
            celda: 'c0',
            shard: 'agro_c0_s1',
            anillo: 1,
          },
          reloj,
        )
      ).token;
      expect((await leer(v1)).iss).toBe('agro-core');
      expect((await conToken('/api/core/equipo/ver', v1, {})).status).toBe(200);
    });
  });

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

  describe('HU-C2.4 · auditoría de lo que toca seguridad o dinero', () => {
    const acciones = async () =>
      (
        await db
          .prepare('SELECT accion, org_id, producto FROM auditoria ORDER BY id')
          .all<{ accion: string; org_id: string | null; producto: string }>()
      ).results;

    it('CA1: entrada, invitación aceptada, cambio de rol, persona quitada y teléfono retirado dejan su fila', async () => {
      const { p, cuerpo } = await invitar('operario');
      const o = await sesionDe('google-operario');
      await conToken('/api/core/invitaciones/aceptar', o.acceso, { codigo: cuerpo.codigo });
      const vistos = (await (await conToken('/api/core/equipo/ver', p.acceso, {})).json()) as {
        miembros: { usuario_id: string; tu: boolean }[];
      };
      const operario = vistos.miembros.find((m) => !m.tu)?.usuario_id;
      await conToken('/api/core/equipo/rol', p.acceso, { usuario_id: operario, rol: 'supervisor' });
      await conToken('/api/core/equipo/quitar', p.acceso, { usuario_id: operario });
      const tel = (await (await conToken('/api/core/telefonos/ver', o.acceso, {})).json()) as {
        telefonos: { id: string }[];
      };
      await conToken('/api/core/telefonos/retirar', o.acceso, { id: tel.telefonos[0]?.id });
      expect((await acciones()).map((a) => a.accion)).toEqual([
        'entrada',
        'entrada',
        'invitacion_aceptada',
        'rol_cambiado',
        'persona_quitada',
        'telefono_retirado',
      ]);
      expect((await acciones()).every((a) => a.producto === 'agro')).toBe(true);
    });

    it('CA2: ver el equipo, renovar y un intento que no cambia nada no escriben auditoría', async () => {
      const p = await propietario();
      const antes = (await acciones()).length;
      await conToken('/api/core/equipo/ver', p.acceso, {});
      await post('/api/core/auth/refrescar', { refresh: p.refresh, org_id: ORG });
      // Quitar a alguien que no está: 404 y ninguna fila (el hecho no ocurrió).
      expect(
        (await conToken('/api/core/equipo/quitar', p.acceso, { usuario_id: 'nadie' })).status,
      ).toBe(404);
      expect((await acciones()).length).toBe(antes);
    });

    it('CA3 y CA4: solo quien administra la ve, y solo la de su finca', async () => {
      const { p, cuerpo } = await invitar('operario');
      const o = await sesionDe('google-operario');
      await conToken('/api/core/invitaciones/aceptar', o.acceso, { codigo: cuerpo.codigo });
      // Un hecho de otra finca no debe aparecer.
      await db
        .prepare(
          "INSERT INTO auditoria (instante, producto, org_id, usuario_id, accion) VALUES ('2026-10-01', 'agro', 'otra-finca', NULL, 'rol_cambiado')",
        )
        .run();
      const r = await conToken('/api/core/auditoria/ver', p.acceso, {});
      expect(r.status).toBe(200);
      const { hechos } = (await r.json()) as { hechos: { accion: string; quien: string }[] };
      expect(hechos.map((h) => h.accion)).toEqual(['invitacion_aceptada']);
      const delOperario = (await (
        await post('/api/core/auth/refrescar', { refresh: o.refresh, org_id: ORG })
      ).json()) as Sesion;
      expect((await conToken('/api/core/auditoria/ver', delOperario.acceso, {})).status).toBe(403);
      expect((await conToken('/api/core/auditoria/ver', null, {})).status).toBe(401);
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
      // HU-C5.1: un mes calendario. T0 es el 1 de octubre: vence el 1 de noviembre, 31 días después.
      const vence = new Date(sumarMeses(T0, 1)).toISOString();
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
      // HU-C2.4: el pago cerrado deja una sola fila, aunque se confirmó dos veces.
      const pagos = await db
        .prepare("SELECT detalle FROM auditoria WHERE accion = 'pago_cerrado'")
        .all<{ detalle: string }>();
      expect(pagos.results.map((f) => JSON.parse(f.detalle))).toEqual([
        { pago: c.orden, estado: 'aprobado', plan: 'finca', meses: 1, monto_cop: 39000 },
      ]);
    });

    describe('HU-C5.3 · pagar 1, 3, 6 o 12 meses', () => {
      // Los precios de 3, 6 y 12 meses los copia el despliegue desde planes.json (HU-C2.3).
      beforeEach(async () => {
        for (const sql of sentenciasDelCatalogo(
          catalogoDelRepositorio(),
          '2026-10-01T00:00:00.000Z',
        )) {
          await db.prepare(sql).run();
        }
      });
      const cobroDe = async (acceso: string, meses: unknown, plan = 'finca') =>
        pagar('/api/core/pago/crear', acceso, { plan, vuelta: VUELTA_PAGO, meses });

      it('CA1 y CA2 · 6 meses: el monto sale de la base y el plan cuenta 6 meses calendario', async () => {
        const p = await duena();
        const r = await cobroDe(p.acceso, 6);
        expect(r.status).toBe(200);
        const { orden } = (await r.json()) as Cobro;
        expect(
          await db.prepare('SELECT meses, monto_cop FROM pago WHERE id = ?').bind(orden).first(),
        ).toEqual({ meses: 6, monto_cop: 210000 });
        bold = aprobado(210000);
        await pagar('/api/core/pago/confirmar', p.acceso, { orden });
        const vence = new Date(sumarMeses(T0, 6)).toISOString();
        expect(await planDeLaFinca(p)).toMatchObject({ plan: 'finca', plan_vence: vence });
        expect(
          await db
            .prepare('SELECT periodo_desde, periodo_hasta FROM pago WHERE id = ?')
            .bind(orden)
            .first(),
        ).toEqual({ periodo_desde: new Date(T0).toISOString(), periodo_hasta: vence });
      });

      it('CA2 · pagado otra vez antes de vencer, el periodo nuevo empieza donde termina el vigente', async () => {
        const p = await duena();
        bold = aprobado(39000);
        const uno = (await (await cobroDe(p.acceso, 1)).json()) as Cobro;
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: uno.orden });
        reloj += 3600 * 1000;
        bold = aprobado(111000);
        const tres = (await (await cobroDe(p.acceso, 3)).json()) as Cobro;
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: tres.orden });
        expect(
          await db
            .prepare('SELECT periodo_desde, periodo_hasta FROM pago WHERE id = ?')
            .bind(tres.orden)
            .first(),
        ).toEqual({
          periodo_desde: new Date(sumarMeses(T0, 1)).toISOString(),
          periodo_hasta: new Date(sumarMeses(sumarMeses(T0, 1), 3)).toISOString(),
        });
      });

      it('HU-C5.4 · cambiar de plan con días por delante los convierte en días del plan nuevo', async () => {
        // Un precio de Exportador para la prueba: hoy no se cobra en línea.
        await db
          .prepare(
            "INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('agro', 'exportador', 1, 149000, '2026-10-01T00:00:00.000Z')",
          )
          .run();
        const p = await duena();
        bold = aprobado(39000);
        const finca = (await (await cobroDe(p.acceso, 1)).json()) as Cobro;
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: finca.orden });
        reloj += 3600 * 1000;
        const vigente = sumarMeses(T0, 1);
        const restante = Math.floor((vigente - reloj) / (24 * 3600 * 1000));
        bold = aprobado(149000);
        const exportador = (await (await cobroDe(p.acceso, 1, 'exportador')).json()) as Cobro;
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: exportador.orden });
        const credito = Math.floor((restante * 39000) / 149000);
        expect(credito).toBe(7);
        expect(await planDeLaFinca(p)).toMatchObject({
          plan: 'exportador',
          plan_vence: new Date(sumarMeses(reloj, 1) + credito * 24 * 3600 * 1000).toISOString(),
        });
      });

      it('CA4 ❌ · un periodo sin precio para ese plan no se cobra; un monto alterado queda en «revisar»', async () => {
        const p = await duena();
        for (const [meses, plan] of [
          [2, 'finca'],
          ['6', 'finca'],
          [6, 'exportador'],
          [1, 'gratuito'],
        ] as const) {
          expect((await cobroDe(p.acceso, meses, plan)).status, `${plan} por ${meses}`).toBe(400);
        }
        expect(await db.prepare('SELECT COUNT(*) AS n FROM pago').first()).toEqual({ n: 0 });
        const { orden } = (await (await cobroDe(p.acceso, 12)).json()) as Cobro;
        bold = aprobado(39000); // pagó un mes por un cobro de doce
        expect(
          await (await pagar('/api/core/pago/confirmar', p.acceso, { orden })).json(),
        ).toMatchObject({
          estado: 'revisar',
        });
        expect((await planDeLaFinca(p))?.plan).toBe('gratuito');
      });
    });

    it('pagar antes de vencer suma el mes al vencimiento, no a hoy', async () => {
      const p = await duena();
      bold = aprobado();
      for (const _vez of [1, 2]) {
        const c = await cobro(p.acceso);
        await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
        reloj += 3600 * 1000;
      }
      expect((await planDeLaFinca(p))?.plan_vence).toBe(new Date(sumarMeses(T0, 2)).toISOString());
    });

    it('CA4: al vencer, la finca vuelve al plan gratuito sin tocar nada más', async () => {
      const p = await duena();
      bold = aprobado();
      const c = await cobro(p.acceso);
      await pagar('/api/core/pago/confirmar', p.acceso, { orden: c.orden });
      reloj = sumarMeses(T0, 1) - 1;
      expect((await planDeLaFinca(p))?.plan).toBe('finca');
      reloj = sumarMeses(T0, 1);
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

describe('HU-C5.4 · el crédito al cambiar de plan', () => {
  it('CA2 · el ejemplo de PLATAFORMA: 40 días de Finca a Exportador son 10 días', () => {
    expect(creditoAlCambiar(40, 39000, 149000)).toBe(10);
  });

  it('CA3 ❌ · desde el plan gratuito el crédito es cero, y nada se devuelve en dinero', () => {
    expect(creditoAlCambiar(40, null, 149000)).toBe(0);
    expect(creditoAlCambiar(0, 39000, 149000)).toBe(0);
    expect(creditoAlCambiar(-3, 39000, 149000)).toBe(0);
  });

  it('bajar de plan da más días: lo pagado vale lo mismo', () => {
    expect(creditoAlCambiar(10, 149000, 39000)).toBe(38);
  });
});
