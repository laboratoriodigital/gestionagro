/**
 * Contrato de versiones (HU-E5.5, CA3, ADR-13, P10): la API no puede dejar de aceptar lo que una
 * app publicada escribe. Las muestras viven en `packages/agro-schema/contratos/app-<versión>.json`
 * y no se editan ni se borran.
 *
 * - Toda versión de registro que exista en el código tiene muestra: agregar una versión obliga a
 *   escribir su muestra en el archivo de la app que la publica.
 * - Todo catálogo tiene muestra.
 * - Toda muestra de toda app publicada valida por el mismo camino que usa la celda al recibir un
 *   push (`validarOperacion`). Quitar una versión vieja del código la pone en rojo.
 * - La prueba de punta a punta con la API real está en apps/api-celda/src/contrato.test.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESQUEMAS_DE_DATOS } from '@ed1/agro-schema';
import { ENTIDADES_DE_CATALOGO, validarOperacion } from '@ed1/sync';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';

interface Contrato {
  app: string;
  catalogos: { entidad: string; datos: { id: string; version: number } }[];
  registros: { id: string; tipo: string; v: number }[];
}

const DIR = join(RAIZ, 'packages', 'agro-schema', 'contratos');
const contratos: Contrato[] = readdirSync(DIR)
  .filter((f) => /^app-\d+\.\d+\.\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Contrato);

describe('contrato de versiones (CA3)', () => {
  it('existe el contrato de la versión publicada 0.1.0', () => {
    expect(contratos.map((c) => c.app)).toContain('0.1.0');
  });

  it('cada versión de registro del código tiene su muestra', () => {
    const conMuestra = new Set(
      contratos.flatMap((c) => c.registros.map((r) => `${r.tipo} v${r.v}`)),
    );
    const enCodigo = Object.entries(ESQUEMAS_DE_DATOS).flatMap(([tipo, versiones]) =>
      Object.keys(versiones).map((v) => `${tipo} v${v}`),
    );
    expect(enCodigo.filter((x) => !conMuestra.has(x))).toEqual([]);
  });

  it('cada catálogo tiene su muestra', () => {
    const conMuestra = new Set(contratos.flatMap((c) => c.catalogos.map((x) => x.entidad)));
    expect(ENTIDADES_DE_CATALOGO.filter((e) => !conMuestra.has(e))).toEqual([]);
  });

  it.each(
    contratos.flatMap((c) => c.registros.map((r) => [c.app, `${r.tipo} v${r.v}`, r] as const)),
  )('app %s: %s sigue entrando por el push', (_app, _nombre, r) => {
    const v = validarOperacion({
      id: r.id,
      entidad: 'registro',
      entidad_id: r.id,
      version: 1,
      datos: r,
    });
    expect(v.ok ? 'ok' : v.motivo).toBe('ok');
  });

  it.each(contratos.flatMap((c) => c.catalogos.map((x) => [c.app, x.entidad, x] as const)))(
    'app %s: %s sigue entrando por el push',
    (_app, entidad, x) => {
      const v = validarOperacion({
        id: `${x.datos.id}@v${x.datos.version}`,
        entidad,
        entidad_id: x.datos.id,
        version: x.datos.version,
        datos: x.datos,
      });
      expect(v.ok ? 'ok' : v.motivo).toBe('ok');
    },
  );
});
