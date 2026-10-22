/**
 * HU-T13.6: el clic del operador (`scripts/tienda/suspender.ts`), sin la cuenta. Dice en palabras lo
 * que pasó, y nunca da por hecho lo que la API no hizo.
 */
import { describe, expect, it } from 'vitest';
import { panelDe, suspender } from '../../scripts/tienda/suspender.ts';

const pedido = {
  ambiente: 'staging' as const,
  org: 'org-de-prueba',
  accion: 'suspender' as const,
  motivo: 'reporte de suplantación',
};

describe('suspender una tienda desde el flujo (HU-T13.6)', () => {
  it('llama la ruta del despliegue del panel del ambiente, con el secreto', async () => {
    const pedidos: { url: string; secreto: string | null; cuerpo: unknown }[] = [];
    const r = await suspender(pedido, 'secreto', async (url, init) => {
      pedidos.push({
        url,
        secreto: new Headers(init?.headers).get('x-despliegue'),
        cuerpo: JSON.parse(String(init?.body)),
      });
      return Response.json({ estado: 'ok', ahora: 'suspendida' });
    });
    expect(r).toEqual({ ok: true, texto: expect.stringMatching(/quedó suspendida/) });
    expect(pedidos).toEqual([
      {
        url: `${panelDe('staging')}/api/despliegue/tienda-estado`,
        secreto: 'secreto',
        cuerpo: { org: 'org-de-prueba', accion: 'suspender', motivo: 'reporte de suplantación' },
      },
    ]);
    expect(panelDe('produccion')).toBe('https://app.tiendapro.co');
  });

  it('❌ una tienda que no existe o una API que falla no se dan por hechas', async () => {
    const noExiste = await suspender(pedido, 's', async () =>
      Response.json({ estado: 'no-existe' }, { status: 404 }),
    );
    expect(noExiste).toEqual({ ok: false, texto: 'No hay una tienda org-de-prueba en staging.' });
    const falla = await suspender(pedido, 's', async () =>
      Response.json({ estado: 'sin-configurar' }, { status: 503 }),
    );
    expect(falla.ok).toBe(false);
    const igual = await suspender(pedido, 's', async () =>
      Response.json({ estado: 'sin-cambio', ahora: 'suspendida' }),
    );
    expect(igual).toEqual({ ok: true, texto: 'La tienda ya estaba «suspendida»: nada cambió.' });
  });
});
