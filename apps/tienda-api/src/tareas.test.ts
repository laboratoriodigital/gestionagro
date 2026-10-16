/**
 * HU-T17.1: las tareas periódicas de la Tienda. Contra el shard y la base de control locales con
 * los dos comercios de prueba (HU-T2.6), y KV y Telegram de mentira: qué toca a cada hora, que una
 * tarea que falla no tumba a las demás (CA3), que la salud diga si alguna se atrasó (CA1) y que
 * `TIENDA_HOSTS` se rehaga desde la base y avise si difería (CA2).
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  despachar,
  type EntornoDeTareas,
  estadoDeLasTareas,
  hostsEsperados,
  type KvDeTareas,
  PURGAS,
  purgarTienda,
  RECONSTRUIR_HOSTS,
  type Tarea,
  tocan,
} from './tareas.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-14T15:00:00.000Z';

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
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

function kv(inicial: Record<string, string> = {}): KvDeTareas & { datos: Map<string, string> } {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    get: async (k) => datos.get(k) ?? null,
    put: async (k, v) => {
      datos.set(k, v);
    },
  };
}

/** Un Telegram de mentira que guarda los textos enviados. */
function telegram() {
  const enviados: string[] = [];
  const fetchFalso = (async (_url: string, init: RequestInit) => {
    enviados.push((JSON.parse(String(init.body)) as { text: string }).text);
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
  return { enviados, fetchFalso };
}

const entorno = (extra: Partial<EntornoDeTareas> = {}): EntornoDeTareas => ({
  celda: 'c1',
  shards: [['tienda_c1_s1', shard]],
  control,
  hosts: kv(),
  flags: kv(),
  telegram: { token: 'x', chat: '1' },
  ...extra,
});

describe('qué toca en cada hora (HU-T17.1)', () => {
  it('cada hora, la diaria a las 3 a. m. de Bogotá y la semanal el lunes a esa hora', () => {
    expect(tocan(Date.parse('2026-10-14T15:00:00Z'))).toEqual(['hora']);
    expect(tocan(Date.parse('2026-10-14T08:00:00Z'))).toEqual(['hora', 'dia']);
    expect(tocan(Date.parse('2026-10-12T08:00:00Z'))).toEqual(['hora', 'dia', 'semana']);
    expect(tocan(Date.parse('2026-10-12T09:00:00Z'))).toEqual(['hora']);
  });
});

describe('el despacho de las tareas', () => {
  const ok: Tarea = { nombre: 'ok', frecuencia: 'hora', correr: async () => 'hecho' };
  const rota: Tarea = {
    nombre: 'rota',
    frecuencia: 'hora',
    correr: async () => {
      throw new Error('la base no respondió');
    },
  };
  const diaria: Tarea = { nombre: 'diaria', frecuencia: 'dia', correr: async () => 'hecho' };

  it('❌ una tarea que falla no tumba a las demás y deja su causa (CA3)', async () => {
    const flags = kv();
    const corridas = await despachar(entorno({ flags }), Date.parse(AHORA), [rota, ok, diaria]);
    expect(corridas).toEqual([
      { nombre: 'rota', ok: false, resumen: 'la base no respondió' },
      { nombre: 'ok', ok: true, resumen: 'hecho' },
    ]);
    expect(JSON.parse(flags.datos.get('tarea:rota') ?? '{}')).toMatchObject({ ok: false });
    expect(flags.datos.has('tarea:diaria')).toBe(false);
  });

  it('la salud dice si cada tarea va al día, se atrasó, falló o nunca corrió (CA1)', async () => {
    const flags = kv();
    await despachar(entorno({ flags }), Date.parse(AHORA), [rota, ok]);
    const ahora = Date.parse(AHORA);
    expect(await estadoDeLasTareas(flags, [ok, rota, diaria], ahora + 60_000)).toEqual({
      ok: 'al-dia',
      rota: 'fallo',
      diaria: 'nunca',
    });
    expect((await estadoDeLasTareas(flags, [ok], ahora + 3 * 3_600_000))['ok']).toBe('atrasada');
  });
});

describe('la diaria rehace TIENDA_HOSTS desde la base (CA2)', () => {
  it('cada hostname activo con su tienda, su shard y su canónico', async () => {
    const esperados = await hostsEsperados(entorno());
    const uno = JSON.parse(esperados.get(`h:${hostDeStaging(ENSAYO_UNO.slug)}`) ?? '{}');
    expect(uno).toEqual({
      org: ENSAYO_UNO.org,
      celda: 'c1',
      shard: 'tienda_c1_s1',
      version: null,
      canonico: hostDeStaging(ENSAYO_UNO.slug),
      estado: 'abierta',
      rol: 'canonico',
    });
    expect(esperados.size).toBe(2);
  });

  it('si está al día no escribe ni avisa', async () => {
    const t = telegram();
    const hosts = kv(Object.fromEntries(await hostsEsperados(entorno())));
    const resumen = await RECONSTRUIR_HOSTS.correr(
      entorno({ hosts, fetch: t.fetchFalso }),
      Date.parse(AHORA),
    );
    expect(resumen).toBe('2 direcciones al día');
    expect(t.enviados).toEqual([]);
  });

  it('❌ si el KV difiere o le falta una dirección, gana la base y avisa por Telegram', async () => {
    const t = telegram();
    const esperados = await hostsEsperados(entorno());
    const clave = `h:${hostDeStaging(ENSAYO_DOS.slug)}`;
    const hosts = kv({ [clave]: JSON.stringify({ org: 'otra', celda: 'c9' }) });
    const resumen = await RECONSTRUIR_HOSTS.correr(
      entorno({ hosts, fetch: t.fetchFalso }),
      Date.parse(AHORA),
    );
    expect(resumen).toBe('2 corregidas');
    expect(Object.fromEntries(hosts.datos)).toEqual(Object.fromEntries(esperados));
    expect(t.enviados).toHaveLength(1);
    expect(t.enviados[0]).toContain(`${hostDeStaging(ENSAYO_DOS.slug)}: difería`);
    expect(t.enviados[0]).toContain(`${hostDeStaging(ENSAYO_UNO.slug)}: faltaba`);
  });
});

describe('las purgas diarias (HU-T17.2)', () => {
  /** Las 3 a. m. de Bogotá del 20 nov 2026: la papelera vence lo borrado hasta el 21 oct a esta hora. */
  const INSTANTE = Date.parse('2026-11-20T08:00:00.000Z');
  const TREINTA_DIAS = '2026-10-21T08:00:00.000Z';
  const CASI_TREINTA = '2026-10-21T08:00:00.001Z';
  const MUY_VIEJO = '2026-09-01T00:00:00.000Z';
  const HUELLA = 'a'.repeat(64);

  const correr = (sql: string, ...valores: unknown[]) =>
    shard
      .prepare(sql)
      .bind(...valores)
      .run();
  const hay = async (sql: string, ...valores: unknown[]) =>
    (
      await shard
        .prepare(sql)
        .bind(...valores)
        .first<{ n: number }>()
    )?.n ?? 0;

  /** Un producto con una variante, foto, enlace a una colección, libro de inventario y «avísame». */
  async function producto(org: string, id: string, borrado: string | null, enColeccion: string) {
    await correr(
      `INSERT INTO producto (org_id, id, slug, nombre, estado, creado, actualizado, borrado)
       VALUES (?, ?, ?, ?, 'archivado', ?, ?, ?)`,
      org,
      id,
      id,
      `Producto ${id}`,
      AHORA,
      AHORA,
      borrado,
    );
    await correr(
      'INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado) VALUES (?, ?, ?, ?, 1000, 5, ?)',
      org,
      `${id}-v`,
      id,
      'unica',
      AHORA,
    );
    await correr(
      'UPDATE variante SET stock = 4, actualizado = ? WHERE org_id = ? AND id = ?',
      AHORA,
      org,
      `${id}-v`,
    );
    await correr(
      `INSERT INTO medio (org_id, id, producto_id, ancho, alto, formatos, creado)
       VALUES (?, ?, ?, 800, 800, '{"400":1}', ?)`,
      org,
      HUELLA,
      id,
      AHORA,
    );
    await correr(
      'INSERT INTO interes_reposicion (org_id, variante_id, personas, desde, ultimo) VALUES (?, ?, 1, ?, ?)',
      org,
      `${id}-v`,
      AHORA,
      AHORA,
    );
    await correr(
      'INSERT INTO coleccion_producto (org_id, coleccion_id, producto_id) VALUES (?, ?, ?)',
      org,
      enColeccion,
      id,
    );
  }
  const coleccion = (org: string, id: string, borrado: string | null) =>
    correr(
      'INSERT INTO coleccion (org_id, id, slug, nombre, actualizado, borrado) VALUES (?, ?, ?, ?, ?, ?)',
      org,
      id,
      id,
      `Colección ${id}`,
      AHORA,
      borrado,
    );
  const envio = (org: string, id: string, borrado: string) =>
    correr(
      "INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, borrado) VALUES (?, ?, 'Envío', 0, ?)",
      org,
      id,
      borrado,
    );
  const operacion = (org: string, op: string, creada: string) =>
    correr(
      "INSERT INTO operacion (org_id, op, ruta, respuesta, creada) VALUES (?, ?, '/x', '{}', ?)",
      org,
      op,
      creada,
    );
  const existe = (tabla: string, org: string, id: string) =>
    hay(`SELECT count(*) AS n FROM ${tabla} WHERE org_id = ? AND id = ?`, org, id);

  beforeAll(async () => {
    for (const org of [ENSAYO_UNO.org, ENSAYO_DOS.org]) {
      await coleccion(org, 'pz-viva', null);
      await coleccion(org, 'pz-col-vieja', MUY_VIEJO);
      await coleccion(org, 'pz-col-casi', CASI_TREINTA);
      await producto(org, 'pz-viejo', TREINTA_DIAS, 'pz-viva');
      await producto(org, 'pz-casi', CASI_TREINTA, 'pz-col-vieja');
      await producto(org, 'pz-vendido', MUY_VIEJO, 'pz-viva');
      await envio(org, 'pz-env-viejo', TREINTA_DIAS);
      await envio(org, 'pz-env-casi', CASI_TREINTA);
      await operacion(org, 'pz-op-vieja', '2026-11-18T08:00:00.000Z');
      await operacion(org, 'pz-op-nueva', '2026-11-18T08:00:00.001Z');
    }
    // El producto vendido: una de sus variantes está en un pedido.
    await correr(
      `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop, cambiado_por, creado, actualizado)
       VALUES (?, 'pz-pedido', 'PZK234', 7001, 'pendiente', 'whatsapp', 'transferencia', 1000, 1000, 'prueba', ?, ?)`,
      ENSAYO_UNO.org,
      AHORA,
      AHORA,
    );
    await correr(
      `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, precio_unitario_cop, cantidad, total_cop)
       VALUES (?, 'pz-pedido', 1, 'pz-vendido', 'pz-vendido-v', 'Producto pz-vendido', 1000, 1, 1000)`,
      ENSAYO_UNO.org,
    );
  });

  it('CA1 · purga la tienda: lo que cumplió su plazo se va con todo lo suyo, y nada de otra tienda', async () => {
    const r = await purgarTienda(
      shard,
      ENSAYO_UNO.org,
      TREINTA_DIAS,
      '2026-11-18T08:00:00.000Z',
      AHORA,
    );
    const uno = ENSAYO_UNO.org;
    expect(await existe('producto', uno, 'pz-viejo')).toBe(0);
    expect(await existe('variante', uno, 'pz-viejo-v')).toBe(0);
    expect(
      await hay(
        'SELECT count(*) AS n FROM medio WHERE org_id = ? AND producto_id = ?',
        uno,
        'pz-viejo',
      ),
    ).toBe(0);
    expect(
      await hay(
        'SELECT count(*) AS n FROM movimiento_inventario WHERE org_id = ? AND variante_id = ?',
        uno,
        'pz-viejo-v',
      ),
    ).toBe(0);
    expect(
      await hay(
        'SELECT count(*) AS n FROM interes_reposicion WHERE org_id = ? AND variante_id = ?',
        uno,
        'pz-viejo-v',
      ),
    ).toBe(0);
    expect(await existe('coleccion', uno, 'pz-col-vieja')).toBe(0);
    expect(await existe('envio_opcion', uno, 'pz-env-viejo')).toBe(0);
    expect(
      await hay(
        'SELECT count(*) AS n FROM operacion WHERE org_id = ? AND op = ?',
        uno,
        'pz-op-vieja',
      ),
    ).toBe(0);
    expect(r.retenidos).toBe(1);
    expect(r.filas).toBeGreaterThanOrEqual(10);
    // Ensayo Dos tiene lo mismo y no se tocó.
    expect(await existe('producto', ENSAYO_DOS.org, 'pz-viejo')).toBe(1);
    expect(await existe('coleccion', ENSAYO_DOS.org, 'pz-col-vieja')).toBe(1);
  });

  it('CA2 ❌ · nada se purga antes de su plazo, ni un milisegundo', async () => {
    const uno = ENSAYO_UNO.org;
    expect(await existe('producto', uno, 'pz-casi')).toBe(1);
    expect(await existe('variante', uno, 'pz-casi-v')).toBe(1);
    expect(await existe('coleccion', uno, 'pz-col-casi')).toBe(1);
    expect(await existe('envio_opcion', uno, 'pz-env-casi')).toBe(1);
    expect(
      await hay(
        'SELECT count(*) AS n FROM operacion WHERE org_id = ? AND op = ?',
        uno,
        'pz-op-nueva',
      ),
    ).toBe(1);
    // Una colección viva conserva sus enlaces a productos vivos.
    expect(await existe('coleccion', uno, 'pz-viva')).toBe(1);
  });

  it('un producto vendido se queda en la papelera: el pedido nombra su variante (P21)', async () => {
    const uno = ENSAYO_UNO.org;
    expect(await existe('producto', uno, 'pz-vendido')).toBe(1);
    expect(await existe('variante', uno, 'pz-vendido-v')).toBe(1);
  });

  it('la tarea diaria purga cada tienda de cada shard con el reloj de su corrida', async () => {
    const corridas = await despachar(entorno(), INSTANTE, [PURGAS]);
    expect(corridas).toEqual([
      {
        nombre: 'purgas',
        ok: true,
        resumen: expect.stringMatching(
          /^\d+ filas purgadas; 1 productos vendidos se quedan en la papelera$/,
        ),
      },
    ]);
    const dos = ENSAYO_DOS.org;
    expect(await existe('producto', dos, 'pz-viejo')).toBe(0);
    expect(await existe('producto', dos, 'pz-vendido')).toBe(0);
    expect(await existe('producto', dos, 'pz-casi')).toBe(1);
    // El día anterior a las 3 a. m. la diaria no toca: nada se corre fuera de su hora.
    expect(tocan(INSTANTE - 60 * 60 * 1000)).toEqual(['hora']);
  });
});
