/**
 * HU-T14.2: el tablero de Inicio. Los pedidos, los recaudos y los cobros se siembran en el shard
 * local de los comercios de prueba y el tablero se pide por la API del panel. El reloj se mueve
 * por cada día de un año bisiesto y en otros husos (CA3, patrón 8). Ningún dato es de una persona.
 */
import { fechaEnBogota } from '@ed1/calendario';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { liquidacionAtrasada, periodos, type Tablero } from './panel-tablero.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-tablero';
/** Viernes 31 de marzo de 2028, 10:00 en Colombia: el mes anterior es un febrero de 29 días. */
const T0 = Date.parse('2028-03-31T10:00:00-05:00');
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d8';
const UNO = ENSAYO_UNO.org;
const DOS = ENSAYO_DOS.org;
const HUSOS = [
  'UTC',
  'Asia/Tokyo',
  'Pacific/Kiritimati',
  'America/Los_Angeles',
  'Pacific/Pago_Pago',
];

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];
const husoOriginal = process.env['TZ'];

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
  await sembrar();
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});
afterEach(() => {
  if (husoOriginal === undefined) delete process.env['TZ'];
  else process.env['TZ'] = husoOriginal;
});

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
  tienda_control: control,
});

const pedirTablero = async (ahora = T0, org = UNO) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: PERSONA,
      org,
      rol: 'colaborador',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'pro',
      auth_time: Math.floor(ahora / 1000),
    },
    ahora,
    2,
  );
  const r = await crearApp({ ahora: () => ahora, enSegundoPlano: () => undefined }).request(
    '/api/panel/v1/tablero',
    { headers: { [CABECERA_DESPACHO]: SECRETO, authorization: `Bearer ${token}` } },
    env(),
  );
  expect(r.status).toBe(200);
  return (await r.json()) as Tablero;
};

/** Un instante de Colombia, `AAAA-MM-DD HH:MM`, en ISO. */
const en = (fechaHora: string) =>
  new Date(Date.parse(`${fechaHora.replace(' ', 'T')}:00-05:00`)).toISOString();

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
let numero = 2000;
async function pedido(
  creado: string,
  estado: string,
  totalCop: number,
  o: { forma?: string; atencion?: string; org?: string } = {},
): Promise<string> {
  const n = ++numero;
  const id = `pe-tablero-${n}`;
  const codigo = `T${[...String(n).padStart(5, '0')].map((d) => CROCKFORD[Number(d) + 10]).join('')}`;
  await shard
    .prepare(
      `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
         atencion, terminos_huella, aceptado, cambiado_por, creado, actualizado)
       VALUES (?, ?, ?, ?, ?, 'en_linea', ?, ?, ?, ?, ?, ?, 'sistema', ?, ?)`,
    )
    .bind(
      o.org ?? UNO,
      id,
      codigo,
      n,
      estado,
      o.forma ?? 'contraentrega',
      totalCop,
      totalCop,
      o.atencion ?? null,
      'a'.repeat(64),
      creado,
      creado,
      creado,
    )
    .run();
  return id;
}

async function contraentrega(
  pedidoId: string,
  estado: string,
  montoCop: number,
  c: {
    comision: number | null;
    ida: number | null;
    vuelta?: number | null;
    creado: string;
    actualizado: string;
  },
) {
  await shard
    .prepare(
      `INSERT INTO contraentrega (org_id, pedido_id, estado, monto_cop, comision_cop, flete_ida_cop, flete_vuelta_cop,
         cambiado_por, creado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'sistema', ?, ?)`,
    )
    .bind(
      UNO,
      pedidoId,
      estado,
      montoCop,
      c.comision,
      c.ida,
      c.vuelta ?? null,
      c.creado,
      c.actualizado,
    )
    .run();
}

async function cobro(id: string, pedidoId: string, estado: string, actualizado: string) {
  await shard
    .prepare(
      `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado)
       VALUES (?, ?, ?, 'bold', 'pruebas', 20000, ?, ?, ?, ?, ?)`,
    )
    .bind(
      UNO,
      id,
      pedidoId,
      estado,
      (estado === 'revisar' ? 'b' : 'c').repeat(64),
      actualizado,
      actualizado,
      actualizado,
    )
    .run();
}

let radicado = 0;
async function solicitud(estado: string, vence: string) {
  const r = ++radicado;
  await shard
    .prepare(
      `INSERT INTO solicitud (org_id, id, radicado, tipo, canal, estado, sobre, iv, llave_version, creada, vence)
       VALUES (?, ?, ?, 'queja', 'web', ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      UNO,
      `so-tablero-${r}`,
      r,
      estado,
      new Uint8Array(16),
      new Uint8Array(12),
      en('2028-03-15 09:00'),
      vence,
    )
    .run();
}

/**
 * Hoy, 31 de marzo: uno entregado, uno por confirmar y uno cancelado. En el mes, además, dos que
 * esperan despacho, uno entregado, uno devuelto y uno pagado sin existencias. En febrero, los del
 * borde: el 1 a las 00:00 y el 29 a las 23:59 cuentan; el 31 de enero a las 23:59, no.
 */
async function sembrar() {
  const hoy = await pedido(en('2028-03-31 08:00'), 'entregado', 100000);
  await pedido(en('2028-03-31 09:00'), 'pendiente', 50000);
  await pedido(en('2028-03-31 09:30'), 'cancelado', 70000);
  // A las 10:30 todavía no ha llegado: es después de «ahora».
  await pedido(en('2028-03-31 10:30'), 'confirmado', 1_000_000);
  await pedido(en('2028-03-01 00:00'), 'confirmado', 30000);
  const pagado = await pedido(en('2028-03-10 12:00'), 'pagado', 200000, { forma: 'en_linea' });
  const entregado = await pedido(en('2028-03-05 12:00'), 'entregado', 90000);
  const devuelto = await pedido(en('2028-03-20 12:00'), 'devuelto', 60000);
  const sinExistencias = await pedido(en('2028-03-15 12:00'), 'pagado', 20000, {
    forma: 'en_linea',
    atencion: 'sin_existencias',
  });
  const borde = await pedido(en('2028-02-29 23:59'), 'despachado', 40000);
  await pedido(en('2028-02-01 00:00'), 'entregado', 80000);
  await pedido(en('2028-02-15 12:00'), 'devuelto', 60000);
  await pedido(en('2028-01-31 23:59'), 'entregado', 999000);
  // Otra tienda, hoy: no cuenta.
  await pedido(en('2028-03-31 08:30'), 'entregado', 555000, { org: DOS });

  // Recaudado el viernes 24: 5 días hábiles después, la liquidación está atrasada.
  await contraentrega(hoy, 'recaudado', 100000, {
    comision: 3500,
    ida: 12000,
    creado: en('2028-03-22 12:00'),
    actualizado: en('2028-03-24 12:00'),
  });
  // Recaudado el miércoles 29, sin la comisión: a tiempo, y el margen es a lo sumo ese.
  await contraentrega(entregado, 'recaudado', 90000, {
    comision: null,
    ida: 10000,
    creado: en('2028-03-06 12:00'),
    actualizado: en('2028-03-29 12:00'),
  });
  await contraentrega(devuelto, 'devuelto', 60000, {
    comision: null,
    ida: 9000,
    vuelta: 9000,
    creado: en('2028-03-21 12:00'),
    actualizado: en('2028-03-25 12:00'),
  });
  await contraentrega(borde, 'por_recaudar', 40000, {
    comision: 1500,
    ida: 9000,
    creado: en('2028-03-02 12:00'),
    actualizado: en('2028-03-02 12:00'),
  });

  await cobro('CB-REVISAR', pagado, 'revisar', en('2028-03-10 12:05'));
  await cobro('CB-SINEXIST', sinExistencias, 'aprobado_sin_existencias', en('2028-03-15 12:05'));

  await solicitud('radicada', '2028-04-02');
  await solicitud('radicada', '2028-03-30');
  await solicitud('radicada', '2028-04-20');
  await solicitud('respondida', '2028-03-01');
}

describe('el tablero (HU-T14.2)', () => {
  it('CA1 y CA2: hoy, el mes y febrero entero, salidos de los pedidos', async () => {
    const t = await pedirTablero();
    expect(t.periodos).toMatchObject({ altura: '2028-02-29', anteriorCompleto: true });
    expect(t.hoy).toEqual({
      pedidos: 3,
      vendidos: 1,
      ventasCop: 100000,
      ticketCop: 100000,
      tasaDeCierre: 1 / 3,
    });
    // Los 3 de hoy, el del 1 a las 00:00, el pagado, el entregado, el devuelto y el sin existencias.
    expect(t.mes).toEqual({
      pedidos: 8,
      vendidos: 5,
      ventasCop: 440000,
      ticketCop: 88000,
      tasaDeCierre: 5 / 8,
    });
    // El 1 de febrero a las 00:00 y el 29 a las 23:59 cuentan; el 31 de enero, no.
    expect(t.anterior).toEqual({
      pedidos: 3,
      vendidos: 2,
      ventasCop: 120000,
      ticketCop: 60000,
      tasaDeCierre: 2 / 3,
    });
  });

  it('CA1: lo pendiente, cada uno contado una vez', async () => {
    expect((await pedirTablero()).pendientes).toEqual({
      porConfirmar: 1,
      // El confirmado del 1, el pagado y el pagado sin existencias; el de las 10:30 también espera.
      porDespachar: 4,
      recaudosAtrasados: 1,
      solicitudesPorVencer: 1,
      solicitudesVencidas: 1,
      pagosSinExistencias: 1,
      cobrosARevisar: 1,
      // La camisa L azul tiene 0.
      agotados: 1,
      // Sin un mínimo en Avisos, ninguna está «por agotarse».
      porAgotarse: 0,
    });
  });

  it('HU-P2.2 · con «Avisarme cuando queden» en Avisos, las que llegaron a ese número; ❌ las agotadas no', async () => {
    const poner = (datos: unknown) =>
      shard
        .prepare(
          `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por)
           VALUES (?, 'avisos', 1, ?, '2026-10-27T00:00:00.000Z', 'usuario:prueba')
           ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos`,
        )
        .bind(UNO, JSON.stringify(datos))
        .run();
    const variantes = await shard
      .prepare(
        'SELECT stock - reservado AS quedan FROM variante WHERE org_id = ? AND activa = 1 AND stock IS NOT NULL',
      )
      .bind(UNO)
      .all<{ quedan: number }>();
    const minimo = 1000;
    await poner({ stockBajo: minimo });
    const esperadas = variantes.results.filter((v) => v.quedan > 0 && v.quedan <= minimo).length;
    expect(esperadas).toBeGreaterThan(0);
    expect((await pedirTablero()).pendientes.porAgotarse).toBe(esperadas);
    await poner({});
  });

  it('CA1: el margen de la contraentrega del mes, con sus dos fletes', async () => {
    expect((await pedirTablero()).contraentrega).toEqual({
      cerrados: 3,
      devueltos: 1,
      cobradoCop: 190000,
      costosCop: 3500 + 12000 + 10000 + 9000 + 9000,
      netoCop: 100000 - 15500 + (90000 - 10000) - 18000,
      sinCostos: 1,
      enCamino: 1,
    });
  });

  it('❌ la liquidación se atrasa por días hábiles, no por días calendario', () => {
    // Recaudado el miércoles 22 de marzo; el lunes 27 van 3 hábiles (jueves, viernes y lunes).
    const recaudado = Date.parse('2028-03-22T16:00:00-05:00');
    expect(liquidacionAtrasada(recaudado, Date.parse('2028-03-27T09:00:00-05:00'))).toBe(false);
    expect(liquidacionAtrasada(recaudado, Date.parse('2028-03-28T09:00:00-05:00'))).toBe(true);
    // El lunes 20 es San José: recaudado el viernes 17, el jueves 23 van 3 hábiles.
    const antesDelFestivo = Date.parse('2028-03-17T16:00:00-05:00');
    expect(liquidacionAtrasada(antesDelFestivo, Date.parse('2028-03-23T09:00:00-05:00'))).toBe(
      false,
    );
    expect(liquidacionAtrasada(antesDelFestivo, Date.parse('2028-03-24T09:00:00-05:00'))).toBe(
      true,
    );
  });

  it('❌ otra tienda no ve nada de esta', async () => {
    const t = await pedirTablero(T0, DOS);
    expect(t.hoy).toMatchObject({ pedidos: 1, ventasCop: 555000 });
    expect(t.mes.pedidos).toBe(1);
    expect(t.pendientes).toMatchObject({
      porConfirmar: 0,
      cobrosARevisar: 0,
      solicitudesVencidas: 0,
    });
    expect(t.contraentrega.cerrados).toBe(0);
  });

  it('❌ CA3: en otro huso, el tablero da lo mismo', async () => {
    const enBogota = await pedirTablero();
    for (const huso of HUSOS) {
      process.env['TZ'] = huso;
      expect(await pedirTablero(), huso).toEqual(enBogota);
    }
  });

  it('❌ CA3: cada día de un año bisiesto, a cualquier hora y en cualquier huso, los meses se restan con el calendario', () => {
    const desde = Date.parse('2028-01-01T00:00:00-05:00');
    const conHuso = new Map<string, ReturnType<typeof periodos>[]>();
    for (const huso of HUSOS) {
      process.env['TZ'] = huso;
      const todos: ReturnType<typeof periodos>[] = [];
      for (let dia = 0; dia < 366; dia++) {
        for (const minuto of [0, 7 * 60 + 15, 23 * 60 + 59]) {
          todos.push(periodos(desde + dia * 86_400_000 + minuto * 60_000));
        }
      }
      conHuso.set(huso, todos);
    }
    const base = conHuso.get('UTC') ?? [];
    expect(base).toHaveLength(366 * 3);
    for (const [huso, todos] of conHuso) expect(todos, huso).toEqual(base);

    for (const p of base) {
      const hoy = fechaEnBogota(Date.parse(p.hoy.hasta) - 1);
      const [anio, mes, dia] = hoy.split('-').map(Number) as [number, number, number];
      const [anioAnt, mesAnt] = mes === 1 ? [anio - 1, 12] : [anio, mes - 1];
      const ultimo = new Date(Date.UTC(anioAnt, mesAnt, 0)).getUTCDate();
      const prefijo = `${anioAnt}-${String(mesAnt).padStart(2, '0')}`;
      // El mes anterior empieza el 1 a las 00:00 de Colombia.
      expect(p.anterior.desde).toBe(
        new Date(Date.parse(`${prefijo}-01T00:00:00-05:00`)).toISOString(),
      );
      expect(p.mes.desde).toBe(
        new Date(Date.parse(`${hoy.slice(0, 8)}01T00:00:00-05:00`)).toISOString(),
      );
      expect(p.hoy.desde).toBe(new Date(Date.parse(`${hoy}T00:00:00-05:00`)).toISOString());
      expect(p.anteriorCompleto).toBe(dia > ultimo);
      expect(p.altura).toBe(`${prefijo}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`);
      if (p.anteriorCompleto) expect(p.anterior.hasta).toBe(p.mes.desde);
      else {
        // El mismo día y la misma hora del mes anterior.
        const hora = Date.parse(p.hoy.hasta) - Date.parse(p.hoy.desde);
        expect(Date.parse(p.anterior.hasta) - Date.parse(`${p.altura}T00:00:00-05:00`)).toBe(hora);
      }
    }
    // Los bordes, dichos: el 29 de febrero contra el 29 de enero; el 31 de marzo, febrero entero;
    // el 1 de enero, el 1 de diciembre del año anterior.
    const de = (f: string) =>
      base.find((p) => p.hoy.desde === new Date(Date.parse(`${f}T00:00:00-05:00`)).toISOString());
    expect(de('2028-02-29')).toMatchObject({ altura: '2028-01-29', anteriorCompleto: false });
    expect(de('2028-03-30')).toMatchObject({ altura: '2028-02-29', anteriorCompleto: true });
    expect(de('2028-03-29')).toMatchObject({ altura: '2028-02-29', anteriorCompleto: false });
    expect(de('2028-01-01')).toMatchObject({ altura: '2027-12-01', anteriorCompleto: false });
  });
});
