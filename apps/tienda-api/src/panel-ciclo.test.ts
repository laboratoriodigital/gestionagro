/**
 * El pedido después de confirmarlo, por la API del panel (HU-T9.4 y HU-T9.5): con tokens del CORE firmados
 * de verdad, contra el shard local con los dos comercios de prueba y pedidos sembrados aquí.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FALTA_GUIA, FALTA_TRANSPORTADORA, netoDelRecaudo } from './ciclo.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';
const UNO = ENSAYO_UNO.org;
const M = 'v-camisa-m-arena';

let shard: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const codigoDe = (n: number) =>
  Array.from({ length: 6 }, (_, i) => ALFABETO[Math.floor(n / 32 ** i) % 32]).join('');

/** Un pedido de la tienda Uno, por confirmar, con una línea de camisas M. Devuelve su id. */
async function sembrarPedido(n: number, o: { forma?: string; cantidad?: number } = {}) {
  const id = `ped-${String(n).padStart(4, '0')}`;
  const cantidad = o.cantidad ?? 1;
  const total = 129000 * cantidad;
  await shard.batch([
    shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
           ciudad, terminos_huella, aceptado, cambiado_por, creado, actualizado)
         VALUES (?, ?, ?, ?, 'pendiente', 'whatsapp', ?, ?, ?, 'Medellín', ?, ?, 'comprador', ?, ?)`,
      )
      .bind(
        UNO,
        id,
        codigoDe(n),
        1000 + n,
        o.forma ?? 'contraentrega',
        total,
        total,
        'a'.repeat(64),
        AHORA,
        AHORA,
        AHORA,
      ),
    shard
      .prepare(
        `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones,
           precio_unitario_cop, cantidad, total_cop)
         VALUES (?, ?, 1, 'p-camisa', ?, 'Camisa de lino', 'Talla: M · Color: Arena', 129000, ?, ?)`,
      )
      .bind(UNO, id, M, cantidad, total),
  ]);
  return id;
}

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  // Camisas de sobra: aquí no se prueba si alcanzan (eso es HU-T9.3).
  await shard
    .prepare('UPDATE variante SET stock = 1000 WHERE org_id = ? AND id = ?')
    .bind(UNO, M)
    .run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 120_000);
afterAll(async () => cerrar?.());

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
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
        plan: 'entrada',
        auth_time: Math.floor(T0 / 1000),
        ...extra,
      },
      T0,
      2,
    )
  ).token;

const pedir = async (ruta: string, cuerpo?: unknown, t?: string) =>
  crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
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

let ops = 0;
const op = () => `op-ciclo-${String(++ops).padStart(4, '0')}`;

interface Detalle {
  estado: string;
  version: number;
  transportadora: string | null;
  guia: string | null;
  recaudo: Record<string, unknown> | null;
  historia: { tipo: string; de: string | null; a: string | null; quien: string }[];
}
const detalle = async (id: string) =>
  (await (await pedir(`/api/panel/v1/pedidos/${id}`)).json()) as Detalle;

/** Un pedido sembrado y confirmado por la API: listo para despachar. */
async function confirmado(n: number, forma?: string) {
  const id = await sembrarPedido(n, forma ? { forma } : {});
  const r = await pedir('/api/panel/v1/pedidos/confirmar', { op: op(), pedido: id, version: 1 });
  expect(r.status).toBe(200);
  return id;
}

const contraentregaDe = (id: string) =>
  shard
    .prepare('SELECT estado, monto_cop FROM contraentrega WHERE org_id = ? AND pedido_id = ?')
    .bind(UNO, id)
    .first();

describe('despachar con guía (HU-T9.4)', () => {
  it('CA1: la contraentrega nace con su recaudo por recaudar, en el mismo lote', async () => {
    const id = await confirmado(1);
    const r = await pedir('/api/panel/v1/pedidos/despachar', {
      op: op(),
      pedido: id,
      version: 2,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-000123',
      comisionCop: 3500,
      fleteIdaCop: 12000,
    });
    expect(r.status).toBe(200);
    const p = await detalle(id);
    expect(p).toMatchObject({
      estado: 'despachado',
      version: 3,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-000123',
      recaudo: {
        estado: 'por_recaudar',
        montoCop: 129000,
        comisionCop: 3500,
        fleteIdaCop: 12000,
        fleteVueltaCop: null,
        liquidado: null,
      },
    });
    expect(p.historia).toContainEqual(
      expect.objectContaining({ tipo: 'estado', de: 'confirmado', a: 'despachado', quien: 'Tú' }),
    );
    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas[0]?.frase).toBe(
      'Tú despachaste el pedido #1001 por Transportadora Ensayo, guía GE-000123',
    );
  });

  it('CA1: la comisión y el flete son opcionales; sin ellos, el recaudo nace igual', async () => {
    const id = await confirmado(2);
    const r = await pedir('/api/panel/v1/pedidos/despachar', {
      op: op(),
      pedido: id,
      version: 2,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-000124',
    });
    expect(r.status).toBe(200);
    expect((await detalle(id)).recaudo).toMatchObject({
      estado: 'por_recaudar',
      comisionCop: null,
      fleteIdaCop: null,
    });
  });

  it('❌ CA2: sin guía ni transportadora no despacha, dice cuál falta, y nada cambia', async () => {
    const id = await confirmado(3);
    const r = await pedir('/api/panel/v1/pedidos/despachar', {
      op: op(),
      pedido: id,
      version: 2,
      transportadora: ' ',
      guia: '',
    });
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({
      estado: 'problemas',
      problemas: [
        { campo: 'transportadora', mensaje: FALTA_TRANSPORTADORA },
        { campo: 'guia', mensaje: FALTA_GUIA },
      ],
    });
    expect((await detalle(id)).estado).toBe('confirmado');
    expect(await contraentregaDe(id)).toBeNull();
  });

  it('❌ CA2: la base no despacha contra entrega sin la guía o sin el recaudo', async () => {
    const id = await confirmado(4);
    const despachar = (guia: string | null) =>
      shard
        .prepare(
          "UPDATE pedido SET estado = 'despachado', guia = ?, cambiado_por = 'sistema' WHERE org_id = ? AND id = ?",
        )
        .bind(guia, UNO, id)
        .run();
    await expect(despachar('GE-1')).rejects.toThrow(/contraentrega-sin-guia/);
    await shard
      .prepare(
        `INSERT INTO contraentrega (org_id, pedido_id, estado, monto_cop, cambiado_por, creado, actualizado)
         VALUES (?, ?, 'por_recaudar', 129000, 'sistema', ?, ?)`,
      )
      .bind(UNO, id, AHORA, AHORA)
      .run();
    await expect(despachar(null)).rejects.toThrow(/contraentrega-sin-guia/);
    // Un pedido que no se paga contra entrega no tiene recaudo.
    const tr = await confirmado(5, 'transferencia');
    await expect(
      shard
        .prepare(
          `INSERT INTO contraentrega (org_id, pedido_id, estado, monto_cop, cambiado_por, creado, actualizado)
           VALUES (?, ?, 'por_recaudar', 129000, 'sistema', ?, ?)`,
        )
        .bind(UNO, tr, AHORA, AHORA)
        .run(),
    ).rejects.toThrow(/pedido-sin-contraentrega/);
  });

  it('una transferencia sale sin guía y sin recaudo; uno por confirmar no sale', async () => {
    const tr = await confirmado(6, 'transferencia');
    const r = await pedir('/api/panel/v1/pedidos/despachar', { op: op(), pedido: tr, version: 2 });
    expect(r.status).toBe(200);
    expect(await detalle(tr)).toMatchObject({ estado: 'despachado', guia: null, recaudo: null });

    const pendiente = await sembrarPedido(7);
    const r2 = await pedir('/api/panel/v1/pedidos/despachar', {
      op: op(),
      pedido: pendiente,
      version: 1,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-2',
    });
    expect(r2.status).toBe(422);
    expect(await r2.json()).toMatchObject({
      problemas: [{ campo: 'pedido', mensaje: 'Confirma el pedido antes de despacharlo.' }],
    });
  });

  it('una versión vieja responde 409; repetir la operación no despacha dos veces', async () => {
    const id = await confirmado(8);
    const viejo = await pedir('/api/panel/v1/pedidos/despachar', {
      op: op(),
      pedido: id,
      version: 1,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-3',
    });
    expect(viejo.status).toBe(409);
    expect(await viejo.json()).toMatchObject({ estado: 'cambiado', version: 2 });
    const cuerpo = {
      op: op(),
      pedido: id,
      version: 2,
      transportadora: 'Transportadora Ensayo',
      guia: 'GE-3',
    };
    expect((await pedir('/api/panel/v1/pedidos/despachar', cuerpo)).status).toBe(200);
    expect((await pedir('/api/panel/v1/pedidos/despachar', cuerpo)).status).toBe(200);
    expect((await detalle(id)).version).toBe(3);
  });

  it('❌ un rol fuera de la matriz no despacha, y otra tienda no ve el pedido', async () => {
    const id = await confirmado(9);
    const cuerpo = { op: op(), pedido: id, version: 2, transportadora: 'T', guia: 'G' };
    const otro = await token({ rol: 'contador' });
    expect((await pedir('/api/panel/v1/pedidos/despachar', cuerpo, otro)).status).toBe(403);
    const dos = await token({ org: ENSAYO_DOS.org });
    expect((await pedir('/api/panel/v1/pedidos/despachar', cuerpo, dos)).status).toBe(404);
    expect((await detalle(id)).estado).toBe('confirmado');
  });
});

/** Un pedido contra entrega confirmado y despachado por la API, con el flete de ida de 12.000. */
async function despachado(n: number, forma?: string) {
  const id = await confirmado(n, forma);
  const r = await pedir('/api/panel/v1/pedidos/despachar', {
    op: op(),
    pedido: id,
    version: 2,
    transportadora: 'Transportadora Ensayo',
    guia: `GE-${n}`,
    ...(forma && forma !== 'contraentrega' ? {} : { comisionCop: 3500, fleteIdaCop: 12000 }),
  });
  expect(r.status).toBe(200);
  return id;
}

const stock = async () =>
  (
    await shard
      .prepare('SELECT stock FROM variante WHERE org_id = ? AND id = ?')
      .bind(UNO, M)
      .first<{ stock: number }>()
  )?.stock;

interface Recaudos {
  porRecaudar: { montoCop: number; cantidad: number; desde: string | null };
  sinLiquidar: { montoCop: number; cantidad: number; desde: string | null };
  perdidos: { montoCop: number; cantidad: number };
  recaudos: { pedido: string; numero: number; estado: string; netoCop: number }[];
}
const recaudos = async () => (await (await pedir('/api/panel/v1/recaudos')).json()) as Recaudos;

describe('recaudar, devolver, perder y liquidar (HU-T9.5)', () => {
  it('CA1: entregar contra entrega es recaudar, en el mismo lote', async () => {
    const id = await despachado(101);
    const r = await pedir('/api/panel/v1/pedidos/entregar', { op: op(), pedido: id, version: 3 });
    expect(r.status).toBe(200);
    const p = await detalle(id);
    expect(p).toMatchObject({
      estado: 'entregado',
      recaudo: { estado: 'recaudado', montoCop: 129000, netoCop: 129000 - 3500 - 12000 },
    });
    expect(p.historia).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tipo: 'recaudo', de: 'por_recaudar', a: 'recaudado' }),
        expect.objectContaining({ tipo: 'estado', de: 'despachado', a: 'entregado' }),
      ]),
    );
  });

  it('❌ CA3: la base no deja entregar con la plata por recaudar', async () => {
    const id = await despachado(102);
    await expect(
      shard
        .prepare(
          "UPDATE pedido SET estado = 'entregado', cambiado_por = 'sistema' WHERE org_id = ? AND id = ?",
        )
        .bind(UNO, id)
        .run(),
    ).rejects.toThrow(/contraentrega-por-recaudar/);
    expect((await detalle(id)).recaudo).toMatchObject({ estado: 'por_recaudar' });
  });

  it('CA1: devolver dice el flete de vuelta, y las unidades vuelven al inventario si volvieron', async () => {
    const id = await despachado(103);
    const antes = await stock();
    const r = await pedir('/api/panel/v1/pedidos/devolver', {
      op: op(),
      pedido: id,
      version: 3,
      volvio: true,
      fleteVueltaCop: 10000,
    });
    expect(r.status).toBe(200);
    expect(await detalle(id)).toMatchObject({
      estado: 'devuelto',
      recaudo: { estado: 'devuelto', fleteVueltaCop: 10000, netoCop: -22000 },
    });
    expect(await stock()).toBe((antes ?? 0) + 1);
    const libro = await shard
      .prepare(
        'SELECT delta, motivo, ref FROM movimiento_inventario WHERE org_id = ? AND variante_id = ? ORDER BY id DESC',
      )
      .bind(UNO, M)
      .first();
    expect(libro).toEqual({ delta: 1, motivo: 'devolucion', ref: id });
  });

  it('devolver sin que vuelvan las unidades no toca el inventario; sin decirlo, no devuelve', async () => {
    const id = await despachado(104);
    const antes = await stock();
    const sinDecir = await pedir('/api/panel/v1/pedidos/devolver', {
      op: op(),
      pedido: id,
      version: 3,
    });
    expect(sinDecir.status).toBe(422);
    expect(await sinDecir.json()).toMatchObject({ problemas: [{ campo: 'volvio' }] });
    const r = await pedir('/api/panel/v1/pedidos/devolver', {
      op: op(),
      pedido: id,
      version: 3,
      volvio: false,
    });
    expect(r.status).toBe(200);
    expect(await stock()).toBe(antes);
  });

  it('CA1: «perdido» queda aparte, sin unidades que vuelvan', async () => {
    const id = await despachado(105);
    const antes = await stock();
    const r = await pedir('/api/panel/v1/pedidos/perder', { op: op(), pedido: id, version: 3 });
    expect(r.status).toBe(200);
    expect(await detalle(id)).toMatchObject({
      estado: 'devuelto',
      recaudo: { estado: 'perdido', netoCop: -12000 },
    });
    expect(await stock()).toBe(antes);
    const t = await recaudos();
    expect(t.perdidos).toMatchObject({ cantidad: 1, montoCop: 129000 });
    expect(t.recaudos.find((x) => x.pedido === id)?.estado).toBe('perdido');
  });

  it('CA2 y aceptación de M2: confirmar, despachar, recaudar y liquidar varios con su número', async () => {
    const a = await despachado(106);
    const b = await despachado(107);
    const enCamino = await despachado(108);
    const antes = (await recaudos()).sinLiquidar;
    for (const id of [a, b])
      expect(
        (await pedir('/api/panel/v1/pedidos/entregar', { op: op(), pedido: id, version: 3 }))
          .status,
      ).toBe(200);
    const t = await recaudos();
    expect(t.sinLiquidar).toMatchObject({
      cantidad: antes.cantidad + 2,
      montoCop: antes.montoCop + 258000,
    });
    expect(t.porRecaudar.cantidad).toBeGreaterThanOrEqual(1);
    expect(t.recaudos.find((x) => x.pedido === enCamino)).toMatchObject({
      estado: 'por_recaudar',
      netoCop: 129000 - 3500 - 12000,
    });

    const r = await pedir('/api/panel/v1/recaudos/liquidar', {
      op: op(),
      pedidos: [a, b],
      liquidacionRef: 'LIQ-0001',
    });
    expect(r.status).toBe(200);
    const despues = await recaudos();
    expect(despues.sinLiquidar.cantidad).toBe(antes.cantidad);
    expect(despues.recaudos.map((x) => x.pedido)).not.toContain(a);
    const p = await detalle(a);
    expect(p.recaudo).toMatchObject({ liquidacionRef: 'LIQ-0001', liquidado: AHORA });
    expect(p.historia).toContainEqual(
      expect.objectContaining({ tipo: 'recaudo', de: 'recaudado', a: 'liquidado' }),
    );
    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas[0]?.frase).toBe(
      'Tú liquidaste 2 recaudos con la liquidación LIQ-0001 por $258.000',
    );
  });

  it('❌ CA3: no se liquida lo que no se recaudó, y en ese caso no se marca ninguno', async () => {
    const recaudado = await despachado(109);
    await pedir('/api/panel/v1/pedidos/entregar', { op: op(), pedido: recaudado, version: 3 });
    const enCamino = await despachado(110);
    const r = await pedir('/api/panel/v1/recaudos/liquidar', {
      op: op(),
      pedidos: [recaudado, enCamino],
      liquidacionRef: 'LIQ-0002',
    });
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({
      estado: 'problemas',
      problemas: [{ campo: 'pedidos', mensaje: '#1110 no se ha recaudado: no se puede liquidar.' }],
    });
    expect((await detalle(recaudado)).recaudo).toMatchObject({ liquidado: null });
    // La base tampoco lo deja.
    await expect(
      shard
        .prepare(
          "UPDATE contraentrega SET liquidado = ?, liquidacion_ref = 'LIQ-X' WHERE org_id = ? AND pedido_id = ?",
        )
        .bind(AHORA, UNO, enCamino)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it('el neto resta la comisión y los fletes; lo devuelto y lo perdido cuestan los fletes', () => {
    const base = { montoCop: 100000, comisionCop: 3000, fleteIdaCop: 10000, fleteVueltaCop: null };
    expect(netoDelRecaudo({ ...base, estado: 'recaudado' })).toBe(87000);
    expect(netoDelRecaudo({ ...base, estado: 'devuelto', fleteVueltaCop: 8000 })).toBe(-18000);
    expect(netoDelRecaudo({ ...base, estado: 'perdido' })).toBe(-10000);
    expect(
      netoDelRecaudo({ ...base, estado: 'recaudado', comisionCop: null, fleteIdaCop: null }),
    ).toBe(100000);
  });

  it('❌ el colaborador gestiona recaudos; un rol fuera de la matriz no los ve', async () => {
    const otro = await token({ rol: 'contador' });
    expect((await pedir('/api/panel/v1/recaudos', undefined, otro)).status).toBe(403);
    expect((await pedir('/api/panel/v1/recaudos')).status).toBe(200);
  });
});
