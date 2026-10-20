/**
 * HU-T13.7: dar de baja una tienda y el borrado criptográfico, sobre la base local. Después del
 * borrado, ningún contacto de esa tienda se puede descifrar, y sus respaldos ya no existen (CA2).
 * Ningún dato es de una persona real.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { textosLegales } from '@ed1/tienda-horno';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { borrarLasBajas, DIAS_DEL_BORRADO_EFECTIVO, darDeBaja } from './baja.ts';
import { cifrarContacto } from './bandeja.ts';
import type { QuienDelDominio } from './dominios.ts';
import { deksDeLaTienda, dekVigente, KEK_VIGENTE } from './llaves.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-20T15:00:00.000Z';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 61)).toString('base64');
const UNO = ENSAYO_UNO.org;
const DIA = 86_400_000;

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];
const hosts = new Map<string, string>();
const kv = {
  put: async (k: string, v: string) => void hosts.set(k, v),
  delete: async (k: string) => void hosts.delete(k),
};
const r2 = new Map<string, string>();
const almacen = {
  put: async (k: string, v: string) => void r2.set(k, v),
  get: async (k: string) => (r2.has(k) ? { text: async () => r2.get(k) ?? '' } : null),
  list: async ({ prefix }: { prefix: string }) => ({
    objects: [...r2.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
    truncated: false,
  }),
  delete: async (claves: string | string[]) => {
    for (const k of [claves].flat()) r2.delete(k);
  },
};

const quien = (org = UNO): QuienDelDominio => ({
  db: shard,
  org,
  actor: 'usuario:0199e0a0-0000-7000-8000-0000000000aa',
  instante: AHORA,
  control,
  celda: 'c1',
  shardNombre: 'tienda_c1_s1',
  hosts: kv,
});
let n = 0;
const op = () => `op-baja-${++n}-${'x'.repeat(8)}`;
const en = (dias: number) => new Date(Date.parse(AHORA) + dias * DIA).toISOString();

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
  hosts.set(`h:${hostDeStaging(ENSAYO_UNO.slug)}`, '{}');
  hosts.set(`h:${hostDeStaging(ENSAYO_DOS.slug)}`, '{}');
  r2.set(`respaldos/${UNO}/2026-10-13.json`, '{}');
  r2.set(`respaldos/${ENSAYO_DOS.org}/2026-10-13.json`, '{}');
}, 60_000);

afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('dar de baja una tienda (HU-T13.7)', () => {
  it('❌ sin escribir el nombre exacto, nada cambia', async () => {
    const r = await darDeBaja(quien(), null, { op: op(), nombre: 'Otro nombre' });
    expect(r).toMatchObject({ estado: 'problemas' });
    const t = await shard.prepare('SELECT estado FROM tienda WHERE org_id = ?').bind(UNO).first();
    expect(t).toEqual({ estado: 'abierta' });
  });

  it('CA1: la tienda queda de baja, sus direcciones retiradas y fuera del KV; la otra sigue', async () => {
    const r = await darDeBaja(quien(), null, { op: op(), nombre: 'comercio ensayo uno' });
    expect(r).toEqual({ estado: 'guardado', id: UNO, version: 1, borrado: en(30) });
    expect(
      await shard
        .prepare('SELECT estado, baja_pedida FROM tienda WHERE org_id = ?')
        .bind(UNO)
        .first(),
    ).toEqual({ estado: 'baja', baja_pedida: AHORA });
    expect(
      await control
        .prepare('SELECT estado FROM dominio WHERE hostname = ?')
        .bind(hostDeStaging(ENSAYO_UNO.slug))
        .first(),
    ).toEqual({ estado: 'retirado' });
    expect([...hosts.keys()]).toEqual([`h:${hostDeStaging(ENSAYO_DOS.slug)}`]);
    expect(
      await darDeBaja(quien(), null, { op: op(), nombre: 'Comercio Ensayo Uno' }),
    ).toMatchObject({
      estado: 'no-existe',
    });
  });

  it('CA2: a los 30 días se borran sus llaves y sus respaldos, y ningún contacto se puede abrir', async () => {
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    // Un contacto cifrado, y la llave de los índices, de antes de la baja.
    const sobre = await cifrarContacto(
      { db: shard, org: UNO },
      kek,
      'ped-baja-1',
      { nombre: 'Compradora de prueba', celular: '+573001234567' },
      AHORA,
    );
    await dekVigente(shard, UNO, 'indices', kek, AHORA);
    await dekVigente(shard, ENSAYO_DOS.org, 'datos_personales', kek, AHORA);
    expect(
      (await deksDeLaTienda(shard, UNO, 'datos_personales', new Map([[kek.id, kek]]))).size,
    ).toBe(1);

    // ❌ A los 29 días todavía no: el comercio puede descargar lo suyo.
    expect(
      await borrarLasBajas({ shards: [['tienda_c1_s1', shard]], almacen, instante: en(29) }),
    ).toEqual({
      borradas: [],
    });
    expect(
      await borrarLasBajas({ shards: [['tienda_c1_s1', shard]], almacen, instante: en(30) }),
    ).toEqual({
      borradas: [UNO],
    });
    expect(
      (await deksDeLaTienda(shard, UNO, 'datos_personales', new Map([[kek.id, kek]]))).size,
    ).toBe(0);
    expect((await deksDeLaTienda(shard, UNO, 'indices', new Map([[kek.id, kek]]))).size).toBe(0);
    expect(sobre.version).toBe(1);
    expect([...r2.keys()]).toEqual([`respaldos/${ENSAYO_DOS.org}/2026-10-13.json`]);
    // Ensayo Dos conserva su llave; y otra vuelta no vuelve a borrar nada.
    expect(
      (await deksDeLaTienda(shard, ENSAYO_DOS.org, 'datos_personales', new Map([[kek.id, kek]])))
        .size,
    ).toBe(1);
    expect(
      await borrarLasBajas({ shards: [['tienda_c1_s1', shard]], almacen, instante: en(31) }),
    ).toEqual({
      borradas: [],
    });
  });

  it('CA2: la política de cada tienda dice el plazo real', async () => {
    const textos = textosLegales(legalDeEnsayo(ENSAYO_UNO));
    expect(DIAS_DEL_BORRADO_EFECTIVO).toBe(60);
    expect(textos.find((t) => t.id === 'privacidad')?.markdown).toContain(
      'a más tardar 60 días después',
    );
  });
});
