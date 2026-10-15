/**
 * HU-T9.1, HU-T9.2 y HU-T9.3 por la API del panel: con tokens del CORE firmados de verdad, contra
 * el shard local con los dos comercios de prueba, una KEK de prueba y pedidos sembrados aquí. El
 * comprador de prueba se llama «Ensayo Dos Compradora»: ninguna respuesta del panel lo dice en
 * claro, salvo «Ver datos de entrega» y el mensaje de «Confirmar por WhatsApp», que quedan registradas.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type ContactoDelPedido, cifrarContacto } from './bandeja.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';
const UNO = ENSAYO_UNO.org;
const M = 'v-camisa-m-arena'; // 4 en inventario
const S = 'v-camisa-s-arena'; // 1 en inventario
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 7)).toString('base64');
const COMPRADORA: ContactoDelPedido = {
  nombre: 'Ensayo Dos Compradora',
  celular: '3001234567',
  direccion: 'Calle de prueba 99, apto 101',
  ciudad: 'Medellín',
};
/** Lo que nunca debe salir en claro por fuera de «Ver datos de entrega». */
const EN_CLARO = ['Compradora', '3001234567', '1234567', 'Calle de prueba 99'];

let shard: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const codigoDe = (n: number) =>
  Array.from({ length: 6 }, (_, i) => ALFABETO[Math.floor(n / 32 ** i) % 32]).join('');
const HUELLA = 'a'.repeat(64);

/** Un pedido de la tienda Uno con una línea. Devuelve su id. */
async function sembrarPedido(
  n: number,
  o: {
    forma?: string;
    estado?: string;
    atencion?: string | null;
    variante?: string;
    cantidad?: number;
    contacto?: ContactoDelPedido;
    creado?: string;
  } = {},
) {
  const id = `ped-${String(n).padStart(4, '0')}`;
  const cantidad = o.cantidad ?? 1;
  const total = 129000 * cantidad;
  const creado = o.creado ?? new Date(T0 - (2000 - n) * 60_000).toISOString();
  await shard.batch([
    shard
      .prepare(
        `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
           ciudad, atencion, terminos_huella, aceptado, cambiado_por, creado, actualizado)
         VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?, 'Medellín', ?, ?, ?, 'comprador', ?, ?)`,
      )
      .bind(
        UNO,
        id,
        codigoDe(n),
        1000 + n,
        o.estado ?? 'pendiente',
        o.forma ?? 'transferencia',
        total,
        total,
        o.atencion ?? null,
        HUELLA,
        creado,
        creado,
        creado,
      ),
    shard
      .prepare(
        `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones,
           precio_unitario_cop, cantidad, total_cop)
         VALUES (?, ?, 1, 'p-camisa', ?, 'Camisa de lino', 'Talla: M · Color: Arena', 129000, ?, ?)`,
      )
      .bind(UNO, id, o.variante ?? M, cantidad, total),
  ]);
  if (o.contacto) {
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    const s = await cifrarContacto({ db: shard, org: UNO }, kek, id, o.contacto, AHORA);
    await shard
      .prepare(
        `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, creado, purgar_despues)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(UNO, id, s.sobre, s.iv, s.version, AHORA, AHORA)
      .run();
  }
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
  firmante = await firmanteDesde(await generarClavePrivada());
  // 120 pedidos viejos, sin contacto, para paginar; dos con algo que atender.
  for (let n = 1; n <= 120; n++)
    await sembrarPedido(n, { atencion: n === 3 || n === 7 ? 'monto' : null });
}, 120_000);
afterAll(async () => cerrar?.());

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  TIENDA_KEK_V1: KEK,
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

/** Cada respuesta que pasa por aquí se guarda, para buscar en todas lo que no debe salir (CA2). */
const respuestas: { ruta: string; texto: string }[] = [];
const pedir = async (ruta: string, cuerpo?: unknown, t?: string) => {
  const r = await crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
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
  respuestas.push({ ruta, texto: await r.clone().text() });
  return r;
};

type Pagina = {
  atencion: { numero: number }[];
  pedidos: { id: string; numero: number; comprador: unknown }[];
  siguiente: string | null;
};

let ops = 0;
const op = () => `op-pedidos-${++ops}`.padEnd(12, '0');

describe('la bandeja de pedidos (HU-T9.1)', () => {
  it('CA1: de a 50, del más nuevo al más viejo, con cursor; lo que necesita atención va aparte', async () => {
    const vistos: number[] = [];
    let cursor: string | null = null;
    let paginas = 0;
    do {
      const r = await pedir(
        `/api/panel/v1/pedidos${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      expect(r.status).toBe(200);
      const p = (await r.json()) as Pagina;
      if (paginas === 0) expect(p.atencion.map((a) => a.numero).sort()).toEqual([1003, 1007]);
      else expect(p.atencion).toEqual([]);
      vistos.push(...p.pedidos.map((x) => x.numero));
      cursor = p.siguiente;
      paginas++;
    } while (cursor);
    expect(paginas).toBe(3);
    expect(vistos).toHaveLength(120);
    expect(vistos).toEqual([...vistos].sort((a, b) => b - a));
    expect(new Set(vistos).size).toBe(120);
  });

  it('❌ CA3: el comprador sale tapado («Ensayo D.», «300 ••• 4567»)', async () => {
    const id = await sembrarPedido(201, { contacto: COMPRADORA, creado: AHORA });
    const p = (await (await pedir('/api/panel/v1/pedidos')).json()) as Pagina;
    expect(p.pedidos.find((x) => x.id === id)?.comprador).toEqual({
      nombre: 'Ensayo D.',
      celular: '300 ••• 4567',
    });
    const detalle = await (await pedir(`/api/panel/v1/pedidos/${id}`)).json();
    expect(detalle).toMatchObject({
      numero: 1201,
      conContacto: true,
      comprador: { nombre: 'Ensayo D.', celular: '300 ••• 4567' },
      lineas: [{ nombre: 'Camisa de lino', cantidad: 1, totalCop: 129000 }],
    });
  });

  it('❌ otra tienda no ve estos pedidos, y un rol fuera de la matriz no entra', async () => {
    const dos = await token({ org: ENSAYO_DOS.org });
    const p = (await (await pedir('/api/panel/v1/pedidos', undefined, dos)).json()) as Pagina;
    expect(p.pedidos).toEqual([]);
    expect((await pedir('/api/panel/v1/pedidos/ped-0001', undefined, dos)).status).toBe(404);
    const otro = await token({ rol: 'contador' });
    expect((await pedir('/api/panel/v1/pedidos', undefined, otro)).status).toBe(403);
  });
});

describe('ver los datos de entrega deja huella (HU-T9.2)', () => {
  it('CA1: los abre para ese pedido, y queda en su historia y en el registro', async () => {
    const id = await sembrarPedido(202, { contacto: COMPRADORA, creado: AHORA });
    const r = await pedir('/api/panel/v1/pedidos/contacto', { pedido: id });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: 'ok', contacto: COMPRADORA });
    const detalle = (await (await pedir(`/api/panel/v1/pedidos/${id}`)).json()) as {
      historia: { tipo: string; quien: string }[];
    };
    expect(detalle.historia).toContainEqual(
      expect.objectContaining({ tipo: 'contacto_leido', quien: 'Tú' }),
    );
    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas[0]?.frase).toBe('Tú viste los datos de entrega del pedido #1202');
  });

  it('un pedido sin datos de entrega lo dice, y no deja huella', async () => {
    const r = await pedir('/api/panel/v1/pedidos/contacto', { pedido: 'ped-0010' });
    expect(r.status).toBe(404);
    expect(await r.json()).toMatchObject({ estado: 'sin-contacto' });
    const leidos = await shard
      .prepare("SELECT COUNT(*) AS n FROM pedido_evento WHERE pedido_id = 'ped-0010'")
      .first<{ n: number }>();
    expect(leidos?.n).toBe(0);
  });

  it('❌ otra tienda no los abre', async () => {
    const r = await pedir(
      '/api/panel/v1/pedidos/contacto',
      { pedido: 'ped-0202' },
      await token({ org: ENSAYO_DOS.org }),
    );
    expect(r.status).toBe(404);
  });
});

describe('confirmar por WhatsApp y confirmar (HU-T9.3)', () => {
  const stock = async (v: string) =>
    (
      await shard
        .prepare('SELECT stock FROM variante WHERE org_id = ? AND id = ?')
        .bind(UNO, v)
        .first<{ stock: number }>()
    )?.stock;

  it('CA1: el mensaje lleva el resumen, la dirección y la cuenta para transferir', async () => {
    await shard
      .prepare(
        `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por)
         VALUES (?, 'cobro', 1, ?, ?, 'sistema')
         ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos`,
      )
      .bind(
        UNO,
        JSON.stringify({
          transferencia: {
            banco: 'Banco de Prueba',
            tipoCuenta: 'ahorros',
            numero: '000-111222',
            titular: 'Comercio Ensayo Uno',
            documento: 'NIT 900000001-1',
          },
        }),
        AHORA,
      )
      .run();
    const id = await sembrarPedido(203, { contacto: COMPRADORA, cantidad: 2, creado: AHORA });
    const r = await pedir('/api/panel/v1/pedidos/whatsapp', { pedido: id });
    expect(r.status).toBe(200);
    const { url, mensaje } = (await r.json()) as { url: string; mensaje: string };
    expect(url.startsWith('https://wa.me/573001234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1] ?? '')).toBe(mensaje);
    expect(mensaje).toBe(
      [
        'Hola, Ensayo. Te escribimos de Comercio Ensayo Uno por tu pedido #1203:',
        '• 2 × Camisa de lino (Talla: M · Color: Arena): $258.000',
        'Total: $258.000',
        'Lo enviamos a: Calle de prueba 99, apto 101, Medellín.',
        'Para pagar, transfiere $258.000 a Banco de Prueba, cuenta de ahorros 000-111222, a nombre de Comercio Ensayo Uno (NIT 900000001-1), y mándanos el comprobante por aquí.',
        '¿Lo confirmamos?',
      ].join('\n'),
    );
    const registro = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(registro.filas[0]?.frase).toBe(
      'Tú abriste el WhatsApp del pedido #1203 con sus datos de entrega',
    );
  });

  it('sin datos de entrega, el mensaje sale igual y WhatsApp deja elegir el chat', async () => {
    const r = await pedir('/api/panel/v1/pedidos/whatsapp', { pedido: 'ped-0011' });
    expect(r.status).toBe(200);
    const { url, mensaje } = (await r.json()) as { url: string; mensaje: string };
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(
      mensaje.startsWith('Hola. Te escribimos de Comercio Ensayo Uno por tu pedido #1011:'),
    ).toBe(true);
  });

  it('CA2: confirmar descuenta el inventario en el mismo lote, con el pedido en el libro', async () => {
    const antes = await stock(M);
    const id = await sembrarPedido(204, { cantidad: 2, creado: AHORA });
    const r = await pedir('/api/panel/v1/pedidos/confirmar', { op: op(), pedido: id, version: 1 });
    expect(r.status).toBe(200);
    expect(await stock(M)).toBe((antes ?? 0) - 2);
    const libro = await shard
      .prepare(
        'SELECT delta, motivo, ref FROM movimiento_inventario WHERE org_id = ? AND variante_id = ? ORDER BY id DESC',
      )
      .bind(UNO, M)
      .first();
    expect(libro).toEqual({ delta: -2, motivo: 'venta', ref: id });
    const detalle = (await (await pedir(`/api/panel/v1/pedidos/${id}`)).json()) as {
      estado: string;
      lineas: { descontado: boolean }[];
      historia: { tipo: string; de: string; a: string; quien: string }[];
    };
    expect(detalle.estado).toBe('confirmado');
    expect(detalle.lineas.every((l) => l.descontado)).toBe(true);
    expect(detalle.historia).toContainEqual(
      expect.objectContaining({ tipo: 'estado', de: 'pendiente', a: 'confirmado', quien: 'Tú' }),
    );
    // Repetir la misma operación no descuenta dos veces.
    const otra = await pedir('/api/panel/v1/pedidos/confirmar', {
      op: `op-pedidos-${ops}`.padEnd(12, '0'),
      pedido: id,
      version: 1,
    });
    expect(otra.status).toBe(200);
    expect(await stock(M)).toBe((antes ?? 0) - 2);
  });

  it('❌ CA2: si no alcanza, lo dice y no confirma: nada cambia', async () => {
    const antes = await stock(S);
    const id = await sembrarPedido(205, { variante: S, cantidad: 3, creado: AHORA });
    const r = await pedir('/api/panel/v1/pedidos/confirmar', { op: op(), pedido: id, version: 1 });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({
      problemas: [
        {
          mensaje:
            'No alcanza: de «Camisa de lino (Talla: M · Color: Arena)» hay 1 y el pedido lleva 3. Habla con el comprador o ajusta el inventario antes de confirmar.',
        },
      ],
    });
    expect(await stock(S)).toBe(antes);
    const p = await shard
      .prepare('SELECT estado FROM pedido WHERE org_id = ? AND id = ?')
      .bind(UNO, id)
      .first<{ estado: string }>();
    expect(p?.estado).toBe('pendiente');
  });

  it('❌ CA3: la base no despacha un contra entrega sin confirmar ni confirma a mano un pago en línea', async () => {
    const ce = await sembrarPedido(206, { forma: 'contraentrega', creado: AHORA });
    await expect(
      shard
        .prepare(
          "UPDATE pedido SET estado = 'despachado', guia = 'G-1' WHERE org_id = ? AND id = ?",
        )
        .bind(UNO, ce)
        .run(),
    ).rejects.toThrow(/transicion-de-pedido-invalida|contraentrega-sin-guia/);
    const enLinea = await sembrarPedido(207, { forma: 'en_linea', creado: AHORA });
    await expect(
      shard
        .prepare("UPDATE pedido SET estado = 'confirmado' WHERE org_id = ? AND id = ?")
        .bind(UNO, enLinea)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
    const r = await pedir('/api/panel/v1/pedidos/confirmar', {
      op: op(),
      pedido: enLinea,
      version: 1,
    });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({
      problemas: [{ mensaje: expect.stringMatching(/^Este pedido se paga en línea/) }],
    });
  });

  it('una versión vieja responde 409 con la de ahora', async () => {
    const id = await sembrarPedido(208, { creado: AHORA });
    await shard
      .prepare("UPDATE pedido SET version = 2, ciudad = 'Bello' WHERE org_id = ? AND id = ?")
      .bind(UNO, id)
      .run();
    const r = await pedir('/api/panel/v1/pedidos/confirmar', { op: op(), pedido: id, version: 1 });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ estado: 'cambiado', version: 2 });
  });
});

describe('los datos del comprador no salen en claro (HU-T9.2 CA2)', () => {
  /** Las dos que leen el contacto, y cada lectura queda en la historia y en el registro. */
  const LEEN_EL_CONTACTO = ['/api/panel/v1/pedidos/contacto', '/api/panel/v1/pedidos/whatsapp'];

  it('❌ ninguna respuesta del panel los dice, salvo «Ver datos de entrega» y el WhatsApp', async () => {
    for (const ruta of [
      '/api/panel/v1/yo',
      '/api/panel/v1/pedidos',
      '/api/panel/v1/pedidos/ped-0201',
      '/api/panel/v1/registro',
      '/api/panel/v1/inventario',
      '/api/panel/v1/productos',
    ])
      await pedir(ruta);
    const conDatos = respuestas.filter(
      (r) => !LEEN_EL_CONTACTO.includes(r.ruta) && EN_CLARO.some((d) => r.texto.includes(d)),
    );
    expect(conDatos.map((r) => r.ruta)).toEqual([]);
    // Y la que sí los dice, los dijo: la búsqueda funciona.
    expect(
      respuestas.some(
        (r) => r.ruta === '/api/panel/v1/pedidos/contacto' && r.texto.includes('3001234567'),
      ),
    ).toBe(true);
    expect(respuestas.length).toBeGreaterThan(20);
  });
});
