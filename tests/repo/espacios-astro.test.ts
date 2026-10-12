/**
 * Astro, al comprimir el HTML, se come el salto de línea entre un texto y una etiqueta en línea
 * que empieza en el renglón siguiente: la guía decía «si produceecológico» y «o«Instalar»» en
 * producción (bitácora core 9). Esta prueba lee las plantillas y exige un `{' '}` explícito, o la
 * etiqueta en el mismo renglón.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

const EN_LINEA = /^\s*<(strong|a|em|b|i|code|abbr|time|span)[\s>]/;
const TERMINA_EN_PALABRA = /[\p{L}\p{N},;:»)]$/u;

/** Los renglones donde el espacio se perdería: «archivo:n». */
function espaciosQueSePierden(texto: string, archivo = ''): string[] {
  const lineas = texto.split(/\r?\n/);
  const fallas: string[] = [];
  for (let i = 1; i < lineas.length; i++) {
    const antes = lineas[i - 1] ?? '';
    if (TERMINA_EN_PALABRA.test(antes.trimEnd()) && EN_LINEA.test(lineas[i] ?? ''))
      fallas.push(`${archivo}:${i}`);
  }
  return fallas;
}

const plantillas = (carpeta: string): string[] =>
  readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (nombre === 'node_modules' || nombre === 'dist') return [];
    if (statSync(ruta).isDirectory()) return plantillas(ruta);
    return nombre.endsWith('.astro') ? [ruta] : [];
  });

describe('el espacio antes de una palabra en negrita o un enlace no se pierde', () => {
  it('ninguna plantilla de Astro pierde un espacio', () => {
    const fallas = plantillas(join(RAIZ, 'apps')).flatMap((ruta) => {
      const texto = readFileSync(ruta, 'utf8');
      // La plantilla, sin el bloque de código de arriba.
      const fin = texto.indexOf('---', texto.indexOf('---') + 3);
      return espaciosQueSePierden(texto.slice(fin + 3), relative(RAIZ, ruta).replace(/\\/g, '/'));
    });
    expect(fallas).toEqual([]);
  });

  it('la regla ve el defecto (control negativo)', () => {
    expect(espaciosQueSePierden('si produce\n  <strong>ecológico</strong>')).toEqual([':1']);
    expect(espaciosQueSePierden("si produce{' '}\n  <strong>ecológico</strong>")).toEqual([]);
  });
});
