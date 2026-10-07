import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

/**
 * `@ed1/impresion` y `@ed1/whatsapp` no saben qué es un parqueadero: la Tienda y el agro los usan
 * sin cambiarlos (PARQUEADERO §7.3, ADR-34, ADR-39). Si uno importara de `parqueadero-*`, el
 * primer producto que lo use cargaría con el parqueadero entero. BACKLOG_PARKING_MVP HU-Q2.2, CA3.
 */
const NEUTRALES = ['whatsapp'];

const IMPORTA = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;

function importacionesProhibidas(codigo: string): string[] {
  return [...codigo.matchAll(IMPORTA)]
    .map((m) => m[1] ?? '')
    .filter((ruta) => /parqueadero/i.test(ruta));
}

function fuentes(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f));
}

describe('los paquetes neutrales no importan nada del parqueadero', () => {
  it.each(NEUTRALES)('%s', (paquete) => {
    const hallazgos = fuentes(join(RAIZ, 'packages', paquete, 'src')).flatMap((archivo) =>
      importacionesProhibidas(readFileSync(archivo, 'utf8')).map((r) => `${archivo}: ${r}`),
    );
    expect(hallazgos).toEqual([]);
  });

  it('distingue: atrapa el import estático y el dinámico, y deja pasar los demás', () => {
    expect(importacionesProhibidas("import { x } from '@ed1/parqueadero-recibos';")).toHaveLength(
      1,
    );
    expect(
      importacionesProhibidas("const m = await import('../../parqueadero-sitio/a.ts');"),
    ).toHaveLength(1);
    expect(importacionesProhibidas("import { y } from './texto.ts'; // del parqueadero")).toEqual(
      [],
    );
  });
});
