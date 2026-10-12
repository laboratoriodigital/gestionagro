/**
 * HU-C8.3: las calculadoras como habilidades de agente. Con la página real de la DPV, como si ya
 * estuviera publicada: hoy las dos calculadoras siguen en revisión agronómica y no se publica
 * ninguna (CA2).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gemeloDe, type PaginaPublica } from '../../scripts/lib/gemelos.ts';
import {
  habilidadesDe,
  nombreDeHerramienta,
  RUTA_DE_HABILIDADES,
  sha256,
} from '../../scripts/lib/habilidades.ts';
import { cargarProductos } from '../../scripts/lib/productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const SITIO = 'https://cultivopro.co';
const DPV: PaginaPublica = {
  ruta: '/herramientas/agro/calculadora-dpv/',
  titulo: 'Calculadora de DPV',
  descripcion: 'Calcula el déficit de presión de vapor (DPV) de tu invernadero.',
};
const html = (cuerpo: string) => `<main><article>${cuerpo}</article></main>`;

describe('HU-C8.3 · las calculadoras como habilidades', () => {
  it('CA1 · una herramienta pública da su SKILL.md y su entrada en el índice, con la huella', () => {
    const gemelo = gemeloDe(DPV, html('<h2>Cómo se calcula el DPV</h2><p>es(T) = …</p>'), SITIO);
    const { indice, archivos } = habilidadesDe(
      [
        { pagina: DPV, gemelo },
        { pagina: { ...DPV, ruta: '/agro/guia/', titulo: 'Guía' }, gemelo: '# Guía' },
      ],
      SITIO,
    );
    const [ruta, texto] = archivos[0] ?? ['', ''];
    expect(ruta).toBe(`${RUTA_DE_HABILIDADES}calculadora-dpv/SKILL.md`);
    expect(texto.startsWith('---\nname: calculadora-dpv\ndescription: "Calcula el déficit')).toBe(
      true,
    );
    expect(texto).toContain('## Cómo se calcula el DPV');
    expect(indice).toEqual({
      skills: [
        {
          name: 'calculadora-dpv',
          type: 'skill-md',
          description: DPV.descripcion,
          url: 'https://cultivopro.co/.well-known/agent-skills/calculadora-dpv/SKILL.md',
          sha256: sha256(texto),
        },
      ],
    });
    // La guía no es una herramienta: no es una habilidad.
    expect(archivos).toHaveLength(1);
  });

  it('CA1 · la huella cambia si cambia una letra del SKILL.md', () => {
    expect(sha256('es(T) = 0,6108')).not.toBe(sha256('es(T) = 0,6109'));
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('CA2 ❌ · sin herramientas públicas no hay índice: uno vacío diría que hay habilidades', () => {
    expect(habilidadesDe([], SITIO)).toEqual({ indice: null, archivos: [] });
  });

  it('CA2 ❌ · hoy ninguna calculadora está activa, así que el build no publica habilidades', () => {
    const activas = cargarProductos().filter(
      (p) => p.estado === 'activo' && nombreDeHerramienta(p.slug),
    );
    const indice = join(RAIZ, 'apps', 'sitio', 'dist', '.well-known', 'agent-skills', 'index.json');
    if (activas.length === 0) {
      expect(existsSync(indice)).toBe(false);
    } else if (existsSync(indice)) {
      const publicadas = (
        JSON.parse(readFileSync(indice, 'utf8')) as { skills: { name: string }[] }
      ).skills.map((s) => s.name);
      expect(publicadas.sort()).toEqual(activas.map((p) => nombreDeHerramienta(p.slug)).sort());
    }
  });
});
