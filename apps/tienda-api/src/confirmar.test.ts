/**
 * HU-T15.5: la persona confirma el pedido que preparó su asistente. Contra el shard local con
 * Comercio Ensayo Uno, por la ruta de la API: el asistente lo prepara con el MCP y la persona lo
 * confirma por WhatsApp o pagando en línea (CA1); a las 48 horas sin confirmar se cancela (CA2); sin
 * la aceptación no sale de pendiente (CA3).
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cancelarPreparadosVencidos } from './confirmar.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import {
  CABECERA_DESPACHO,
  CABECERA_TIENDA,
  crearApp,
  type Env,
  type Limitador,
} from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-21T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'c'.repeat(64);
const HOST = 'ensayo-uno--staging.laboratorio-digital.app';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 21)).toString('base64');
const M = 'v-camisa-m-arena';

let shard: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const ajuste = (seccion: string, datos: unknown) =>
  shard
    .prepare(
      `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, ?, 1, ?, ?, 'sistema')
       ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos`,
    )
    .bind(UNO, seccion, JSON.stringify(datos), AHORA);

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
  const venta = ENSAYO_UNO.ajustes['venta'] as Record<string, unknown>;
  await shard.batch([
    shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO),
    ajuste('venta', { ...venta, modo: 'ambos' }),
    ajuste('agentes', { mcp: true }),
  ]);
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  const dek = await dekDeCredenciales(shard, UNO, kek, AHORA);
  for (const [campo, valor] of [
    ['identidad', 'identidad-de-prueba-0001'],
    ['secreta', 'secreta-de-prueba-0002'],
  ] as const) {
    await (
      await guardarCredencial(
        shard,
        dek,
        { org: UNO, proveedor: 'bold', ambiente: 'pruebas', campo, valor },
        AHORA,
      )
    ).run();
  }
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});
beforeEach(async () => {
  await shard
    .prepare(
      'UPDATE variante SET stock = 4, reservado = 0, precio_cop = 129000 WHERE org_id = ? AND id = ?',
    )
    .bind(UNO, M)
    .run();
});

const sitios = {
  put: async () => undefined,
  get: async (clave: string) =>
    clave === `sitios/${UNO}/1/manifiesto.json`
      ? {
          text: async () =>
            JSON.stringify({
              archivos: {
                '/legal/terminos/index.md': { huella: TERMINOS },
                // Bitácora tienda3 50: la versión publicada trae el MCP y la página de confirmar.
                '/.well-known/mcp/server-card.json': { huella: 'e'.repeat(64) },
                '/pedido/confirmar/index.html': { huella: 'f'.repeat(64) },
              },
            }),
        }
      : null,
};
const libre: Limitador = { limit: async () => ({ success: true }) };
const env = (extra: Record<string, unknown> = {}): Env => ({
  CELDA: 'c1',
  SECRETO_DESPACHO: SECRETO,
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  SITIOS: sitios,
  LIMITE_MCP: libre,
  LIMITE_MCP_PEDIDOS: libre,
  ...extra,
});
const post = (ruta: string, cuerpo: unknown, e: Env = env()) =>
  crearApp({ ahora: () => Date.parse(AHORA) }).request(
    `https://${HOST}${ruta}`,
    {
      method: 'POST',
      body: JSON.stringify(cuerpo),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    e,
  );

/** El asistente prepara 2 camisas con el MCP: el código y el secreto de su enlace. */
async function preparado(): Promise<{ codigo: string; secreto: string; total: number }> {
  const r = await post('/mcp', {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'preparar_pedido', arguments: { items: [{ variante: M, cantidad: 2 }] } },
  });
  const d = (
    (await r.json()) as { result: { structuredContent: { enlace: string; total: number } } }
  ).result.structuredContent;
  const [, codigo = '', secreto = ''] = /#c=(\w+)&s=([\w-]+)$/.exec(d.enlace) ?? [];
  return { codigo, secreto, total: d.total };
}
const confirmar = (
  p: { codigo: string; secreto: string; total: number },
  extra: Record<string, unknown> = {},
) =>
  post('/api/v1/pedidos/confirmar', {
    codigo: p.codigo,
    secreto: p.secreto,
    forma: 'transferencia',
    acepta: true,
    terminos: TERMINOS,
    totalVisto: p.total,
    ...extra,
  });
const fila = (codigo: string) =>
  shard
    .prepare(
      'SELECT id, estado, forma_pago, aceptado, terminos_huella, cambiado_por FROM pedido WHERE org_id = ? AND codigo = ?',
    )
    .bind(UNO, codigo)
    .first<{
      id: string;
      estado: string;
      forma_pago: string;
      aceptado: string | null;
      terminos_huella: string | null;
      cambiado_por: string;
    }>();

describe('confirmar lo que preparó un asistente (HU-T15.5)', () => {
  it('el seguimiento dice que espera a la persona, sin pedirle la edad si ningún producto la pide', async () => {
    const p = await preparado();
    const r = await post('/api/v1/seguimiento', { codigo: p.codigo, secreto: p.secreto });
    expect(await r.json()).toMatchObject({
      estado: 'pendiente',
      enPalabras: 'Preparado por tu asistente: falta que lo confirmes',
      porConfirmar: { edad: [] },
      total: 258000,
    });
  });

  it('por WhatsApp: queda pendiente con su aceptación y su forma, y trae el texto (CA1)', async () => {
    const p = await preparado();
    const r = await confirmar(p, { ciudad: 'Envigado' });
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as {
      estado: string;
      texto: string;
      enlace: string;
      whatsapp: string | null;
    };
    expect(cuerpo.estado).toBe('confirmado');
    expect(cuerpo.texto).toContain('Forma de pago: Transferencia');
    expect(cuerpo.texto).toContain(
      `Sigue tu pedido: https://${HOST}/pedido/#c=${p.codigo}&s=${p.secreto}`,
    );
    expect(await fila(p.codigo)).toMatchObject({
      estado: 'pendiente',
      forma_pago: 'transferencia',
      aceptado: AHORA,
      terminos_huella: TERMINOS,
      cambiado_por: 'comprador',
    });
    const id = (await fila(p.codigo))?.id;
    const evento = await shard
      .prepare(
        "SELECT actor, detalle FROM pedido_evento WHERE org_id = ? AND pedido_id = ? AND tipo = 'aceptacion'",
      )
      .bind(UNO, id)
      .first<{ actor: string; detalle: string }>();
    expect(evento).toEqual({
      actor: 'comprador',
      detalle: '{"forma":"transferencia","mayorDeEdad":[]}',
    });
    // Ya no espera: el seguimiento no lo ofrece otra vez, y confirmar de nuevo no hace nada.
    const s = (await (
      await post('/api/v1/seguimiento', { codigo: p.codigo, secreto: p.secreto })
    ).json()) as Record<string, unknown>;
    expect(s['porConfirmar']).toBeUndefined();
    const otra = await confirmar(p);
    expect(otra.status).toBe(409);
    expect(await otra.json()).toMatchObject({ estado: 'ya-confirmado' });
  });

  it('en línea: pasa a por pagar con su cobro y aparta lo que pidió, y solo entonces (CA1)', async () => {
    const p = await preparado();
    const antes = await shard
      .prepare('SELECT reservado FROM variante WHERE org_id = ? AND id = ?')
      .bind(UNO, M)
      .first<{ reservado: number }>();
    expect(antes?.reservado).toBe(0);
    const r = await confirmar(p, {
      forma: 'en_linea',
      token: 'tokentokentokentoken12',
      entrega: { nombre: 'Ana Pérez', celular: '3001234567' },
    });
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as {
      estado: string;
      boton: { checkout: Record<string, string> };
    };
    expect(cuerpo.estado).toBe('por-pagar');
    expect(cuerpo.boton.checkout['orderId']).toBe(`${p.codigo}-1`);
    expect(await fila(p.codigo)).toMatchObject({
      estado: 'por_pagar',
      forma_pago: 'en_linea',
      aceptado: AHORA,
    });
    const despues = await shard
      .prepare('SELECT reservado FROM variante WHERE org_id = ? AND id = ?')
      .bind(UNO, M)
      .first<{ reservado: number }>();
    expect(despues?.reservado).toBe(2);
  });

  it('❌ sin la casilla, con otros términos o con una forma que la tienda no ofrece, no se confirma', async () => {
    const p = await preparado();
    expect((await confirmar(p, { acepta: false })).status).toBe(422);
    const t = await confirmar(p, { terminos: 'd'.repeat(64) });
    expect(await t.json()).toEqual({ estado: 'terminos' });
    expect((await confirmar(p, { forma: 'efectivo' })).status).toBe(422);
    const sinEntrega = await confirmar(p, { forma: 'en_linea', token: 'tokentokentokentoken13' });
    expect(await sinEntrega.json()).toMatchObject({ estado: 'entrega' });
    expect((await fila(p.codigo))?.aceptado).toBeNull();
  });

  it('❌ si cambió el precio desde que se preparó, no se confirma y lo dice', async () => {
    const p = await preparado();
    await shard
      .prepare('UPDATE variante SET precio_cop = 139000 WHERE org_id = ? AND id = ?')
      .bind(UNO, M)
      .run();
    const r = await confirmar(p);
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ estado: 'cambio' });
    expect((await fila(p.codigo))?.estado).toBe('pendiente');
  });

  it('❌ otro secreto, o un pedido que no es de agente, responde lo mismo que nada', async () => {
    const p = await preparado();
    const r = await confirmar({ ...p, secreto: 'zzzzzzzzzzzzzzzzzzzzzz' });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ estado: 'no-encontrado' });
  });

  it('❌ CA3: sin la aceptación, la base no deja confirmarlo ni despacharlo; cancelarlo sí', async () => {
    const p = await preparado();
    const id = (await fila(p.codigo))?.id;
    await expect(
      shard
        .prepare(
          "UPDATE pedido SET estado = 'confirmado', cambiado_por = 'usuario:x' WHERE org_id = ? AND id = ?",
        )
        .bind(UNO, id)
        .run(),
    ).rejects.toThrow(/pedido-sin-aceptacion/);
    await shard
      .prepare(
        "UPDATE pedido SET estado = 'cancelado', cambiado_por = 'usuario:x' WHERE org_id = ? AND id = ?",
      )
      .bind(UNO, id)
      .run();
    expect((await fila(p.codigo))?.estado).toBe('cancelado');
  });

  it('CA2: a las 48 horas sin confirmar se cancela; lo confirmado o más nuevo, no', async () => {
    const viejo = await preparado();
    const confirmado = await preparado();
    await confirmar(confirmado);
    const nuevo = await preparado();
    await shard
      .prepare('UPDATE pedido SET creado = ? WHERE org_id = ? AND codigo IN (?, ?)')
      .bind('2026-10-19T14:00:00.000Z', UNO, viejo.codigo, confirmado.codigo)
      .run();
    const n = await cancelarPreparadosVencidos(shard, AHORA);
    expect(n).toBeGreaterThanOrEqual(1);
    expect((await fila(viejo.codigo))?.estado).toBe('cancelado');
    expect((await fila(viejo.codigo))?.cambiado_por).toBe('sistema');
    expect((await fila(confirmado.codigo))?.estado).toBe('pendiente');
    expect((await fila(nuevo.codigo))?.estado).toBe('pendiente');
    // Y ya cancelado, su enlace no deja confirmarlo.
    expect(await (await confirmar(viejo)).json()).toMatchObject({ estado: 'ya-confirmado' });
  });
});
