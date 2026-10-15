/**
 * HU-T8.2 CA3: cambiar la dirección de un producto en el panel deja horneada una redirección 301
 * desde la anterior. Contra el shard local con los comercios de prueba: se guarda por la API del
 * catálogo, se publica (HU-T4.4) y el despacho (HU-T5.1) sirve la versión nueva.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  hostDeStaging,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearDespacho, type Env } from '../../tienda-sitio/src/worker.ts';
import { guardarProducto, leerProducto, type Quien } from './catalogo.ts';
import { type Almacen, publicar, redireccionesDe } from './publicar.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-15T15:00:00.000Z';

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
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const objetos = new Map<string, string>();
const hosts = new Map<string, string>();
const sitios: Almacen = {
  get: async (clave) => {
    const t = objetos.get(clave);
    return t === undefined ? null : { text: async () => t };
  },
  put: async (clave, valor) => void objetos.set(clave, valor),
};
const publicarUno = () =>
  publicar({
    shard,
    shardNombre: 'tienda_c1_s1',
    control,
    sitios,
    hosts: { put: async (k: string, v: string) => void hosts.set(k, v) },
    celda: 'c1',
    release: 'r1',
    org: ENSAYO_UNO.org,
    pedidaPor: 'usuario:prueba',
    ahora: AHORA,
    omitir: ['sin-foto'],
  });
const env = (): Env => ({
  TIENDA_HOSTS: { get: async (clave: string) => hosts.get(clave) ?? null },
  SITIOS_C1: sitios,
  SECRETO_DESPACHO: 'secreto',
});
const visitar = (ruta: string) =>
  crearDespacho().fetch(new Request(`https://${hostDeStaging(ENSAYO_UNO.slug)}${ruta}`), env());

describe('HU-T8.2 CA3 · la dirección vieja de un producto', () => {
  it('las redirecciones salen de las direcciones anteriores de cada producto activo', () => {
    expect(
      redireccionesDe([
        {
          slug: 'camisa',
          seo: JSON.stringify({ slugsAnteriores: ['camisa-de-lino', 'camisa-vieja'] }),
        },
        { slug: 'pan', seo: '{}' },
        { slug: 'roto', seo: 'no es json' },
        { slug: 'raro', seo: JSON.stringify({ slugsAnteriores: ['https://otro.test/', 'raro'] }) },
      ]),
    ).toEqual({ '/p/camisa-de-lino/': '/p/camisa/', '/p/camisa-vieja/': '/p/camisa/' });
  });

  it('cambiar el slug en el panel y publicar deja un 301 horneado desde el anterior', async () => {
    expect(await publicarUno()).toMatchObject({ estado: 'publicada', version: 1 });
    expect((await visitar('/p/camisa-de-lino/')).status).toBe(200);

    const q: Quien = {
      db: shard,
      org: ENSAYO_UNO.org,
      actor: 'usuario:ensayo-uno',
      instante: AHORA,
    };
    const camisa = await leerProducto(q, 'p-camisa');
    if (!camisa) throw new Error('falta la camisa');
    const r = await guardarProducto(q, {
      op: 'op-cambiar-slug-01',
      id: camisa.id,
      version: camisa.version,
      nombre: camisa.nombre,
      slug: 'camisa-lino',
      estado: 'activo',
      opciones: camisa.opciones,
      variantes: camisa.variantes,
    });
    expect(r).toMatchObject({ estado: 'guardado', slug: 'camisa-lino' });

    expect(await publicarUno()).toMatchObject({ estado: 'publicada', version: 2 });
    const vieja = await visitar('/p/camisa-de-lino/?utm_source=whatsapp');
    expect(vieja.status).toBe(301);
    expect(vieja.headers.get('location')).toBe(
      `https://${hostDeStaging(ENSAYO_UNO.slug)}/p/camisa-lino/?utm_source=whatsapp`,
    );
    // Sin la barra final también llega.
    expect((await visitar('/p/camisa-de-lino')).headers.get('location')).toMatch(
      /\/p\/camisa-lino\/$/,
    );
    const nueva = await visitar('/p/camisa-lino/');
    expect(nueva.status).toBe(200);
    expect(await nueva.text()).toContain('Camisa de lino');
    // ❌ Lo que nunca existió sigue siendo «no existe», no un salto.
    expect((await visitar('/p/no-existe/')).status).toBe(404);
  });
});
