/**
 * HU-T5.5: cotizar recalcula en el servidor. Contra el shard local con los dos comercios de prueba:
 * los precios y las existencias salen de la base, lo que no se vende sale diciéndolo, el cupón y el
 * envío se buscan, y un total distinto del que se vio nunca sigue en silencio (CA3). Por la ruta:
 * el límite por IP, lo que no se puede leer y la tienda que resolvió el despacho.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cotizar } from './cotizar.ts';
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
  await shard.batch([
    shard
      .prepare(
        "INSERT INTO cupon (org_id, codigo, tipo, valor, minimo_cop) VALUES (?, 'LINO10', 'porcentaje', 10, 100000)",
      )
      .bind(UNO),
    shard
      .prepare(
        "INSERT INTO cupon (org_id, codigo, tipo, valor, hasta) VALUES (?, 'VENCIDO', 'valor', 5000, '2026-01-01T00:00:00.000Z')",
      )
      .bind(UNO),
    shard
      .prepare(
        "INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, gratis_desde_cop) VALUES (?, 'e-med', 'Medellín', 8000, 300000)",
      )
      .bind(UNO),
  ]);
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const M = 'v-camisa-m-arena'; // 129.000, 4 en inventario
const S = 'v-camisa-s-arena'; // 129.000, 1 en inventario
const L = 'v-camisa-l-azul'; // agotada

describe('cotizar (HU-T5.5)', () => {
  it('calcula con los precios de la base, con @ed1/dinero', async () => {
    const r = await cotizar(
      shard,
      UNO,
      { lineas: [{ variante: M, cantidad: 2 }], totalVisto: 258000 },
      AHORA,
    );
    expect(r).toEqual({
      subtotal: 258000,
      descuento: 0,
      envio: 0,
      total: 258000,
      avisos: [],
      cobrable: true,
      carrito: [{ variante: M, cantidad: 2 }],
      cambio: false,
    });
  });

  it('❌ un total visto distinto del calculado lo marca y lo dice: nunca sigue en silencio (CA3)', async () => {
    const r = await cotizar(
      shard,
      UNO,
      { lineas: [{ variante: M, cantidad: 1 }], totalVisto: 99000 },
      AHORA,
    );
    expect(r.total).toBe(129000);
    expect(r.cambio).toBe(true);
    expect(r.avisos).toEqual([{ codigo: 'total_cambio', totalVisto: 99000 }]);
  });

  it('❌ lo agotado, lo que no existe y lo de otra tienda salen; lo que no alcanza se baja', async () => {
    const r = await cotizar(
      shard,
      UNO,
      {
        lineas: [
          { variante: S, cantidad: 3 },
          { variante: L, cantidad: 1 },
          { variante: 'no-existe', cantidad: 1 },
          { variante: 'v-pan-de-bono', cantidad: 1 },
        ],
      },
      AHORA,
    );
    expect(r.carrito).toEqual([{ variante: S, cantidad: 1 }]);
    expect(r.avisos).toEqual([
      { codigo: 'cantidad_ajustada', variante: S, cantidad: 1 },
      { codigo: 'linea_quitada', variante: L },
      { codigo: 'linea_quitada', variante: 'no-existe' },
      { codigo: 'linea_quitada', variante: 'v-pan-de-bono' },
    ]);
    expect(r.total).toBe(129000);
  });

  it('las líneas repetidas de una variante se suman', async () => {
    const r = await cotizar(
      shard,
      UNO,
      {
        lineas: [
          { variante: M, cantidad: 1 },
          { variante: M, cantidad: 2 },
        ],
      },
      AHORA,
    );
    expect(r.carrito).toEqual([{ variante: M, cantidad: 3 }]);
  });

  it('el cupón y el envío se buscan en la base (la tabla de dinero por la API, WI-T5.5.2)', async () => {
    const casos: [Parameters<typeof cotizar>[2], Partial<Awaited<ReturnType<typeof cotizar>>>][] = [
      // 10 % de 129.000 = 12.900; envío de 8.000 porque 116.100 no llega a 300.000.
      [
        { lineas: [{ variante: M, cantidad: 1 }], cupon: 'lino10', envio: 'e-med' },
        { subtotal: 129000, descuento: 12900, envio: 8000, total: 124100 },
      ],
      // Sin envío pedido: solo el cupón.
      [
        { lineas: [{ variante: M, cantidad: 1 }], cupon: 'LINO10' },
        { descuento: 12900, envio: 0, total: 116100 },
      ],
      // Con 3, el envío es gratis: 387.000 − 38.700 = 348.300 ≥ 300.000.
      [
        { lineas: [{ variante: M, cantidad: 3 }], cupon: 'LINO10', envio: 'e-med' },
        { subtotal: 387000, descuento: 38700, envio: 0, total: 348300 },
      ],
    ];
    for (const [peticion, esperado] of casos) {
      expect(await cotizar(shard, UNO, peticion, AHORA)).toMatchObject(esperado);
    }
  });

  it('❌ un cupón vencido o inexistente, o un envío que no es de la tienda, se dicen', async () => {
    const r = await cotizar(
      shard,
      UNO,
      { lineas: [{ variante: M, cantidad: 1 }], cupon: 'VENCIDO', envio: 'otro' },
      AHORA,
    );
    expect(r.avisos).toEqual([{ codigo: 'cupon_invalido' }, { codigo: 'envio_invalido' }]);
    expect(r.total).toBe(129000);
  });
});

/** Un limitador de mentira que deja pasar `cupo` solicitudes por clave. */
function limitador(cupo: number): Limitador & { claves: string[] } {
  const claves: string[] = [];
  return {
    claves,
    limit: async ({ key }) => {
      claves.push(key);
      return { success: claves.filter((k) => k === key).length <= cupo };
    },
  };
}

describe('POST /api/v1/cotizar', () => {
  const env = (extra: Record<string, unknown> = {}): Env => ({
    CELDA: 'c1',
    SECRETO_DESPACHO: SECRETO,
    tienda_c1_s1: shard,
    tienda_control: control,
    ...extra,
  });
  const pedir = (cuerpo: string, e: Env, tienda = { org: UNO, shard: 'tienda_c1_s1' }) =>
    crearApp().request(
      '/api/v1/cotizar',
      {
        method: 'POST',
        body: cuerpo,
        headers: {
          [CABECERA_DESPACHO]: SECRETO,
          [CABECERA_TIENDA]: JSON.stringify(tienda),
          'cf-connecting-ip': '203.0.113.7',
          'content-type': 'application/json',
        },
      },
      e,
    );
  const cuerpo = JSON.stringify({ lineas: [{ variante: M, cantidad: 1 }] });

  it('cotiza la tienda que resolvió el despacho', async () => {
    const r = await pedir(cuerpo, env({ LIMITE_COTIZAR: limitador(30) }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ total: 129000 });
  });

  it('❌ pasado el límite por IP: 429 con Retry-After (CA3)', async () => {
    const l = limitador(1);
    expect((await pedir(cuerpo, env({ LIMITE_COTIZAR: l }))).status).toBe(200);
    const r = await pedir(cuerpo, env({ LIMITE_COTIZAR: l }));
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('60');
    expect(l.claves).toEqual(['203.0.113.7', '203.0.113.7']);
  });

  it.each([
    ['un cuerpo que no es JSON', '{roto', 400],
    ['sin líneas', JSON.stringify({ lineas: [] }), 422],
    [
      '31 líneas',
      JSON.stringify({
        lineas: Array.from({ length: 31 }, (_, i) => ({ variante: `v${i}`, cantidad: 1 })),
      }),
      422,
    ],
    ['201 unidades', JSON.stringify({ lineas: [{ variante: M, cantidad: 201 }] }), 422],
    [
      'una cantidad con decimales',
      JSON.stringify({ lineas: [{ variante: M, cantidad: 1.5 }] }),
      422,
    ],
  ])('❌ %s no se cotiza', async (_caso, texto, estado) => {
    expect((await pedir(texto, env({ LIMITE_COTIZAR: limitador(30) }))).status).toBe(estado);
  });

  it('❌ sin la tienda del despacho, no existe', async () => {
    const r = await pedir(cuerpo, env(), { org: UNO, shard: 'tienda_c9_s1' });
    expect(r.status).toBe(404);
  });

  it('con ks:tienda apagado sigue cotizando: solo lee', async () => {
    const flags = { get: async (k: string) => (k === 'ks:tienda' ? 'apagado' : null) };
    const r = await pedir(cuerpo, env({ FLAGS: flags, LIMITE_COTIZAR: limitador(30) }));
    expect(r.status).toBe(200);
  });
});
