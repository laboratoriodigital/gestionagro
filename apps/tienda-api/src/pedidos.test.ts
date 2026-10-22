/**
 * HU-T6.1, HU-T6.2 y HU-T6.3: pedir por WhatsApp y seguir el pedido. Contra el shard local con los
 * comercios de prueba, por la ruta de la API, como llega desde el despacho.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { opcionesEnPalabras, sha256, textoDelPedido } from './pedidos.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'a'.repeat(64);
const HOST = 'ensayo-uno--staging.mitiendapro.co';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

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
    shard
      .prepare(
        "INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, dias_min, dias_max) VALUES (?, 'e-med', 'Medellín', 8000, 1, 2)",
      )
      .bind(UNO),
  ]);
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

/** Un almacén con el manifiesto publicado: los términos de la versión 1. */
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
  tienda_c1_s1: shard,
  tienda_control: control,
  SITIOS: sitios,
  ...extra,
});
const post = (ruta: string, cuerpo: unknown, e: Env = env()) =>
  crearApp({ ahora: () => Date.parse(AHORA) }).request(
    `https://${HOST}${ruta}`,
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
const SECRETO_DEL_ENLACE = 'abcdefghijklmnopqrstuv';
const pedido = (extra: Record<string, unknown> = {}) => ({
  codigo: 'ABC123',
  lineas: [{ variante: M, cantidad: 2 }],
  forma: 'transferencia',
  envio: 'e-med',
  ciudad: 'Envigado',
  acepta: true,
  terminos: TERMINOS,
  seguimiento: SECRETO_DEL_ENLACE,
  totalVisto: 266000,
  ...extra,
});
const contar = async (codigo: string) =>
  (
    await shard
      .prepare('SELECT COUNT(*) AS n FROM pedido WHERE org_id = ? AND codigo = ?')
      .bind(UNO, codigo)
      .first<{ n: number }>()
  )?.n;

describe('pedir por WhatsApp (HU-T6.1)', () => {
  it('registra el pedido pendiente con su forma, la aceptación y el texto para WhatsApp (CA1, CA2)', async () => {
    const r = await post('/api/v1/pedidos', pedido());
    expect(r.status).toBe(200);
    const cuerpo = (await r.json()) as {
      estado: string;
      numero: number;
      texto: string;
      whatsapp: string;
    };
    expect(cuerpo).toMatchObject({
      estado: 'registrado',
      codigo: 'ABC123',
      numero: 1001,
      total: 266000,
    });
    expect(cuerpo.whatsapp).toBe('573000000001');
    expect(cuerpo.texto).toBe(
      [
        'Hola, Comercio Ensayo Uno. Quiero hacer este pedido:',
        '',
        'Pedido ABC123 · #1001',
        '- 2 × Camisa de lino (Talla: M · Color: Arena): $258.000',
        'Envío Medellín: $8.000',
        'Total: $266.000',
        'Forma de pago: Transferencia',
        'Ciudad de entrega: Envigado',
        '',
        `Sigue tu pedido: https://${HOST}/pedido/#c=ABC123&s=${SECRETO_DEL_ENLACE}`,
      ].join('\n'),
    );
    const fila = await shard
      .prepare(
        'SELECT estado, canal, forma_pago, terminos_huella, aceptado, seguimiento_huella FROM pedido WHERE org_id = ? AND codigo = ?',
      )
      .bind(UNO, 'ABC123')
      .first();
    expect(fila).toEqual({
      estado: 'pendiente',
      canal: 'whatsapp',
      forma_pago: 'transferencia',
      terminos_huella: TERMINOS,
      aceptado: AHORA,
      seguimiento_huella: await sha256(SECRETO_DEL_ENLACE),
    });
  });

  it('❌ tres envíos con el mismo código dejan un solo pedido y responden duplicado (CA3)', async () => {
    const respuestas = await Promise.all(
      [1, 2, 3].map(() => post('/api/v1/pedidos', pedido({ codigo: 'DPC234' }))),
    );
    const estados = await Promise.all(
      respuestas.map(async (r) => ((await r.json()) as { estado: string }).estado),
    );
    expect(estados.filter((e) => e === 'registrado')).toHaveLength(1);
    expect(estados.filter((e) => e === 'duplicado')).toHaveLength(2);
    expect(await contar('DPC234')).toBe(1);
  });

  it('❌ el mismo código con otro secreto no es el mismo pedido: no dice nada de él', async () => {
    const r = await post('/api/v1/pedidos', pedido({ seguimiento: 'zzzzzzzzzzzzzzzzzzzzzz' }));
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ estado: 'codigo-en-uso' });
  });

  it.each([
    [
      'una forma que la tienda no ofrece',
      { codigo: 'FRM234', forma: 'contraentrega' },
      422,
      'forma',
    ],
    [
      'términos que no son los publicados',
      { codigo: 'TRM234', terminos: 'b'.repeat(64) },
      409,
      'terminos',
    ],
    ['un total distinto del que vio', { codigo: 'TTT234', totalVisto: 100 }, 409, 'cambio'],
    [
      'más de lo que hay',
      {
        codigo: 'CNT234',
        lineas: [{ variante: 'v-camisa-s-arena', cantidad: 3 }],
        totalVisto: 395000,
      },
      409,
      'cambio',
    ],
  ])('❌ %s no registra nada', async (_caso, cambios, estadoHttp, estado) => {
    const r = await post('/api/v1/pedidos', pedido(cambios));
    expect(r.status).toBe(estadoHttp);
    expect(((await r.json()) as { estado: string }).estado).toBe(estado);
    expect(await contar((cambios as { codigo: string }).codigo)).toBe(0);
  });

  it.each([
    ['sin aceptar los términos', { acepta: false }],
    ['con la casilla en otra cosa que true', { acepta: 'si' }],
    ['por WhatsApp con pago en línea', { forma: 'en_linea' }],
    ['con un código con I', { codigo: 'ABCDEI' }],
  ])('❌ %s: 422', async (_caso, cambios) => {
    expect((await post('/api/v1/pedidos', pedido({ codigo: 'VAX234', ...cambios }))).status).toBe(
      422,
    );
  });

  it('❌ un producto solo para mayores exige la edad en su línea (Ley 1480 art. 52)', async () => {
    await shard
      .prepare("UPDATE producto SET solo_mayores = 1 WHERE org_id = ? AND id = 'p-camisa'")
      .bind(UNO)
      .run();
    try {
      const sin = await post('/api/v1/pedidos', pedido({ codigo: 'EDA234' }));
      expect(((await sin.json()) as { estado: string }).estado).toBe('edad');
      const con = await post(
        '/api/v1/pedidos',
        pedido({ codigo: 'EDA235', lineas: [{ variante: M, cantidad: 2, mayorDeEdad: true }] }),
      );
      expect(((await con.json()) as { estado: string }).estado).toBe('registrado');
    } finally {
      await shard
        .prepare("UPDATE producto SET solo_mayores = 0 WHERE org_id = ? AND id = 'p-camisa'")
        .bind(UNO)
        .run();
    }
  });

  it('❌ en la base: un pedido web sin aceptación no sale de pendiente, y uno por WhatsApp nunca queda pagado (CA4)', async () => {
    await shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado)
         VALUES (?, 'sin-aceptar', 'SNA234', 9001, 'pendiente', 'whatsapp', 'transferencia', 1000, 1000, 'prueba', ?, ?)`,
      )
      .bind(UNO, AHORA, AHORA)
      .run();
    await expect(
      shard
        .prepare(
          "UPDATE pedido SET estado = 'confirmado', cambiado_por = 'prueba' WHERE org_id = ? AND id = 'sin-aceptar'",
        )
        .bind(UNO)
        .run(),
    ).rejects.toThrow(/pedido-sin-aceptacion/);
    await expect(
      shard
        .prepare(
          "UPDATE pedido SET estado = 'pagado', cambiado_por = 'prueba' WHERE org_id = ? AND codigo = 'ABC123'",
        )
        .bind(UNO)
        .run(),
    ).rejects.toThrow();
  });
});

describe('el seguimiento (HU-T6.3) y el acuse (HU-T6.2)', () => {
  it('con su secreto: el estado en palabras, los pasos, las líneas y el total; nada del comprador (CA2)', async () => {
    const r = await post('/api/v1/seguimiento', { codigo: 'ABC123', secreto: SECRETO_DEL_ENLACE });
    expect(r.status).toBe(200);
    const s = await r.json();
    expect(s).toMatchObject({
      codigo: 'ABC123',
      numero: 1001,
      estado: 'pendiente',
      enPalabras: 'Recibido: la tienda lo va a confirmar',
      pasos: [{ estado: 'pendiente', instante: AHORA }],
      lineas: [
        {
          nombre: 'Camisa de lino',
          opciones: 'Talla: M · Color: Arena',
          cantidad: 2,
          total: 258000,
        },
      ],
      total: 266000,
      envioNombre: 'Medellín',
      plazo: 'Llega en 1 a 2 días',
      forma: 'Transferencia',
      guia: null,
    });
    expect(JSON.stringify(s)).not.toContain('Envigado');
    expect(s).not.toHaveProperty('ciudad');
  });

  it('❌ un código que no existe, un secreto malo o un cuerpo raro responden exactamente lo mismo (CA3)', async () => {
    const malas = await Promise.all([
      post('/api/v1/seguimiento', { codigo: 'NXE234', secreto: SECRETO_DEL_ENLACE }),
      post('/api/v1/seguimiento', { codigo: 'ABC123', secreto: 'zzzzzzzzzzzzzzzzzzzzzz' }),
      post('/api/v1/seguimiento', { codigo: 'SNA234', secreto: SECRETO_DEL_ENLACE }),
      post('/api/v1/seguimiento', { codigo: 'ABC123' }),
    ]);
    const cuerpos = await Promise.all(malas.map(async (r) => [r.status, await r.text()]));
    expect(new Set(cuerpos.map((c) => JSON.stringify(c))).size).toBe(1);
    expect(cuerpos[0]?.[0]).toBe(404);
  });

  it('❌ el secreto no llega a ningún registro', async () => {
    const espias = (['log', 'info', 'warn', 'error'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    await post('/api/v1/seguimiento', { codigo: 'ABC123', secreto: SECRETO_DEL_ENLACE });
    await post('/api/v1/pedidos', pedido({ codigo: 'RGS234' }), env({ SITIOS: undefined }));
    const escrito = espias.flatMap((e) => e.mock.calls.flat().map(String)).join('\n');
    expect(escrito).not.toContain(SECRETO_DEL_ENLACE);
    for (const e of espias) e.mockRestore();
  });
});

describe('las piezas del texto', () => {
  it('las opciones en palabras, y el texto sin descuento ni ciudad cuando no los hay', () => {
    expect(opcionesEnPalabras('[{"nombre":"Talla"},{"nombre":"Color"}]', 'M|Arena')).toBe(
      'Talla: M · Color: Arena',
    );
    expect(opcionesEnPalabras('[]', '')).toBe('');
    const texto = textoDelPedido({
      tienda: 'Pan',
      codigo: 'ABC123',
      numero: 1001,
      lineas: [{ nombre: 'Pan de bono', opciones: '', cantidad: 3, total: 4500 }],
      envio: null,
      descuento: { cupon: null, cop: 0 },
      total: 4500,
      forma: 'a_convenir',
      ciudad: null,
      enlace: null,
    });
    expect(texto).toBe(
      'Hola, Pan. Quiero hacer este pedido:\n\nPedido ABC123 · #1001\n- 3 × Pan de bono: $4.500\nTotal: $4.500\nForma de pago: Lo acordamos por WhatsApp',
    );
  });
});
