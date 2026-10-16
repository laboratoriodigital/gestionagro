/**
 * HU-T17.3: el respaldo semanal de cada tienda. Contra el shard local con los comercios de prueba,
 * un almacén R2 de mentira y un Telegram de mentira: qué lleva el archivo, que los datos personales
 * van en sus sobres y se pueden abrir con lo que trae el respaldo y la KEK (CA2), que un respaldo
 * que no cuadra con la base avisa (CA2 ❌) y que se guardan 4 semanales y 3 mensuales (CA1).
 * Ningún dato es de una persona real.
 */
import { abrirDek, descifrarSobre, importarKek, type Proposito } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cifrarContacto } from './bandeja.ts';
import { dekVigente, KEK_VIGENTE } from './llaves.ts';
import {
  type AlmacenDeRespaldos,
  claveDeRespaldo,
  type Respaldo,
  respaldarTienda,
  respaldosQueSobran,
} from './respaldos.ts';
import { type EntornoDeTareas, RESPALDOS } from './tareas.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
/** Un lunes a las 3 a. m. de Bogotá: cuando toca la semanal. */
const T0 = Date.UTC(2026, 9, 19, 8);
const AHORA = new Date(T0).toISOString();
const UNO = ENSAYO_UNO.org;
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 7)).toString('base64');
const CONTACTO = {
  nombre: 'Ensayo Dos Compradora',
  celular: '3001234567',
  direccion: 'Calle de prueba 99',
};

let shard: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const correr = (sql: string, ...v: unknown[]) =>
  shard
    .prepare(sql)
    .bind(...v)
    .run();

/** Un pedido de Ensayo Uno, con su línea y, si se da, su contacto cifrado como lo cifra la API. */
async function pedido(id: string, codigo: string, estado: string, contacto?: typeof CONTACTO) {
  await correr(
    `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
       terminos_huella, aceptado, cambiado_por, creado, actualizado)
     VALUES (?, ?, ?, ?, ?, 'whatsapp', 'transferencia', 129000, 129000, ?, ?, 'comprador', ?, ?)`,
    UNO,
    id,
    codigo,
    Number(codigo.slice(-2)) + 4000,
    estado,
    'a'.repeat(64),
    AHORA,
    AHORA,
    AHORA,
  );
  await correr(
    `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones,
       precio_unitario_cop, cantidad, total_cop)
     VALUES (?, ?, 1, 'p-camisa', 'v-camisa-m-arena', 'Camisa de lino', 'Talla: M · Color: Arena', 129000, 1, 129000)`,
    UNO,
    id,
  );
  if (contacto) {
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    const s = await cifrarContacto({ db: shard, org: UNO }, kek, id, contacto, AHORA);
    await correr(
      `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, creado, purgar_despues)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      UNO,
      id,
      s.sobre,
      s.iv,
      s.version,
      AHORA,
      '2028-10-19T08:00:00.000Z',
    );
  }
}

/** Un R2 de mentira que lista de a 2, para que se use el cursor. */
function almacen(): AlmacenDeRespaldos & { datos: Map<string, string> } {
  const datos = new Map<string, string>();
  return {
    datos,
    put: async (k, v) => void datos.set(k, v),
    get: async (k) => {
      const t = datos.get(k);
      return t === undefined ? null : { text: async () => t };
    },
    list: async ({ prefix, cursor }) => {
      const claves = [...datos.keys()].filter((k) => k.startsWith(prefix)).sort();
      const desde = Number(cursor ?? 0);
      const pagina = claves.slice(desde, desde + 2);
      return {
        objects: pagina.map((key) => ({ key })),
        truncated: desde + 2 < claves.length,
        ...(desde + 2 < claves.length ? { cursor: String(desde + 2) } : {}),
      };
    },
    delete: async (k) => {
      for (const x of Array.isArray(k) ? k : [k]) datos.delete(x);
    },
  };
}

function telegram() {
  const enviados: string[] = [];
  const fetchFalso = (async (_url: string, init: RequestInit) => {
    enviados.push((JSON.parse(String(init.body)) as { text: string }).text);
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { enviados, fetchFalso };
}

const entorno = (a: AlmacenDeRespaldos, t: ReturnType<typeof telegram>): EntornoDeTareas => ({
  celda: 'c1',
  shards: [['tienda_c1_s1', shard]],
  control: shard,
  hosts: { get: async () => null, put: async () => undefined },
  flags: { get: async () => null, put: async () => undefined },
  telegram: { token: 't', chat: 'c' },
  almacen: a,
  medios: 'img--staging.laboratorio-digital.app',
  fetch: t.fetchFalso,
});

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  shard = s.db;
  cerrar.push(s.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  // Uno entregado, con su contacto, y uno por confirmar: «Descargar todo» deja este fuera.
  await pedido('ped-resp-1', 'RSP001', 'entregado', CONTACTO);
  await pedido('ped-resp-2', 'RSP002', 'pendiente');
  // La llave de las credenciales de Bold existe, pero no viaja en el respaldo.
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  await dekVigente(shard, UNO, 'credenciales', kek, AHORA);
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('HU-T17.3 · el respaldo semanal de cada tienda', () => {
  it('CA1: la semanal respalda cada tienda en respaldos/<org>/<fecha>.json, con todos sus pedidos', async () => {
    const a = almacen();
    const t = telegram();
    const resumen = await RESPALDOS.correr(entorno(a, t), T0);
    expect(resumen).toBe('2 tiendas respaldadas');
    expect(t.enviados).toEqual([]);
    expect([...a.datos.keys()].sort()).toEqual(
      [ENSAYO_UNO.org, ENSAYO_DOS.org].map((o) => `respaldos/${o}/2026-10-19.json`).sort(),
    );
    const r = JSON.parse(a.datos.get(claveDeRespaldo(UNO, T0)) ?? '{}') as Respaldo;
    expect(r.formato).toBe('tienda-respaldo/1');
    expect(r.tienda.formato).toBe('tienda-export/1');
    // El pedido por confirmar no está en la exportación, pero sí en el respaldo.
    expect(r.tienda.excluidos.pedidosEnCurso).toBe(1);
    expect(r.pedidos.pedidos.map((p) => p['codigo'])).toEqual(['RSP001', 'RSP002']);
    expect(r.pedidos.lineas).toHaveLength(2);
    // No lo descargó nadie: el registro de la tienda no lo cuenta como «Descargar todo».
    expect(
      await shard
        .prepare("SELECT count(*) AS n FROM registro WHERE org_id = ? AND accion LIKE 'exportar%'")
        .bind(UNO)
        .first<{ n: number }>(),
    ).toEqual({ n: 0 });
    expect(r.recuentos).toEqual({
      productos: ENSAYO_UNO.productos.length,
      pedidos: 2,
      lineas: 2,
      contactos: 1,
      solicitudes: 0,
    });
  });

  it('❌ CA2: los datos personales van en sus sobres, nunca en claro, y se abren con el respaldo y la KEK', async () => {
    const a = almacen();
    await respaldarTienda(shard, UNO, a, T0, undefined);
    const texto = a.datos.get(claveDeRespaldo(UNO, T0)) ?? '';
    for (const dato of Object.values(CONTACTO)) expect(texto).not.toContain(dato);
    expect(texto).not.toContain(KEK);

    // Restaurar: solo con lo que trae el archivo y la KEK, que vive fuera de él.
    const r = JSON.parse(texto) as Respaldo;
    const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'));
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    const llave = r.llaves.find((l) => l.proposito === 'datos_personales');
    if (!llave) throw new Error('el respaldo no trae la llave de los datos personales');
    expect(r.llaves.map((l) => l.proposito)).not.toContain('credenciales');
    const dek = await abrirDek(
      {
        org: UNO,
        proposito: llave.proposito as Proposito,
        version: llave.version,
        kekId: llave.kekId,
        envuelta: new TextDecoder().decode(bytes(llave.envuelta)),
      },
      new Map([[kek.id, kek]]),
    );
    const [c] = r.sobres.contactos;
    if (!c) throw new Error('el respaldo no trae el contacto');
    const abierto = await descifrarSobre(
      new Map([[dek.version, dek]]),
      { org: UNO, tabla: 'pedido_contacto', campo: 'sobre', id: c.pedidoId },
      { sobre: bytes(c.sobre), iv: bytes(c.iv), version: c.llaveVersion },
    );
    expect(JSON.parse(abierto)).toMatchObject(CONTACTO);
  });

  it('❌ CA2: un respaldo que no cuadra con la base no se guarda como bueno y avisa por Telegram', async () => {
    const a = almacen();
    const t = telegram();
    // La exportación lee hasta 5.000 productos: uno de más en la base basta para que no cuadre.
    const antes = await shard
      .prepare('SELECT count(*) AS n FROM producto WHERE org_id = ?')
      .bind(UNO)
      .first<{ n: number }>();
    const original = shard.prepare.bind(shard);
    const conUnoDeMas = new Proxy(shard, {
      get: (b, k) =>
        k === 'prepare'
          ? (sql: string) =>
              original(
                sql.startsWith('SELECT count(*) AS n FROM producto')
                  ? sql.replace('count(*)', 'count(*) + 1')
                  : sql,
              )
          : Reflect.get(b, k),
    });
    await expect(
      RESPALDOS.correr({ ...entorno(a, t), shards: [['tienda_c1_s1', conUnoDeMas]] }, T0),
    ).rejects.toThrow(/respaldos con fallas/);
    expect(t.enviados).toHaveLength(1);
    expect(t.enviados[0]).toContain(
      `${UNO}: no cuadra con la base: productos ${antes?.n} de ${(antes?.n ?? 0) + 1}`,
    );
    expect(a.datos.has(claveDeRespaldo(UNO, T0))).toBe(false);
  });

  it('CA1: se guardan las 4 últimas y la primera de cada uno de los 3 últimos meses', async () => {
    const semanas = Array.from({ length: 14 }, (_, i) => T0 - i * 7 * 24 * 3_600_000);
    const claves = semanas.map((t) => claveDeRespaldo(UNO, t));
    const fechas = (ks: string[]) => ks.map((k) => k.slice(-15, -5)).sort();
    expect(fechas(claves.filter((k) => !respaldosQueSobran(claves).includes(k)))).toEqual([
      '2026-08-03',
      '2026-09-07',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);

    // Por la tarea: después de 14 semanas quedan esas 6 en el almacén, ni una más.
    const a = almacen();
    for (const t of [...semanas].reverse()) await respaldarTienda(shard, UNO, a, t, undefined);
    expect(fechas([...a.datos.keys()])).toEqual([
      '2026-08-03',
      '2026-09-07',
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
  });
});
