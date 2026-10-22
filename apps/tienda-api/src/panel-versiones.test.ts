/**
 * Las versiones y «Volver a esta» por la API del panel (HU-T10.4), contra el shard y la base de
 * control locales, con un almacén y un KV de mentira que comparten la API y el despacho. Volver
 * mueve el puntero sin hornear; las existencias de ahora llegan después, en segundo plano.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearDespacho, type Env as EnvDelSitio } from '../../tienda-sitio/src/worker.ts';
import { type Almacen, publicar } from './publicar.ts';
import { conTerminosAceptados } from './terminos.fixture.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-de-las-versiones';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d3';
const UNO = ENSAYO_UNO.org;
const HOST = hostDeStaging(ENSAYO_UNO.slug);

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];
let firmante: Firmante;

const objetos = new Map<string, string>();
const hosts = new Map<string, string>();
let escrituras = 0;
/** Mientras está cerrada, lo que escribe el segundo plano espera: se ve qué hizo la solicitud sola. */
let puerta: Promise<void> = Promise.resolve();
let abrir: () => void = () => undefined;
const cerrarLaPuerta = () => {
  puerta = new Promise((r) => {
    abrir = r;
  });
};
const sitios: Almacen = {
  get: async (clave) => {
    const t = objetos.get(clave);
    return t === undefined ? null : { text: async () => t };
  },
  put: async (clave, valor) => {
    await puerta;
    escrituras++;
    objetos.set(clave, valor);
  },
};
/** Lo que la API deja para después, abriendo la puerta. */
const terminarElSegundoPlano = async () => {
  abrir();
  await Promise.all(pendientes.splice(0));
};
const kv = { put: async (k: string, v: string) => void hosts.set(k, v) };

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  const c = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  shard = s.db;
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  // HU-T7.2: estas pruebas vuelven a versiones; la aceptación la prueba terminos.test.ts.
  await conTerminosAceptados(shard, [ENSAYO_UNO.org, ENSAYO_DOS.org], AHORA);
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
  SITIOS: sitios,
  TIENDA_HOSTS: kv,
  VITRINA_RELEASE: 'r1',
  tienda_c1_s1: shard,
  tienda_control: control,
});

const token = async () =>
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
      },
      T0,
      2,
    )
  ).token;

const pendientes: Promise<unknown>[] = [];
const pedir = async (ruta: string, cuerpo?: unknown) =>
  crearApp({ ahora: () => T0, enSegundoPlano: (t) => void pendientes.push(t) }).request(
    ruta,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${await token()}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );

/** Publicar como lo hace el botón, sin la falla de las fotos de los comercios de prueba. */
const publicarAhora = () =>
  publicar({
    shard,
    shardNombre: 'tienda_c1_s1',
    control,
    sitios,
    hosts: kv,
    celda: 'c1',
    release: 'r1',
    org: UNO,
    pedidaPor: `usuario:${PERSONA}`,
    ahora: AHORA,
    omitir: ['sin-foto'],
  });

const ajustar = (sql: string) => shard.prepare(sql.replace('$ORG', '?')).bind(UNO).run();
const puntero = () => (JSON.parse(hosts.get(`h:${HOST}`) ?? '{}') as { version?: number }).version;

interface Version {
  version: number;
  estado: string;
  autor: string;
  automatica: boolean;
  archivos: number | null;
  publicada: string | null;
}

describe('versiones y «Volver a esta» (HU-T10.4)', () => {
  it('CA2: la lista dice fecha, autor y estado; volver mueve el puntero sin hornear', async () => {
    expect(await publicarAhora()).toMatchObject({ estado: 'publicada', version: 1 });
    await ajustar(
      "UPDATE variante SET precio_cop = 135000, cambio_motivo = 'ajuste' WHERE org_id = $ORG AND producto_id = 'p-camisa'",
    );
    expect(await publicarAhora()).toMatchObject({ estado: 'publicada', version: 2 });

    const lista = (await (await pedir('/api/panel/v1/publicaciones')).json()) as {
      versionPublicada: number;
      versiones: Version[];
    };
    expect(lista.versionPublicada).toBe(2);
    expect(lista.versiones.map((v) => [v.version, v.estado, v.autor])).toEqual([
      [2, 'publicada', 'Tú'],
      [1, 'reemplazada', 'Tú'],
    ]);
    expect(lista.versiones[0]).toMatchObject({ publicada: AHORA, automatica: false });
    expect(lista.versiones[0]?.archivos).toBeGreaterThan(0);

    const antes = escrituras;
    cerrarLaPuerta();
    const r = await pedir('/api/panel/v1/publicaciones/volver', { version: 1 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: 'publicada', version: 1, antes: 2 });
    // Sin hornear: ni un archivo nuevo en el almacén antes de responder, y el puntero ya cambió.
    expect(escrituras).toBe(antes);
    expect(puntero()).toBe(1);
    // Con la M igual que en la versión 1, poner al día las existencias no cambia nada.
    await terminarElSegundoPlano();
    const ahora = (await (await pedir('/api/panel/v1/publicaciones')).json()) as {
      versionPublicada: number;
      versiones: Version[];
    };
    expect(ahora.versionPublicada).toBe(1);
    expect(ahora.versiones.map((v) => [v.version, v.estado])).toEqual([
      [2, 'reemplazada'],
      [1, 'publicada'],
    ]);
    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas[0]?.frase).toBe('Tú volviste la tienda a la versión 1');
  });

  it('❌ CA3: volver no deshace pedidos ni inventario, y la vitrina lo muestra antes de 60 s', async () => {
    // Una venta después de publicar: la M se agota. Volver a la 2 no la devuelve.
    await ajustar(
      "UPDATE variante SET stock = 0, cambio_motivo = 'ajuste' WHERE org_id = $ORG AND id = 'v-camisa-m-arena'",
    );
    const inventario = async () =>
      (
        await shard
          .prepare('SELECT id, stock FROM variante WHERE org_id = ? ORDER BY id')
          .bind(UNO)
          .all()
      ).results;
    const pedidos = async () =>
      (
        await shard
          .prepare('SELECT count(*) AS n FROM pedido WHERE org_id = ?')
          .bind(UNO)
          .first<{ n: number }>()
      )?.n;
    const stockAntes = await inventario();
    const pedidosAntes = await pedidos();

    // El despacho ya vio la tienda: tiene el host en su caché de 30 s.
    let reloj = T0;
    const despacho = crearDespacho({ ahora: () => reloj });
    const envSitio: EnvDelSitio = {
      TIENDA_HOSTS: { get: async (clave: string) => hosts.get(clave) ?? null },
      SITIOS_C1: sitios,
      SECRETO_DESPACHO: SECRETO,
    };
    const ficha = async () =>
      (await despacho.fetch(new Request(`https://${HOST}/p/camisa-de-lino/`), envSitio)).text();
    expect(await ficha()).toContain('129.000');

    cerrarLaPuerta();
    const r = await pedir('/api/panel/v1/publicaciones/volver', { version: 2 });
    expect(await r.json()).toMatchObject({ estado: 'publicada', version: 2 });
    expect(await inventario()).toEqual(stockAntes);
    expect(await pedidos()).toBe(pedidosAntes);

    reloj = T0 + 31_000;
    expect(await ficha()).toContain('135.000');

    // Las existencias de ahora llegan después: la versión que sirve la tienda dice que la M se agotó.
    await terminarElSegundoPlano();
    const publicada = puntero() as number;
    expect(publicada).toBeGreaterThan(2);
    const datos = JSON.parse(objetos.get(`sitios/${UNO}/${publicada}/datos.json`) ?? '{}') as {
      datos: { productos: { variantes: { id: string; stock: number | null }[] }[] };
    };
    const m = datos.datos.productos
      .flatMap((p) => p.variantes)
      .find((v) => v.id === 'v-camisa-m-arena');
    expect(m?.stock).toBe(0);
    const lista = (await (await pedir('/api/panel/v1/publicaciones')).json()) as {
      versiones: Version[];
    };
    expect(lista.versiones[0]).toMatchObject({
      version: publicada,
      estado: 'publicada',
      autor: 'La tienda',
      automatica: true,
    });
  });

  it('❌ no vuelve a una que no existe ni a una fallida; a la de ahora, «ya está»; con otra en curso, espera', async () => {
    expect((await pedir('/api/panel/v1/publicaciones/volver', { version: 99 })).status).toBe(404);
    await shard
      .prepare(
        "INSERT INTO publicacion (org_id, version, estado, motivo, pedida_por, pedida) VALUES (?, 90, 'fallida', 'x', 'usuario:x', ?)",
      )
      .bind(UNO, AHORA)
      .run();
    expect((await pedir('/api/panel/v1/publicaciones/volver', { version: 90 })).status).toBe(404);
    const actual = puntero() as number;
    const ya = await pedir('/api/panel/v1/publicaciones/volver', { version: actual });
    expect(await ya.json()).toEqual({ estado: 'ya-esta', version: actual });
    await shard
      .prepare(
        "INSERT INTO publicacion (org_id, version, estado, pedida_por, pedida) VALUES (?, 91, 'horneando', 'usuario:x', ?)",
      )
      .bind(UNO, AHORA)
      .run();
    expect((await pedir('/api/panel/v1/publicaciones/volver', { version: 1 })).status).toBe(409);
    expect(puntero()).toBe(actual);
    expect((await pedir('/api/panel/v1/publicaciones/volver', { version: 'una' })).status).toBe(
      422,
    );
  });
});
