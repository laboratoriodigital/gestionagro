/**
 * El tema de cada vitrina, como dato (HU-T3.2, TIENDA-3.0 §5.7 y §10.1): `tema-<huella>.css` sale
 * de la sección `apariencia` y nunca de un archivo del comercio. El contraste se **calcula** contra
 * las superficies del sistema de diseño (`@ed1/ui` v2, P2) y exige 4,5:1: un acento que no pasa se
 * rechaza diciendo por qué y cuál pasaría, nunca se ajusta en silencio. El tono para el modo oscuro
 * sí se deriva (el comercio elige uno), y se dice: el panel lo muestra antes de publicar.
 */
import { contraste, GRISES, SEMANTICOS } from '@ed1/ui/v2/tokens';

export const MINIMO = 4.5;
const CLARO = SEMANTICOS.claro.superficie;
const OSCURO = SEMANTICOS.oscuro.superficie;
const TINTAS = { negra: GRISES[1000], azul: '#0a1e32' } as const;

/** Los ocho acentos que el panel ofrece, ya validados en claro y en oscuro (WI-T3.2.1). */
export const ACENTOS_DE_LA_VITRINA = {
  tinta: '#1f1f1d',
  cobre: '#9c4a1a',
  bosque: '#1f5c3a',
  vino: '#8a1c3c',
  oceano: '#14548a',
  ciruela: '#5b2a86',
  oliva: '#5c5a17',
  arcilla: '#9a3412',
} as const;

export interface Apariencia {
  acento: string;
  tinta: 'negra' | 'azul';
  estilo: 'precision' | 'editorial';
  portada: 'editorial' | 'catalogo' | 'colecciones';
  proporcion: '4:5' | '1:1';
  modo: 'claro' | 'oscuro' | 'telefono';
}

export class AcentoIlegible extends Error {
  readonly acento: string;
  readonly razon: number;
  readonly sugerido: string;
  constructor(acento: string, razon: number, sugerido: string) {
    super(
      `El color ${acento} se lee ${razon.toFixed(1).replace('.', ',')}:1 sobre el fondo de la tienda; necesita 4,5:1. ${sugerido} se parece y sí se lee.`,
    );
    this.name = 'AcentoIlegible';
    this.acento = acento;
    this.razon = razon;
    this.sugerido = sugerido;
  }
}

const hex = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');
function mezclar(color: string, hacia: string, t: number): string {
  const c = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => hex(c(color, i) + (c(hacia, i) - c(color, i)) * t)).join('')}`;
}

/** El color más cercano que llega a 4,5:1 contra el fondo, acercándolo al contrario del fondo. */
export function acentoLegible(color: string, fondo: string): string {
  const destino = fondo === OSCURO ? '#ffffff' : '#000000';
  for (let paso = 0; paso <= 100; paso++) {
    const candidato = mezclar(color, destino, paso / 100);
    if (contraste(candidato, fondo) >= MINIMO) return candidato;
  }
  return destino;
}

/** El texto que va encima del acento: blanco o casi negro, el que se lea mejor. */
const textoSobre = (acento: string) =>
  contraste('#ffffff', acento) >= contraste(GRISES[1000], acento) ? '#ffffff' : GRISES[1000];

/**
 * Los colores del tema. Lanza `AcentoIlegible` si el acento elegido no se lee sobre el fondo claro
 * (o sobre el oscuro, si la tienda solo usa el oscuro).
 */
export function coloresDelTema(a: Apariencia): {
  claro: { acento: string; acentoTexto: string };
  oscuro: { acento: string; acentoTexto: string };
} {
  const fondoPrincipal = a.modo === 'oscuro' ? OSCURO : CLARO;
  const razon = contraste(a.acento, fondoPrincipal);
  if (razon < MINIMO) {
    throw new AcentoIlegible(a.acento, razon, acentoLegible(a.acento, fondoPrincipal));
  }
  const claro = a.modo === 'oscuro' ? acentoLegible(a.acento, CLARO) : a.acento;
  const oscuro = a.modo === 'oscuro' ? a.acento : acentoLegible(a.acento, OSCURO);
  return {
    claro: { acento: claro, acentoTexto: textoSobre(claro) },
    oscuro: { acento: oscuro, acentoTexto: textoSobre(oscuro) },
  };
}

/** El CSS del tema: solo variables, nada en línea en el HTML (la CSP lo ignoraría sin avisar). */
export function cssDelTema(a: Apariencia): string {
  const c = coloresDelTema(a);
  const variables = (m: { acento: string; acentoTexto: string }) =>
    `  --acento: ${m.acento};\n  --acento-texto: ${m.acentoTexto};\n  --foco: ${m.acento};\n`;
  const base = [
    ':root {',
    variables(a.modo === 'oscuro' ? c.oscuro : c.claro).trimEnd(),
    `  --tinta: ${TINTAS[a.tinta]};`,
    `  --proporcion-foto: ${a.proporcion === '4:5' ? '4 / 5' : '1 / 1'};`,
    '}',
  ];
  if (a.modo === 'telefono') {
    base.push(
      '@media (prefers-color-scheme: dark) {',
      '  :root {',
      variables(c.oscuro).replace(/^ {2}/gm, '    ').trimEnd(),
      '  }',
      '}',
    );
  }
  return `${base.join('\n')}\n`;
}
