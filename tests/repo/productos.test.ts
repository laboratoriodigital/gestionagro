import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  esContrato,
  validarArchivos,
  validarConjunto,
  validarProducto,
} from '../../scripts/lib/productos.ts';
import { listarArchivos, RAIZ } from '../../scripts/lib/repo.ts';

type Producto = Record<string, unknown>;

const base = (): Producto =>
  parse(readFileSync(join(RAIZ, 'content/agro/calculadora-dpv/product.yaml'), 'utf8'));

const mensajes = (p: Producto): string[] => validarProducto('p.yaml', p).map((e) => e.mensaje);

const sin = (campo: string): Producto => {
  const p = base();
  delete p[campo];
  return p;
};

describe('contrato product.yaml (HU-E1.3)', () => {
  it('la base de prueba es válida', () => {
    expect(mensajes(base())).toEqual([]);
  });

  // CA1: omitir un campo obligatorio falla y nombra el campo.
  it.each(['presupuesto', 'kill_switch', 'peldano', 'siguiente_paso'])(
    'sin «%s» falla y lo nombra',
    (campo) => {
      expect(mensajes(sin(campo))).toContain(`falta el campo «${campo}»`);
    },
  );

  it('kill_switch en false no vale', () => {
    expect(mensajes({ ...base(), kill_switch: false })).toContain('«kill_switch» debe ser true');
  });

  // CA2: activo exige revisión agronómica aprobada.
  it('activo con revision_agronomica pendiente falla', () => {
    expect(mensajes({ ...base(), estado: 'activo' })).toContain(
      'un producto en estado activo necesita «revision_agronomica» aprobada, no pendiente',
    );
  });

  it('activo con revisión aprobada por rol pasa', () => {
    expect(
      mensajes({
        ...base(),
        estado: 'activo',
        revision_agronomica: 'aprobada:2026-11-10:agronomo-aliado',
      }),
    ).toEqual([]);
  });

  it('borrador con revisión pendiente pasa', () => {
    expect(mensajes({ ...base(), estado: 'borrador' })).toEqual([]);
  });

  // CA4: runtime api exige presupuesto > 0 y justificación.
  it('runtime api con api_requests_dia 0 y sin justificación falla con ambos motivos', () => {
    const m = mensajes({ ...base(), runtime: 'api' });
    expect(m).toContain(
      '«presupuesto.api_requests_dia» debe ser mayor que 0 cuando runtime es api',
    );
    expect(m).toContain('falta el campo «presupuesto.justificacion»');
  });

  it('runtime api con presupuesto y justificación pasa', () => {
    const p = {
      ...base(),
      runtime: 'api',
      presupuesto: { api_requests_dia: 100, justificacion: 'Guarda eventos de negocio en D1.' },
    };
    expect(mensajes(p)).toEqual([]);
  });

  it('un campo mal escrito no se ignora', () => {
    expect(mensajes({ ...base(), kilswitch: true })).toContain(
      'el campo «kilswitch» no existe en el contrato',
    );
  });

  it('reporta todas las fallas juntas (P15)', () => {
    const p = sin('peldano');
    delete p['kill_switch'];
    expect(mensajes(p)).toEqual(
      expect.arrayContaining(['falta el campo «peldano»', 'falta el campo «kill_switch»']),
    );
  });
});

describe('reglas entre contratos', () => {
  // CA3: relacionados solo acepta ids que existen.
  it('relacionados con un id inexistente falla y lo nombra', () => {
    const errores = validarConjunto([
      { archivo: 'a.yaml', datos: { id: 'agro-a', relacionados: ['agro-b', 'agro-fantasma'] } },
      { archivo: 'b.yaml', datos: { id: 'agro-b', relacionados: [] } },
    ]);
    expect(errores).toEqual([
      {
        archivo: 'a.yaml',
        mensaje: '«relacionados» nombra «agro-fantasma», que no es un producto existente',
      },
    ]);
  });

  it('dos contratos con el mismo id fallan', () => {
    const errores = validarConjunto([
      { archivo: 'a.yaml', datos: { id: 'agro-a' } },
      { archivo: 'b.yaml', datos: { id: 'agro-a' } },
    ]);
    expect(errores).toEqual([{ archivo: 'b.yaml', mensaje: 'el id «agro-a» ya lo usa a.yaml' }]);
  });

  it('un YAML ilegible se reporta, no se salta', () => {
    const dir = mkdtempSync(join(tmpdir(), 'productos-'));
    writeFileSync(join(dir, 'product.yaml'), 'id: [sin cerrar\n');
    const errores = validarArchivos(['product.yaml'], dir);
    expect(errores[0]?.mensaje).toMatch(/^YAML ilegible/);
  });
});

describe('los contratos del repositorio', () => {
  const archivos = listarArchivos(esContrato);

  it('existen los de la DPV y el cuaderno', () => {
    expect(archivos).toEqual(
      expect.arrayContaining([
        'content/agro/calculadora-dpv/product.yaml',
        'content/agro/cuaderno/product.yaml',
      ]),
    );
  });

  it('son todos válidos', () => {
    expect(validarArchivos(archivos)).toEqual([]);
  });
});
