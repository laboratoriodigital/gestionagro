import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RUTA_ESQUEMA_EXPORT, textoEsquemaExport } from '../../scripts/generar-esquema-export.ts';

describe('schemas/agro-export.schema.json (HU-E3.13, P2)', () => {
  it('es exactamente el generado desde agro-schema: si cambia el formato, se regenera', () => {
    expect(readFileSync(RUTA_ESQUEMA_EXPORT, 'utf8').replaceAll('\r\n', '\n')).toBe(
      textoEsquemaExport(),
    );
  });
});
