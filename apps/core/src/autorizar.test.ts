/**
 * HU-C9.4: autorizar a un agente, con consentimiento. La ruta valida y lleva a la pantalla; la
 * decisión vuelve a validar todo antes de crear la concesión y el código. La pantalla se prueba
 * en `tests/e2e/cuenta-autorizar.spec.ts`.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
  hashDe,
  verificarAcceso,
  verificarAccesoDeAgente,
} from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { catalogoDelRepositorio } from '../../../scripts/lib/registro-productos.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDelCatalogo } from './catalogo.ts';
import { ServicioDelCore } from './entrada-de-servicio.ts';
import { crearApp, type Env } from './worker.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
let clave: string;
const AHORA = Date.UTC(2026, 10, 2, 15);
const CORE = 'https://agro-core-staging.example';
const CUENTA = 'https://cuenta.laboratorio-digital.com';
const CLIENTE = 'dcr-ensayo';
const VUELTA = 'https://agente.example/vuelta';
/** El MCP del cuaderno en staging, como lo declara `productos.json`. */
const RECURSO = 'https://agro-api-c0-staging.laboratoriodigital-la.workers.dev';
const RETO = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const FINCA = '0199a1b2-0000-7000-8000-00000000c941';
const AJENA = '0199a1b2-0000-7000-8000-00000000c942';

beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
  clave = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => {
  await vaciarCore(db);
  await db.prepare('DELETE FROM alcance').run();
  for (const s of sentenciasDelCatalogo(catalogoDelRepositorio(), '2026-10-12T00:00:00.000Z'))
    await db.prepare(s).run();
  for (const s of [
    "INSERT INTO celda (id, url_api, estado, anillo_despliegue, shards) VALUES ('c0', 'https://api-c0', 'activa', 0, '[\"agro_c0_s1\"]')",
    "INSERT INTO usuario (id, nombre, email, creado) VALUES ('u-ana', 'Ana', 'ana@example.com', '2026-10-01'), ('u-otro', 'Otro', 'otro@example.com', '2026-10-01')",
    `INSERT INTO organizacion (id, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('${FINCA}', 'Finca La Esperanza', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-10-01'), ('${AJENA}', 'Finca Ajena', 'finca', 'gratuito', 'c0', 'agro_c0_s1', 1, '2026-10-01')`,
    `INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES ('u-ana', '${FINCA}', 'propietario', '2026-10-01'), ('u-otro', '${AJENA}', 'propietario', '2026-10-01')`,
    `INSERT INTO cliente_oauth (id, tipo, nombre, redirect_uris, estado, creado) VALUES ('${CLIENTE}', 'dcr', 'Asistente Ensayo', '["${VUELTA}"]', 'activo', '2026-11-01T00:00:00.000Z')`,
  ])
    await db.prepare(s).run();
});

const env = (destino = 'staging'): Env => ({
  DB: db,
  CORE_JWT_PRIVATE_KEY: clave,
  GOOGLE_CLIENT_ID: 'cliente',
  GOOGLE_CLIENT_SECRET: 'secreto',
  ORIGENES_APP: 'https://agro.example',
  DESTINO: destino,
});
const app = crearApp({ ahora: () => AHORA });

const BUENO = {
  response_type: 'code',
  client_id: CLIENTE,
  redirect_uri: VUELTA,
  code_challenge: RETO,
  code_challenge_method: 'S256',
  state: 'xyz',
  scope: 'agro:registros:leer',
  resource: RECURSO,
};
const autorizar = (pedido: Record<string, string | undefined>, destino = 'staging') => {
  const q = new URLSearchParams(
    Object.entries(pedido).filter((x): x is [string, string] => x[1] !== undefined),
  );
  return app.fetch(new Request(`${CORE}/oauth/authorize?${q}`), env(destino));
};
const solicitudDe = (r: Response) => {
  const destino = r.headers.get('location') ?? '';
  const cruda = new URLSearchParams(destino.split('#')[1] ?? '').get('solicitud') ?? '';
  return JSON.parse(atob(cruda.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
};
const deLaCuenta = async (usuario = 'u-ana') =>
  (
    await firmarAcceso(
      await firmanteDesde(clave),
      {
        sub: usuario,
        org: null,
        rol: null,
        celda: null,
        shard: null,
        anillo: null,
        aud: 'cuenta',
        plan: 'gratuito',
      },
      AHORA,
      2,
    )
  ).token;
const decidir = async (cuerpo: unknown, usuario = 'u-ana') =>
  app.fetch(
    new Request(`${CORE}/api/core/cuenta/autorizar`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: CUENTA,
        authorization: `Bearer ${await deLaCuenta(usuario)}`,
      },
      body: JSON.stringify(cuerpo),
    }),
    env(),
  );

describe('HU-C9.4 · GET /oauth/authorize', () => {
  it('CA1 · una solicitud válida lleva a la pantalla con quién pide, qué y de cuál producto', async () => {
    const r = await autorizar(BUENO);
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toMatch(/^\/autorizar\/#solicitud=/);
    expect(solicitudDe(r)).toMatchObject({
      cliente: { nombre: 'Asistente Ensayo' },
      producto: 'agro',
      producto_nombre: 'CultivoPro',
      alcances: [
        { id: 'agro:registros:leer', descripcion: expect.stringMatching(/^Leer los registros/) },
      ],
      vuelve_a: 'agente.example',
    });
  });

  it('CA3 ❌ · sin PKCE S256, sin resource o con uno de nadie, vuelve al cliente con el error y sin código', async () => {
    const casos: [Record<string, string | undefined>, string][] = [
      [{ ...BUENO, code_challenge: undefined }, 'invalid_request'],
      [{ ...BUENO, code_challenge_method: 'plain' }, 'invalid_request'],
      [{ ...BUENO, resource: undefined }, 'invalid_target'],
      [{ ...BUENO, resource: 'https://mcp.otro.example' }, 'invalid_target'],
      [{ ...BUENO, scope: 'parqueadero:caja:leer' }, 'invalid_scope'],
      [{ ...BUENO, response_type: 'token' }, 'unsupported_response_type'],
    ];
    for (const [pedido, error] of casos) {
      const r = await autorizar(pedido);
      const destino = new URL(r.headers.get('location') ?? '');
      expect(`${destino.origin}${destino.pathname}`).toBe(VUELTA);
      expect(destino.searchParams.get('error'), error).toBe(error);
      expect(destino.searchParams.get('state')).toBe('xyz');
      expect(destino.searchParams.has('code')).toBe(false);
    }
  });

  it('❌ · un cliente que no conocemos, o una vuelta que no es suya, se dice en la página y no se redirige', async () => {
    for (const pedido of [
      { ...BUENO, client_id: 'dcr-nadie' },
      { ...BUENO, redirect_uri: 'https://atacante.example/vuelta' },
    ]) {
      const r = await autorizar(pedido);
      expect(r.headers.get('location')).toMatch(/^\/autorizar\/#error=/);
    }
  });

  it('en producción también se autoriza (HC6 aceptada el 24 oct 2026)', async () => {
    expect((await autorizar(BUENO, 'produccion')).status).not.toBe(404);
  });
});

describe('HU-C9.4 · la decisión de la persona', () => {
  it('CA2 · permitir sobre su espacio crea la concesión y un código de un uso, con PKCE y en la auditoría', async () => {
    const r = await decidir({ pedido: BUENO, decision: 'permitir', org_id: FINCA });
    expect(r.status).toBe(200);
    const vuelta = new URL(((await r.json()) as { vuelta: string }).vuelta);
    expect(`${vuelta.origin}${vuelta.pathname}`).toBe(VUELTA);
    expect(vuelta.searchParams.get('state')).toBe('xyz');
    expect(vuelta.searchParams.get('iss')).toBe(CORE);
    const codigo = vuelta.searchParams.get('code') ?? '';
    expect(codigo.length).toBeGreaterThan(20);
    const fila = await db
      .prepare(
        `SELECT k.code_challenge, k.redirect_uri, c.org_id, c.recurso, c.alcances, c.cliente_id
           FROM codigo_oauth k JOIN concesion_oauth c ON c.id = k.concesion_id WHERE k.codigo_hash = ?`,
      )
      .bind(await hashDe(codigo))
      .first();
    expect(fila).toEqual({
      code_challenge: RETO,
      redirect_uri: VUELTA,
      org_id: FINCA,
      recurso: RECURSO,
      alcances: '["agro:registros:leer"]',
      cliente_id: CLIENTE,
    });
    expect(
      await db.prepare("SELECT accion FROM auditoria WHERE accion = 'concesion_creada'").first(),
    ).toEqual({ accion: 'concesion_creada' });
  });

  it('negar vuelve al cliente con access_denied, y no crea nada', async () => {
    const r = await decidir({ pedido: BUENO, decision: 'negar' });
    const vuelta = new URL(((await r.json()) as { vuelta: string }).vuelta);
    expect(vuelta.searchParams.get('error')).toBe('access_denied');
    expect(await db.prepare('SELECT COUNT(*) AS n FROM concesion_oauth').first()).toEqual({ n: 0 });
  });

  it('CA2 ❌ · un espacio que no es suyo no se puede dar', async () => {
    const r = await decidir({ pedido: BUENO, decision: 'permitir', org_id: AJENA });
    expect(r.status).toBe(403);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM codigo_oauth').first()).toEqual({ n: 0 });
  });

  it('CA3 ❌ · lo que trae la página se vuelve a validar: un pedido alterado no da código', async () => {
    const r = await decidir({
      pedido: { ...BUENO, code_challenge_method: 'plain' },
      decision: 'permitir',
      org_id: FINCA,
    });
    const vuelta = new URL(((await r.json()) as { vuelta: string }).vuelta);
    expect(vuelta.searchParams.get('error')).toBe('invalid_request');
    expect(vuelta.searchParams.has('code')).toBe(false);
    expect(await db.prepare('SELECT COUNT(*) AS n FROM codigo_oauth').first()).toEqual({ n: 0 });
  });
});

describe('HU-C9.5 · el canje del código y el refresh rotado', () => {
  const VERIFICADOR = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const RETO_DEL_VERIFICADOR = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  let reloj = AHORA;
  const conReloj = crearApp({ ahora: () => reloj });
  const canjear = (cuerpo: Record<string, string>, destino = 'staging') =>
    conReloj.fetch(
      new Request(`${CORE}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(cuerpo).toString(),
      }),
      env(destino),
    );
  async function codigo() {
    reloj = AHORA;
    const r = await decidir({
      pedido: { ...BUENO, code_challenge: RETO_DEL_VERIFICADOR },
      decision: 'permitir',
      org_id: FINCA,
    });
    return new URL(((await r.json()) as { vuelta: string }).vuelta).searchParams.get('code') ?? '';
  }
  const conCodigo = (code: string, extra: Record<string, string> = {}) => ({
    grant_type: 'authorization_code',
    code,
    code_verifier: VERIFICADOR,
    redirect_uri: VUELTA,
    client_id: CLIENTE,
    ...extra,
  });
  const claves = async () => [(await firmanteDesde(clave)).publica];

  it('CA1 · el código da un token de 1 h para su recurso, con scope, azp y cnc, y un refresh', async () => {
    const r = await canjear(conCodigo(await codigo()));
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const t = (await r.json()) as Record<string, unknown>;
    expect(t).toMatchObject({
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'agro:registros:leer',
    });
    const reclamos = await verificarAccesoDeAgente(
      await claves(),
      String(t['access_token']),
      RECURSO,
      reloj,
    );
    expect(reclamos).toMatchObject({
      sub: 'u-ana',
      org: FINCA,
      azp: CLIENTE,
      scope: 'agro:registros:leer',
    });
    expect(reclamos.exp - reclamos.iat).toBe(3600);
    // El token de un agente no le sirve a ninguna app: su emisor es otro.
    await expect(
      verificarAcceso((await claves())[0] as never, String(t['access_token']), reloj),
    ).rejects.toThrow(/Emisor desconocido/);
    // Ni a otro recurso.
    await expect(
      verificarAccesoDeAgente(
        await claves(),
        String(t['access_token']),
        'https://mcp.otro.example',
        reloj,
      ),
    ).rejects.toThrow(/otro recurso/);
  });

  it('❌ · un código usado, vencido, con otra vuelta o sin el verificador PKCE no da token', async () => {
    const usado = await codigo();
    expect((await canjear(conCodigo(usado))).status).toBe(200);
    expect(((await (await canjear(conCodigo(usado))).json()) as { error: string }).error).toBe(
      'invalid_grant',
    );
    for (const extra of [
      { code_verifier: 'x'.repeat(43) },
      { redirect_uri: 'https://agente.example/otra' },
      { client_id: 'dcr-otro' },
    ]) {
      const r = await canjear(conCodigo(await codigo(), extra));
      expect(r.status, JSON.stringify(extra)).toBe(400);
    }
    const viejo = await codigo();
    reloj = AHORA + 11 * 60 * 1000;
    expect((await canjear(conCodigo(viejo))).status).toBe(400);
  });

  it('CA2 ❌ · el refresh rota; reusar uno ya rotado revoca la concesión entera y queda en la auditoría', async () => {
    const primero = (await (await canjear(conCodigo(await codigo()))).json()) as Record<
      string,
      string
    >;
    const conRefresh = (refresh: string) => ({
      grant_type: 'refresh_token',
      refresh_token: refresh,
      client_id: CLIENTE,
    });
    const segundo = (await (
      await canjear(conRefresh(primero['refresh_token'] ?? ''))
    ).json()) as Record<string, string>;
    expect(segundo['access_token']).toBeTruthy();
    expect(segundo['refresh_token']).not.toBe(primero['refresh_token']);
    // Alguien reusa el primero: la concesión cae, y con ella el refresh bueno.
    const reuso = await canjear(conRefresh(primero['refresh_token'] ?? ''));
    expect(((await reuso.json()) as { error: string }).error).toBe('invalid_grant');
    expect((await canjear(conRefresh(segundo['refresh_token'] ?? ''))).status).toBe(400);
    expect(
      await db.prepare('SELECT revocada IS NOT NULL AS revocada FROM concesion_oauth').first(),
    ).toEqual({ revocada: 1 });
    expect(
      await db.prepare("SELECT detalle FROM auditoria WHERE accion = 'concesion_revocada'").first(),
    ).toMatchObject({ detalle: expect.stringContaining('reuso de refresh') });
  });

  it('en producción también hay canje: un código que no existe se rechaza, no da 404', async () => {
    expect((await canjear(conCodigo('x'), 'produccion')).status).not.toBe(404);
  });
});

describe('HU-C9.6 · revocar y los asistentes con acceso', () => {
  const VERIFICADOR = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const RETO_DEL_VERIFICADOR = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  const pedir = (ruta: string, cuerpo: Record<string, string>) =>
    app.fetch(
      new Request(`${CORE}${ruta}`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(cuerpo).toString(),
      }),
      env(),
    );
  async function tokens() {
    const d = await decidir({
      pedido: { ...BUENO, code_challenge: RETO_DEL_VERIFICADOR },
      decision: 'permitir',
      org_id: FINCA,
    });
    const code =
      new URL(((await d.json()) as { vuelta: string }).vuelta).searchParams.get('code') ?? '';
    const t = await pedir('/oauth/token', {
      grant_type: 'authorization_code',
      code,
      code_verifier: VERIFICADOR,
      redirect_uri: VUELTA,
      client_id: CLIENTE,
    });
    return (await t.json()) as { access_token: string; refresh_token: string };
  }
  const concesion = async () =>
    (await db.prepare('SELECT id FROM concesion_oauth').first<{ id: string }>())?.id ?? '';
  const servicio = () => new ServicioDelCore({}, { DB: db, DESTINO: 'staging' });
  const cuenta = async (ruta: string, cuerpo: unknown, usuario = 'u-ana') =>
    app.fetch(
      new Request(`${CORE}/api/core/cuenta/${ruta}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: CUENTA,
          authorization: `Bearer ${await deLaCuenta(usuario)}`,
        },
        body: JSON.stringify(cuerpo),
      }),
      env(),
    );

  it('CA1 · el agente devuelve su refresh o su token y la concesión cae; el recurso lo sabe en la siguiente (CA2)', async () => {
    const t = await tokens();
    expect(await servicio().concesionVigente(await concesion())).toBe(true);
    expect(
      (await pedir('/oauth/revoke', { token: t.refresh_token, client_id: CLIENTE })).status,
    ).toBe(200);
    expect(await servicio().concesionVigente(await concesion())).toBe(false);
    // Con el token de acceso también.
    await db.prepare('DELETE FROM refresco_oauth').run();
    await db.prepare('DELETE FROM codigo_oauth').run();
    await db.prepare('DELETE FROM concesion_oauth').run();
    const otro = await tokens();
    expect((await pedir('/oauth/revoke', { token: otro.access_token })).status).toBe(200);
    expect(await servicio().concesionVigente(await concesion())).toBe(false);
    // Un token que no existe también responde 200 (RFC 7009): no sirve para averiguar nada.
    expect((await pedir('/oauth/revoke', { token: 'no-existe' })).status).toBe(200);
  });

  it('CA1 · la cuenta lista los asistentes con lo que pueden hacer, y «Quitar acceso» los corta', async () => {
    await tokens();
    const lista = (await (await cuenta('asistentes', {})).json()) as {
      asistentes: { id: string; cliente: string; espacio: string; puede: string[] }[];
    };
    expect(lista.asistentes).toEqual([
      expect.objectContaining({
        cliente: 'Asistente Ensayo',
        espacio: 'Finca La Esperanza',
        puede: [expect.stringMatching(/^Leer los registros de tu finca/)],
      }),
    ]);
    const id = lista.asistentes[0]?.id ?? '';
    // ❌ Nunca la de otra persona, ni con el id en el cuerpo.
    expect((await cuenta('asistentes/quitar', { id }, 'u-otro')).status).toBe(404);
    expect(await servicio().concesionVigente(id)).toBe(true);
    expect((await cuenta('asistentes/quitar', { id })).status).toBe(200);
    expect(await servicio().concesionVigente(id)).toBe(false);
    expect(
      ((await (await cuenta('asistentes', {})).json()) as { asistentes: unknown[] }).asistentes,
    ).toEqual([]);
  });
});
