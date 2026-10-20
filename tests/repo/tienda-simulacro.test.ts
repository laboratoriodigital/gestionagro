/**
 * HU-T17.4 CA1: el simulacro de restauración de staging, contra una API de D1 de mentira hecha con
 * SQLite: la base de origen con Comercio Ensayo Uno, y cada base nueva que el simulacro crea. Lo
 * mismo que hará el flujo `simulacro-restauracion-tienda` contra la cuenta, sin tocarla.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { ENSAYO_UNO, siembraDelShard } from '../../packages/tienda-schema/src/ensayos.ts';
import {
  type ApiDeD1,
  destinoLocal,
  enTrozos,
  migracionesDelShard,
  simulacro,
} from '../../scripts/tienda/simulacro-de-restauracion.ts';

const AHORA = '2026-10-19T15:00:00.000Z';
const UNO = ENSAYO_UNO.org;

/** Una cuenta de D1 de mentira: cada base es un SQLite en memoria; los bytes salen como D1, en listas. */
function cuenta(o: { perder?: RegExp } = {}) {
  const bases = new Map<string, { nombre: string; db: DatabaseSync }>();
  const borradas: string[] = [];
  let n = 0;
  const nueva = (nombre: string) => {
    const id = `uuid-${++n}`;
    bases.set(id, { nombre, db: new DatabaseSync(':memory:') });
    return id;
  };
  const api: ApiDeD1 = {
    buscar: async (nombre) => [...bases].find(([, b]) => b.nombre === nombre)?.[0] ?? null,
    crear: async (nombre) => nueva(nombre),
    borrar: async (id) => {
      bases.get(id)?.db.close();
      bases.delete(id);
      borradas.push(id);
    },
    consultar: async (id, sql, params) => {
      const b = bases.get(id);
      if (!b) throw new Error(`no existe la base ${id}`);
      if (params) {
        return (b.db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[]).map(
          (f) =>
            Object.fromEntries(
              Object.entries(f).map(([k, v]) => [k, v instanceof Uint8Array ? [...v] : v]),
            ),
        );
      }
      // Un restaurador que pierde lo que se le diga: el simulacro tiene que verlo.
      b.db.exec(o.perder ? sql.replace(o.perder, '') : sql);
      return [];
    },
  };
  const origen = nueva('tienda_c1_s1_staging');
  const db = bases.get(origen)?.db as DatabaseSync;
  for (const m of migracionesDelShard()) db.exec(m);
  for (const s of siembraDelShard([ENSAYO_UNO], AHORA)) db.exec(s);
  // Un pedido con su contacto cifrado (bytes de verdad) y un registro.
  db.exec(`INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
      terminos_huella, aceptado, cambiado_por, creado, actualizado)
    VALUES ('${UNO}', 'ped-sim-1', 'SMC001', 1001, 'pendiente', 'whatsapp', 'transferencia', 129000, 129000,
      '${'a'.repeat(64)}', '${AHORA}', 'comprador', '${AHORA}', '${AHORA}')`);
  db.exec(`INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, creado, purgar_despues)
    VALUES ('${UNO}', 'ped-sim-1', X'00ff10', X'0102030405060708090a0b0c', 1, '${AHORA}', '2028-10-19T00:00:00.000Z')`);
  db.exec(`INSERT INTO registro (org_id, instante, actor, accion, entidad, entidad_id)
    VALUES ('${UNO}', '${AHORA}', 'sistema', 'producto.crear', 'producto', 'p-camisa')`);
  return { api, bases, borradas };
}

const opciones = (api: ApiDeD1, decir: string[]) => ({
  api,
  base: 'tienda_c1_s1_staging',
  org: UNO,
  instante: Date.parse(AHORA),
  migraciones: migracionesDelShard(),
  decir: (l: string) => void decir.push(l),
});

describe('el simulacro de restauración en staging (HU-T17.4 CA1)', () => {
  it('restaura a Ensayo Uno en una base vacía, compara las huellas tabla por tabla y la borra', async () => {
    const c = cuenta();
    const dicho: string[] = [];
    const r = await simulacro(opciones(c.api, dicho));
    expect(r.ok).toBe(true);
    expect(r.tablas.find((t) => t.tabla === 'pedido_contacto')).toEqual({
      tabla: 'pedido_contacto',
      filas: 1,
      igual: true,
    });
    expect(r.tablas.find((t) => t.tabla === 'producto')?.filas).toBe(ENSAYO_UNO.productos.length);
    // La base del simulacro ya no existe; la de staging sigue.
    expect(c.borradas).toEqual(['uuid-2']);
    expect([...c.bases.keys()]).toEqual(['uuid-1']);
    expect(dicho.at(-1)).toBe('Base tienda-simulacro-202610191500 borrada.');
  });

  it('bitácora tienda3 38: restaura en un D1 local, sin crear una base en la cuenta', async () => {
    const c = cuenta();
    const r = await simulacro({ ...opciones(c.api, []), destino: destinoLocal() });
    expect(r.ok).toBe(true);
    expect(r.tablas.find((t) => t.tabla === 'producto')?.filas).toBe(ENSAYO_UNO.productos.length);
    // ❌ La cuenta no ganó ni perdió una base: solo se leyó la de staging.
    expect([...c.bases.keys()]).toEqual(['uuid-1']);
    expect(c.borradas).toEqual([]);
  }, 60_000);

  it('❌ si algo no volvió, lo dice por tabla, y la base del simulacro igual se borra', async () => {
    const c = cuenta({ perder: /INSERT INTO pedido_contacto [^;]*;\n/ });
    const r = await simulacro(opciones(c.api, []));
    expect(r.ok).toBe(false);
    expect(r.tablas.filter((t) => !t.igual).map((t) => t.tabla)).toEqual(['pedido_contacto']);
    expect(c.borradas).toEqual(['uuid-2']);
  });

  it('❌ si la restauración falla a mitad, la base del simulacro también se borra', async () => {
    const c = cuenta({ perder: /INSERT INTO tienda / });
    await expect(simulacro(opciones(c.api, []))).rejects.toThrow();
    expect(c.borradas).toEqual(['uuid-2']);
  });

  it('cada trozo cabe en una consulta de la API y no parte una sentencia', () => {
    const sql = `${Array.from({ length: 50 }, (_, i) => `INSERT INTO x VALUES ('${'a'.repeat(100)}${i}')`).join(';\n')};\n`;
    const trozos = enTrozos(sql, 1_000);
    expect(trozos.length).toBeGreaterThan(5);
    for (const t of trozos) expect(t.length).toBeLessThanOrEqual(1_000);
    expect(trozos.join('')).toBe(sql);
  });
});
