/**
 * HU-T15.7: el MCP del comercio. Contra el shard local con Comercio Ensayo Uno, por la ruta de la API
 * como llega desde el panel (sin tienda resuelta), con tokens de agente firmados de verdad. El CORE
 * es un service binding falso que dice si la concesión sigue viva. Lo que no ve (P17): la pantalla
 * de consentimiento del CORE con un cliente MCP real (WI-T15.7.3, del dueño).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import {
  type Firmante,
  firmanteDesde,
  firmarAccesoDeAgente,
  generarClavePrivada,
} from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ALCANCES_DEL_COMERCIO } from './mcp-comercio.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-21T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const RECURSO = 'https://mcp.tiendapro.co';
const M = 'v-camisa-m-arena';
const TODOS = Object.values(ALCANCES_DEL_COMERCIO).join(' ');

let shard: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

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
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});
beforeEach(async () => {
  await shard.prepare("UPDATE tienda SET plan = 'ia-pro' WHERE org_id = ?").bind(UNO).run();
});

const token = async (extra: { scope?: string; aud?: string; cnc?: string } = {}) =>
  (
    await firmarAccesoDeAgente(
      firmante,
      {
        sub: '0199e0a0-0000-7000-8000-0000000000aa',
        aud: extra.aud ?? RECURSO,
        azp: 'https://cliente.example/mcp.json',
        cnc: extra.cnc ?? 'cnc-viva',
        org: UNO,
        celda: 'c1',
        shard: 'tienda_c1_s1',
        scope: extra.scope ?? TODOS,
      },
      Date.parse(AHORA),
    )
  ).token;
const env = (): Env => ({
  CELDA: 'c1',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  RECURSO_MCP_COMERCIO: RECURSO,
  EMISOR_OAUTH: 'https://cuenta.laboratorio-digital.com',
  CORE: { concesionVigente: async (id: string) => id === 'cnc-viva' },
  tienda_c1_s1: shard,
});
let n = 0;
const mcp = async (method: string, params?: unknown, autorizacion?: string | null) => {
  const r = await crearApp({ ahora: () => Date.parse(AHORA) }).request(
    `${RECURSO}/mcp`,
    {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: ++n, method, ...(params ? { params } : {}) }),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        'content-type': 'application/json',
        ...(autorizacion === null
          ? {}
          : { authorization: `Bearer ${autorizacion ?? (await token())}` }),
      },
    },
    env(),
  );
  return {
    status: r.status,
    cabeceras: r.headers,
    // biome-ignore lint/suspicious/noExplicitAny: las respuestas JSON-RPC se leen campo a campo.
    cuerpo: (await r.json().catch(() => null)) as any,
  };
};
const herramienta = (name: string, args: unknown, autorizacion?: string) =>
  mcp('tools/call', { name, arguments: args }, autorizacion);

/** Un pedido por WhatsApp pendiente, con su aceptación: el que el comercio confirma. */
async function pedidoPendiente(numero: number, canal: 'whatsapp' | 'agente' = 'whatsapp') {
  const id = `ped-mcp-${numero}`;
  await shard.batch([
    shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, terminos_huella,
           aceptado, cambiado_por, creado, actualizado) VALUES (?, ?, ?, ?, 'pendiente', ?, 'transferencia', 129000, 129000, ?, ?, 'comprador', ?, ?)`,
      )
      .bind(
        UNO,
        id,
        `M${String(numero).padStart(5, '0')}`,
        numero,
        canal,
        canal === 'agente' ? null : 'e'.repeat(64),
        canal === 'agente' ? null : AHORA,
        AHORA,
        AHORA,
      ),
    shard
      .prepare(
        `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones, precio_unitario_cop, cantidad, total_cop)
         VALUES (?, ?, 1, 'p-camisa', ?, 'Camisa de lino', 'Talla: M · Color: Arena', 129000, 1, 129000)`,
      )
      .bind(UNO, id, M),
  ]);
  return id;
}

describe('el MCP del comercio (HU-T15.7)', () => {
  it('❌ sin token: 401 con los metadatos del recurso (RFC 9728), que se publican', async () => {
    const r = await mcp('initialize', undefined, null);
    expect(r.status).toBe(401);
    expect(r.cabeceras.get('www-authenticate')).toBe(
      `Bearer resource_metadata="${RECURSO}/.well-known/oauth-protected-resource"`,
    );
    const meta = await crearApp().request(
      `${RECURSO}/.well-known/oauth-protected-resource`,
      { headers: { [CABECERA_DESPACHO]: SECRETO } },
      env(),
    );
    expect(await meta.json()).toMatchObject({
      resource: RECURSO,
      authorization_servers: ['https://cuenta.laboratorio-digital.com'],
      scopes_supported: Object.values(ALCANCES_DEL_COMERCIO),
    });
  });

  it('❌ CA2: un token de otro recurso o de una concesión revocada se rechaza', async () => {
    const otro = await mcp(
      'tools/list',
      undefined,
      await token({ aud: 'https://mcp.cultivopro.co' }),
    );
    expect(otro.status).toBe(401);
    expect(otro.cuerpo.error_description).toBe('El token es para otro recurso');
    const revocada = await mcp('tools/list', undefined, await token({ cnc: 'cnc-revocada' }));
    expect(revocada.status).toBe(401);
    expect(revocada.cuerpo.error_description).toBe('Quitaron este acceso.');
  });

  it('❌ CA2: solo en el plan IA Pro (HU-T18.3)', async () => {
    await shard.prepare("UPDATE tienda SET plan = 'pro' WHERE org_id = ?").bind(UNO).run();
    const r = await mcp('tools/list');
    expect(r.status).toBe(403);
    expect(r.cuerpo.error_description).toBe('El asistente de tu tienda es del plan IA Pro.');
  });

  it('CA1: lista solo las herramientas de los permisos que el comerciante concedió', async () => {
    const r = await mcp(
      'tools/list',
      undefined,
      await token({ scope: ALCANCES_DEL_COMERCIO.pedidosLeer }),
    );
    expect(r.cuerpo.result.tools.map((t: { name: string }) => t.name)).toEqual([
      'pedidos',
      'ver_pedido',
    ]);
    const sinPermiso = await herramienta(
      'ajustar_inventario',
      { variante: M, version: 1, cantidad: 1 },
      await token({ scope: ALCANCES_DEL_COMERCIO.pedidosLeer }),
    );
    expect(sinPermiso.cuerpo.error.code).toBe(-32001);
  });

  it('confirma un pedido con las reglas del panel, a nombre del agente, y lo dice por despachar', async () => {
    const id = await pedidoPendiente(7001);
    const ver = await herramienta('ver_pedido', { numero: 7001 });
    expect(ver.cuerpo.result.structuredContent).toMatchObject({
      numero: 7001,
      estado: 'pendiente',
      version: 1,
    });
    // CA2: ningún dato del comprador.
    expect(JSON.stringify(ver.cuerpo.result)).not.toMatch(/celular|correo|direccion/);
    const r = await herramienta('cambiar_estado_del_pedido', {
      numero: 7001,
      version: 1,
      a: 'confirmado',
    });
    expect(r.cuerpo.result.isError).toBeUndefined();
    const fila = await shard
      .prepare('SELECT estado, cambiado_por FROM pedido WHERE org_id = ? AND id = ?')
      .bind(UNO, id)
      .first();
    expect(fila).toEqual({ estado: 'confirmado', cambiado_por: 'agente:cnc-viva' });
    const lista = await herramienta('pedidos', {});
    expect(
      lista.cuerpo.result.structuredContent.pedidos.map((p: { numero: number }) => p.numero),
    ).toContain(7001);
    // ❌ Con una versión vieja no se toca.
    const vieja = await herramienta('cambiar_estado_del_pedido', {
      numero: 7001,
      version: 1,
      a: 'despachado',
      transportadora: 'Servientrega',
      guia: 'G-1',
    });
    expect(vieja.cuerpo.result.isError).toBe(true);
  });

  it('❌ lo que preparó el asistente de un cliente espera a que el cliente lo confirme', async () => {
    await pedidoPendiente(7002, 'agente');
    const r = await herramienta('cambiar_estado_del_pedido', {
      numero: 7002,
      version: 1,
      a: 'confirmado',
    });
    expect(r.cuerpo.result.isError).toBe(true);
    expect(r.cuerpo.result.content[0].text).toContain('espera que tu cliente lo confirme');
  });

  it('el inventario y su ajuste, con la versión', async () => {
    const inv = await herramienta('inventario', { buscar: 'camisa' });
    const fila = inv.cuerpo.result.structuredContent.combinaciones.find(
      (f: { variante: string }) => f.variante === M,
    ) as { stock: number; version: number };
    const r = await herramienta('ajustar_inventario', {
      variante: M,
      version: fila.version,
      cantidad: 3,
    });
    expect(r.cuerpo.result.isError).toBeUndefined();
    const despues = await shard
      .prepare('SELECT stock FROM variante WHERE org_id = ? AND id = ?')
      .bind(UNO, M)
      .first<{ stock: number }>();
    expect(despues?.stock).toBe(fila.stock + 3);
  });

  it('❌ ninguna herramienta cobra, reembolsa ni cancela', async () => {
    const r = await mcp('tools/list');
    const nombres = r.cuerpo.result.tools.map((t: { name: string }) => t.name).join(' ');
    expect(nombres).not.toMatch(/cobr|pag|reembols|cancel|llave/);
    const malo = await herramienta('cambiar_estado_del_pedido', {
      numero: 7001,
      version: 2,
      a: 'cancelado',
    });
    expect(malo.cuerpo.error.code).toBe(-32602);
  });
});
