/**
 * HU-T14.4 (D-T13): GA4 y el píxel de Meta en la vitrina. El aviso se hornea solo si el comercio
 * los configuró, con aceptar y rechazar iguales; ningún programa de afuera viene horneado (todo
 * carga después de aceptar); la CSP suma sus orígenes solo para esa tienda, y Meta nunca en una
 * dirección de la plataforma. Ningún dato real.
 */
import { ENSAYO_UNO, legalDeEnsayo } from '@ed1/tienda-schema/ensayos';
import { describe, expect, it } from 'vitest';
import { cspDeLaVitrina, tercerosDeLaDireccion } from './csp.ts';
import { hornear, manifiesto, type TiendaParaHornear, tercerosDe } from './horno.ts';
import { ACENTOS_DE_LA_VITRINA } from './tema.ts';

const PLATAFORMA = 'ensayo-uno--staging.laboratorio-digital.app';
const PROPIO = 'www.tienda-uno.example';

const tienda = (extra: Partial<TiendaParaHornear> = {}): TiendaParaHornear => ({
  dominio: PLATAFORMA,
  release: 'r1',
  nombre: ENSAYO_UNO.nombre,
  apariencia: {
    acento: ACENTOS_DE_LA_VITRINA.cobre,
    tinta: 'azul',
    estilo: 'editorial',
    portada: 'editorial',
    proporcion: '4:5',
    modo: 'telefono',
  },
  agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
  legal: legalDeEnsayo(ENSAYO_UNO),
  productos: ENSAYO_UNO.productos.map((p) => ({
    slug: p.slug,
    nombre: p.nombre,
    opciones: p.opciones,
    variantes: p.variantes,
    actualizado: '2026-10-20T15:00:00.000Z',
  })),
  ...extra,
});
const AMBOS = { ga4: 'G-ENSAYO1234', pixelMeta: '123456789012' };

describe('lo que mide la tienda (HU-T14.4)', () => {
  it('GA4 también en la dirección de la plataforma; Meta, solo con dominio propio (D-T13)', () => {
    expect(tercerosDe({ dominio: PLATAFORMA, terceros: AMBOS })).toEqual(['ga4']);
    expect(tercerosDe({ dominio: PROPIO, terceros: AMBOS })).toEqual(['ga4', 'meta']);
    expect(tercerosDe({ dominio: PROPIO, terceros: { ga4: 'UA-123', pixelMeta: 'x' } })).toEqual(
      [],
    );
    expect(tercerosDe({ dominio: PROPIO })).toEqual([]);
  });

  it('CA1: el aviso sale oculto, con aceptar y rechazar iguales, y nada de afuera horneado', async () => {
    const a = await hornear(tienda({ dominio: PROPIO, terceros: AMBOS }));
    const html = a.get('/index.html')?.contenido ?? '';
    expect(html).toMatch(
      /<aside class="consentimiento" data-consentimiento data-ga4="G-ENSAYO1234" data-pixel="123456789012" aria-label="Tus datos de medición" hidden>/,
    );
    expect(html).toContain('mide sus visitas con Google Analytics y Meta');
    expect(html).toContain(
      '<button class="boton boton--secundario" type="button" data-rechazar>No acepto</button><button class="boton boton--secundario" type="button" data-aceptar>Acepto</button>',
    );
    expect(html).toContain('data-preferencias>Tus datos de medición</button>');
    // ❌ CA3: ningún programa ni imagen de Google o Meta viene en la página.
    expect(html).not.toMatch(/googletagmanager|google-analytics|facebook/);
  });

  it('❌ CA3: en la dirección de la plataforma el píxel no se hornea, y sin códigos no hay aviso', async () => {
    const plataforma = (await hornear(tienda({ terceros: AMBOS }))).get('/index.html')?.contenido;
    expect(plataforma).toContain('data-ga4="G-ENSAYO1234"');
    expect(plataforma).not.toContain('data-pixel');
    expect(plataforma).toContain('mide sus visitas con Google Analytics para');
    const sin = (await hornear(tienda())).get('/index.html')?.contenido;
    expect(sin).not.toContain('data-consentimiento');
    expect(sin).not.toContain('data-preferencias');
  });

  it('el aviso propio del comercio reemplaza al de fábrica, escapado', async () => {
    const html = (
      await hornear(tienda({ terceros: { ga4: AMBOS.ga4, aviso: 'Medimos <b>todo</b>, ¿vale?' } }))
    ).get('/index.html')?.contenido;
    expect(html).toContain('Medimos &lt;b&gt;todo&lt;/b&gt;, ¿vale?');
  });

  it('CA2: el manifiesto dice lo que se mide y la CSP lo suma solo para esa tienda', async () => {
    const t = tienda({ dominio: PROPIO, terceros: AMBOS });
    const m = await manifiesto(await hornear(t), {}, tercerosDe(t));
    expect(m.terceros).toEqual(['ga4', 'meta']);
    const csp = cspDeLaVitrina(undefined, '/', tercerosDeLaDireccion(m.terceros, PROPIO));
    expect(csp).toContain(
      "script-src 'self' https://www.googletagmanager.com https://connect.facebook.net",
    );
    expect(csp).toContain("connect-src 'self' https://www.googletagmanager.com");
    expect(cspDeLaVitrina(undefined, '/')).toContain("script-src 'self';");
  });

  it('❌ CA3: aunque el manifiesto lo diga, una dirección de la plataforma nunca deja pasar a Meta', () => {
    expect(tercerosDeLaDireccion(['ga4', 'meta'], PLATAFORMA)).toEqual(['ga4']);
    expect(tercerosDeLaDireccion(['meta'], 'laboratorio-digital.app')).toEqual([]);
    expect(tercerosDeLaDireccion(['ga4', 'meta'], PROPIO)).toEqual(['ga4', 'meta']);
    expect(
      cspDeLaVitrina(undefined, '/', tercerosDeLaDireccion(['ga4', 'meta'], PLATAFORMA)),
    ).not.toContain('facebook');
  });
});
