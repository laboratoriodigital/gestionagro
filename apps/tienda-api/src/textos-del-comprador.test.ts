/**
 * HU-P1.5 (sprint PF3): el texto del comprador, contra el shard local. Se valida contra lo que pide
 * el producto en la base; va en el WhatsApp del pedido, debajo de su línea, y cifrado en el sobre
 * de la entrega (CA3). Un producto que no lo pide no guarda ninguno. Ningún dato real.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirContactos } from './bandeja.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { textosDelPedido } from './textos-del-comprador.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'a'.repeat(64);
const HOST = 'ensayo-uno--staging.mitiendapro.co';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 7)).toString('base64');
const M = 'v-camisa-m-arena';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  const c = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  shard = s.db;
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  await shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO).run();
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const pide = (p: unknown) =>
  shard
    .prepare("UPDATE producto SET pide_texto = ? WHERE org_id = ? AND id = 'p-camisa'")
    .bind(p === null ? null : JSON.stringify(p), UNO)
    .run();

const sitios = {
  put: async () => undefined,
  get: async (clave: string) =>
    clave === `sitios/${UNO}/1/manifiesto.json`
      ? {
          text: async () =>
            JSON.stringify({ archivos: { '/legal/terminos/index.md': { huella: TERMINOS } } }),
        }
      : null,
};
const env = (): Env =>
  ({
    CELDA: 'c1',
    SECRETO_DESPACHO: SECRETO,
    tienda_c1_s1: shard,
    tienda_control: control,
    SITIOS: sitios,
    TIENDA_KEK_V1: KEK,
  }) as unknown as Env;
const pedir = (codigo: string, texto?: string) =>
  crearApp({ ahora: () => Date.parse(AHORA) }).request(
    `https://${HOST}/api/v1/pedidos`,
    {
      method: 'POST',
      body: JSON.stringify({
        codigo,
        lineas: [{ variante: M, cantidad: 1, ...(texto === undefined ? {} : { texto }) }],
        forma: 'transferencia',
        acepta: true,
        terminos: TERMINOS,
        seguimiento: 'abcdefghijklmnopqrstuv',
        totalVisto: 129000,
      }),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    env(),
  );

describe('HU-P1.5 · el texto del comprador', () => {
  it('se valida contra lo que pide el producto en la base', async () => {
    await pide(null);
    expect(await textosDelPedido(shard, UNO, [{ variante: M, texto: 'Ana' }])).toEqual({
      ok: true,
      textos: [],
    });
    await pide({ etiqueta: 'Nombre para bordar', largo: 10, obligatorio: true });
    expect(await textosDelPedido(shard, UNO, [{ variante: M }])).toMatchObject({
      ok: false,
      motivo: 'Falta «Nombre para bordar» de Camisa de lino. Escríbelo en su página.',
    });
    expect(
      await textosDelPedido(shard, UNO, [{ variante: M, texto: 'Ana María López' }]),
    ).toMatchObject({
      ok: false,
    });
    expect(await textosDelPedido(shard, UNO, [{ variante: M, texto: '  Ana  ' }])).toEqual({
      ok: true,
      textos: [{ variante: M, nombre: 'Camisa de lino', texto: 'Ana' }],
    });
  });

  it('❌ sin el texto obligatorio no hay pedido', async () => {
    await pide({ etiqueta: 'Nombre para bordar', largo: 20, obligatorio: true });
    const r = await pedir('TXT001');
    expect(r.status).toBe(422);
    expect(((await r.json()) as { estado: string }).estado).toBe('texto');
  });

  it('va en el WhatsApp, debajo de su línea, y cifrado en el sobre de la entrega', async () => {
    await pide({ etiqueta: 'Nombre para bordar', largo: 20, obligatorio: true });
    const r = await pedir('TXT002', '<b>Ana</b>');
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as { texto: string };
    expect(cuerpo.texto).toContain('Camisa de lino');
    expect(cuerpo.texto).toContain('  Texto: «<b>Ana</b>»');
    const p = await shard
      .prepare('SELECT id FROM pedido WHERE org_id = ? AND codigo = ?')
      .bind(UNO, 'TXT002')
      .first<{ id: string }>();
    if (!p) throw new Error('no se escribió el pedido');
    const fila = await shard
      .prepare('SELECT sobre FROM pedido_contacto WHERE org_id = ? AND pedido_id = ?')
      .bind(UNO, p.id)
      .first<{ sobre: ArrayBuffer }>();
    expect(
      Buffer.from(new Uint8Array(fila?.sobre ?? new ArrayBuffer(0))).toString('latin1'),
    ).not.toContain('Ana');
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    const abiertos = await abrirContactos(
      { db: shard, org: UNO, actor: 'usuario:prueba', instante: AHORA },
      kek,
      [p.id],
    );
    expect(abiertos.get(p.id)).toEqual({
      textos: [{ nombre: 'Camisa de lino', texto: '<b>Ana</b>' }],
    });
    // El reenvío del mismo pedido trae el mismo texto.
    const otra = (await (await pedir('TXT002', '<b>Ana</b>')).json()) as {
      estado: string;
      texto: string;
    };
    expect(otra.estado).toBe('duplicado');
    expect(otra.texto).toContain('  Texto: «<b>Ana</b>»');
    await pide(null);
  });
});
