/**
 * El CSS de los tokens v2, generado desde `packages/ui/src/v2/tokens.ts` (P2, HU-C6.1).
 *
 * Una sola hoja (`tokens.css`) en vez de una por capa: una solicitud menos en cada página, y la
 * hoja entera pesa menos de 4 KB. El orden de las reglas es el de las capas: primitivos,
 * semánticos del ecosistema en claro y en oscuro, y los temas de cada producto.
 */
import {
  BOLETIN,
  ESPACIO,
  FORMA,
  GRISES,
  MOVIMIENTO,
  type Modo,
  SEMANTICOS,
  type Semanticos,
  TEMAS,
  TIPO,
} from '@ed1/ui/v2/tokens';

const ENCABEZADO = `/*
 * GENERADO por scripts/generar-ui.ts desde packages/ui/src/v2/tokens.ts. No editar a mano:
 * una prueba compara este archivo con lo que genera (P2). Tokens v2 del ecosistema (ADR-29).
 */
`;

const decl = (pares: Record<string, string>, sangria = '  ') =>
  Object.entries(pares)
    .map(([k, v]) => `${sangria}--${k}: ${v};`)
    .join('\n');

const semanticos = (s: Partial<Semanticos>, sangria = '  ') =>
  decl(s as Record<string, string>, sangria);

function primitivos(): string {
  const grises = Object.fromEntries(Object.entries(GRISES).map(([k, v]) => [`gris-${k}`, v]));
  const espacio = Object.fromEntries(Object.entries(ESPACIO).map(([k, v]) => [`espacio-${k}`, v]));
  return decl({ ...grises, ...TIPO, ...espacio, ...FORMA, ...MOVIMIENTO, ...BOLETIN });
}

/** Las tres reglas de un modo oscuro: por preferencia (salvo que se fije claro) y fijado. */
function oscuro(selector: string, cuerpo: string): string {
  return [
    `@media (prefers-color-scheme: dark) {\n  ${selector}:not([data-tema='claro']) {\n${cuerpo}\n  }\n}`,
    `${selector}[data-tema='oscuro'] {\n${cuerpo.replaceAll('\n    ', '\n  ').replace(/^ {4}/, '  ')}\n}`,
  ].join('\n\n');
}

export function cssDeTokens(): string {
  const bloques: string[] = [
    `:root {\n  color-scheme: light dark;\n${primitivos()}\n\n${semanticos(SEMANTICOS.claro)}\n}`,
    oscuro(':root', semanticos(SEMANTICOS.oscuro, '    ')),
  ];
  for (const [producto, modos] of Object.entries(TEMAS)) {
    const sel = `:root[data-producto='${producto}']`;
    bloques.push(`${sel} {\n${semanticos(modos.claro)}\n}`);
    bloques.push(oscuro(sel, semanticos(modos.oscuro, '    ')));
  }
  const cero = Object.keys(MOVIMIENTO)
    .filter((k) => k.startsWith('tiempo-'))
    .map((k) => `    --${k}: 0ms;`)
    .join('\n');
  bloques.push(`@media (prefers-reduced-motion: reduce) {\n  :root {\n${cero}\n  }\n}`);
  return `${ENCABEZADO}\n${bloques.join('\n\n')}\n`;
}

export const ARCHIVOS_UI = { 'packages/ui/src/v2/tokens.css': cssDeTokens } as const;

/**
 * Colores escritos a mano en un estilo de componente o de app (CA3): un componente usa
 * `var(--acento)`, nunca `#2340d0`. Ignora comentarios. Devuelve cada color encontrado.
 */
export function coloresSueltos(css: string): string[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const patron = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/gi;
  return [...sinComentarios.matchAll(patron)].map((m) => m[0]);
}

export type { Modo };
