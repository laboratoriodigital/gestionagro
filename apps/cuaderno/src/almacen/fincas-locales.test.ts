/**
 * Varias fincas en un mismo teléfono (HU-E4.7): cada una en su base, una sola sesión que pasa a
 * la finca activa, y nada se mezcla. Sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { abrirCuaderno, NOMBRE_POR_DEFECTO } from './db.ts';
import { CLAVE_DISPOSITIVO, idDispositivo } from './dispositivo.ts';
import { crearFincaConAreas, leerFinca } from './finca.ts';
import {
  type Almacen,
  anotarFinca,
  anotarFincaActiva,
  baseActiva,
  cambiarDeFinca,
  fincasLocales,
  nuevaBase,
  tomarFincaPorBajar,
} from './fincas-locales.ts';
import { CLAVE_SESION } from './sesion.ts';

function enMemoria(): () => Almacen {
  const m = new Map<string, string>();
  const a: Almacen = {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
  return () => a;
}

const [UNO, DOS] = FINCAS_DE_PRUEBA;

describe('varias fincas en un mismo teléfono (HU-E4.7)', () => {
  it('sin elegir otra, la finca activa es la base de siempre: nada que migrar', () => {
    expect(baseActiva(enMemoria())).toBe(NOMBRE_POR_DEFECTO);
    expect(fincasLocales(enMemoria())).toEqual([]);
  });

  it('cada finca en su base; cambiar traslada la sesión y el teléfono, sin mezclar registros', async () => {
    if (!UNO || !DOS) throw new Error('faltan fincas');
    const idb = new IDBFactory();
    const almacen = enMemoria();
    const a = abrirCuaderno({ indexedDB: idb, IDBKeyRange });
    await crearFincaConAreas(
      a,
      { nombre: UNO.finca.nombre, municipio: UNO.finca.municipio, regimen: UNO.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave A', area_m2: 100, capacidad_plantas: null }],
    );
    const telefono = await idDispositivo(a);
    await a.meta.put({ clave: CLAVE_SESION, valor: { acceso: 'x' }, actualizado: '' });
    anotarFinca({ base: a.name, nombre: UNO.finca.nombre, org_id: null }, almacen);

    const base = nuevaBase();
    expect(base.startsWith(`${NOMBRE_POR_DEFECTO}-`)).toBe(true);
    const b = abrirCuaderno({ indexedDB: idb, IDBKeyRange, nombre: base });
    await cambiarDeFinca(a, b, { bajarOrg: 'org-dos', almacen });

    expect(baseActiva(almacen)).toBe(base);
    // Una sola sesión: ahora la tiene la finca nueva.
    expect(await b.meta.get(CLAVE_SESION)).toMatchObject({ valor: { acceso: 'x' } });
    expect(await a.meta.get(CLAVE_SESION)).toBeUndefined();
    // Es el mismo teléfono.
    expect((await b.meta.get(CLAVE_DISPOSITIVO))?.valor).toBe(telefono);
    // La finca nueva está vacía: lo de la otra no se mezcla.
    expect(await leerFinca(b)).toBeNull();
    expect((await leerFinca(a))?.finca.nombre).toBe(UNO.finca.nombre);
    // Al abrir, baja la finca pedida, una sola vez.
    expect(tomarFincaPorBajar(almacen)).toBe('org-dos');
    expect(tomarFincaPorBajar(almacen)).toBeNull();

    // Y de vuelta: la sesión regresa a la primera.
    await cambiarDeFinca(b, a, { almacen });
    expect(baseActiva(almacen)).toBe(NOMBRE_POR_DEFECTO);
    expect(await a.meta.get(CLAVE_SESION)).toBeDefined();
    expect(await b.meta.get(CLAVE_SESION)).toBeUndefined();
  });

  it('con una sola finca no se anota nada (CA4); al agregar otra, sí; mientras baja, conserva el pedido', async () => {
    if (!UNO) throw new Error('falta finca');
    const idb = new IDBFactory();
    const almacen = enMemoria();
    const a = abrirCuaderno({ indexedDB: idb, IDBKeyRange });
    expect(await anotarFincaActiva(a, { almacen })).toBeNull();
    expect(fincasLocales(almacen)).toEqual([]);
    await crearFincaConAreas(
      a,
      { nombre: UNO.finca.nombre, municipio: UNO.finca.municipio, regimen: UNO.finca.regimen },
      [{ tipo: 'nave', nombre: 'Nave A', area_m2: 100, capacidad_plantas: null }],
    );
    const sola = { base: NOMBRE_POR_DEFECTO, nombre: UNO.finca.nombre, org_id: null };
    expect(await anotarFincaActiva(a, { almacen })).toEqual(sola);
    expect(fincasLocales(almacen)).toEqual([]); // el almacenamiento local sigue vacío
    await anotarFincaActiva(a, { almacen, siempre: true });
    expect(fincasLocales(almacen)).toEqual([sola]);
    // Una base nueva que está bajando «Dos»: aún vacía, no pierde el nombre ni la organización.
    const b = abrirCuaderno({ indexedDB: idb, IDBKeyRange, nombre: nuevaBase() });
    anotarFinca({ base: b.name, nombre: 'Dos', org_id: 'org-dos' }, almacen);
    expect(await anotarFincaActiva(b, { almacen })).toMatchObject({
      nombre: 'Dos',
      org_id: 'org-dos',
    });
    expect(fincasLocales(almacen)).toHaveLength(2);
  });

  it('anotar una finca dos veces la actualiza; lo ilegible no rompe la lista', () => {
    const almacen = enMemoria();
    anotarFinca({ base: NOMBRE_POR_DEFECTO, nombre: 'Uno', org_id: null }, almacen);
    anotarFinca({ base: NOMBRE_POR_DEFECTO, nombre: 'Uno', org_id: 'org-1' }, almacen);
    expect(fincasLocales(almacen)).toEqual([
      { base: NOMBRE_POR_DEFECTO, nombre: 'Uno', org_id: 'org-1' },
    ]);
    almacen().setItem('gestionagro.fincas-locales', '{roto');
    expect(fincasLocales(almacen)).toEqual([]);
    // Una base que no es del cuaderno no se acepta como activa.
    almacen().setItem('gestionagro.finca-activa', 'otra-cosa');
    expect(baseActiva(almacen)).toBe(NOMBRE_POR_DEFECTO);
  });
});
