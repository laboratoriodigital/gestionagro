/**
 * Reclamar la primera caja (HU-Q7.6 CA2 y CA3), dar de alta y retirar cajas (HU-Q7.7) y el resumen
 * con que la caja verifica lo que subió (P21), contra el D1 local del shard de c2.
 */
import { DISPOSITIVO, ENTRADA_ENSAYO, SEDE_ENSAYO_UNO } from '@ed1/parqueadero-schema/ensayos';
import type { Ack } from '@ed1/sync';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { siguienteSerie } from './dispositivos.ts';
import {
  abrir,
  CAJERO,
  deCatalogo,
  deRegistro,
  type Entorno,
  entrada,
  lote,
  ORG_DOS,
  ORG_UNO,
  pedir,
  token,
  vaciarShard,
} from './prueba.fixture.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

type Datos = Parameters<typeof token>[1];

const post = async (ruta: string, cuerpo: unknown, datos: Datos = {}) => {
  const r = await pedir(e, ruta, await token(e, datos), {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};
const get = async (ruta: string, datos: Datos = {}) => {
  const r = await pedir(e, ruta, await token(e, datos));
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};
const reclamarCaja = (cambios: Record<string, unknown> = {}, datos: Datos = {}) =>
  post(
    '/api/v1/reclamar',
    {
      dispositivo: DISPOSITIVO,
      serie: 'A',
      nombre: 'Caja 1',
      sede_id: SEDE_ENSAYO_UNO.id,
      ...cambios,
    },
    datos,
  );
const alta = (dispositivo: string, datos: Datos = {}) =>
  post('/api/v1/dispositivos', { dispositivo, nombre: `Caja ${dispositivo}` }, datos);
const subir = async (ops: unknown[], dispositivo = DISPOSITIVO) => {
  const r = await pedir(e, '/api/v1/sync/push', await token(e), {
    method: 'POST',
    body: lote(ops, dispositivo),
  });
  return { status: r.status, cuerpo: (await r.json()) as { acks?: Ack[]; estado?: string } };
};

describe('la siguiente serie libre', () => {
  it('A…Z, después AA, y nunca una ya usada aunque su caja esté retirada', () => {
    expect(siguienteSerie([])).toBe('A');
    expect(siguienteSerie(['A', 'C'])).toBe('B');
    expect(siguienteSerie([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'])).toBe('AA');
  });
});

describe('POST /api/v1/reclamar (HU-Q7.6)', () => {
  it('la primera caja conserva su serie A y sus números suben con los mismos ids (CA2, CA3)', async () => {
    const r = await reclamarCaja();
    expect(r.status).toBe(201);
    expect(r.cuerpo).toMatchObject({
      resultado: 'reclamado',
      caja: { dispositivo: DISPOSITIVO, serie: 'A', estado: 'activo' },
    });
    // Lo del piloto, sin organización y sin usuario, entra con su mismo número.
    const subida = await subir([deCatalogo(SEDE_ENSAYO_UNO), deRegistro(ENTRADA_ENSAYO)]);
    expect(subida.cuerpo.acks?.map((a) => a.estado)).toEqual(['aceptado', 'aceptado']);
    const fila = await e.db
      .prepare('SELECT org_id, serie, consecutivo FROM registro WHERE id = ?')
      .bind(ENTRADA_ENSAYO.id)
      .first();
    expect(fila).toEqual({
      org_id: ORG_UNO,
      serie: 'A',
      consecutivo: ENTRADA_ENSAYO.consecutivo,
    });
  });

  it('es idempotente: reclamar otra vez la misma caja responde lo mismo y no crea otra', async () => {
    await reclamarCaja();
    const otra = await reclamarCaja();
    expect(otra.status).toBe(200);
    expect(otra.cuerpo).toMatchObject({ resultado: 'ya-reclamado', caja: { serie: 'A' } });
    const n = await e.db.prepare('SELECT count(*) AS n FROM dispositivo').first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it('❌ una segunda caja con recibos propios no reclama un parqueadero que ya tiene cajas', async () => {
    await reclamarCaja();
    const r = await reclamarCaja({ dispositivo: 'otra-caja-con-recibos' });
    expect(r.status).toBe(409);
    expect(r.cuerpo['estado']).toBe('con-cajas');
  });

  it('❌ no reclama un parqueadero de la nube que tiene otra sede', async () => {
    // La sede de Ensayo Uno ya está en la nube, subida por una caja que nunca se reclamó.
    await subir([deCatalogo(SEDE_ENSAYO_UNO)]);
    const r = await reclamarCaja({
      dispositivo: 'caja-de-otra-sede',
      sede_id: '0199b8a0-0000-7000-8000-00000000ffff',
    });
    expect(r.status).toBe(409);
    expect(r.cuerpo['estado']).toBe('otra-sede');
  });

  it('❌ la misma caja no cambia de serie, y una serie mal escrita no entra', async () => {
    await reclamarCaja();
    expect((await reclamarCaja({ serie: 'B' })).cuerpo['estado']).toBe('otra-serie');
    expect((await reclamarCaja({ serie: 'a-1' })).status).toBe(400);
  });

  it('❌ un cajero no reclama: es la fila «Dispositivos» de §11.2', async () => {
    const r = await reclamarCaja({}, { sub: CAJERO, rol: 'cajero' });
    expect(r.status).toBe(403);
    expect(r.cuerpo['estado']).toBe('sin-permiso');
  });
});

describe('POST /api/v1/dispositivos (HU-Q7.7 CA1)', () => {
  it('cada caja nueva recibe la siguiente serie libre, y pedirla otra vez da la misma', async () => {
    await reclamarCaja();
    expect((await alta('caja-2')).cuerpo).toMatchObject({
      resultado: 'de-alta',
      caja: { serie: 'B' },
    });
    expect((await alta('caja-3')).cuerpo).toMatchObject({
      resultado: 'de-alta',
      caja: { serie: 'C' },
    });
    const otra = await alta('caja-2');
    expect(otra.status).toBe(200);
    expect(otra.cuerpo).toMatchObject({ resultado: 'ya-de-alta', caja: { serie: 'B' } });
  });

  it('la serie es de cada parqueadero: el otro empieza en A', async () => {
    await reclamarCaja();
    expect((await alta('caja-de-dos', { org: ORG_DOS })).cuerpo['caja']).toMatchObject({
      serie: 'A',
    });
  });

  it('dos altas a la vez no se quedan con la misma serie', async () => {
    const [a, b] = await Promise.all([alta('caja-x'), alta('caja-y')]);
    expect(new Set([a, b].map((r) => (r.cuerpo['caja'] as { serie: string }).serie))).toEqual(
      new Set(['A', 'B']),
    );
  });

  it('❌ un cajero no da de alta ni lista cajas', async () => {
    const cajero = { sub: CAJERO, rol: 'cajero' };
    expect((await alta('caja-2', cajero)).status).toBe(403);
    expect((await get('/api/v1/dispositivos', cajero)).status).toBe(403);
  });
});

describe('retirar (HU-Q7.7 CA2 y CA3)', () => {
  it('lo de antes sigue valiendo con su serie; la serie no vuelve a otra caja', async () => {
    await reclamarCaja();
    await subir([deRegistro(ENTRADA_ENSAYO)]);
    const r = await post('/api/v1/dispositivos/retirar', { dispositivo: DISPOSITIVO });
    expect(r.cuerpo).toMatchObject({ resultado: 'retirado', dispositivo: DISPOSITIVO });
    const lista = await get('/api/v1/dispositivos');
    expect(lista.cuerpo['dispositivos']).toEqual([
      expect.objectContaining({
        serie: 'A',
        estado: 'retirado',
        ultimo: ENTRADA_ENSAYO.consecutivo,
      }),
    ]);
    const n = await e.db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
    expect(n?.n).toBe(1);
    expect((await alta('caja-nueva')).cuerpo['caja']).toMatchObject({ serie: 'B' });
    // Retirarla otra vez no cambia nada.
    expect((await post('/api/v1/dispositivos/retirar', { dispositivo: DISPOSITIVO })).status).toBe(
      200,
    );
  });

  it('❌ una caja retirada no sube, no baja, no se da de alta otra vez ni reclama', async () => {
    await reclamarCaja();
    await post('/api/v1/dispositivos/retirar', { dispositivo: DISPOSITIVO });
    const subida = await subir([deRegistro(entrada(2))]);
    expect(subida.status).toBe(403);
    expect(subida.cuerpo.estado).toBe('retirado');
    const bajada = await get(`/api/v1/sync/pull?registro=0&catalogo=0&dispositivo=${DISPOSITIVO}`);
    expect(bajada.status).toBe(403);
    expect((await alta(DISPOSITIVO)).status).toBe(403);
    expect((await reclamarCaja()).status).toBe(403);
    const n = await e.db.prepare('SELECT count(*) AS n FROM registro').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('❌ no retira una caja de otro parqueadero', async () => {
    await reclamarCaja();
    const r = await post(
      '/api/v1/dispositivos/retirar',
      { dispositivo: DISPOSITIVO },
      { org: ORG_DOS },
    );
    expect(r.status).toBe(404);
    const estado = await e.db.prepare('SELECT estado FROM dispositivo').first<{ estado: string }>();
    expect(estado?.estado).toBe('activo');
  });

  it('❌ un recibo con la serie de otra caja va a cuarentena (CA3)', async () => {
    await reclamarCaja();
    await alta('caja-2');
    const ajeno = entrada(5, { dispositivo_id: 'caja-2', serie: 'A' });
    const r = await subir([deRegistro(ajeno)], 'caja-2');
    expect(r.cuerpo.acks?.[0]).toMatchObject({
      estado: 'cuarentena',
      motivo: 'La nube lo rechazó: la serie del recibo no es la del dispositivo que lo hizo',
    });
  });
});

describe('GET /api/v1/resumen (P21, HU-Q7.9)', () => {
  it('dice cuánto tiene la celda del parqueadero y de la caja, y nada del otro parqueadero', async () => {
    await reclamarCaja();
    await subir([deCatalogo(SEDE_ENSAYO_UNO), deRegistro(entrada(1)), deRegistro(entrada(2))]);
    const r = await get(`/api/v1/resumen?dispositivo=${DISPOSITIVO}`);
    expect(r.cuerpo).toEqual({
      registros: 2,
      catalogos: 1,
      caja: { dispositivo: DISPOSITIVO, estado: 'activo', registros: 2, en_cuarentena: 0 },
    });
    const otro = await get(`/api/v1/resumen?dispositivo=${DISPOSITIVO}`, { org: ORG_DOS });
    expect(otro.cuerpo).toEqual({
      registros: 0,
      catalogos: 0,
      caja: { dispositivo: DISPOSITIVO, estado: 'sin-alta', registros: 0, en_cuarentena: 0 },
    });
  });

  it('❌ sin la caja responde 400', async () => {
    expect((await get('/api/v1/resumen')).status).toBe(400);
  });
});
