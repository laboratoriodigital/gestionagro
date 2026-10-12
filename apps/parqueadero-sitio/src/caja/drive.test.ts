/**
 * La copia de la caja en el Google Drive de la persona (HU-Q10.1) con un Drive falso en memoria y
 * el permiso canjeado con un CORE falso. Que Google acepte las solicitudes se comprueba en staging.
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { driveFalso, TOKEN } from '../../../../tests/fixtures/drive-falso.ts';
import {
  abrirTurno,
  type Contexto,
  guardarSede,
  guardarTarifa,
  registrarEntrada,
} from './almacen.ts';
import { abrirBase } from './datos.ts';
import {
  CARPETA,
  CONSERVAR,
  canjearPermiso,
  copiasEnDrive,
  guardarCopia,
  traerCopia,
  urlParaPedirPermiso,
} from './drive.ts';

const CORE = 'https://core.ejemplo.test';
const ORIGEN = 'https://parqueadero.ejemplo.test';

const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & {
    id: unknown;
    org_id: unknown;
    version: unknown;
    actualizado: unknown;
    entidad: unknown;
  };
  return resto;
};

function caja() {
  let ms = Date.UTC(2026, 9, 8, 14, 0);
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  return { db: abrirBase(`drive-${uuidv7()}`), ctx };
}

async function conUnaEntrada() {
  const { db, ctx } = caja();
  await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await abrirTurno(db, { operador: 'Caja 1', base: 100_000 }, ctx);
  await registrarEntrada(
    db,
    { placa: 'ABC123', vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
    ctx,
  );
  return { db, ctx };
}

describe('copia en el Google Drive de la cuenta (HU-Q10.1)', () => {
  it('sube el mismo archivo de «Respaldo» a su carpeta y lo anota como respaldo', async () => {
    const { db, ctx } = await conUnaEntrada();
    const d = driveFalso();
    const r = await guardarCopia(db, ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    await guardarCopia(db, ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(r.nombre).toMatch(/\.json$/);
    expect(d.archivos.filter((a) => a.name === CARPETA)).toHaveLength(1);
    const copias = await copiasEnDrive(TOKEN, d.fn);
    expect(copias).toHaveLength(2);
    const subido = JSON.parse(d.archivos.find((a) => a.id === copias[0]?.id)?.contenido ?? '{}');
    expect([subido.formato, subido.version]).toEqual(['parqueadero-export', 1]);
    expect((await db.meta.get('respaldo'))?.clave).toBe('respaldo');
  });

  it(`conserva las ${CONSERVAR} más recientes`, async () => {
    const { db, ctx } = await conUnaEntrada();
    const d = driveFalso();
    for (let i = 0; i < CONSERVAR + 2; i++) {
      await guardarCopia(db, ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    }
    expect(await copiasEnDrive(TOKEN, d.fn)).toHaveLength(CONSERVAR);
  });

  it('traer une la copia a una caja nueva sin borrar nada, y repetirlo no duplica', async () => {
    const { db, ctx } = await conUnaEntrada();
    const d = driveFalso();
    await guardarCopia(db, ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    const [copia] = await copiasEnDrive(TOKEN, d.fn);
    const otra = caja().db;
    await traerCopia(otra, TOKEN, copia?.id ?? '', d.fn);
    const enLaOtra = await otra.registros.count();
    expect(enLaOtra).toBe(await db.registros.count());
    await traerCopia(otra, TOKEN, copia?.id ?? '', d.fn);
    expect(await otra.registros.count()).toBe(enLaOtra);
  });

  it('pide el permiso al CORE por el parqueadero, con el desafío, y lo canjea una sola vez', async () => {
    const { db } = caja();
    const t = Date.UTC(2026, 9, 8, 14);
    const url = new URL(await urlParaPedirPermiso(db, CORE, ORIGEN, 'guardar', () => t));
    expect(url.pathname).toBe('/api/core/drive/inicio');
    expect(url.searchParams.get('producto')).toBe('parqueadero');
    expect(url.searchParams.get('vuelta')).toBe(`${ORIGEN}/caja/`);
    const desafio = url.searchParams.get('desafio') ?? '';
    let enviado: { sellado?: string; verificador?: string } = {};
    const core = (async (_u: string, init?: RequestInit) => {
      enviado = JSON.parse(String(init?.body));
      return Response.json({ acceso: TOKEN, vence: 0 });
    }) as unknown as typeof fetch;
    const r = await canjearPermiso(db, CORE, 'sello', { fetchFn: core, ahora: () => t + 1_000 });
    expect(r).toEqual({ acceso: TOKEN, accion: 'guardar' });
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(enviado.verificador ?? ''),
    );
    expect(Buffer.from(hash).toString('base64url')).toBe(desafio);
    await expect(
      canjearPermiso(db, CORE, 'sello', { fetchFn: core, ahora: () => t + 2_000 }),
    ).rejects.toThrow('Vuelva a tocar el botón');
  });

  it('un permiso pedido hace más de 10 minutos no se canjea ni llama al CORE', async () => {
    const { db } = caja();
    const t = Date.UTC(2026, 9, 8, 14);
    await urlParaPedirPermiso(db, CORE, ORIGEN, 'traer', () => t);
    const nunca = (async () => {
      throw new Error('no debía llamar al CORE');
    }) as unknown as typeof fetch;
    const e = await canjearPermiso(db, CORE, 's', {
      fetchFn: nunca,
      ahora: () => t + 10 * 60_000 + 1,
    }).catch((x: { motivo?: string }) => x);
    expect(e).toMatchObject({ motivo: 'vencido' });
    expect(await db.meta.get('drive_pendiente')).toBeUndefined();
  });
});
