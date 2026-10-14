/**
 * `node scripts/tienda/generar-legal.ts`: genera `packages/tienda-horno/src/legal.generado.json`
 * desde `content/tienda/legal/` (HU-T7.1). El horno corre en el Worker, que no tiene sistema de
 * archivos: importa este JSON al compilar. No se edita a mano; una prueba exige que sea el
 * generado (P2), así que cambiar una plantilla sin correr este comando pone el CI en rojo.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from '../lib/repo.ts';

export const DIR_LEGAL = join(RAIZ, 'content', 'tienda', 'legal');
export const RUTA_LEGAL_GENERADO = join(
  RAIZ,
  'packages',
  'tienda-horno',
  'src',
  'legal.generado.json',
);

interface Indice {
  version: string;
  fecha: string;
  textos: { id: string; titulo: string; ruta: string }[];
}

export function textoLegalGenerado(): string {
  const indice = JSON.parse(readFileSync(join(DIR_LEGAL, 'plantillas.json'), 'utf8')) as Indice;
  const generado = {
    nota: 'Generado por scripts/tienda/generar-legal.ts desde content/tienda/legal/. No se edita a mano.',
    version: indice.version,
    fecha: indice.fecha,
    textos: indice.textos.map((t) => ({
      ...t,
      plantilla: readFileSync(join(DIR_LEGAL, `${t.id}.md`), 'utf8').replace(/\r\n?/g, '\n'),
    })),
  };
  return `${JSON.stringify(generado, null, 2)}\n`;
}

if (process.argv[1]?.endsWith('generar-legal.ts')) {
  writeFileSync(RUTA_LEGAL_GENERADO, textoLegalGenerado());
  console.log(`Escrito ${RUTA_LEGAL_GENERADO}`);
}
