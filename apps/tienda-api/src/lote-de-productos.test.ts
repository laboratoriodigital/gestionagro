/**
 * HU-P3.1 (sprint PF1): cambiar varios productos a la vez. Contra el shard local con los dos
 * comercios de prueba: la vista previa no escribe, el precio sale con la misma cuenta de
 * `precioDelLote`, todo queda en el registro y nada toca a la otra tienda.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { precioDelLote } from '@ed1/tienda-schema';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cambiarEnLote } from './lote-de-productos.ts';

const AHORA = '2026-10-27T15:00:00.000Z';
const UNO = ENSAYO_UNO.org;
const DOS = ENSAYO_DOS.org;
let shard: BaseD1;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => cerrar?.());

const quien = (org = UNO) => ({ db: shard, org, actor: 'usuario:prueba', instante: AHORA });
let n = 0;
const op = () => `lote-prueba-${++n}-xxxx`;
const precios = async () =>
  (
    await shard
      .prepare(
        "SELECT id, precio_cop, precio_antes_cop FROM variante WHERE org_id = ? AND producto_id = 'p-camisa' AND activa = 1 ORDER BY id",
      )
      .bind(UNO)
      .all<{ id: string; precio_cop: number; precio_antes_cop: number | null }>()
  ).results;

describe('HU-P3.1 · cambiar varios productos a la vez', () => {
  it('la vista previa dice cuántos y un ejemplo, y no escribe nada', async () => {
    const antes = await precios();
    const r = await cambiarEnLote(quien(), {
      op: op(),
      ids: ['p-camisa'],
      cambio: { tipo: 'precio', modo: 'porcentaje', cantidad: 5 },
      vistaPrevia: true,
    });
    expect(r).toMatchObject({ estado: 'vista-previa', productos: 1, nombres: ['Camisa de lino'] });
    if (r.estado !== 'vista-previa' || !r.ejemplo) throw new Error('sin ejemplo');
    expect(r.ejemplo.despues).toBe(precioDelLote(r.ejemplo.antes, 'porcentaje', 5));
    expect(await precios()).toEqual(antes);
  });

  it('sube el 5 % con la misma cuenta de precioDelLote, en un lote, y queda en el registro', async () => {
    const antes = await precios();
    const r = await cambiarEnLote(quien(), {
      op: op(),
      ids: ['p-camisa'],
      cambio: { tipo: 'precio', modo: 'porcentaje', cantidad: 5 },
    });
    expect(r).toMatchObject({ estado: 'guardado', productos: 1 });
    const despues = await precios();
    expect(despues.map((v) => v.precio_cop)).toEqual(
      antes.map((v) => precioDelLote(v.precio_cop, 'porcentaje', 5)),
    );
    const registro = await shard
      .prepare(
        "SELECT despues FROM registro WHERE org_id = ? AND accion = 'productos.lote' ORDER BY rowid DESC LIMIT 1",
      )
      .bind(UNO)
      .first<{ despues: string }>();
    expect(JSON.parse(registro?.despues ?? '{}')).toMatchObject({
      cambio: 'subir el precio 5 %',
      productos: 1,
    });
  });

  it('❌ bajar más que el «antes» lo quita, nunca deja un precio en 0, y la misma op no se aplica dos veces', async () => {
    await shard
      .prepare(
        "UPDATE variante SET precio_antes_cop = precio_cop + 1000 WHERE org_id = ? AND producto_id = 'p-camisa'",
      )
      .bind(UNO)
      .run();
    const clave = op();
    const pedido = {
      op: clave,
      ids: ['p-camisa'],
      cambio: { tipo: 'precio', modo: 'valor', cantidad: -10_000_000 },
    };
    expect(await cambiarEnLote(quien(), pedido)).toMatchObject({ estado: 'guardado' });
    const v = await precios();
    expect(v.every((x) => x.precio_cop === 1)).toBe(true);
    expect(v.every((x) => x.precio_antes_cop !== null && x.precio_antes_cop > 1)).toBe(true);
    // Repetir la op devuelve lo mismo sin volver a bajar.
    expect(await cambiarEnLote(quien(), pedido)).toMatchObject({ estado: 'guardado' });
    expect((await precios()).every((x) => x.precio_cop === 1)).toBe(true);
    // Subir por encima del «antes» lo quita.
    await cambiarEnLote(quien(), {
      op: op(),
      ids: ['p-camisa'],
      cambio: { tipo: 'precio', modo: 'valor', cantidad: 500_000 },
    });
    expect((await precios()).every((x) => x.precio_antes_cop === null)).toBe(true);
  });

  it('estado y promoción a varios; ❌ los de otra tienda no se tocan', async () => {
    const r = await cambiarEnLote(quien(DOS), {
      op: op(),
      ids: ['p-camisa'],
      cambio: { tipo: 'estado', estado: 'archivado' },
    });
    expect(r.estado).toBe('no-existe');
    const promo = await cambiarEnLote(quien(), {
      op: op(),
      ids: ['p-camisa'],
      cambio: {
        tipo: 'promocion',
        promocion: { tipo: 'regalo', lleva: 3, paga: 2, hasta: null },
      },
    });
    expect(promo).toMatchObject({ estado: 'guardado' });
    const p = await shard
      .prepare("SELECT estado, promocion FROM producto WHERE org_id = ? AND id = 'p-camisa'")
      .bind(UNO)
      .first<{ estado: string; promocion: string }>();
    expect(p?.estado).toBe('activo');
    expect(JSON.parse(p?.promocion ?? 'null')).toMatchObject({ tipo: 'regalo', lleva: 3 });
  });

  it('❌ sin productos ni categoría, o un cambio de 0, se dice con su campo', async () => {
    const r = await cambiarEnLote(quien(), {
      op: op(),
      cambio: { tipo: 'precio', modo: 'porcentaje', cantidad: 0 },
    });
    expect(r.estado).toBe('problemas');
    expect(JSON.stringify(r)).toContain('elige productos o una categoría');
    expect(JSON.stringify(r)).toContain('un cambio de 0 no cambia nada');
  });
});
