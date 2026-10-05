/**
 * Despachos (HU-E6.3) sobre fake-indexeddb, con las dos fincas de prueba (P4).
 */
import { ErrorDeValidacion, uuidv7 } from '@ed1/agro-schema';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCAS_DE_PRUEBA } from '../../../../tests/fixtures/fincas.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import {
  clientesConocidos,
  leerDespachos,
  type NuevoDespacho,
  registrarDespacho,
} from './despachos.ts';
import { crearFincaConAreas } from './finca.ts';
import { armarLote, leerLotes } from './lotes.ts';

const HOY = () => new Date('2027-03-27T15:00:00Z');
const LUEGO = () => new Date('2027-03-27T16:00:00Z');
const motivos = (e: unknown) =>
  e instanceof ErrorDeValidacion ? e.campos.map((c) => c.motivo) : [String(e)];

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  async function preparar() {
    const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
    const { finca, areas } = await crearFincaConAreas(
      db,
      { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
      f.areas.slice(0, 2).map((x) => ({
        tipo: x.tipo,
        nombre: x.nombre,
        area_m2: x.area_m2,
        capacidad_plantas: null,
      })),
    );
    const [a1, a2] = areas;
    if (!a1 || !a2) throw new Error('faltan áreas');
    const lote = async (areaId: string, cantidad: number, unidad = 'kg', ahora = HOY) => {
      const c = await guardarCosecha(
        db,
        finca.id,
        { areaId, cantidad, unidad, categoria: 'Primera', descarte: null, personaIds: [] },
        { ahora },
      );
      return armarLote(db, finca.id, [c.id], { ahora });
    };
    const despacho = (lineas: NuevoDespacho['lineas'], extra: Partial<NuevoDespacho> = {}) => ({
      cliente: { nombre: 'Cliente Ensayo', tipo: 'restaurante' as const },
      lineas,
      precioUnitario: 3500,
      medioPago: 'transferencia' as const,
      ...extra,
    });
    return { db, finca, a1, a2, lote, despacho };
  }

  it('CA1 y CA2: despacho con cliente, lotes, cantidad, precio y medio de pago; el saldo baja', async () => {
    const { db, finca, a1, a2, lote, despacho } = await preparar();
    const l1 = await lote(a1.id, 30);
    const l2 = await lote(a2.id, 20, 'kg', LUEGO);
    await registrarDespacho(
      db,
      finca.id,
      despacho([
        { loteId: l1.id, cantidad: 10 },
        { loteId: l2.id, cantidad: 5.5 },
      ]),
      { ahora: LUEGO },
    );
    const [d] = await leerDespachos(db, finca.id);
    expect(d).toMatchObject({ cantidad: 15.5, total: 54_250 });
    expect(d?.datos).toMatchObject({
      cliente: { nombre: 'Cliente Ensayo', tipo: 'restaurante' },
      unidad: 'kg',
      precio_unitario_cop: 3500,
      medio_pago: 'transferencia',
    });
    expect(d?.registro.area_ids.sort()).toEqual([a1.id, a2.id].sort());
    const saldos = Object.fromEntries(
      (await leerLotes(db, finca.id)).map((l) => [l.registro.id, l.saldo]),
    );
    expect(saldos).toEqual({ [l1.id]: 20, [l2.id]: 14.5 });
    expect(await clientesConocidos(db, finca.id)).toEqual([
      { nombre: 'Cliente Ensayo', tipo: 'restaurante' },
    ]);
  });

  it('CA4: más de lo que le queda al lote avisa y no guarda', async () => {
    const { db, finca, a1, lote, despacho } = await preparar();
    const l1 = await lote(a1.id, 30);
    await registrarDespacho(db, finca.id, despacho([{ loteId: l1.id, cantidad: 25 }]), {
      ahora: LUEGO,
    });
    const codigo = (l1.datos as { codigo: string }).codigo;
    const intento = await registrarDespacho(
      db,
      finca.id,
      despacho([{ loteId: l1.id, cantidad: 6 }]),
      {
        ahora: LUEGO,
      },
    ).catch((e: unknown) => e);
    expect(motivos(intento)).toEqual([`al lote ${codigo} le quedan 5 kg y quieres despachar 6`]);
    expect(await leerDespachos(db, finca.id)).toHaveLength(1);
  });

  it('CA5: sin precio queda «no anotado» (null), nunca cero; un precio inválido se niega', async () => {
    const { db, finca, a1, lote, despacho } = await preparar();
    const l1 = await lote(a1.id, 30);
    await registrarDespacho(
      db,
      finca.id,
      despacho([{ loteId: l1.id, cantidad: 3 }], { precioUnitario: null }),
      {
        ahora: LUEGO,
      },
    );
    const [d] = await leerDespachos(db, finca.id);
    expect(d?.datos.precio_unitario_cop).toBeNull();
    expect(d?.total).toBeNull();
    for (const precio of [0, 12.5, Number.NaN]) {
      expect(
        motivos(
          await registrarDespacho(
            db,
            finca.id,
            despacho([{ loteId: l1.id, cantidad: 1 }], { precioUnitario: precio }),
          ).catch((e: unknown) => e),
        ),
      ).toEqual(['el precio va en pesos enteros, mayor que 0']);
    }
  });

  it('pide cliente, tipo, medio de pago y lotes; no mezcla unidades', async () => {
    const { db, finca, a1, a2, lote } = await preparar();
    const kg = await lote(a1.id, 30, 'kg');
    const cajas = await lote(a2.id, 5, 'cajas', LUEGO);
    expect(
      motivos(
        await registrarDespacho(db, finca.id, {
          cliente: { nombre: '  ', tipo: '' },
          lineas: [],
          precioUnitario: null,
          medioPago: '',
        }).catch((e: unknown) => e),
      ),
    ).toEqual([
      'escribe a quién le vendiste',
      'elige el tipo de cliente',
      'elige cómo te pagó',
      'elige al menos un lote',
    ]);
    expect(
      motivos(
        await registrarDespacho(db, finca.id, {
          cliente: { nombre: 'Cliente Ensayo', tipo: 'tienda' },
          lineas: [
            { loteId: kg.id, cantidad: 1 },
            { loteId: cajas.id, cantidad: 1 },
          ],
          precioUnitario: null,
          medioPago: 'efectivo',
        }).catch((e: unknown) => e),
      ),
    ).toEqual(['no se mezclan unidades (kg y cajas)']);
  });

  it('un despacho sigue al lote aunque el lote se corrija, y el lote no baja de lo despachado', async () => {
    const { db, finca, a1, lote, despacho } = await preparar();
    const c2 = await guardarCosecha(
      db,
      finca.id,
      {
        areaId: a1.id,
        cantidad: 8,
        unidad: 'kg',
        categoria: 'Primera',
        descarte: null,
        personaIds: [],
      },
      { ahora: HOY },
    );
    const l1 = await lote(a1.id, 30);
    await registrarDespacho(db, finca.id, despacho([{ loteId: l1.id, cantidad: 25 }]), {
      ahora: LUEGO,
    });
    const cosechaDeL1 = (l1.datos as { cosecha_ids: string[] }).cosecha_ids;
    // Agregarle una cosecha: el despacho sigue contando contra el lote corregido.
    const corregido = await armarLote(db, finca.id, [...cosechaDeL1, c2.id], {
      ahora: LUEGO,
      corrige: l1,
    });
    const [vigente] = await leerLotes(db, finca.id);
    expect(vigente).toMatchObject({ cantidad: 38, despachado: 25, saldo: 13 });
    expect((await leerDespachos(db, finca.id))[0]?.codigos).toEqual([vigente?.codigo]);
    // Quitarle la cosecha grande lo dejaría por debajo de lo despachado.
    expect(
      motivos(
        await armarLote(db, finca.id, [c2.id], { ahora: LUEGO, corrige: corregido }).catch(
          (e: unknown) => e,
        ),
      ),
    ).toEqual(['de este lote ya se despacharon 25 kg; no puede quedar con menos']);
  });

  it('dos teléfonos sin señal que despachan de más: el lote lo avisa', async () => {
    const { db, finca, a1, lote, despacho } = await preparar();
    const l1 = await lote(a1.id, 30);
    const propio = await registrarDespacho(
      db,
      finca.id,
      despacho([{ loteId: l1.id, cantidad: 20 }]),
      {
        ahora: LUEGO,
      },
    );
    // Lo que bajó del otro teléfono, que no veía el primer despacho.
    await db.registro.add({
      ...propio,
      id: uuidv7(() => LUEGO().getTime() + 1000),
      dispositivo_id: 'otro-telefono',
    });
    const [l] = await leerLotes(db, finca.id);
    expect(l?.saldo).toBe(-10);
    expect(l?.avisos).toEqual([
      'Se despachó más de lo que tiene el lote: 40 de 30 kg. Pasa cuando dos teléfonos despachan sin señal; revisa los despachos.',
    ]);
  });
});
