/**
 * Del teléfono a la celda, de punta a punta y sin red (HU-E5.2, HU-E4.3), con el arnés de
 * teléfonos simulados (`arnes.ts`) y las dos fincas de prueba (P4). Lo que el arnés no imita
 * está en su encabezado (P17); la corrida real es en staging (P16).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CuadernoDb } from '../../apps/cuaderno/src/almacen/db.ts';
import { enviarPendientes } from '../../apps/cuaderno/src/almacen/envio.ts';
import { editarArea } from '../../apps/cuaderno/src/almacen/finca.ts';
import { encolarTodo } from '../../apps/cuaderno/src/almacen/vinculo.ts';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { type Celda, montarCelda, T0, telefonoConFinca } from './arnes.ts';

let c: Celda;
beforeAll(async () => {
  c = await montarCelda();
}, 60_000);
afterAll(async () => c?.cerrar());
beforeEach(async () => c.vaciar());
const red = (opciones?: { cortarDespuesDe?: number }) => c.red(opciones);
const contar = (tabla: string) => c.contar(tabla);

const cola = (db: CuadernoDb) => db.outbox.count();

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  it('sube todo en lotes de ≤ 25, la finca primero, y la cola queda vacía', async () => {
    const t = await telefonoConFinca(c, f, 30);
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
    const t = await telefonoConFinca(c, f, 10);
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
    const t = await telefonoConFinca(c, f, 0);
    const area = t.areas[0];
    if (!area) throw new Error('sin área');
    await editarArea(t.db, area.id, { nombre: `${area.nombre} A` });
    await editarArea(t.db, area.id, { nombre: `${area.nombre} B` });
    const { fn, lotes } = red();
    await enviarPendientes(t.db, t.destino, { fetchFn: fn });
    expect(lotes).toHaveLength(1); // un solo viaje: la respuesta cubre las versiones anteriores
    const fila = await c.db
      .prepare('SELECT version, datos FROM catalogo WHERE id = ?')
      .bind(area.id)
      .first<{ version: number; datos: string }>();
    expect(fila?.version).toBe(3);
    expect(JSON.parse(fila?.datos ?? '{}').nombre).toBe(`${area.nombre} B`);
    expect(await cola(t.db)).toBe(0);
  });

  it('CA3: un dato que la celda no acepta queda en «rechazo» con su motivo y sigue en el teléfono', async () => {
    const t = await telefonoConFinca(c, f, 1);
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
    const t = await telefonoConFinca(c, f, 5);
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
