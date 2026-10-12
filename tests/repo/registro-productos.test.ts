/**
 * HU-C1.1: `infrastructure/productos.json` es la única lista de productos del CORE (P2).
 * Cada caso inválido es su control negativo (P5); el segundo producto de ensayo prueba que el
 * registro no está escrito solo para el agro (P4).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Producto, productoPorId, rolesInvitables, rolesQueAdministran } from '@ed1/productos';
import { describe, expect, it } from 'vitest';
import { ROLES_INVITABLES } from '../../apps/core/src/invitaciones.ts';
import { RUTA_CATALOGO_CORE, textoDelCatalogoCore } from '../../scripts/generar-catalogo-core.ts';
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
  presupuesto: { usd_mes: 10, al_agotarse: ['ks:ensayo-mcp', 'ks:ensayo:horno'] },
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
    ['sin presupuesto en dinero', { presupuesto: undefined }],
    ['un presupuesto de cero dólares', { presupuesto: { usd_mes: 0, al_agotarse: [] } }],
  ])('%s', (_caso, cambio) => {
    expect(fallas({ ...agro(), ...cambio } as Producto).length).toBeGreaterThan(0);
  });
});

describe('las reglas que el esquema no puede decir', () => {
  it('HU-C11.1, CA3 ❌: el presupuesto apaga capacidades propias, nunca la venta ni lo de otro', () => {
    const conApagar = (al_agotarse: string[]) =>
      fallas({ ...ensayo(), presupuesto: { usd_mes: 10, al_agotarse } });
    expect(conApagar(['ks:ensayo-mcp', 'ks:ensayo:horno'])).toEqual([]);
    // El esquema deja pasar la forma; la regla dice por qué no.
    expect(conApagar(['ks:core:pagos'])).toEqual([
      '«ensayo».presupuesto.al_agotarse no puede apagar «ks:core:pagos»: solo capacidades propias, nunca la venta',
    ]);
    for (const clave of [
      'ks:ensayo',
      'ks:core:pagos',
      'ks:core:ensayo',
      'ks:agro-cuaderno',
      'ks:ensayon-mcp',
    ]) {
      expect(conApagar([clave]).length, clave).toBeGreaterThan(0);
    }
  });

  it('HU-Q7.13 ❌: un producto declara solo sus propios kill switches', () => {
    const conClaves = (kill_switches: string[]) => fallas({ ...ensayo(), kill_switches });
    expect(conClaves(['ks:ensayo', 'ks:ensayo-fotos'])).toEqual([
      '«ensayo».presupuesto.al_agotarse apaga «ks:ensayo-mcp», que no está en sus kill_switches',
      '«ensayo».presupuesto.al_agotarse apaga «ks:ensayo:horno», que no está en sus kill_switches',
    ]);
    expect(conClaves(['ks:ensayo', 'ks:ensayo-mcp', 'ks:ensayo:horno']).length).toBeGreaterThan(0);
    expect(conClaves(['ks:core', 'ks:agro-cuaderno', 'ks:ensayon'])).toEqual(
      expect.arrayContaining([
        '«ensayo».kill_switches no puede declarar «ks:core»: solo ks:ensayo y ks:ensayo-…',
        '«ensayo».kill_switches no puede declarar «ks:agro-cuaderno»: solo ks:ensayo y ks:ensayo-…',
        '«ensayo».kill_switches no puede declarar «ks:ensayon»: solo ks:ensayo y ks:ensayo-…',
      ]),
    );
  });

  it('HU-Q7.13: el parqueadero declara sus filas de D1 por día y sus dos kill switches', () => {
    const p = productoPorId(cargarProductos(), 'parqueadero');
    expect(p?.kill_switches).toEqual(['ks:parqueadero', 'ks:parqueadero-fotos']);
    // El 75 % de las 100.000 de la cuenta, menos el doble de lo que los demás escriben (medido).
    expect(p?.presupuesto?.d1_filas_escritas_dia).toBeLessThanOrEqual(75_000);
  });

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
  it('es el generado: `node scripts/generar-catalogo-core.ts` después de cambiar un producto', () => {
    expect(readFileSync(RUTA_CATALOGO_CORE, 'utf8')).toBe(textoDelCatalogoCore());
  });

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
      // Un producto sin organizaciones (la cuenta, ADR-28) no tiene planes.
      const archivo = (
        p.planes ? JSON.parse(readFileSync(join(RAIZ, p.planes), 'utf8')) : { planes: [] }
      ) as { planes: { id: string }[] };
      expect(
        CATALOGO.planes[p.id]?.map((x) => x.id),
        p.id,
      ).toEqual(archivo.planes.map((x) => x.id));
    }
  });
});

/**
 * HU-Q7.1, CA3 ❌: el parqueadero entra al CORE como dato (R1). Si un archivo de código del CORE lo
 * nombrara, agregar el siguiente producto volvería a ser tocar código. Las pruebas sí pueden
 * nombrarlo; el catálogo generado es dato.
 */
const CODIGO_DEL_CORE = ['apps/core/src', 'packages/productos/src'];

function nombranUnProducto(dir: string, producto: string): string[] {
  return readdirSync(join(RAIZ, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .filter((f) =>
      new RegExp(`\\b${producto}\\b`, 'i').test(readFileSync(join(RAIZ, dir, f), 'utf8')),
    )
    .map((f) => `${dir}/${f}`);
}

describe('ningún archivo de código del CORE nombra al parqueadero (HU-Q7.1, CA3)', () => {
  it('el parqueadero es un producto de productos.json', () => {
    expect(productoPorId(cargarProductos(), 'parqueadero')?.excepcion).toBe('ADR-31');
  });

  it.each(CODIGO_DEL_CORE)('%s', (dir) => {
    expect(nombranUnProducto(dir, 'parqueadero')).toEqual([]);
  });

  it('distingue: la misma búsqueda encuentra al agro, que el CORE todavía nombra (P10)', () => {
    expect(nombranUnProducto('apps/core/src', 'agro')).toContain('apps/core/src/productos.ts');
  });
});
