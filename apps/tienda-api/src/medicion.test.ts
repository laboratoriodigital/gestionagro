/**
 * HU-T14.1: la medición propia por `/_m`. El punto de Analytics Engine lleva la tienda y cinco
 * conteos, y nada del visitante: ni la IP, ni sus cabeceras, ni un identificador (CA2).
 */
import { describe, expect, it } from 'vitest';
import {
  CABECERA_DESPACHO,
  CABECERA_IP,
  CABECERA_TIENDA,
  crearApp,
  type Env,
  type Limitador,
} from './worker.ts';

const SECRETO = 'secreto-de-prueba-de-la-medicion';
const ORG = 'org-de-prueba-medicion';

function analytics() {
  const puntos: { indexes?: string[]; blobs?: string[]; doubles?: number[] }[] = [];
  return { puntos, writeDataPoint: (p: (typeof puntos)[number]) => void puntos.push(p) };
}
const limitador = (cupo: number): Limitador => {
  let n = 0;
  return { limit: async () => ({ success: ++n <= cupo }) };
};

const mandar = (cuerpo: string, env: Partial<Env>) =>
  crearApp().request(
    '/_m',
    {
      method: 'POST',
      body: cuerpo,
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: ORG, shard: 'tienda_c1_s1' }),
        [CABECERA_IP]: '203.0.113.50',
        'user-agent': 'Navegador de prueba',
        'content-type': 'application/json',
      },
    },
    { SECRETO_DESPACHO: SECRETO, tienda_c1_s1: {}, ...env } as Env,
  );

describe('POST /_m (HU-T14.1)', () => {
  it('CA1: un punto con la tienda como índice y los cinco conteos en orden', async () => {
    const a = analytics();
    const r = await mandar(
      JSON.stringify({
        v: 1,
        conteos: { ver_producto: 3, agregar_al_carrito: 1, pago_confirmado: 1 },
      }),
      { MEDICION: a, LIMITE_MEDICION: limitador(60) },
    );
    expect(r.status).toBe(204);
    expect(a.puntos).toEqual([{ indexes: [ORG], blobs: ['tienda'], doubles: [3, 1, 0, 0, 1] }]);
    // ❌ CA2: nada de la solicitud llega al punto.
    const todo = JSON.stringify(a.puntos);
    for (const dato of ['203.0.113.50', 'Navegador', 'cookie']) expect(todo).not.toContain(dato);
  });

  it('❌ un lote con otro evento, un campo de más, un conteo raro o roto: 400 y nada se escribe', async () => {
    const a = analytics();
    for (const malo of [
      '{roto',
      JSON.stringify({ v: 1, conteos: { ver_pagina: 1 } }),
      JSON.stringify({ v: 1, conteos: { ver_producto: 1 }, visitante: 'abc' }),
      JSON.stringify({ v: 1, conteos: { ver_producto: 1000 } }),
      JSON.stringify({ v: 1, conteos: {} }),
      JSON.stringify({ v: 2, conteos: { ver_producto: 1 } }),
    ]) {
      expect(
        (await mandar(malo, { MEDICION: a, LIMITE_MEDICION: limitador(60) })).status,
        malo,
      ).toBe(400);
    }
    expect((await mandar('x'.repeat(2000), { MEDICION: a })).status).toBe(413);
    expect(a.puntos).toEqual([]);
  });

  it('❌ pasado el tope por IP, 429; sin el dataset, 503 y nunca un falso éxito', async () => {
    const a = analytics();
    const l = limitador(1);
    const lote = JSON.stringify({ v: 1, conteos: { ver_producto: 1 } });
    expect((await mandar(lote, { MEDICION: a, LIMITE_MEDICION: l })).status).toBe(204);
    expect((await mandar(lote, { MEDICION: a, LIMITE_MEDICION: l })).status).toBe(429);
    expect((await mandar(lote, { LIMITE_MEDICION: limitador(60) })).status).toBe(503);
    expect(a.puntos).toHaveLength(1);
  });
});
