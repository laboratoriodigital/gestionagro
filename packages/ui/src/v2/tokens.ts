/**
 * Tokens de diseño v2 del ecosistema (ADR-29, BACKLOG_CORE §4.3, HU-C6.1).
 *
 * Única fuente (P2): `scripts/generar-ui.ts` escribe los `.css` de esta carpeta desde aquí, y la
 * prueba de contraste lee estos mismos valores. Ningún `.css` de tokens se edita a mano.
 *
 * Tres capas:
 * - **primitivos:** la escala cruda (grises, acentos, tipo, espacio, radios, tiempos). Nadie los usa
 *   directo en un componente.
 * - **semánticos:** lo que significa cada color (superficie, texto, acento, foco…), en claro y en
 *   oscuro. El tema por defecto es el del ecosistema: tinta y papel, con un acento.
 * - **temas por producto:** cada producto cambia solo su acento (`data-producto` en `<html>`).
 *
 * El lenguaje es «editorial técnico» (BACKLOG_CORE §4.2): sans para lo humano, mono para lo exacto.
 * La v1 (`../tokens.css`) queda intacta para el sitio y el cuaderno de CultivoPro (P10).
 */

/** Escala de grises neutros, de papel (0) a tinta (1000). */
export const GRISES = {
  0: '#ffffff',
  50: '#f6f6f5',
  100: '#ececea',
  200: '#d9d9d6',
  300: '#bdbdb9',
  400: '#9a9a96',
  500: '#76766f',
  600: '#5a5a54',
  700: '#41413c',
  800: '#2a2a26',
  900: '#171715',
  1000: '#0b0b0a',
} as const;

/** Acentos: cada uno con su tono para fondo claro y para fondo oscuro. */
export const ACENTOS = {
  /** El del ecosistema: azul cobalto, la «señal» del laboratorio. */
  cobalto: { claro: '#2340d0', oscuro: '#94a9ff' },
  /** El de CultivoPro: el verde de su marca (el de la v1). */
  verde: { claro: '#1f6b3a', oscuro: '#6cc28a' },
  rojo: { claro: '#b3261e', oscuro: '#ff9a8f' },
  ambar: { claro: '#8a5300', oscuro: '#f0b45a' },
  exito: { claro: '#1d6b3f', oscuro: '#7fd4a0' },
  /** El de la Tienda (HU-T3.2): el cobre de la galería, para el panel. */
  cobre: { claro: '#9c4a1a', oscuro: '#f0a878' },
} as const;

/**
 * El boletín del día: la consola del dueño (EC13, contrato de dirección del 23 oct 2026). Papel
 * blanco, tinta azul institucional y un color por desempeño. Siempre claro: se mira de mañana, con
 * luz natural. Cada tono pasa 4,5:1 sobre su propio tinte (lo calcula `boletin-contraste.test.ts`).
 */
export const BOLETIN = {
  'boletin-tinta': '#1d3a8a',
  'boletin-tinta-palido': '#dbe3f5',
  'boletin-regla': '#c9d3ea',
  'boletin-superior': '#166534',
  'boletin-alto': '#1d3a8a',
  'boletin-basico': '#94490a',
  'boletin-bajo': '#b91c1c',
  'boletin-atencion-fondo': '#fdf0e1',
  'boletin-atencion-texto': '#7a3d06',
} as const;

/** El tinte de la fila de cada desempeño: cuánto de su tono va sobre el papel. */
export const TINTE_DEL_BOLETIN = 0.1;

export type Modo = 'claro' | 'oscuro';

/** Lo que significa cada color. Los componentes solo usan estos nombres. */
export interface Semanticos {
  superficie: string;
  'superficie-2': string;
  texto: string;
  'texto-suave': string;
  borde: string;
  acento: string;
  /** El texto que va encima de un fondo de acento (botón primario). */
  'acento-texto': string;
  foco: string;
  peligro: string;
  exito: string;
  aviso: string;
}

export const SEMANTICOS: Record<Modo, Semanticos> = {
  claro: {
    superficie: GRISES[0],
    'superficie-2': GRISES[50],
    texto: GRISES[1000],
    'texto-suave': GRISES[600],
    borde: GRISES[200],
    acento: ACENTOS.cobalto.claro,
    'acento-texto': GRISES[0],
    foco: ACENTOS.cobalto.claro,
    peligro: ACENTOS.rojo.claro,
    exito: ACENTOS.exito.claro,
    aviso: ACENTOS.ambar.claro,
  },
  oscuro: {
    superficie: GRISES[1000],
    'superficie-2': GRISES[900],
    texto: GRISES[50],
    'texto-suave': GRISES[300],
    borde: GRISES[800],
    acento: ACENTOS.cobalto.oscuro,
    'acento-texto': GRISES[1000],
    foco: ACENTOS.cobalto.oscuro,
    peligro: ACENTOS.rojo.oscuro,
    exito: ACENTOS.exito.oscuro,
    aviso: ACENTOS.ambar.oscuro,
  },
};

/** Lo que cambia cada producto: solo su acento, en los dos modos. */
export const TEMAS: Record<string, Record<Modo, Partial<Semanticos>>> = {
  cultivopro: {
    claro: { acento: ACENTOS.verde.claro, foco: ACENTOS.verde.claro },
    oscuro: { acento: ACENTOS.verde.oscuro, foco: ACENTOS.verde.oscuro },
  },
  // HU-T3.2: el panel de la Tienda. La vitrina no usa este tema: lleva el color de cada comercio.
  tienda: {
    claro: { acento: ACENTOS.cobre.claro, foco: ACENTOS.cobre.claro },
    oscuro: { acento: ACENTOS.cobre.oscuro, foco: ACENTOS.cobre.oscuro },
  },
};

/** Tipo: base de 17 px y escala 1,25; la display crece con la pantalla. */
export const TIPO = {
  'fuente-sans':
    "'Geist', 'Geist Respaldo', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  'fuente-mono':
    "'Geist Mono', 'Geist Mono Respaldo', ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Consolas, 'Liberation Mono', monospace",
  'texto-base': '1.0625rem',
  'texto-pequeno': '0.875rem',
  'texto-etiqueta': '0.75rem',
  'texto-titulo-3': '1.33rem',
  'texto-titulo-2': 'clamp(1.66rem, 3.2vw, 2.08rem)',
  'texto-titulo-1': 'clamp(2.08rem, 5vw, 3.25rem)',
  'texto-display': 'clamp(2.5rem, 8vw, 6rem)',
  'peso-display': '350',
  'peso-texto': '400',
  'peso-fuerte': '600',
  'interletrado-display': '-0.03em',
  'interletrado-etiqueta': '0.08em',
  interlineado: '1.55',
  'interlineado-display': '1.02',
} as const;

/** Espacio en múltiplos de 4 px. */
export const ESPACIO = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
  12: '3rem',
  16: '4rem',
  24: '6rem',
  40: '10rem',
} as const;

export const FORMA = {
  'radio-campo': '12px',
  'radio-tarjeta': '24px',
  'radio-pildora': '999px',
  'borde-ancho': '1px',
  'objetivo-tactil': '48px',
  'ancho-lectura': '42rem',
  'ancho-pagina': '80rem',
} as const;

/** Movimiento. Con `prefers-reduced-motion`, todo pasa a cero. */
export const MOVIMIENTO = {
  'tiempo-corto': '150ms',
  'tiempo-medio': '250ms',
  'tiempo-largo': '400ms',
  'curva-salida': 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

// --- Contraste (WCAG 2.x), para la prueba y para quien elija un color nuevo. ---

function canal(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Luminancia relativa de un color `#rrggbb`. */
export function luminancia(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`«${hex}» no es un color #rrggbb`);
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x as string, 16));
  return 0.2126 * canal(r as number) + 0.7152 * canal(g as number) + 0.0722 * canal(b as number);
}

/** Razón de contraste entre dos colores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Las parejas que se leen como texto, con el mínimo AA de cada una (BACKLOG_CORE §4.3).
 * El borde no es texto: con 3:1 basta para un componente (WCAG 1.4.11) y solo se pide en los
 * campos, que llevan además su etiqueta.
 */
export const PAREJAS: ReadonlyArray<{
  texto: keyof Semanticos;
  fondo: keyof Semanticos;
  minimo: number;
}> = [
  { texto: 'texto', fondo: 'superficie', minimo: 4.5 },
  { texto: 'texto', fondo: 'superficie-2', minimo: 4.5 },
  { texto: 'texto-suave', fondo: 'superficie', minimo: 4.5 },
  { texto: 'texto-suave', fondo: 'superficie-2', minimo: 4.5 },
  { texto: 'acento', fondo: 'superficie', minimo: 4.5 },
  { texto: 'acento', fondo: 'superficie-2', minimo: 4.5 },
  { texto: 'acento-texto', fondo: 'acento', minimo: 4.5 },
  { texto: 'peligro', fondo: 'superficie', minimo: 4.5 },
  { texto: 'exito', fondo: 'superficie', minimo: 4.5 },
  { texto: 'aviso', fondo: 'superficie', minimo: 4.5 },
  { texto: 'foco', fondo: 'superficie', minimo: 3 },
];

/** Los semánticos de un tema en un modo: los del ecosistema con lo que el producto cambia. */
export function semanticosDe(tema: string | null, modo: Modo): Semanticos {
  const base = SEMANTICOS[modo];
  if (tema === null) return base;
  const cambios = TEMAS[tema];
  if (!cambios) throw new Error(`no hay tema «${tema}»`);
  return { ...base, ...cambios[modo] };
}
