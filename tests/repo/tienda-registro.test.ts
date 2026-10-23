/**
 * HU-T2.2: la Tienda en el registro de productos, con sus planes como hipótesis y lo que permite
 * cada uno. El CORE la conoce sin una migración (ADR-20) y la base rechaza un rol del agro en una
 * tienda. Cada caso malo es su control negativo (P5).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fallasDeCobro, type PlanConCobro, productoPorId } from '@ed1/productos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDelCore } from '../../apps/core/src/base-de-prueba.ts';
import { sentenciasDelCatalogo } from '../../apps/core/src/catalogo.ts';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import {
  cabe,
  type FuncionesPorPlan,
  fallasDeFunciones,
  funcionesDelPlan,
  valorDe,
} from '../../packages/tienda-schema/src/index.ts';
import { cargarProductos, catalogoDelRepositorio } from '../../scripts/lib/registro-productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const leer = (ruta: string) => JSON.parse(readFileSync(join(RAIZ, ruta), 'utf8'));
const planes = () => leer('content/tienda/planes.json').planes as (PlanConCobro & { id: string })[];
const idsDePlanes = () => planes().map((p) => p.id);
const funciones = () => leer('content/tienda/funciones.json') as FuncionesPorPlan;

describe('la Tienda en productos.json (HU-T2.2)', () => {
  const tienda = () => {
    const p = productoPorId(cargarProductos(), 'tienda');
    if (!p) throw new Error('la Tienda no está en productos.json');
    return p;
  };

  it('está activa desde su lanzamiento (HU-T18.6): el CORE crea tiendas y cobra sus planes', () => {
    expect(tienda()).toMatchObject({
      estado: 'activo',
      excepcion: 'ADR-21',
      tipos: ['tienda'],
      prefijo_de_cobro: 'tienda',
      gracia_dias: 7,
      planes: 'content/tienda/planes.json',
    });
  });

  it('con el propietario que administra y el colaborador que se invita (TIENDA §12.1)', () => {
    expect(tienda().roles).toEqual([
      { id: 'propietario', administra: true, invitable: true },
      { id: 'colaborador', administra: false, invitable: true },
    ]);
  });

  it('al agotar su presupuesto apaga el horno y el MCP, nunca la venta ni los cobros (HU-T2.7 CA3)', () => {
    const apaga = tienda().presupuesto?.al_agotarse ?? [];
    expect(apaga).toEqual(['ks:tienda-horno', 'ks:tienda-mcp']);
    expect(apaga).not.toContain('ks:tienda');
    expect(apaga).not.toContain('ks:tienda-cobros');
  });

  it('declara solo sus kill switches de TIENDA §15.2', () => {
    expect(tienda().kill_switches).toEqual([
      'ks:tienda',
      'ks:tienda-cobros',
      'ks:tienda-mcp',
      'ks:tienda-horno',
      'ks:tienda-correos',
      'ks:tienda-fotos',
    ]);
  });
});

describe('los planes y lo que permite cada uno', () => {
  it('son los tres de TiendaPro (D-T3, HU-T18.3), con el gratuito primero', () => {
    expect(planes().map((p) => [p.id, (p as { nombre?: string }).nombre])).toEqual([
      ['gratis', 'Gratis'],
      ['pro', 'Pro'],
      ['ia-pro', 'IA Pro'],
    ]);
  });

  it('cobran lo que dice la tabla «Por periodo» de TIENDA §1.4 (P2)', () => {
    const tienda = readFileSync(join(RAIZ, 'docs/tienda/TIENDA-3.0.md'), 'utf8');
    const filas = [
      ...tienda.matchAll(
        /^\| `(pro|ia-pro)` \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \| ([\d.]+) \|$/gm,
      ),
    ];
    expect(filas).toHaveLength(2);
    for (const [, id, ...montos] of filas) {
      const numeros = montos.map((m) => Number(m.replaceAll('.', '')));
      const plan = planes().find((p) => p.id === id);
      expect(plan?.cobro, id).toEqual({
        '1': numeros[0],
        '3': numeros[1],
        '6': numeros[2],
        '12': numeros[3],
      });
    }
  });

  it('funciones.json nombra los mismos planes, con valores que se pueden leer', () => {
    expect(fallasDeFunciones(idsDePlanes(), funciones())).toEqual([]);
  });

  it('el gratuito tiene su límite de productos y los pagos no', () => {
    expect(valorDe(funciones(), 'productos', 'gratis')).toBe(10);
    expect(valorDe(funciones(), 'productos', 'pro')).toBeNull();
    expect(cabe(10, 10)).toBe(true);
    expect(cabe(10, 11)).toBe(false);
    expect(cabe(null, 100_000)).toBe(true);
  });

  it('HU-T18.3: el reparto de D-T3 (personas, sello, MCP público y del comercio)', () => {
    const de = (f: string) => idsDePlanes().map((p) => valorDe(funciones(), f, p));
    expect(de('usuarios')).toEqual([1, 3, null]);
    expect(de('sin_marca')).toEqual([false, true, true]);
    expect(de('factura_integrada')).toEqual([false, true, true]);
    expect(de('mcp_publico')).toEqual([false, true, true]);
    // ❌ CA3: una tienda Pro no ofrece el MCP del comercio; solo IA Pro.
    expect(de('mcp_del_comercio')).toEqual([false, false, true]);
  });

  it('❌ un plan en funciones.json que no está en planes.json, o uno que falta', () => {
    const malas = {
      productos: { gratis: 10, pro: null, 'ia-pro': null, alto: null },
      feeds: { gratis: false, pro: true },
    };
    expect(fallasDeFunciones(idsDePlanes(), malas)).toEqual([
      '«productos» nombra el plan «alto», que no está en planes.json',
      '«feeds» no dice nada del plan «ia-pro»',
    ]);
  });

  it('❌ un límite con decimales, negativo o en texto', () => {
    const malas = { usuarios: { gratis: 1.5, pro: -1, 'ia-pro': '3' } };
    expect(fallasDeFunciones(idsDePlanes(), malas)).toHaveLength(3);
  });

  it('❌ un límite que no se puede leer lanza, nunca vale «sin límite»', () => {
    expect(() => valorDe(funciones(), 'productos', 'mayorista')).toThrow(/mayorista/);
    expect(() => valorDe(funciones(), 'bodegas', 'gratis')).toThrow(/bodegas/);
  });

  it('lo que permite un plan, función por función; un plan que no está no permite nada (HU-T8.1)', () => {
    expect(funcionesDelPlan(funciones(), 'gratis')).toMatchObject({ productos: 10 });
    expect(Object.keys(funcionesDelPlan(funciones(), 'ia-pro') ?? {})).toEqual(
      Object.keys(funciones()).filter((f) => f !== 'nota'),
    );
    expect(funcionesDelPlan(funciones(), 'mayorista')).toBeNull();
    // HU-T18.3 CA2: los retirados ya no están; la migración pasa sus tiendas a Pro o IA Pro.
    expect(funcionesDelPlan(funciones(), 'alto')).toBeNull();
  });

  it('❌ un semestral más caro que seis meses', () => {
    const pro = planes().find((p) => p.id === 'pro') as PlanConCobro;
    expect(fallasDeCobro([{ ...pro, cobro: { ...pro.cobro, '6': 150_000 } }])).toEqual([
      '«pro»: a 6 meses el mes sale más caro (25000) que a 3 (23333)',
    ]);
  });
});

describe('la Tienda en la base del CORE, sin migración (ADR-20)', () => {
  let db: BaseD1;
  let cerrar: () => Promise<void>;
  const correr = async (sql: string) => {
    for (const s of sql
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean))
      await db.prepare(s).run();
  };

  beforeAll(async () => {
    ({ db, cerrar } = await baseDelCore());
    for (const s of sentenciasDelCatalogo(catalogoDelRepositorio(), '2026-10-13T00:00:00.000Z'))
      await db.prepare(s).run();
    await correr(`
      INSERT INTO celda (id, producto, url_api, estado, anillo_despliegue, shards) VALUES ('c1', 'tienda', 'https://panel', 'activa', 1, '["tienda_c1_s1"]');
      INSERT INTO usuario (id, nombre, email, creado) VALUES ('u1', 'Persona Uno', 'uno@example.com', '2026-10-13T00:00:00.000Z');
      INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES ('t1', 'tienda', 'Comercio Ensayo Uno', 'tienda', 'gratis', 'c1', 'tienda_c1_s1', 1, '2026-10-13T00:00:00.000Z')
    `);
  }, 60_000);
  afterAll(async () => cerrar?.());

  it('el catálogo la siembra activa, con sus roles y sus planes', async () => {
    expect(await db.prepare("SELECT estado FROM producto WHERE id = 'tienda'").first()).toEqual({
      estado: 'activo',
    });
    const { results } = await db
      .prepare("SELECT id FROM plan WHERE producto = 'tienda' ORDER BY id")
      .all<{ id: string }>();
    expect(results.map((r) => r.id)).toEqual(['gratis', 'ia-pro', 'pro']);
  });

  it('HU-T18.3 CA2: la migración 0011 pasa las tiendas de los planes retirados a Pro o IA Pro, con lo pagado', async () => {
    const vence = '2027-04-20T00:00:00.000Z';
    // Como en staging: los planes viejos existían antes de este catálogo; retirarlos no los borra.
    await correr(`
      INSERT INTO plan (producto, id, nombre, gratuito, estado) VALUES ('tienda', 'entrada', 'Entrada', 0, 'retirado'), ('tienda', 'intermedio', 'Intermedio', 0, 'retirado'), ('tienda', 'alto', 'Alto', 0, 'retirado');
      INSERT INTO organizacion (id, producto, nombre, tipo, plan, plan_vence, celda_id, shard, anillo, creado) VALUES ('t-e', 'tienda', 'Comercio Ensayo E', 'tienda', 'entrada', '${vence}', 'c1', 'tienda_c1_s1', 1, 'x');
      INSERT INTO organizacion (id, producto, nombre, tipo, plan, plan_vence, celda_id, shard, anillo, creado) VALUES ('t-i', 'tienda', 'Comercio Ensayo I', 'tienda', 'intermedio', NULL, 'c1', 'tienda_c1_s1', 1, 'x');
      INSERT INTO organizacion (id, producto, nombre, tipo, plan, plan_vence, celda_id, shard, anillo, creado) VALUES ('t-a', 'tienda', 'Comercio Ensayo A', 'tienda', 'alto', '${vence}', 'c1', 'tienda_c1_s1', 1, 'x')
    `);
    await correr(
      readFileSync(
        join(RAIZ, 'infrastructure/migraciones/core/0011_planes_de_tiendapro.sql'),
        'utf8',
      ).replace(/--.*$/gm, ''),
    );
    const { results } = await db
      .prepare(
        "SELECT id, plan, plan_vence FROM organizacion WHERE producto = 'tienda' ORDER BY id",
      )
      .all();
    expect(results).toEqual([
      { id: 't-a', plan: 'ia-pro', plan_vence: vence },
      { id: 't-e', plan: 'pro', plan_vence: vence },
      { id: 't-i', plan: 'pro', plan_vence: null },
      // ❌ La gratuita no cambia.
      { id: 't1', plan: 'gratis', plan_vence: null },
    ]);
    // Los retirados siguen en la base: los pagos de antes los nombran (P21).
    const retirados = await db
      .prepare("SELECT count(*) AS n FROM plan WHERE producto = 'tienda' AND estado = 'retirado'")
      .first<{ n: number }>();
    expect(retirados?.n).toBe(3);
  });

  it('una tienda admite al propietario y al colaborador', async () => {
    await correr(
      "INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES ('u1', 't1', 'tienda', 'propietario', 'x')",
    );
  });

  it.each([
    ['un rol del agro', "'operario'"],
    ['un rol del parqueadero', "'cajero'"],
  ])('❌ %s en una tienda: la base lo rechaza', async (_caso, rol) => {
    await expect(
      correr(
        `INSERT INTO invitacion (codigo_hash, org_id, producto, rol, expira, creada_por, creada) VALUES ('h-${rol.length}', 't1', 'tienda', ${rol}, 'x', 'u1', 'x')`,
      ),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
