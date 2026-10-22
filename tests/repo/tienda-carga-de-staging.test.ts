/**
 * HU-T11.10 CA2: la prueba de carga contra staging, con una tienda de mentira. Lo que cuenta: que
 * diga lo que vio, que una página caída o un limitador ausente sean fallas, y que no se rinda.
 * Bitácora tienda3 53: las cotizaciones van en ráfagas, y el 429 de la regla de la zona se cuenta
 * aparte del de la tienda.
 */
import { describe, expect, it } from 'vitest';
import { cargaDeStaging } from '../../scripts/tienda/carga-de-staging.ts';

const HOST = 'ensayo-dos--staging.mitiendapro.co';

function tienda(o: { caida?: boolean; sinLimite?: boolean; zona?: boolean } = {}) {
  let cotizaciones = 0;
  let aLaVez = 0;
  let maximo = 0;
  const pedidas: string[] = [];
  const f = async (url: string) => {
    const ruta = new URL(url).pathname;
    pedidas.push(ruta);
    if (ruta === '/catalogo.json') return Response.json({ productos: [{ slug: 'pan-de-bono' }] });
    if (ruta === '/api/v1/cotizar') {
      // El número de esta cotización, antes de esperar: las de la ráfaga llegan a la vez.
      const n = ++cotizaciones;
      aLaVez++;
      maximo = Math.max(maximo, aLaVez);
      await new Promise((listo) => setTimeout(listo, 1));
      aLaVez--;
      // La regla de la zona corta antes que la tienda, con la página de Cloudflare.
      if (o.zona && n > 60) return new Response('error code: 1015', { status: 429 });
      return o.sinLimite || n <= 30
        ? Response.json({ estado: 'invalido' }, { status: 422 })
        : Response.json({ estado: 'limite' }, { status: 429 });
    }
    if (o.caida && ruta === '/carrito/') return new Response('error', { status: 500 });
    return new Response('<html></html>');
  };
  return { f, pedidas, rafaga: () => maximo };
}

describe('scripts/tienda/carga-de-staging.ts (HU-T11.10 CA2)', () => {
  it('pide cada página varias veces y cotiza en ráfagas hasta ver el 429 del limitador por IP', async () => {
    const t = tienda();
    const r = await cargaDeStaging({ host: HOST, vueltas: 5, aLaVez: 3, fetch: t.f });
    expect(r.fallas).toEqual([]);
    expect(r.paginas.pedidas).toBe(20);
    expect(r.paginas.porEstado).toEqual({ '200': 20 });
    expect(r.cotizar.porEstado).toEqual({ '422': 30, '429': 90 });
    expect(t.rafaga()).toBe(20);
    expect(t.pedidas).toContain('/p/pan-de-bono/');
    // Sin la regla de la zona, lo dice sin fallar.
    expect(r.avisos).toEqual([
      'la regla de límite de la zona no bloqueó ninguna: revisa en Cloudflare que esté desplegada',
    ]);
  });

  it('el 429 de la regla de la zona se cuenta aparte, y entonces no hay aviso', async () => {
    const r = await cargaDeStaging({ host: HOST, vueltas: 1, fetch: tienda({ zona: true }).f });
    expect(r.cotizar.porEstado).toEqual({ '422': 30, '429': 30, '429 zona': 60 });
    expect(r.avisos).toEqual([]);
    expect(r.fallas).toEqual([]);
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
      '120 cotizaciones en ráfagas y ningún 429: el limitador por IP no está puesto',
    ]);
  });
});
