/**
 * HU-C3.7: los productos de prueba existen en staging y en D1 local, nunca en producción.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGO_DE_STAGING, catalogoDelDestino } from '../../apps/core/src/productos.ts';
import {
  RUTA_WRANGLER_ENSAYO,
  WORKER_ENSAYO,
  wranglerDeEnsayo,
} from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';
import { humoSinProductosDePrueba } from '../../scripts/lib/despliegue.ts';
import {
  ARCHIVO_PRODUCTOS_DE_PRUEBA,
  cargarProductosDePrueba,
  fallasDePrueba,
  productosDePruebaEn,
  registroDelDestino,
} from '../../scripts/lib/productos-de-prueba.ts';
import { cargarProductos } from '../../scripts/lib/registro-productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const crudo = () =>
  JSON.parse(readFileSync(join(RAIZ, ARCHIVO_PRODUCTOS_DE_PRUEBA), 'utf8')) as {
    productos: Parameters<typeof fallasDePrueba>[0]['productos'];
    celdas: Parameters<typeof fallasDePrueba>[0]['celdas'];
  };

describe('HU-C3.7 · CA1: el producto de ensayo, solo en staging', () => {
  it('el archivo es válido con las reglas de productos.json, y su celda solo va al directorio', () => {
    const prueba = cargarProductosDePrueba();
    expect(prueba.productos.map((p) => p.id)).toEqual(['ensayo']);
    const ensayo = prueba.productos[0];
    expect(ensayo?.tipos).toHaveLength(1);
    expect(ensayo?.roles).toHaveLength(2);
    expect(prueba.celdas).toMatchObject([
      {
        id: 'c9',
        producto: 'ensayo',
        estado: 'activa',
        api_staging: cargarCeldas().celdas[0]?.api_staging,
      },
    ]);
  });

  it('staging los trae; producción no', () => {
    const ids = (d: 'staging' | 'produccion') => registroDelDestino(d).productos.map((p) => p.id);
    expect(ids('staging')).toContain('ensayo');
    expect(ids('produccion')).not.toContain('ensayo');
    expect(ids('produccion')).toEqual(cargarProductos().productos.map((p) => p.id));
  });

  it('el CORE los atiende solo con DESTINO=staging; sin la variable, como producción (P1)', () => {
    const ids = (d: string | undefined) => catalogoDelDestino(d).productos.map((p) => p.id);
    expect(ids('staging')).toContain('ensayo');
    expect(ids('produccion')).not.toContain('ensayo');
    expect(ids(undefined)).not.toContain('ensayo');
  });

  it('cada producto de prueba tiene su política y sus planes en el catálogo de staging (P2)', () => {
    for (const p of cargarProductosDePrueba().productos) {
      const politica = JSON.parse(readFileSync(join(RAIZ, p.politica), 'utf8')) as {
        version: string;
      };
      const planes = JSON.parse(readFileSync(join(RAIZ, p.planes ?? ''), 'utf8')) as {
        planes: { id: string }[];
      };
      expect(CATALOGO_DE_STAGING.politicas[p.id]).toBe(politica.version);
      expect(CATALOGO_DE_STAGING.planes[p.id]?.map((x) => x.id)).toEqual(
        planes.planes.map((x) => x.id),
      );
    }
  });

  it('un producto de prueba no pisa uno de verdad, ni su prefijo, ni una celda; y sus shards dicen de quién son', () => {
    const d = crudo();
    const agro = cargarProductos().productos[0];
    const mal = {
      productos: [
        {
          ...(d.productos[0] as NonNullable<(typeof d.productos)[0]>),
          id: 'agro',
          prefijo_de_cobro: agro?.prefijo_de_cobro ?? 'agro',
        },
      ],
      celdas: [{ id: 'c0', producto: 'ensayo', shards: ['agro_c0_s9'] }],
    };
    const fallas = fallasDePrueba(mal, cargarProductos(), cargarCeldas().celdas);
    expect(fallas).toEqual(
      expect.arrayContaining([
        '«agro» ya es un producto de verdad: uno de prueba no lo pisa',
        '«agro» usa el prefijo de cobro «agro» de un producto de verdad',
        'la celda de prueba «c0» ya existe en celdas.json',
        'la celda de prueba «c0» es de «ensayo», que no es un producto de prueba',
      ]),
    );
  });

  it('la configuración de su app es la generada (P2)', () => {
    expect(readFileSync(RUTA_WRANGLER_ENSAYO, 'utf8')).toContain(`"name": "${WORKER_ENSAYO}"`);
    expect(wranglerDeEnsayo()['env']).toEqual({
      staging: { name: `${WORKER_ENSAYO}-staging`, workers_dev: true },
    });
    const origen = cargarProductosDePrueba().productos[0]?.app.origenes;
    expect(typeof origen === 'object' && origen.staging).toMatch(
      `https://${WORKER_ENSAYO}-staging.`,
    );
  });
});

describe('HU-C3.7 · CA3 ❌: el producto de ensayo no existe en producción', () => {
  it('la revisión de la base lo nombra si aparece', () => {
    const filas = [[{ id: 'agro' }, { id: 'cuenta' }]];
    expect(productosDePruebaEn(filas, ['ensayo'])).toEqual([]);
    expect(productosDePruebaEn([[...(filas[0] ?? []), { id: 'ensayo' }]], ['ensayo'])).toEqual([
      'el producto de prueba «ensayo» está en la base de producción; ahí no puede existir',
    ]);
  });

  it('la prueba de humo exige que entrar a «ensayo» responda que no existe', async () => {
    const responde = (status: number, texto: string) =>
      (async () => new Response(texto, { status })) as unknown as Fetch;
    expect(
      await humoSinProductosDePrueba(
        responde(400, 'Esta aplicación no existe en la plataforma.'),
        'https://x',
        ['ensayo'],
      ),
    ).toEqual([]);
    expect(await humoSinProductosDePrueba(responde(302, ''), 'https://x', ['ensayo'])).toEqual([
      '/api/core/auth/google/inicio?producto=ensayo: respondió 302; el producto de prueba «ensayo» no debe existir en producción',
    ]);
  });
});
