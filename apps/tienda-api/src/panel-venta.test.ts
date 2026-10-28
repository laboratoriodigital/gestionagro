/**
 * Envíos y cupones por la API del panel (HU-T10.1): con tokens del CORE firmados de verdad, contra
 * el shard local con los dos comercios de prueba. Los usos del cupón los cuenta la base al
 * confirmar, pagar y cancelar (`0003_usos_del_cupon.sql`).
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
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cotizar } from './cotizar.ts';
import type { Cupon, Envio } from './venta.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-de-la-venta';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d2';
const UNO = ENSAYO_UNO.org;
const M = 'v-camisa-m-arena';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];
let firmante: Firmante;

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
  // Camisas de sobra: aquí no se prueba si alcanzan (eso es HU-T9.3).
  await shard
    .prepare('UPDATE variante SET stock = 1000 WHERE org_id = ? AND id = ?')
    .bind(UNO, M)
    .run();
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

const pedir = async (ruta: string, cuerpo?: unknown) =>
  crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
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

let ops = 0;
const op = () => `op-venta-${String(++ops).padStart(4, '0')}`;
const venta = async () =>
  (await (await pedir('/api/panel/v1/venta')).json()) as { envios: Envio[]; cupones: Cupon[] };
const problemas = async (r: Response) =>
  ((await r.json()) as { problemas: { campo: string; mensaje: string }[] }).problemas;
const frases = async () =>
  (
    (await (await pedir('/api/panel/v1/registro')).json()) as { filas: { frase: string }[] }
  ).filas.map((f) => f.frase);

describe('envíos (HU-T10.1 CA1)', () => {
  it('se crean con precio, «gratis desde», ciudades y días; se editan con su versión y se borran', async () => {
    const r = await pedir('/api/panel/v1/envios/guardar', {
      op: op(),
      nombre: 'Medellín',
      precioCop: 8000,
      gratisDesdeCop: 150000,
      ciudades: ['Medellín', 'Envigado', 'Medellín', ''],
      diasMin: 1,
      diasMax: 2,
    });
    expect(r.status).toBe(200);
    const { id } = (await r.json()) as { id: string };
    expect((await venta()).envios.find((e) => e.id === id)).toEqual({
      id,
      nombre: 'Medellín',
      precioCop: 8000,
      gratisDesdeCop: 150000,
      ciudades: ['Medellín', 'Envigado'],
      diasMin: 1,
      diasMax: 2,
      activa: true,
      version: 1,
      plazo: 'llega en 1 a 2 días',
    });

    const editar = {
      op: op(),
      id,
      version: 1,
      nombre: 'Medellín y el valle',
      precioCop: 9000,
      diasMax: 3,
      ciudades: [],
    };
    expect((await pedir('/api/panel/v1/envios/guardar', editar)).status).toBe(200);
    // Repetir la misma operación responde lo mismo; otra con la versión vieja, 409.
    expect((await pedir('/api/panel/v1/envios/guardar', editar)).status).toBe(200);
    const vieja = await pedir('/api/panel/v1/envios/guardar', { ...editar, op: op() });
    expect(vieja.status).toBe(409);
    expect(await vieja.json()).toMatchObject({ estado: 'cambiado', version: 2 });
    expect((await venta()).envios.find((e) => e.id === id)).toMatchObject({
      nombre: 'Medellín y el valle',
      precioCop: 9000,
      gratisDesdeCop: null,
      ciudades: null,
      diasMin: null,
      diasMax: 3,
      version: 2,
    });

    expect((await pedir('/api/panel/v1/envios/borrar', { op: op(), id, version: 2 })).status).toBe(
      200,
    );
    expect((await venta()).envios.some((e) => e.id === id)).toBe(false);
    expect((await pedir('/api/panel/v1/envios/borrar', { op: op(), id, version: 3 })).status).toBe(
      404,
    );
    expect(await frases()).toEqual(
      expect.arrayContaining([
        'Tú creaste el envío «Medellín»',
        'Tú editaste el envío «Medellín y el valle»',
        'Tú mandaste el envío «Medellín y el valle» a la papelera',
      ]),
    );
  });

  it('❌ sin el plazo máximo, o con el mínimo por encima, no se guarda', async () => {
    const base = { nombre: 'Nacional', precioCop: 15000 };
    const sin = await pedir('/api/panel/v1/envios/guardar', { ...base, op: op() });
    expect(sin.status).toBe(422);
    expect((await problemas(sin)).map((p) => p.campo)).toEqual(['diasMax']);
    const alReves = await pedir('/api/panel/v1/envios/guardar', {
      ...base,
      op: op(),
      diasMin: 8,
      diasMax: 5,
    });
    expect(await problemas(alReves)).toEqual([
      { campo: 'diasMin', mensaje: 'los días mínimos pasan de los máximos' },
    ]);
  });

  it('❌ uno de más de 30 días calendario se guarda, y su plazo lo dice como lo verá el comprador', async () => {
    const r = await pedir('/api/panel/v1/envios/guardar', {
      op: op(),
      nombre: 'Bodega',
      precioCop: 40000,
      diasMin: 35,
      diasMax: 45,
    });
    const { id } = (await r.json()) as { id: string };
    expect((await venta()).envios.find((e) => e.id === id)?.plazo).toBe(
      'llega en 35 a 45 días calendario: más que los 30 de la ley, y es el plazo que aceptas al pedir',
    );
  });
});

/** Cotiza una camisa M con el cupón, en el instante dado. */
const conCupon = (codigo: string, instante = AHORA) =>
  cotizar(shard, UNO, { lineas: [{ variante: M, cantidad: 1 }], cupon: codigo }, instante);
const invalido = async (codigo: string, instante?: string) =>
  (await conCupon(codigo, instante)).avisos.some((a) => a.codigo === 'cupon_invalido');

describe('cupones (HU-T10.1 CA1)', () => {
  it('por porcentaje, valor o envío gratis, con mínimo, vigencia y usos', async () => {
    const guardar = (cuerpo: object) =>
      pedir('/api/panel/v1/cupones/guardar', { op: op(), ...cuerpo });
    expect(
      (await guardar({ codigo: 'diez-off', tipo: 'porcentaje', valor: 10, usosMaximos: 5 })).status,
    ).toBe(200);
    expect(
      (await guardar({ codigo: 'MENOS5000', tipo: 'valor', valor: 5000, minimoCop: 60000 })).status,
    ).toBe(200);
    expect(
      (
        await guardar({
          codigo: 'ENVIOGRATIS',
          tipo: 'envio_gratis',
          valor: 7,
          desde: '2026-10-01',
          hasta: '2026-10-15',
        })
      ).status,
    ).toBe(200);
    const cupones = (await venta()).cupones;
    expect(cupones.find((c) => c.codigo === 'DIEZ-OFF')).toEqual({
      codigo: 'DIEZ-OFF',
      tipo: 'porcentaje',
      valor: 10,
      minimoCop: 0,
      desde: null,
      hasta: null,
      usosMaximos: 5,
      usos: 0,
      activo: true,
      version: 1,
      alcance: null,
    });
    // El envío gratis no guarda un valor; la vigencia vuelve como la escribió el comercio.
    expect(cupones.find((c) => c.codigo === 'ENVIOGRATIS')).toMatchObject({
      valor: 0,
      desde: '2026-10-01',
      hasta: '2026-10-15',
    });
    expect((await conCupon('diez-off')).descuento).toBe(12900);
    expect((await conCupon('MENOS5000')).descuento).toBe(5000);
    expect(await frases()).toEqual(expect.arrayContaining(['Tú creaste el cupón DIEZ-OFF']));
  });

  it('❌ la vigencia es en días de Colombia: el último día vale hasta la medianoche de Bogotá', async () => {
    expect(
      (
        await pedir('/api/panel/v1/cupones/guardar', {
          op: op(),
          codigo: 'QUINCENA',
          tipo: 'porcentaje',
          valor: 15,
          desde: '2026-10-15',
          hasta: '2026-10-15',
        })
      ).status,
    ).toBe(200);
    expect(await invalido('QUINCENA', '2026-10-15T04:59:59.999Z')).toBe(true);
    expect(await invalido('QUINCENA', '2026-10-15T05:00:00.000Z')).toBe(false);
    expect(await invalido('QUINCENA', '2026-10-16T04:59:59.999Z')).toBe(false);
    expect(await invalido('QUINCENA', '2026-10-16T05:00:00.000Z')).toBe(true);
  });

  it('❌ un porcentaje de más de 100, un valor de cero, la vigencia al revés y un código repetido', async () => {
    const guardar = async (cuerpo: object) =>
      problemas(await pedir('/api/panel/v1/cupones/guardar', { op: op(), ...cuerpo }));
    expect(await guardar({ codigo: 'MUCHO', tipo: 'porcentaje', valor: 150 })).toEqual([
      { campo: 'valor', mensaje: 'un porcentaje va de 1 a 100' },
    ]);
    expect(await guardar({ codigo: 'NADA', tipo: 'valor', valor: 0 })).toEqual([
      { campo: 'valor', mensaje: 'escribe cuánto descuenta, en pesos' },
    ]);
    expect(
      await guardar({
        codigo: 'REVES',
        tipo: 'valor',
        valor: 1000,
        desde: '2026-10-20',
        hasta: '2026-10-10',
      }),
    ).toEqual([{ campo: 'hasta', mensaje: 'la vigencia termina antes de empezar' }]);
    expect(await guardar({ codigo: 'diez-off', tipo: 'valor', valor: 1000 })).toEqual([
      { campo: 'codigo', mensaje: 'ya tienes un cupón DIEZ-OFF: elige otro código' },
    ]);
    expect(await guardar({ codigo: 'CON ESPACIO', tipo: 'valor', valor: 1000 })).toEqual([
      { campo: 'codigo', mensaje: 'solo letras sin tilde, números y guiones, sin espacios' },
    ]);
  });
});

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const codigoDe = (n: number) =>
  Array.from({ length: 6 }, (_, i) => ALFABETO[Math.floor(n / 32 ** i) % 32]).join('');

/** Un pedido de la tienda Uno con el cupón: una camisa M con el 10 %. Devuelve su id. */
async function pedidoConCupon(n: number, cupon: string, o: { enLinea?: boolean } = {}) {
  const id = `ped-v${String(n).padStart(4, '0')}`;
  await shard.batch([
    shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, descuento_cop,
           total_cop, cupon_codigo, ciudad, terminos_huella, aceptado, cambiado_por, creado, actualizado)
         VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, 129000, 12900, 116100, ?, 'Medellín', ?, ?, 'comprador', ?, ?)`,
      )
      .bind(
        UNO,
        id,
        codigoDe(5000 + n),
        5000 + n,
        o.enLinea ? 'por_pagar' : 'pendiente',
        o.enLinea ? 'en_linea' : 'transferencia',
        cupon,
        'a'.repeat(64),
        AHORA,
        AHORA,
        AHORA,
      ),
    shard
      .prepare(
        `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones,
           precio_unitario_cop, cantidad, total_cop)
         VALUES (?, ?, 1, 'p-camisa', ?, 'Camisa de lino', 'Talla: M · Color: Arena', 129000, 1, 129000)`,
      )
      .bind(UNO, id, M),
  ]);
  return id;
}
const confirmar = async (id: string) =>
  (await pedir('/api/panel/v1/pedidos/confirmar', { op: op(), pedido: id, version: 1 })).status;
const cancelar = async (id: string, version: number) =>
  (await pedir('/api/panel/v1/pedidos/cancelar', { op: op(), pedido: id, version, volvio: true }))
    .status;
/** Lo que hace el lote del pago aprobado (TIENDA §7.3) con el estado del pedido. */
const pagar = (id: string) =>
  shard
    .prepare(
      "UPDATE pedido SET estado = 'pagado', cambiado_por = 'sistema', version = version + 1 WHERE org_id = ? AND id = ?",
    )
    .bind(UNO, id)
    .run();
const usos = async (codigo: string) =>
  (
    await shard
      .prepare('SELECT usos FROM cupon WHERE org_id = ? AND codigo = ?')
      .bind(UNO, codigo)
      .first<{ usos: number }>()
  )?.usos;

describe('❌ los usos del cupón (HU-T10.1 CA2)', () => {
  it('uno de 50 usos se agota a los 50 pedidos confirmados o pagados; cancelar devuelve el uso', async () => {
    const nuevo = await pedir('/api/panel/v1/cupones/guardar', {
      op: op(),
      codigo: 'CINCUENTA',
      tipo: 'porcentaje',
      valor: 10,
      usosMaximos: 50,
    });
    expect(nuevo.status).toBe(200);
    // El 51 se pidió cuando el cupón aún valía.
    const tardio = await pedidoConCupon(51, 'CINCUENTA');
    const ids: string[] = [];
    for (let n = 1; n <= 49; n++) ids.push(await pedidoConCupon(n, 'CINCUENTA'));
    // Mientras están por confirmar, no gastan.
    expect(await usos('CINCUENTA')).toBe(0);
    for (const id of ids) expect(await confirmar(id)).toBe(200);
    expect(await usos('CINCUENTA')).toBe(49);
    expect(await invalido('CINCUENTA')).toBe(false);
    // El 50 se paga en línea.
    const enLinea = await pedidoConCupon(50, 'CINCUENTA', { enLinea: true });
    await pagar(enLinea);
    expect(await usos('CINCUENTA')).toBe(50);
    expect(await invalido('CINCUENTA')).toBe(true);

    // El precio que vio el 51 se respeta: se confirma, pero no cuenta ni pasa el tope.
    expect(await confirmar(tardio)).toBe(200);
    expect(await usos('CINCUENTA')).toBe(50);

    // Cancelar uno de los que contaron devuelve su uso, y el cupón vuelve a valer.
    expect(await cancelar(ids[0] as string, 2)).toBe(200);
    expect(await usos('CINCUENTA')).toBe(49);
    expect(await invalido('CINCUENTA')).toBe(false);
    // Cancelar el que no contó no devuelve nada.
    expect(await cancelar(tardio, 2)).toBe(200);
    expect(await usos('CINCUENTA')).toBe(49);

    // El tope no puede bajar de lo usado.
    const { version } = (await venta()).cupones.find((c) => c.codigo === 'CINCUENTA') as Cupon;
    const bajar = await pedir('/api/panel/v1/cupones/guardar', {
      op: op(),
      codigo: 'CINCUENTA',
      version,
      tipo: 'porcentaje',
      valor: 10,
      usosMaximos: 10,
    });
    expect(await problemas(bajar)).toEqual([
      { campo: 'usosMaximos', mensaje: 'ya se usó 49 veces: el tope no puede ser menor' },
    ]);
  }, 120_000);

  it('cancelar sin confirmar no gasta; un pago rechazado no cuenta; devolver no devuelve el uso', async () => {
    expect(
      (
        await pedir('/api/panel/v1/cupones/guardar', {
          op: op(),
          codigo: 'TRES',
          tipo: 'valor',
          valor: 3000,
          usosMaximos: 3,
        })
      ).status,
    ).toBe(200);
    const pendiente = await pedidoConCupon(61, 'TRES');
    expect(await cancelar(pendiente, 1)).toBe(200);
    expect(await usos('TRES')).toBe(0);

    const rechazado = await pedidoConCupon(62, 'TRES', { enLinea: true });
    await shard
      .prepare(
        "UPDATE pedido SET estado = 'pendiente', cambiado_por = 'sistema' WHERE org_id = ? AND id = ?",
      )
      .bind(UNO, rechazado)
      .run();
    expect(await usos('TRES')).toBe(0);

    const devuelto = await pedidoConCupon(63, 'TRES');
    expect(await confirmar(devuelto)).toBe(200);
    expect(await usos('TRES')).toBe(1);
    await shard
      .prepare(
        "UPDATE pedido SET estado = 'despachado', cambiado_por = 'sistema', guia = 'G-1' WHERE org_id = ? AND id = ?",
      )
      .bind(UNO, devuelto)
      .run();
    await shard
      .prepare(
        "UPDATE pedido SET estado = 'devuelto', cambiado_por = 'sistema' WHERE org_id = ? AND id = ?",
      )
      .bind(UNO, devuelto)
      .run();
    expect(await usos('TRES')).toBe(1);
  });
});
