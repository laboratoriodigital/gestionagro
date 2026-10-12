import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import norma from '../../../../content/parqueadero/cupos-electricos.json' with { type: 'json' };
import { HERRAMIENTAS_CON_EVENTOS } from '../worker.ts';
import {
  CUPOS,
  fechaLarga,
  GENERADOR,
  gemelo,
  HERRAMIENTAS,
  LIQUIDADOR,
  llmsTxt,
  ORIGEN,
  PAGINAS,
  PORTADA,
} from './contenido.ts';

const PAGES = join(import.meta.dirname, '..', 'pages');

describe('el texto del sitio y su capa para agentes (HU-Q11.5 CA1, ADR-24)', () => {
  it('cada enlace de `llms.txt` es el gemelo de una página que existe, en el dominio', () => {
    const enlaces = [...llmsTxt().matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1] ?? '');
    expect(enlaces.length).toBe(PAGINAS.length + 1);
    for (const e of enlaces) expect(e.startsWith(`${ORIGEN}/`), e).toBe(true);
    for (const p of PAGINAS) {
      expect(enlaces).toContain(`${ORIGEN}${p.ruta}index.md`);
      expect(existsSync(join(PAGES, p.ruta, 'index.astro')), p.ruta).toBe(true);
      expect(existsSync(join(PAGES, p.ruta, 'index.md.ts')), p.ruta).toBe(true);
    }
    expect(enlaces).toContain(`${ORIGEN}/caja/`);
  });

  it('el gemelo dice lo mismo que la página: su titular y el siguiente paso a la caja', () => {
    expect(gemelo(PORTADA)).toMatch(new RegExp(`^# ${PORTADA.titular}\\n`));
    expect(gemelo(PORTADA)).toContain(`${ORIGEN}${GENERADOR.ruta}`);
    expect(gemelo(GENERADOR)).toMatch(new RegExp(`^# ${GENERADOR.titular}\\n`));
    expect(gemelo(GENERADOR)).toContain(`## ${GENERADOR.siguiente.titulo}`);
    expect(gemelo(GENERADOR)).toContain(`(${ORIGEN}/caja/)`);
    expect(gemelo(PORTADA)).toContain(`${ORIGEN}${LIQUIDADOR.ruta}`);
    expect(gemelo(LIQUIDADOR)).toMatch(new RegExp(`^# ${LIQUIDADOR.titular}\\n`));
    expect(gemelo(LIQUIDADOR)).toContain(`## ${LIQUIDADOR.siguiente.titulo}`);
    expect(gemelo(LIQUIDADOR)).toContain(`(${ORIGEN}/caja/)`);
  });

  it('los cupos para eléctricos citan la norma leída, con su fecha de consulta (HU-Q11.7 CA1, P18)', () => {
    expect(norma.texto_citado).toContain(`(${norma.porcentaje_minimo}%)`);
    expect(norma.consultada <= new Date().toISOString().slice(0, 10)).toBe(true);
    expect(norma.fuentes.length).toBeGreaterThanOrEqual(2);
    for (const f of norma.fuentes) expect(f).toMatch(/^https:\/\/[^/]+\.gov\.co\//);
    expect(fechaLarga(norma.consultada)).toBe('9 de octubre de 2026');
    expect(gemelo(CUPOS)).toContain(`artículo ${norma.articulo}`);
    expect(gemelo(CUPOS)).toContain(`Consultada el ${fechaLarga(norma.consultada)}`);
  });

  it('cada herramienta cuenta sus eventos en el Worker, con un producto propio', () => {
    const productos = HERRAMIENTAS.map((h) => h.producto);
    expect(new Set(productos).size).toBe(productos.length);
    for (const p of productos) expect(HERRAMIENTAS_CON_EVENTOS).toContain(p);
  });

  it('❌ el código que corre en el navegador no carga `contenido.ts` ni `productos.json` (bitácora 32)', () => {
    for (const archivo of ['recibo-de-entrada.ts', 'mensualidad.ts', 'cupos-electricos.ts']) {
      const script = readFileSync(join(import.meta.dirname, '..', 'herramientas', archivo), 'utf8');
      expect(script, archivo).not.toMatch(/from ['"][^'"]*(contenido|productos\.json)/);
    }
  });

  it('❌ las páginas públicas no cargan nada de otro origen (CA3, CSP `self`)', () => {
    const fuentes = [
      join(PAGES, 'index.astro'),
      join(PAGES, 'herramientas', 'recibo-de-entrada', 'index.astro'),
      join(PAGES, 'herramientas', 'mensualidad-de-parqueadero', 'index.astro'),
      join(PAGES, 'herramientas', 'cupos-para-electricos', 'index.astro'),
      join(import.meta.dirname, '..', 'layouts', 'Sitio.astro'),
      join(import.meta.dirname, '..', '..', 'public', 'sitio.css'),
    ];
    for (const f of fuentes) {
      const texto = readFileSync(f, 'utf8');
      expect(texto, f).not.toMatch(/\b(src|href)=["']?(https?:)?\/\//);
      expect(texto, f).not.toMatch(/url\(\s*["']?(https?:)?\/\//);
      expect(texto, f).not.toMatch(/@import/);
    }
  });
});
