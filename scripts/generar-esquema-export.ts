/**
 * `node scripts/generar-esquema-export.ts`: genera `schemas/agro-export.schema.json` desde el
 * esquema zod de `packages/agro-schema/src/exportacion.ts` (HU-E3.13, CA1). El archivo no se
 * edita a mano; una prueba exige que sea el generado (P2). Lo usan quienes lean el archivo fuera
 * de la app: el respaldo y la mudanza del servidor (E5), o una persona con otra herramienta.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esquemaJsonExport } from '../packages/agro-schema/src/exportacion.ts';
import { RAIZ } from './lib/repo.ts';

export const RUTA_ESQUEMA_EXPORT = join(RAIZ, 'schemas', 'agro-export.schema.json');

export function textoEsquemaExport(): string {
  const esquema = {
    $id: 'https://agro.laboratorio-digital.com/schemas/agro-export.schema.json',
    title: 'agro-export v1: todo el cuaderno de un teléfono (HU-E3.13)',
    // Las reglas entre campos (p. ej. drenado ≤ aplicado) y los datos de cada tipo de registro las
    // valida la app con agro-schema; JSON Schema describe la forma.
    ...esquemaJsonExport(),
  };
  return `${JSON.stringify(esquema, null, 2)}\n`;
}

if (process.argv[1]?.endsWith('generar-esquema-export.ts')) {
  writeFileSync(RUTA_ESQUEMA_EXPORT, textoEsquemaExport());
}
