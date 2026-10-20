/**
 * HU-T14.6: cuadrar ya una tienda desde el flujo (`scripts/tienda/cuadrar.ts`), sin la cuenta. Dice
 * en palabras las dos cifras y nunca da por hecho lo que la API no hizo.
 */
import { describe, expect, it } from 'vitest';
import { cuadrar } from '../../scripts/tienda/cuadrar.ts';
import { panelDe } from '../../scripts/tienda/suspender.ts';

const pedido = { ambiente: 'staging' as const, org: 'org-de-prueba' };

describe('cuadrar una tienda desde el flujo (HU-T14.6)', () => {
  it('llama la ruta del despliegue del panel del ambiente, con el secreto, y dice las cifras', async () => {
    const pedidos: { url: string; secreto: string | null; cuerpo: unknown }[] = [];
    const r = await cuadrar(pedido, 'secreto', async (url, init) => {
      pedidos.push({
        url,
        secreto: new Headers(init?.headers).get('x-despliegue'),
        cuerpo: JSON.parse(String(init?.body)),
      });
      return Response.json({
        estado: 'cuadrado',
        semana: '2026-10-13',
        org: 'org-de-prueba',
        base: { pedidos: 4, pagos: 1 },
        eventos: { pedidos: 3, pagos: 2 },
      });
    });
    expect(r).toEqual({
      ok: true,
      texto:
        'Semana del 2026-10-13: pedidos 4 en la base y 3 en la medición; pagos 1 y 2. Ya se ve en el Inicio del panel.',
    });
    expect(pedidos).toEqual([
      {
        url: `${panelDe('staging')}/api/despliegue/cuadre`,
        secreto: 'secreto',
        cuerpo: { org: 'org-de-prueba' },
      },
    ]);
  });

  it('❌ una tienda que no existe o sin métricas no se da por cuadrada', async () => {
    expect(
      await cuadrar(pedido, 's', async () =>
        Response.json({ estado: 'no-existe' }, { status: 404 }),
      ),
    ).toEqual({ ok: false, texto: 'No hay una tienda org-de-prueba en staging.' });
    const sin = await cuadrar(pedido, 's', async () =>
      Response.json({ estado: 'sin-configurar', motivo: 'sin métricas' }, { status: 503 }),
    );
    expect(sin).toEqual({ ok: false, texto: 'La API respondió 503: sin métricas' });
  });
});
