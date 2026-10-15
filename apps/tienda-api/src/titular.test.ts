/**
 * HU-T7.3: los derechos del titular y la conservación de los contactos, por la API del panel y la
 * purga diaria, sobre la base local. Ningún dato es de una persona real.
 */
import { importarKek } from '@ed1/cifrado';
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
import { cifrarContacto } from './bandeja.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { contandoParametros, TOPE_DE_PARAMETROS_D1 } from './parametros.fixture.ts';
import { purgarTienda } from './tareas.ts';
import { normalizarCelular } from './titular.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-titular';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000da';
const UNO = ENSAYO_UNO.org;
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 21)).toString('base64');
const CELULAR = '3001234567';
const OTRO = '3009876543';
const M_ARENA = 'v-camisa-m-arena';

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

let contado: ReturnType<typeof contandoParametros>;

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: contado.db,
  tienda_control: control,
});

type Rol = 'propietario' | 'colaborador';
const pedir = async (
  ruta: string,
  cuerpo?: unknown,
  o: { rol?: Rol; org?: string; entro?: number } = {},
) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: PERSONA,
      org: o.org ?? UNO,
      rol: o.rol ?? 'propietario',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'entrada',
      auth_time: Math.floor((o.entro ?? T0) / 1000),
    },
    T0,
    2,
  );
  return crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
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
};
let n = 0;
const op = () => `op-titular-${++n}-${'x'.repeat(8)}`;
const json = async (ruta: string, cuerpo?: unknown, o?: Parameters<typeof pedir>[2]) => {
  const r = await pedir(ruta, cuerpo, o);
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

const correr = (sql: string, ...v: unknown[]) =>
  shard
    .prepare(sql)
    .bind(...v)
    .run();
const filas = async <T = Record<string, unknown>>(sql: string, ...v: unknown[]) =>
  (
    await shard
      .prepare(sql)
      .bind(...v)
      .all<T>()
  ).results;

/**
 * Un pedido con su contacto escrito como antes de esta historia: sin índice. Así la búsqueda tiene
 * que abrirlo, compararlo e indexarlo.
 */
async function pedidoViejo(id: string, numero: number, estado: string, celular: string) {
  await correr(
    `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
       terminos_huella, aceptado, cambiado_por, creado, actualizado)
     VALUES (?, ?, ?, ?, ?, 'whatsapp', 'transferencia', 129000, 129000, ?, ?, 'comprador', ?, ?)`,
    UNO,
    id,
    `TT${numero}`,
    numero,
    estado,
    'a'.repeat(64),
    AHORA,
    '2026-03-01T15:00:00.000Z',
    AHORA,
  );
  await correr(
    `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones,
       precio_unitario_cop, cantidad, total_cop)
     VALUES (?, ?, 1, 'p-camisa', ?, 'Camisa de lino', 'Talla: M · Color: Arena', 129000, 1, 129000)`,
    UNO,
    id,
    M_ARENA,
  );
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  const contacto = {
    nombre: 'Ensayo Dos Compradora',
    celular,
    direccion: 'Calle de prueba 99',
    ciudad: 'Medellín',
  };
  const s = await cifrarContacto({ db: shard, org: UNO }, kek, id, contacto, AHORA);
  await correr(
    `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, creado, purgar_despues)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    UNO,
    id,
    s.sobre,
    s.iv,
    s.version,
    '2026-03-01T15:00:00.000Z',
    '2028-03-01T15:00:00.000Z',
  );
}

const contactoDe = async (pedido: string) =>
  (
    await filas<{ celular_indice: string | null; purgar_despues: string; creado: string }>(
      'SELECT celular_indice, purgar_despues, creado FROM pedido_contacto WHERE org_id = ? AND pedido_id = ?',
      UNO,
      pedido,
    )
  )[0];
const eventos = (pedido: string) =>
  filas<{ tipo: string; actor: string; detalle: string | null }>(
    'SELECT tipo, actor, detalle FROM pedido_evento WHERE org_id = ? AND pedido_id = ? ORDER BY id',
    UNO,
    pedido,
  );
const registro = (accion: string) =>
  filas<{ despues: string }>(
    'SELECT despues FROM registro WHERE org_id = ? AND accion = ? ORDER BY id',
    UNO,
    accion,
  );

let anotado = '';

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
  contado = contandoParametros(shard);
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
  const todas = [ENSAYO_UNO, ENSAYO_DOS];
  for (const sql of siembraDelShard(todas, AHORA)) await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl(todas, 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());

  await pedidoViejo('ped-tit-entregado', 2001, 'entregado', `+57 ${CELULAR}`);
  await pedidoViejo('ped-tit-otro', 2002, 'entregado', OTRO);
  await pedidoViejo('ped-tit-cancelado', 2003, 'cancelado', CELULAR);
});

afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('el celular, como lo escribe la gente', () => {
  it('con o sin +57, espacios o guiones; lo que no es un celular de Colombia no se busca', () => {
    expect(normalizarCelular('300 123 4567')).toBe(CELULAR);
    expect(normalizarCelular('+57 300-123-4567')).toBe(CELULAR);
    expect(normalizarCelular('573001234567')).toBe(CELULAR);
    expect(normalizarCelular('6041234567')).toBeNull();
    expect(normalizarCelular('30012345')).toBeNull();
  });
});

describe('HU-T7.3 · CA2: el contacto nace con su índice y su plazo', () => {
  it('un pedido anotado guarda el índice ciego del celular, nunca el celular, y vence a los 24 meses', async () => {
    const r = await json('pedidos/anotar', {
      op: op(),
      lineas: [{ variante: M_ARENA, cantidad: 1 }],
      formaPago: 'efectivo',
      contacto: { nombre: 'Ensayo Dos Compradora', celular: '300 123 4567', ciudad: 'Medellín' },
    });
    expect(r.status).toBe(200);
    anotado = r.cuerpo['id'] as string;
    const c = await contactoDe(anotado);
    expect(c?.celular_indice).toMatch(/^[0-9a-f]{32}$/);
    expect(c?.celular_indice).not.toContain(CELULAR);
    expect(c?.purgar_despues).toBe('2028-10-15T15:00:00.000Z');
  });
});

describe('HU-T7.3 · CA1: buscar, descargar, corregir y suprimir por el celular', () => {
  it('buscar encuentra los pedidos de ese celular, indexa los viejos y saca al comprador tapado', async () => {
    expect((await contactoDe('ped-tit-entregado'))?.celular_indice).toBeNull();
    const r = await json('titular/buscar', { celular: '300 123 4567' });
    expect(r.status).toBe(200);
    const pedidos = r.cuerpo['pedidos'] as { id: string; terminado: boolean }[];
    expect(pedidos.map((p) => p.id).sort()).toEqual(
      [anotado, 'ped-tit-cancelado', 'ped-tit-entregado'].sort(),
    );
    expect(r.cuerpo['comprador']).toEqual({ nombre: 'Ensayo D.', celular: '300 ••• 4567' });
    const texto = JSON.stringify(r.cuerpo);
    expect(texto).not.toContain('Compradora');
    expect(texto).not.toContain(CELULAR);
    expect(texto).not.toContain('Calle de prueba 99');
    // El viejo quedó indexado, con el mismo índice que el nuevo; el de otro celular, con el suyo.
    const viejo = await contactoDe('ped-tit-entregado');
    expect(viejo?.celular_indice).toBe((await contactoDe(anotado))?.celular_indice);
    expect((await contactoDe('ped-tit-otro'))?.celular_indice).not.toBe(viejo?.celular_indice);
    // Queda en el registro, sin el celular.
    const [fila] = await registro('titular.buscar');
    expect(JSON.parse(fila?.despues ?? '{}')).toEqual({ pedidos: 3 });
    expect(fila?.despues).not.toContain(CELULAR);
  });

  it('un celular que no es de Colombia no se busca', async () => {
    const r = await json('titular/buscar', { celular: '12345' });
    expect(r.status).toBe(422);
    expect(r.cuerpo).toMatchObject({ estado: 'problemas', problemas: [{ campo: 'celular' }] });
  });

  it('descargar trae los datos en claro y cada pedido dice que se leyeron', async () => {
    const r = await json('titular/exportar', { celular: CELULAR });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ formato: 'titular/1', exportada: AHORA });
    const pedidos = r.cuerpo['pedidos'] as { numero: number; contacto: { nombre: string } }[];
    expect(pedidos).toHaveLength(3);
    expect(pedidos.find((p) => p.numero === 2001)?.contacto).toEqual({
      nombre: 'Ensayo Dos Compradora',
      celular: `+57 ${CELULAR}`,
      direccion: 'Calle de prueba 99',
      ciudad: 'Medellín',
    });
    expect(await eventos('ped-tit-entregado')).toContainEqual({
      tipo: 'contacto_leido',
      actor: `usuario:${PERSONA}`,
      detalle: '{"para":"titular"}',
    });
    expect(await eventos('ped-tit-otro')).toEqual([]);
    expect(JSON.parse((await registro('titular.exportar'))[0]?.despues ?? '{}')).toEqual({
      pedidos: 3,
    });
  });

  it('corregir cambia lo escrito en todos sus pedidos y deja lo demás como estaba', async () => {
    const cuerpo = { op: op(), celular: CELULAR, contacto: { direccion: 'Calle de prueba 100' } };
    const r = await json('titular/corregir', cuerpo);
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ estado: 'guardado', pedidos: 3, enCurso: 0 });
    // Repetir la operación no corrige otra vez.
    expect((await json('titular/corregir', cuerpo)).cuerpo).toEqual(r.cuerpo);
    expect(
      (await eventos('ped-tit-entregado')).filter((e) => e.tipo === 'contacto_corregido'),
    ).toHaveLength(1);
    const datos = await json('titular/exportar', { celular: CELULAR });
    for (const p of datos.cuerpo['pedidos'] as { contacto: Record<string, string> }[]) {
      expect(p.contacto['direccion']).toBe('Calle de prueba 100');
      expect(p.contacto['nombre']).toBe('Ensayo Dos Compradora');
    }
    expect(JSON.parse((await registro('titular.corregir'))[0]?.despues ?? '{}')).toEqual({
      pedidos: 3,
      campos: ['direccion'],
    });
  });

  it('❌ corregir sin nada que corregir, o con un celular nuevo que no es de Colombia, no cambia nada', async () => {
    expect(
      (await json('titular/corregir', { op: op(), celular: CELULAR, contacto: {} })).status,
    ).toBe(422);
    const r = await json('titular/corregir', {
      op: op(),
      celular: CELULAR,
      contacto: { celular: '123' },
    });
    expect(r.cuerpo).toMatchObject({ problemas: [{ campo: 'contacto.celular' }] });
  });

  it('corregir el celular mueve los pedidos a su índice nuevo', async () => {
    const nuevo = '3005550101';
    await json('titular/corregir', { op: op(), celular: CELULAR, contacto: { celular: nuevo } });
    expect(
      ((await json('titular/buscar', { celular: CELULAR })).cuerpo['pedidos'] as []).length,
    ).toBe(0);
    expect(
      ((await json('titular/buscar', { celular: nuevo })).cuerpo['pedidos'] as []).length,
    ).toBe(3);
    await json('titular/corregir', { op: op(), celular: nuevo, contacto: { celular: CELULAR } });
  });

  it('CA3 · suprimir borra el contacto de los terminados, deja el pedido y su historia, y espera al que está en curso', async () => {
    const lineasAntes = await filas(
      'SELECT * FROM pedido_linea WHERE org_id = ? AND pedido_id = ?',
      UNO,
      'ped-tit-entregado',
    );
    const r = await json('titular/suprimir', { op: op(), celular: CELULAR });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toEqual({ estado: 'guardado', pedidos: 2, enCurso: 1 });
    expect(await contactoDe('ped-tit-entregado')).toBeUndefined();
    expect(await contactoDe('ped-tit-cancelado')).toBeUndefined();
    expect(await contactoDe(anotado)).toBeDefined();
    expect(await contactoDe('ped-tit-otro')).toBeDefined();
    // El pedido sigue, con sus líneas y su historia; la historia dice que el contacto se fue.
    const [p] = await filas<{ estado: string; total_cop: number }>(
      'SELECT estado, total_cop FROM pedido WHERE org_id = ? AND id = ?',
      UNO,
      'ped-tit-entregado',
    );
    expect(p).toEqual({ estado: 'entregado', total_cop: 129000 });
    expect(
      await filas(
        'SELECT * FROM pedido_linea WHERE org_id = ? AND pedido_id = ?',
        UNO,
        'ped-tit-entregado',
      ),
    ).toEqual(lineasAntes);
    const historia = await eventos('ped-tit-entregado');
    expect(historia.map((e) => e.tipo)).toEqual(
      expect.arrayContaining(['contacto_leido', 'contacto_corregido', 'contacto_suprimido']),
    );
    expect(JSON.parse((await registro('titular.suprimir'))[0]?.despues ?? '{}')).toEqual({
      pedidos: 2,
      enCurso: 1,
    });
    // Lo que queda de ese celular es el pedido en curso.
    const despues = await json('titular/buscar', { celular: CELULAR });
    expect((despues.cuerpo['pedidos'] as { id: string }[]).map((x) => x.id)).toEqual([anotado]);
  });
});

describe('HU-T7.3 · CA3 ❌: solo el propietario, recién entrado, y solo su tienda', () => {
  const rutas = ['buscar', 'exportar', 'corregir', 'suprimir'] as const;

  it.each(rutas)('un colaborador no puede %s: 403', async (ruta) => {
    const r = await json(
      `titular/${ruta}`,
      { op: op(), celular: CELULAR, contacto: { direccion: 'x' } },
      { rol: 'colaborador' },
    );
    expect(r.status).toBe(403);
    expect(r.cuerpo['estado']).toBe('prohibido');
  });

  it.each(rutas)(
    'el propietario que entró hace más de 10 minutos vuelve a entrar para %s',
    async (ruta) => {
      const r = await json(
        `titular/${ruta}`,
        { op: op(), celular: CELULAR },
        { entro: T0 - 11 * 60_000 },
      );
      expect(r.status).toBe(401);
      expect(r.cuerpo['estado']).toBe('reautenticar');
    },
  );

  it('la tienda Dos no encuentra a los compradores de la Uno', async () => {
    const r = await json('titular/buscar', { celular: OTRO }, { org: ENSAYO_DOS.org });
    expect(r.status).toBe(200);
    expect(r.cuerpo['pedidos']).toEqual([]);
  });
});

describe('HU-T7.3 · CA2: el plazo se ajusta de 12 a 60 meses y la purga diaria lo cumple', () => {
  const legal = async () => {
    const r = await json('ajustes');
    return (
      r.cuerpo['secciones'] as Record<string, { datos: Record<string, unknown>; version: number }>
    )['legal'] as { datos: Record<string, unknown>; version: number };
  };
  const guardar = async (meses: number | undefined, o?: Parameters<typeof pedir>[2]) => {
    const l = await legal();
    const datos = { ...l.datos };
    if (meses === undefined) delete datos['conservacionMeses'];
    else datos['conservacionMeses'] = meses;
    return json('ajustes/guardar', { op: op(), seccion: 'legal', version: l.version, datos }, o);
  };

  it('❌ fuera de 12 a 60 no se guarda, y un colaborador no lo cambia', async () => {
    expect((await guardar(6)).cuerpo).toMatchObject({
      problemas: [{ campo: 'legal.conservacionMeses' }],
    });
    expect((await guardar(61)).status).toBe(422);
    const r = await guardar(36, { rol: 'colaborador' });
    expect(r.status).toBe(403);
  });

  it('bajarlo a 12 acorta los contactos que ya están; subirlo a 36 no alarga los viejos y vale para los nuevos', async () => {
    expect((await guardar(12)).status).toBe(200);
    expect((await contactoDe('ped-tit-otro'))?.purgar_despues).toBe('2027-03-01T15:00:00.000Z');
    expect((await contactoDe(anotado))?.purgar_despues).toBe('2027-10-15T15:00:00.000Z');
    expect((await guardar(36)).status).toBe(200);
    expect((await contactoDe('ped-tit-otro'))?.purgar_despues).toBe('2027-03-01T15:00:00.000Z');
    const r = await json('pedidos/anotar', {
      op: op(),
      lineas: [{ variante: M_ARENA, cantidad: 1 }],
      formaPago: 'efectivo',
      contacto: { nombre: 'Ensayo Tres', celular: OTRO },
    });
    expect((await contactoDe(r.cuerpo['id'] as string))?.purgar_despues).toBe(
      '2029-10-15T15:00:00.000Z',
    );
    // Sin el campo, vuelve a los 24 de fábrica para lo que llegue.
    expect((await guardar(undefined)).status).toBe(200);
  });

  it('la purga diaria se lleva los vencidos, deja el pedido y lo dice en su historia; la tienda Dos no se toca', async () => {
    const vence = '2027-03-01T15:00:00.000Z';
    const antesDos = await filas(
      'SELECT count(*) AS n FROM pedido_contacto WHERE org_id = ?',
      ENSAYO_DOS.org,
    );
    const r = await purgarTienda(shard, UNO, AHORA, AHORA, vence);
    expect(r.contactos).toBe(1);
    expect(await contactoDe('ped-tit-otro')).toBeUndefined();
    expect(await contactoDe(anotado)).toBeDefined();
    expect(
      await filas('SELECT id FROM pedido WHERE org_id = ? AND id = ?', UNO, 'ped-tit-otro'),
    ).toHaveLength(1);
    expect(await eventos('ped-tit-otro')).toContainEqual({
      tipo: 'contacto_suprimido',
      actor: 'sistema',
      detalle: '{"por":"plazo"}',
    });
    expect(
      await filas('SELECT count(*) AS n FROM pedido_contacto WHERE org_id = ?', ENSAYO_DOS.org),
    ).toEqual(antesDos);
  });
});

describe('HU-T7.3 · un comprador con muchos pedidos', () => {
  it('120 pedidos se encuentran todos, sin pasar de 100 parámetros en ninguna consulta (D1)', async () => {
    const celular = '3001112233';
    for (let i = 0; i < 120; i++)
      await pedidoViejo(`ped-muchos-${i}`, 3000 + i, 'entregado', celular);
    contado.reiniciar();
    const r = await json('titular/buscar', { celular });
    expect((r.cuerpo['pedidos'] as []).length).toBe(120);
    const s = await json('titular/suprimir', { op: op(), celular });
    expect(s.cuerpo).toEqual({ estado: 'guardado', pedidos: 120, enCurso: 0 });
    expect(contado.mas()).toBeGreaterThan(0);
    expect(contado.mas()).toBeLessThanOrEqual(TOPE_DE_PARAMETROS_D1);
  });
});
