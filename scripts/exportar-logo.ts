/**
 * `node scripts/exportar-logo.ts`: pasa a PNG los logos con el nombre (cultivopro.co/marca/).
 * El texto lo dibuja un navegador, así que no es determinista como `generar-iconos.ts` y no tiene
 * prueba de igualdad: se corre a mano después de cambiar la marca o el SVG del logo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { RAIZ } from './lib/repo.ts';

const CARPETA = join(RAIZ, 'apps', 'sitio', 'public', 'marca');
const LOGOS = [
  ['cultivopro-logo.svg', 'cultivopro-logo-1560.png'],
  ['cultivopro-logo-blanco.svg', 'cultivopro-logo-blanco-1560.png'],
] as const;
const [ANCHO, ALTO] = [1560, 280];

const navegador = await chromium.launch(
  process.env['PW_CANAL'] ? { channel: process.env['PW_CANAL'] } : {},
);
const pagina = await navegador.newPage();
await pagina.setViewportSize({ width: ANCHO, height: ALTO });
for (const [svg, png] of LOGOS) {
  // Solo la etiqueta raíz cambia de tamaño; lo de adentro queda igual.
  const codigo = readFileSync(join(CARPETA, svg), 'utf8').replace(/<svg [^>]*>/, (raiz) =>
    raiz
      .replace(/\s(width|height)="\d+"/g, '')
      .replace('<svg ', `<svg width="${ANCHO}" height="${ALTO}" `),
  );
  await pagina.setContent(
    `<html><body style="margin:0;background:transparent">${codigo}</body></html>`,
  );
  await pagina.locator('svg').screenshot({ path: join(CARPETA, png), omitBackground: true });
  console.log(`✅ ${png}`);
}
await navegador.close();
