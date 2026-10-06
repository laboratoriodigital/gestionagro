/**
 * HU-C1.1: `infrastructure/productos.json` es la única lista de productos del CORE (P2).
 * Cada caso inválido es su control negativo (P5); el segundo producto de ensayo prueba que el
 * registro no está escrito solo para el agro (P4).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Producto, productoPorId, rolesInvitables, rolesQueAdministran } from '@ed1/productos';
import { describe, expect, it } from 'vitest';
import { ROLES_INVITABLES } from '../../apps/core/src/invitaciones.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { cargarProductos, fallasDeProductos } from '../../scripts/lib/registro-productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const real = () =>
  JSON.parse(readFileSync(join(RAIZ, 'infrastructure/productos.json'), 'utf8')) as {
    productos: Producto[];
  };
const agro = () => real().productos[0] as Producto;

/** Un segundo producto que no es el agro, como el que sembrará staging (HU-C3.7). */
const ensayo = (): Producto => ({
  id: 'ensayo',
  nombre: 'Producto Ensayo',
  estado: 'activo',
  app: {
    origenes: {
      produccion: 'https://ensayo.laboratorio-digital.app',
      staging: 'https://ensayo--staging.laboratorio-digital.app',
    },
    rutas_de_vuelta: ['/'],
  },
  tipos: ['comercio'],
  roles: [
    { id: 'propietario', administra: true, invitable: true },
    { id: 'colaborador', administra: false, invitable: true },
  ],
  planes: 'content/agro/cuaderno/planes.json',
  politica: 'content/agro/privacidad/politica.json',
  prefijo_de_cobro: 'ensayo',
  gracia_dias: 7,
});

const con = (...productos: Producto[]) => ({ productos });
const fallas = (...productos: Producto[]) => fallasDeProductos(con(...productos));

describe('el registro real', () => {
  it('es válido y trae el agro', () => {
    const registro = cargarProductos();
    expect(productoPorId(registro, 'agro')?.nombre).toBe('CultivoPro');
  });

  it('admite un segundo producto sin tocar el esquema (P4)', () => {
    expect(fallas(agro(), ensayo())).toEqual([]);
  });

  it('dice lo mismo que el código del CORE v0 mientras haya dos copias (P2)', () => {
    // Hasta HU-C3.2, los roles invitables viven también en apps/core/src/invitaciones.ts, y los
    // tipos y roles en los CHECK de la migración 0001. Esta prueba ata las tres copias.
    expect([...rolesInvitables(agro())].sort()).toEqual([...ROLES_INVITABLES].sort());
    expect(rolesQueAdministran(agro())).toEqual(['propietario']);
    const v0 = readFileSync(join(RAIZ, 'infrastructure/migraciones/core/0001_core_v0.sql'), 'utf8');
    const lista = (columna: string) =>
      [
        ...(
          new RegExp(`${columna} TEXT NOT NULL CHECK \\(${columna} IN \\(([^)]*)\\)`).exec(
            v0,
          )?.[1] ?? ''
        ).matchAll(/'([^']+)'/g),
      ]
        .map((m) => m[1])
        .sort();
    expect(lista('tipo')).toEqual([...agro().tipos].sort());
    expect(lista('rol')).toEqual(
      agro()
        .roles.map((r) => r.id)
        .sort(),
    );
  });
});

describe('lo que el esquema rechaza', () => {
  it.each([
    ['un id con mayúsculas', { id: 'Agro' }],
    ['un id de una letra', { id: 'a' }],
    ['un estado que no existe', { estado: 'borrador' }],
    [
      'una ruta de vuelta sin barra final',
      { app: { origenes: 'celdas.json › sitio', rutas_de_vuelta: ['/agro/app'] } },
    ],
    [
      'un origen sin https',
      {
        app: {
          origenes: { produccion: 'http://x.co', staging: 'https://y.co' },
          rutas_de_vuelta: ['/'],
        },
      },
    ],
    ['sin tipos', { tipos: [] }],
    ['planes fuera de content/', { planes: '../secreto.json' }],
    ['una gracia de 90 días', { gracia_dias: 90 }],
    ['un campo que nadie declaró', { cobro: 'mensual' }],
  ])('%s', (_caso, cambio) => {
    expect(fallas({ ...agro(), ...cambio } as Producto).length).toBeGreaterThan(0);
  });
});

describe('las reglas que el esquema no puede decir', () => {
  it('un producto sin un rol que administre', () => {
    const p = { ...ensayo(), roles: [{ id: 'colaborador', administra: false, invitable: true }] };
    expect(fallas(p)).toEqual([
      '«ensayo» no tiene ningún rol que administre: nadie podría pagar ni invitar',
    ]);
  });

  it('un producto sin ningún rol invitable', () => {
    const p = { ...ensayo(), roles: [{ id: 'propietario', administra: true, invitable: false }] };
    expect(fallas(p)).toEqual([
      '«ensayo» no tiene ningún rol invitable: nadie podría sumarse a un equipo',
    ]);
  });

  it('dos productos con el mismo id o el mismo prefijo de cobro', () => {
    expect(fallas(agro(), { ...ensayo(), id: 'agro' })).toContain(
      'el producto «agro» está dos veces',
    );
    expect(fallas(agro(), { ...ensayo(), prefijo_de_cobro: 'agro' })).toContain(
      'dos productos usan el prefijo de cobro «agro»',
    );
  });

  it('un rol repetido', () => {
    const p = ensayo();
    p.roles.push({ id: 'colaborador', administra: false, invitable: false });
    expect(fallas(p)).toEqual(['«ensayo» declara dos veces el rol «colaborador»']);
  });

  it('planes o política que apuntan a un archivo que no existe, y todas las fallas a la vez (P15)', () => {
    const p = {
      ...ensayo(),
      planes: 'content/tienda/planes.json',
      politica: 'content/tienda/privacidad/politica.json',
    };
    expect(fallas(p)).toEqual([
      '«ensayo».planes apunta a «content/tienda/planes.json», que no existe',
      '«ensayo».politica apunta a «content/tienda/privacidad/politica.json», que no existe',
    ]);
  });

  it('cargarProductos lanza con las fallas, no devuelve un registro a medias (P1)', () => {
    expect(() => cargarProductos(con({ ...ensayo(), roles: [] }))).toThrow(
      /productos.json inválido/,
    );
  });
});

describe('cada celda es de un producto declarado (HU-C1.4, PLATAFORMA §4.9)', () => {
  const celdasReales = () =>
    JSON.parse(readFileSync(join(RAIZ, 'infrastructure/celdas.json'), 'utf8')) as {
      celdas: { id: string; producto: string; shards: string[] }[];
    };

  it('toda celda nombra un producto de productos.json', () => {
    const ids = new Set(cargarProductos().productos.map((p) => p.id));
    for (const c of cargarCeldas().celdas) expect(ids, c.id).toContain(c.producto);
  });

  it('una celda sin producto no pasa el esquema', () => {
    const datos = celdasReales();
    delete (datos.celdas[0] as { producto?: string }).producto;
    expect(() => cargarCeldas(datos)).toThrow(/producto/);
  });

  it('un shard sin el prefijo <producto>_<celda> se rechaza y se nombra', () => {
    const datos = celdasReales();
    (datos.celdas[0] as { shards: string[] }).shards = ['agro_c0_s1', 'tienda_c0_s2'];
    expect(() => cargarCeldas(datos)).toThrow(/c0: tienda_c0_s2/);
  });
});

describe('el catálogo del CORE trae la política y los planes de cada producto (HU-C3.1, P2)', () => {
  it('cada producto de productos.json tiene la versión vigente de su política', async () => {
    const { CATALOGO } = await import('../../apps/core/src/productos.ts');
    for (const p of cargarProductos().productos) {
      const archivo = JSON.parse(readFileSync(join(RAIZ, p.politica), 'utf8')) as {
        version: string;
      };
      expect(CATALOGO.politicas[p.id], p.id).toBe(archivo.version);
    }
  });

  it('y sus planes, los mismos de su planes.json (HU-C3.4)', async () => {
    const { CATALOGO } = await import('../../apps/core/src/productos.ts');
    for (const p of cargarProductos().productos) {
      const archivo = JSON.parse(readFileSync(join(RAIZ, p.planes), 'utf8')) as {
        planes: { id: string }[];
      };
      expect(
        CATALOGO.planes[p.id]?.map((x) => x.id),
        p.id,
      ).toEqual(archivo.planes.map((x) => x.id));
    }
  });
});
