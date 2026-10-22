/**
 * HU-T18.1 CA2 y HU-T18.3 CA2: lo que ya estaba en staging pasa a TiendaPro con dos migraciones.
 * Las bases se crean con el esquema de antes de cada una y se le siembra lo que había, como en
 * staging; después corre la migración. Ningún dato real.
 */
import type { BaseD1 } from '@ed1/d1';
import { archivosDeMigracion, baseLocal, sentenciasDe } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-22T15:00:00.000Z';
const VENCE = '2027-04-20T00:00:00.000Z';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const migracion = (base: 'tienda' | 'tienda-control', prefijo: string) => {
  const a = archivosDeMigracion(base).find((m) => m.nombre.startsWith(prefijo));
  if (!a) throw new Error(`no está la migración ${prefijo} de ${base}`);
  return a.sql;
};
const correr = async (db: BaseD1, sql: string) => {
  for (const s of sentenciasDe(sql)) await db.prepare(s).run();
};

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
    antesDe: '0019',
  });
  const c = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_control',
    base: 'tienda-control',
    antesDe: '0004',
  });
  shard = s.db;
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('HU-T18.3 CA2 · la tienda 0019: los planes retirados pasan a Pro o IA Pro', () => {
  it('Entrada e Intermedio a Pro, Alto a IA Pro, con su vencimiento; ❌ Gratis no cambia', async () => {
    for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
      await shard.prepare(sql.replace(/;$/, '')).run();
    const otra = (org: string, slug: string, plan: string) =>
      shard
        .prepare(
          `INSERT INTO tienda (org_id, slug, nombre, estado, plan, plan_vence, creado, actualizado)
           VALUES (?, ?, ?, 'abierta', ?, ?, ?, ?)`,
        )
        .bind(org, slug, `Comercio ${slug}`, plan, VENCE, AHORA, AHORA)
        .run();
    await shard
      .prepare("UPDATE tienda SET plan = 'entrada', plan_vence = ? WHERE org_id = ?")
      .bind(VENCE, ENSAYO_UNO.org)
      .run();
    await otra('org-intermedio', 'ensayo-intermedio', 'intermedio');
    await otra('org-alto', 'ensayo-alto', 'alto');
    await correr(shard, migracion('tienda', '0019'));
    const { results } = await shard
      .prepare('SELECT org_id, plan, plan_vence FROM tienda ORDER BY org_id')
      .all();
    expect(results).toEqual(
      [
        { org_id: ENSAYO_UNO.org, plan: 'pro', plan_vence: VENCE },
        { org_id: ENSAYO_DOS.org, plan: 'gratis', plan_vence: null },
        { org_id: 'org-intermedio', plan: 'pro', plan_vence: VENCE },
        { org_id: 'org-alto', plan: 'ia-pro', plan_vence: VENCE },
      ].sort((a, b) => a.org_id.localeCompare(b.org_id)),
    );
  });
});

describe('HU-T18.1 CA2 · el control 0004: las direcciones de plataforma pasan a mitiendapro.co', () => {
  it('cambia la zona y deja el nombre, el rol y el estado; ❌ un dominio propio no se toca', async () => {
    const fila = (hostname: string, org: string, tipo: string, rol: string, estado: string) =>
      control
        .prepare(
          `INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado)
           VALUES (?, ?, 'c1', ?, ?, ?, ?)`,
        )
        .bind(hostname, org, tipo, rol, estado, AHORA)
        .run();
    await fila(
      'ensayo-uno--staging.laboratorio-digital.app',
      'org-1',
      'plataforma',
      'alias',
      'activo',
    );
    await fila('www.tienda-uno.example', 'org-1', 'propio', 'canonico', 'activo');
    await fila(
      'pan-de-rosa--staging.laboratorio-digital.app',
      'org-2',
      'plataforma',
      'canonico',
      'activo',
    );
    await correr(control, migracion('tienda-control', '0004'));
    const { results } = await control
      .prepare('SELECT hostname, org_id, tipo, rol, estado FROM dominio ORDER BY org_id, hostname')
      .all();
    expect(results).toEqual([
      {
        hostname: 'ensayo-uno--staging.mitiendapro.co',
        org_id: 'org-1',
        tipo: 'plataforma',
        rol: 'alias',
        estado: 'activo',
      },
      {
        hostname: 'www.tienda-uno.example',
        org_id: 'org-1',
        tipo: 'propio',
        rol: 'canonico',
        estado: 'activo',
      },
      {
        hostname: 'pan-de-rosa--staging.mitiendapro.co',
        org_id: 'org-2',
        tipo: 'plataforma',
        rol: 'canonico',
        estado: 'activo',
      },
    ]);
  });
});
