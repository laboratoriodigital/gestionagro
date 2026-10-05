/**
 * HU-C2.3: el despliegue copia `productos.json` y los `planes.json` a la base del CORE, y después
 * comprueba que la base diga lo mismo que el archivo (P2, P16). En el D1 local de workerd.
 */
import type { BaseD1 } from '@ed1/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { catalogoDelRepositorio } from '../../../scripts/lib/registro-productos.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import {
  CONSULTAS_DEL_CATALOGO,
  diferenciasDelCatalogo,
  type ProductoDelCatalogo,
  sentenciasDelCatalogo,
} from './catalogo.ts';
import { sentenciasDeCeldas } from './celdas.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
}, 60_000);
afterAll(async () => cerrar?.());

const aplicar = async (productos: readonly ProductoDelCatalogo[], ahora: string) => {
  for (const s of sentenciasDelCatalogo(productos, ahora)) await db.prepare(s).run();
};
const leer = async () => {
  const filas: Record<string, unknown>[][] = [];
  for (const consulta of CONSULTAS_DEL_CATALOGO.split('; ')) {
    filas.push((await db.prepare(consulta).all()).results);
  }
  return filas;
};
const contar = async (tabla: string) =>
  (await db.prepare(`SELECT COUNT(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n ?? -1;

const real = () => catalogoDelRepositorio();
const ensayo = (): ProductoDelCatalogo => ({
  id: 'ensayo',
  nombre: 'Producto Ensayo',
  estado: 'activo',
  tipos: ['comercio'],
  roles: [
    { id: 'propietario', administra: true, invitable: true },
    { id: 'colaborador', administra: false, invitable: true },
  ],
  planes: [
    { id: 'gratis', nombre: 'Gratis', gratuito: true },
    { id: 'entrada', nombre: 'Entrada', cobro: { 1: 29900, 12: 299000 } },
  ],
});

beforeEach(async () => {
  await vaciarCore(db);
  // El catálogo vuelve a la siembra de la 0006 entre pruebas.
  for (const s of [
    'DELETE FROM plan_precio',
    "DELETE FROM plan WHERE producto <> 'agro'",
    "DELETE FROM producto_rol WHERE producto <> 'agro'",
    "DELETE FROM producto_tipo WHERE producto <> 'agro'",
    "DELETE FROM producto WHERE id <> 'agro'",
  ]) {
    await db.prepare(s).run();
  }
});

describe('copiar el catálogo a la base (HU-C2.3)', () => {
  it('con el repositorio real, la base queda igual al archivo', async () => {
    await aplicar(real(), '2026-10-06T00:00:00.000Z');
    expect(diferenciasDelCatalogo(real(), await leer())).toEqual([]);
    expect(await contar('plan_precio')).toBe(4);
  });

  it('un segundo producto entra solo con datos, y antes que su celda', async () => {
    await aplicar([...real(), ensayo()], '2026-10-06T00:00:00.000Z');
    expect(diferenciasDelCatalogo([...real(), ensayo()], await leer())).toEqual([]);
    const celda = sentenciasDeCeldas(
      [
        {
          id: 'c1',
          producto: 'ensayo',
          estado: 'activa',
          anillo_despliegue: 0,
          shards: ['ensayo_c1_s1'],
          api: 'https://api-c1',
          api_staging: 'https://api-c1-staging',
        },
      ],
      'staging',
    );
    for (const s of celda) await db.prepare(s).run();
    expect(
      await db.prepare("SELECT producto FROM celda WHERE id = 'c1'").first<{ producto: string }>(),
    ).toEqual({ producto: 'ensayo' });
  });

  it('aplicarlo dos veces no escribe precios ni cambia la fecha del producto', async () => {
    const fecha = () =>
      db
        .prepare("SELECT actualizado FROM producto WHERE id = 'agro'")
        .first<{ actualizado: string }>();
    await aplicar(real(), '2026-10-06T00:00:00.000Z');
    const antes = await fecha();
    await aplicar(real(), '2026-10-07T00:00:00.000Z');
    expect(await contar('plan_precio')).toBe(4);
    // El agro ya venía de la siembra de la 0006 con el mismo nombre y estado: nada que escribir.
    expect(await fecha()).toEqual(antes);
  });

  it('un precio nuevo entra como fila nueva, y el anterior queda como historia (P21)', async () => {
    await aplicar([ensayo()], '2026-10-06T00:00:00.000Z');
    const subido = ensayo();
    (subido.planes[1] as { cobro: Record<string, number> }).cobro = { 1: 32900, 12: 299000 };
    await aplicar([subido], '2026-11-01T00:00:00.000Z');
    const { results } = await db
      .prepare(
        "SELECT monto_cop, vigente_desde FROM plan_precio WHERE producto = 'ensayo' AND meses = 1 ORDER BY vigente_desde",
      )
      .all();
    expect(results).toEqual([
      { monto_cop: 29900, vigente_desde: '2026-10-06T00:00:00.000Z' },
      { monto_cop: 32900, vigente_desde: '2026-11-01T00:00:00.000Z' },
    ]);
    expect(diferenciasDelCatalogo([subido], await leer())).toEqual([]);
  });

  it('un plan o un producto que sale del archivo queda retirado, nunca borrado', async () => {
    await aplicar([...real(), ensayo()], '2026-10-06T00:00:00.000Z');
    const sinEntrada = {
      ...ensayo(),
      planes: [ensayo().planes[0] as ProductoDelCatalogo['planes'][number]],
    };
    await aplicar([...real(), sinEntrada], '2026-10-07T00:00:00.000Z');
    expect(
      await db.prepare("SELECT estado FROM plan WHERE id = 'entrada'").first<{ estado: string }>(),
    ).toEqual({ estado: 'retirado' });
    await aplicar(real(), '2026-10-08T00:00:00.000Z');
    expect(
      await db
        .prepare("SELECT estado FROM producto WHERE id = 'ensayo'")
        .first<{ estado: string }>(),
    ).toEqual({ estado: 'retirado' });
    expect(diferenciasDelCatalogo(real(), await leer())).toEqual([]);
  });

  it('una fila editada a mano se ve, con su nombre (control negativo de CA3)', async () => {
    await aplicar(real(), '2026-10-06T00:00:00.000Z');
    await db
      .prepare("UPDATE plan SET nombre = 'Finca Plus' WHERE producto = 'agro' AND id = 'finca'")
      .run();
    await db
      .prepare(
        "INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) VALUES ('agro', 'finca', 1, 45000, '2026-10-09T00:00:00.000Z')",
      )
      .run();
    expect(diferenciasDelCatalogo(real(), await leer())).toEqual([
      'el plan «agro/finca» no es el del archivo',
    ]);
    // El siguiente despliegue lo pone al día: el nombre vuelve y el precio del archivo entra de nuevo.
    await aplicar(real(), '2026-10-10T00:00:00.000Z');
    expect(diferenciasDelCatalogo(real(), await leer())).toEqual([]);
  });
});
