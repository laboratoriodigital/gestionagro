/**
 * Las filas que lee D1 con la tienda llena (bitácora tienda3 26). El plan gratuito da 5 millones de
 * filas leídas al día para toda la cuenta (el CORE, el agro, el parqueadero y la Tienda, en staging
 * y en producción), y al pasarlas ninguna base de la cuenta responde hasta las 00:00 UTC. El 16 oct
 * 2026 una sola carga de Productos en staging leyó 24 millones y paró a todos.
 *
 * Cada pantalla del panel tiene su tope con 2.000 productos de 6 combinaciones y 300 pedidos: una
 * consulta que recorre la tienda entera por cada fila, o todas las combinaciones por página, lo
 * pasa por miles. Los topes dejan que una tienda grande abra el panel cientos de veces al día.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_UNO, siembraDelControl, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { fotosDeVolumen, siembraDeVolumen } from '@ed1/tienda-schema/volumen';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { contandoFilas } from './lecturas.fixture.ts';
import { type Almacen, type Contexto, publicar } from './publicar.ts';
import type { AlmacenDeRespaldos } from './respaldos.ts';
import { type Ciclo, type Frecuencia, siguienteTurno, TAREAS } from './tareas.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-volumen';
const T0 = Date.UTC(2026, 9, 20, 17);
const AHORA = new Date(T0).toISOString();
const UNO = ENSAYO_UNO.org;

let shard: BaseD1;
let control: BaseD1;
let contado: ReturnType<typeof contandoFilas>;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  // Solo el D1 de workerd cuenta las filas que lee: la base en proceso no.
  const s = await baseLocal({
    instrumento: 'workerd',
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
  contado = contandoFilas(shard);
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of [
    ...siembraDelShard([ENSAYO_UNO], AHORA),
    ...siembraDeVolumen(ENSAYO_UNO, AHORA),
    // La foto que quien revisa subió desde el panel; la siembra se la pone a los demás.
    `INSERT INTO medio (org_id, id, producto_id, ancho, alto, formatos, creado)
     VALUES ('${UNO}', '${'f'.repeat(64)}', '${ENSAYO_UNO.productos[0]?.id}', 1600, 2000,
       '{"webp":{"400":1,"800":1,"1600":1}}', '${AHORA}')`,
    fotosDeVolumen(ENSAYO_UNO, AHORA),
  ])
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: contado.db,
  tienda_control: control,
});
const pedir = async (ruta: string, cuerpo?: unknown) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: '0199e0a0-0000-7000-8000-0000000000db',
      org: UNO,
      rol: 'propietario',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'entrada',
      auth_time: Math.floor(T0 / 1000),
    },
    T0,
    2,
  );
  const r = await crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${token}`,
        ...(cuerpo ? { 'content-type': 'application/json' } : {}),
      },
      ...(cuerpo ? { method: 'POST', body: JSON.stringify(cuerpo) } : {}),
    },
    env(),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

/** Una lista del panel: la página y su total. */
const TOPE_DE_UNA_LISTA = 5_000;
/** Una ficha o un cambio: lo de un producto, una combinación o un pedido. */
const TOPE_DE_UNA_FICHA = 300;
/** Las tareas, por tienda y por corrida: la de cada hora corre 24 veces al día en cada tienda. */
const TOPE_DE_UNA_TAREA: Record<Frecuencia, number> = { hora: 300, dia: 5_000, semana: 50_000 };
/** Publicar y exportar leen la tienda entera, y se piden a mano. */
const TOPE_DE_PUBLICAR = 30_000;
const TOPE_DE_EXPORTAR = 45_000;

const leido = () => contado.leer();
const mensaje = (l: ReturnType<typeof leido>) =>
  `${l.filas} filas; la que más leyó (${l.peor.filas}): ${l.peor.sql}`;

describe('bitácora tienda3 26 ❌: las filas que lee el panel con la tienda llena', () => {
  it.each([
    ['tablero'],
    ['pedidos'],
    ['pedidos?estado=pendiente'],
    ['productos'],
    ['productos?q=algodon'],
    ['productos?papelera=1'],
    ['productos?coleccion=vol-col-algodon'],
    ['inventario'],
    ['inventario?q=algodon'],
    ['solicitudes'],
    ['colecciones'],
    ['recaudos'],
    ['venta'],
    ['registro'],
  ])('la lista %s no pasa de su tope', async (ruta) => {
    leido();
    const r = await pedir(ruta);
    expect(r.status).toBe(200);
    const l = leido();
    expect(l.filas, mensaje(l)).toBeLessThanOrEqual(TOPE_DE_UNA_LISTA);
  });

  it.each([['productos'], ['inventario']])('la segunda página de %s tampoco', async (ruta) => {
    const primera = await pedir(ruta);
    const cursor = primera.cuerpo['siguiente'] as string;
    expect(cursor).toBeTruthy();
    leido();
    const r = await pedir(`${ruta}?cursor=${encodeURIComponent(cursor)}`);
    expect(r.status).toBe(200);
    const l = leido();
    expect(l.filas, mensaje(l)).toBeLessThanOrEqual(TOPE_DE_UNA_LISTA);
  });

  it('abrir un producto, una combinación y un pedido no recorre la tienda', async () => {
    for (const ruta of ['productos/vol-p-0001', 'inventario/vol-p-0001-1', 'pedidos/vol-ped-004']) {
      leido();
      expect((await pedir(ruta)).status, ruta).toBe(200);
      const l = leido();
      expect(l.filas, `${ruta}: ${mensaje(l)}`).toBeLessThanOrEqual(TOPE_DE_UNA_FICHA);
    }
  });

  it('guardar un producto y ajustar una combinación tampoco', async () => {
    const producto = await pedir('productos/vol-p-0002');
    leido();
    const g = await pedir('productos/guardar', {
      ...producto.cuerpo,
      op: 'op-lecturas-guardar',
      nombre: `${producto.cuerpo['nombre']} editado`,
    });
    expect(g.cuerpo).toMatchObject({ estado: 'guardado' });
    const l1 = leido();
    expect(l1.filas, mensaje(l1)).toBeLessThanOrEqual(TOPE_DE_UNA_FICHA);
    const a = await pedir('inventario/ajustar', {
      op: '0199e0a0-0000-7000-8000-00000000a026',
      variante: 'vol-p-0003-1',
      version: 1,
      tipo: 'ajuste',
      cantidad: 3,
    });
    expect(a.cuerpo).toMatchObject({ estado: 'guardado' });
    const l2 = leido();
    expect(l2.filas, mensaje(l2)).toBeLessThanOrEqual(TOPE_DE_UNA_FICHA);
  });

  it('publicar y exportar leen la tienda una vez; la tienda llena sube por tandas que caben en una solicitud', async () => {
    const objetos = new Map<string, string>();
    let operaciones = 0;
    const sitios: Almacen = {
      get: async (k) => {
        operaciones++;
        const t = objetos.get(k);
        return t === undefined ? null : { text: async () => t };
      },
      put: async (k, v) => {
        operaciones++;
        objetos.set(k, v);
      },
    };
    const contexto: Contexto = {
      shard: contado.db,
      shardNombre: 'tienda_c1_s1',
      control,
      sitios,
      hosts: { put: async () => undefined },
      celda: 'c1',
      release: 'r1',
      medios: 'img--staging.laboratorio-digital.app',
      org: UNO,
      pedidaPor: 'usuario:prueba',
      ahora: AHORA,
    };
    // Bitácora tienda3 30: la primera publicación de la tienda llena sube unos 4.200 archivos, y
    // una solicitud del plan gratuito hace como mucho 1.000 operaciones con R2, D1 y KV.
    const estados: string[] = [];
    for (let tanda = 0; tanda < 10 && estados.at(-1) !== 'publicada'; tanda++) {
      leido();
      operaciones = 0;
      const r = await publicar(contexto);
      estados.push(r.estado);
      const p = leido();
      expect(p.filas, mensaje(p)).toBeLessThanOrEqual(TOPE_DE_PUBLICAR);
      // De las 1.000, 50 quedan para las consultas a D1, su tope por solicitud.
      expect(operaciones, `operaciones con R2 en la tanda ${tanda + 1}`).toBeLessThanOrEqual(
        1000 - 50,
      );
    }
    expect(estados.at(-1)).toBe('publicada');
    expect(estados.length).toBeGreaterThan(1);
    expect((await pedir('exportar')).status).toBe(200);
    const e = leido();
    expect(e.filas, mensaje(e)).toBeLessThanOrEqual(TOPE_DE_EXPORTAR);
  }, 120_000);

  it('cada tarea del cron, por tienda y por corrida', async () => {
    const datos = new Map<string, string>();
    const almacen: AlmacenDeRespaldos = {
      put: async (k, v) => void datos.set(k, v),
      get: async (k) => {
        const t = datos.get(k);
        return t === undefined ? null : { text: async () => t };
      },
      list: async ({ prefix }) => ({
        objects: [...datos.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
        truncated: false,
      }),
      delete: async (k) => {
        for (const x of Array.isArray(k) ? k : [k]) datos.delete(x);
      },
    };
    const kv = { get: async () => null, put: async () => undefined };
    // El freno de R2 no lee D1: mide con la API de métricas, que aquí no hay.
    for (const tarea of TAREAS.filter((t) => t.nombre !== 'freno-r2')) {
      leido();
      await tarea.correr(
        {
          celda: 'c1',
          shards: [['tienda_c1_s1', contado.db]],
          control,
          hosts: kv,
          flags: kv,
          telegram: { token: undefined, chat: undefined },
          almacen,
          medios: 'img--staging.laboratorio-digital.app',
          fetch: (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch,
        },
        // Una repartida, en la hora de la tienda llena: si no, no la tocaría (bitácora tienda3 27).
        tarea.repartida ? siguienteTurno(UNO, tarea.frecuencia as Ciclo, T0) : T0,
      );
      const l = leido();
      expect(l.filas, `${tarea.nombre}: ${mensaje(l)}`).toBeLessThanOrEqual(
        TOPE_DE_UNA_TAREA[tarea.frecuencia],
      );
    }
  }, 120_000);
});

describe('bitácora tienda3 26 ❌: `producto.combinaciones` dice las activas de cada producto', () => {
  const desfasados = async () =>
    (
      await shard
        .prepare(
          `SELECT count(*) AS n FROM producto p WHERE p.org_id = ? AND p.combinaciones <> (
             SELECT count(*) FROM variante v WHERE v.org_id = p.org_id AND v.producto_id = p.id AND v.activa = 1)`,
        )
        .bind(UNO)
        .first<{ n: number }>()
    )?.n;
  const de = async (id: string) =>
    (
      await shard
        .prepare('SELECT combinaciones AS n FROM producto WHERE org_id = ? AND id = ?')
        .bind(UNO, id)
        .first<{ n: number }>()
    )?.n;

  it('al nacer, apagarse, prenderse, cambiar de producto y borrarse una combinación', async () => {
    expect(await desfasados()).toBe(0);
    const antes = await de('vol-p-0010');
    const otro = await de('vol-p-0011');
    const correr = (sql: string, ...v: unknown[]) =>
      shard
        .prepare(sql)
        .bind(...v)
        .run();
    await correr(
      `INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado)
       VALUES (?, 'vol-p-0010-x', 'vol-p-0010', 'X|Único', 1000, 1, ?)`,
      UNO,
      AHORA,
    );
    expect(await de('vol-p-0010')).toBe((antes ?? 0) + 1);
    await correr("UPDATE variante SET activa = 0 WHERE org_id = ? AND id = 'vol-p-0010-x'", UNO);
    expect(await de('vol-p-0010')).toBe(antes);
    await correr("UPDATE variante SET activa = 1 WHERE org_id = ? AND id = 'vol-p-0010-x'", UNO);
    expect(await de('vol-p-0010')).toBe((antes ?? 0) + 1);
    await correr(
      "UPDATE variante SET producto_id = 'vol-p-0011' WHERE org_id = ? AND id = 'vol-p-0010-x'",
      UNO,
    );
    expect([await de('vol-p-0010'), await de('vol-p-0011')]).toEqual([antes, (otro ?? 0) + 1]);
    await correr("DELETE FROM variante WHERE org_id = ? AND id = 'vol-p-0010-x'", UNO);
    expect(await de('vol-p-0011')).toBe(otro);
    expect(await desfasados()).toBe(0);
  });
});
