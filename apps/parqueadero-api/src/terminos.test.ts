/**
 * Los términos de la nube en la celda (HU-Q7.11): sin la versión vigente no se sincroniza (CA3) y
 * la caja deja en su fila la versión y el instante en que los aceptó (CA1). D1 local de c2.
 */
import { DISPOSITIVO } from '@ed1/parqueadero-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrir,
  alta,
  type Entorno,
  lote,
  ORG_DOS,
  ORG_UNO,
  pedir,
  token,
  vaciarShard,
} from './prueba.fixture.ts';
import { VERSION_DE_LOS_TERMINOS } from './terminos.ts';

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

const ACEPTADOS = '2026-10-08T18:00:00.000Z';

const registrar = async (cuerpo: unknown, datos: Parameters<typeof token>[1] = {}) => {
  const r = await pedir(e, '/api/v1/terminos', await token(e, datos), {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

const filaDe = (org: string, id: string) =>
  e.db
    .prepare(
      'SELECT terminos_version, terminos_aceptados FROM dispositivo WHERE org_id = ? AND id = ?',
    )
    .bind(org, id)
    .first<{ terminos_version: string | null; terminos_aceptados: string | null }>();

describe('sin los términos vigentes no se sincroniza (CA3 ❌)', () => {
  const RUTAS: [string, RequestInit][] = [
    ['/api/v1/sync/push', { method: 'POST', body: lote([]) }],
    ['/api/v1/sync/pull?registro=0&catalogo=0', {}],
    ['/api/v1/reclamar', { method: 'POST', body: JSON.stringify({ dispositivo: DISPOSITIVO }) }],
    [`/api/v1/resumen?dispositivo=${DISPOSITIVO}`, {}],
    ['/api/v1/dispositivos', {}],
    ['/api/v1/terminos', { method: 'POST', body: '{}' }],
    ['/api/v1/yo', {}],
  ];

  it.each(RUTAS)(
    '%s sin ?terminos= responde 403 «sin-terminos» y no escribe',
    async (ruta, init) => {
      const conCero = `${ruta}${ruta.includes('?') ? '&' : '?'}terminos=`;
      const r = await pedir(e, conCero, await token(e), init);
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({
        estado: 'sin-terminos',
        motivo: expect.stringContaining('Cuenta y nube'),
      });
    },
  );

  it('una versión vieja tampoco pasa', async () => {
    const r = await pedir(e, '/api/v1/dispositivos?terminos=0', await token(e));
    expect(r.status).toBe(403);
  });

  it('sin sesión, primero dice que entre: los términos no se revisan sin token', async () => {
    const r = await pedir(e, '/api/v1/dispositivos?terminos=0', null);
    expect(r.status).toBe(401);
  });

  it('con la vigente, la caja sincroniza', async () => {
    const r = await pedir(
      e,
      `/api/v1/dispositivos?terminos=${encodeURIComponent(VERSION_DE_LOS_TERMINOS)}`,
      await token(e),
    );
    expect(r.status).toBe(200);
  });
});

describe('la caja deja dicho cuándo aceptó (CA1)', () => {
  it('guarda la versión y el instante en la fila de la caja, y repetirlo no cambia nada', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    expect(await filaDe(ORG_UNO, DISPOSITIVO)).toEqual({
      terminos_version: null,
      terminos_aceptados: null,
    });
    const cuerpo = {
      dispositivo: DISPOSITIVO,
      version: VERSION_DE_LOS_TERMINOS,
      aceptados: ACEPTADOS,
    };
    for (let i = 0; i < 2; i++) {
      const r = await registrar(cuerpo);
      expect(r.status).toBe(200);
      expect(r.cuerpo).toEqual({
        resultado: 'aceptados',
        version: VERSION_DE_LOS_TERMINOS,
        aceptados: ACEPTADOS,
      });
    }
    expect(await filaDe(ORG_UNO, DISPOSITIVO)).toEqual({
      terminos_version: VERSION_DE_LOS_TERMINOS,
      terminos_aceptados: ACEPTADOS,
    });
  });

  it('una caja de otro parqueadero no se toca: 404 y su fila sigue igual', async () => {
    await alta(e.db, ORG_DOS, DISPOSITIVO, 'A');
    const r = await registrar({
      dispositivo: DISPOSITIVO,
      version: VERSION_DE_LOS_TERMINOS,
      aceptados: ACEPTADOS,
    });
    expect(r.status).toBe(404);
    expect(r.cuerpo['estado']).toBe('sin-alta');
    expect((await filaDe(ORG_DOS, DISPOSITIVO))?.terminos_version).toBeNull();
  });

  it('rechaza otra versión en el cuerpo y un instante que no es ISO en UTC', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    expect(
      (await registrar({ dispositivo: DISPOSITIVO, version: '0', aceptados: ACEPTADOS })).status,
    ).toBe(403);
    for (const aceptados of ['ayer', '2026-10-08 18:00', 1_760_000_000_000, null]) {
      const r = await registrar({
        dispositivo: DISPOSITIVO,
        version: VERSION_DE_LOS_TERMINOS,
        aceptados,
      });
      expect(r.status, String(aceptados)).toBe(400);
    }
    expect((await filaDe(ORG_UNO, DISPOSITIVO))?.terminos_version).toBeNull();
  });

  it('la base no deja una versión sin su instante (migración 0002)', async () => {
    await alta(e.db, ORG_UNO, DISPOSITIVO, 'A');
    await expect(
      e.db
        .prepare("UPDATE dispositivo SET terminos_version = '1' WHERE org_id = ? AND id = ?")
        .bind(ORG_UNO, DISPOSITIVO)
        .run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});
