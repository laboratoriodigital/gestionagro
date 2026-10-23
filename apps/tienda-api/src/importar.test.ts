/**
 * HU-T12.2: cargar una tienda desde un `tienda-import/1`. Revisar dice todo sin escribir (CA1);
 * aplicar va por partes y por la ruta del panel con su permiso; cargar dos veces el mismo archivo no
 * cambia nada, un error a la mitad no deja una parte a medias y nada se borra (CA4); los pedidos
 * históricos entran con canal `carga` y sin datos personales (CA3).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aplicarParte, planDeLaCarga, revisarLaCarga, SENTENCIAS_POR_PARTE } from './importar.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 14, 15);
const AHORA = new Date(T0).toISOString();
const ORG = '0199e0a0-0000-7000-8000-0000000000e1';
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';

let shard: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  await shard
    .prepare(
      "INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES (?, 'carga', 'Tienda de carga', 'borrador', 'gratis', 'x', 'x')",
    )
    .bind(ORG)
    .run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());

/** Un archivo pequeño pero completo: dos productos con variantes, una colección y lo demás. */
const archivo = (cambios: Record<string, unknown> = {}) => ({
  formato: 'tienda-import/1',
  tienda: { slug: 'carga', nombre: 'Tienda de carga' },
  ajustes: { identidad: { nombre: 'Tienda de carga', frase: 'Hecho a mano.' } },
  colecciones: [{ refExterna: 'C1', nombre: 'Vestidos', slug: 'vestidos' }],
  productos: [
    {
      refExterna: 'P001',
      nombre: 'Vestido',
      estado: 'activo',
      opciones: [{ nombre: 'Talla', valores: ['S', 'M'] }],
      variantes: [
        { valores: ['S'], sku: 'VS-S', precioCop: 80000, stock: 3 },
        { valores: ['M'], sku: 'VS-M', precioCop: 80000, stock: 1 },
      ],
      colecciones: ['C1'],
      medios: [{ url: 'https://ejemplo.test/vestido.webp', alt: 'Vestido rosa' }],
    },
    {
      refExterna: 'P002',
      nombre: 'Pañoleta',
      estado: 'activo',
      opciones: [],
      variantes: [{ valores: [], precioCop: 25000, stock: null }],
    },
  ],
  envios: [
    {
      refExterna: 'E1',
      nombre: 'Medellín',
      precioCop: 8000,
      gratisDesdeCop: null,
      ciudades: null,
      diasMin: 1,
      diasMax: 2,
    },
  ],
  cupones: [{ codigo: 'BIENVENIDA', tipo: 'porcentaje', valor: 10, usosMaximos: null }],
  pedidos: [
    {
      codigo: 'H0K234',
      creado: '2026-06-01T15:00:00.000Z',
      estado: 'entregado',
      formaPago: 'transferencia',
      lineas: [
        { nombre: 'Vestido', opciones: 'Talla: S', sku: 'VS-S', precioCop: 80000, cantidad: 1 },
      ],
      totales: { subtotal: 80000, descuento: 0, envio: 8000, total: 88000 },
    },
  ],
  ...cambios,
});

const foto = async () => {
  const una = async (sql: string) =>
    JSON.stringify((await shard.prepare(sql).bind(ORG).all()).results);
  return [
    await una('SELECT * FROM producto WHERE org_id = ? ORDER BY id'),
    await una('SELECT * FROM variante WHERE org_id = ? ORDER BY id'),
    await una('SELECT * FROM coleccion WHERE org_id = ? ORDER BY id'),
    await una('SELECT * FROM coleccion_producto WHERE org_id = ? ORDER BY producto_id'),
    await una('SELECT * FROM envio_opcion WHERE org_id = ? ORDER BY id'),
    await una('SELECT * FROM cupon WHERE org_id = ? ORDER BY codigo'),
    await una('SELECT * FROM ajuste WHERE org_id = ? ORDER BY seccion'),
    await una('SELECT * FROM pedido WHERE org_id = ? ORDER BY id'),
    await una('SELECT * FROM pedido_linea WHERE org_id = ? ORDER BY pedido_id, linea'),
    await una('SELECT * FROM pedido_evento WHERE org_id = ? ORDER BY id'),
    await una('SELECT * FROM movimiento_inventario WHERE org_id = ? ORDER BY id'),
  ].join('\n');
};

async function aplicarTodo(datos: unknown) {
  const r = await revisarLaCarga(shard, ORG, datos, AHORA);
  if (!r.ok) throw new Error(JSON.stringify(r.problemas));
  for (const parte of r.plan.partes) await aplicarParte(shard, parte);
  return r.plan;
}

describe('revisar (CA1)', () => {
  it('un archivo sano no tiene problemas y dice qué va a cargar, sin escribir nada', async () => {
    const antes = await foto();
    const r = await revisarLaCarga(shard, ORG, archivo(), AHORA);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.resumen).toMatchObject({
        productos: 2,
        variantes: 3,
        colecciones: 1,
        envios: 1,
        cupones: 1,
        pedidos: 1,
        fotos: 1,
      });
    }
    expect(await foto()).toBe(antes);
  });

  it('❌ todos los problemas a la vez, cada uno con su lugar', async () => {
    const r = await revisarLaCarga(
      shard,
      ORG,
      archivo({
        productos: [
          { ...archivo().productos[0], slug: 'repetido' },
          { ...archivo().productos[1], slug: 'repetido' },
        ],
        pedidos: [
          {
            ...archivo().pedidos[0],
            estado: 'pagado',
            lineas: [{ nombre: 'No existe', precioCop: 80000, cantidad: 1 }],
          },
        ],
      }),
      AHORA,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problemas.map((p) => p.mensaje)).toEqual([
        'su dirección «repetido» es la de P001: dale a uno su propio «slug»',
        'solo un pago en línea queda «pagado»; uno por fuera es «confirmado»',
        '«No existe» no es un producto del archivo: ponle el SKU de su variante',
      ]);
    }
  });

  it('❌ un pedido histórico con datos del comprador no se carga (CA3)', async () => {
    const pedido = {
      ...archivo().pedidos[0],
      contacto: { nombre: 'Alguien', celular: '+573000000000' },
    };
    const r = await revisarLaCarga(shard, ORG, archivo({ pedidos: [pedido] }), AHORA);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.problemas[0]?.mensaje).toBe(
        'un pedido histórico no lleva datos personales ni otros campos',
      );
  });
});

describe('aplicar (CA2, CA3 y CA4)', () => {
  it('carga la tienda, y los históricos con canal carga', async () => {
    await aplicarTodo(archivo());
    const productos = await shard
      .prepare(
        'SELECT ref_externa, slug, estado FROM producto WHERE org_id = ? ORDER BY ref_externa',
      )
      .bind(ORG)
      .all();
    expect(productos.results).toEqual([
      { ref_externa: 'P001', slug: 'vestido', estado: 'activo' },
      { ref_externa: 'P002', slug: 'panoleta', estado: 'activo' },
    ]);
    const pedido = await shard
      .prepare(
        "SELECT canal, estado, numero, total_cop FROM pedido WHERE org_id = ? AND codigo = 'H0K234'",
      )
      .bind(ORG)
      .first();
    expect(pedido).toEqual({ canal: 'carga', estado: 'entregado', numero: 1001, total_cop: 88000 });
    const enColeccion = await shard
      .prepare('SELECT COUNT(*) AS n FROM coleccion_producto WHERE org_id = ?')
      .bind(ORG)
      .first<{ n: number }>();
    expect(enColeccion?.n).toBe(1);
  });

  it('❌ cargar dos veces el mismo archivo no cambia nada (CA4)', async () => {
    const antes = await foto();
    await aplicarTodo(archivo());
    expect(await foto()).toBe(antes);
  });

  it('un cambio en el archivo actualiza solo eso, deja su movimiento de inventario y no borra lo que falta', async () => {
    // El vestido con 5 en la talla S, y la pañoleta fuera del archivo.
    const vestido = archivo().productos[0] as ReturnType<typeof archivo>['productos'][0];
    const otro = archivo({
      productos: [
        {
          ...vestido,
          variantes: [{ ...vestido.variantes[0], stock: 5 }, vestido.variantes[1]],
        },
      ],
    });
    await aplicarTodo(otro);
    const variantes = await shard
      .prepare('SELECT clave, stock FROM variante WHERE org_id = ? ORDER BY clave')
      .bind(ORG)
      .all();
    expect(variantes.results).toEqual([
      { clave: '', stock: null },
      { clave: 'M', stock: 1 },
      { clave: 'S', stock: 5 },
    ]);
    const libro = await shard
      .prepare('SELECT delta, motivo FROM movimiento_inventario WHERE org_id = ?')
      .bind(ORG)
      .all();
    expect(libro.results).toEqual([{ delta: 2, motivo: 'carga' }]);
  });

  it('❌ una parte que falla no deja nada de ella escrito; volver a aplicarla termina', async () => {
    const plan = planDeLaCarga(
      (await revisarLaCarga(shard, ORG, archivo(), AHORA).then((r) =>
        r.ok ? r.carga : null,
      )) as never,
      ORG,
      AHORA,
    );
    const parte = plan.partes[0] ?? [];
    const rota = [...parte, { sql: 'INSERT INTO tabla_que_no_existe VALUES (1)', params: [] }];
    const antes = await foto();
    await expect(aplicarParte(shard, rota)).rejects.toThrow();
    expect(await foto()).toBe(antes);
  });

  it('un archivo grande va en partes de a lo sumo SENTENCIAS_POR_PARTE', () => {
    const muchos = archivo({
      productos: Array.from({ length: 60 }, (_, i) => ({
        refExterna: `P${i}`,
        nombre: `Producto ${i}`,
        estado: 'activo',
        opciones: [],
        variantes: [{ valores: [], precioCop: 1000 + i, stock: 1 }],
      })),
      pedidos: [],
    });
    return revisarLaCarga(shard, ORG, muchos, AHORA).then((r) => {
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.plan.partes.length).toBeGreaterThan(2);
      expect(r.plan.partes.every((p) => p.length <= SENTENCIAS_POR_PARTE)).toBe(true);
    });
  });
});

describe('por la API del panel', () => {
  // HU-T18.11: cargar por lotes y subir un respaldo son de Pro e IA Pro.
  const token = async (rol: string, plan = 'pro') =>
    (
      await firmarAcceso(
        firmante,
        {
          sub: PERSONA,
          org: ORG,
          rol,
          celda: 'c1',
          shard: 'tienda_c1_s1',
          anillo: 1,
          aud: 'tienda',
          plan,
          auth_time: Math.floor(T0 / 1000),
        },
        T0,
        2,
      )
    ).token;
  const env = (): Env => ({
    CELDA: 'c1',
    PRODUCTO: 'tienda',
    SECRETO_DESPACHO: SECRETO,
    CORE_CLAVES: JSON.stringify([firmante.publica]),
    tienda_c1_s1: shard,
  });
  const post = async (ruta: string, cuerpo: unknown, rol = 'propietario', plan = 'pro') =>
    crearApp({ ahora: () => T0 }).request(
      ruta,
      {
        method: 'POST',
        body: JSON.stringify(cuerpo),
        headers: {
          [CABECERA_DESPACHO]: SECRETO,
          authorization: `Bearer ${await token(rol, plan)}`,
          'content-type': 'application/json',
        },
      },
      env(),
    );

  it('revisar y aplicar parte por parte, diciendo cuál sigue', async () => {
    const revisar = await post('/api/panel/v1/importar/revisar', { carga: archivo() });
    expect(revisar.status).toBe(200);
    const { resumen } = (await revisar.json()) as { resumen: { partes: number } };
    let parte: number | null = 0;
    while (parte !== null) {
      const r = await post('/api/panel/v1/importar/aplicar', { carga: archivo(), parte });
      expect(r.status).toBe(200);
      parte = ((await r.json()) as { siguiente: number | null }).siguiente;
    }
    const registro = await shard
      .prepare('SELECT estado FROM importacion WHERE org_id = ?')
      .bind(ORG)
      .all();
    expect(registro.results).toEqual([{ estado: 'aplicada' }]);
    expect(resumen.partes).toBeGreaterThan(0);
  });

  it('❌ un colaborador sin el permiso importar no carga nada (HU-T1.4)', async () => {
    const r = await post('/api/panel/v1/importar/revisar', { carga: archivo() }, 'colaborador');
    expect(r.status).toBe(403);
  });

  it('❌ un archivo con problemas no se aplica, ni por partes', async () => {
    const r = await post('/api/panel/v1/importar/aplicar', {
      carga: archivo({ formato: 'otro' }),
      parte: 0,
    });
    expect(r.status).toBe(422);
  });

  it('❌ HU-T18.11: en el plan Gratis no se carga por lotes ni se sube un respaldo', async () => {
    for (const ruta of ['/api/panel/v1/importar/revisar', '/api/panel/v1/importar/aplicar']) {
      const r = await post(ruta, { carga: archivo(), parte: 0 }, 'propietario', 'gratis');
      expect(r.status, ruta).toBe(403);
      expect(await r.json()).toEqual({
        estado: 'plan',
        motivo: 'Cargar productos por lotes y subir un respaldo son de los planes Pro e IA Pro.',
      });
    }
  });
});

describe('subir un respaldo de «Descargar todo» (HU-T18.11)', () => {
  it('un producto creado en el panel se actualiza con su respaldo, sin duplicarse', async () => {
    await shard.batch([
      shard
        .prepare(
          `INSERT INTO producto (org_id, id, slug, nombre, descripcion_md, estado, opciones, retracto,
             solo_mayores, posicion, creado, actualizado)
           VALUES (?, 'p-del-panel', 'bolso-del-panel', 'Bolso', '', 'activo', '[]', 'aplica', 0, 9, 'x', 'x')`,
        )
        .bind(ORG),
      shard
        .prepare(
          `INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, posicion, actualizado)
           VALUES (?, 'v-del-panel', 'p-del-panel', '', 50000, 2, 0, 'x')`,
        )
        .bind(ORG),
    ]);
    const respaldo = archivo({
      formato: 'tienda-export/1',
      colecciones: [],
      envios: [],
      cupones: [],
      pedidos: [],
      productos: [
        {
          refExterna: 'p-del-panel',
          nombre: 'Bolso de cuero',
          slug: 'bolso-del-panel',
          estado: 'activo',
          opciones: [],
          variantes: [{ valores: [], precioCop: 55000, stock: 4 }],
        },
      ],
    });
    await aplicarTodo(respaldo);
    await aplicarTodo(respaldo);
    const { results } = await shard
      .prepare(
        `SELECT p.id, p.nombre, p.ref_externa, v.id AS variante, v.precio_cop, v.stock FROM producto p
           JOIN variante v ON v.org_id = p.org_id AND v.producto_id = p.id
          WHERE p.org_id = ? AND p.slug = 'bolso-del-panel'`,
      )
      .bind(ORG)
      .all();
    expect(results).toEqual([
      {
        id: 'p-del-panel',
        nombre: 'Bolso de cuero',
        ref_externa: 'p-del-panel',
        variante: 'v-del-panel',
        precio_cop: 55000,
        stock: 4,
      },
    ]);
  });

  it('❌ una hoja con solo nombre y precio cambia eso y no borra lo demás del producto', async () => {
    await shard.batch([
      shard
        .prepare(
          `INSERT INTO producto (org_id, id, slug, nombre, descripcion_md, estado, opciones, retracto,
             retracto_motivo, solo_mayores, iva_pct, posicion, ref_externa, creado, actualizado)
           VALUES (?, 'p-gorra', 'mi-gorra', 'Gorra', 'Hecha a mano.', 'activo', '[]', 'no_aplica',
             'Se hace a la medida.', 1, 19, 7, 'GOR-1', 'x', 'x')`,
        )
        .bind(ORG),
      shard
        .prepare(
          `INSERT INTO variante (org_id, id, producto_id, clave, sku, precio_cop, precio_antes_cop, stock,
             posicion, actualizado)
           VALUES (?, 'v-gorra', 'p-gorra', '', 'GOR-1-U', 40000, 50000, 7, 0, 'x')`,
        )
        .bind(ORG),
    ]);
    await aplicarTodo({
      formato: 'tienda-import/1',
      tienda: { slug: 'carga', nombre: 'Tienda de carga' },
      ajustes: {},
      productos: [
        {
          refExterna: 'GOR-1',
          nombre: 'Gorra azul',
          opciones: [],
          variantes: [{ valores: [], precioCop: 45000 }],
        },
      ],
    });
    expect(
      await shard
        .prepare(
          `SELECT p.slug, p.nombre, p.descripcion_md, p.estado, p.retracto, p.retracto_motivo,
             p.solo_mayores, p.iva_pct, p.posicion, v.sku, v.precio_cop, v.precio_antes_cop, v.stock
             FROM producto p JOIN variante v ON v.org_id = p.org_id AND v.producto_id = p.id
            WHERE p.org_id = ? AND p.id = 'p-gorra'`,
        )
        .bind(ORG)
        .first(),
    ).toEqual({
      slug: 'mi-gorra',
      nombre: 'Gorra azul',
      descripcion_md: 'Hecha a mano.',
      estado: 'activo',
      retracto: 'no_aplica',
      retracto_motivo: 'Se hace a la medida.',
      solo_mayores: 1,
      iva_pct: 19,
      posicion: 7,
      sku: 'GOR-1-U',
      precio_cop: 45000,
      precio_antes_cop: 50000,
      stock: 7,
    });
  });
});
