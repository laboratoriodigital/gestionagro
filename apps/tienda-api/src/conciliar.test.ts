/**
 * HU-T11.6: consultar a Bold y conciliar. Contra el shard local con Comercio Ensayo Uno: los cobros
 * nacen por `POST /api/v1/cobros` (HU-T11.4); Bold es un `fetch` de mentira que contesta la consulta
 * autenticada (`payment-voucher`) y cuenta las llamadas, y Telegram, otro que guarda el mensaje.
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
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CONCILIAR, conciliarTienda, respuestaDeLaConsulta } from './conciliar.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import type { EntornoDeTareas } from './tareas.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

/** Un Bold de mentira: a cada orden le contesta lo que diga `respuestas` (si no, 404). */
function bold(respuestas: Record<string, { estado: number; cuerpo?: unknown }> = {}) {
  const llamadas: { url: string; autorizacion: string | null }[] = [];
  const telegram: string[] = [];
  const fetchFalso = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    if (url.startsWith('https://api.telegram.org/')) {
      telegram.push(String(JSON.parse(String(init?.body)).text));
      return new Response('{"ok":true}', { status: 200 });
    }
    llamadas.push({ url, autorizacion: new Headers(init?.headers).get('authorization') });
    const orden = decodeURIComponent(url.split('/').at(-1) ?? '');
    const r = respuestas[orden] ?? respuestas['*'] ?? { estado: 404 };
    return new Response(JSON.stringify(r.cuerpo ?? {}), { status: r.estado });
  }) as typeof fetch;
  return { fetchFalso, llamadas, telegram };
}
const aprobado = (total = 129000) => ({
  estado: 200,
  cuerpo: { payment_status: 'APPROVED', total, transaction_id: 'tx-de-prueba' },
});
const pendiente = { estado: 200, cuerpo: { payment_status: 'PENDING' } };

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-16T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'c'.repeat(64);
const HOST = 'ensayo-uno--staging.laboratorio-digital.app';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 21)).toString('base64');
const SECRETA_PRODUCCION = 'secreta-de-produccion-0003';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const ajuste = (seccion: string, datos: unknown) =>
  shard
    .prepare(
      `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, ?, 1, ?, ?, 'sistema')
       ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos`,
    )
    .bind(UNO, seccion, JSON.stringify(datos), AHORA);

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
  const venta = ENSAYO_UNO.ajustes['venta'] as Record<string, unknown>;
  await shard.batch([
    shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO),
    shard
      .prepare("UPDATE variante SET stock = 100 WHERE org_id = ? AND id = 'v-camisa-m-arena'")
      .bind(UNO),
    ajuste('venta', { ...venta, modo: 'ambos' }),
  ]);
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  const dek = await dekDeCredenciales(shard, UNO, kek, AHORA);
  for (const [ambiente, campo, valor] of [
    ['pruebas', 'identidad', 'identidad-de-prueba-0001'],
    ['pruebas', 'secreta', 'secreta-de-prueba-0002'],
    ['produccion', 'identidad', 'identidad-de-produccion-0004'],
    ['produccion', 'secreta', SECRETA_PRODUCCION],
  ] as const) {
    await (
      await guardarCredencial(
        shard,
        dek,
        { org: UNO, proveedor: 'bold', ambiente, campo, valor },
        AHORA,
      )
    ).run();
  }
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
  SECRETO_DESPACHO: SECRETO,
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  tienda_control: control,
  SITIOS: sitios,
});
const pedir = (
  ruta: string,
  cuerpo: string,
  instante: string,
  fetchFalso: typeof fetch = bold().fetchFalso,
) =>
  crearApp({ ahora: () => Date.parse(instante), fetch: fetchFalso }).request(
    `https://${HOST}${ruta}`,
    {
      method: 'POST',
      body: cuerpo,
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    env(),
  );

const M = 'v-camisa-m-arena';
/** Un cobro de verdad, por la ruta de HU-T11.4. */
async function cobrar(codigo: string, variante = M, instante = AHORA) {
  const r = await pedir(
    '/api/v1/cobros',
    JSON.stringify({
      codigo,
      lineas: [{ variante, cantidad: 1 }],
      acepta: true,
      terminos: TERMINOS,
      seguimiento: `seguimiento-${codigo}-xxxxxxxxx`.slice(0, 22),
      token: `token-${codigo}-xxxxxxxxxxxxx`.slice(0, 22),
      totalVisto: 129000,
      entrega: { nombre: 'Ensayo Dos Compradora', celular: '3001234567' },
    }),
    instante,
  );
  expect(r.status, await r.clone().text()).toBe(200);
  return { cobro: `${codigo}-1`, token: `token-${codigo}-xxxxxxxxxxxxx`.slice(0, 22) };
}

const uno = async <T>(sql: string, ...v: unknown[]) =>
  (await shard
    .prepare(sql)
    .bind(...v)
    .first<T>()) as T;
const n = async (sql: string, ...v: unknown[]) => (await uno<{ n: number }>(sql, ...v)).n;
const estadoDe = (cobro: string) =>
  uno<{ cobro: string; pedido: string; atencion: string | null }>(
    `SELECT k.estado AS cobro, p.estado AS pedido, p.atencion FROM cobro k
       JOIN pedido p ON p.org_id = k.org_id AND p.id = k.pedido_id WHERE k.org_id = ? AND k.id = ?`,
    UNO,
    cobro,
  );
const varianteDe = (id: string) =>
  uno<{ stock: number | null; reservado: number }>(
    'SELECT stock, reservado FROM variante WHERE org_id = ? AND id = ?',
    UNO,
    id,
  );

const estadoEnLaPagina = (
  token: string,
  instante: string,
  f: ReturnType<typeof bold>,
  extra = {},
) => pedir('/api/v1/cobros/estado', JSON.stringify({ token, ...extra }), instante, f.fetchFalso);

const consultasDe = (cobro: string) =>
  uno<{ consultas: number; ultima_consulta: string | null; estado_proveedor: string | null }>(
    'SELECT consultas, ultima_consulta, estado_proveedor FROM cobro WHERE org_id = ? AND id = ?',
    UNO,
    cobro,
  );

const contexto = (instante: string) => ({
  db: shard,
  org: UNO,
  ahora: instante,
  kekTexto: KEK,
});

const mas = (instante: string, minutos: number) =>
  new Date(Date.parse(instante) + minutos * 60_000).toISOString();

// Cada prueba deja sin cobros esperando, para que la vuelta de la siguiente vea solo los suyos.
afterEach(async () => {
  await shard.batch([
    shard
      .prepare("UPDATE apartado SET estado = 'vencido' WHERE org_id = ? AND estado = 'activo'")
      .bind(UNO),
    shard
      .prepare("UPDATE cobro SET estado = 'vencido' WHERE org_id = ? AND estado = 'esperando'")
      .bind(UNO),
  ]);
});

describe('desde la página (HU-T11.6 CA1)', () => {
  it('pregunta a Bold con la identidad del ambiente y aplica: el pedido queda pagado', async () => {
    const { cobro, token } = await cobrar('CNC001');
    const antes = await varianteDe(M);
    const f = bold({ [cobro]: aprobado() });
    const r = await estadoEnLaPagina(token, mas(AHORA, 1), f);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: 'pagado', pedido: 'CNC001' });
    expect(f.llamadas).toEqual([
      {
        url: `https://payments.api.bold.co/v2/payment-voucher/${cobro}`,
        autorizacion: 'x-api-key identidad-de-prueba-0001',
      },
    ]);
    expect(await estadoDe(cobro)).toEqual({ cobro: 'aprobado', pedido: 'pagado', atencion: null });
    expect(await varianteDe(M)).toEqual({
      stock: (antes.stock ?? 0) - 1,
      reservado: antes.reservado - 1,
    });
    expect((await consultasDe(cobro)).consultas).toBe(1);
  });

  it('❌ como mucho una consulta a Bold cada 20 s por cobro; mientras, responde lo que hay', async () => {
    const { cobro, token } = await cobrar('CNC002');
    const f = bold({ [cobro]: pendiente });
    for (const segundos of [0, 10, 19]) {
      const r = await estadoEnLaPagina(
        token,
        new Date(Date.parse(AHORA) + 60_000 + segundos * 1000).toISOString(),
        f,
      );
      expect(await r.json()).toEqual({ estado: 'esperando', pedido: 'CNC002' });
    }
    expect(f.llamadas).toHaveLength(1);
    await estadoEnLaPagina(token, new Date(Date.parse(AHORA) + 60_000 + 20_000).toISOString(), f);
    expect(f.llamadas).toHaveLength(2);
    expect(await consultasDe(cobro)).toMatchObject({ consultas: 2, estado_proveedor: 'PENDING' });
  });

  it('❌ lo que traiga la vuelta del navegador no aprueba: sin noticias de Bold, sigue esperando', async () => {
    const { cobro, token } = await cobrar('CNC003');
    const f = bold();
    const r = await estadoEnLaPagina(token, mas(AHORA, 1), f, {
      estado: 'aprobado',
      'bold-tx-status': 'approved',
      'bold-order-id': cobro,
    });
    expect(await r.json()).toEqual({ estado: 'esperando', pedido: 'CNC003' });
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'esperando',
      pedido: 'por_pagar',
      atencion: null,
    });
    expect((await consultasDe(cobro)).estado_proveedor).toBe('NO_TRANSACTION_FOUND');
  });

  it('❌ un token que no es de ningún cobro: 404, sin preguntar a Bold', async () => {
    const f = bold({ '*': aprobado() });
    const r = await estadoEnLaPagina('token-que-no-existe-xx', mas(AHORA, 1), f);
    expect(r.status).toBe(404);
    expect(f.llamadas).toHaveLength(0);
  });

  it('si Bold falla, responde lo que hay y no mueve nada', async () => {
    const { cobro, token } = await cobrar('CNC004');
    const f = bold({ [cobro]: { estado: 500, cuerpo: { error: 'x' } } });
    const r = await estadoEnLaPagina(token, mas(AHORA, 1), f);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: 'esperando', pedido: 'CNC004' });
    expect((await estadoDe(cobro)).cobro).toBe('esperando');
  });
});

describe('la vuelta del cron (HU-T11.6 CA1 y CA2)', () => {
  it('consulta lo que espera desde hace más de 5 minutos, con espera de 5, 15, 30 y 60 minutos', async () => {
    const { cobro: viejo } = await cobrar('CNC005');
    const { cobro: nuevo } = await cobrar('CNC006', M, mas(AHORA, 3));
    const f = bold({ '*': pendiente });
    // A los 5 minutos: solo el viejo; el nuevo tiene 2.
    let v = await conciliarTienda(contexto(mas(AHORA, 5)), Date.parse(mas(AHORA, 5)), f.fetchFalso);
    expect(v).toMatchObject({ consultas: 1, movidos: 0, vencidos: 0 });
    expect(f.llamadas.map((l) => l.url.split('/').at(-1))).toEqual([viejo]);
    // A los 14 minutos de la consulta no toca el viejo (espera 15); el nuevo, sí.
    v = await conciliarTienda(contexto(mas(AHORA, 19)), Date.parse(mas(AHORA, 19)), f.fetchFalso);
    expect(f.llamadas.map((l) => l.url.split('/').at(-1))).toEqual([viejo, nuevo]);
    v = await conciliarTienda(contexto(mas(AHORA, 20)), Date.parse(mas(AHORA, 20)), f.fetchFalso);
    expect(f.llamadas.map((l) => l.url.split('/').at(-1))).toEqual([viejo, nuevo, viejo]);
    // Después de la tercera, 60 minutos.
    await conciliarTienda(contexto(mas(AHORA, 50)), Date.parse(mas(AHORA, 50)), f.fetchFalso);
    expect((await consultasDe(viejo)).consultas).toBe(3);
    await conciliarTienda(contexto(mas(AHORA, 109)), Date.parse(mas(AHORA, 109)), f.fetchFalso);
    expect((await consultasDe(viejo)).consultas).toBe(3);
    await conciliarTienda(contexto(mas(AHORA, 110)), Date.parse(mas(AHORA, 110)), f.fetchFalso);
    expect((await consultasDe(viejo)).consultas).toBe(4);
  });

  it('lo que Bold aprobó sin aviso queda pagado en la vuelta', async () => {
    const { cobro } = await cobrar('CNC007');
    const f = bold({ [cobro]: aprobado() });
    const v = await conciliarTienda(
      contexto(mas(AHORA, 6)),
      Date.parse(mas(AHORA, 6)),
      f.fetchFalso,
    );
    expect(v).toMatchObject({ consultas: 1, movidos: 1 });
    expect(await estadoDe(cobro)).toEqual({ cobro: 'aprobado', pedido: 'pagado', atencion: null });
  });

  it('❌ como mucho 20 consultas por tienda por vuelta', async () => {
    for (let i = 0; i < 22; i++) await cobrar(`CNK${String(i).padStart(3, '0')}`);
    const f = bold({ '*': pendiente });
    const v = await conciliarTienda(
      contexto(mas(AHORA, 6)),
      Date.parse(mas(AHORA, 6)),
      f.fetchFalso,
    );
    expect(v.consultas).toBe(20);
    expect(f.llamadas).toHaveLength(20);
  });

  it('❌ a las 24 h sin noticias, vencido: el pedido sigue por pagar y nada se le pregunta a Bold', async () => {
    const { cobro } = await cobrar('CNC008');
    const f = bold({ '*': pendiente });
    const despues = mas(AHORA, 24 * 60);
    const v = await conciliarTienda(contexto(despues), Date.parse(despues), f.fetchFalso);
    expect(v).toMatchObject({ vencidos: 1, consultas: 0 });
    expect(f.llamadas).toHaveLength(0);
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'vencido',
      pedido: 'por_pagar',
      atencion: null,
    });
    expect(
      await n(
        "SELECT COUNT(*) AS n FROM apartado WHERE org_id = ? AND cobro_id = ? AND estado = 'activo'",
        UNO,
        cobro,
      ),
    ).toBe(0);
    expect(
      await n(
        `SELECT COUNT(*) AS n FROM pedido_evento WHERE org_id = ? AND tipo = 'pago'
           AND json_extract(detalle, '$.cobro') = ? AND json_extract(detalle, '$.resultado') = 'vencido'`,
        UNO,
        cobro,
      ),
    ).toBe(1);
  });

  it('❌ un 429 salta la tienda en esa vuelta, y la tarea avisa por Telegram', async () => {
    const { cobro: primero } = await cobrar('CNC009');
    const { cobro: segundo } = await cobrar('CNC010');
    const f = bold({ '*': { estado: 429, cuerpo: { error: 'too many requests' } } });
    const entorno: EntornoDeTareas = {
      celda: 'c1',
      shards: [['tienda_c1_s1', shard]],
      control,
      hosts: { get: async () => null, put: async () => undefined },
      flags: { get: async () => null, put: async () => undefined },
      telegram: { token: 'token-de-prueba', chat: 'chat-de-prueba' },
      kekTexto: KEK,
      fetch: f.fetchFalso,
    };
    const resumen = await CONCILIAR.correr(entorno, Date.parse(mas(AHORA, 6)));
    expect(resumen).toContain('1 tiendas saltadas por 429');
    expect(f.llamadas).toHaveLength(1);
    expect((await consultasDe(primero)).consultas).toBe(0);
    expect((await consultasDe(segundo)).consultas).toBe(0);
    expect(f.telegram).toEqual([
      `Tienda · Bold respondió 429 y se saltó la conciliación de 1 tienda(s) en esta vuelta:\ntienda_c1_s1/${UNO}`,
    ]);
  });
});

describe('lo que dice la consulta (HU-T11.6 CA3)', () => {
  it('NO_TRANSACTION_FOUND, PENDING y un estado que nadie leyó siguen esperando; VOIDED es reembolso', () => {
    const e = (crudo: string, estado: 'aprobado' | 'rechazado' | 'esperando' | 'revisar') => ({
      estado,
      crudo,
      total: 129000,
      transaccion: 'tx',
    });
    expect(respuestaDeLaConsulta(e('NO_TRANSACTION_FOUND', 'esperando'))).toBeNull();
    expect(respuestaDeLaConsulta(e('PENDING', 'esperando'))).toBeNull();
    expect(respuestaDeLaConsulta(e('ALGO_NUEVO', 'revisar'))).toBeNull();
    expect(respuestaDeLaConsulta(e('VOIDED', 'rechazado'))?.tipo).toBe('anulado');
    expect(respuestaDeLaConsulta(e('FAILED', 'rechazado'))?.tipo).toBe('rechazado');
    expect(respuestaDeLaConsulta(e('APPROVED', 'aprobado'))?.tipo).toBe('aprobado');
  });
});
