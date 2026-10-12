/**
 * HU-C8.2: los gemelos en Markdown y `llms.txt`. Sobre un build de mentira en una carpeta temporal:
 * lo que no ve (P17) es el build real de Astro, que el e2e del sitio sí abre.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { enlaceDeAgentes, textoDeCabeceras } from '../../scripts/lib/cabeceras.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import {
  enlacesQueFaltan,
  gemeloDe,
  htmlAMarkdown,
  llmsTxt,
  paginasPublicas,
} from '../../scripts/lib/gemelos.ts';

const SITIO = 'https://cultivopro.co';
const pagina = (titulo: string, cuerpo: string, noindex = false) =>
  `<!doctype html><html><head><title>${titulo} | CultivoPro</title><meta name="description" content="De ${titulo}.">${noindex ? '<meta name="robots" content="noindex">' : ''}</head><body><header><a href="/">CultivoPro</a></header><main><article>${cuerpo}</article></main><footer>pie</footer></body></html>`;

const dist = mkdtempSync(join(tmpdir(), 'gemelos-'));
const escribir = (ruta: string, html: string) => {
  mkdirSync(join(dist, ruta), { recursive: true });
  writeFileSync(join(dist, ruta, 'index.html'), html);
};
escribir('agro/guia', pagina('Cómo usar CultivoPro', '<h1>Cómo usar</h1><p>Hola</p>'));
escribir('herramientas/agro/calculadora-dpv', pagina('Calculadora de DPV', '<p>x</p>', true));
escribir('agro/app', pagina('Cuaderno', '<p>app</p>'));
afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('HU-C8.2 · HTML a Markdown', () => {
  it('títulos, párrafos, listas, enlaces, negritas, definiciones y tablas', () => {
    const md = htmlAMarkdown(
      `<main><article><h1>Guía</h1><p>Un <strong>cuaderno</strong> &amp; <em>más</em>, <a href="/agro/app/">ábralo</a>.</p>
      <ol><li>Uno</li><li>Dos <strong>pasos</strong></li></ol><ul><li><p>Con bloque</p><ul><li>Dentro</li></ul></li></ul>
      <dl><dt>Clima</dt><dd>La humedad.</dd></dl><details><summary>¿Duda?</summary><p>Respuesta.</p></details>
      <table><tr><th>Cultivo</th><th>DPV</th></tr><tr><td>Tomate</td><td>0,5 a 1,2</td></tr></table></article></main>`,
    );
    expect(md).toBe(
      `${[
        '# Guía',
        'Un **cuaderno** & *más*, [ábralo](/agro/app/).',
        '1. Uno\n2. Dos **pasos**',
        '- Con bloque\n  - Dentro',
        '**Clima**',
        'La humedad.',
        '**¿Duda?**',
        'Respuesta.',
        '| Cultivo | DPV |\n| --- | --- |\n| Tomate | 0,5 a 1,2 |',
      ].join('\n\n')}\n`,
    );
  });

  it('lo que es de la página y no del contenido no entra: calculadora, scripts, navegación', () => {
    const md = htmlAMarkdown(
      '<main><article><nav>migas</nav><astro-island><button>Calcular</button></astro-island><script>x()</script><noscript>Sin JS</noscript><p>El cálculo a mano.</p></article></main>',
    );
    expect(md).toBe('El cálculo a mano.\n');
  });
});

describe('HU-C8.2 · las páginas públicas, sus gemelos y llms.txt', () => {
  const publicas = paginasPublicas(dist, 'CultivoPro');

  it('solo lo que se indexa: ni un borrador ni la app tienen gemelo', () => {
    expect(publicas).toEqual([
      {
        ruta: '/agro/guia/',
        titulo: 'Cómo usar CultivoPro',
        descripcion: 'De Cómo usar CultivoPro.',
      },
    ]);
  });

  it('CA1 · el gemelo dice su título, su resumen y su dirección, y luego el contenido', () => {
    const [guia] = publicas;
    if (!guia) throw new Error('sin guía');
    expect(gemeloDe(guia, pagina('x', '<h1>Cómo usar</h1><p>Hola</p>'), SITIO)).toBe(
      '# Cómo usar CultivoPro\n\n> De Cómo usar CultivoPro.\n\nPágina: https://cultivopro.co/agro/guia/\n\nHola\n',
    );
  });

  it('CA1 · llms.txt enlaza cada gemelo, dice que no hay herramientas publicadas y cómo contactar', () => {
    const llms = llmsTxt(publicas, {
      nombre: 'CultivoPro',
      lema: 'Lema',
      sitio: SITIO,
      correo: 'correo@example.com',
    });
    expect(llms).toContain('- [Cómo usar CultivoPro](https://cultivopro.co/agro/guia/index.md)');
    expect(llms).toContain('Ninguna publicada todavía');
    expect(llms).toContain('- Correo: correo@example.com');
  });

  it('CA3 ❌ · un enlace de llms.txt que no está en el build se nombra', () => {
    writeFileSync(join(dist, 'agro', 'guia', 'index.md'), '# ok');
    const llms =
      '- [Guía](https://cultivopro.co/agro/guia/index.md)\n- [DPV](https://cultivopro.co/herramientas/agro/calculadora-dpv/index.md)\n- [Afuera](https://otro.example/x)';
    expect(enlacesQueFaltan(llms, dist, SITIO)).toEqual([
      '/herramientas/agro/calculadora-dpv/index.md',
    ]);
  });

  it('CA1 · la cabecera Link de cada página pública anuncia su gemelo y llms.txt', () => {
    const texto = textoDeCabeceras(cargarCeldas(), ['/agro/guia/']);
    expect(texto).toContain(`/agro/guia/\n  Link: ${enlaceDeAgentes('/agro/guia/')}`);
    expect(texto).toContain('/agro/guia/index.md\n  Content-Type: text/markdown; charset=utf-8');
    expect(textoDeCabeceras(cargarCeldas())).not.toContain('Link:');
  });
});
