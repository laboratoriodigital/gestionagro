/**
 * HU-T8.5 y HU-T4.5 por la API del panel: con tokens del CORE firmados de verdad, contra el shard y
 * la base de control locales con los dos comercios de prueba, y un almacén y un KV de mentira para
 * el re-horneado.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cotizar } from './cotizar.ts';
import { type Almacen, publicar } from './publicar.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';
const UNO = ENSAYO_UNO.org;
const S = 'v-camisa-s-arena'; // 1 en inventario
const M = 'v-camisa-m-arena'; // 4 en inventario
const L = 'v-camisa-l-azul'; // agotada

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
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
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

/** Un R2 en memoria. */
function almacen() {
  const objetos = new Map<string, string>();
  const a: Almacen & { objetos: Map<string, string> } = {
    objetos,
    get: async (clave) => {
      const t = objetos.get(clave);
      return t === undefined ? null : { text: async () => t };
    },
    put: async (clave, valor) => void objetos.set(clave, valor),
  };
  return a;
}
const kv = () => {
  const valores = new Map<string, string>();
  return { valores, put: async (k: string, v: string) => void valores.set(k, v) };
};

let sitios = almacen();
let hosts = kv();
let flags: Env['FLAGS'];
/** Lo que la API dejó para después de responder: la prueba lo espera. */
let enCola: Promise<unknown>[] = [];

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
  tienda_control: control,
  SITIOS: sitios,
  TIENDA_HOSTS: hosts,
  VITRINA_RELEASE: 'r1',
  ...(flags ? { FLAGS: flags } : {}),
});

const token = async (extra: Partial<Parameters<typeof firmarAcceso>[1]> = {}) =>
  (
    await firmarAcceso(
      firmante,
      {
        sub: PERSONA,
        org: UNO,
        rol: 'colaborador',
        celda: 'c1',
        shard: 'tienda_c1_s1',
        anillo: 1,
        aud: 'tienda',
        plan: 'pro',
        auth_time: Math.floor(T0 / 1000),
        ...extra,
      },
      T0,
      2,
    )
  ).token;

const pedir = async (ruta: string, cuerpo?: unknown, t?: string) =>
  crearApp({ ahora: () => T0, enSegundoPlano: (p) => void enCola.push(p) }).request(
    ruta,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${t ?? (await token())}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );

let n = 0;
const op = () => `op-inventario-${++n}`.padEnd(12, '0');

type Fila = {
  variante: string;
  stock: number | null;
  apartadas: number;
  esperan: number;
  version: number;
};
const fila = async (variante: string) => {
  const r = (await (await pedir('/api/panel/v1/inventario')).json()) as { filas: Fila[] };
  return r.filas.find((f) => f.variante === variante) as Fila;
};
const ponerStock = (variante: string, stock: number, reservado = 0) =>
  shard
    .prepare(
      "UPDATE variante SET stock = ?, reservado = ?, cambio_motivo = 'carga', cambio_ref = NULL WHERE org_id = ? AND id = ?",
    )
    .bind(stock, reservado, UNO, variante)
    .run();

describe('el inventario y su libro (HU-T8.5)', () => {
  it('CA1: un ajuste y un conteo, cada uno con su motivo en el libro y su frase en el registro', async () => {
    await ponerStock(M, 4);
    const antes = await fila(M);
    expect(antes).toMatchObject({ stock: 4, apartadas: 0, esperan: 0 });
    const opAjuste = op();
    const r1 = await pedir('/api/panel/v1/inventario/ajustar', {
      op: opAjuste,
      variante: M,
      version: antes.version,
      tipo: 'ajuste',
      cantidad: 6,
    });
    expect(r1.status).toBe(200);
    const { version } = (await r1.json()) as { version: number };
    const opConteo = op();
    const r2 = await pedir('/api/panel/v1/inventario/ajustar', {
      op: opConteo,
      variante: M,
      version,
      tipo: 'conteo',
      cantidad: 7,
    });
    expect(r2.status).toBe(200);
    expect(await fila(M)).toMatchObject({ stock: 7 });

    const libro = (await (await pedir(`/api/panel/v1/inventario/${M}`)).json()) as {
      movimientos: { delta: number; stock: number; motivo: string; ref: string }[];
    };
    expect(libro.movimientos.slice(0, 2)).toEqual([
      expect.objectContaining({ delta: -3, stock: 7, motivo: 'conteo', ref: opConteo }),
      expect.objectContaining({ delta: 6, stock: 10, motivo: 'ajuste', ref: opAjuste }),
    ]);

    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas.slice(0, 2).map((f) => f.frase)).toEqual([
      'Tú contaste M / Arena de «Camisa de lino»: había 10, hay 7',
      'Tú ajustaste las existencias de M / Arena en «Camisa de lino» de 4 a 10',
    ]);
  });

  it('repetir la misma operación no la aplica dos veces, y una versión vieja responde 409', async () => {
    await ponerStock(M, 4);
    const { version } = await fila(M);
    const cuerpo = { op: op(), variante: M, version, tipo: 'ajuste', cantidad: 1 };
    expect((await pedir('/api/panel/v1/inventario/ajustar', cuerpo)).status).toBe(200);
    expect((await pedir('/api/panel/v1/inventario/ajustar', cuerpo)).status).toBe(200);
    expect(await fila(M)).toMatchObject({ stock: 5 });
    const tarde = await pedir('/api/panel/v1/inventario/ajustar', { ...cuerpo, op: op() });
    expect(tarde.status).toBe(409);
    expect(await tarde.json()).toMatchObject({ estado: 'cambiado', version: version + 1 });
  });

  it('❌ CA2: no baja de lo apartado por pagos en curso, ni de cero; nada cambia', async () => {
    await ponerStock(M, 4, 2);
    const { version } = await fila(M);
    const movimientos = async () =>
      (
        await shard
          .prepare(
            'SELECT COUNT(*) AS n FROM movimiento_inventario WHERE org_id = ? AND variante_id = ?',
          )
          .bind(UNO, M)
          .first<{ n: number }>()
      )?.n;
    const libroAntes = await movimientos();
    const conteo = await pedir('/api/panel/v1/inventario/ajustar', {
      op: op(),
      variante: M,
      version,
      tipo: 'conteo',
      cantidad: 1,
    });
    expect(conteo.status).toBe(422);
    expect(await conteo.json()).toMatchObject({
      problemas: [
        {
          campo: 'cantidad',
          mensaje:
            'Hay 2 unidades apartadas por pagos en curso: las existencias no pueden quedar en menos de 2.',
        },
      ],
    });

    await ponerStock(M, 4, 0);
    const salida = await pedir('/api/panel/v1/inventario/ajustar', {
      op: op(),
      variante: M,
      version: (await fila(M)).version,
      tipo: 'ajuste',
      cantidad: -5,
    });
    expect(salida.status).toBe(422);
    expect(await salida.json()).toMatchObject({
      problemas: [{ mensaje: 'Hay 4: no pueden salir más de las que hay.' }],
    });
    expect(await fila(M)).toMatchObject({ stock: 4 });
    expect(await movimientos()).toBe(libroAntes);
  });

  it('CA1: cuántas personas esperan una combinación agotada, y «Ya les avisé» queda en el registro', async () => {
    await shard
      .prepare(
        'INSERT INTO interes_reposicion (org_id, variante_id, personas, desde, ultimo) VALUES (?, ?, 3, ?, ?)',
      )
      .bind(UNO, L, AHORA, AHORA)
      .run();
    expect(await fila(L)).toMatchObject({ stock: 0, esperan: 3 });
    const cuerpo = { op: op(), variante: L };
    expect((await pedir('/api/panel/v1/avisame/atender', cuerpo)).status).toBe(200);
    expect((await pedir('/api/panel/v1/avisame/atender', cuerpo)).status).toBe(200);
    expect(await fila(L)).toMatchObject({ esperan: 0 });
    expect((await pedir('/api/panel/v1/avisame/atender', { op: op(), variante: L })).status).toBe(
      404,
    );
    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas[0]?.frase).toBe(
      'Tú avisaste a las 3 personas que esperaban L / Azul de «Camisa de lino»',
    );
  });

  it('❌ otra tienda no ve ni toca este inventario, y un rol fuera de la matriz no entra', async () => {
    const dos = await token({ org: ENSAYO_DOS.org });
    const r = await pedir(
      '/api/panel/v1/inventario/ajustar',
      { op: op(), variante: M, version: 1, tipo: 'ajuste', cantidad: 1 },
      dos,
    );
    expect(r.status).toBe(404);
    expect((await pedir(`/api/panel/v1/inventario/${M}`, undefined, dos)).status).toBe(404);
    const otro = await token({ rol: 'contador' });
    expect((await pedir('/api/panel/v1/inventario', undefined, otro)).status).toBe(403);
    expect(
      (await pedir('/api/panel/v1/avisame/atender', { op: op(), variante: L }, otro)).status,
    ).toBe(403);
  });
});

describe('el re-horneado mínimo cuando algo se agota (HU-T4.5)', () => {
  const contexto = () => ({
    shard,
    shardNombre: 'tienda_c1_s1',
    control,
    sitios,
    hosts,
    celda: 'c1',
    release: 'r1',
    org: UNO,
    pedidaPor: 'usuario:prueba',
    ahora: AHORA,
    omitir: ['sin-foto'] as const,
  });
  /** El texto de un archivo de la versión publicada. */
  const publicado = async (ruta: string) => {
    const v = (
      await shard
        .prepare('SELECT version_publicada AS v FROM tienda WHERE org_id = ?')
        .bind(UNO)
        .first<{ v: number }>()
    )?.v;
    const m = JSON.parse(sitios.objetos.get(`sitios/${UNO}/${v}/manifiesto.json`) ?? '{}') as {
      archivos: Record<string, { huella: string }>;
    };
    const h = m.archivos[ruta]?.huella ?? '';
    return { version: v, texto: sitios.objetos.get(`objetos/${h.slice(0, 2)}/${h}`) ?? '' };
  };
  const FICHA = '/p/camisa-de-lino/index.html';
  /** Lo que dice el JSON-LD de la ficha de una combinación: `InStock` u `OutOfStock`. */
  const disponibleEn = (html: string, variante: string) => {
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)?.[1] ?? '{}';
    const producto = JSON.parse(ld) as { offers?: { sku: string; availability: string }[] };
    return producto.offers
      ?.find((o) => o.sku === variante)
      ?.availability.split('/')
      .at(-1);
  };

  beforeEach(async () => {
    sitios = almacen();
    hosts = kv();
    flags = undefined;
    enCola = [];
    await shard.prepare('DELETE FROM publicacion').run();
    await shard.prepare('UPDATE tienda SET version_publicada = NULL').run();
    await ponerStock(S, 1);
    await shard
      .prepare("UPDATE producto SET nombre = 'Camisa de lino' WHERE org_id = ? AND id = 'p-camisa'")
      .bind(UNO)
      .run();
    expect(await publicar(contexto())).toMatchObject({ estado: 'publicada', version: 1 });
  });

  it('CA1: agotar una combinación vuelve a hornear lo publicado, sin publicar lo que no se ha publicado', async () => {
    const antes = await publicado(FICHA);
    expect(disponibleEn(antes.texto, S)).toBe('InStock');
    // Un cambio que el comercio no ha publicado.
    await shard
      .prepare(
        "UPDATE producto SET nombre = 'Camisa de lino nueva' WHERE org_id = ? AND id = 'p-camisa'",
      )
      .bind(UNO)
      .run();

    const r = await pedir('/api/panel/v1/inventario/ajustar', {
      op: op(),
      variante: S,
      version: (await fila(S)).version,
      tipo: 'conteo',
      cantidad: 0,
    });
    expect(r.status).toBe(200);
    expect(enCola).toHaveLength(1);
    await Promise.all(enCola);

    const despues = await publicado(FICHA);
    expect(despues.version).toBe(2);
    expect(disponibleEn(despues.texto, S)).toBe('OutOfStock');
    expect(despues.texto).not.toContain('Camisa de lino nueva');
    const pub = await shard
      .prepare('SELECT pedida_por FROM publicacion WHERE org_id = ? AND version = 2')
      .bind(UNO)
      .first<{ pedida_por: string }>();
    expect(pub?.pedida_por).toBe('sistema:existencias');
  });

  it('un cambio que no agota ni repone no hornea nada', async () => {
    await ponerStock(M, 4);
    const r = await pedir('/api/panel/v1/inventario/ajustar', {
      op: op(),
      variante: M,
      version: (await fila(M)).version,
      tipo: 'ajuste',
      cantidad: 1,
    });
    expect(r.status).toBe(200);
    expect(enCola).toHaveLength(0);
  });

  it('❌ CA2: con ks:tienda-horno apagado no se hornea, y la cotización igual no vende lo que no hay', async () => {
    flags = { get: async (k: string) => (k === 'ks:tienda-horno' ? 'apagado' : null) };
    const r = await pedir('/api/panel/v1/inventario/ajustar', {
      op: op(),
      variante: S,
      version: (await fila(S)).version,
      tipo: 'conteo',
      cantidad: 0,
    });
    expect(r.status).toBe(200);
    expect(enCola).toHaveLength(0);
    expect((await publicado(FICHA)).version).toBe(1);
    const c = await cotizar(shard, UNO, { lineas: [{ variante: S, cantidad: 1 }] }, AHORA);
    expect(c.carrito).toEqual([]);
    expect(c.avisos).toContainEqual({ codigo: 'linea_quitada', variante: S });
  });
});
