import { describe, expect, it } from 'vitest';
import worker, { type DatasetDeAnalytics, type Env } from './worker.ts';

function envDePrueba(conDataset = true) {
  const puntos: Parameters<DatasetDeAnalytics['writeDataPoint']>[0][] = [];
  const env: Env = {
    ASSETS: { fetch: async () => new Response('asset') },
    ...(conDataset ? { EVENTOS: { writeDataPoint: (p) => void puntos.push(p) } } : {}),
  };
  return { env, puntos };
}

const IP = '203.0.113.7';
const post = (cuerpo: unknown) =>
  new Request('https://parqueadero.laboratorio-digital.app/_m', {
    method: 'POST',
    headers: { 'cf-connecting-ip': IP, 'user-agent': 'Prueba/1.0' },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });

const lote = {
  v: 2,
  producto: 'parqueadero-caja',
  conteos: { 'recibo.papel': 12, 'impresion.fallida/bluetooth/tiempo': 2 },
};

describe('POST /_m del sitio del parqueadero (HU-Q5.3)', () => {
  it('escribe un punto por clave, sin nada de la solicitud (CA3)', async () => {
    const { env, puntos } = envDePrueba();
    const r = await worker.fetch(post(lote), env);
    expect(r.status).toBe(204);
    expect(puntos).toEqual([
      { indexes: ['parqueadero-caja'], blobs: ['recibo.papel', '', ''], doubles: [12] },
      {
        indexes: ['parqueadero-caja'],
        blobs: ['impresion.fallida', 'bluetooth', 'tiempo'],
        doubles: [2],
      },
    ]);
    expect(JSON.stringify(puntos)).not.toContain(IP);
    expect(JSON.stringify(puntos)).not.toContain('Prueba');
  });

  it('un lote con una clave fuera de la lista se rechaza entero (CA3)', async () => {
    const { env, puntos } = envDePrueba();
    const r = await worker.fetch(
      post({ ...lote, conteos: { ...lote.conteos, 'placa/ABC123': 1 } }),
      env,
    );
    expect(r.status).toBe(400);
    expect(await r.text()).toContain('evento desconocido');
    expect(puntos).toEqual([]);
  });

  it('solo POST, JSON y de tamaño razonable; sin dataset no finge éxito', async () => {
    const { env } = envDePrueba();
    const get = new Request('https://parqueadero.laboratorio-digital.app/_m');
    expect((await worker.fetch(get, env)).status).toBe(405);
    expect((await worker.fetch(post('no es json'), env)).status).toBe(400);
    expect((await worker.fetch(post('x'.repeat(5000)), env)).status).toBe(413);
    expect((await worker.fetch(post(lote), envDePrueba(false).env)).status).toBe(503);
  });

  it('todo lo demás es asset', async () => {
    const { env } = envDePrueba();
    const r = await worker.fetch(
      new Request('https://parqueadero.laboratorio-digital.app/caja/'),
      env,
    );
    expect(await r.text()).toBe('asset');
  });
});
