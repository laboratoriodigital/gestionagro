/**
 * HU-C3.3: una organización nueva nace en una celda de su producto, con los pilotos contados por
 * producto (PLATAFORMA §4.9). En la base de prueba del CORE.
 */
import type { BaseD1 } from '@ed1/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PILOTOS_MAXIMOS, SinCeldaDisponible } from './asignacion.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { type ProductoDelCatalogo, sentenciasDelCatalogo } from './catalogo.ts';
import { crearOrganizacion } from './repositorio.ts';

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
}, 60_000);
afterAll(async () => cerrar?.());

const ensayo: ProductoDelCatalogo = {
  id: 'ensayo',
  nombre: 'Producto Ensayo',
  estado: 'activo',
  tipos: ['comercio'],
  roles: [{ id: 'dueno', administra: true, invitable: false }],
  planes: [{ id: 'gratis', nombre: 'Gratis', gratuito: true }],
};
const reloj = () => Date.UTC(2026, 9, 6, 12);
let n = 0;
const persona = async () => {
  const id = `u-${++n}`;
  await db
    .prepare('INSERT INTO usuario (id, nombre, email, creado) VALUES (?, ?, ?, ?)')
    .bind(id, `Persona ${n}`, `p${n}@example.com`, '2026-10-06')
    .run();
  return id;
};
const celda = (id: string, producto: string, shards: string[], estado = 'activa') =>
  db
    .prepare(
      'INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES (?, ?, ?, ?, 0, ?)',
    )
    .bind(id, producto, `https://api-${id}`, estado, JSON.stringify(shards))
    .run();
const nueva = async (producto: string) =>
  crearOrganizacion(
    db,
    producto === 'agro'
      ? { propietarioId: await persona(), nombre: 'Finca Ensayo', tipo: 'finca' }
      : {
          propietarioId: await persona(),
          nombre: 'Comercio Ensayo',
          tipo: 'comercio',
          producto,
          rolQueAdministra: 'dueno',
        },
    reloj,
  );

beforeEach(async () => {
  await vaciarCore(db);
  for (const s of sentenciasDelCatalogo([ensayo], '2026-10-06T00:00:00.000Z')) {
    await db.prepare(s).run();
  }
  await celda('c0', 'agro', ['agro_c0_s1']);
  await celda('c1', 'ensayo', ['ensayo_c1_s1', 'ensayo_c1_s2']);
});

describe('asignación por producto (HU-C3.3)', () => {
  it('CA1: cada organización va a una celda de su producto, con su plan gratuito y su rol', async () => {
    const finca = await nueva('agro');
    const comercio = await nueva('ensayo');
    expect(finca).toMatchObject({ celda_id: 'c0', plan: 'gratuito' });
    expect(comercio).toMatchObject({ celda_id: 'c1', plan: 'gratis', tipo: 'comercio' });
    expect(
      await db
        .prepare('SELECT producto, rol FROM membresia WHERE org_id = ?')
        .bind(comercio.id)
        .first(),
    ).toEqual({ producto: 'ensayo', rol: 'dueno' });
  });

  it('CA1: dentro de su producto, reparte entre los shards por carga', async () => {
    const a = await nueva('ensayo');
    const b = await nueva('ensayo');
    expect([a.shard, b.shard].sort()).toEqual(['ensayo_c1_s1', 'ensayo_c1_s2']);
  });

  it('CA2: los pilotos se cuentan por producto', async () => {
    for (let i = 0; i < PILOTOS_MAXIMOS; i++) await nueva('agro');
    expect((await nueva('agro')).anillo).toBe(2);
    // Las fincas piloto no gastan los pilotos de otro producto.
    expect((await nueva('ensayo')).anillo).toBe(1);
  });

  it('CA3 ❌: sin una celda activa de su producto, no cae en la de otro', async () => {
    await db.prepare("UPDATE celda SET estado = 'fuera' WHERE id = 'c1'").run();
    await expect(nueva('ensayo')).rejects.toThrow(SinCeldaDisponible);
    await expect(nueva('otro')).rejects.toThrow(/no tiene ninguna celda/);
    expect(
      await db.prepare("SELECT COUNT(*) AS n FROM organizacion WHERE celda_id = 'c0'").first(),
    ).toEqual({ n: 0 });
  });
});
