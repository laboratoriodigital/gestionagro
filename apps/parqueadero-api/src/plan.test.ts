/**
 * HU-Q7.10 CA3: la nube es del plan pagado. Con el gratuito, o pasada la gracia (el CORE pone
 * entonces el gratuito en el token), la celda no sincroniza ni escribe, y lo dice. D1 local de c2.
 */
import { DISPOSITIVO } from '@ed1/parqueadero-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { planConNube } from './plan.ts';
import { abrir, type Entorno, lote, pedir, token, vaciarShard } from './prueba.fixture.ts';

let e: Entorno;
const cajas = async () =>
  (await e.db.prepare('SELECT count(*) AS n FROM dispositivo').first<{ n: number }>())?.n ?? 0;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

describe('sin el plan pagado no se sincroniza (CA3 ❌)', () => {
  const RUTAS: [string, RequestInit][] = [
    ['/api/v1/sync/push', { method: 'POST', body: lote([]) }],
    ['/api/v1/sync/pull?registro=0&catalogo=0', {}],
    ['/api/v1/reclamar', { method: 'POST', body: JSON.stringify({ dispositivo: DISPOSITIVO }) }],
    ['/api/v1/dispositivos', {}],
    ['/api/v1/yo', {}],
  ];

  it.each(RUTAS)('%s con el plan gratuito responde 402 «sin-plan»', async (ruta, init) => {
    const r = await pedir(e, ruta, await token(e, { plan: 'gratis' }), init);
    expect(r.status).toBe(402);
    expect(await r.json()).toMatchObject({
      estado: 'sin-plan',
      motivo: expect.stringContaining('La caja sigue registrando'),
    });
  });

  it('un plan vacío o que no es de este producto tampoco pasa: nunca se supone pagado (P1)', async () => {
    const r = await pedir(e, '/api/v1/yo', await token(e, { plan: '' }));
    expect(r.status).toBe(402);
  });

  it('con el plan gratuito no escribe nada', async () => {
    const antes = await cajas();
    await pedir(e, '/api/v1/reclamar', await token(e, { plan: 'gratis' }), {
      method: 'POST',
      body: JSON.stringify({ dispositivo: DISPOSITIVO }),
    });
    expect(await cajas()).toBe(antes);
  });

  it('con el plan pagado, la caja sincroniza', async () => {
    const r = await pedir(e, '/api/v1/yo', await token(e, { plan: 'parqueadero' }));
    expect(r.status).toBe(200);
  });

  it('los planes con nube salen de planes.json: el gratuito no, uno que no existe tampoco', () => {
    expect(planConNube('parqueadero')).toBe(true);
    expect(planConNube('gratis')).toBe(false);
    expect(planConNube('gratuito')).toBe(false);
    expect(planConNube('finca')).toBe(false);
  });
});
