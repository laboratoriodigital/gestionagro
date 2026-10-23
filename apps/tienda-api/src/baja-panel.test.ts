/**
 * HU-T18.13: una tienda dada de baja ya no cambia. Por la API del panel, con un token del CORE
 * firmado de verdad, contra el shard local con el comercio de prueba Dos: después de la baja se lee,
 * se descarga y se atienden los derechos de sus compradores, pero nada más se escribe.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DIAS_PARA_BORRAR } from './baja.ts';
import { CABECERA_DESPACHO, crearApp, type Env, TIENDA_DADA_DE_BAJA } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-la-baja';
const T0 = Date.UTC(2026, 9, 23, 15);
const PERSONA = '0199e0a0-0000-7000-8000-0000000000e2';
const DOS = ENSAYO_DOS.org;

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  const c = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  shard = s.db;
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
  const ahora = new Date(T0).toISOString();
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], ahora))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', ahora))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
  // La tienda Dos, dada de baja en este instante.
  await shard
    .prepare("UPDATE tienda SET estado = 'baja', baja_pedida = ? WHERE org_id = ?")
    .bind(ahora, DOS)
    .run();
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
  tienda_control: control,
});

const pedir = async (ruta: string, cuerpo?: unknown) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: PERSONA,
      org: DOS,
      rol: 'propietario',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'pro',
      auth_time: Math.floor(T0 / 1000),
    },
    T0,
    2,
  );
  const r = await crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

describe('una tienda dada de baja (HU-T18.13)', () => {
  it('el panel sabe que está dada de baja y hasta cuándo se descarga', async () => {
    const yo = await pedir('yo');
    expect(yo.status).toBe(200);
    expect(yo.cuerpo['tienda']).toMatchObject({
      estado: 'baja',
      descargarHasta: new Date(T0 + DIAS_PARA_BORRAR * 86_400_000).toISOString(),
    });
  });

  it('se puede leer y descargar todo', async () => {
    expect((await pedir('productos')).status).toBe(200);
    expect((await pedir('exportar')).status).toBe(200);
  });

  it('❌ nada se cambia ni se publica, aunque se pida por fuera del panel', async () => {
    for (const [ruta, cuerpo] of [
      ['productos/guardar', { op: 'op-baja-0000000001', nombre: 'Nuevo' }],
      ['publicar', { op: 'op-baja-0000000002' }],
      ['ajustes/guardar', { op: 'op-baja-0000000003' }],
    ] as const) {
      const r = await pedir(ruta, cuerpo);
      expect(r, ruta).toEqual({
        status: 409,
        cuerpo: { estado: 'dada-de-baja', motivo: TIENDA_DADA_DE_BAJA },
      });
    }
    const { version_publicada } = (await shard
      .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
      .bind(DOS)
      .first<{ version_publicada: number | null }>()) ?? { version_publicada: null };
    expect(version_publicada).toBeNull();
  });

  it('los derechos de sus compradores se siguen atendiendo', async () => {
    const r = await pedir('titular/buscar', { celular: '+573000000000' });
    expect(r.status).not.toBe(409);
  });
});
