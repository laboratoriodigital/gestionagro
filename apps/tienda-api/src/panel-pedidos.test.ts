/**
 * HU-T9.1, HU-T9.2 y HU-T9.3 por la API del panel: con tokens del CORE firmados de verdad, contra
 * el shard local con los dos comercios de prueba, una KEK de prueba y pedidos sembrados aquí. El
 * comprador de prueba se llama «Ensayo Dos Compradora»: ninguna respuesta del panel lo dice en
 * claro, salvo «Ver datos de entrega», que queda registrada.
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

describe('los datos del comprador no salen en claro (HU-T9.2 CA2)', () => {
  /** La que lee el contacto, y cada lectura queda en la historia y en el registro. */
  const LEEN_EL_CONTACTO = ['/api/panel/v1/pedidos/contacto'];

  it('❌ ninguna respuesta del panel los dice, salvo «Ver datos de entrega»', async () => {
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
    expect(respuestas.length).toBeGreaterThan(15);
  });
});
