/**
 * HU-T14.7: el soporte por comercio, sobre la base de control local con los dos comercios de prueba.
 * Solo la tienda, el día, los minutos y el tema; nada de texto libre. Ningún dato real.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelControl } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anotarSoporte } from './soporte.ts';

/** Lunes 26 de octubre de 2026, 3 a. m. en Colombia: en UTC ya es otro día de la misma fecha. */
const AHORA = Date.parse('2026-10-26T08:00:00.000Z');
let control: BaseD1;
let cerrar: () => Promise<void>;

beforeAll(async () => {
  const c = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  control = c.db;
  cerrar = c.cerrar;
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', '2026-10-01T05:00:00.000Z'))
    await control.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => cerrar());

describe('anotar soporte (HU-T14.7)', () => {
  it('CA1: una atención con sus minutos y su tema, el día de Colombia', async () => {
    expect(
      await anotarSoporte(control, { org: ENSAYO_UNO.org, minutos: 20, tema: 'catalogo' }, AHORA),
    ).toEqual({ estado: 'anotado', dia: '2026-10-26', minutos: 20 });
    expect(
      await anotarSoporte(
        control,
        { org: ENSAYO_DOS.org, minutos: 5, tema: 'cobro', dia: '2026-10-24' },
        AHORA,
      ),
    ).toMatchObject({ estado: 'anotado', dia: '2026-10-24' });
    const { results } = await control
      .prepare('SELECT org_id, dia, minutos, tema FROM soporte ORDER BY id')
      .all();
    expect(results).toEqual([
      { org_id: ENSAYO_UNO.org, dia: '2026-10-26', minutos: 20, tema: 'catalogo' },
      { org_id: ENSAYO_DOS.org, dia: '2026-10-24', minutos: 5, tema: 'cobro' },
    ]);
  });

  it('❌ CA2: sin texto libre, ni minutos fuera de rango, ni una tienda que no existe', async () => {
    for (const malo of [
      { org: ENSAYO_UNO.org, minutos: 0, tema: 'otro' },
      { org: ENSAYO_UNO.org, minutos: 601, tema: 'otro' },
      { org: ENSAYO_UNO.org, minutos: 10, tema: 'Juana pidió devolver' },
      { org: 'no-es-un-id', minutos: 10, tema: 'otro' },
    ])
      expect(await anotarSoporte(control, malo, AHORA)).toMatchObject({ estado: 'problemas' });
    expect(
      await anotarSoporte(
        control,
        { org: '0199e0a0-0000-7000-8000-00000000ffff', minutos: 10, tema: 'otro' },
        AHORA,
      ),
    ).toEqual({ estado: 'no-existe' });
  });
});
