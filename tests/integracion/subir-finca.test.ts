/**
 * Del teléfono a la celda, de punta a punta y sin red (HU-E5.2, HU-E4.3): el cuaderno sobre
 * fake-indexeddb envía a la API real de la celda (`apps/api-celda`) con su D1 local, con tokens
 * firmados por una clave de prueba. Con las dos fincas de prueba (P4).
 *
 * Lo que no imita (P17): la red de verdad (aquí `fetch` llama al Worker en memoria), los límites
 * de D1 en Cloudflare y el CORE (la sesión y el vínculo se escriben directo en el teléfono; el
 * CORE tiene sus propias pruebas). La corrida real es en staging (P16).
 */
import { uuidv7 } from '@gestionagro/agro-schema';
import type { BaseD1 } from '@gestionagro/d1';
import { baseLocal, vaciar } from '@gestionagro/d1/local';
import {
  type Firmante,
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
} from '@gestionagro/tokens';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp, TABLAS_DEL_SHARD } from '../../apps/api-celda/src/worker.ts';
import { guardarClima } from '../../apps/cuaderno/src/almacen/clima.ts';
import { abrirCuaderno, type CuadernoDb } from '../../apps/cuaderno/src/almacen/db.ts';
import { enviarPendientes } from '../../apps/cuaderno/src/almacen/envio.ts';
import { crearFincaConAreas, editarArea } from '../../apps/cuaderno/src/almacen/finca.ts';
import { CLAVE_VINCULO, encolarTodo } from '../../apps/cuaderno/src/almacen/vinculo.ts';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';

const SHARD = 'agro_c0_s1';
const API = 'https://agro-api-c0.ejemplo.test';
const T0 = Date.UTC(2026, 9, 1, 12);

let celda: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
beforeAll(async () => {
  ({ db: celda, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => vaciar(celda, [...TABLAS_DEL_SHARD]));

const api = crearApp({ ahora: () => T0 });
const env = () => ({
  CELDA: 'c0',
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  ORIGENES_APP: 'https://agro.ejemplo.test',
  [SHARD]: celda,
});
/** `fetch` del teléfono contra el Worker en memoria; cuenta los lotes. */
function red(opciones: { cortarDespuesDe?: number } = {}) {
  const lotes: number[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const r = await api.fetch(new Request(url, init), env());
    lotes.push(JSON.parse(String(init?.body ?? '{}')).ops?.length ?? 0);
    if (opciones.cortarDespuesDe !== undefined && lotes.length > opciones.cortarDespuesDe) {
      throw new TypeError('Failed to fetch'); // la celda guardó, pero la respuesta no llegó
    }
    return r;
  }) as unknown as typeof fetch;
  return { fn, lotes };
}
const contar = async (tabla: string) =>
  (await celda.prepare(`SELECT count(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n;

async function telefonoConFinca(f: FincaDePrueba, registros: number) {
  const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
  const { finca, areas } = await crearFincaConAreas(
    db,
    { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
    f.areas.slice(0, 2).map((a) => ({
      tipo: a.tipo,
      nombre: a.nombre,
      area_m2: a.area_m2,
      capacidad_plantas: null,
    })),
  );
  const area = areas[0];
  if (!area) throw new Error('sin áreas');
  for (let i = 0; i < registros; i++) {
    await guardarClima(db, finca.id, area.id, {
      temperaturaC: 20 + (i % 10),
      humedadRelativaPct: 70,
      temperaturaHojaC: null,
    });
  }
  const org = uuidv7();
  await db.meta.put({
    clave: CLAVE_VINCULO,
    valor: { org_id: org, finca_id: finca.id, vinculado: '2026-10-01T12:00:00.000Z' },
    actualizado: '',
  });
  const acceso = (
    await firmarAcceso(
      firmante,
      { sub: 'u1', org, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 },
      T0,
    )
  ).token;
  return {
    db,
    finca,
    areas,
    destino: { api: API, acceso, dispositivo: 'telefono-1', app: '0.1.0' },
  };
}
const cola = (db: CuadernoDb) => db.outbox.count();

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  it('sube todo en lotes de ≤ 25, la finca primero, y la cola queda vacía', async () => {
    const t = await telefonoConFinca(f, 30);
    const { fn, lotes } = red();
    const r = await enviarPendientes(t.db, t.destino, { fetchFn: fn, ahora: () => T0 });
    expect(r).toMatchObject({ estado: 'al-dia', enviados: 33, rechazados: 0 });
    expect(lotes.every((n) => n <= 25)).toBe(true);
    expect(await cola(t.db)).toBe(0);
    expect(await contar('registro')).toBe(30);
    expect(await contar('catalogo')).toBe(3); // finca y dos áreas
    expect(await contar('cuarentena')).toBe(0);
  });

  it('CA4: si la respuesta se pierde, la cola no cambia; al reenviar, la celda no duplica (CA2)', async () => {
    const t = await telefonoConFinca(f, 10);
    const cortada = await enviarPendientes(t.db, t.destino, {
      fetchFn: red({ cortarDespuesDe: 0 }).fn,
    });
    expect(cortada.estado).toBe('sin-senal');
    expect(await cola(t.db)).toBe(13); // nada salió de la cola
    expect(await contar('registro')).toBe(10); // pero la celda sí lo guardó
    const otra = await enviarPendientes(t.db, t.destino, { fetchFn: red().fn });
    expect(otra.estado).toBe('al-dia');
    expect(await cola(t.db)).toBe(0);
    expect(await contar('registro')).toBe(10);
  });

  it('un área editada dos veces sin señal viaja una vez, con su última versión', async () => {
    const t = await telefonoConFinca(f, 0);
    const area = t.areas[0];
    if (!area) throw new Error('sin área');
    await editarArea(t.db, area.id, { nombre: `${area.nombre} A` });
    await editarArea(t.db, area.id, { nombre: `${area.nombre} B` });
    const { fn, lotes } = red();
    await enviarPendientes(t.db, t.destino, { fetchFn: fn });
    expect(lotes).toHaveLength(1); // un solo viaje: la respuesta cubre las versiones anteriores
    const fila = await celda
      .prepare('SELECT version, datos FROM catalogo WHERE id = ?')
      .bind(area.id)
      .first<{ version: number; datos: string }>();
    expect(fila?.version).toBe(3);
    expect(JSON.parse(fila?.datos ?? '{}').nombre).toBe(`${area.nombre} B`);
    expect(await cola(t.db)).toBe(0);
  });

  it('CA3: un dato que la celda no acepta queda en «rechazo» con su motivo y sigue en el teléfono', async () => {
    const t = await telefonoConFinca(f, 1);
    const malo = await t.db.registro.toCollection().first();
    if (!malo) throw new Error('sin registro');
    // Un registro dañado (p. ej. por una app vieja con un defecto): humedad imposible.
    await t.db.registro.put({
      ...malo,
      datos: { ...(malo.datos as object), humedadRelativaPct: 140 },
    });
    const r = await enviarPendientes(t.db, t.destino, { fetchFn: red().fn });
    expect(r).toMatchObject({ estado: 'al-dia', rechazados: 1 });
    const rechazo = await t.db.rechazo.get(malo.id);
    expect(rechazo?.motivo).toContain('datos.humedadRelativaPct');
    expect(await t.db.registro.get(malo.id)).toBeTruthy();
    expect(await contar('cuarentena')).toBe(1);
  });

  it('HU-E4.3: lo importado (fuera de la cola) entra completo al vincular, sin duplicar', async () => {
    const t = await telefonoConFinca(f, 5);
    await t.db.outbox.clear(); // así queda lo que llega por «Importar» (HU-E3.13)
    expect(await encolarTodo(t.db)).toBe(8);
    expect(await encolarTodo(t.db)).toBe(0);
    // Aunque los registros queden antes que la finca en la cola, la finca sube primero.
    await t.db.outbox.toCollection().modify((op) => {
      op.creado =
        op.entidad === 'registro' ? '2000-01-01T00:00:00.000Z' : '2030-01-01T00:00:00.000Z';
    });
    const r = await enviarPendientes(t.db, t.destino, { fetchFn: red().fn });
    expect(r).toMatchObject({ estado: 'al-dia', rechazados: 0 });
    expect(await contar('registro')).toBe(5);
  });
});
