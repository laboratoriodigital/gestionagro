/**
 * Las fotos del estado del vehículo: se borran del teléfono a los 30 días de cerrada la estadía
 * (PARQUEADERO §5.5, bitácora parqueadero 36) y van con la copia al Google Drive de la cuenta
 * (HU-Q8.3, decisión del dueño del 12 oct 2026), con un Drive falso en memoria.
 */
import 'fake-indexeddb/auto';
import { listarArchivos } from '@ed1/drive';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO } from '@ed1/parqueadero-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { driveFalso, TOKEN } from '../../../../tests/fixtures/drive-falso.ts';
import {
  abrirTurno,
  anular,
  type Contexto,
  dispositivo,
  guardarPin,
  guardarSede,
  guardarTarifa,
  registrarEntrada,
  registrarSalida,
} from './almacen.ts';
import { abrirBase, purgarFotos, VIGENCIA_DE_LAS_FOTOS } from './datos.ts';
import { CARPETA_DE_FOTOS, copiasEnDrive, guardarCopia, traerCopia } from './drive.ts';

const DIA = 24 * 3_600_000;
const EFECTIVO = {
  perdido: false,
  medio: 'efectivo',
  recibido: 50_000,
  motivoCortesia: null,
} as const;
const ANULAR = { motivo: 'placa mal digitada', pin: '2468', operador: 'Caja 1' };
const foto = (texto: string) => ({
  tipo: 'image/webp' as const,
  datos: new Blob([texto], { type: 'image/webp' }),
});

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

/** Una caja con reloj que se puede adelantar días enteros. */
async function caja() {
  let ms = Date.UTC(2026, 9, 12, 14, 0);
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  const db = abrirBase(`fotos-${uuidv7()}`);
  await guardarSede(db, sinMeta(SEDE_ENSAYO_UNO), null, ctx);
  await guardarTarifa(db, sinMeta(TARIFA_CARRO), null, ctx);
  await guardarPin(db, '2468');
  await abrirTurno(db, { operador: 'Caja 1', base: 100_000 }, ctx);
  const entrar = (placa: string, ...textos: string[]) =>
    registrarEntrada(
      db,
      { placa, vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: textos.map(foto) },
      ctx,
    );
  return { db, ctx, entrar, ahora: () => ms, adelantar: (d: number) => (ms += d) };
}

const purgadas = async (db: ReturnType<typeof abrirBase>) => {
  const m = await db.meta.get('fotos_purgadas');
  return m?.clave === 'fotos_purgadas' ? m.ids : [];
};

describe('las fotos se borran del teléfono a los 30 días de cerrada la estadía (§5.5)', () => {
  it('se quedan 30 días después de la salida y se borran después; las de adentro, nunca', async () => {
    const c = await caja();
    const salio = await c.entrar('ABC123', 'frente', 'lado');
    await c.entrar('XYZ789', 'adentro');
    await registrarSalida(c.db, salio.id, EFECTIVO, c.ctx);
    c.adelantar(VIGENCIA_DE_LAS_FOTOS - DIA);
    expect(await purgarFotos(c.db, c.ahora())).toBe(0);
    c.adelantar(2 * DIA);
    expect(await purgarFotos(c.db, c.ahora())).toBe(2);
    expect((await c.db.fotos.toArray()).map((f) => f.estadia_id)).toEqual([
      (await c.db.estadias.toArray())[0]?.id,
    ]);
    expect(await purgadas(c.db)).toHaveLength(2);
    // Repetirlo no borra más ni repite ids.
    expect(await purgarFotos(c.db, c.ahora())).toBe(0);
    expect(await purgadas(c.db)).toHaveLength(2);
  });

  it('una entrada anulada cierra la estadía; una salida anulada la vuelve a abrir', async () => {
    const c = await caja();
    const anulada = await c.entrar('ABC123', 'a');
    await anular(c.db, anulada.id, ANULAR, c.ctx);
    const volvio = await c.entrar('DEF456', 'b');
    const salida = await registrarSalida(c.db, volvio.id, EFECTIVO, c.ctx);
    await anular(c.db, salida.id, ANULAR, c.ctx);
    c.adelantar(VIGENCIA_DE_LAS_FOTOS + DIA);
    expect(await purgarFotos(c.db, c.ahora())).toBe(1);
    expect((await c.db.fotos.toArray()).map((f) => f.estadia_id)).toEqual([volvio.id]);
  });
});

describe('las fotos van con la copia al Google Drive de la cuenta (HU-Q8.3)', () => {
  it('suben una sola vez, con su formato, a la carpeta de la serie de la caja', async () => {
    const c = await caja();
    await c.entrar('ABC123', 'frente', 'lado');
    const d = driveFalso();
    const r = await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(r.fotos).toEqual({ subidas: 2, borradas: 0 });
    const carpeta = d.archivos.find((a) => a.name === `${CARPETA_DE_FOTOS} · caja A`);
    const subidas = d.archivos.filter((a) => carpeta && a.parents.includes(carpeta.id));
    expect(subidas.map((a) => a.mimeType)).toEqual(['image/webp', 'image/webp']);
    expect(subidas.map((a) => a.name).every((n) => /^2026-10-12_.+\.webp$/.test(n))).toBe(true);
    expect(subidas.map((a) => a.contenido).sort()).toEqual(['frente', 'lado']);
    const otra = await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(otra.fotos).toEqual({ subidas: 0, borradas: 0 });
  });

  it('las que el teléfono borró se borran de Drive con la copia siguiente', async () => {
    const c = await caja();
    const e = await c.entrar('ABC123', 'frente');
    const d = driveFalso();
    await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    await registrarSalida(c.db, e.id, EFECTIVO, c.ctx);
    c.adelantar(VIGENCIA_DE_LAS_FOTOS + DIA);
    await purgarFotos(c.db, c.ahora());
    const r = await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(r.fotos).toEqual({ subidas: 0, borradas: 1 });
    expect(d.archivos.filter((a) => a.mimeType === 'image/webp')).toEqual([]);
    expect(await purgadas(c.db)).toEqual([]);
  });

  it('❌ una caja restaurada desde la copia no borra de Drive las fotos que subió otra', async () => {
    const c = await caja();
    await c.entrar('ABC123', 'frente');
    const d = driveFalso();
    await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    // Un teléfono nuevo, vacío, con la misma serie: mira la misma carpeta de fotos.
    const nueva = abrirBase(`fotos-${uuidv7()}`);
    const [copia] = await copiasEnDrive(TOKEN, d.fn);
    await traerCopia(nueva, TOKEN, copia?.id ?? '', d.fn);
    expect(await dispositivo(nueva, c.ctx)).toMatchObject({ serie: 'A' });
    c.adelantar(VIGENCIA_DE_LAS_FOTOS + DIA);
    await purgarFotos(nueva, c.ahora());
    const r = await guardarCopia(nueva, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(r.fotos).toMatchObject({ borradas: 0 });
    expect(d.archivos.filter((a) => a.mimeType === 'image/webp')).toHaveLength(1);
  });

  it('❌ si las fotos no suben, la copia queda guardada y la falla se dice aparte', async () => {
    const c = await caja();
    await c.entrar('ABC123', 'frente');
    const d = driveFalso();
    const sinFotos = (async (url: string, init?: RequestInit) =>
      init?.body instanceof Blob
        ? Response.json(
            { error: { errors: [{ reason: 'storageQuotaExceeded' }] } },
            { status: 403 },
          )
        : d.fn(url, init)) as unknown as typeof fetch;
    const r = await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: sinFotos });
    expect(r.fotos).toMatchObject({ falla: { motivo: 'lleno' } });
    expect(await copiasEnDrive(TOKEN, d.fn)).toHaveLength(1);
    expect((await c.db.meta.get('respaldo'))?.clave).toBe('respaldo');
    // La próxima copia, con espacio, sube la que faltó.
    const otra = await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(otra.fotos).toEqual({ subidas: 1, borradas: 0 });
  });

  it('lista todas las fotos de la carpeta aunque Drive las dé por páginas', async () => {
    const c = await caja();
    await c.entrar('ABC123', 'a', 'b', 'c');
    await c.entrar('DEF456', 'd', 'e');
    const d = driveFalso({ porPagina: 2 });
    await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    const carpeta = d.archivos.find((a) => a.name === `${CARPETA_DE_FOTOS} · caja A`)?.id ?? '';
    expect(await listarArchivos(d.fn, TOKEN, carpeta)).toHaveLength(5);
    const otra = await guardarCopia(c.db, c.ctx, TOKEN, { app: '0.3.0', fetchFn: d.fn });
    expect(otra.fotos).toEqual({ subidas: 0, borradas: 0 });
  });
});
