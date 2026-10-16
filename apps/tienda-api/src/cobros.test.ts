/**
 * HU-T11.4: pagar en línea con el botón de Bold. Contra el shard local con Comercio Ensayo Uno, por
 * la ruta de la API, como llega desde el despacho. Las llaves de Bold son de mentira y van cifradas
 * en `credencial`, como las dejará HU-T11.2.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { firmaDeIntegridad } from '@ed1/pagos';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirContactos } from './bandeja.ts';
import { COBROS_ABIERTOS_POR_TIENDA } from './cobros.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-16T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'b'.repeat(64);
const HOST = 'ensayo-uno--staging.laboratorio-digital.app';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 11)).toString('base64');
const IDENTIDAD = 'identidad-de-prueba-0001';
const SECRETA = 'secreta-de-prueba-0002';

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
    // La M sin contar: los casos que no son de existencias no se gastan las 4 unidades.
    shard
      .prepare("UPDATE variante SET stock = NULL WHERE org_id = ? AND id = 'v-camisa-m-arena'")
      .bind(UNO),
    ajuste('venta', { ...venta, modo: 'ambos' }),
  ]);
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  const dek = await dekDeCredenciales(shard, UNO, kek, AHORA);
  for (const [campo, valor] of [
    ['identidad', IDENTIDAD],
    ['secreta', SECRETA],
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
const env = (extra: Record<string, unknown> = {}): Env => ({
  CELDA: 'c1',
  SECRETO_DESPACHO: SECRETO,
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  tienda_control: control,
  SITIOS: sitios,
  ...extra,
});
const pagar = (cuerpo: unknown, e: Env = env(), instante = AHORA) =>
  crearApp({ ahora: () => Date.parse(instante) }).request(
    `https://${HOST}/api/v1/cobros`,
    {
      method: 'POST',
      body: JSON.stringify(cuerpo),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    e,
  );

const M = 'v-camisa-m-arena';
const S = 'v-camisa-s-arena';
const cobro = (codigo: string, extra: Record<string, unknown> = {}) => ({
  codigo,
  lineas: [{ variante: M, cantidad: 1 }],
  acepta: true,
  terminos: TERMINOS,
  seguimiento: `seguimiento-${codigo}-xxxx`.slice(0, 22).padEnd(22, 'x'),
  token: `token-${codigo}-xxxxxxxxxxxx`.slice(0, 22),
  totalVisto: 129000,
  ciudad: 'Envigado',
  entrega: {
    nombre: 'Ensayo Dos Compradora',
    celular: '3001234567',
    direccion: 'Calle de prueba 99',
  },
  ...extra,
});
const uno = async <T>(sql: string, ...v: unknown[]) =>
  (await shard
    .prepare(sql)
    .bind(...v)
    .first<T>()) as T;
const n = async (sql: string, ...v: unknown[]) => (await uno<{ n: number }>(sql, ...v)).n;

interface Registrado {
  estado: string;
  codigo: string;
  numero: number;
  total: number;
  vence: string;
  boton: { libreria: string; checkout: Record<string, string> };
}

describe('pagar en línea: un lote (HU-T11.4 CA1)', () => {
  it('escribe el pedido por pagar, sus líneas, el contacto cifrado, el cobro de 15 minutos y el apartado', async () => {
    const r = await pagar(cobro('PAG001'));
    expect(r.status).toBe(200);
    const b = (await r.json()) as Registrado;
    expect(b).toMatchObject({ estado: 'registrado', codigo: 'PAG001', total: 129000 });
    expect(b.vence).toBe('2026-10-16T15:15:00.000Z');

    const p = await uno<{
      id: string;
      estado: string;
      canal: string;
      forma_pago: string;
      numero: number;
      aceptado: string;
    }>(
      "SELECT id, estado, canal, forma_pago, numero, aceptado FROM pedido WHERE org_id = ? AND codigo = 'PAG001'",
      UNO,
    );
    expect(p).toMatchObject({
      estado: 'por_pagar',
      canal: 'en_linea',
      forma_pago: 'en_linea',
      aceptado: AHORA,
    });
    expect(p.numero).toBe(b.numero);
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM pedido_linea WHERE org_id = ? AND pedido_id = ?',
        UNO,
        p.id,
      ),
    ).toBe(1);
    expect(
      await uno(
        'SELECT id, estado, ambiente, monto_cop, vence FROM cobro WHERE org_id = ? AND pedido_id = ?',
        UNO,
        p.id,
      ),
    ).toEqual({
      id: 'PAG001-1',
      estado: 'esperando',
      ambiente: 'pruebas',
      monto_cop: 129000,
      vence: '2026-10-16T15:15:00.000Z',
    });
    expect(
      await uno(
        'SELECT variante_id, cantidad, estado, vence FROM apartado WHERE org_id = ? AND cobro_id = ?',
        UNO,
        'PAG001-1',
      ),
    ).toEqual({ variante_id: M, cantidad: 1, estado: 'activo', vence: '2026-10-16T15:15:00.000Z' });
    expect(
      await uno('SELECT a FROM pedido_evento WHERE org_id = ? AND pedido_id = ?', UNO, p.id),
    ).toEqual({ a: 'por_pagar' });

    // El contacto, en su sobre: en la fila no se lee, y la tienda lo abre con su llave.
    const fila = await uno<{ sobre: ArrayBuffer }>(
      'SELECT sobre FROM pedido_contacto WHERE org_id = ? AND pedido_id = ?',
      UNO,
      p.id,
    );
    expect(Buffer.from(new Uint8Array(fila.sobre)).toString('latin1')).not.toContain('Ensayo Dos');
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    const abiertos = await abrirContactos(
      { db: shard, org: UNO, actor: 'usuario:prueba', instante: AHORA },
      kek,
      [p.id],
    );
    expect(abiertos.get(p.id)).toMatchObject({
      nombre: 'Ensayo Dos Compradora',
      celular: '3001234567',
      direccion: 'Calle de prueba 99',
      ciudad: 'Envigado',
    });
  });

  it('CA2: el botón va firmado con SHA-256 de orden, monto, COP y la llave secreta, y la secreta no sale', async () => {
    const r = await pagar(cobro('PAG002'));
    const texto = await r.text();
    const b = JSON.parse(texto) as Registrado;
    expect(b.boton.libreria).toBe('https://checkout.bold.co/library/boldPaymentButton.js');
    expect(b.boton.checkout).toMatchObject({
      orderId: 'PAG002-1',
      currency: 'COP',
      amount: '129000',
      apiKey: IDENTIDAD,
      integritySignature: await firmaDeIntegridad('PAG002-1', 129000, SECRETA),
      redirectionUrl: `https://${HOST}/pedido/pago/`,
      renderMode: 'embedded',
      expirationDate: '1792163700000000000',
    });
    expect(b.boton.checkout['description']).toBe('Pedido PAG002 · Comercio Ensayo Uno');
    expect(JSON.parse(b.boton.checkout['customerData'] ?? '{}')).toEqual({
      fullName: 'Ensayo Dos Compradora',
      phone: '3001234567',
      dialCode: '+57',
    });
    expect(texto).not.toContain(SECRETA);
    // El token queda solo como huella.
    const k = await uno<{ token_huella: string }>(
      "SELECT token_huella FROM cobro WHERE org_id = ? AND id = 'PAG002-1'",
      UNO,
    );
    expect(k.token_huella).toMatch(/^[0-9a-f]{64}$/);
  });

  it('reenviar el mismo pedido con el mismo token responde el mismo botón, sin otro cobro', async () => {
    const primero = (await (await pagar(cobro('PAG003'))).json()) as Registrado;
    const r = await pagar(cobro('PAG003'));
    expect(r.status).toBe(200);
    const otra = (await r.json()) as Registrado;
    expect(otra.estado).toBe('duplicado');
    expect(otra.boton).toEqual(primero.boton);
    expect(otra.numero).toBe(primero.numero);
    expect(
      await n("SELECT COUNT(*) AS n FROM cobro WHERE org_id = ? AND id LIKE 'PAG003-%'", UNO),
    ).toBe(1);
    // Con otro token no hay botón: el pedido ya existe y se sigue con su enlace.
    const ajeno = await pagar(cobro('PAG003', { token: 'otro-token-xxxxxxxxxxx' }));
    expect(ajeno.status).toBe(409);
    expect(await ajeno.json()).toMatchObject({ estado: 'pedido-existente' });
  });
});

describe('❌ la última unidad (HU-T11.4 CA3)', () => {
  it('el segundo comprador falla entero: sin pedido, sin cobro y sin gastar consecutivo', async () => {
    const ultima = (codigo: string) => cobro(codigo, { lineas: [{ variante: S, cantidad: 1 }] });
    const antes = await n('SELECT MAX(numero) AS n FROM pedido WHERE org_id = ?', UNO);
    const [a, b] = await Promise.all([pagar(ultima('RST001')), pagar(ultima('RST002'))]);
    const respuestas = [await a.json(), await b.json()] as { estado: string }[];
    const gano = respuestas.findIndex((x) => x.estado === 'registrado');
    expect(gano).toBeGreaterThanOrEqual(0);
    const perdio = respuestas[1 - gano] as { estado: string; variante: string; motivo: string };
    expect([a, b][1 - gano]?.status).toBe(409);
    expect(perdio).toMatchObject({ estado: 'sin-existencias', variante: S });
    expect(perdio.motivo).toContain('Camisa de lino');
    const codigoPerdedor = gano === 0 ? 'RST002' : 'RST001';
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM pedido WHERE org_id = ? AND codigo = ?',
        UNO,
        codigoPerdedor,
      ),
    ).toBe(0);
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM cobro WHERE org_id = ? AND id = ?',
        UNO,
        `${codigoPerdedor}-1`,
      ),
    ).toBe(0);
    expect(
      await n(
        'SELECT COUNT(*) AS n FROM apartado WHERE org_id = ? AND cobro_id = ?',
        UNO,
        `${codigoPerdedor}-1`,
      ),
    ).toBe(0);
    expect(await n('SELECT MAX(numero) AS n FROM pedido WHERE org_id = ?', UNO)).toBe(antes + 1);
    expect(
      await uno('SELECT stock, reservado FROM variante WHERE org_id = ? AND id = ?', UNO, S),
    ).toEqual({ stock: 1, reservado: 1 });
    // El siguiente pedido toma el número que sigue: el que falló no gastó ninguno.
    const otro = (await (await pagar(cobro('RST003'))).json()) as Registrado;
    expect(otro.numero).toBe(antes + 2);
  });

  it('pasados los 15 minutos, lo apartado vence al apartar otra vez y la unidad vuelve a estar', async () => {
    const despues = '2026-10-16T15:16:00.000Z';
    const r = await pagar(
      cobro('RST004', { lineas: [{ variante: S, cantidad: 1 }] }),
      env(),
      despues,
    );
    expect(r.status).toBe(200);
    expect(
      await n(
        "SELECT COUNT(*) AS n FROM apartado WHERE org_id = ? AND variante_id = ? AND estado = 'vencido' AND cerrado = ?",
        UNO,
        S,
        despues,
      ),
    ).toBe(1);
    expect(await uno('SELECT reservado FROM variante WHERE org_id = ? AND id = ?', UNO, S)).toEqual(
      {
        reservado: 1,
      },
    );
  });

  it(`con ${COBROS_ABIERTOS_POR_TIENDA} cobros abiertos, la tienda no abre otro`, async () => {
    const abiertos = await n(
      "SELECT COUNT(*) AS n FROM cobro WHERE org_id = ? AND estado = 'esperando' AND vence > ?",
      UNO,
      AHORA,
    );
    const faltan = COBROS_ABIERTOS_POR_TIENDA - abiertos;
    for (let i = 0; i < faltan; i++) {
      const codigo = `AB${String(i).padStart(4, '0')}`;
      const id = `pedido-abierto-${i}`;
      await shard.batch([
        shard
          .prepare(
            `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
               terminos_huella, aceptado, cambiado_por, creado, actualizado)
             VALUES (?, ?, ?, ?, 'por_pagar', 'en_linea', 'en_linea', 1500, 1500, ?, ?, 'comprador', ?, ?)`,
          )
          .bind(UNO, id, codigo, 5000 + i, TERMINOS, AHORA, AHORA, AHORA),
        shard
          .prepare(
            `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella, vence, creado, actualizado)
             VALUES (?, ?, ?, 'bold', 'pruebas', 1500, 'esperando', ?, '2026-10-16T15:15:00.000Z', ?, ?)`,
          )
          .bind(UNO, `${codigo}-1`, id, String(i).padStart(64, '0'), AHORA, AHORA),
      ]);
    }
    const r = await pagar(cobro('MXN001'));
    expect(r.status).toBe(429);
    expect(await r.json()).toMatchObject({ estado: 'ocupada' });
    expect(
      await n("SELECT COUNT(*) AS n FROM pedido WHERE org_id = ? AND codigo = 'MXN001'", UNO),
    ).toBe(0);
    // Vencidos, ya no cuentan.
    const luego = await pagar(cobro('MXN002'), env(), '2026-10-16T15:20:00.000Z');
    expect(luego.status).toBe(200);
  });
});

describe('cuándo no se cobra en línea', () => {
  const sinEscribir = async (codigo: string) =>
    expect(
      await n('SELECT COUNT(*) AS n FROM pedido WHERE org_id = ? AND codigo = ?', UNO, codigo),
    ).toBe(0);
  const despues = '2026-10-16T16:00:00.000Z';

  it('❌ con ks:tienda-cobros apagado, 503 y la página ofrece WhatsApp', async () => {
    const flags = { get: async (k: string) => (k === 'ks:tienda-cobros' ? 'apagado' : null) };
    const r = await pagar(cobro('NPX001'), env({ FLAGS: flags }), despues);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ estado: 'sin-linea' });
    await sinEscribir('NPX001');
  });

  it('❌ sin las llaves del ambiente en que cobra la tienda, ni la KEK, tampoco', async () => {
    await ajuste('cobro', { ambiente: 'produccion' }).run();
    try {
      const r = await pagar(cobro('NPX002'), env(), despues);
      expect(r.status).toBe(503);
      expect(await r.json()).toMatchObject({ estado: 'sin-linea' });
    } finally {
      await ajuste('cobro', {}).run();
    }
    const sinKek = await pagar(cobro('NPX003'), env({ TIENDA_KEK_V1: undefined }), despues);
    expect(sinKek.status).toBe(503);
    await sinEscribir('NPX002');
    await sinEscribir('NPX003');
  });

  it('❌ una tienda que solo vende por WhatsApp no cobra en línea', async () => {
    const venta = ENSAYO_UNO.ajustes['venta'] as Record<string, unknown>;
    await ajuste('venta', { ...venta, modo: 'whatsapp' }).run();
    try {
      const r = await pagar(cobro('NPX004'), env(), despues);
      expect(r.status).toBe(422);
      expect(await r.json()).toMatchObject({ estado: 'forma' });
    } finally {
      await ajuste('venta', { ...venta, modo: 'ambos' }).run();
    }
    await sinEscribir('NPX004');
  });

  it('❌ un total por encima del tope de la tienda, no', async () => {
    await ajuste('cobro', { topeCop: 100000 }).run();
    try {
      const r = await pagar(cobro('NPX005'), env(), despues);
      expect(r.status).toBe(422);
      expect(await r.json()).toMatchObject({ estado: 'monto' });
    } finally {
      await ajuste('cobro', {}).run();
    }
    await sinEscribir('NPX005');
  });

  it('❌ sin datos de entrega no se registra, y pasado el límite por IP responde 429', async () => {
    const { entrega: _, ...sinEntrega } = cobro('NPX006');
    expect((await pagar(sinEntrega, env(), despues)).status).toBe(422);
    let usados = 0;
    const limitador = { limit: async () => ({ success: usados++ < 1 }) };
    expect((await pagar(cobro('NPX007'), env({ LIMITE_COBROS: limitador }), despues)).status).toBe(
      200,
    );
    const r = await pagar(cobro('NPX008'), env({ LIMITE_COBROS: limitador }), despues);
    expect(r.status).toBe(429);
    expect(r.headers.get('retry-after')).toBe('60');
    await sinEscribir('NPX006');
    await sinEscribir('NPX008');
  });
});
