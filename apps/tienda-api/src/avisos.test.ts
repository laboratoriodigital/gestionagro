/**
 * HU-T11.5: los avisos firmados de Bold. Contra el shard local con Comercio Ensayo Uno: los cobros
 * nacen por `POST /api/v1/cobros` (HU-T11.4) y los avisos llegan por `POST /api/v1/avisos/bold`,
 * firmados aquí con `node:crypto`, que sí acepta la llave vacía: es otra implementación que la de
 * la API, que usa WebCrypto con 64 bytes en cero.
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { firmaValida } from './avisos.ts';
import { listarPedidos } from './bandeja.ts';
import { despacharPedido } from './ciclo.ts';
import { conciliarTienda } from './conciliar.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

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
      .prepare("UPDATE variante SET stock = 10 WHERE org_id = ? AND id = 'v-camisa-m-arena'")
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
  extra: Record<string, string> = {},
) =>
  crearApp({ ahora: () => Date.parse(instante) }).request(
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

const M = 'v-camisa-m-arena';
const S = 'v-camisa-s-arena';
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
  return `${codigo}-1`;
}

const firmar = (cuerpo: string, llave = '') =>
  createHmac('sha256', llave).update(Buffer.from(cuerpo).toString('base64')).digest('hex');

const avisoDe = (
  tipo: string,
  referencia: string,
  total = 129000,
  subject = `pago-${referencia}`,
) =>
  JSON.stringify({
    id: `aviso-${tipo}-${referencia}`,
    type: tipo,
    subject,
    source: '/payments',
    spec_version: '1.0',
    time: 1792162800000000000,
    data: {
      payment_id: subject,
      merchant_id: 'COMERCIO-ENSAYO',
      created_at: '2026-10-16T10:05:00-05:00',
      amount: { currency: 'COP', total, taxes: [], tip: 0 },
      metadata: { reference: referencia },
      payment_method: 'PSE',
    },
    datacontenttype: 'application/json',
  });
const avisar = (cuerpo: string, firma = firmar(cuerpo), instante = '2026-10-16T15:05:00.000Z') =>
  pedir('/api/v1/avisos/bold', cuerpo, instante, { 'x-bold-signature': firma });

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

describe('la firma (HU-T11.5 CA1 y CA2)', () => {
  it('en pruebas, la llave vacía son 64 bytes en cero: el vector calculado aparte coincide', async () => {
    const cuerpo = new TextEncoder().encode('{"type":"SALE_APPROVED"}');
    // hmac.new(b'', base64(cuerpo), sha256) en Python.
    const vector = '61a3a89b2335e598b591a8f5985c449fe79a0e48ec783bb56175195a6076f792';
    expect(await firmaValida(null, cuerpo, vector)).toBe(true);
    expect(firmar('{"type":"SALE_APPROVED"}')).toBe(vector);
    expect(await firmaValida('otra', cuerpo, vector)).toBe(false);
    expect(await firmaValida(null, cuerpo, vector.toUpperCase())).toBe(false);
  });
});

describe('un pago aprobado (HU-T11.5)', () => {
  it('aprobado por el monto: el pedido queda pagado, el inventario sale una vez y lo apartado se consume', async () => {
    const cobro = await cobrar('AVS001');
    const antes = await varianteDe(M);
    const cuerpo = avisoDe('SALE_APPROVED', cobro);
    const r = await avisar(cuerpo);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await estadoDe(cobro)).toEqual({ cobro: 'aprobado', pedido: 'pagado', atencion: null });
    expect(await varianteDe(M)).toEqual({
      stock: (antes.stock ?? 0) - 1,
      reservado: antes.reservado - 1,
    });
    expect(
      await uno('SELECT transaccion, medio FROM cobro WHERE org_id = ? AND id = ?', UNO, cobro),
    ).toEqual({ transaccion: `pago-${cobro}`, medio: 'PSE' });
    expect(
      await n(
        "SELECT COUNT(*) AS n FROM movimiento_inventario WHERE org_id = ? AND variante_id = ? AND motivo = 'venta'",
        UNO,
        M,
      ),
    ).toBe(1);

    // CA3: el mismo aviso otra vez no descuenta de nuevo ni repite el historial.
    const otra = await avisar(cuerpo, firmar(cuerpo), '2026-10-16T15:20:00.000Z');
    expect(await otra.json()).toEqual({ resultado: 'repetido' });
    expect((await varianteDe(M)).stock).toBe((antes.stock ?? 0) - 1);
    expect(
      await n(
        "SELECT COUNT(*) AS n FROM pedido_evento e JOIN cobro k ON k.org_id = e.org_id AND k.pedido_id = e.pedido_id WHERE e.org_id = ? AND k.id = ? AND e.tipo = 'pago'",
        UNO,
        cobro,
      ),
    ).toBe(1);
  });

  it('por otro monto queda a revisar, con lo apartado todavía apartado', async () => {
    const cobro = await cobrar('AVS002');
    const r = await avisar(avisoDe('SALE_APPROVED', cobro, 1000));
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'revisar',
      pedido: 'por_pagar',
      atencion: 'monto',
    });
    expect(
      await uno('SELECT estado FROM apartado WHERE org_id = ? AND cobro_id = ?', UNO, cobro),
    ).toEqual({ estado: 'activo' });
  });

  it('rechazado: lo apartado vuelve y el pedido queda pendiente', async () => {
    const cobro = await cobrar('AVS003');
    const antes = await varianteDe(M);
    expect(await (await avisar(avisoDe('SALE_REJECTED', cobro))).json()).toEqual({
      resultado: 'aplicado',
    });
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'rechazado',
      pedido: 'pendiente',
      atencion: null,
    });
    expect(await varianteDe(M)).toEqual({ stock: antes.stock, reservado: antes.reservado - 1 });
  });

  it('una anulación que llega antes que su venta queda guardada y se aplica al llegar la venta', async () => {
    const cobro = await cobrar('AVS004');
    expect(await (await avisar(avisoDe('VOID_APPROVED', cobro))).json()).toEqual({
      resultado: 'ignorado',
    });
    expect((await estadoDe(cobro)).cobro).toBe('esperando');
    expect(await (await avisar(avisoDe('SALE_APPROVED', cobro))).json()).toEqual({
      resultado: 'aplicado',
    });
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'reembolsado',
      pedido: 'pagado',
      atencion: null,
    });
    expect(
      await n(
        "SELECT COUNT(*) AS n FROM aviso_proveedor WHERE org_id = ? AND cobro_id = ? AND resultado = 'aplicado'",
        UNO,
        cobro,
      ),
    ).toBe(2);
  });

  it('aprobado tarde y sin unidades: pagado sin existencias, sin tocar el inventario', async () => {
    const primero = await cobrar('AVS005', S);
    // Pasan los 15 minutos; otro compra la última y paga.
    const otro = await cobrar('AVS006', S, '2026-10-16T15:20:00.000Z');
    await avisar(avisoDe('SALE_APPROVED', otro), undefined, '2026-10-16T15:21:00.000Z');
    expect(await varianteDe(S)).toEqual({ stock: 0, reservado: 0 });
    const r = await avisar(
      avisoDe('SALE_APPROVED', primero),
      undefined,
      '2026-10-16T15:30:00.000Z',
    );
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await estadoDe(primero)).toEqual({
      cobro: 'aprobado_sin_existencias',
      pedido: 'pagado',
      atencion: 'sin_existencias',
    });
    expect(await varianteDe(S)).toEqual({ stock: 0, reservado: 0 });
  });
});

describe('cada respuesta de Bold, con su camino (HU-T11.7)', () => {
  it('aprobado después de vencer, con unidades: igual que a tiempo, desde vencido (CA1)', async () => {
    const cobro = await cobrar('RSP001');
    const antes = await varianteDe(M);
    const despues = '2026-10-17T15:00:00.000Z';
    await conciliarTienda(
      { db: shard, org: UNO, ahora: despues, kekTexto: KEK },
      Date.parse(despues),
      fetch,
    );
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'vencido',
      pedido: 'por_pagar',
      atencion: null,
    });
    const r = await avisar(avisoDe('SALE_APPROVED', cobro), undefined, '2026-10-17T15:10:00.000Z');
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await estadoDe(cobro)).toEqual({ cobro: 'aprobado', pedido: 'pagado', atencion: null });
    expect((await varianteDe(M)).stock).toBe((antes.stock ?? 0) - 1);
  });

  it('anulación aprobada después del pago: reembolsado, y el pedido lo mueve el comercio (CA1)', async () => {
    const cobro = await cobrar('RSP002');
    await avisar(avisoDe('SALE_APPROVED', cobro));
    const r = await avisar(avisoDe('VOID_APPROVED', cobro), undefined, '2026-10-16T16:00:00.000Z');
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await estadoDe(cobro)).toEqual({
      cobro: 'reembolsado',
      pedido: 'pagado',
      atencion: null,
    });
  });

  it('«Pagado sin existencias» va arriba con su fecha; despacharlo pide reponer y entonces descuenta (CA2)', async () => {
    const quien = (instante: string) => ({
      db: shard,
      org: UNO,
      actor: 'usuario:ensayo-uno',
      instante,
    });
    // Otro pedido con atención, más nuevo: el pagado sin existencias va antes.
    const otroMonto = await cobrar('RSP003', M, '2026-10-16T15:40:00.000Z');
    await avisar(avisoDe('SALE_APPROVED', otroMonto, 1000), undefined, '2026-10-16T15:41:00.000Z');
    const { results } = await shard
      .prepare(
        "SELECT p.id, p.version, k.actualizado FROM pedido p JOIN cobro k ON k.org_id = p.org_id AND k.pedido_id = p.id WHERE p.org_id = ? AND k.estado = 'aprobado_sin_existencias'",
      )
      .bind(UNO)
      .all<{ id: string; version: number; actualizado: string }>();
    const sinExistencias = results[0];
    if (!sinExistencias)
      throw new Error('falta el pedido pagado sin existencias de la prueba anterior');
    const bandeja = await listarPedidos(quien('2026-10-16T16:00:00.000Z'), null, null);
    // El de «por otro monto queda a revisar» y RSP003 son más nuevos, y van después.
    expect(bandeja.atencion.map((f) => [f.atencion, f.atencionDesde])).toEqual([
      ['sin_existencias', sinExistencias.actualizado],
      ['monto', null],
      ['monto', null],
    ]);

    const despachar = (instante: string, version: number, op: string) =>
      despacharPedido(quien(instante), {
        op,
        pedido: sinExistencias.id,
        version,
        transportadora: 'Transportadora de prueba',
        guia: 'GUIA-0001',
      });
    const sinReponer = await despachar(
      '2026-10-16T16:05:00.000Z',
      sinExistencias.version,
      'op-rsp-0001',
    );
    expect(sinReponer).toEqual({
      estado: 'problemas',
      problemas: [
        {
          campo: 'pedido',
          mensaje: expect.stringMatching(
            /^Todavía no alcanza: de «.+» hay 0 y el pedido lleva 1\. Repón/,
          ),
        },
      ],
    });
    await shard
      .prepare(
        `UPDATE variante SET stock = stock + 1, cambio_motivo = 'ajuste', cambio_ref = 'prueba', actualizado = ?
          WHERE org_id = ? AND id = ?`,
      )
      .bind('2026-10-16T16:06:00.000Z', UNO, S)
      .run();
    const repuesto = await despachar(
      '2026-10-16T16:07:00.000Z',
      sinExistencias.version,
      'op-rsp-0002',
    );
    expect(repuesto).toMatchObject({ estado: 'guardado' });
    expect(await varianteDe(S)).toEqual({ stock: 0, reservado: 0 });
    expect(
      await uno<{ estado: string; atencion: string | null }>(
        'SELECT estado, atencion FROM pedido WHERE org_id = ? AND id = ?',
        UNO,
        sinExistencias.id,
      ),
    ).toEqual({ estado: 'despachado', atencion: null });
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM pedido_linea WHERE org_id = ? AND pedido_id = ? AND descontado = 0',
        UNO,
        sinExistencias.id,
      ),
    ).toBe(0);
  });

  it('❌ ningún caso fallido parece un pago confirmado: ni el pedido ni el seguimiento dicen pagado (CA3)', async () => {
    const casos: [string, () => Promise<void>][] = [];
    const otroMonto = await cobrar('RSP004');
    casos.push([
      otroMonto,
      async () => void (await avisar(avisoDe('SALE_APPROVED', otroMonto, 1000))),
    ]);
    const rechazado = await cobrar('RSP005');
    casos.push([rechazado, async () => void (await avisar(avisoDe('SALE_REJECTED', rechazado)))]);
    const vencido = await cobrar('RSP006');
    casos.push([
      vencido,
      async () =>
        void (await conciliarTienda(
          { db: shard, org: UNO, ahora: '2026-10-17T15:00:00.000Z', kekTexto: KEK },
          Date.parse('2026-10-17T15:00:00.000Z'),
          fetch,
        )),
    ]);
    const anuladoAntes = await cobrar('RSP007');
    casos.push([
      anuladoAntes,
      async () => void (await avisar(avisoDe('VOID_APPROVED', anuladoAntes))),
    ]);
    for (const [cobro, pasar] of casos) {
      await pasar();
      const e = await estadoDe(cobro);
      expect([cobro, e.pedido]).not.toEqual([cobro, 'pagado']);
      expect([cobro, e.pedido]).not.toEqual([cobro, 'confirmado']);
      expect(['aprobado', 'aprobado_sin_existencias']).not.toContain(e.cobro);
      const codigo = cobro.split('-')[0];
      const s = await pedir(
        '/api/v1/seguimiento',
        JSON.stringify({ codigo, secreto: `seguimiento-${codigo}-xxxxxxxxx`.slice(0, 22) }),
        '2026-10-17T15:30:00.000Z',
      );
      expect(s.status, cobro).toBe(200);
      expect((await s.json()) as { estado: string }, cobro).not.toMatchObject({ estado: 'pagado' });
    }
  });
});

describe('❌ lo que no mueve nada (HU-T11.5 CA4)', () => {
  it('❌ una firma que no es, o un cuerpo alterado: 401 y el cobro sigue esperando', async () => {
    const cobro = await cobrar('AVS007');
    const cuerpo = avisoDe('SALE_APPROVED', cobro);
    expect((await avisar(cuerpo, firmar(cuerpo, 'otra-llave'))).status).toBe(401);
    expect((await avisar(cuerpo.replace('129000', '1290'), firmar(cuerpo))).status).toBe(401);
    expect((await avisar(cuerpo, 'no-es-una-firma')).status).toBe(401);
    expect((await estadoDe(cobro)).cobro).toBe('esperando');
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM aviso_proveedor WHERE org_id = ? AND cobro_id = ?',
        UNO,
        cobro,
      ),
    ).toBe(0);
  });

  it('❌ un aviso de pruebas sobre un cobro de producción no lo mueve ni deja fila; el de producción sí', async () => {
    await ajuste('cobro', { ambiente: 'produccion' }).run();
    let cobro: string;
    try {
      cobro = await cobrar('AVS008');
    } finally {
      await ajuste('cobro', {}).run();
    }
    const cuerpo = avisoDe('SALE_APPROVED', cobro);
    const falso = await avisar(cuerpo);
    expect(falso.status).toBe(200);
    expect(await falso.json()).toEqual({ resultado: 'sin-cobro' });
    expect((await estadoDe(cobro)).cobro).toBe('esperando');
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM aviso_proveedor WHERE org_id = ? AND cobro_id = ?',
        UNO,
        cobro,
      ),
    ).toBe(0);
    const verdadero = await avisar(cuerpo, firmar(cuerpo, SECRETA_PRODUCCION));
    expect(await verdadero.json()).toEqual({ resultado: 'aplicado' });
    expect((await estadoDe(cobro)).cobro).toBe('aprobado');
  });

  it('❌ un aviso de pruebas de un cobro que no existe responde 200 sin escribir nada', async () => {
    const filas = await n('SELECT COUNT(*) AS n FROM aviso_proveedor WHERE org_id = ?', UNO);
    const r = await avisar(avisoDe('SALE_APPROVED', 'ZZZZZZ-1'));
    expect(await r.json()).toEqual({ resultado: 'sin-cobro' });
    expect(await n('SELECT COUNT(*) AS n FROM aviso_proveedor WHERE org_id = ?', UNO)).toBe(filas);
  });
});
