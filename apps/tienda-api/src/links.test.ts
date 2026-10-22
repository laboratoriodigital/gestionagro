/**
 * HU-T11.8: los links de pago para el pedido que llegó por el chat. Contra el shard local con
 * Comercio Ensayo Uno: el pedido nace por WhatsApp (HU-T6.1), el comercio lo cobra con un link desde
 * el panel, y Bold es de mentira: crea links, dice su estado y firma avisos con la llave de pruebas.
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
import { conciliarTienda } from './conciliar.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { conTerminosAceptados } from './terminos.fixture.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const T0 = Date.parse('2026-10-19T15:00:00.000Z');
const AHORA = new Date(T0).toISOString();
const SECRETO = 'secreto-de-prueba-de-los-links';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'd'.repeat(64);
const HOST = 'ensayo-uno--staging.mitiendapro.co';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 61)).toString('base64');
const PERSONA = '0199e0a0-0000-7000-8000-0000000000e3';
const M = 'v-camisa-m-arena';
const minutos = (n: number) => new Date(T0 + n * 60_000).toISOString();

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

/** El Bold de mentira: lo que se le pidió, y lo que dice de cada link. */
const pedidasABold: { metodo: string; url: string; cuerpo: Record<string, unknown> | null }[] = [];
let boldCrea = true;
const estadoDelLink = new Map<string, string>();
const boldFalso: typeof fetch = async (url, init) => {
  const metodo = init?.method ?? 'GET';
  pedidasABold.push({
    metodo,
    url: String(url),
    cuerpo: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null,
  });
  const u = String(url);
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
const op = () => `op-links-${++ops}`.padEnd(16, '0');
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

describe('los links de pago (HU-T11.8)', () => {
  it('❌ sin los términos ni las llaves de Bold, no se cobra con link y el pedido sigue igual', async () => {
    const pedido = await porElChat('ENC001');
    const sinTerminos = await cobrarCon(pedido);
    expect(sinTerminos.status).toBe(403);
    expect(sinTerminos.cuerpo['estado']).toBe('sin-terminos');
    await conTerminosAceptados(shard, [UNO], AHORA);
    const sinLlaves = await cobrarCon(pedido);
    expect(sinLlaves.status).toBe(409);
    expect(sinLlaves.cuerpo['estado']).toBe('sin-llaves');
    expect(await leer(pedido)).toMatchObject({ estado: 'pendiente', forma_pago: 'transferencia' });
    expect(pedidasABold).toEqual([]);
    // Las llaves de pruebas, para lo que sigue.
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
  });

  it('CA1: el pedido pasa a en línea y por pagar, sus unidades se apartan 60 minutos y sale el mensaje con el link', async () => {
    const pedido = await porElChat('ENC002');
    const antes = await reservado();
    const r = await cobrarCon(pedido);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({
      estado: 'guardado',
      link: 'https://checkout.bold.co/LNK_1',
      vence: minutos(60),
    });
    expect(String(r.cuerpo['mensaje'])).toMatch(
      /pagar tu pedido #\d+ de Comercio Ensayo Uno, por \$258\.000: https:\/\/checkout\.bold\.co\/LNK_1\nSirve hasta las 11:00 a\. m\.$/,
    );
    expect(await leer(pedido)).toMatchObject({ estado: 'por_pagar', forma_pago: 'en_linea' });
    expect((await reservado()).reservado).toBe(antes.reservado + 2);
    // A Bold: monto cerrado, la referencia del cobro y el vencimiento.
    expect(pedidasABold.at(-1)?.cuerpo).toMatchObject({
      amount_type: 'CLOSE',
      amount: { total_amount: 258000 },
      reference: 'ENC002-1',
      expiration_date: Date.parse(minutos(60)) * 1_000_000,
    });
    const cobro = await shard
      .prepare(
        'SELECT id, estado, ambiente, link, link_url, vence FROM cobro WHERE org_id = ? AND pedido_id = ?',
      )
      .bind(UNO, pedido)
      .first();
    expect(cobro).toEqual({
      id: 'ENC002-1',
      estado: 'esperando',
      ambiente: 'pruebas',
      link: 'LNK_1',
      link_url: 'https://checkout.bold.co/LNK_1',
      vence: minutos(60),
    });
    // El panel lo muestra para volver a mandarlo.
    const visto = await panel(`pedidos/${pedido}`, undefined, minutos(5));
    // El mismo mensaje del cobro: al recargar el pedido, el panel no arma otro.
    expect(visto.cuerpo['link']).toEqual({
      url: 'https://checkout.bold.co/LNK_1',
      vence: minutos(60),
      mensaje: r.cuerpo['mensaje'],
    });
  });

  it('❌ CA1: más de 24 horas, un pedido que ya no está pendiente o Bold caído: nada cambia', async () => {
    const pedido = await porElChat('ENC003');
    const largo = await cobrarCon(pedido, { minutos: 24 * 60 + 1 });
    expect(largo.status).toBe(422);
    expect(JSON.stringify(largo.cuerpo['problemas'])).toMatch(/24 horas/);
    boldCrea = false;
    try {
      const caido = await cobrarCon(pedido);
      expect(caido.status).toBe(503);
      expect(caido.cuerpo['estado']).toBe('sin-respuesta');
    } finally {
      boldCrea = true;
    }
    expect(await leer(pedido)).toMatchObject({ estado: 'pendiente', forma_pago: 'transferencia' });
    expect(
      (
        await shard
          .prepare('SELECT count(*) AS n FROM cobro WHERE org_id = ? AND pedido_id = ?')
          .bind(UNO, pedido)
          .first<{ n: number }>()
      )?.n,
    ).toBe(0);
    expect((await cobrarCon(pedido, { minutos: 15 })).status).toBe(200);
    const otraVez = await cobrarCon(pedido);
    expect(otraVez.status).toBe(422);
    expect(JSON.stringify(otraVez.cuerpo['problemas'])).toMatch(/Solo un pedido pendiente/);
  });

  it('❌ CA2: vencido sin pago, lo apartado se libera y el pedido vuelve a pendiente, a convenir', async () => {
    const pedido = await porElChat('ENC004');
    const antes = await reservado();
    const r = await cobrarCon(pedido, { minutos: 30 });
    const link = String(r.cuerpo['link']).split('/').at(-1) ?? '';
    expect((await reservado()).reservado).toBe(antes.reservado + 2);
    // Antes de vencer, abrir el pedido no lo toca.
    await panel(`pedidos/${pedido}`, undefined, minutos(29));
    expect((await leer(pedido))?.estado).toBe('por_pagar');
    // Vencido: la última pregunta a Bold dice que nadie pagó.
    estadoDelLink.set(link, 'EXPIRED');
    const visto = await panel(`pedidos/${pedido}`, undefined, minutos(31));
    expect(visto.cuerpo['link']).toBeNull();
    expect(await leer(pedido)).toMatchObject({ estado: 'pendiente', forma_pago: 'a_convenir' });
    expect((await reservado()).reservado).toBe(antes.reservado);
    expect(
      await shard
        .prepare('SELECT estado FROM cobro WHERE org_id = ? AND pedido_id = ?')
        .bind(UNO, pedido)
        .first(),
    ).toEqual({ estado: 'vencido' });
    // Y se puede mandar otro link: es otro intento, con otra referencia.
    const otro = await cobrarCon(pedido, {}, minutos(32));
    expect(otro.status).toBe(200);
    expect(pedidasABold.at(-1)?.cuerpo?.['reference']).toBe('ENC004-2');
  });

  it('CA2: si se pagó justo antes de vencer, la última pregunta lo aprueba en vez de vencerlo', async () => {
    const pedido = await porElChat('ENC005');
    const r = await cobrarCon(pedido, { minutos: 15 });
    const link = String(r.cuerpo['link']).split('/').at(-1) ?? '';
    estadoDelLink.set(link, 'PAID');
    const vuelta = await conciliarTienda(
      { db: shard, org: UNO, ahora: minutos(16), kekTexto: KEK },
      Date.parse(minutos(16)),
      boldFalso,
    );
    // Venció uno: el de ENC003, de 15 minutos, que nadie pagó. El de ENC005 se pagó.
    expect(vuelta.vencidos).toBe(1);
    expect(
      await shard
        .prepare("SELECT estado FROM cobro WHERE org_id = ? AND id = 'ENC003-1'")
        .bind(UNO)
        .first(),
    ).toEqual({ estado: 'vencido' });
    expect(await leer(pedido)).toMatchObject({ estado: 'pagado', forma_pago: 'en_linea' });
  });

  it('❌ CA2: un link pagado dos veces no cuenta dos pagos ni descuenta dos veces', async () => {
    const pedido = await porElChat('ENC006');
    await cobrarCon(pedido);
    const antes = await reservado();
    const primero = avisoAprobado('ENC006-1', 'pago-uno');
    const r1 = await publico('/api/v1/avisos/bold', primero, minutos(10), {
      'x-bold-signature': firmar(primero),
    });
    expect(await r1.json()).toEqual({ resultado: 'aplicado' });
    // El mismo aviso otra vez, y otro pago sobre el mismo link.
    const r2 = await publico('/api/v1/avisos/bold', primero, minutos(11), {
      'x-bold-signature': firmar(primero),
    });
    expect(await r2.json()).toEqual({ resultado: 'repetido' });
    const segundo = avisoAprobado('ENC006-1', 'pago-dos');
    const r3 = await publico('/api/v1/avisos/bold', segundo, minutos(12), {
      'x-bold-signature': firmar(segundo),
    });
    expect(await r3.json()).toEqual({ resultado: 'ignorado' });
    expect(await leer(pedido)).toMatchObject({ estado: 'pagado' });
    const despues = await reservado();
    expect(despues.stock).toBe(antes.stock - 2);
    expect(despues.reservado).toBe(antes.reservado - 2);
    expect(
      (
        await shard
          .prepare(
            "SELECT count(*) AS n FROM pedido_evento WHERE org_id = ? AND pedido_id = ? AND tipo = 'pago'",
          )
          .bind(UNO, pedido)
          .first<{ n: number }>()
      )?.n,
    ).toBe(1);
  });

  it('el registro lo cuenta en una frase', async () => {
    const r = await panel('registro');
    const frases = (r.cuerpo['filas'] as { frase: string }[]).map((f) => f.frase);
    expect(frases).toContain('Tú mandaste un link de pago del pedido #1002, por 60 minutos');
  });
});
