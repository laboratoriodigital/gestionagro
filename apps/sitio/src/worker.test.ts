import { describe, expect, it } from 'vitest';
import { cargarProductos } from '../../../scripts/lib/productos.ts';
import worker, { type DatasetDeAnalytics, type Env, PRODUCTOS_CON_EVENTOS } from './worker.ts';

function envDePrueba(conDataset = true) {
  const puntos: Parameters<DatasetDeAnalytics['writeDataPoint']>[0][] = [];
  const env: Env = {
    ASSETS: { fetch: async () => new Response('asset') },
    ...(conDataset ? { EVENTOS: { writeDataPoint: (p) => void puntos.push(p) } } : {}),
  };
  return { env, puntos };
}

const post = (cuerpo: unknown) =>
  new Request('https://agro.laboratorio-digital.com/api/eventos', {
    method: 'POST',
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });

const loteValido = {
  v: 1,
  producto: 'agro-calculadora-dpv',
  eventos: { 'tool.opened': 1, 'tool.completed': 1, 'tool.shared': 2 },
};

describe('POST /api/eventos', () => {
  it('escribe un punto por lote, con las cuentas en el orden documentado', async () => {
    const { env, puntos } = envDePrueba();
    const r = await worker.fetch(post(loteValido), env);
    expect(r.status).toBe(204);
    expect(puntos).toEqual([
      { indexes: ['agro-calculadora-dpv'], blobs: ['agro-calculadora-dpv'], doubles: [1, 1, 2, 0] },
    ]);
  });

  it.each([
    ['no es JSON', '{roto'],
    ['producto desconocido', { ...loteValido, producto: 'agro-inventado' }],
    ['evento desconocido', { ...loteValido, eventos: { 'page.view': 1 } }],
    ['cuenta negativa', { ...loteValido, eventos: { 'tool.opened': -1 } }],
    ['cuenta no entera', { ...loteValido, eventos: { 'tool.opened': 1.5 } }],
    ['lote vacío', { ...loteValido, eventos: {} }],
    ['versión desconocida', { ...loteValido, v: 2 }],
  ])('rechaza con 400: %s', async (_caso, cuerpo) => {
    const { env, puntos } = envDePrueba();
    expect((await worker.fetch(post(cuerpo), env)).status).toBe(400);
    expect(puntos).toEqual([]);
  });

  it('rechaza un lote demasiado grande', async () => {
    const { env } = envDePrueba();
    expect((await worker.fetch(post('x'.repeat(3000)), env)).status).toBe(413);
  });

  it('solo acepta POST', async () => {
    const { env } = envDePrueba();
    const r = await worker.fetch(
      new Request('https://agro.laboratorio-digital.com/api/eventos'),
      env,
    );
    expect(r.status).toBe(405);
  });

  it('sin el binding de Analytics Engine no finge éxito (P1)', async () => {
    const { env } = envDePrueba(false);
    expect((await worker.fetch(post(loteValido), env)).status).toBe(503);
  });

  it('lo que no es /api/ va a los assets', async () => {
    const { env } = envDePrueba();
    const r = await worker.fetch(
      new Request('https://agro.laboratorio-digital.com/herramientas/agro/'),
      env,
    );
    expect(await r.text()).toBe('asset');
  });
});

describe('kill switch (HU-E8.1)', () => {
  const conFlags = (valor: string | null) => {
    const { env, puntos } = envDePrueba();
    // Un KV nuevo por prueba: la caché del Worker es por KV, como por isolate.
    return { env: { ...env, FLAGS: { get: async () => valor } }, puntos };
  };

  it('con ks:<producto> en «apagado» responde 503 con Retry-After y no escribe nada', async () => {
    const { env, puntos } = conFlags('apagado');
    const r = await worker.fetch(post(loteValido), env);
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('60');
    expect(await r.text()).toBe('Producto apagado');
    expect(puntos).toEqual([]);
  });

  it('encendido, o sin clave, escribe como siempre', async () => {
    for (const valor of ['encendido', null]) {
      const { env, puntos } = conFlags(valor);
      expect((await worker.fetch(post(loteValido), env)).status).toBe(204);
      expect(puntos).toHaveLength(1);
    }
  });

  it('un lote inválido se rechaza con 400 aunque el producto esté apagado: primero se valida', async () => {
    const { env } = conFlags('apagado');
    expect((await worker.fetch(post('{roto'), env)).status).toBe(400);
  });
});

describe('productos con eventos (P2)', () => {
  it('son exactamente los contratos que declaran eventos tool.*', () => {
    const declarados = cargarProductos()
      .filter((p) => p.eventos.some((e) => e.startsWith('tool.')))
      .map((p) => p.id)
      .sort();
    expect([...PRODUCTOS_CON_EVENTOS].sort()).toEqual(declarados);
  });
});
