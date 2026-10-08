/**
 * Versiones viejas que siguen sirviendo (HU-E5.5) contra la API real y el D1 local de un shard:
 * todo lo que escribe cada app publicada (`packages/agro-schema/contratos/`) entra; una app más
 * vieja que la mínima recibe el pedido de actualizar, y su lote se acepta igual (CA2).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_MINIMA } from '@ed1/agro-schema/sync';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, RAIZ, vaciar } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp, TABLAS_DEL_SHARD } from './worker.ts';

const SHARD = 'agro_c0_s1';
const ORG = '0199a1b2-0000-7000-8000-0000000000f0';
const T0 = Date.UTC(2026, 9, 1, 12);

interface Contrato {
  app: string;
  catalogos: { entidad: string; datos: { id: string; version: number } }[];
  registros: { id: string }[];
}
const DIR = join(RAIZ, 'packages', 'agro-schema', 'contratos');
const contratos = readdirSync(DIR)
  .filter((f) => /^app-\d+\.\d+\.\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as Contrato);

let db: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());
beforeEach(async () => vaciar(db, [...TABLAS_DEL_SHARD]));

const app = crearApp({ ahora: () => T0 });
async function push(ops: object[], version: string) {
  const token = (
    await firmarAcceso(
      firmante,
      { sub: 'u', org: ORG, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 },
      T0,
    )
  ).token;
  const r = await app.fetch(
    new Request('https://api.ejemplo.test/api/v1/sync/push', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ protocolo: 1, dispositivo: 'telefono-viejo', app: version, ops }),
    }),
    {
      CELDA: 'c0',
      PRODUCTO: 'agro',
      CORE_CLAVES: JSON.stringify([firmante.publica]),
      ORIGENES_APP: 'https://agro.ejemplo.test',
      [SHARD]: db,
    },
  );
  return (await r.json()) as {
    acks: { id: string; estado: string; motivo?: string }[];
    actualizar?: { minima: string };
  };
}

const operaciones = (c: Contrato) => [
  ...c.catalogos.map((x) => ({
    id: `${x.datos.id}@v${x.datos.version}`,
    entidad: x.entidad,
    entidad_id: x.datos.id,
    version: x.datos.version,
    datos: x.datos,
  })),
  ...c.registros.map((r) => ({
    id: r.id,
    entidad: 'registro',
    entidad_id: r.id,
    version: 1,
    datos: r,
  })),
];

describe.each(contratos.map((c) => [c.app, c] as const))('app %s', (version, contrato) => {
  it('CA1: todo lo que escribe entra a la API vigente', async () => {
    const r = await push(operaciones(contrato), version);
    expect(r.acks.filter((a) => a.estado !== 'aceptado')).toEqual([]);
  });
});

describe('CA2: una app más vieja que la mínima sube igual y se le pide actualizar', () => {
  const [contrato] = contratos;
  if (!contrato) throw new Error('sin contratos');

  it('con la versión mínima no se pide nada', async () => {
    expect((await push(operaciones(contrato), APP_MINIMA)).actualizar).toBeUndefined();
  });

  it.each([['0.0.9'], ['sin versión legible']])(
    'con «%s» el lote entra y la respuesta pide actualizar',
    async (version) => {
      const r = await push(operaciones(contrato), version);
      expect(r.acks.every((a) => a.estado === 'aceptado')).toBe(true);
      expect(r.actualizar).toMatchObject({ minima: APP_MINIMA });
    },
  );
});
