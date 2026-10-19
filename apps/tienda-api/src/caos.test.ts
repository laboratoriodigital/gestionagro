/**
 * HU-T11.10: la batería de caos del cobro, antes de un cliente real (TIENDA §14.1 y §16). Contra el
 * D1 de workerd, con muchas solicitudes a la vez: la última unidad entre 50 compradores, 100 cobros
 * simultáneos, avisos repetidos y en desorden, Bold caído o saturado, un KV con un hostname viejo y
 * publicar mientras entran pedidos.
 *
 * CA3 ❌, en cada corrida: no se vende de más, no se cobra dos veces y ningún caso fallido parece
 * pagado (`sinVenderDeMasNiCobrarDosVeces`).
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
import { crearDespacho } from '../../tienda-sitio/src/worker.ts';
import { COBROS_ABIERTOS_POR_TIENDA } from './cobros.ts';
import { conciliarTienda } from './conciliar.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { type Almacen, publicar } from './publicar.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-19T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-caos';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'f'.repeat(64);
const HOST = 'ensayo-uno--staging.laboratorio-digital.app';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 81)).toString('base64');
/** La última unidad: la S arena tiene una sola. */
const ULTIMA = 'v-camisa-s-arena';
/** Sin contar: la L azul se deja sin inventario contado, para los 100 cobros. */
const SIN_CONTAR = 'v-camisa-l-azul';

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
  cerrar.push(s.cerrar, c.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  const venta = ENSAYO_UNO.ajustes['venta'] as Record<string, unknown>;
  await shard.batch([
    shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO),
    ajuste('venta', { ...venta, modo: 'ambos' }),
    shard
      .prepare('UPDATE variante SET stock = NULL WHERE org_id = ? AND id = ?')
      .bind(UNO, SIN_CONTAR),
  ]);
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  const dek = await dekDeCredenciales(shard, UNO, kek, AHORA);
  for (const [campo, valor] of [
    ['identidad', 'identidad-de-caos-0001'],
    ['secreta', 'secreta-de-caos-0002'],
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
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const objetos = new Map<string, string>();
const sitios: Almacen = {
  put: async (k, v) => void objetos.set(k, v),
  get: async (k) => {
    const guardado = objetos.get(k);
    if (guardado !== undefined) return { text: async () => guardado };
    if (k === `sitios/${UNO}/1/manifiesto.json`)
      return {
        text: async () =>
          JSON.stringify({ archivos: { '/legal/terminos/index.md': { huella: TERMINOS } } }),
      };
    const t = objetos.get(k);
    return t === undefined ? null : { text: async () => t };
  },
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
  instante = AHORA,
  extra: Record<string, string> = {},
) =>
  crearApp({ ahora: () => Date.parse(instante), enSegundoPlano: () => undefined }).request(
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

/** Un código de Crockford distinto por comprador: dos letras y cuatro dígitos. */
const codigo = (prefijo: string, n: number) => `${prefijo}${String(n).padStart(4, '0')}`;
const cobro = (cod: string, variante: string, precio: number) =>
  JSON.stringify({
    codigo: cod,
    lineas: [{ variante, cantidad: 1 }],
    acepta: true,
    terminos: TERMINOS,
    seguimiento: `seguimiento-${cod}-xxxxxxxxxxx`.slice(0, 22),
    token: `token-${cod}-xxxxxxxxxxxxxxx`.slice(0, 22),
    totalVisto: precio,
    entrega: { nombre: 'Compradora de caos', celular: '3001234567' },
  });

const uno = async <T>(sql: string, ...v: unknown[]) =>
  (await shard
    .prepare(sql)
    .bind(...v)
    .first<T>()) as T;

/** CA3 ❌: lo que nunca puede pasar, en ninguna corrida. */
async function sinVenderDeMasNiCobrarDosVeces() {
  // Ninguna combinación con más apartado del que hay, ni con existencias negativas.
  expect(
    await uno<{ n: number }>(
      'SELECT count(*) AS n FROM variante WHERE org_id = ? AND (reservado < 0 OR (stock IS NOT NULL AND (stock < 0 OR reservado > stock)))',
      UNO,
    ),
  ).toEqual({ n: 0 }); // vender de más
  // Un pedido, a lo sumo un cobro aprobado.
  expect(
    await uno<{ n: number }>(
      `SELECT count(*) AS n FROM (SELECT pedido_id FROM cobro WHERE org_id = ?
         AND estado IN ('aprobado', 'aprobado_sin_existencias') GROUP BY pedido_id HAVING count(*) > 1)`,
      UNO,
    ),
  ).toEqual({ n: 0 }); // dos cobros aprobados
  // Una línea sale del inventario una sola vez.
  expect(
    await uno<{ n: number }>(
      `SELECT count(*) AS n FROM (SELECT ref, variante_id FROM movimiento_inventario WHERE org_id = ?
         AND motivo = 'venta' GROUP BY ref, variante_id HAVING count(*) > 1)`,
      UNO,
    ),
  ).toEqual({ n: 0 }); // dos salidas del inventario
  // Pagado solo con un cobro que Bold aprobó: ningún caso fallido (rechazado, vencido) parece pagado.
  // Uno anulado después del pago sigue pagado hasta que el comercio lo mueva (HU-T11.7).
  expect(
    await uno<{ n: number }>(
      `SELECT count(*) AS n FROM pedido p WHERE p.org_id = ? AND p.estado = 'pagado' AND NOT EXISTS
         (SELECT 1 FROM cobro k WHERE k.org_id = p.org_id AND k.pedido_id = p.id
           AND k.estado IN ('aprobado', 'aprobado_sin_existencias', 'reembolsado'))`,
      UNO,
    ),
  ).toEqual({ n: 0 }); // pagado sin cobro aprobado
}

const firmar = (cuerpo: string) =>
  createHmac('sha256', '').update(Buffer.from(cuerpo).toString('base64')).digest('hex');
const aviso = (tipo: string, referencia: string, total: number, pago = `pago-${referencia}`) =>
  JSON.stringify({
    id: `aviso-${tipo}-${pago}`,
    type: tipo,
    subject: pago,
    data: {
      payment_id: pago,
      amount: { currency: 'COP', total },
      metadata: { reference: referencia },
      payment_method: 'PSE',
    },
  });
const avisar = (cuerpo: string, instante: string) =>
  pedir('/api/v1/avisos/bold', cuerpo, instante, { 'x-bold-signature': firmar(cuerpo) });

describe('la batería de caos del cobro (HU-T11.10)', () => {
  it('la última unidad entre 50 compradores a la vez: uno la aparta, los demás lo saben', async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        pedir('/api/v1/cobros', cobro(codigo('PA', i), ULTIMA, 129000)),
      ),
    );
    const estados = await Promise.all(
      respuestas.map(async (r) => ((await r.json()) as { estado: string }).estado),
    );
    expect(estados.filter((e) => e === 'registrado')).toHaveLength(1);
    expect(
      estados
        .filter((e) => e !== 'registrado')
        .every((e) => e === 'sin-existencias' || e === 'cambio'),
    ).toBe(true);
    expect(
      await uno('SELECT stock, reservado FROM variante WHERE org_id = ? AND id = ?', UNO, ULTIMA),
    ).toEqual({
      stock: 1,
      reservado: 1,
    });
    // Los que no alcanzaron no dejaron pedido ni cobro.
    expect(
      await uno<{ n: number }>(
        "SELECT count(*) AS n FROM cobro WHERE org_id = ? AND id LIKE 'PA%'",
        UNO,
      ),
    ).toEqual({
      n: 1,
    });
    await sinVenderDeMasNiCobrarDosVeces();
  }, 120_000);

  it(`100 cobros a la vez: la tienda abre como mucho ${COBROS_ABIERTOS_POR_TIENDA}, y ninguno se pierde ni se repite`, async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        pedir('/api/v1/cobros', cobro(codigo('CB', i), SIN_CONTAR, 129000)),
      ),
    );
    const estados = await Promise.all(
      respuestas.map(async (r) => ((await r.json()) as { estado: string }).estado),
    );
    const registrados = estados.filter((e) => e === 'registrado').length;
    expect(registrados).toBeGreaterThan(0);
    const abiertos = await uno<{ n: number }>(
      "SELECT count(*) AS n FROM cobro WHERE org_id = ? AND estado = 'esperando' AND vence > ?",
      UNO,
      AHORA,
    );
    expect(abiertos.n).toBeLessThanOrEqual(COBROS_ABIERTOS_POR_TIENDA);
    expect(estados.filter((e) => e !== 'registrado').every((e) => e === 'ocupada')).toBe(true);
    // Cada registrado es un pedido con su cobro, y ningún código quedó con dos.
    expect(
      await uno<{ n: number }>(
        "SELECT count(*) AS n FROM pedido p JOIN cobro k ON k.org_id = p.org_id AND k.pedido_id = p.id WHERE p.org_id = ? AND p.codigo LIKE 'CB%'",
        UNO,
      ),
    ).toEqual({ n: registrados });
    await sinVenderDeMasNiCobrarDosVeces();
  }, 120_000);

  it('avisos repetidos y en desorden, a la vez: cada pago cuenta una vez, y la anulación que llega antes espera', async () => {
    const cobros = (
      await shard
        .prepare(
          "SELECT id, monto_cop FROM cobro WHERE org_id = ? AND estado = 'esperando' ORDER BY id LIMIT 10",
        )
        .bind(UNO)
        .all<{ id: string; monto_cop: number }>()
    ).results;
    expect(cobros.length).toBe(10);
    const avisos: [string, string][] = [];
    cobros.forEach((k, i) => {
      const venta = aviso('SALE_APPROVED', k.id, k.monto_cop);
      avisos.push([venta, '2026-10-19T15:05:00.000Z'], [venta, '2026-10-19T15:05:01.000Z']);
      // A los pares, la anulación de ese pago llega primero.
      if (i % 2 === 0)
        avisos.unshift([aviso('VOID_APPROVED', k.id, k.monto_cop), '2026-10-19T15:04:00.000Z']);
    });
    const desordenados = avisos.sort((a, b) => ((a[0].length * 7 + b[0].length) % 3) - 1);
    const respuestas = await Promise.all(desordenados.map(([c, t]) => avisar(c, t)));
    expect(respuestas.every((r) => r.status === 200)).toBe(true);
    // Lo que quede de anulaciones que llegaron antes de su venta lo aplica la conciliación.
    await conciliarTienda(
      { db: shard, org: UNO, ahora: '2026-10-19T15:06:00.000Z', kekTexto: KEK },
      Date.parse('2026-10-19T15:06:00.000Z'),
      (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch,
    );
    const finales = (
      await shard
        .prepare(
          `SELECT id, estado FROM cobro WHERE org_id = ? AND id IN (${cobros.map(() => '?').join(', ')}) ORDER BY id`,
        )
        .bind(UNO, ...cobros.map((k) => k.id))
        .all<{ id: string; estado: string }>()
    ).results;
    expect(finales.every((k) => ['aprobado', 'reembolsado'].includes(k.estado))).toBe(true);
    await sinVenderDeMasNiCobrarDosVeces();
  }, 120_000);

  it.each([500, 429] as const)(
    'con Bold respondiendo %s, la conciliación no da nada por pagado ni pierde un cobro',
    async (estado) => {
      const antes = await uno<{ n: number }>(
        "SELECT count(*) AS n FROM cobro WHERE org_id = ? AND estado = 'esperando'",
        UNO,
      );
      const vuelta = await conciliarTienda(
        { db: shard, org: UNO, ahora: '2026-10-19T16:00:00.000Z', kekTexto: KEK },
        Date.parse('2026-10-19T16:00:00.000Z'),
        (async () => new Response('{"error":"x"}', { status: estado })) as unknown as typeof fetch,
      );
      if (estado === 429) expect(vuelta.saltada).toBe(true);
      else expect(vuelta.fallas).toBeGreaterThan(0);
      expect(vuelta.movidos).toBe(0);
      expect(
        await uno<{ n: number }>(
          "SELECT count(*) AS n FROM cobro WHERE org_id = ? AND estado = 'esperando'",
          UNO,
        ),
      ).toEqual(antes);
      await sinVenderDeMasNiCobrarDosVeces();
    },
  );

  it('un KV con el hostname viejo de otra versión: el despacho no sirve lo de nadie más, y lo dice', async () => {
    const despacho = crearDespacho();
    const r = await despacho.fetch(new Request(`https://${HOST}/`), {
      // Apunta a una versión que ya no tiene manifiesto (purgada, o de antes de un «Volver a esta»).
      TIENDA_HOSTS: {
        get: async () =>
          JSON.stringify({ org: UNO, celda: 'c1', shard: 'tienda_c1_s1', version: 77 }),
      },
      SITIOS_C1: sitios,
    });
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain(ENSAYO_DOS.nombre);
  });

  it('publicar mientras entran pedidos: los dos terminan, y la publicación no toca el inventario', async () => {
    const antes = await uno<{ stock: number; reservado: number }>(
      'SELECT stock, reservado FROM variante WHERE org_id = ? AND id = ?',
      UNO,
      'v-camisa-m-arena',
    );
    const [publicada, ...pedidos] = await Promise.all([
      publicar({
        shard,
        shardNombre: 'tienda_c1_s1',
        control,
        sitios,
        hosts: { put: async () => undefined },
        celda: 'c1',
        release: 'r1',
        org: UNO,
        pedidaPor: 'usuario:prueba',
        ahora: AHORA,
        omitir: ['sin-foto', 'pago-en-linea'],
      }),
      ...Array.from({ length: 20 }, (_, i) =>
        pedir(
          '/api/v1/pedidos',
          JSON.stringify({
            codigo: codigo('PB', i),
            lineas: [{ variante: 'v-camisa-m-arena', cantidad: 1 }],
            forma: 'transferencia',
            acepta: true,
            terminos: TERMINOS,
            seguimiento: `seguimiento-PB${i}-xxxxxxxxxxx`.slice(0, 22),
            totalVisto: 129000,
          }),
        ),
      ),
    ]);
    expect(publicada?.estado, JSON.stringify(publicada)).toBe('publicada');
    expect(pedidos.every((r) => r.status === 200)).toBe(true);
    // Los pedidos por WhatsApp no apartan; la publicación no mueve existencias.
    expect(
      await uno(
        'SELECT stock, reservado FROM variante WHERE org_id = ? AND id = ?',
        UNO,
        'v-camisa-m-arena',
      ),
    ).toEqual(antes);
    await sinVenderDeMasNiCobrarDosVeces();
  }, 120_000);
});
