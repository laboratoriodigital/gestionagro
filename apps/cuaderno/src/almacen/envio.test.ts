/**
 * Respuestas de la celda que no son «todo bien» (HU-E5.2, CA5) y subir la finca (HU-E4.3) con
 * un CORE falso. El camino feliz de punta a punta está en tests/integracion/subir-finca.test.ts.
 */
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { FINCA_ENSAYO_UNO } from '../../../../tests/fixtures/fincas.ts';
import { guardarClima } from './clima.ts';
import { abrirCuaderno } from './db.ts';
import { ESPERA_MAXIMA_MS, ESPERA_MINIMA_MS, enviarPendientes, esperaTrasFallo } from './envio.ts';
import { crearFincaConAreas } from './finca.ts';
import { CLAVE_SESION, type Sesion } from './sesion.ts';
import { CLAVE_ORG_PENDIENTE, estadoDelVinculo, leerVinculo, subirFinca } from './vinculo.ts';

const destino = { api: 'https://api', acceso: 'a', dispositivo: 't', app: '0.1.0' };
const T0 = Date.UTC(2026, 9, 1, 12);

async function telefono() {
  const db = abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });
  const f = FINCA_ENSAYO_UNO;
  const { finca, areas } = await crearFincaConAreas(
    db,
    { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
    [
      {
        tipo: 'nave',
        nombre: f.areas[0]?.nombre ?? 'Nave 1',
        area_m2: 500,
        capacidad_plantas: null,
      },
    ],
  );
  await guardarClima(db, finca.id, areas[0]?.id ?? '', {
    temperaturaC: 24,
    humedadRelativaPct: 70,
    temperaturaHojaC: null,
  });
  return db;
}

const responde = (estado: number, cuerpo: unknown, cabeceras: Record<string, string> = {}) =>
  (async () =>
    Response.json(cuerpo, { status: estado, headers: cabeceras })) as unknown as typeof fetch;

describe('CA5 · la celda pide esperar, o no hay sesión: la cola no se toca', () => {
  it('503 con Retry-After espera lo que dice la celda', async () => {
    const db = await telefono();
    const r = await enviarPendientes(db, destino, {
      fetchFn: responde(503, { estado: 'apagado' }, { 'retry-after': '120' }),
    });
    expect(r).toMatchObject({ estado: 'esperar', ms: 120_000 });
    expect(await db.outbox.count()).toBe(3);
  });

  it('429 sin Retry-After espera cada vez más, de 30 s hasta 30 min', async () => {
    const db = await telefono();
    const r = await enviarPendientes(db, destino, { fetchFn: responde(429, {}), fallosPrevios: 2 });
    expect(r).toMatchObject({ estado: 'esperar', ms: 4 * ESPERA_MINIMA_MS });
    expect([0, 1, 2, 3].map(esperaTrasFallo)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(esperaTrasFallo(20)).toBe(ESPERA_MAXIMA_MS);
  });

  it('401 dice «sin sesión» y no saca nada de la cola', async () => {
    const db = await telefono();
    expect(
      (
        await enviarPendientes(db, destino, {
          fetchFn: responde(401, { motivo: 'La sesión venció.' }),
        })
      ).estado,
    ).toBe('sin-sesion');
    expect(await db.outbox.count()).toBe(3);
  });

  it('un lote donde todo es «reintentar» no se repite en seguida y se queda en la cola', async () => {
    const db = await telefono();
    let llamadas = 0;
    const fn = (async (_url: string, init?: RequestInit) => {
      llamadas++;
      const { ops } = JSON.parse(String(init?.body)) as { ops: { id: string }[] };
      return Response.json({ acks: ops.map((o) => ({ id: o.id, estado: 'reintentar' })) });
    }) as unknown as typeof fetch;
    const r = await enviarPendientes(db, destino, { fetchFn: fn });
    expect(r).toMatchObject({ estado: 'esperar', ms: ESPERA_MINIMA_MS });
    expect(llamadas).toBe(1);
    expect(await db.outbox.count()).toBe(3);
  });
});

describe('HU-E4.3 · subir la finca a la cuenta', () => {
  const sesion: Sesion = {
    acceso: 'acceso',
    acceso_vence: T0 + 3_600_000,
    refresh: 'refresh',
    refresh_vence: T0 + 86_400_000,
    usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
    organizaciones: [],
    org_id: null,
  };
  const conSesion = async () => {
    const db = await telefono();
    await db.meta.put({ clave: CLAVE_SESION, valor: sesion, actualizado: '' });
    return db;
  };

  /** CORE falso: crea la organización y renueva hacia ella; `fallarRenovacion` simula una caída. */
  function coreFalso(opciones: { fallarRenovacion?: boolean } = {}) {
    const creadas: string[] = [];
    const fn = (async (url: string, init?: RequestInit) => {
      const cuerpo = JSON.parse(String(init?.body)) as { id?: string; org_id?: string };
      if (url.endsWith('/api/core/organizaciones')) {
        creadas.push(cuerpo.id ?? '');
        return Response.json(
          { org_id: cuerpo.id, nombre: 'Finca Ensayo Uno', ya_existia: creadas.length > 1 },
          { status: 201 },
        );
      }
      if (opciones.fallarRenovacion) throw new TypeError('Failed to fetch');
      return Response.json({
        ...sesion,
        refresh: null,
        org_id: cuerpo.org_id,
        url_api: 'https://api',
        organizaciones: [{ org_id: cuerpo.org_id, nombre: 'Finca Ensayo Uno', rol: 'propietario' }],
      });
    }) as unknown as typeof fetch;
    return { fn, creadas };
  }

  it('crea la organización, renueva hacia ella, guarda el vínculo y queda «vinculada»', async () => {
    const db = await conSesion();
    expect(await estadoDelVinculo(db, sesion)).toBe('sin-subir');
    const { fn, creadas } = coreFalso();
    const r = await subirFinca(db, 'https://core', { fetchFn: fn, ahora: () => T0 });
    expect(r.sesion).toMatchObject({
      org_id: creadas[0],
      refresh: 'refresh',
      url_api: 'https://api',
    });
    expect((await leerVinculo(db))?.org_id).toBe(creadas[0]);
    expect(await estadoDelVinculo(db, r.sesion)).toBe('vinculada');
    expect(await db.meta.get(CLAVE_ORG_PENDIENTE)).toBeUndefined();
  });

  it('si se cae a mitad, el reintento usa el mismo id: no se crean dos fincas en la nube', async () => {
    const db = await conSesion();
    const caida = coreFalso({ fallarRenovacion: true });
    await expect(subirFinca(db, 'https://core', { fetchFn: caida.fn })).rejects.toThrow(
      'Sin señal',
    );
    expect(await leerVinculo(db)).toBeNull();
    const bien = coreFalso();
    await subirFinca(db, 'https://core', { fetchFn: bien.fn });
    expect(bien.creadas).toEqual(caida.creadas);
  });

  it('CA3: vinculado a una organización que no es de esta cuenta, no se mezcla', async () => {
    const db = await conSesion();
    await subirFinca(db, 'https://core', { fetchFn: coreFalso().fn });
    const otraCuenta: Sesion = {
      ...sesion,
      organizaciones: [{ org_id: 'otra', nombre: 'Otra', rol: 'propietario' }],
    };
    expect(await estadoDelVinculo(db, otraCuenta)).toBe('otra-cuenta');
    await expect(subirFinca(db, 'https://core', { fetchFn: coreFalso().fn })).rejects.toThrow(
      'ya tiene su finca vinculada',
    );
  });
});

describe('HU-E5.5 · la celda pide actualizar la app', () => {
  it('el lote se acepta y el resultado trae el pedido en palabras', async () => {
    const db = await telefono();
    const fn = (async (_url: string, init?: RequestInit) => {
      const { ops } = JSON.parse(String(init?.body)) as { ops: { id: string }[] };
      return Response.json({
        acks: ops.map((o) => ({ id: o.id, estado: 'aceptado' })),
        actualizar: { minima: '0.2.0', motivo: 'Esta versión del cuaderno ya es vieja.' },
      });
    }) as unknown as typeof fetch;
    const r = await enviarPendientes(db, destino, { fetchFn: fn });
    expect(r).toMatchObject({
      estado: 'al-dia',
      enviados: 3,
      actualizar: 'Esta versión del cuaderno ya es vieja.',
    });
    expect(await db.outbox.count()).toBe(0);
  });
});
