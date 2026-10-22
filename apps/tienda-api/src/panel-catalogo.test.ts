/**
 * HU-T8.2, HU-T8.4 y HU-T10.6 por la API del panel: con tokens del CORE firmados de verdad, contra
 * el shard local con los dos comercios de prueba. La tienda sale del token; el rol, de la matriz.
 */
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { ENSAYO_DOS, ENSAYO_UNO, siembraDelShard } from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 15, 15);
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';

let shard: BaseD1;
let cerrar: () => Promise<void>;
let firmante: Firmante;

beforeAll(async () => {
  ({ db: shard, cerrar } = await baseLocal({
    configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
    binding: 'tienda_c1_s1',
    base: 'tienda',
  }));
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], new Date(T0).toISOString()))
    await shard.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
afterAll(async () => cerrar?.());

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  tienda_c1_s1: shard,
});

const token = async (extra: Partial<Parameters<typeof firmarAcceso>[1]> = {}) =>
  (
    await firmarAcceso(
      firmante,
      {
        sub: PERSONA,
        org: ENSAYO_UNO.org,
        rol: 'colaborador',
        celda: 'c1',
        shard: 'tienda_c1_s1',
        anillo: 1,
        aud: 'tienda',
        plan: 'pro',
        auth_time: Math.floor(T0 / 1000),
        ...extra,
      },
      T0,
      2,
    )
  ).token;

const pedir = async (ruta: string, cuerpo?: unknown, t?: string) =>
  crearApp({ ahora: () => T0 }).request(
    ruta,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${t ?? (await token())}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );

const gorra = (extra: Record<string, unknown> = {}) => ({
  op: `op-gorra-${Math.random().toString(36).slice(2, 12)}`,
  nombre: 'Gorra de lino',
  estado: 'activo',
  opciones: [],
  variantes: [{ valores: [], precioCop: 45000, stock: 5 }],
  ...extra,
});

describe('el catálogo por la API del panel', () => {
  it('HU-T8.2: crear, leer y listar un producto', async () => {
    const r = await pedir('/api/panel/v1/productos/guardar', gorra());
    expect(r.status).toBe(200);
    const { id } = (await r.json()) as { id: string };
    const p = await (await pedir(`/api/panel/v1/productos/${id}`)).json();
    expect(p).toMatchObject({ nombre: 'Gorra de lino', slug: 'gorra-de-lino', version: 1 });
    const lista = (await (await pedir('/api/panel/v1/productos?q=gorra')).json()) as {
      productos: { id: string; desde: number; existencias: number }[];
    };
    expect(lista.productos).toEqual([
      expect.objectContaining({ id, desde: 45000, existencias: 5 }),
    ]);
  });

  it('422 con los problemas por campo, 409 con la versión actual, 404 si no está', async () => {
    const malo = await pedir(
      '/api/panel/v1/productos/guardar',
      gorra({ variantes: [{ valores: [], precioCop: 0, stock: 1 }] }),
    );
    expect(malo.status).toBe(422);
    expect(await malo.json()).toMatchObject({ problemas: [{ campo: 'variantes.0.precioCop' }] });

    const { id } = (await (
      await pedir('/api/panel/v1/productos/guardar', gorra({ nombre: 'Gorra corta' }))
    ).json()) as { id: string };
    await pedir(
      '/api/panel/v1/productos/guardar',
      gorra({ id, version: 1, nombre: 'Gorra corta clara' }),
    );
    const tarde = await pedir(
      '/api/panel/v1/productos/guardar',
      gorra({ id, version: 1, nombre: 'Gorra corta oscura' }),
    );
    expect(tarde.status).toBe(409);
    expect(await tarde.json()).toMatchObject({ estado: 'cambiado', version: 2 });

    expect((await pedir('/api/panel/v1/productos/p-no-esta')).status).toBe(404);
    const noEsta = await pedir('/api/panel/v1/productos/borrar', {
      op: 'op-no-esta-01',
      id: 'p-no-esta',
      version: 1,
    });
    expect(noEsta.status).toBe(404);
  });

  it('❌ el token de Ensayo Dos no ve ni toca los productos de Ensayo Uno (P4)', async () => {
    const dos = await token({ org: ENSAYO_DOS.org });
    expect((await pedir('/api/panel/v1/productos/p-camisa', undefined, dos)).status).toBe(404);
    const r = await pedir(
      '/api/panel/v1/productos/borrar',
      { op: 'op-de-ensayo-dos', id: 'p-camisa', version: 1 },
      dos,
    );
    expect(r.status).toBe(404);
    expect((await (await pedir('/api/panel/v1/productos/p-camisa')).json()).enPapelera).toBe(false);
  });

  it('❌ un rol que no está en la matriz no edita el catálogo ni lee el registro', async () => {
    const ajeno = await token({ rol: 'cliente' });
    expect((await pedir('/api/panel/v1/productos', undefined, ajeno)).status).toBe(403);
    expect((await pedir('/api/panel/v1/productos/guardar', gorra(), ajeno)).status).toBe(403);
    expect((await pedir('/api/panel/v1/registro', undefined, ajeno)).status).toBe(403);
  });

  it('HU-T8.4: una colección por la API, y borrarla deja sus productos', async () => {
    const c = await pedir('/api/panel/v1/colecciones/guardar', {
      op: 'op-coleccion-01',
      nombre: 'Verano',
      productos: ['p-camisa'],
    });
    expect(c.status).toBe(200);
    const { id } = (await c.json()) as { id: string };
    const b = await pedir('/api/panel/v1/colecciones/borrar', {
      op: 'op-coleccion-02',
      id,
      version: 1,
    });
    expect(b.status).toBe(200);
    expect((await (await pedir('/api/panel/v1/colecciones')).json()).colecciones).toEqual([]);
    expect((await pedir('/api/panel/v1/productos/p-camisa')).status).toBe(200);
  });

  it('❌ HU-T10.6: la frase de una combinación la nombra, no dice «única»', async () => {
    const sombrero = (precioCop: number, extra: Record<string, unknown> = {}) =>
      gorra({
        nombre: 'Sombrero',
        opciones: [{ nombre: 'Color', valores: ['Arena', 'Azul'] }],
        variantes: [
          { valores: ['Arena'], precioCop, stock: 2 },
          { valores: ['Azul'], precioCop: 45000, stock: 2 },
        ],
        ...extra,
      });
    const { id } = (await (
      await pedir('/api/panel/v1/productos/guardar', sombrero(45000))
    ).json()) as { id: string };
    expect(
      (await pedir('/api/panel/v1/productos/guardar', sombrero(40000, { id, version: 1 }))).status,
    ).toBe(200);
    const { filas } = (await (await pedir('/api/panel/v1/registro')).json()) as {
      filas: { frase: string }[];
    };
    expect(filas.map((f) => f.frase)).toContain(
      'Tú cambiaste el precio de $45.000 a $40.000 de Arena en «Sombrero»',
    );
  });

  it('HU-T10.6: el registro cuenta en frases lo que pasó, y cada tienda ve solo el suyo', async () => {
    const r = await pedir('/api/panel/v1/registro');
    expect(r.status).toBe(200);
    const { filas } = (await r.json()) as { filas: { frase: string; instante: string }[] };
    expect(filas.map((f) => f.frase)).toContain('Tú creaste «Gorra de lino»');
    expect(filas.map((f) => f.frase)).toContain(
      'Tú borraste la colección «Verano»; sus productos siguen en la tienda',
    );
    const otra = await pedir(
      '/api/panel/v1/registro',
      undefined,
      await token({ org: ENSAYO_DOS.org }),
    );
    expect((await otra.json()).filas).toEqual([]);
    const ajena = await pedir(
      '/api/panel/v1/registro',
      undefined,
      await token({ sub: '0199e0a0-0000-7000-8000-0000000000d2' }),
    );
    expect(((await ajena.json()) as { filas: { frase: string }[] }).filas[0]?.frase).toMatch(
      /^Otra persona del equipo /,
    );
  });
});
