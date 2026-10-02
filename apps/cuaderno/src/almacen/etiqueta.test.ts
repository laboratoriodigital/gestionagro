/**
 * Etiqueta QR de un lote en el teléfono (HU-E6.4) sobre fake-indexeddb, con una celda falsa.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCA_ENSAYO_UNO } from '../../../../tests/fixtures/fincas.ts';
import { guardarCosecha } from './cosecha.ts';
import { abrirCuaderno } from './db.ts';
import { etiquetaDelLote } from './etiqueta.ts';
import { crearFincaConAreas } from './finca.ts';
import { armarLote, leerLotes } from './lotes.ts';

const ORIGEN = 'https://agro.ejemplo.test';
const NUBE = { api: 'https://api.ejemplo.test', acceso: 'acceso' };

async function conLote() {
  const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
  const { finca, areas } = await crearFincaConAreas(
    db,
    {
      nombre: FINCA_ENSAYO_UNO.finca.nombre,
      municipio: FINCA_ENSAYO_UNO.finca.municipio,
      regimen: 'ecologico',
    },
    [{ tipo: 'nave', nombre: 'Nave 1', area_m2: 500, capacidad_plantas: null }],
  );
  const c = await guardarCosecha(db, finca.id, {
    areaId: areas[0]?.id ?? '',
    cantidad: 20,
    unidad: 'kg',
    categoria: 'Primera',
    descarte: null,
    personaIds: [],
  });
  await armarLote(db, finca.id, [c.id]);
  const [lote] = await leerLotes(db, finca.id);
  if (!lote) throw new Error('sin lote');
  return { db, lote };
}

function celdaFalsa(respuesta: { estado: number; cuerpo: unknown } | 'sin-red') {
  const pedidos: unknown[] = [];
  const fn = (async (_url: string, init?: RequestInit) => {
    pedidos.push(JSON.parse(String(init?.body)));
    if (respuesta === 'sin-red') throw new TypeError('Failed to fetch');
    return Response.json(respuesta.cuerpo, { status: respuesta.estado });
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

describe('HU-E6.4 · la etiqueta del lote en el teléfono', () => {
  it('con la nube: pide la firma una vez, la guarda y la reimprime sin volver a pedirla', async () => {
    const { db, lote } = await conLote();
    const firmada = { fragmento: 'datos.firma', datos: { v: 1, l: lote.codigo } };
    const { fn, pedidos } = celdaFalsa({ estado: 200, cuerpo: firmada });
    const e = await etiquetaDelLote(db, lote, { origen: ORIGEN, nube: NUBE, fetchFn: fn });
    expect(e).toMatchObject({
      enlace: `${ORIGEN}/agro/t/#datos.firma`,
      firmada: true,
      motivo: null,
    });
    expect(pedidos).toEqual([{ lote_id: lote.registro.id }]);
    const otra = await etiquetaDelLote(db, lote, { origen: ORIGEN, nube: NUBE, fetchFn: fn });
    expect(otra.firmada).toBe(true);
    expect(pedidos).toHaveLength(1);
  });

  it('sin señal o si la nube no la confirma: «sin confirmar», con los datos del teléfono y el motivo', async () => {
    const { db, lote } = await conLote();
    const sinRed = await etiquetaDelLote(db, lote, {
      origen: ORIGEN,
      nube: NUBE,
      fetchFn: celdaFalsa('sin-red').fn,
    });
    expect(sinRed).toMatchObject({ firmada: false, motivo: 'Sin señal: sale «sin confirmar».' });
    expect(sinRed.datos).toMatchObject({
      l: lote.codigo,
      f: FINCA_ENSAYO_UNO.finca.nombre,
      a: ['Nave 1'],
    });
    expect(sinRed.enlace.split('#')[1]).not.toContain('.'); // sin firma
    const noEsta = await etiquetaDelLote(db, lote, {
      origen: ORIGEN,
      nube: NUBE,
      fetchFn: celdaFalsa({
        estado: 404,
        cuerpo: { motivo: 'El lote todavía no está en la nube.' },
      }).fn,
    });
    expect(noEsta.motivo).toBe('El lote todavía no está en la nube.');
  });
});
