/**
 * HU-T17.4: `scripts/tienda/restaurar.ts` arma, desde el respaldo, el SQL para `wrangler d1
 * execute` y la consulta que cuenta después. Lo restaurado de verdad, contra el D1 local, lo prueba
 * `apps/tienda-api/src/respaldos.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { TABLAS_DEL_RESPALDO } from '../../apps/tienda-api/src/respaldos.ts';
import { prepararRestauracion, sqlParaContar } from '../../scripts/tienda/restaurar.ts';

const ORG = '0199e0a0-0000-7000-8000-0000000000c1';
const respaldo = {
  formato: 'tienda-respaldo/2',
  org: ORG,
  hecho: '2026-10-19T08:00:00.000Z',
  tienda: {},
  filas: Object.fromEntries(TABLAS_DEL_RESPALDO.map(([t]) => [t, []])) as Record<
    string,
    Record<string, unknown>[]
  >,
  recuentos: {},
};

describe('scripts/tienda/restaurar.ts (HU-T17.4)', () => {
  it('escribe el SQL y la consulta para contar, y dice cuántas filas trae cada tabla', () => {
    const escritos = new Map<string, string>();
    const r = structuredClone(respaldo);
    r.filas['pedido'] = [{ org_id: ORG, id: 'p1', codigo: "O'N1" }];
    const dicho = prepararRestauracion(r, 'fuera/ensayo.sql', (ruta, texto) =>
      escritos.set(ruta, texto),
    );
    expect([...escritos.keys()]).toEqual(['fuera/ensayo.sql', 'fuera/ensayo.contar.sql']);
    expect(escritos.get('fuera/ensayo.sql')).toContain(
      `INSERT INTO pedido (org_id, id, codigo) VALUES ('${ORG}', 'p1', 'O''N1') ON CONFLICT DO NOTHING;`,
    );
    expect(dicho).toContain('  pedido: 1 filas');
    expect(escritos.get('fuera/ensayo.contar.sql')).toBe(sqlParaContar(ORG));
  });

  it('❌ un respaldo de la versión 1 no se prepara', () => {
    expect(() =>
      prepararRestauracion({ ...respaldo, formato: 'tienda-respaldo/1' }, 'x.sql', () => undefined),
    ).toThrow(/versión 1/);
  });

  it('❌ una columna que no es un nombre no llega al SQL', () => {
    const r = structuredClone(respaldo);
    r.filas['pedido'] = [{ org_id: ORG, 'id) VALUES (1); DROP TABLE pedido; --': 'x' }];
    expect(() => prepararRestauracion(r, 'x.sql', () => undefined)).toThrow(/columna que no es/);
  });
});
