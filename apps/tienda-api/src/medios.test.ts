/**
 * HU-T8.3: subir las fotos de un producto. Contra el shard local con los comercios de prueba y un
 * bucket de mentira que guarda lo que recibe.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { leerProducto, type Quien } from './catalogo.ts';
import { type BucketDeFotos, fotoDeLaVariante, quitarFoto, subirFoto } from './medios.ts';

const AHORA = '2026-10-15T15:00:00.000Z';
const HUELLA = 'a'.repeat(64);
let db: BaseD1;
let cerrar: () => Promise<void>;

beforeEach(async () => {
  ({ db, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await db.prepare(sql.replace(/;$/, '')).run();
});
afterEach(async () => cerrar());

const quien = (org = ENSAYO_UNO.org): Quien => ({
  db,
  org,
  actor: 'usuario:ensayo-uno',
  instante: AHORA,
});

function bucket() {
  const guardados = new Map<string, { bytes: number; tipo: string; cache: string }>();
  const b: BucketDeFotos = {
    put: async (clave, valor, o) =>
      void guardados.set(clave, {
        bytes: valor.byteLength,
        tipo: o.httpMetadata.contentType,
        cache: o.httpMetadata.cacheControl,
      }),
  };
  return { b, guardados };
}

/** Los primeros bytes de cada formato, y lo que manda Safari cuando se le pide WebP. */
const WEBP = () =>
  new Uint8Array(
    [...'RIFF']
      .map((c) => c.charCodeAt(0))
      .concat(
        [0, 0, 0, 0],
        [...'WEBPVP8 '].map((c) => c.charCodeAt(0)),
      ),
  );
const JPEG = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const PNG = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const formulario = (o: {
  formato?: string;
  alt?: string;
  ancho?: number;
  archivos?: Record<number, Uint8Array<ArrayBuffer>>;
  tipo?: string;
}) => {
  const f = new FormData();
  f.set('producto', 'p-camisa');
  f.set('huella', HUELLA);
  f.set('alt', o.alt ?? 'Camisa de lino arena, de frente');
  f.set('formato', o.formato ?? 'webp');
  f.set('ancho', String(o.ancho ?? 1200));
  f.set('alto', '1500');
  for (const [ancho, bytes] of Object.entries(o.archivos ?? { 400: WEBP(), 800: WEBP() })) {
    f.set(`d${ancho}`, new Blob([bytes], { type: o.tipo ?? 'image/webp' }), `${ancho}.webp`);
  }
  return f;
};

describe('HU-T8.3 · las fotos de un producto', () => {
  it('CA1: guarda solo las derivadas que alcanza el original, por su huella y con caché inmutable', async () => {
    const { b, guardados } = bucket();
    const r = await subirFoto(quien(), b, formulario({}));
    expect(r).toEqual({ estado: 'guardado', id: HUELLA, formato: 'webp', anchos: [400, 800] });
    expect([...guardados.keys()]).toEqual([
      `${ENSAYO_UNO.org}/${HUELLA}/400.webp`,
      `${ENSAYO_UNO.org}/${HUELLA}/800.webp`,
    ]);
    expect(guardados.get(`${ENSAYO_UNO.org}/${HUELLA}/400.webp`)).toMatchObject({
      tipo: 'image/webp',
      cache: 'public, max-age=31536000, immutable',
    });
    const p = await leerProducto(quien(), 'p-camisa');
    expect(p?.medios).toEqual([
      {
        id: HUELLA,
        varianteId: null,
        alt: 'Camisa de lino arena, de frente',
        ancho: 1200,
        alto: 1500,
        formato: 'webp',
        anchos: [400, 800],
      },
    ]);
  });

  it('CA2: en JPEG, la ruta y `medio.formatos` dicen JPEG', async () => {
    const { b, guardados } = bucket();
    await subirFoto(
      quien(),
      b,
      formulario({ formato: 'jpeg', archivos: { 400: JPEG() }, tipo: 'image/jpeg' }),
    );
    expect([...guardados.keys()]).toEqual([`${ENSAYO_UNO.org}/${HUELLA}/400.jpeg`]);
    const fila = await db
      .prepare('SELECT formatos FROM medio WHERE org_id = ?')
      .bind(ENSAYO_UNO.org)
      .first<{ formatos: string }>();
    expect(JSON.parse(fila?.formatos ?? '{}')).toEqual({ jpeg: { 400: 6 } });
  });

  it('❌ CA3: un PNG que dice ser WebP (Safari) no se guarda como .webp', async () => {
    const { b, guardados } = bucket();
    const r = await subirFoto(quien(), b, formulario({ archivos: { 400: PNG() } }));
    expect(r).toEqual({
      estado: 'problemas',
      problemas: [
        {
          campo: 'd400',
          mensaje: 'la derivada de 400 px no es webp: el teléfono la hizo en otro formato',
        },
      ],
    });
    expect(guardados.size).toBe(0);
  });

  it('❌ CA1: sin texto alternativo no se sube', async () => {
    const { b, guardados } = bucket();
    const r = await subirFoto(quien(), b, formulario({ alt: '  ' }));
    expect(r.estado === 'problemas' && r.problemas.map((p) => p.campo)).toEqual(['alt']);
    expect(guardados.size).toBe(0);
  });

  it('una derivada más ancha que el original, o un original de menos de 400 px, no pasa', async () => {
    const { b } = bucket();
    const ancha = await subirFoto(
      quien(),
      b,
      formulario({ ancho: 900, archivos: { 400: WEBP(), 1600: WEBP() } }),
    );
    expect(ancha.estado === 'problemas' && ancha.problemas[0]?.mensaje).toBe(
      'la foto mide 900 px: no tiene derivada de 1600',
    );
    const chica = await subirFoto(quien(), b, formulario({ ancho: 300, archivos: {} }));
    expect(chica.estado === 'problemas' && chica.problemas[0]?.mensaje).toBe(
      'la foto es muy pequeña: necesita al menos 400 px de ancho',
    );
  });

  it('❌ la misma foto otra vez no se duplica; la de otra tienda no ve el producto (P4)', async () => {
    const { b } = bucket();
    await subirFoto(quien(), b, formulario({}));
    expect(await subirFoto(quien(), b, formulario({}))).toMatchObject({ estado: 'guardado' });
    expect((await leerProducto(quien(), 'p-camisa'))?.medios).toHaveLength(1);
    expect(await subirFoto(quien(ENSAYO_DOS.org), b, formulario({}))).toMatchObject({
      estado: 'no-existe',
    });
  });

  it('quitar una foto la saca del producto y lo anota en el registro', async () => {
    const { b } = bucket();
    await subirFoto(quien(), b, formulario({}));
    expect(await quitarFoto(quien(), { producto: 'p-camisa', id: HUELLA })).toEqual({
      estado: 'quitada',
      id: HUELLA,
    });
    expect((await leerProducto(quien(), 'p-camisa'))?.medios).toEqual([]);
    const { results } = await db
      .prepare('SELECT accion FROM registro WHERE org_id = ? ORDER BY id')
      .bind(ENSAYO_UNO.org)
      .all<{ accion: string }>();
    expect(results.map((f) => f.accion)).toEqual(['medio.subir', 'medio.quitar']);
  });
});

describe('HU-T5.9 y HU-T5.13 · la foto de una combinación y las imágenes de la tienda', () => {
  it('una foto se asigna a una combinación del producto y vuelve a ser general', async () => {
    const { b } = bucket();
    await subirFoto(quien(), b, formulario({}));
    const asignar = (variante: string | null) =>
      fotoDeLaVariante(quien(), { producto: 'p-camisa', id: HUELLA, variante });
    expect(await asignar('v-camisa-m-arena')).toEqual({
      estado: 'asignada',
      id: HUELLA,
      variante: 'v-camisa-m-arena',
    });
    expect((await leerProducto(quien(), 'p-camisa'))?.medios[0]?.varianteId).toBe(
      'v-camisa-m-arena',
    );
    expect(await asignar(null)).toMatchObject({ estado: 'asignada', variante: null });
    expect((await leerProducto(quien(), 'p-camisa'))?.medios[0]?.varianteId).toBeNull();
  });

  it('❌ ni la combinación de otro producto, ni la foto de otra tienda (P4)', async () => {
    const { b } = bucket();
    await subirFoto(quien(), b, formulario({}));
    expect(
      await fotoDeLaVariante(quien(), { producto: 'p-camisa', id: HUELLA, variante: 'v-otra' }),
    ).toMatchObject({ estado: 'no-existe' });
    expect(
      await fotoDeLaVariante(quien(ENSAYO_DOS.org), {
        producto: 'p-camisa',
        id: HUELLA,
        variante: null,
      }),
    ).toMatchObject({ estado: 'no-existe' });
    expect(await fotoDeLaVariante(quien(), { producto: 'p-camisa' })).toMatchObject({
      estado: 'problemas',
    });
  });

  it('el logo se guarda en las fotos de la tienda, sin producto y sin tocar `medio`', async () => {
    const { b, guardados } = bucket();
    const f = formulario({});
    f.set('producto', '');
    expect(await subirFoto(quien(), b, f, { deLaTienda: true })).toEqual({
      estado: 'guardado',
      id: HUELLA,
      formato: 'webp',
      anchos: [400, 800],
    });
    expect([...guardados.keys()]).toEqual([
      `${ENSAYO_UNO.org}/${HUELLA}/400.webp`,
      `${ENSAYO_UNO.org}/${HUELLA}/800.webp`,
    ]);
    const { results } = await db
      .prepare('SELECT id FROM medio WHERE org_id = ?')
      .bind(ENSAYO_UNO.org)
      .all();
    expect(results).toEqual([]);
  });
});
