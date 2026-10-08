import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

/**
 * `@ed1/impresion` y `@ed1/whatsapp` no saben qué es un parqueadero: la Tienda y el agro los usan
 * sin cambiarlos (PARQUEADERO §7.3, ADR-34, ADR-39). Si uno importara de `parqueadero-*`, el
 * primer producto que lo use cargaría con el parqueadero entero. BACKLOG_PARKING_MVP HU-Q2.2, CA3.
 */
const NEUTRALES = ['impresion', 'whatsapp'];

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

/**
 * `@ed1/sync` es el protocolo del cuaderno y de la caja (ADR-39): no sabe de ningún producto.
 * Las entidades del agro viven en `@ed1/agro-schema/sync` y las del parqueadero en
 * `@ed1/parqueadero-schema/sync`. Si el protocolo importara de un producto, un arreglo para uno
 * arrastraría al otro. BACKLOG-PARKING HU-Q7.3, CA3.
 */
const PRODUCTO = /agro|parqueadero|tienda|cuaderno|api-celda/i;

function importacionesDeProducto(codigo: string): string[] {
  return [...codigo.matchAll(IMPORTA)].map((m) => m[1] ?? '').filter((r) => PRODUCTO.test(r));
}

describe('@ed1/sync no importa nada de un producto', () => {
  it('ni en su código ni en sus pruebas', () => {
    const hallazgos = fuentes(join(RAIZ, 'packages', 'sync', 'src')).flatMap((archivo) =>
      importacionesDeProducto(readFileSync(archivo, 'utf8')).map((r) => `${archivo}: ${r}`),
    );
    expect(hallazgos).toEqual([]);
  });

  it('ni en sus dependencias', () => {
    const pkg = JSON.parse(readFileSync(join(RAIZ, 'packages', 'sync', 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => PRODUCTO.test(d))).toEqual([]);
  });

  it('distingue: atrapa el esquema del agro por nombre o por ruta, y deja pasar lo común', () => {
    expect(importacionesDeProducto("import { validarRegistro } from '@ed1/agro-schema';")).toEqual([
      '@ed1/agro-schema',
    ]);
    expect(
      importacionesDeProducto("import { x } from '../../agro-schema/src/registro.ts';"),
    ).toHaveLength(1);
    expect(
      importacionesDeProducto("import { tarifa } from '@ed1/parqueadero-schema';"),
    ).toHaveLength(1);
    expect(
      importacionesDeProducto("import { z } from 'zod'; import { a } from './permisos.ts';"),
    ).toEqual([]);
  });
});
