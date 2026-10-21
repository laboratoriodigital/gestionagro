/**
 * HU-T10.2: las páginas propias en la API, sobre el shard local con Ensayo Uno sembrado. Guardar,
 * editar con su versión y borrar a la papelera, con el registro; y ninguna toma una dirección del
 * sistema ni la de otra página (CA2). Ningún dato real.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Quien } from './catalogo.ts';
import { borrarPagina, guardarPagina, listarPaginas } from './paginas.ts';
import { enFrase, leerRegistro } from './registro.ts';

const AHORA = '2026-10-20T15:00:00.000Z';
let shard: BaseD1;
let cerrar: () => Promise<void>;
let n = 0;
const op = () => `op-pagina-${++n}-${'x'.repeat(8)}`;
const quien = (): Quien => ({
  db: shard,
  org: ENSAYO_UNO.org,
  actor: 'usuario:0199e0a0-0000-7000-8000-0000000000aa',
  instante: AHORA,
});
const pagina = (extra: Record<string, unknown> = {}) => ({
  op: op(),
  slug: 'quienes-somos',
  titulo: 'Quiénes somos',
  cuerpo: 'Un taller familiar.',
  visible: true,
  ...extra,
});

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  shard = s.db;
  cerrar = s.cerrar;
  for (const sql of siembraDelShard([ENSAYO_UNO], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
}, 60_000);
afterAll(async () => cerrar());

describe('las páginas propias (HU-T10.2)', () => {
  it('CA1: se crea, se edita con su versión y se borra a la papelera, y el registro lo dice', async () => {
    const creada = await guardarPagina(quien(), pagina());
    expect(creada).toMatchObject({ estado: 'guardado', version: 1, slug: 'quienes-somos' });
    if (creada.estado !== 'guardado') throw new Error('no se creó');
    expect((await listarPaginas(quien())).paginas).toEqual([
      {
        id: creada.id,
        slug: 'quienes-somos',
        titulo: 'Quiénes somos',
        cuerpo: 'Un taller familiar.',
        visible: true,
        version: 1,
      },
    ]);
    const editada = await guardarPagina(
      quien(),
      pagina({ id: creada.id, version: 1, titulo: 'Nuestra historia', slug: 'nuestra-historia' }),
    );
    expect(editada).toMatchObject({ estado: 'guardado', version: 2, slug: 'nuestra-historia' });
    // Con la versión vieja, alguien más la cambió.
    expect(await guardarPagina(quien(), pagina({ id: creada.id, version: 1 }))).toMatchObject({
      estado: 'cambiado',
      version: 2,
    });
    expect(await borrarPagina(quien(), { op: op(), id: creada.id, version: 2 })).toMatchObject({
      estado: 'guardado',
      version: 3,
    });
    expect((await listarPaginas(quien())).paginas).toEqual([]);
    const { results } = await shard
      .prepare('SELECT borrado FROM pagina WHERE org_id = ? AND id = ?')
      .bind(ENSAYO_UNO.org, creada.id)
      .all<{ borrado: string | null }>();
    expect(results).toEqual([{ borrado: AHORA }]);
    const frases = (await leerRegistro(shard, ENSAYO_UNO.org, null)).filas.map((f) =>
      enFrase(f, quien().actor),
    );
    expect(frases).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/la página «Quiénes somos»$/),
        expect.stringMatching(/la página «Nuestra historia»$/),
        expect.stringMatching(/la página «Nuestra historia» a la papelera$/),
      ]),
    );
  });

  it('❌ CA2: ni una dirección de la tienda, ni la de otra página', async () => {
    for (const slug of ['legal', 'carrito', 'productos', 'solicitud', 'api'])
      expect(await guardarPagina(quien(), pagina({ slug }))).toMatchObject({
        estado: 'problemas',
        problemas: [{ campo: 'slug', mensaje: expect.stringMatching(/la usa la tienda/) }],
      });
    expect(await guardarPagina(quien(), pagina({ slug: 'como-comprar' }))).toMatchObject({
      estado: 'guardado',
    });
    expect(await guardarPagina(quien(), pagina({ slug: 'como-comprar' }))).toEqual({
      estado: 'problemas',
      problemas: [
        { campo: 'slug', mensaje: 'Ya tienes otra página con esa dirección. Elige otra.' },
      ],
    });
  });

  it('❌ sin título o sin texto, lo dice por campo', async () => {
    expect(await guardarPagina(quien(), pagina({ titulo: '', cuerpo: '  ' }))).toMatchObject({
      estado: 'problemas',
      problemas: expect.arrayContaining([
        expect.objectContaining({ campo: 'titulo' }),
        expect.objectContaining({ campo: 'cuerpo' }),
      ]),
    });
  });
});
