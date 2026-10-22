/**
 * HU-T11.10 CA2: la prueba de carga contra staging, con una tienda de mentira. Lo que cuenta: que
 * diga lo que vio, que una página caída o un limitador ausente sean fallas, y que no se rinda.
 */
import { describe, expect, it } from 'vitest';
import { cargaDeStaging } from '../../scripts/tienda/carga-de-staging.ts';

const HOST = 'ensayo-dos--staging.mitiendapro.co';

function tienda(o: { caida?: boolean; sinLimite?: boolean } = {}) {
  let cotizaciones = 0;
  const pedidas: string[] = [];
  const f = async (url: string) => {
    const ruta = new URL(url).pathname;
    pedidas.push(ruta);
    if (ruta === '/catalogo.json') return Response.json({ productos: [{ slug: 'pan-de-bono' }] });
    if (ruta === '/api/v1/cotizar') {
      cotizaciones++;
      return o.sinLimite || cotizaciones <= 30
        ? Response.json({ total: 0 })
        : Response.json({ estado: 'limite' }, { status: 429 });
    }
    if (o.caida && ruta === '/carrito/') return new Response('error', { status: 500 });
    return new Response('<html></html>');
  };
  return { f, pedidas };
}

describe('scripts/tienda/carga-de-staging.ts (HU-T11.10 CA2)', () => {
  it('pide cada página varias veces y ve el 429 del limitador por IP', async () => {
    const t = tienda();
    const r = await cargaDeStaging({ host: HOST, vueltas: 5, aLaVez: 3, fetch: t.f });
    expect(r.fallas).toEqual([]);
    expect(r.paginas.pedidas).toBe(20);
    expect(r.paginas.porEstado).toEqual({ '200': 20 });
    expect(r.cotizar.porEstado).toEqual({ '200': 30, '429': 15 });
    expect(t.pedidas).toContain('/p/pan-de-bono/');
  });

  it('❌ CA3: una página que responde 500, o un limitador que no está, son fallas', async () => {
    const caida = await cargaDeStaging({
      host: HOST,
      vueltas: 2,
      fetch: tienda({ caida: true }).f,
    });
    expect(caida.fallas).toEqual(['2 páginas respondieron 5xx o nada']);
    const sinLimite = await cargaDeStaging({
      host: HOST,
      vueltas: 1,
      fetch: tienda({ sinLimite: true }).f,
    });
    expect(sinLimite.fallas).toEqual([
      '45 cotizaciones seguidas y ningún 429: el limitador por IP no está puesto',
    ]);
  });
});
