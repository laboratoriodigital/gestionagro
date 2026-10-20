/**
 * HU-T14.7: anotar soporte desde el flujo (`scripts/tienda/anotar-soporte.ts`), sin la cuenta. Dice
 * lo que quedó anotado y nunca da por hecho lo que la API no hizo.
 */
import { describe, expect, it } from 'vitest';
import { anotar } from '../../scripts/tienda/anotar-soporte.ts';
import { panelDe } from '../../scripts/tienda/suspender.ts';

const atencion = {
  ambiente: 'produccion' as const,
  org: '0199e0a0-0000-7000-8000-0000000000c1',
  minutos: 20,
  tema: 'catalogo' as const,
};

describe('anotar soporte desde el flujo (HU-T14.7)', () => {
  it('llama la ruta del despliegue del panel del ambiente, con el secreto', async () => {
    const pedidos: { url: string; secreto: string | null; cuerpo: unknown }[] = [];
    const r = await anotar(atencion, 'secreto', async (url, init) => {
      pedidos.push({
        url,
        secreto: new Headers(init?.headers).get('x-despliegue'),
        cuerpo: JSON.parse(String(init?.body)),
      });
      return Response.json({ estado: 'anotado', dia: '2026-10-26', minutos: 20 });
    });
    expect(r).toEqual({ ok: true, texto: 'Anotados 20 minutos de «catalogo» el 2026-10-26.' });
    expect(pedidos).toEqual([
      {
        url: `${panelDe('produccion')}/api/despliegue/soporte`,
        secreto: 'secreto',
        cuerpo: { org: atencion.org, minutos: 20, tema: 'catalogo' },
      },
    ]);
  });

  it('❌ una tienda que no existe o un dato malo no se dan por anotados', async () => {
    expect(
      await anotar(atencion, 's', async () =>
        Response.json({ estado: 'no-existe' }, { status: 404 }),
      ),
    ).toEqual({ ok: false, texto: `No hay una tienda ${atencion.org} en produccion.` });
    const malo = await anotar(atencion, 's', async () =>
      Response.json({ estado: 'problemas', motivo: 'faltan los minutos' }, { status: 422 }),
    );
    expect(malo).toEqual({ ok: false, texto: 'La API respondió 422: faltan los minutos' });
  });
});
