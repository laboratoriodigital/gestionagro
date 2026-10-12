/**
 * Las calculadoras como habilidades de agente (HU-C8.3, PLATAFORMA §5.3 5): para que el agente de
 * un productor tenga la fórmula, los rangos y las fuentes, y calcule sin abrir el navegador.
 *
 * - `/.well-known/agent-skills/index.json` con `name`, `type: skill-md`, `description`, `url` y
 *   `sha256` de cada `SKILL.md`, calculado al armar el despliegue.
 * - **Solo la de una herramienta pública**, que es una `activo`: la misma compuerta de la revisión
 *   agronómica que manda sobre el sitemap y los gemelos (CA2). Una fórmula sin revisar no se le da
 *   a un agente para que la repita como cierta.
 * - **Sin ninguna publicada, no hay índice** (P1): un índice vacío diría «aquí hay habilidades».
 * - El `SKILL.md` es el gemelo de la página con el encabezado que piden las habilidades; no se
 *   escribe dos veces (P2).
 */
import { createHash } from 'node:crypto';
import type { PaginaPublica } from './gemelos.ts';

export const RUTA_DE_HABILIDADES = '/.well-known/agent-skills/';

export interface Habilidad {
  name: string;
  type: 'skill-md';
  description: string;
  url: string;
  sha256: string;
}

/** Las páginas públicas que son una herramienta: `/herramientas/agro/<nombre>/`. */
export const nombreDeHerramienta = (ruta: string): string | null =>
  /^\/herramientas\/agro\/([a-z0-9-]+)\/$/.exec(ruta)?.[1] ?? null;

/** El `SKILL.md` de una herramienta: el encabezado de la habilidad y el gemelo de su página. */
export function skillMd(nombre: string, pagina: PaginaPublica, gemelo: string): string {
  const descripcion = pagina.descripcion.replace(/\s+/g, ' ').replace(/"/g, "'");
  return `---\nname: ${nombre}\ndescription: "${descripcion}"\n---\n\n${gemelo}`;
}

export const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex');

/**
 * Las habilidades a publicar, con su archivo: `[ruta del SKILL.md, contenido]`. Vacío si no hay
 * ninguna herramienta pública.
 */
export function habilidadesDe(
  paginas: readonly { pagina: PaginaPublica; gemelo: string }[],
  sitio: string,
): { indice: { skills: Habilidad[] } | null; archivos: [string, string][] } {
  const archivos: [string, string][] = [];
  const skills: Habilidad[] = [];
  for (const { pagina, gemelo } of paginas) {
    const nombre = nombreDeHerramienta(pagina.ruta);
    if (!nombre) continue;
    const ruta = `${RUTA_DE_HABILIDADES}${nombre}/SKILL.md`;
    const texto = skillMd(nombre, pagina, gemelo);
    archivos.push([ruta, texto]);
    skills.push({
      name: nombre,
      type: 'skill-md',
      description: pagina.descripcion,
      url: `${sitio}${ruta}`,
      sha256: sha256(texto),
    });
  }
  return { indice: skills.length > 0 ? { skills } : null, archivos };
}
