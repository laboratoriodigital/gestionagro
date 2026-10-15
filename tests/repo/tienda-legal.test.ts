/**
 * HU-T7.1: los textos legales de cada tienda, de las plantillas de `content/tienda/legal/` y de su
 * ficha. Las plantillas viven en un solo lugar y el horno usa exactamente las generadas (P2); un
 * dato que falta queda a la vista y la compuerta no publica (CA3); lo que escribe el comercio nunca
 * se vuelve HTML (HU-T4.2); y los textos no cuentan cómo está hecha la tienda.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compuerta,
  type DatosLegales,
  hornear,
  TEXTOS_LEGALES,
  textosLegales,
} from '../../packages/tienda-horno/src/index.ts';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  legalDeEnsayo,
} from '../../packages/tienda-schema/src/ensayos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';
import { RUTA_LEGAL_GENERADO, textoLegalGenerado } from '../../scripts/tienda/generar-legal.ts';

const DIR = join(RAIZ, 'content', 'tienda', 'legal');
const plantilla = (id: string) => readFileSync(join(DIR, `${id}.md`), 'utf8');

describe('las plantillas, en un solo lugar (CA1)', () => {
  it('el horno usa exactamente las generadas: node scripts/tienda/generar-legal.ts', () => {
    expect(readFileSync(RUTA_LEGAL_GENERADO, 'utf8')).toBe(textoLegalGenerado());
  });

  it('términos, privacidad, envíos, retracto, garantía y solicitudes, cada uno en su ruta', () => {
    expect(TEXTOS_LEGALES.map((t) => t.ruta)).toEqual([
      '/legal/terminos/',
      '/legal/privacidad/',
      '/legal/envios/',
      '/legal/retracto/',
      '/legal/garantia/',
      '/solicitud/',
    ]);
  });

  it('cada {{campo}} de una plantilla es un dato que la tienda sabe llenar', () => {
    const conTodo = textosLegales({
      ...(legalDeEnsayo(ENSAYO_UNO) as DatosLegales),
      garantia: 'Cambios en 30 días.',
      retracto: 'También en tienda física.',
    });
    for (const t of conTodo) expect(t.markdown).not.toContain('{{');
  });

  it('HU-T7.3 · la política dice los meses que la tienda guarda los contactos: 24 si no dijo otros', () => {
    const privacidad = (conservacionMeses?: number) =>
      textosLegales({
        ...(legalDeEnsayo(ENSAYO_UNO) as DatosLegales),
        ...(conservacionMeses ? { conservacionMeses } : {}),
      }).find((t) => t.id === 'privacidad')?.markdown ?? '';
    expect(privacidad()).toContain('hasta 24 meses después de él');
    expect(privacidad(36)).toContain('hasta 36 meses después de él');
    expect(privacidad(36)).not.toContain('24 meses');
  });

  it('❌ los textos no cuentan cómo está hecha la tienda', () => {
    const tecnicos =
      /\b(Worker|D1|R2|KV|JavaScript|API|JSON|servidor web|base de datos|horno|manifiesto|localStorage)\b/;
    for (const t of TEXTOS_LEGALES) expect(plantilla(t.id)).not.toMatch(tecnicos);
  });

  it('nombran a los subencargados con su país; Google y Meta solo si la tienda los usa', () => {
    const privacidad = (medicion: DatosLegales['medicion']) =>
      textosLegales({ ...(legalDeEnsayo(ENSAYO_DOS) as DatosLegales), medicion }).find(
        (t) => t.id === 'privacidad',
      )?.markdown ?? '';
    const sinMedir = privacidad({ ga4: false, pixelMeta: false });
    expect(sinMedir).toContain('Cloudflare, Inc. (Estados Unidos)');
    expect(sinMedir).not.toContain('Google LLC');
    expect(sinMedir).toContain('no usa cookies de medición');
    expect(privacidad({ ga4: true, pixelMeta: true })).toContain('Google LLC (Estados Unidos)');
    expect(privacidad({ ga4: true, pixelMeta: true })).toContain('Meta Platforms, Inc.');
  });
});

describe('los textos de cada tienda, en su vitrina (CA2 y CA3)', () => {
  const tienda = (legal: DatosLegales) =>
    hornear({
      dominio: hostDeStaging(ENSAYO_DOS.slug),
      release: 'r1',
      nombre: ENSAYO_DOS.nombre,
      apariencia: {
        acento: '#5c5a17',
        tinta: 'negra',
        estilo: 'precision',
        portada: 'catalogo',
        proporcion: '1:1',
        modo: 'claro',
      },
      agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
      legal,
      productos: [
        {
          slug: 'pan-de-bono',
          nombre: 'Pan de bono',
          opciones: [],
          variantes: [{ id: 'v1', clave: '', precioCop: 1500, stock: null }],
          actualizado: '2026-10-13T15:00:00.000Z',
        },
      ],
    });
  const base = legalDeEnsayo(ENSAYO_DOS) as DatosLegales;

  it('cada texto es una página con su gemelo, y el pie lleva la identidad, los textos y la SIC', async () => {
    const archivos = await tienda(base);
    for (const t of TEXTOS_LEGALES) {
      expect(archivos.has(`${t.ruta}index.html`)).toBe(true);
      expect(archivos.has(`${t.ruta}index.md`)).toBe(true);
    }
    const portada = archivos.get('/index.html')?.contenido ?? '';
    expect(portada).toContain(
      '<p class="pie__identidad">Comercio Ensayo Dos · C.C. 1000000002 · Medellín</p>',
    );
    expect(portada).toContain('<a href="/solicitud/">Solicitudes</a>');
    expect(portada).toContain('href="https://www.sic.gov.co"');
    expect(archivos.get('/legal/retracto/index.md')?.contenido).toContain(
      '- Pan de bono: Alimento perecedero (Ley 1480, art. 47)',
    );
  });

  it('❌ sin un dato de la ficha, el texto lo deja a la vista y la compuerta no publica', async () => {
    const { razonSocial: _, ...sinRazon } = base;
    const archivos = await tienda(sinRazon);
    expect(archivos.get('/legal/terminos/index.html')?.contenido).toContain('{{razon_social}}');
    const fallas = compuerta({ ajustes: {}, productos: [], archivos }).fallas;
    expect(
      fallas.some((f) => f.codigo === 'texto-de-fabrica' && f.mensaje.includes('/legal/')),
    ).toBe(true);
  });

  it('❌ sin textos legales, los enlaces del pie están rotos y la compuerta no publica', async () => {
    const archivos = await hornear({
      dominio: hostDeStaging(ENSAYO_DOS.slug),
      release: 'r1',
      nombre: ENSAYO_DOS.nombre,
      apariencia: {
        acento: '#5c5a17',
        tinta: 'negra',
        estilo: 'precision',
        portada: 'catalogo',
        proporcion: '1:1',
        modo: 'claro',
      },
      agentes: { search: 'yes', aiInput: 'yes', aiTrain: 'no' },
      productos: [],
    });
    const rotos = compuerta({ ajustes: {}, productos: [], archivos })
      .fallas.filter((f) => f.codigo === 'enlace-roto')
      .map((f) => f.mensaje);
    expect(rotos.some((m) => m.includes('/legal/terminos/'))).toBe(true);
  });

  it('❌ lo que escribe el comercio nunca se vuelve HTML', async () => {
    const archivos = await tienda({
      ...base,
      razonSocial: 'Pan <script>alert(1)</script> SAS',
      garantia: 'Mira [aquí](javascript:alert(1)) y **cambios** en 30 días.',
    });
    const terminos = archivos.get('/legal/terminos/index.html')?.contenido ?? '';
    expect(terminos).toContain('Pan &lt;script&gt;alert(1)&lt;/script&gt; SAS');
    expect(terminos).not.toContain('<script>alert');
    const garantia = archivos.get('/legal/garantia/index.html')?.contenido ?? '';
    expect(garantia).toContain('<strong>cambios</strong>');
    expect(garantia).not.toContain('javascript:');
  });
});
