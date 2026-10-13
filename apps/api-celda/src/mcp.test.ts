/**
 * HU-C9.7: el MCP del cuaderno, solo lectura, contra el D1 local de un shard con una finca de
 * ensayo. El CORE se reemplaza por un service binding falso. Lo que no ve (P17): un cliente MCP
 * de verdad (WI-C9.7.3, del dueño) y el dominio `mcp.cultivopro.co`.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';
import {
  type Firmante,
  firmanteDesde,
  firmarAcceso,
  firmarAccesoDeAgente,
  generarClavePrivada,
} from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ALCANCE_DE_LECTURA, soloLoDelMcp } from './mcp.ts';
import type { KvDeFlags } from './vigia.ts';
import { crearApp, type Env, TABLAS_DEL_SHARD } from './worker.ts';

const SHARD = 'agro_c0_s1';
const ORG = '0199a1b2-0000-7000-8000-00000000c971';
const RECURSO = 'https://agro-api-c0-staging.laboratoriodigital-la.workers.dev';
/** 2 nov 2026, 9:00 de Bogotá. */
const AHORA = Date.UTC(2026, 10, 2, 14);

let db: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());

const catalogo = (seq: number, entidad: string, datos: Record<string, unknown>) =>
  db
    .prepare(
      'INSERT INTO catalogo (id, org_id, seq, entidad, version, v, datos, actualizado, dispositivo_id) VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?)',
    )
    .bind(
      String(datos['id']),
      ORG,
      seq,
      entidad,
      JSON.stringify(datos),
      '2026-10-01T00:00:00.000Z',
      'tel',
    )
    .run();
const registro = (
  seq: number,
  id: string,
  tipo: string,
  fecha: string,
  areas: string[],
  datos: Record<string, unknown>,
  anula: string | null = null,
) =>
  db
    .prepare(
      `INSERT INTO registro (id, org_id, seq, finca_id, area_ids, tipo, v, fecha_agronomica, instante_evento, instante_recibido, persona_ids, dispositivo_id, origen, anula_id, datos)
       VALUES (?, ?, ?, 'finca-1', ?, ?, 2, ?, ?, ?, '[]', 'tel', 'manual', ?, ?)`,
    )
    .bind(
      id,
      ORG,
      seq,
      JSON.stringify(areas),
      tipo,
      fecha,
      `${fecha}T14:00:00.000Z`,
      `${fecha}T14:00:00.000Z`,
      anula,
      JSON.stringify(datos),
    )
    .run();

beforeEach(async () => {
  await vaciar(db, [...TABLAS_DEL_SHARD]);
  await catalogo(1, 'area', {
    id: 'nave-1',
    finca_id: 'finca-1',
    nombre: 'Nave 1',
    activa: true,
    padre_id: null,
  });
  await catalogo(2, 'area', {
    id: 'nave-2',
    finca_id: 'finca-1',
    nombre: 'Nave 2',
    activa: true,
    padre_id: null,
  });
  await catalogo(3, 'insumo', {
    id: 'ins-1',
    nombre_comercial: 'Fungicida Ensayo',
    carencia_dias: 3,
    reentrada_horas: 4,
  });
  // Hoy se fumigó la nave 1: 3 días de carencia.
  await registro(1, 'r-1', 'aplicacion', '2026-11-02', ['nave-1'], {
    insumo_id: 'ins-1',
    insumo: 'Fungicida Ensayo',
    carenciaDias: 3,
    reentradaHoras: 4,
  });
  // Una aplicación en la nave 2, corregida: la corrección dice que fue en otra fecha vieja.
  await registro(2, 'r-2', 'aplicacion', '2026-11-02', ['nave-2'], {
    insumo_id: 'ins-1',
    insumo: 'Fungicida Ensayo',
    carenciaDias: 3,
    reentradaHoras: 4,
  });
  await registro(
    3,
    'r-3',
    'aplicacion',
    '2026-10-01',
    ['nave-2'],
    {
      insumo_id: 'ins-1',
      insumo: 'Fungicida Ensayo',
      carenciaDias: 3,
      reentradaHoras: 4,
    },
    'r-2',
  );
  await registro(4, 'r-4', 'riego', '2026-11-01', ['nave-1'], { litros: 1200 });
});

function kvFalso(valores: Record<string, string> = {}): KvDeFlags {
  return { get: async (k) => valores[k] ?? null, put: async () => undefined };
}

const env = (extra: Partial<Env> = {}): Env => ({
  CELDA: 'c0',
  PRODUCTO: 'agro',
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  ORIGENES_APP: 'https://agro.example',
  RECURSO_MCP: RECURSO,
  EMISOR_OAUTH: 'https://agro-core-staging.laboratoriodigital-la.workers.dev',
  CORE: { planes: async () => [], concesionVigente: async () => true },
  FLAGS: kvFalso(),
  [SHARD]: db,
  ...extra,
});
const app = crearApp({ ahora: () => AHORA });
const token = async (extra: Record<string, string> = {}) =>
  (
    await firmarAccesoDeAgente(
      firmante,
      {
        sub: 'u-ana',
        aud: RECURSO,
        azp: 'dcr-ensayo',
        cnc: 'k-1',
        org: ORG,
        celda: 'c0',
        shard: SHARD,
        scope: ALCANCE_DE_LECTURA,
        ...extra,
      },
      AHORA,
    )
  ).token;
const rpc = async (cuerpo: unknown, autorizacion?: string, e: Env = env()) =>
  app.fetch(
    new Request(`${RECURSO}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(autorizacion ? { authorization: `Bearer ${autorizacion}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    }),
    e,
  );
const llamar = async (nombre: string, args: Record<string, unknown> = {}) =>
  (await (
    await rpc(
      { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: nombre, arguments: args } },
      await token(),
    )
  ).json()) as {
    result: { content: { text: string }[]; structuredContent: Record<string, unknown> };
  };

describe('HU-C9.7 · el MCP del cuaderno, solo lectura', () => {
  it('CA1 · publica sus metadatos de recurso (RFC 9728) y su Server Card', async () => {
    const m = await app.fetch(
      new Request(`${RECURSO}/.well-known/oauth-protected-resource`),
      env(),
    );
    expect(await m.json()).toMatchObject({
      resource: RECURSO,
      authorization_servers: ['https://agro-core-staging.laboratoriodigital-la.workers.dev'],
      scopes_supported: [ALCANCE_DE_LECTURA],
    });
    const tarjeta = await app.fetch(
      new Request(`${RECURSO}/.well-known/mcp/server-card.json`),
      env(),
    );
    expect(await tarjeta.json()).toMatchObject({
      name: 'cuaderno-cultivopro',
      remotes: [{ type: 'streamable-http', url: `${RECURSO}/mcp` }],
    });
  });

  it('CA2 · sin token, 401 con WWW-Authenticate y el enlace a sus metadatos', async () => {
    const r = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize' });
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${RECURSO}/.well-known/oauth-protected-resource"`,
    );
  });

  it('CA3 ❌ · un token de otro recurso, o el de una app, no entra', async () => {
    const otro = await rpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      await token({ aud: 'https://mcp.otro.example' }),
    );
    expect(otro.status).toBe(401);
    expect(otro.headers.get('www-authenticate')).toContain('error="invalid_token"');
    const deApp = (
      await firmarAcceso(
        firmante,
        {
          sub: 'u-ana',
          org: ORG,
          rol: 'propietario',
          celda: 'c0',
          shard: SHARD,
          anillo: 1,
          aud: 'agro',
          plan: 'finca',
        },
        AHORA,
        2,
      )
    ).token;
    expect((await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }, deApp)).status).toBe(401);
  });

  it('CA3 ❌ · solo herramientas de lectura: ninguna escribe', async () => {
    const init = (await (
      await rpc(
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
        await token(),
      )
    ).json()) as { result: { protocolVersion: string } };
    expect(init.result.protocolVersion).toBe('2025-06-18');
    const lista = (await (
      await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, await token())
    ).json()) as {
      result: { tools: { name: string; annotations: { readOnlyHint: boolean } }[] };
    };
    expect(lista.result.tools.map((t) => t.name)).toEqual([
      'calendario_de_carencias',
      'ultimos_registros',
    ]);
    expect(lista.result.tools.every((t) => t.annotations.readOnlyHint)).toBe(true);
    // Una notificación no tiene respuesta.
    expect(
      (await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, await token())).status,
    ).toBe(202);
  });

  it('CA1 · «¿qué nave puedo cosechar?»: la nave fumigada hoy no; la de la corrección vieja, sí', async () => {
    const r = await llamar('calendario_de_carencias', { dias: 3 });
    const texto = r.result.content[0]?.text ?? '';
    expect(texto).toContain('- Nave 1: hoy no (No cosechar hasta el 05/11 (Fungicida Ensayo)');
    expect(texto).toContain('- Nave 2: hoy se puede cosechar y entrar');
    expect((r.result.structuredContent['areas'] as unknown[]).length).toBe(2);
  });

  it('CA1 · lo último que se anotó, sin lo corregido', async () => {
    const r = await llamar('ultimos_registros', { limite: 10 });
    const registros = r.result.structuredContent['registros'] as { tipo: string; fecha: string }[];
    expect(registros.map((x) => `${x.fecha} ${x.tipo}`)).toEqual([
      '2026-11-02 aplicacion',
      '2026-11-01 riego',
      '2026-10-01 aplicacion',
    ]);
    const soloRiegos = await llamar('ultimos_registros', { tipo: 'riego' });
    expect(soloRiegos.result.content[0]?.text).toBe('- 2026-11-01 · riego · Nave 1');
  });

  it('HU-C9.6 CA2 ❌ · una concesión quitada se rechaza en la siguiente; sin CORE no se lee', async () => {
    const quitada = env({ CORE: { planes: async () => [], concesionVigente: async () => false } });
    const r = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, await token(), quitada);
    expect(r.status).toBe(401);
    expect(r.headers.get('www-authenticate')).toContain('Quitaron este acceso');
    const caido = env({
      CORE: {
        planes: async () => [],
        concesionVigente: async () => {
          throw new Error('sin respuesta');
        },
      },
    });
    expect(
      (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, await token(), caido)).status,
    ).toBe(503);
  });

  it('❌ · sin el alcance de lectura, o para otra celda, no entra; con ks:agro-mcp apagado, 503', async () => {
    expect(
      (
        await rpc(
          { jsonrpc: '2.0', id: 1, method: 'tools/list' },
          await token({ scope: 'agro:otra:cosa' }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, await token({ celda: 'c9' })))
        .status,
    ).toBe(403);
    const apagado = env({ FLAGS: kvFalso({ 'ks:agro-mcp': 'apagado' }) });
    expect(
      (await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, await token(), apagado)).status,
    ).toBe(503);
  });

  it('en su dominio propio solo responde lo del MCP; en staging, la celda sigue entera', () => {
    expect(soloLoDelMcp('https://mcp.cultivopro.co', 'https://mcp.cultivopro.co/mcp')).toBe(true);
    expect(
      soloLoDelMcp('https://mcp.cultivopro.co', 'https://mcp.cultivopro.co/api/v1/sync/pull'),
    ).toBe(false);
    expect(
      soloLoDelMcp(
        'https://mcp.cultivopro.co',
        'https://agro-api-c0.example.workers.dev/api/salud',
      ),
    ).toBe(true);
    expect(soloLoDelMcp(RECURSO, `${RECURSO}/api/salud`)).toBe(true);
  });
});
