/**
 * HU-T8.2 y HU-T8.4: el catálogo desde el panel, contra el shard local con los dos comercios de
 * prueba sembrados (HU-T2.6). Cada prueba arranca con una base nueva.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  borrarLaColeccion,
  guardarLaColeccion,
  guardarProducto,
  leerProducto,
  listarColecciones,
  listarProductos,
  ofertaEnLaLista,
  ordenarProductos,
  type Quien,
  tocarElProducto,
} from './catalogo.ts';

const AHORA = '2026-10-15T15:00:00.000Z';
const ORG = ENSAYO_UNO.org;

let db: BaseD1;
let cerrar: () => Promise<void>;
let n = 0;
const op = () => `op-prueba-${String(++n).padStart(4, '0')}`;

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

const quien = (base: BaseD1 = db, org = ORG): Quien => ({
  db: base,
  org,
  actor: 'usuario:ensayo-uno',
  instante: AHORA,
});

const delantal = (extra: Record<string, unknown> = {}) => ({
  op: op(),
  nombre: 'Delantal de lino',
  estado: 'activo',
  opciones: [{ nombre: 'Color', valores: ['Arena', 'Azul'] }],
  variantes: [
    { valores: ['Arena'], sku: 'DEL-AR', precioCop: 59000, stock: 3 },
    { valores: ['Azul'], sku: 'DEL-AZ', precioCop: 59000, stock: null },
  ],
  ...extra,
});

const registro = async () =>
  (
    await db
      .prepare('SELECT accion, antes, despues FROM registro WHERE org_id = ? ORDER BY id')
      .bind(ORG)
      .all<{ accion: string; antes: string | null; despues: string | null }>()
  ).results;

describe('HU-T8.2 · productos con sus combinaciones', () => {
  it('CA1: crea el producto con sus combinaciones y su dirección sale del nombre', async () => {
    const r = await guardarProducto(quien(), delantal());
    expect(r).toMatchObject({ estado: 'guardado', version: 1, slug: 'delantal-de-lino' });
    if (r.estado !== 'guardado') return;
    const p = await leerProducto(quien(), r.id);
    expect(p?.variantes.map((v) => [v.valores.join('|'), v.precioCop, v.stock])).toEqual([
      ['Arena', 59000, 3],
      ['Azul', 59000, null],
    ]);
    expect((await registro()).map((f) => f.accion)).toEqual([
      'producto.crear',
      'variante.crear',
      'variante.crear',
    ]);
  });

  it('CA1: un nombre que ya tiene dirección recibe la siguiente libre', async () => {
    const r = await guardarProducto(
      quien(),
      delantal({
        nombre: 'Camisa de lino',
        variantes: [{ valores: ['Arena'], precioCop: 1000, stock: 1 }],
      }),
    );
    expect(r).toMatchObject({ estado: 'guardado', slug: 'camisa-de-lino-2' });
  });

  it('CA4: un precio en 0, vacío o con centavos, o un stock sin decir, no se guarda; cada uno con su campo', async () => {
    const r = await guardarProducto(
      quien(),
      delantal({
        variantes: [
          { valores: ['Arena'], precioCop: 0, stock: 1 },
          { valores: ['Azul'], precioCop: 1500.5 },
        ],
      }),
    );
    expect(r.estado).toBe('problemas');
    if (r.estado !== 'problemas') return;
    expect(r.problemas.map((p) => p.campo).sort()).toEqual([
      'variantes.0.precioCop',
      'variantes.1.precioCop',
      'variantes.1.stock',
    ]);
    expect(r.problemas.find((p) => p.campo === 'variantes.0.precioCop')?.mensaje).toBe(
      'un precio de 0 no se guarda',
    );
    const vacio = await guardarProducto(
      quien(),
      delantal({ variantes: [{ valores: ['Arena'], precioCop: null, stock: 1 }] }),
    );
    expect(vacio.estado).toBe('problemas');
    expect((await registro()).length).toBe(0);
  });

  it('CA4: «no se cuenta» es `null` a propósito, y se guarda así', async () => {
    const r = await guardarProducto(quien(), delantal());
    if (r.estado !== 'guardado') throw new Error(r.estado);
    const stock = await db
      .prepare('SELECT stock FROM variante WHERE org_id = ? AND producto_id = ? AND clave = ?')
      .bind(ORG, r.id, 'Azul')
      .first<{ stock: number | null }>();
    expect(stock).toEqual({ stock: null });
  });

  it('las combinaciones tienen que ser de las opciones, sin repetirse', async () => {
    const r = await guardarProducto(
      quien(),
      delantal({
        variantes: [
          { valores: ['Verde'], precioCop: 1000, stock: 1 },
          { valores: ['Azul'], precioCop: 1000, stock: 1 },
          { valores: ['Azul'], precioCop: 1000, stock: 1 },
        ],
      }),
    );
    expect(r.estado === 'problemas' && r.problemas.map((p) => p.mensaje)).toEqual([
      '«Verde» no es un valor de «Color»',
      'la combinación «Azul» está repetida',
    ]);
  });

  it('CA2: editar con la versión vieja responde «cambiado» con la versión actual, sin escribir', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    const b = await guardarProducto(
      quien(),
      delantal({ id: a.id, version: 1, nombre: 'Delantal corto' }),
    );
    expect(b).toMatchObject({ estado: 'guardado', version: 2 });
    const c = await guardarProducto(
      quien(),
      delantal({ id: a.id, version: 1, nombre: 'Delantal largo' }),
    );
    expect(c).toMatchObject({ estado: 'cambiado', version: 2 });
    expect((await leerProducto(quien(), a.id))?.nombre).toBe('Delantal corto');
  });

  it('CA2: si otra escritura gana la carrera entre la lectura y el lote, el lote entero no se aplica', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    const antes = (await registro()).length;
    // La otra persona guarda justo antes de que entre nuestro lote.
    const carrera: BaseD1 = {
      ...db,
      prepare: db.prepare.bind(db),
      batch: async (lote: SentenciaD1[]) => {
        await db
          .prepare(
            'UPDATE producto SET nombre = ?, version = version + 1 WHERE org_id = ? AND id = ?',
          )
          .bind('Delantal de la otra persona', ORG, a.id)
          .run();
        return db.batch(lote);
      },
    } as BaseD1;
    const r = await guardarProducto(
      quien(carrera),
      delantal({
        id: a.id,
        version: 1,
        nombre: 'Delantal mío',
        variantes: [{ valores: ['Arena'], sku: 'DEL-AR', precioCop: 61000, stock: 3 }],
      }),
    );
    expect(r).toMatchObject({ estado: 'cambiado', version: 2 });
    const p = await leerProducto(quien(), a.id);
    expect(p?.nombre).toBe('Delantal de la otra persona');
    expect(p?.variantes.map((v) => v.precioCop)).toEqual([59000, 59000]);
    expect((await registro()).length).toBe(antes);
  });

  it('CA2: repetir la misma operación devuelve lo mismo y no escribe dos veces', async () => {
    const cuerpo = delantal();
    const a = await guardarProducto(quien(), cuerpo);
    const b = await guardarProducto(quien(), cuerpo);
    expect(b).toEqual(a);
    expect(
      (await listarProductos(quien())).productos.filter((p) => p.nombre === 'Delantal de lino'),
    ).toHaveLength(1);
    expect((await registro()).filter((f) => f.accion === 'producto.crear')).toHaveLength(1);
  });

  it('CA3: cambiar la dirección guarda la anterior para la redirección', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    await guardarProducto(quien(), delantal({ id: a.id, version: 1, slug: 'delantal' }));
    const fila = await db
      .prepare('SELECT slug, seo FROM producto WHERE org_id = ? AND id = ?')
      .bind(ORG, a.id)
      .first<{ slug: string; seo: string }>();
    expect(fila?.slug).toBe('delantal');
    expect(JSON.parse(fila?.seo ?? '{}')).toEqual({ slugsAnteriores: ['delantal-de-lino'] });
  });

  it('HU-P4.4: lo de buscadores va con las direcciones; quien no lo manda no lo borra', async () => {
    const seo = async (id: string) =>
      JSON.parse(
        (
          await db
            .prepare('SELECT seo FROM producto WHERE org_id = ? AND id = ?')
            .bind(ORG, id)
            .first<{ seo: string }>()
        )?.seo ?? '{}',
      );
    const a = await guardarProducto(
      quien(),
      delantal({ buscadores: { titulo: '  Delantal de lino lavado  ', descripcion: '' } }),
    );
    if (a.estado !== 'guardado') throw new Error(a.estado);
    expect(await seo(a.id)).toEqual({ titulo: 'Delantal de lino lavado' });
    await guardarProducto(quien(), delantal({ id: a.id, version: 1, slug: 'delantal' }));
    expect(await seo(a.id)).toEqual({
      titulo: 'Delantal de lino lavado',
      slugsAnteriores: ['delantal-de-lino'],
    });
    expect((await leerProducto(quien(), a.id))?.buscadores).toEqual({
      titulo: 'Delantal de lino lavado',
    });
    await guardarProducto(
      quien(),
      delantal({ id: a.id, version: 2, slug: 'delantal', buscadores: { titulo: '' } }),
    );
    expect(await seo(a.id)).toEqual({ slugsAnteriores: ['delantal-de-lino'] });
    const largo = await guardarProducto(
      quien(),
      delantal({ id: a.id, version: 3, buscadores: { titulo: 'x'.repeat(121) } }),
    );
    expect(largo.estado === 'problemas' && largo.problemas[0]?.campo).toBe('buscadores.titulo');
  });

  it('HU-P1.4: la oferta programada es de Pro; quien no la manda no la borra', async () => {
    const plan = (p: string) =>
      db.prepare('UPDATE tienda SET plan = ? WHERE org_id = ?').bind(p, ORG).run();
    const oferta = { porcentaje: 20, desde: '2026-11-07', hasta: '2026-11-08' };
    await plan('gratis');
    const gratis = await guardarProducto(quien(), delantal({ oferta }));
    expect(gratis.estado === 'problemas' && gratis.problemas[0]?.campo).toBe('oferta');
    await plan('pro');
    const a = await guardarProducto(quien(), delantal({ oferta }));
    if (a.estado !== 'guardado') throw new Error(a.estado);
    expect((await leerProducto(quien(), a.id))?.oferta).toEqual(oferta);
    await guardarProducto(quien(), delantal({ id: a.id, version: 1 }));
    expect((await leerProducto(quien(), a.id))?.oferta).toEqual(oferta);
    const alReves = await guardarProducto(
      quien(),
      delantal({ id: a.id, version: 2, oferta: { ...oferta, hasta: '2026-11-01' } }),
    );
    expect(alReves.estado === 'problemas' && alReves.problemas[0]?.campo).toBe('oferta.hasta');
    await guardarProducto(quien(), delantal({ id: a.id, version: 2, oferta: null }));
    expect((await leerProducto(quien(), a.id))?.oferta).toBe(null);
  });

  it('una dirección que usa otro producto no se toma', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    const r = await guardarProducto(
      quien(),
      delantal({ id: a.id, version: 1, slug: 'camisa-de-lino' }),
    );
    expect(r.estado === 'problemas' && r.problemas[0]?.campo).toBe('slug');
  });

  it('quitar una combinación la deja inactiva (un pedido viejo la nombra) y agregarla la trae de vuelta', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    const sinAzul = await guardarProducto(
      quien(),
      delantal({
        id: a.id,
        version: 1,
        variantes: [{ valores: ['Arena'], sku: 'DEL-AR', precioCop: 59000, stock: 3 }],
      }),
    );
    expect(sinAzul).toMatchObject({ estado: 'guardado', version: 2 });
    expect((await leerProducto(quien(), a.id))?.variantes).toHaveLength(1);
    const filas = await db
      .prepare(
        'SELECT clave, activa FROM variante WHERE org_id = ? AND producto_id = ? ORDER BY clave',
      )
      .bind(ORG, a.id)
      .all();
    expect(filas.results).toEqual([
      { clave: 'Arena', activa: 1 },
      { clave: 'Azul', activa: 0 },
    ]);
    await guardarProducto(quien(), delantal({ id: a.id, version: 2 }));
    expect((await leerProducto(quien(), a.id))?.variantes).toHaveLength(2);
  });

  it('dos combinaciones pueden intercambiar su SKU en una sola guardada', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    const r = await guardarProducto(
      quien(),
      delantal({
        id: a.id,
        version: 1,
        variantes: [
          { valores: ['Arena'], sku: 'DEL-AZ', precioCop: 59000, stock: 3 },
          { valores: ['Azul'], sku: 'DEL-AR', precioCop: 59000, stock: null },
        ],
      }),
    );
    expect(r).toMatchObject({ estado: 'guardado' });
    expect((await leerProducto(quien(), a.id))?.variantes.map((v) => v.sku)).toEqual([
      'DEL-AZ',
      'DEL-AR',
    ]);
  });

  it('un SKU de otro producto no se repite', async () => {
    await guardarProducto(quien(), delantal());
    const r = await guardarProducto(
      quien(),
      delantal({
        nombre: 'Otro',
        variantes: [{ valores: ['Arena'], sku: 'DEL-AR', precioCop: 1000, stock: 1 }],
      }),
    );
    expect(r.estado === 'problemas' && r.problemas[0]?.mensaje).toBe(
      'el SKU DEL-AR ya lo usa otro producto',
    );
  });

  it('las existencias no bajan de lo apartado en pedidos', async () => {
    await db
      .prepare("UPDATE variante SET reservado = 2 WHERE org_id = ? AND id = 'v-camisa-m-arena'")
      .bind(ORG)
      .run();
    const actual = await leerProducto(quien(), 'p-camisa');
    if (!actual) throw new Error('falta la camisa');
    const r = await guardarProducto(quien(), {
      op: op(),
      id: 'p-camisa',
      version: actual.version,
      nombre: actual.nombre,
      estado: 'activo',
      opciones: actual.opciones,
      variantes: actual.variantes.map((v) => ({
        ...v,
        stock: v.valores.join('|') === 'M|Arena' ? 1 : v.stock,
      })),
    });
    expect(r.estado === 'problemas' && r.problemas).toEqual([
      {
        campo: 'variantes.1.stock',
        mensaje: 'hay 2 apartadas en pedidos: las existencias no pueden bajar de ahí',
      },
    ]);
  });

  it('cambiar existencias deja su movimiento en el libro de inventario, con la operación', async () => {
    const actual = await leerProducto(quien(), 'p-camisa');
    if (!actual) throw new Error('falta la camisa');
    const o = op();
    await guardarProducto(quien(), {
      op: o,
      id: 'p-camisa',
      version: actual.version,
      nombre: actual.nombre,
      estado: 'activo',
      opciones: actual.opciones,
      variantes: actual.variantes.map((v) => ({
        ...v,
        stock: v.valores.join('|') === 'M|Arena' ? 6 : v.stock,
      })),
    });
    const mov = await db
      .prepare(
        'SELECT delta, stock_resultante, motivo, ref FROM movimiento_inventario WHERE org_id = ?',
      )
      .bind(ORG)
      .all();
    expect(mov.results).toEqual([
      { delta: 2, stock_resultante: 6, motivo: 'ajuste', ref: `op:${o}` },
    ]);
  });

  it('la papelera: borrar lo saca de la lista, restaurar lo trae; la otra tienda no lo ve', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    const b = await tocarElProducto(quien(), { op: op(), id: a.id, version: 1 }, 'borrar');
    expect(b).toMatchObject({ estado: 'guardado', version: 2 });
    expect((await listarProductos(quien())).productos.map((p) => p.id)).not.toContain(a.id);
    expect((await listarProductos(quien(), { papelera: true })).productos.map((p) => p.id)).toEqual(
      [a.id],
    );
    expect(
      await tocarElProducto(quien(), { op: op(), id: a.id, version: 2 }, 'borrar'),
    ).toMatchObject({
      estado: 'no-existe',
    });
    expect(
      await tocarElProducto(quien(), { op: op(), id: a.id, version: 2 }, 'restaurar'),
    ).toMatchObject({
      estado: 'guardado',
      version: 3,
    });
    expect(await leerProducto(quien(db, ENSAYO_DOS.org), a.id)).toBeNull();
  });

  it('CA1: la papelera guarda 30 días; después ya no se lista ni se restaura', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    await tocarElProducto(quien(), { op: op(), id: a.id, version: 1 }, 'borrar');
    const despues = (dias: number): Quien => ({
      ...quien(),
      instante: new Date(Date.parse(AHORA) + dias * 86_400_000).toISOString(),
    });
    expect(
      (await listarProductos(despues(29), { papelera: true })).productos.map((p) => p.id),
    ).toEqual([a.id]);
    expect((await listarProductos(despues(31), { papelera: true })).productos).toEqual([]);
    expect(
      await tocarElProducto(despues(31), { op: op(), id: a.id, version: 2 }, 'restaurar'),
    ).toMatchObject({
      estado: 'no-existe',
    });
  });

  it('cambiar el estado lo cuenta el registro como estado', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    await tocarElProducto(
      quien(),
      { op: op(), id: a.id, version: 1, estado: 'archivado' },
      'estado',
    );
    const ultima = (await registro()).at(-1);
    expect(ultima?.accion).toBe('producto.estado');
    expect(JSON.parse(ultima?.despues ?? '{}')).toMatchObject({ estado: 'archivado' });
  });

  it('el orden del catálogo', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    await ordenarProductos(quien(), { op: op(), ids: [a.id, 'p-camisa'] });
    expect((await listarProductos(quien())).productos.map((p) => p.id)).toEqual([a.id, 'p-camisa']);
  });
});

describe('HU-T8.4 · colecciones', () => {
  it('CA1: una colección con sus productos en orden; un producto puede estar en varias', async () => {
    const a = await guardarProducto(quien(), delantal());
    if (a.estado !== 'guardado') throw new Error(a.estado);
    await guardarLaColeccion(quien(), { op: op(), nombre: 'Lino', productos: [a.id, 'p-camisa'] });
    await guardarLaColeccion(quien(), { op: op(), nombre: 'Nuevos', productos: [a.id] });
    expect((await listarColecciones(quien())).map((c) => [c.slug, c.productos])).toEqual([
      ['lino', [a.id, 'p-camisa']],
      ['nuevos', [a.id]],
    ]);
  });

  it('CA2: borrar una colección no borra sus productos', async () => {
    const c = await guardarLaColeccion(quien(), {
      op: op(),
      nombre: 'Lino',
      productos: ['p-camisa'],
    });
    if (c.estado !== 'guardado') throw new Error(c.estado);
    const b = await borrarLaColeccion(quien(), { op: op(), id: c.id, version: 1 });
    expect(b).toMatchObject({ estado: 'guardado' });
    expect(await listarColecciones(quien())).toEqual([]);
    const camisa = await leerProducto(quien(), 'p-camisa');
    expect(camisa).toMatchObject({ estado: 'activo', enPapelera: false });
    expect(camisa?.variantes).toHaveLength(3);
  });

  it('una colección con un producto que no está no se guarda', async () => {
    const r = await guardarLaColeccion(quien(), {
      op: op(),
      nombre: 'Lino',
      productos: ['p-no-esta'],
    });
    expect(r).toEqual({
      estado: 'problemas',
      problemas: [{ campo: 'productos', mensaje: 'el producto p-no-esta no está' }],
    });
  });

  it('editar una colección con la versión vieja responde «cambiado»', async () => {
    const c = await guardarLaColeccion(quien(), { op: op(), nombre: 'Lino' });
    if (c.estado !== 'guardado') throw new Error(c.estado);
    await guardarLaColeccion(quien(), { op: op(), id: c.id, version: 1, nombre: 'Lino claro' });
    expect(
      await guardarLaColeccion(quien(), { op: op(), id: c.id, version: 1, nombre: 'Lino oscuro' }),
    ).toMatchObject({ estado: 'cambiado', version: 2 });
  });
});

describe('HU-T5.10 · destacado y nuevo', () => {
  it('se guardan, se leen y se apagan; sin decirlo, ninguno', async () => {
    const a = await guardarProducto(quien(), delantal({ destacado: true, nuevo: true }));
    if (a.estado !== 'guardado') throw new Error(a.estado);
    expect(await leerProducto(quien(), a.id)).toMatchObject({ destacado: true, nuevo: true });
    await guardarProducto(quien(), delantal({ id: a.id, version: 1, nuevo: false }));
    expect(await leerProducto(quien(), a.id)).toMatchObject({ destacado: false, nuevo: false });
    const b = await guardarProducto(quien(), {
      op: op(),
      nombre: 'Delantal corto',
      estado: 'activo',
      opciones: [],
      variantes: [{ valores: [], precioCop: 39000, stock: 2 }],
    });
    if (b.estado !== 'guardado') throw new Error(b.estado);
    expect(await leerProducto(quien(), b.id)).toMatchObject({ destacado: false, nuevo: false });
  });
});

describe('la oferta en la lista del panel', () => {
  const oferta = JSON.stringify({ porcentaje: 20, desde: '2026-11-01', hasta: '2026-11-03' });
  it('marca la que viene y la que rige; la que terminó o no se lee, no', () => {
    expect(ofertaEnLaLista(oferta, '2026-10-28T15:00:00.000Z')).toEqual({
      porcentaje: 20,
      desde: '2026-11-01',
      hasta: '2026-11-03',
      vigente: false,
    });
    expect(ofertaEnLaLista(oferta, '2026-11-02T15:00:00.000Z')?.vigente).toBe(true);
    // El último día dura hasta la medianoche de Colombia.
    expect(ofertaEnLaLista(oferta, '2026-11-04T04:59:00.000Z')?.vigente).toBe(true);
    expect(ofertaEnLaLista(oferta, '2026-11-04T05:00:00.000Z')).toBeNull();
    expect(ofertaEnLaLista('{"porcentaje":200}', '2026-11-02T15:00:00.000Z')).toBeNull();
    expect(ofertaEnLaLista(null, '2026-11-02T15:00:00.000Z')).toBeNull();
  });
});
