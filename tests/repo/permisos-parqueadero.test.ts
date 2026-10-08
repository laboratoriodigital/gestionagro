import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCIONES_DE_SEDE,
  type Alcance,
  ROLES,
  TABLA,
} from '../../packages/parqueadero-schema/src/permisos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

/**
 * La matriz del parqueadero tiene tres copias que no pueden decir cosas distintas (HU-Q7.8, P2):
 * el dato en `@ed1/parqueadero-schema`, la tabla de PARQUEADERO §11.2 y los roles del CORE en
 * `infrastructure/productos.json`.
 */

const productoParqueadero = () =>
  (
    JSON.parse(readFileSync(join(RAIZ, 'infrastructure/productos.json'), 'utf8')) as {
      productos: { id: string; roles: { id: string; administra: boolean }[] }[];
    }
  ).productos.find((p) => p.id === 'parqueadero');

/** Las filas de la tabla de §11.2: la primera celda y una celda por rol. */
function tablaDelDocumento(): Map<string, string[]> {
  const doc = readFileSync(join(RAIZ, 'docs/parking/ARQUITECTURA-PARQUEADERO.md'), 'utf8');
  const desde = doc.indexOf('### 11.2 Roles y permisos');
  const seccion = doc.slice(desde, doc.indexOf('\n### ', desde + 1));
  const filas = seccion
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .map((l) =>
      l
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim()),
    );
  const [cabecera, , ...cuerpo] = filas;
  expect(cabecera?.slice(1).map((c) => c.toLowerCase())).toEqual([...ROLES]);
  return new Map(cuerpo.map(([accion = '', ...celdas]) => [accion, celdas]));
}

const alcanceDeLaCelda = (celda: string): Alcance =>
  celda.startsWith('Sí') ? 'si' : celda.startsWith('Solo') ? 'suyo' : 'no';

describe('roles y permisos del parqueadero (HU-Q7.8)', () => {
  it('los roles son los del producto en el CORE, y solo el propietario maneja el equipo', () => {
    const producto = productoParqueadero();
    expect(producto?.roles.map((r) => r.id)).toEqual([...ROLES]);
    for (const r of producto?.roles ?? []) {
      expect(TABLA.equipo[r.id as (typeof ROLES)[number]] === 'si', r.id).toBe(r.administra);
    }
  });

  it('la tabla de PARQUEADERO §11.2 y el dato dicen lo mismo, fila por fila', () => {
    const doc = tablaDelDocumento();
    expect([...doc.keys()].sort()).toEqual(Object.values(ACCIONES_DE_SEDE).sort());
    for (const [accion, fila] of Object.entries(ACCIONES_DE_SEDE)) {
      const celdas = doc.get(fila) ?? [];
      ROLES.forEach((rol, i) => {
        expect(alcanceDeLaCelda(celdas[i] ?? ''), `${fila} · ${rol}`).toBe(
          TABLA[accion as keyof typeof TABLA][rol],
        );
      });
    }
  });
});
