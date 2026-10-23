/**
 * Firma del QR de trazabilidad en la celda (HU-E6.4) contra el D1 local de un shard, con las
 * muestras del contrato de la app 0.2.0 (finca, área, cosecha y lote).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, RAIZ, vaciar } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { CAMPOS, type ClavePublicaQr, leerQr } from '@ed1/trazabilidad';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp, type Env, TABLAS_DEL_SHARD } from './worker.ts';

const SHARD = 'agro_c0_s1';
const ORG = '0199a1b2-0000-7000-8000-0000000000f6';
const T0 = Date.UTC(2026, 9, 1, 12);

const contrato = JSON.parse(
  readFileSync(join(RAIZ, 'packages', 'agro-schema', 'contratos', 'app-0.2.0.json'), 'utf8'),
) as {
  catalogos: { entidad: string; datos: { id: string; version: number } }[];
  registros: ({ id: string; tipo: string } & Record<string, unknown>)[];
};
const lote = contrato.registros.find((r) => r.tipo === 'lote_venta');
if (!lote) throw new Error('el contrato 0.2.0 no trae lote');

let db: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;
let claveQr: string;
beforeAll(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  }));
  firmante = await firmanteDesde(await generarClavePrivada());
  claveQr = await generarClavePrivada();
}, 60_000);
afterAll(async () => cerrar?.());

const app = crearApp({ ahora: () => T0 });
const env = (extra: Partial<Env> = {}): Env => ({
  CELDA: 'c0',
  PRODUCTO: 'agro',
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  ORIGENES_APP: 'https://agro.ejemplo.test',
  CELDA_QR_PRIVATE_KEY: claveQr,
  [SHARD]: db,
  ...extra,
});
async function pedir(ruta: string, cuerpo?: object, rol = 'propietario', e: Env = env()) {
  const token = (
    await firmarAcceso(
      firmante,
      { sub: 'u', org: ORG, rol, celda: 'c0', shard: SHARD, anillo: 1, aud: 'agro' },
      T0,
    )
  ).token;
  const r = await app.fetch(
    new Request(`https://api.ejemplo.test${ruta}`, {
      method: cuerpo ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
    }),
    e,
  );
  return { estado: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
}

const ed25519 = async (
  publica: Uint8Array<ArrayBuffer>,
  mensaje: Uint8Array<ArrayBuffer>,
  firma: Uint8Array<ArrayBuffer>,
) =>
  crypto.subtle.verify(
    { name: 'Ed25519' },
    await crypto.subtle.importKey('raw', publica, { name: 'Ed25519' }, false, ['verify']),
    firma,
    mensaje,
  );

beforeEach(async () => {
  await vaciar(db, [...TABLAS_DEL_SHARD]);
  const ops = [
    ...contrato.catalogos.map((m) => ({
      id: `${m.datos.id}@v${m.datos.version}`,
      entidad: m.entidad,
      entidad_id: m.datos.id,
      version: m.datos.version,
      datos: m.datos,
    })),
    ...contrato.registros
      .filter((x) => x.tipo !== 'despacho')
      .map((x) => ({ id: x.id, entidad: 'registro', entidad_id: x.id, version: 1, datos: x })),
  ];
  const r = await pedir('/api/v1/sync/push', { protocolo: 1, dispositivo: 't', app: '0.2.0', ops });
  expect((r.cuerpo['acks'] as { estado: string }[]).every((a) => a.estado === 'aceptado')).toBe(
    true,
  );
});

describe('HU-E6.4 · la celda firma lo que tiene guardado', () => {
  it('CA1 y CA2: firma el lote; la página lo verifica con la clave pública de la celda', async () => {
    const r = await pedir('/api/v1/lotes/firmar', { lote_id: lote.id });
    expect(r.estado).toBe(200);
    const claves = (await pedir('/api/claves-qr')).cuerpo['claves'] as ClavePublicaQr[];
    const v = await leerQr(String(r.cuerpo['fragmento']), claves, ed25519);
    expect(v.estado).toBe('verificado');
    expect(v.estado === 'verificado' && v.datos).toMatchObject({
      l: 'C-01OCT-1',
      f: 'Finca Ensayo Uno',
      m: 'Municipio Ensayo',
      r: 'ecologico',
      a: ['Nave 1'],
      d: ['2026-10-01', '2026-10-01'],
    });
  });

  it('CA3: el QR no lleva datos personales ni ids', async () => {
    const r = await pedir('/api/v1/lotes/firmar', { lote_id: lote.id });
    const datos = r.cuerpo['datos'] as Record<string, unknown>;
    expect(Object.keys(datos).every((k) => (CAMPOS as readonly string[]).includes(k))).toBe(true);
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/0199a1b2|telefono-muestra|@/);
  });

  it('un lote que no está en la nube, uno corregido, o un rol que no arma lotes: no se firma', async () => {
    expect(
      (await pedir('/api/v1/lotes/firmar', { lote_id: '0199a1b2-0000-7000-8000-00000000ffff' }))
        .estado,
    ).toBe(404);
    expect((await pedir('/api/v1/lotes/firmar', { lote_id: lote.id }, 'asesor')).estado).toBe(403);
    const correccion = { ...lote, id: '0199a1b2-0000-7000-8000-000000000030', anula_id: lote.id };
    await pedir('/api/v1/sync/push', {
      protocolo: 1,
      dispositivo: 't',
      app: '0.2.0',
      ops: [
        {
          id: correccion.id,
          entidad: 'registro',
          entidad_id: correccion.id,
          version: 1,
          datos: correccion,
        },
      ],
    });
    expect((await pedir('/api/v1/lotes/firmar', { lote_id: lote.id })).estado).toBe(409);
  });

  it('sin clave de firma la celda no inventa una: 503 y lo dice', async () => {
    const { CELDA_QR_PRIVATE_KEY: _sin, ...sinClave } = env();
    expect((await pedir('/api/claves-qr', undefined, 'propietario', sinClave)).estado).toBe(503);
    expect(
      (await pedir('/api/v1/lotes/firmar', { lote_id: lote.id }, 'propietario', sinClave)).estado,
    ).toBe(503);
  });
});
