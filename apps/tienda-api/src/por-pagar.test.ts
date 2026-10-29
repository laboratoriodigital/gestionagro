/**
 * El pedido por pagar desde el panel (validación del sprint PF3): preguntarle a Bold por su pago,
 * cancelarlo cuando el pago venció sin pagarse, y el pago que llega tarde a un pedido cancelado.
 * Contra el shard local con Comercio Ensayo Uno y un Bold de mentira, como los links (HU-T11.8).
 */
import { createHmac } from 'node:crypto';
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { conTerminosAceptados } from './terminos.fixture.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const T0 = Date.parse('2026-10-19T15:00:00.000Z');
const AHORA = new Date(T0).toISOString();
const SECRETO = 'secreto-de-prueba-del-por-pagar';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'd'.repeat(64);
const HOST = 'ensayo-uno--staging.mitiendapro.co';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 83)).toString('base64');
const PERSONA = '0199e0a0-0000-7000-8000-0000000000f4';
const M = 'v-camisa-m-arena';
const minutos = (n: number) => new Date(T0 + n * 60_000).toISOString();

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

/** El Bold de mentira: lo que se le pidió, y lo que dice de cada link. */
const pedidasABold: { metodo: string; url: string; cuerpo: Record<string, unknown> | null }[] = [];
const boldCrea = true;
/** Sin respuesta de Bold a las consultas. */
let boldCaido = false;
const estadoDelLink = new Map<string, string>();
const boldFalso: typeof fetch = async (url, init) => {
  const metodo = init?.method ?? 'GET';
  pedidasABold.push({
    metodo,
    url: String(url),
    cuerpo: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
  });
  const u = String(url);
  if (boldCaido) return new Response('{}', { status: 502 });
  if (metodo === 'POST' && u.endsWith('/online/link/v1')) {
    if (!boldCrea) return new Response('{"errors":["caído"]}', { status: 502 });
    const n = pedidasABold.filter((p) => p.metodo === 'POST').length;
    return Response.json({
      payload: { payment_link: `LNK_${n}`, url: `https://checkout.bold.co/LNK_${n}` },
      errors: [],
    });
  }
  const link = u.match(/\/online\/link\/v1\/(LNK_\d+)$/)?.[1];
  if (link)
    return Response.json({
      id: link,
      status: estadoDelLink.get(link) ?? 'ACTIVE',
      total: 258000,
      transaction_id: `tx-${link}`,
    });
  return new Response('{}', { status: 404 });
};

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
    shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO),
    shard.prepare('UPDATE variante SET stock = 10 WHERE org_id = ? AND id = ?').bind(UNO, M),
  ]);
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

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
const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  tienda_control: control,
  SITIOS: sitios,
});
const app = (instante = AHORA) =>
  crearApp({
    ahora: () => Date.parse(instante),
    enSegundoPlano: () => undefined,
    fetch: boldFalso,
  });

/** Lo público, por el despacho. */
const publico = (
  ruta: string,
  cuerpo: string,
  instante = AHORA,
  extra: Record<string, string> = {},
) =>
  app(instante).request(
    `https://${HOST}${ruta}`,
    {
      method: 'POST',
      body: cuerpo,
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
        ...extra,
      },
    },
    env(),
  );
/** El panel, con un token del CORE recién entrado. */
const panel = async (ruta: string, cuerpo?: unknown, instante = AHORA) => {
  const { token } = await firmarAcceso(
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
      auth_time: Math.floor(Date.parse(instante) / 1000),
    },
    Date.parse(instante),
    2,
  );
  const r = await app(instante).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

/** Un pedido por WhatsApp, pendiente, con 2 camisas: su id. */
async function porElChat(codigo: string): Promise<string> {
  const r = await publico(
    '/api/v1/pedidos',
    JSON.stringify({
      codigo,
      lineas: [{ variante: M, cantidad: 2 }],
      forma: 'transferencia',
      acepta: true,
      terminos: TERMINOS,
      seguimiento: `seguimiento-${codigo}-xxxxxxxxx`.slice(0, 22),
      totalVisto: 258000,
    }),
  );
  expect(r.status, await r.clone().text()).toBe(200);
  const fila = await shard
    .prepare('SELECT id FROM pedido WHERE org_id = ? AND codigo = ?')
    .bind(UNO, codigo)
    .first<{ id: string }>();
  return fila?.id ?? '';
}

let ops = 0;
const op = () => `op-porpagar-${++ops}`.padEnd(16, '0');
const leer = (pedido: string) =>
  shard
    .prepare(
      'SELECT estado, forma_pago, version, total_cop FROM pedido WHERE org_id = ? AND id = ?',
    )
    .bind(UNO, pedido)
    .first<{ estado: string; forma_pago: string; version: number; total_cop: number }>();
const reservado = async () =>
  (await shard
    .prepare('SELECT reservado, stock FROM variante WHERE org_id = ? AND id = ?')
    .bind(UNO, M)
    .first<{ reservado: number; stock: number }>()) ?? { reservado: -1, stock: -1 };
const cobrarCon = async (pedido: string, extra: Record<string, unknown> = {}, instante = AHORA) =>
  panel(
    'pedidos/link',
    { op: op(), pedido, version: (await leer(pedido))?.version, ...extra },
    instante,
  );
const firmar = (cuerpo: string) =>
  createHmac('sha256', '').update(Buffer.from(cuerpo).toString('base64')).digest('hex');
const avisoAprobado = (referencia: string, pago: string) =>
  JSON.stringify({
    id: `aviso-${pago}`,
    type: 'SALE_APPROVED',
    subject: pago,
    data: {
      payment_id: pago,
      amount: { currency: 'COP', total: 258000 },
      metadata: { reference: referencia },
      payment_method: 'PSE',
    },
  });

const llaves = async () => {
  await conTerminosAceptados(shard, [UNO], AHORA);
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
};
const cobro = (pedido: string) =>
  shard
    .prepare('SELECT id, estado FROM cobro WHERE org_id = ? AND pedido_id = ? ORDER BY creado DESC')
    .bind(UNO, pedido)
    .first<{ id: string; estado: string }>();
/** Un cobro en línea como el del carrito: sin link, que Bold consulta por su referencia. */
const comoDelCarrito = (pedido: string) =>
  shard
    .prepare('UPDATE cobro SET link = NULL, link_url = NULL WHERE org_id = ? AND pedido_id = ?')
    .bind(UNO, pedido)
    .run();
const cancelar = async (pedido: string, instante: string) =>
  panel(
    'pedidos/cancelar',
    { op: op(), pedido, version: (await leer(pedido))?.version, volvio: false },
    instante,
  );

describe('el pedido por pagar desde el panel', () => {
  beforeAll(llaves);

  it('«Preguntarle a Bold»: mientras no hay pago sigue esperando; cuando Bold lo tiene, queda pagado', async () => {
    const pedido = await porElChat('EPP001');
    expect((await cobrarCon(pedido)).status).toBe(200);
    const visto = await panel(`pedidos/${pedido}`, undefined, minutos(1));
    expect(visto.cuerpo['pago']).toEqual({ estado: 'esperando', vence: minutos(60) });
    const espera = await panel('pedidos/preguntar', { pedido }, minutos(2));
    expect(espera.cuerpo).toEqual({ estado: 'ok', pago: 'esperando' });
    const link = pedidasABold.at(-1)?.url.match(/LNK_\d+$/)?.[0] ?? '';
    estadoDelLink.set(link, 'PAID');
    // Dentro de los 20 s no se le vuelve a preguntar.
    const pronto = pedidasABold.length;
    await panel(
      'pedidos/preguntar',
      { pedido },
      new Date(Date.parse(minutos(2)) + 5_000).toISOString(),
    );
    expect(pedidasABold.length).toBe(pronto);
    const pagado = await panel('pedidos/preguntar', { pedido }, minutos(3));
    expect(pagado.cuerpo).toEqual({ estado: 'ok', pago: 'pagado' });
    expect(await leer(pedido)).toMatchObject({ estado: 'pagado' });
    // Ya pagado, no hay a qué preguntar.
    expect((await panel('pedidos/preguntar', { pedido }, minutos(4))).cuerpo['pago']).toBe(
      'sin-cambio',
    );
  });

  it('❌ «Preguntarle a Bold» sin respuesta lo dice, y el pedido sigue igual', async () => {
    const pedido = await porElChat('EPP002');
    await cobrarCon(pedido);
    boldCaido = true;
    try {
      const r = await panel('pedidos/preguntar', { pedido }, minutos(2));
      expect(r.cuerpo).toEqual({ estado: 'ok', pago: 'sin-respuesta' });
    } finally {
      boldCaido = false;
    }
    expect(await leer(pedido)).toMatchObject({ estado: 'por_pagar' });
  });

  it('❌ con el pago en curso no se cancela; vencido, Bold no lo tiene y se cancela', async () => {
    const pedido = await porElChat('EPP003');
    await cobrarCon(pedido, { minutos: 15 });
    await comoDelCarrito(pedido);
    const antes = await reservado();
    const enCurso = await cancelar(pedido, minutos(10));
    expect(enCurso.status).toBe(422);
    expect(JSON.stringify(enCurso.cuerpo)).toMatch(/sigue en curso/);
    boldCaido = true;
    try {
      const sinBold = await cancelar(pedido, minutos(20));
      expect(sinBold.status).toBe(422);
      expect(JSON.stringify(sinBold.cuerpo)).toMatch(/Bold no respondió/);
    } finally {
      boldCaido = false;
    }
    expect(await leer(pedido)).toMatchObject({ estado: 'por_pagar' });
    const r = await cancelar(pedido, minutos(20));
    expect(r.status, JSON.stringify(r.cuerpo)).toBe(200);
    expect(await leer(pedido)).toMatchObject({ estado: 'cancelado' });
    expect(await cobro(pedido)).toMatchObject({ estado: 'vencido' });
    // Lo apartado se soltó y el inventario no se tocó.
    expect(await reservado()).toEqual({ reservado: antes.reservado - 2, stock: antes.stock });
  });

  it('un pago que llega tarde a un pedido cancelado queda a revisar, sin tocar el inventario', async () => {
    const pedido = await porElChat('EPP004');
    await cobrarCon(pedido, { minutos: 15 });
    await comoDelCarrito(pedido);
    expect((await cancelar(pedido, minutos(20))).status).toBe(200);
    const antes = await reservado();
    const aviso = avisoAprobado('EPP004-1', 'pago-tarde');
    const r = await publico('/api/v1/avisos/bold', aviso, minutos(30), {
      'x-bold-signature': firmar(aviso),
    });
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await leer(pedido)).toMatchObject({ estado: 'cancelado' });
    expect(await cobro(pedido)).toMatchObject({ estado: 'revisar' });
    expect(await reservado()).toEqual(antes);
    const visto = await panel(`pedidos/${pedido}`, undefined, minutos(31));
    expect(visto.cuerpo['pago']).toMatchObject({ estado: 'revisar' });
  });

  it('❌ un pedido pagado sigue sin cancelarse desde aquí', async () => {
    const pedido = await porElChat('EPP005');
    await cobrarCon(pedido);
    const aviso = avisoAprobado('EPP005-1', 'pago-a-tiempo');
    await publico('/api/v1/avisos/bold', aviso, minutos(5), { 'x-bold-signature': firmar(aviso) });
    expect(await leer(pedido)).toMatchObject({ estado: 'pagado' });
    const r = await cancelar(pedido, minutos(6));
    expect(r.status).toBe(422);
    expect(JSON.stringify(r.cuerpo)).toMatch(/reembolso/);
  });
});
