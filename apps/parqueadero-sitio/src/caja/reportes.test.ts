/**
 * Lo que el reporte del día lee de la caja (HU-Q8.5): todas las cajas para quien puede ver todos
 * los reportes, solo esta para el cajero con cuenta (CA2, HU-Q7.8), y la cuarentena de la nube
 * (CA3).
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import type { Registro } from '@ed1/parqueadero-schema';
import { describe, expect, it } from 'vitest';
import { abrirBase, type Sesion } from './datos.ts';
import { csvDelDia, leerReporte } from './reportes.ts';

const ORG = '0199b8a0-0000-7000-8000-0000000000a1';

const apertura = (dispositivo_id: string, operador: string): Registro => ({
  id: uuidv7(),
  org_id: null,
  tipo: 'turno_apertura',
  v: 1,
  fecha_local: '2026-10-06',
  instante_evento: '2026-10-06T12:00:00.000Z',
  autor_usuario_id: null,
  dispositivo_id,
  origen: 'manual',
  anula_id: null,
  estadia_id: null,
  serie: null,
  consecutivo: null,
  datos: { base: 0, operador },
});

const sesion = (rol: string): Sesion => ({
  acceso: 'a',
  acceso_vence: 0,
  refresh: 'r',
  refresh_vence: 0,
  usuario: { nombre: 'Prueba', email: 'prueba@ejemplo.test' },
  organizaciones: [{ org_id: ORG, nombre: 'Parqueadero Ensayo Uno', rol }],
  org_id: ORG,
  url_api: null,
});

async function caja() {
  const db = abrirBase(`reportes-${uuidv7()}`);
  await db.meta.put({ clave: 'dispositivo', id: 'caja-a', serie: 'A' });
  const propia = apertura('caja-a', 'Ana');
  await db.registros.bulkAdd([propia, apertura('caja-b', 'Beto')]);
  return { db, propia };
}

describe('el reporte de la caja (HU-Q8.5)', () => {
  it('sin cuenta, o con un rol que ve todo, trae los turnos de todas las cajas que tiene', async () => {
    const { db } = await caja();
    const sin = await leerReporte(db, '2026-10-06');
    expect(sin.soloEstaCaja).toBe(false);
    expect(sin.reporte.turnos.map((t) => t.resumen.operador)).toEqual(['Ana', 'Beto']);
    for (const rol of ['propietario', 'administrador']) {
      await db.meta.put({ clave: 'sesion', sesion: sesion(rol) });
      expect((await leerReporte(db, '2026-10-06')).reporte.turnos).toHaveLength(2);
    }
  });

  it('❌ el cajero con cuenta ve solo los turnos de su caja (CA2)', async () => {
    const { db } = await caja();
    await db.meta.put({ clave: 'sesion', sesion: sesion('cajero') });
    const r = await leerReporte(db, '2026-10-06');
    expect(r.soloEstaCaja).toBe(true);
    expect(r.reporte.turnos.map((t) => t.resumen.operador)).toEqual(['Ana']);
  });

  it('❌ un registro en cuarentena deja el reporte parcial (CA3)', async () => {
    const { db, propia } = await caja();
    await db.rechazos.add({
      id: uuidv7(),
      entidad: 'registro',
      entidad_id: propia.id,
      motivo: 'la serie del recibo no es la del dispositivo que lo hizo',
      recibido: 0,
    });
    const r = await leerReporte(db, '2026-10-06');
    expect(r.reporte.enCuarentena).toBe(1);
    expect(r.reporte.completo).toBe(false);
    expect(r.diario.completo).toBe(false);
    expect(csvDelDia(r.diario)).toContain('total parcial: registros en cuarentena');
  });
});
