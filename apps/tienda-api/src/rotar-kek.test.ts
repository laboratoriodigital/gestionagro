/**
 * HU-T17.6: rotar la KEK sin perder un dato, sobre la base local con los dos comercios de prueba.
 * Las llaves de Bold y los índices ciegos se escriben con la `v1`; se carga la `v2`, el despliegue
 * reenvuelve, y con la `v2` sola todo se sigue abriendo igual. Ninguna llave es real.
 */
import { indiceCiego } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { dekDeCredenciales, guardarCredencial, llavesDeBold } from './credenciales.ts';
import {
  dekVigente,
  kekDelEntorno,
  llavesQueNoAbre,
  reenvolverLlaves,
  textoDeLasKeks,
  usoDeLasKeks,
} from './llaves.ts';
import { REENVOLVER_LLAVES } from './tareas.ts';
import { CABECERA_DESPACHO, crearApp, type Env, estadoDeLaKek } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-la-rotacion';
const AHORA = '2026-10-20T15:00:00.000Z';
const llaveDe = (desde: number) =>
  Buffer.from(Array.from({ length: 32 }, (_, i) => i + desde)).toString('base64');
const V1 = llaveDe(41);
const V2 = llaveDe(91);
const TIENDAS = [ENSAYO_UNO.org, ENSAYO_DOS.org];
const CELULAR = '+573001234567';

let shard: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const kek = async (texto: string) => {
  const k = await kekDelEntorno(texto);
  if (!k) throw new Error('KEK de prueba ilegible');
  return k;
};

/** Lo que se escribió con la v1 y tiene que leerse igual después: las llaves y un índice ciego. */
const leido = async (texto: string, org: string) => {
  const k = await kek(texto);
  return {
    bold: await llavesDeBold(shard, org, 'pruebas', k),
    indice: await indiceCiego(await dekVigente(shard, org, 'indices', k, AHORA), CELULAR),
  };
};

const desplegar = (env: Partial<Env>, secreto = SECRETO) =>
  crearApp({ ahora: () => Date.parse(AHORA) }).request(
    '/api/despliegue/llaves',
    { method: 'POST', headers: { [CABECERA_DESPACHO]: SECRETO, 'x-despliegue': secreto } },
    { SECRETO_DESPACHO: SECRETO, tienda_c1_s1: shard, ...env } as Env,
  );

const antes: Record<string, Awaited<ReturnType<typeof leido>>> = {};

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  shard = s.db;
  cerrar.push(s.cerrar);
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  const v1 = await kek(V1);
  for (const org of TIENDAS) {
    const dek = await dekDeCredenciales(shard, org, v1, AHORA);
    await shard.batch(
      await Promise.all(
        (['identidad', 'secreta'] as const).map((campo) =>
          guardarCredencial(
            shard,
            dek,
            { org, proveedor: 'bold', ambiente: 'pruebas', campo, valor: `${campo}-de-${org}` },
            AHORA,
          ),
        ),
      ),
    );
    antes[org] = await leido(V1, org);
  }
}, 60_000);

afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('las KEK del Worker (HU-T17.6)', () => {
  it('la de número más alto es la vigente, y todas abren', async () => {
    const texto = textoDeLasKeks({ TIENDA_KEK_V2: V2, TIENDA_KEK_V1: ` ${V1} `, OTRA: 'x' });
    expect(texto).toBe(`v1:${V1},v2:${V2}`);
    const k = await kek(texto ?? '');
    expect(k.id).toBe('v2');
    expect([...k.todas.keys()]).toEqual(['v1', 'v2']);
    // Una sola, como hasta hoy, es la v1.
    expect((await kek(V1)).id).toBe('v1');
    expect(textoDeLasKeks({})).toBeUndefined();
  });

  it('❌ una KEK ilegible no se ignora: ninguna se carga y la salud lo dice', async () => {
    expect(await kekDelEntorno(`v1:${V1},v2:${btoa('corta')}`)).toBeNull();
    expect(await kekDelEntorno(`vx:${V1}`)).toBeNull();
    expect(await estadoDeLaKek(`v1:${V1},v2:${btoa('corta')}`)).toBe('ilegible');
    expect(await estadoDeLaKek(`v1:${V1},v2:${V2}`)).toBe('ok');
  });
});

describe('rotar la KEK (HU-T17.6)', () => {
  it('❌ CA2: sin reenvolver, la v2 sola no abre lo de la v1, y el uso lo dice antes de borrar', async () => {
    expect(await usoDeLasKeks(shard)).toEqual({ v1: 4 });
    expect(await llavesDeBold(shard, ENSAYO_UNO.org, 'pruebas', await kek(`v2:${V2}`))).toBeNull();
    // Abrir no reenvuelve: nada cambió.
    expect(await usoDeLasKeks(shard)).toEqual({ v1: 4 });
  });

  it('❌ la ruta del despliegue no existe sin su secreto', async () => {
    const r = await desplegar({ TIENDA_KEK_V1: V1, TIENDA_KEK_V2: V2 }, 'otro');
    expect(r.status).toBe(404);
    expect(await usoDeLasKeks(shard)).toEqual({ v1: 4 });
  });

  it('una vuelta reenvuelve como mucho su límite, y lo nuevo nace con la vigente', async () => {
    const ambas = await kek(`v1:${V1},v2:${V2}`);
    expect(await reenvolverLlaves(shard, ambas, 1)).toEqual({ reenvueltas: 1 });
    expect(await usoDeLasKeks(shard)).toEqual({ v1: 3, v2: 1 });
    // El índice ciego de Ensayo Dos nace ahora, envuelto con la v2.
    await dekVigente(shard, ENSAYO_DOS.org, 'datos_personales', ambas, AHORA);
    expect(await usoDeLasKeks(shard)).toEqual({ v1: 3, v2: 2 });
  });

  it('CA1: el despliegue con la v2 reenvuelve todo, y con la v2 sola todo se abre igual', async () => {
    const r = await desplegar({ TIENDA_KEK_V1: V1, TIENDA_KEK_V2: V2 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      estado: 'ok',
      vigente: 'v2',
      cargadas: ['v1', 'v2'],
      reenvueltas: 3,
      enUso: { v2: 5 },
      quedan: 0,
      ilegibles: 0,
    });
    for (const org of TIENDAS) expect(await leido(`v2:${V2}`, org)).toEqual(antes[org]);
    // Otra vez no hace nada: ninguna queda con la v1.
    const otra = await desplegar({ TIENDA_KEK_V1: V1, TIENDA_KEK_V2: V2 });
    expect(await otra.json()).toMatchObject({ reenvueltas: 0, quedan: 0 });
  });

  it('❌ CA2: una DEK que la vigente no abre se cuenta, y el despliegue no retira nada', async () => {
    // Una DEK de otra KEK que nadie cargó: como si alguien la hubiera escrito con una llave perdida.
    await shard
      .prepare(
        "INSERT INTO llave (org_id, proposito, version, envuelta, kek_id, creada) VALUES (?, 'datos_personales', 9, ?, 'v9', ?)",
      )
      .bind(ENSAYO_UNO.org, new TextEncoder().encode('no-es-una-llave'), AHORA)
      .run();
    expect(await llavesQueNoAbre(shard, await kek(`v2:${V2}`))).toBe(1);
    const r = await desplegar({ TIENDA_KEK_V1: V1, TIENDA_KEK_V2: V2 });
    expect(await r.json()).toMatchObject({ quedan: 1, enUso: { v2: 5, v9: 1 }, ilegibles: null });
    await shard
      .prepare("DELETE FROM llave WHERE org_id = ? AND kek_id = 'v9'")
      .bind(ENSAYO_UNO.org)
      .run();
  });

  it('con una sola KEK, la vuelta del cron no lee nada; con dos, reenvuelve', async () => {
    const e = { shards: [['tienda_c1_s1', shard]] } as unknown as Parameters<
      typeof REENVOLVER_LLAVES.correr
    >[0];
    expect(await REENVOLVER_LLAVES.correr({ ...e, kekTexto: `v2:${V2}` }, 0)).toBe(
      'solo está v2: nada que reenvolver',
    );
    expect(await REENVOLVER_LLAVES.correr({ ...e }, 0)).toBe('sin KEK: nada que reenvolver');
    expect(await REENVOLVER_LLAVES.correr({ ...e, kekTexto: `v1:${V1},v2:${V2}` }, 0)).toBe(
      '0 llaves reenvueltas con v2',
    );
  });
});
