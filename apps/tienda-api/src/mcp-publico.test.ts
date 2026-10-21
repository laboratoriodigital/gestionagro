/**
 * HU-T15.4: el MCP público de la tienda. Contra el shard local con los comercios de prueba, por la
 * ruta de la API, como llega desde el despacho: buscar y ver leen lo horneado (CA1), preparar deja
 * un pedido sin datos ni aceptación con su enlace (CA2), y los topes y kill switches (CA3).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PENDIENTES_DE_AGENTE_POR_TIENDA } from './mcp-publico.ts';
import {
  CABECERA_DESPACHO,
  CABECERA_TIENDA,
  crearApp,
  type Env,
  type Limitador,
} from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const HOST = 'ensayo-uno--staging.laboratorio-digital.app';
const M = 'v-camisa-m-arena';
const S = 'v-camisa-s-arena';

let shard: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const ajuste = (seccion: string, datos: unknown) =>
  shard
    .prepare(
      `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, ?, 1, ?, ?, 'sistema')
       ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos`,
    )
    .bind(UNO, seccion, JSON.stringify(datos), AHORA)
    .run();

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  shard = s.db;
  cerrar.push(s.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  await shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO).run();
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});
beforeEach(async () => {
  await ajuste('agentes', { mcp: true });
  await shard.prepare('DELETE FROM pedido_linea WHERE org_id = ?').bind(UNO).run();
  await shard.prepare('DELETE FROM pedido_evento WHERE org_id = ?').bind(UNO).run();
  await shard.prepare('DELETE FROM pedido WHERE org_id = ?').bind(UNO).run();
});

/** Lo horneado de la versión 1: el catálogo y la ficha de la camisa. */
const CATALOGO = JSON.stringify({
  tienda: { nombre: 'Comercio Ensayo Uno', url: `https://${HOST}/` },
  colecciones: [{ slug: 'lino', nombre: 'Lino', productos: ['camisa-de-lino'] }],
  productos: [
    {
      slug: 'camisa-de-lino',
      nombre: 'Camisa de lino',
      url: `https://${HOST}/p/camisa-de-lino/`,
      variantes: [
        { id: S, opciones: 'S|Arena', precioCop: 129000, disponible: true },
        { id: M, opciones: 'M|Arena', precioCop: 129000, disponible: true },
      ],
    },
  ],
});
const FICHA =
  '# Camisa de lino\n\n## Antes de comprar\n\n- Tienes 5 días hábiles para retractarte.\n';
const objetos = new Map<string, string>([
  [
    `sitios/${UNO}/1/manifiesto.json`,
    JSON.stringify({
      archivos: {
        '/catalogo.json': { huella: `aa${'1'.repeat(62)}` },
        '/p/camisa-de-lino/index.md': { huella: `bb${'2'.repeat(62)}` },
        '/.well-known/mcp/server-card.json': { huella: `cc${'3'.repeat(62)}` },
        '/pedido/confirmar/index.html': { huella: `dd${'4'.repeat(62)}` },
      },
    }),
  ],
  [`objetos/aa/aa${'1'.repeat(62)}`, CATALOGO],
  [`objetos/bb/bb${'2'.repeat(62)}`, FICHA],
]);
const sitios = {
  put: async () => undefined,
  get: async (clave: string) => {
    const t = objetos.get(clave);
    return t === undefined ? null : { text: async () => t };
  },
};
const libre: Limitador = { limit: async () => ({ success: true }) };
const env = (extra: Record<string, unknown> = {}): Env => ({
  CELDA: 'c1',
  SECRETO_DESPACHO: SECRETO,
  tienda_c1_s1: shard,
  SITIOS: sitios,
  LIMITE_MCP: libre,
  LIMITE_MCP_PEDIDOS: libre,
  ...extra,
});
let n = 0;
const mcp = async (method: string, params?: unknown, e: Env = env()) => {
  const r = await crearApp({ ahora: () => Date.parse(AHORA) }).request(
    `https://${HOST}/mcp`,
    {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, ...(params ? { params } : {}) }),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    e,
  );
  // biome-ignore lint/suspicious/noExplicitAny: las respuestas JSON-RPC se leen campo a campo.
  return { status: r.status, cuerpo: (await r.json().catch(() => null)) as any };
};
const herramienta = (name: string, args: unknown, e?: Env) =>
  mcp('tools/call', { name, arguments: args }, e);

describe('el MCP público de la tienda (HU-T15.4)', () => {
  it('❌ sin encenderlo en Ajustes › Agentes no existe', async () => {
    await ajuste('agentes', { mcp: false });
    expect((await mcp('initialize')).status).toBe(404);
  });

  it('❌ bitácora tienda3 50: encendido pero sin publicar con el MCP, tampoco: su enlace no existiría', async () => {
    const viejo = objetos.get(`sitios/${UNO}/1/manifiesto.json`) ?? '';
    const m = JSON.parse(viejo) as { archivos: Record<string, unknown> };
    delete m.archivos['/pedido/confirmar/index.html'];
    objetos.set(`sitios/${UNO}/1/manifiesto.json`, JSON.stringify(m));
    await shard.prepare('UPDATE tienda SET version_publicada = 2 WHERE org_id = ?').bind(UNO).run();
    objetos.set(`sitios/${UNO}/2/manifiesto.json`, JSON.stringify(m));
    const r = await mcp('initialize');
    expect(r.status).toBe(404);
    expect(r.cuerpo).toMatchObject({ estado: 'sin-publicar' });
    await shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO).run();
    objetos.set(`sitios/${UNO}/1/manifiesto.json`, viejo);
  });

  it('se presenta con las instrucciones: la persona acepta y paga; y lista sus cinco herramientas', async () => {
    const ini = await mcp('initialize', { protocolVersion: '2025-06-18' });
    expect(ini.cuerpo.result.protocolVersion).toBe('2025-06-18');
    expect(ini.cuerpo.result.serverInfo.title).toBe('Comercio Ensayo Uno');
    expect(ini.cuerpo.result.instructions).toContain('los hace siempre la persona');
    const lista = await mcp('tools/list');
    const tools = lista.cuerpo.result.tools as {
      name: string;
      annotations: { readOnlyHint: boolean };
      inputSchema: { type: string };
    }[];
    expect(tools.map((t) => t.name)).toEqual([
      'buscar_productos',
      'ver_producto',
      'consultar_disponibilidad',
      'preparar_pedido',
      'seguimiento_de_pedido',
    ]);
    expect(tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name)).toEqual([
      'preparar_pedido',
    ]);
    expect(tools.every((t) => t.inputSchema.type === 'object')).toBe(true);
  });

  it('buscar y ver leen lo horneado, sin tildes, por categoría y con sus combinaciones (CA1)', async () => {
    const b = await herramienta('buscar_productos', { consulta: 'CAMISA', coleccion: 'lino' });
    expect(b.cuerpo.result.structuredContent.productos).toEqual([
      {
        producto: 'camisa-de-lino',
        nombre: 'Camisa de lino',
        url: `https://${HOST}/p/camisa-de-lino/`,
        precioDesde: 129000,
        disponible: true,
      },
    ]);
    const v = await herramienta('ver_producto', { producto: 'camisa-de-lino' });
    expect(v.cuerpo.result.content[0].text).toContain('Tienes 5 días hábiles para retractarte.');
    expect(v.cuerpo.result.content[0].text).toContain(`- ${M} (M · Arena): $129.000`);
    const nada = await herramienta('buscar_productos', { coleccion: 'verano' });
    expect(nada.cuerpo.result.isError).toBe(true);
  });

  it('consultar la disponibilidad es cotizar: el total y lo que corrigió', async () => {
    const r = await herramienta('consultar_disponibilidad', {
      items: [{ variante: S, cantidad: 3 }],
    });
    expect(r.cuerpo.result.structuredContent).toMatchObject({
      total: 129000,
      carrito: [{ variante: S, cantidad: 1 }],
    });
    expect(r.cuerpo.result.structuredContent.avisos).toEqual([
      `De la combinación ${S} solo hay 1.`,
    ]);
  });

  it('preparar deja un pedido pendiente de agente, sin datos ni aceptación, con su enlace (CA2)', async () => {
    const r = await herramienta('preparar_pedido', {
      items: [{ variante: M, cantidad: 2 }],
      ciudad: 'Envigado',
    });
    const d = r.cuerpo.result.structuredContent;
    expect(d).toMatchObject({ preparado: true, numero: 1001, total: 258000 });
    expect(d.enlace).toMatch(
      new RegExp(`^https://${HOST}/pedido/confirmar/#c=[0-9A-HJKMNP-TV-Z]{6}&s=[A-Za-z0-9_-]{22}$`),
    );
    const fila = await shard
      .prepare(
        'SELECT estado, canal, forma_pago, aceptado, terminos_huella, cambiado_por, ciudad FROM pedido WHERE org_id = ? AND codigo = ?',
      )
      .bind(UNO, d.codigo)
      .first();
    expect(fila).toEqual({
      estado: 'pendiente',
      canal: 'agente',
      forma_pago: 'a_convenir',
      aceptado: null,
      terminos_huella: null,
      cambiado_por: 'agente:mcp',
      ciudad: 'Envigado',
    });
    // CA3: no aparta unidades.
    const v = await shard
      .prepare('SELECT reservado FROM variante WHERE org_id = ? AND id = ?')
      .bind(UNO, M)
      .first<{ reservado: number }>();
    expect(v?.reservado).toBe(0);
    // Con el código y el secreto del enlace, el asistente lo sigue.
    const [, codigo, secreto] = /#c=(\w+)&s=([\w-]+)$/.exec(d.enlace) ?? [];
    const s = await herramienta('seguimiento_de_pedido', { codigo, secreto });
    expect(s.cuerpo.result.structuredContent).toMatchObject({ estado: 'pendiente', total: 258000 });
  });

  it('❌ si la tienda corrige el pedido, no se prepara y el agente ve lo corregido', async () => {
    const r = await herramienta('preparar_pedido', { items: [{ variante: S, cantidad: 3 }] });
    expect(r.cuerpo.result.isError).toBe(true);
    expect(r.cuerpo.result.structuredContent).toMatchObject({
      preparado: false,
      carrito: [{ variante: S, cantidad: 1 }],
    });
    const nada = await shard
      .prepare('SELECT count(*) AS n FROM pedido WHERE org_id = ?')
      .bind(UNO)
      .first<{ n: number }>();
    expect(nada?.n).toBe(0);
  });

  it(`❌ con ${PENDIENTES_DE_AGENTE_POR_TIENDA} pendientes de agente no se prepara otro (CA3)`, async () => {
    await shard.batch(
      Array.from({ length: PENDIENTES_DE_AGENTE_POR_TIENDA }, (_, i) =>
        shard
          .prepare(
            `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, subtotal_cop, total_cop, cambiado_por, creado, actualizado)
             VALUES (?, ?, ?, ?, 'pendiente', 'agente', 1000, 1000, 'agente:mcp', ?, ?)`,
          )
          .bind(UNO, `tope-${i}`, `T${String(i).padStart(5, '0')}`, 5000 + i, AHORA, AHORA),
      ),
    );
    const r = await herramienta('preparar_pedido', { items: [{ variante: M, cantidad: 1 }] });
    expect(r.cuerpo.result.isError).toBe(true);
    expect(r.cuerpo.result.content[0].text).toContain('muchos pedidos preparados sin confirmar');
    const total = await shard
      .prepare('SELECT count(*) AS n FROM pedido WHERE org_id = ?')
      .bind(UNO)
      .first<{ n: number }>();
    expect(total?.n).toBe(PENDIENTES_DE_AGENTE_POR_TIENDA);
  });

  it('❌ los límites por IP: los mensajes y, aparte, preparar', async () => {
    const lleno: Limitador = { limit: async () => ({ success: false }) };
    expect((await mcp('tools/list', undefined, env({ LIMITE_MCP: lleno }))).status).toBe(429);
    const r = await herramienta(
      'preparar_pedido',
      { items: [{ variante: M, cantidad: 1 }] },
      env({ LIMITE_MCP_PEDIDOS: lleno }),
    );
    expect(r.cuerpo.result.isError).toBe(true);
    expect(
      (await herramienta('buscar_productos', {}, env({ LIMITE_MCP_PEDIDOS: lleno }))).cuerpo.result
        .isError,
    ).toBeUndefined();
  });

  it('❌ ks:tienda-mcp lo apaga; con ks:tienda apagado se lee pero no se prepara', async () => {
    const mcpApagado = { get: async (k: string) => (k === 'ks:tienda-mcp' ? 'apagado' : null) };
    expect((await mcp('tools/list', undefined, env({ FLAGS: mcpApagado }))).status).toBe(503);
    const tiendaApagada = { get: async (k: string) => (k === 'ks:tienda' ? 'apagado' : null) };
    const e = env({ FLAGS: tiendaApagada });
    expect((await herramienta('buscar_productos', {}, e)).cuerpo.result.isError).toBeUndefined();
    const p = await herramienta('preparar_pedido', { items: [{ variante: M, cantidad: 1 }] }, e);
    expect(p.cuerpo.result.content[0].text).toContain('en pausa');
  });

  it('❌ argumentos que no cumplen el esquema, una herramienta que no existe y JSON-RPC mal formado', async () => {
    const malo = await herramienta('ver_producto', {});
    expect(malo.cuerpo.error.code).toBe(-32602);
    expect((await herramienta('pagar', {})).cuerpo.error.code).toBe(-32602);
    const r = await crearApp({ ahora: () => Date.parse(AHORA) }).request(
      `https://${HOST}/mcp`,
      {
        method: 'POST',
        body: '{"id":1}',
        headers: {
          [CABECERA_DESPACHO]: SECRETO,
          [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        },
      },
      env(),
    );
    expect(r.status).toBe(400);
  });
});
