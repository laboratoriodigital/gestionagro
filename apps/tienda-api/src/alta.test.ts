/**
 * HU-T13.4: el alta de una tienda, sobre la base local, con una organización que el CORE acaba de
 * crear (todavía sin tienda en el shard). Turnstile es de mentira. Ningún dato es real.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_UNO, siembraDelControl, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirTienda, disponibilidad, verificarTurnstile } from './alta.ts';
import type { QuienDelDominio } from './dominios.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-20T15:00:00.000Z';
const NUEVA = '0199f000-0000-7000-8000-00000000a1a1';
const OTRA = '0199f000-0000-7000-8000-00000000b2b2';
const TERCERA = '0199f000-0000-7000-8000-00000000c3c3';

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];
const hosts = new Map<string, string>();
const kv = {
  put: async (k: string, v: string) => void hosts.set(k, v),
  delete: async (k: string) => void hosts.delete(k),
};

const quien = (org: string): QuienDelDominio & { plan: string | null } => ({
  db: shard,
  org,
  actor: 'usuario:0199e0a0-0000-7000-8000-0000000000aa',
  instante: AHORA,
  control,
  celda: 'c1',
  shardNombre: 'tienda_c1_s1',
  hosts: kv,
  plan: 'gratis',
});
const conTurnstile = {
  ambiente: 'staging' as const,
  turnstile: async (t: string) => t === 'valido',
};
let n = 0;
const op = () => `op-alta-${++n}-${'x'.repeat(8)}`;

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
  for (const sql of siembraDelShard([ENSAYO_UNO], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  await control
    .prepare(
      "INSERT INTO slug_reservado (slug, motivo) VALUES ('banco-falso', 'marca') ON CONFLICT DO NOTHING",
    )
    .run();
}, 60_000);

afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('la dirección libre (HU-T13.4)', () => {
  it('dice si está libre, tomada, reservada o mal escrita, con su motivo', async () => {
    expect(await disponibilidad(control, 'Pan-de-Rosa', 'staging')).toEqual({
      disponible: true,
      slug: 'pan-de-rosa',
      direccion: 'pan-de-rosa--staging.mitiendapro.co',
    });
    expect(await disponibilidad(control, 'ensayo-uno', 'produccion')).toMatchObject({
      disponible: false,
      motivo: 'Esa dirección ya la tiene otra tienda.',
    });
    expect(
      (await disponibilidad(control, 'panel', 'produccion')) as { motivo: string },
    ).toMatchObject({
      motivo: expect.stringMatching(/la usa la plataforma/),
    });
    expect(await disponibilidad(control, 'banco-falso', 'produccion')).toMatchObject({
      motivo: expect.stringMatching(/marca conocida/),
    });
    expect(await disponibilidad(control, 'mi--tienda', 'produccion')).toMatchObject({
      motivo: 'Usa un solo guion entre palabras.',
    });
  });
});

describe('abrir la tienda (HU-T13.4)', () => {
  it('CA1 y CA2: la tienda en borrador, su dirección canónica y las formas de pago de fábrica', async () => {
    const r = await abrirTienda(
      quien(NUEVA),
      { op: op(), slug: 'pan-de-rosa', nombre: 'Panadería Doña Rosa', turnstile: 'valido' },
      conTurnstile,
    );
    expect(r).toEqual({
      estado: 'guardado',
      id: NUEVA,
      version: 1,
      slug: 'pan-de-rosa',
      direccion: 'pan-de-rosa--staging.mitiendapro.co',
    });
    expect(
      await shard
        .prepare('SELECT slug, nombre, estado, plan FROM tienda WHERE org_id = ?')
        .bind(NUEVA)
        .first(),
    ).toEqual({
      slug: 'pan-de-rosa',
      nombre: 'Panadería Doña Rosa',
      estado: 'borrador',
      plan: 'gratis',
    });
    const venta = await shard
      .prepare("SELECT datos FROM ajuste WHERE org_id = ? AND seccion = 'venta'")
      .bind(NUEVA)
      .first<{ datos: string }>();
    expect(JSON.parse(venta?.datos ?? '{}')).toEqual({
      modo: 'whatsapp',
      formas: [{ forma: 'a_convenir' }, { forma: 'transferencia' }],
    });
    expect(
      await control
        .prepare('SELECT tipo, rol, estado FROM dominio WHERE org_id = ?')
        .bind(NUEVA)
        .first(),
    ).toEqual({ tipo: 'plataforma', rol: 'canonico', estado: 'activo' });
    expect(JSON.parse(hosts.get('h:pan-de-rosa--staging.mitiendapro.co') ?? '{}')).toMatchObject({
      org: NUEVA,
      version: null,
      estado: 'borrador',
      rol: 'canonico',
    });
    // Abrirla otra vez es la misma tienda; otra dirección para la misma organización, no.
    expect(
      await abrirTienda(
        quien(NUEVA),
        { op: op(), slug: 'pan-de-rosa', nombre: 'Panadería Doña Rosa', turnstile: 'valido' },
        conTurnstile,
      ),
    ).toMatchObject({ estado: 'guardado', slug: 'pan-de-rosa' });
    expect(
      await abrirTienda(
        quien(NUEVA),
        { op: op(), slug: 'otra-direccion', nombre: 'Panadería', turnstile: 'valido' },
        conTurnstile,
      ),
    ).toMatchObject({ estado: 'problemas' });
  });

  it('❌ CA3: un nombre reservado o tomado se rechaza con su motivo, y de dos a la vez solo uno gana', async () => {
    const reservado = await abrirTienda(
      quien(OTRA),
      { op: op(), slug: 'banco-falso', nombre: 'Banco', turnstile: 'valido' },
      conTurnstile,
    );
    expect(reservado).toEqual({
      estado: 'problemas',
      problemas: [{ campo: 'slug', mensaje: expect.stringMatching(/marca conocida/) }],
    });
    const [a, b] = await Promise.all([
      abrirTienda(
        quien(OTRA),
        { op: op(), slug: 'la-misma', nombre: 'Una', turnstile: 'valido' },
        conTurnstile,
      ),
      abrirTienda(
        quien(TERCERA),
        { op: op(), slug: 'la-misma', nombre: 'Otra', turnstile: 'valido' },
        conTurnstile,
      ),
    ]);
    const estados = [a.estado, b.estado].sort();
    expect(estados).toEqual(['guardado', 'problemas']);
    const perdio = a.estado === 'problemas' ? a : b;
    expect(perdio.estado === 'problemas' && perdio.problemas[0]?.mensaje).toMatch(
      /la acaba de tomar otra tienda/,
    );
    const { results } = await shard
      .prepare("SELECT org_id FROM tienda WHERE slug = 'la-misma'")
      .all();
    expect(results).toHaveLength(1);
  });

  it('❌ sin Turnstile válido, o sin su secreto, no abre nada', async () => {
    const sinPersona = await abrirTienda(
      quien('0199f000-0000-7000-8000-00000000d4d4'),
      { op: op(), slug: 'sin-persona', nombre: 'Robot', turnstile: 'malo' },
      conTurnstile,
    );
    expect(sinPersona).toMatchObject({ estado: 'problemas', problemas: [{ campo: 'turnstile' }] });
    const sinSecreto = await abrirTienda(
      quien('0199f000-0000-7000-8000-00000000d4d4'),
      { op: op(), slug: 'sin-secreto', nombre: 'Tienda', turnstile: 'valido' },
      { ambiente: 'produccion', turnstile: null },
    );
    expect(sinSecreto).toMatchObject({ estado: 'sin-configurar' });
    expect(await disponibilidad(control, 'sin-persona', 'staging')).toMatchObject({
      disponible: true,
    });
  });

  it('Turnstile se verifica en el servidor de Cloudflare, con el secreto y el token', async () => {
    const pedidos: URLSearchParams[] = [];
    const ok = await verificarTurnstile('secreto', 'token', '203.0.113.9', async (url, init) => {
      expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      pedidos.push(init?.body as URLSearchParams);
      return Response.json({ success: true });
    });
    expect(ok).toBe(true);
    expect(Object.fromEntries(pedidos[0] ?? [])).toEqual({
      secret: 'secreto',
      response: 'token',
      remoteip: '203.0.113.9',
    });
    expect(
      await verificarTurnstile('s', 't', undefined, async () => Response.json({ success: false })),
    ).toBe(false);
    expect(
      await verificarTurnstile('s', 't', undefined, async () => {
        throw new Error('sin red');
      }),
    ).toBe(false);
  });
});
