/**
 * Control de calidad por página de herramienta (ED1 §12.1 y §12.2, HU-E2.5). Ninguna herramienta
 * pasa si su contenido es una plantilla vacía. Se comprueba lo que se puede comprobar:
 *
 * - Las cuatro preguntas de ED1 §12.1: «Para qué sirve» (problema, qué hacer ya, qué obtiene) y
 *   «Qué hacer con el resultado» (siguiente paso).
 * - Un «Ejemplo resuelto» con números de verdad: una cifra con coma (0,90 kPa), una fecha (13/12)
 *   o una hora (19:00), dentro de esa sección.
 * - Al menos 5 preguntas frecuentes, específicas (respuestas de 80 caracteres o más, sin repetir).
 * - Pasos de uso para el JSON-LD HowTo.
 * - Fuentes con año y relacionados definidos en el contrato.
 * - Al menos 300 palabras propias.
 * - Sin jerga interna del repositorio en lo que lee el productor.
 *
 * Lo que no comprueba (P17): que el texto sea correcto agronómicamente. Eso lo decide la
 * revisión agronómica, que el contrato exige antes de `activo` (HU-E1.3).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { Producto } from './productos.ts';
import { RAIZ } from './repo.ts';

export interface PaginaDeHerramienta {
  revision_agronomica: string;
  preguntas: { pregunta: string; respuesta: string }[];
  pasos: { nombre: string; texto: string }[];
  /**
   * Cómo se presenta en la página de entrada de las herramientas: la pregunta del productor que
   * responde, qué necesita tener a mano y, si hay, qué más trae.
   */
  entrada: { pregunta: string; necesitas: string; incluye?: string };
}

export const MINIMO_PREGUNTAS = 5;
export const MINIMO_PALABRAS = 300;
const JERGA_INTERNA = /\bHU-E\d|\bWI-E\d|packages\/|apps\/|\bADR-\d|\bP\d{1,2}\b/;
const SECCIONES_OBLIGATORIAS = [
  '## Para qué sirve',
  '## Ejemplo resuelto',
  '## Qué hacer con el resultado',
];

export interface ContenidoLeido {
  markdown: string[];
  pagina: PaginaDeHerramienta | null;
}

export function leerContenido(carpeta: string, raiz = RAIZ): ContenidoLeido {
  const dir = join(raiz, carpeta);
  const markdown = readdirSync(dir)
    .filter((a) => a.endsWith('.md'))
    .sort()
    .map((a) => readFileSync(join(dir, a), 'utf8'));
  const rutaPagina = join(dir, 'pagina.yaml');
  const pagina = existsSync(rutaPagina)
    ? (parse(readFileSync(rutaPagina, 'utf8')) as PaginaDeHerramienta)
    : null;
  return { markdown, pagina };
}

const sinFrontmatter = (md: string) => md.replace(/^---\n[\s\S]*?\n---\n/, '');

export function revisarCalidad(p: Producto, c: ContenidoLeido): string[] {
  const fallas: string[] = [];
  const texto = c.markdown.map(sinFrontmatter).join('\n');

  for (const seccion of SECCIONES_OBLIGATORIAS) {
    if (!texto.split('\n').some((linea) => linea.trim() === seccion))
      fallas.push(`falta la sección «${seccion.slice(3)}»`);
  }
  const ejemplo = texto.split(/^## /m).find((s) => s.startsWith('Ejemplo resuelto')) ?? '';
  if (!/\d+[,/:]\d+/.test(ejemplo)) fallas.push('el ejemplo resuelto no trae números');

  const palabras = texto.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length;
  if (palabras < MINIMO_PALABRAS)
    fallas.push(`tiene ${palabras} palabras; el mínimo es ${MINIMO_PALABRAS}`);

  if (!c.pagina) {
    fallas.push('falta pagina.yaml con preguntas frecuentes y pasos');
  } else {
    const preguntas = c.pagina.preguntas ?? [];
    if (preguntas.length < MINIMO_PREGUNTAS) {
      fallas.push(
        `tiene ${preguntas.length} preguntas frecuentes; el mínimo es ${MINIMO_PREGUNTAS}`,
      );
    }
    const vistas = new Set<string>();
    for (const q of preguntas) {
      if (!q.pregunta?.trim().endsWith('?')) fallas.push(`«${q.pregunta}» no es una pregunta`);
      if ((q.respuesta ?? '').trim().length < 80)
        fallas.push(`la respuesta a «${q.pregunta}» es demasiado corta`);
      const clave = q.pregunta?.trim().toLowerCase() ?? '';
      if (vistas.has(clave)) fallas.push(`la pregunta «${q.pregunta}» está repetida`);
      vistas.add(clave);
    }
    if ((c.pagina.pasos ?? []).length < 2)
      fallas.push('pagina.yaml necesita al menos 2 pasos de uso');
    const entrada = c.pagina.entrada;
    if (!entrada?.pregunta?.trim().endsWith('?'))
      fallas.push(
        'pagina.yaml necesita «entrada.pregunta»: la pregunta que responde la herramienta',
      );
    if (!entrada?.necesitas?.trim())
      fallas.push('pagina.yaml necesita «entrada.necesitas»: qué tener a mano para usarla');
  }

  for (const f of p.fuentes) {
    if (!/\b(19|20)\d{2}\b/.test(f)) fallas.push(`la fuente «${f}» no tiene año`);
  }
  if (p.fuentes.length === 0) fallas.push('el contrato no declara fuentes');
  if (p.relacionados.length === 0) fallas.push('el contrato no declara relacionados');

  const todo = [texto, ...(c.pagina ? [JSON.stringify(c.pagina)] : [])].join('\n');
  const jerga = todo.match(JERGA_INTERNA);
  if (jerga) fallas.push(`el contenido tiene jerga interna del repositorio: «${jerga[0]}»`);

  return fallas;
}
