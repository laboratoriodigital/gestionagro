/**
 * La API de la Tienda (HU-T2.4): sin el secreto del despacho no existe (CA4), y su salud mira el
 * shard y la base de control migrados, y si la llave maestra se puede leer sin decir su valor.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CABECERA_DESPACHO, crearApp, type Env, estadoDeLaKek, mismoSecreto } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-despacho';
/** 32 bytes en base64: una KEK de prueba. */
const KEK = btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 7)));

let shard: BaseD1;
let control: BaseD1;
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
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const env = (extra: Record<string, unknown> = {}): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  PLAN: 'free',
  SECRETO_DESPACHO: SECRETO,
  tienda_c1_s1: shard,
  tienda_control: control,
  ...extra,
});
const pedir = (
  ruta: string,
  e: Env,
  cabeceras: Record<string, string> = { [CABECERA_DESPACHO]: SECRETO },
) => crearApp().request(ruta, { headers: cabeceras }, e);

describe('solo el despacho y el panel llegan a la API (CA4, TIENDA §14.1)', () => {
  it.each([
    ['sin la cabecera del despacho', {}],
    ['con otro secreto', { [CABECERA_DESPACHO]: 'otro' }],
    ['con el secreto de más', { [CABECERA_DESPACHO]: `${SECRETO}x` }],
  ])('❌ %s responde 404, como si no existiera', async (_caso, cabeceras) => {
    const r = await pedir('/api/salud', env(), cabeceras);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ estado: 'no-existe' });
  });

  it('❌ sin el secreto configurado, nada pasa: ni con una cabecera vacía', async () => {
    const r = await pedir('/api/salud', env({ SECRETO_DESPACHO: undefined }), {
      [CABECERA_DESPACHO]: '',
    });
    expect(r.status).toBe(404);
  });

  it('una ruta que no existe responde 404 también con el secreto', async () => {
    expect((await pedir('/api/v1/pedidos', env())).status).toBe(404);
  });

  it('compara el secreto entero', () => {
    expect(mismoSecreto('abc', 'abc')).toBe(true);
    expect(mismoSecreto('abc', 'abd')).toBe(false);
    expect(mismoSecreto('abc', 'ab')).toBe(false);
    expect(mismoSecreto('', 'a')).toBe(false);
  });
});

describe('GET /api/salud, la prueba de humo del despliegue', () => {
  it('con el shard y la base de control migrados responde ok, sin la KEK todavía', async () => {
    const r = await pedir('/api/salud', env());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      estado: 'ok',
      celda: 'c1',
      shards: 1,
      control: true,
      kek: 'falta',
    });
  });

  it('dice si la KEK se puede leer, nunca su valor', async () => {
    const r = await pedir('/api/salud', env({ TIENDA_KEK_V1: KEK }));
    const texto = await r.text();
    expect(JSON.parse(texto).kek).toBe('ok');
    expect(texto).not.toContain(KEK);
  });

  it('❌ una KEK que no es de 32 bytes es ilegible', async () => {
    expect(await estadoDeLaKek(btoa('corta'))).toBe('ilegible');
    expect(await estadoDeLaKek('no es base64 ¡')).toBe('ilegible');
    expect(await estadoDeLaKek(KEK)).toBe('ok');
  });

  it('❌ sin la celda configurada responde 503 y dice qué falta (P1)', async () => {
    const r = await pedir('/api/salud', env({ CELDA: undefined }));
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ estado: 'sin-configurar', motivo: 'Falta CELDA' });
  });

  it('❌ una base de control sin su migración responde 503 y la nombra', async () => {
    // El shard en el lugar del control: tiene tablas, pero no las de la base de control.
    const r = await pedir('/api/salud', env({ tienda_control: shard }));
    expect(r.status).toBe(503);
    expect((await r.json()).motivo).toBe('tienda_control: faltan tablas de la migración');
  });

  it('❌ sin shards ni base de control responde 503 con las dos fallas', async () => {
    const r = await pedir(
      '/api/salud',
      env({ tienda_c1_s1: undefined, tienda_control: undefined }),
    );
    expect(r.status).toBe(503);
    expect((await r.json()).motivo).toBe(
      'la celda no tiene bases de shard; falta la base tienda_control',
    );
  });
});

describe('el kill switch ks:tienda (HU-T2.7, TIENDA §15.2)', () => {
  const flags = (valores: Record<string, string>) => ({
    get: async (clave: string) => valores[clave] ?? null,
  });
  const pedirCon = (metodo: string, e: Env) =>
    crearApp().request(
      '/api/salud',
      { method: metodo, headers: { [CABECERA_DESPACHO]: SECRETO } },
      e,
    );

  it('apagado, la API queda en solo lectura: leer sigue', async () => {
    const r = await pedirCon('GET', env({ FLAGS: flags({ 'ks:tienda': 'apagado' }) }));
    expect(r.status).toBe(200);
  });

  it('❌ apagado, escribir responde 503 con Retry-After y lo dice en palabras', async () => {
    const r = await pedirCon('POST', env({ FLAGS: flags({ 'ks:tienda': 'apagado' }) }));
    expect(r.status).toBe(503);
    expect(r.headers.get('retry-after')).toBe('120');
    expect((await r.json()).estado).toBe('apagado');
  });

  it('encendido, escribir llega a su ruta (hoy ninguna: 404)', async () => {
    const r = await pedirCon('POST', env({ FLAGS: flags({ 'ks:tienda': 'encendido' }) }));
    expect(r.status).toBe(404);
  });
});
