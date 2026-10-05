/**
 * `node scripts/recortar-fuentes.ts`: recorta Geist y Geist Mono (OFL 1.1) para el sistema de
 * diseño v2 (HU-C6.2, ADR-29) y las deja en `packages/ui/src/v2/fuentes/`, con su licencia.
 *
 * - Solo los caracteres del español y del latín que se usan en un texto público: ASCII imprimible,
 *   Latin-1 (tildes, ñ, ü, ¿, ¡, «, »), comillas tipográficas, rayas, puntos suspensivos, €, ·, ×
 *   y el signo menos. Lo demás no se descarga nunca.
 * - El eje de peso se limita a 300–600, lo que usa el diseño (tokens.ts › TIPO).
 *
 * Los archivos recortados van al repositorio: el build no recorta nada, y nadie descarga una fuente
 * de un tercero (CSP `'self'`). Se corre solo para cambiar la versión de Geist o los caracteres.
 * `tests/repo/ui-fuentes.test.ts` vigila el peso y la licencia.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { RAIZ } from './lib/repo.ts';

const requerir = createRequire(join(RAIZ, 'packages', 'ui', 'package.json'));
const subsetFont = requerir('subset-font') as (
  fuente: Buffer,
  texto: string,
  opciones: { targetFormat: 'woff2'; variationAxes?: Record<string, { min: number; max: number }> },
) => Promise<Buffer>;

/** Los caracteres que se conservan. Cambiar esto cambia el peso: la prueba lo mide. */
export function caracteres(): string {
  const rango = (desde: number, hasta: number) =>
    Array.from({ length: hasta - desde + 1 }, (_, i) => String.fromCodePoint(desde + i)).join('');
  return `${rango(0x20, 0x7e)}${rango(0xa0, 0xff)}‘’“”‚„–—…•·€−×÷→←`;
}

// `geist` no exporta su package.json: se ubica por la carpeta de dependencias de @ed1/ui.
const GEIST = join(RAIZ, 'packages', 'ui', 'node_modules', 'geist');
const DESTINO = join(RAIZ, 'packages', 'ui', 'src', 'v2', 'fuentes');

/**
 * Métricas para ajustar la fuente de respaldo (unidades por em, ascendente, descendente,
 * interlínea y ancho promedio de las minúsculas ponderado por su frecuencia en un texto).
 * Fuente: @capsizecss/metrics 4.3.0 (MIT), las mismas que usa next/font, copiadas aquí para no
 * instalar 27 MB en cada corrida del CI por cuatro filas (bitácora core 5). El campo
 * `xAvgCharWidth` del propio TTF no sirve: en una fuente variable promedia todos los glifos, y daba
 * un ajuste de 131 % que movía la página en vez de evitarlo.
 */
export const METRICAS = {
  geist: { em: 1000, ascendente: 1005, descendente: -295, interlinea: 0, ancho: 467 },
  geistMono: { em: 1000, ascendente: 1005, descendente: -295, interlinea: 0, ancho: 600 },
  arial: { em: 2048, ascendente: 1854, descendente: -434, interlinea: 67, ancho: 913 },
  courierNew: { em: 2048, ascendente: 1705, descendente: -615, interlinea: 0, ancho: 1229 },
} as const;

interface Metricas {
  em: number;
  ascendente: number;
  descendente: number;
  interlinea: number;
  ancho: number;
}

/** Cada fuente con la del sistema que la reemplaza mientras carga. */
export const FUENTES = [
  {
    familia: 'Geist',
    origen: 'dist/fonts/geist-sans/Geist-Variable.woff2',
    destino: 'geist.woff2',
    m: METRICAS.geist,
    respaldo: { local: 'Arial', m: METRICAS.arial },
  },
  {
    familia: 'Geist Mono',
    origen: 'dist/fonts/geist-mono/GeistMono-Variable.woff2',
    destino: 'geist-mono.woff2',
    m: METRICAS.geistMono,
    respaldo: { local: 'Courier New', m: METRICAS.courierNew },
  },
] as const;

const porcentaje = (x: number) => `${(x * 100).toFixed(2)}%`;

/** Cuánto hay que escalar la fuente de respaldo para que ocupe lo mismo que la propia. */
export const ajusteDeTamano = (propia: Metricas, respaldo: Metricas): number =>
  propia.ancho / propia.em / (respaldo.ancho / respaldo.em);

/**
 * La hoja `@font-face`: la fuente propia con `font-display: swap`, y una de respaldo local con las
 * métricas ajustadas a ella, para que el cambio de fuente no mueva la página (CLS ≈ 0).
 */
export function hojaDeFuentes(): string {
  const bloques = FUENTES.map(({ familia, destino, m, respaldo }) => {
    const ajuste = ajusteDeTamano(m, respaldo.m);
    return [
      `@font-face {\n  font-family: '${familia}';\n  src: url('./fuentes/${destino}') format('woff2');\n  font-weight: 300 600;\n  font-style: normal;\n  font-display: swap;\n}`,
      `@font-face {\n  font-family: '${familia} Respaldo';\n  src: local('${respaldo.local}');\n  size-adjust: ${porcentaje(ajuste)};\n  ascent-override: ${porcentaje(m.ascendente / m.em / ajuste)};\n  descent-override: ${porcentaje(Math.abs(m.descendente) / m.em / ajuste)};\n  line-gap-override: ${porcentaje(m.interlinea / m.em / ajuste)};\n}`,
    ].join('\n\n');
  });
  return `/*\n * GENERADO por scripts/recortar-fuentes.ts. Geist y Geist Mono (SIL OFL 1.1, ver fuentes/OFL.txt),\n * recortadas al latín y autoalojadas (ADR-29, HU-C6.2). Ninguna fuente se pide a un tercero.\n */\n\n${bloques.join('\n\n')}\n`;
}

if (process.argv[1]?.endsWith('recortar-fuentes.ts')) {
  mkdirSync(DESTINO, { recursive: true });
  for (const f of FUENTES) {
    const original = readFileSync(join(GEIST, f.origen));
    const recortada = await subsetFont(original, caracteres(), {
      targetFormat: 'woff2',
      variationAxes: { wght: { min: 300, max: 600 } },
    });
    writeFileSync(join(DESTINO, f.destino), recortada);
    console.log(`✅ ${f.destino}: ${original.length} → ${recortada.length} bytes`);
  }
  copyFileSync(join(GEIST, 'LICENSE.txt'), join(DESTINO, 'OFL.txt'));
  console.log('✅ OFL.txt (licencia SIL Open Font License 1.1 de Geist)');
  writeFileSync(join(DESTINO, '..', 'fuentes.css'), hojaDeFuentes());
  console.log('✅ fuentes.css');
}
