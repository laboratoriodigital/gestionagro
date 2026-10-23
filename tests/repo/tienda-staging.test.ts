/**
 * HU-T2.10: la Tienda activa solo en staging. El CORE de staging la atiende para probarla con
 * sesiones de verdad; el de producción la sigue viendo pausada (CA3). Una sola regla para el CORE y
 * el despliegue (`conActivosEnStaging`, P2).
 */
import { conActivosEnStaging } from '@ed1/productos';
import { describe, expect, it } from 'vitest';
import { CATALOGO, CATALOGO_DE_STAGING, productoDe } from '../../apps/core/src/productos.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import {
  cargarProductosDePrueba,
  fallasDePrueba,
  registroDelDestino,
} from '../../scripts/lib/productos-de-prueba.ts';
import { cargarProductos } from '../../scripts/lib/registro-productos.ts';

const estadoEn = (productos: readonly { id: string; estado: string }[]) =>
  productos.find((p) => p.id === 'tienda')?.estado;

describe('la Tienda activa solo en staging (HU-T2.10)', () => {
  it('el CORE de staging la atiende', () => {
    expect(productoDe(CATALOGO_DE_STAGING, 'tienda')).toMatchObject({
      producto: { id: 'tienda', estado: 'activo' },
    });
  });

  it('desde el lanzamiento (HU-T18.6), el CORE de producción también la atiende', () => {
    expect(productoDe(CATALOGO, 'tienda')).toMatchObject({
      producto: { id: 'tienda', estado: 'activo' },
    });
    expect(cargarProductosDePrueba().activosEnStaging).toEqual([]);
  });

  it('la base de cada ambiente dice lo mismo que su catálogo', () => {
    expect(estadoEn(registroDelDestino('staging').productos)).toBe('activo');
    expect(estadoEn(registroDelDestino('produccion').productos)).toBe('activo');
  });

  it('❌ la regla solo cambia algo en staging (con un producto pausado)', () => {
    const pausada = cargarProductos().productos.map((p) =>
      p.id === 'tienda' ? { ...p, estado: 'pausado' as const } : p,
    );
    expect(estadoEn(conActivosEnStaging(pausada, ['tienda'], 'produccion'))).toBe('pausado');
    expect(estadoEn(conActivosEnStaging(pausada, ['tienda'], undefined))).toBe('pausado');
    expect(estadoEn(conActivosEnStaging(pausada, ['tienda'], 'staging'))).toBe('activo');
  });

  it('❌ solo se activa un producto de verdad que está pausado', () => {
    const d = cargarProductosDePrueba();
    const datos = (activos: string[]) => ({
      productos: d.productos,
      celdas: [{ id: 'c9', producto: 'ensayo', shards: ['ensayo_c9_s1'] }],
      activos_en_staging: activos,
    });
    const reales = cargarProductos();
    const celdas = cargarCeldas().celdas;
    expect(fallasDePrueba(datos([]), reales, celdas)).toEqual([]);
    // Lanzada (HU-T18.6), la Tienda ya no se activa aparte.
    expect(fallasDePrueba(datos(['tienda']), reales, celdas)).toEqual([
      'activos_en_staging nombra «tienda», que está «activo», no pausado',
    ]);
    expect(fallasDePrueba(datos(['agro']), reales, celdas)).toEqual([
      'activos_en_staging nombra «agro», que está «activo», no pausado',
    ]);
    expect(fallasDePrueba(datos(['vitrina']), reales, celdas)).toEqual([
      'activos_en_staging nombra «vitrina», que no es un producto de verdad',
    ]);
  });
});
