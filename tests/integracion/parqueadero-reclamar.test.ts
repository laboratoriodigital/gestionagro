/**
 * Entrar, reclamar y sumar cajas (HU-Q7.6, HU-Q7.7) y el respaldo frente a la nube (HU-Q7.9), con
 * la caja real contra la celda del parqueadero en memoria y un CORE falso que firma con la clave de
 * prueba de la celda. Lo que no imita (P17): Google, el CORE de verdad y la red.
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  abrir,
  type Entorno,
  T0,
  token,
  vaciarShard,
} from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import {
  abrirTurno,
  armarRespaldo,
  type Contexto,
  cotizar,
  guardarSede,
  guardarTarifa,
  RespaldoInvalido,
  registrarEntrada,
  registrarSalida,
  restaurar,
} from '../../apps/parqueadero-sitio/src/caja/almacen.ts';
import {
  canjear,
  cerrarSesionesDeLaCaja,
  compararConLaNube,
  destinoDeLaCaja,
  ErrorDeCuenta,
  retirarCaja,
  situacion,
  subirParqueadero,
  sumarCaja,
} from '../../apps/parqueadero-sitio/src/caja/cuenta.ts';
import { abrirBase, type BaseDeLaCaja } from '../../apps/parqueadero-sitio/src/caja/datos.ts';
import { crearNube } from '../../apps/parqueadero-sitio/src/caja/nube.ts';
import {
  aceptarTerminos,
  estadoDeLosTerminos,
  VERSION_DE_LOS_TERMINOS,
} from '../../apps/parqueadero-sitio/src/caja/terminos.ts';
import { contar, red } from './parqueadero-arnes.ts';

const CORE = 'https://core.ejemplo.test';
const API = 'https://parqueadero-api-c2.ejemplo.test';
const RESPALDO_020 = JSON.parse(
  readFileSync(new URL('../fixtures/parqueadero-respaldo-v0.2.0.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

let e: Entorno;
beforeAll(async () => {
  e = await abrir();
}, 60_000);
afterAll(async () => e?.cerrar());
beforeEach(async () => vaciarShard(e.db));

/**
 * El CORE falso: una cuenta, sus parqueaderos y los tokens v2 del producto, firmados con la clave
 * que la celda acepta. `fallarRenovacion` hace fallar las N renovaciones siguientes.
 */
function cuenta() {
  const orgs = new Map<string, string>();
  const creadas: string[] = [];
  /** Las sesiones del CORE, con la caja que las canjeó (`sesion.dispositivo`). */
  const sesiones: { id: string; dispositivo: string; revocada: boolean }[] = [];
  let fallarRenovacion = 0;
  const sesion = async (org: string | null) => ({
    acceso: await token(e, org ? { org } : { org: null, rol: null, celda: null, shard: null }),
    acceso_vence: T0 + 15 * 60_000,
    refresh: 'refresh-de-prueba',
    refresh_vence: T0 + 30 * 86_400_000,
    usuario: { nombre: 'Dueña de Ensayo', email: 'ensayo@ejemplo.test' },
    organizaciones: [...orgs].map(([org_id, nombre]) => ({ org_id, nombre, rol: 'propietario' })),
    org_id: org,
    url_api: org ? API : null,
  });
  const celda = red(e).fn;
  const fn = (async (url: string, init?: RequestInit) => {
    if (!url.startsWith(CORE)) return celda(url, init);
    const ruta = new URL(url).pathname;
    const cuerpo = JSON.parse(String(init?.body ?? '{}')) as Record<string, string>;
    if (ruta === '/api/core/auth/canje') {
      sesiones.push({ id: uuidv7(), dispositivo: cuerpo['dispositivo'] ?? '', revocada: false });
      return Response.json(await sesion(null));
    }
    if (ruta === '/api/core/telefonos/ver') {
      return Response.json({ telefonos: sesiones.filter((s) => !s.revocada) });
    }
    if (ruta === '/api/core/telefonos/retirar') {
      const s = sesiones.find((x) => x.id === cuerpo['id'] && !x.revocada);
      if (!s) return Response.json({ estado: 'no-encontrado' }, { status: 404 });
      s.revocada = true;
      return Response.json({ id: s.id, retirado: true });
    }
    if (ruta === '/api/core/organizaciones') {
      creadas.push(cuerpo['id'] as string);
      orgs.set(cuerpo['id'] as string, cuerpo['nombre'] as string);
      return Response.json({ org_id: cuerpo['id'] }, { status: 201 });
    }
    if (ruta === '/api/core/auth/refrescar') {
      if (fallarRenovacion > 0) {
        fallarRenovacion--;
        return Response.json({ motivo: 'El CORE está en pausa' }, { status: 503 });
      }
      const org = cuerpo['org_id'] ?? null;
      return Response.json(await sesion(org && orgs.has(org) ? org : null));
    }
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  return {
    fn,
    creadas,
    sesiones,
    fallar: (n: number) => {
      fallarRenovacion = n;
    },
  };
}

type Cuenta = ReturnType<typeof cuenta>;

/** Una caja con su reloj, que arranca en T0 como la celda. */
function telefono() {
  let ms = T0;
  const ahora = () => ms;
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  const db = abrirBase(`reclamar-${uuidv7()}`);
  return { db, ctx, ahora, avanzar: (min: number) => (ms += min * 60_000) };
}
type Telefono = ReturnType<typeof telefono>;

const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & Record<'id' | 'org_id' | 'version' | 'actualizado' | 'entidad', unknown>;
  return resto;
};

/** La caja del piloto: ajustes de Ensayo Uno, un turno y `n` vehículos que entran y salen. */
async function piloto(t: Telefono, n: number) {
  await guardarSede(t.db, sinMeta(SEDE_ENSAYO_UNO), null, t.ctx);
  await guardarTarifa(t.db, sinMeta(TARIFA_CARRO), null, t.ctx);
  await guardarTarifa(t.db, sinMeta(TARIFA_MOTO), null, t.ctx);
  await abrirTurno(t.db, { operador: 'Piloto', base: 50_000 }, t.ctx);
  for (let i = 0; i < n; i++) {
    const r = await entrar(t, `PIL${String(100 + i)}`);
    if (i % 2 === 0) {
      t.avanzar(20);
      const q = await cotizar(t.db, r.id, t.ctx.reloj(), false);
      await registrarSalida(
        t.db,
        r.id,
        {
          perdido: false,
          medio: 'efectivo',
          recibido: q.liquidacion.total + 1_000,
          motivoCortesia: null,
        },
        t.ctx,
        q.salida,
      );
    }
  }
}

const entrar = (t: Telefono, placa: string) =>
  registrarEntrada(
    t.db,
    { placa, vehiculo: 'carro', placaConfirmada: false, novedades: [], fotos: [] },
    t.ctx,
  );

/**
 * Las vueltas de la nube, como en la caja abierta, hasta que el reclamo deje de subir. Quien entró
 * aceptó antes los términos de la nube (HU-Q7.11): «Entrar con Google» no se toca sin eso.
 */
async function vueltas(t: Telefono, c: Cuenta, maximo = 8) {
  if ((await estadoDeLosTerminos(t.db)) === 'sin-aceptar') await aceptarTerminos(t.db, t.ahora);
  const nube = crearNube(t.db, { reloj: t.ahora, app: '0.3.0', core: CORE, fetchFn: c.fn });
  for (let i = 0; i < maximo; i++) {
    await nube.ahora();
    const r = await t.db.meta.get('reclamo');
    if ((await t.db.outbox.count()) === 0 && (r?.clave !== 'reclamo' || r.estado !== 'subiendo'))
      break;
  }
  nube.detener();
}

const reclamo = async (db: BaseDeLaCaja) => {
  const r = await db.meta.get('reclamo');
  return r?.clave === 'reclamo' ? r : null;
};

describe('HU-Q7.6 · entrar y reclamar lo de la caja del piloto', () => {
  it('sube con los mismos ids y números, la serie A sigue y queda verificado (CA2, CA3)', async () => {
    const t = telefono();
    const c = cuenta();
    await piloto(t, 30);
    const locales = await t.db.registros.count();
    // Sin cuenta, como en v0.2.x, nada se encola (P10).
    expect(await t.db.outbox.count()).toBe(0);

    await canjear(t.db, 'codigo-de-un-uso', CORE, { fetchFn: c.fn, ahora: t.ahora });
    expect(await situacion(t.db, await sesionDe(t.db))).toBe('para-subir');
    const r = await subirParqueadero(t.db, CORE, { fetchFn: c.fn, ahora: t.ahora });
    expect(r).toEqual({ serie: 'A', encoladas: 3 + locales });
    expect((await reclamo(t.db))?.estado).toBe('subiendo');

    await vueltas(t, c);
    expect(await t.db.outbox.count()).toBe(0);
    expect(await reclamo(t.db)).toMatchObject({
      estado: 'verificado',
      verificado: { registros: locales, catalogos: 3 },
    });
    expect(await contar(e, 'registro')).toBe(locales);
    expect(await contar(e, 'cuarentena')).toBe(0);
    // Cada recibo con su número de la caja, en el parqueadero que la cuenta creó.
    const org = c.creadas[0];
    const numeros = await e.db
      .prepare(
        "SELECT count(*) AS n, min(consecutivo) AS desde, max(consecutivo) AS hasta FROM registro WHERE serie = 'A' AND org_id = ?",
      )
      .bind(org)
      .first();
    expect(numeros).toEqual({ n: 45, desde: 1, hasta: 45 });
    // Lo nuevo después de reclamar sube solo, con el número siguiente.
    const nueva = await entrar(t, 'NUE001');
    expect(nueva.consecutivo).toBe(46);
    await vueltas(t, c);
    expect(await contar(e, 'registro')).toBe(locales + 1);
    expect((await t.db.meta.get('nube_al_dia'))?.clave).toBe('nube_al_dia');
  });

  it('un reclamo que se corta no crea otro parqueadero ni pierde nada al reintentar', async () => {
    const t = telefono();
    const c = cuenta();
    await piloto(t, 4);
    await canjear(t.db, 'codigo', CORE, { fetchFn: c.fn, ahora: t.ahora });
    // El parqueadero se crea, pero la renovación hacia él falla: nada queda a medias en la caja.
    c.fallar(1);
    await expect(subirParqueadero(t.db, CORE, { fetchFn: c.fn, ahora: t.ahora })).rejects.toThrow(
      ErrorDeCuenta,
    );
    expect((await t.db.meta.get('nube'))?.clave).toBeUndefined();
    expect(await t.db.outbox.count()).toBe(0);
    // El reintento pide el mismo id (`org_pendiente`): el CORE contesta «ya existía».
    await subirParqueadero(t.db, CORE, { fetchFn: c.fn, ahora: t.ahora });
    expect(new Set(c.creadas).size).toBe(1);
    // La caja se cerró después de vincularse y antes de encolar: la vuelta siguiente lo encola.
    await t.db.outbox.clear();
    const r = await reclamo(t.db);
    if (r) await t.db.meta.put({ ...r, encolado: false });
    await vueltas(t, c);
    expect((await reclamo(t.db))?.estado).toBe('verificado');
    expect(await contar(e, 'registro')).toBe(await t.db.registros.count());
  });

  it('P10 · un respaldo de v0.2.0 se restaura en un teléfono nuevo y se reclama entero', async () => {
    const t = telefono();
    const c = cuenta();
    const restaurado = await restaurar(t.db, RESPALDO_020);
    expect(restaurado.agregados).toBe(13); // 3 ajustes y 10 registros
    await canjear(t.db, 'codigo', CORE, { fetchFn: c.fn, ahora: t.ahora });
    const r = await subirParqueadero(t.db, CORE, { fetchFn: c.fn, ahora: t.ahora });
    expect(r.serie).toBe('A');
    await vueltas(t, c);
    expect((await reclamo(t.db))?.estado).toBe('verificado');
    const ids = (RESPALDO_020['tablas'] as { registro: { filas: { id: string }[] } }).registro.filas
      .map((f) => f.id)
      .sort();
    const enLaCelda = await e.db
      .prepare('SELECT id FROM registro ORDER BY id')
      .all<{ id: string }>();
    expect(enLaCelda.results.map((f) => f.id)).toEqual(ids);
  });

  it('CA4 ❌ · un archivo alterado, de otra sede o de una versión desconocida se rechaza entero y no toca nada', async () => {
    const t = telefono();
    const alterado = structuredClone(RESPALDO_020) as {
      tablas: { registro: { filas: { datos: { placa?: string } }[] } };
    };
    const fila = alterado.tablas.registro.filas[1];
    if (fila) fila.datos.placa = 'ZZZ999';
    await expect(restaurar(t.db, alterado)).rejects.toThrow(RespaldoInvalido);
    await expect(restaurar(t.db, { ...RESPALDO_020, version: 2 })).rejects.toThrow(
      RespaldoInvalido,
    );
    expect(await t.db.registros.count()).toBe(0);
    // Con otra sede ya en la caja.
    await guardarSede(t.db, sinMeta(SEDE_ENSAYO_UNO), null, t.ctx);
    await expect(restaurar(t.db, RESPALDO_020)).rejects.toThrow('otro parqueadero');
    expect(await t.db.registros.count()).toBe(0);
    expect(await t.db.outbox.count()).toBe(0);
  });
});

describe('HU-Q7.7 · sumar una caja vacía, retirar una caja', () => {
  /** La caja A reclamada y verificada, y la cuenta con su parqueadero. */
  async function parqueaderoConA() {
    const a = telefono();
    const c = cuenta();
    await piloto(a, 4);
    await canjear(a.db, 'codigo', CORE, { fetchFn: c.fn, ahora: a.ahora });
    await subirParqueadero(a.db, CORE, { fetchFn: c.fn, ahora: a.ahora });
    await vueltas(a, c);
    return { a, c, org: c.creadas[0] as string };
  }

  it('la caja vacía recibe la serie B, baja los ajustes y lo de la A, y numera desde 1 (CA1)', async () => {
    const { a, c, org } = await parqueaderoConA();
    const b = telefono();
    await canjear(b.db, 'codigo', CORE, { fetchFn: c.fn, ahora: b.ahora });
    expect(await situacion(b.db, await sesionDe(b.db))).toBe('para-sumar');
    expect(await sumarCaja(b.db, CORE, org, { fetchFn: c.fn, ahora: b.ahora })).toEqual({
      serie: 'B',
    });
    await vueltas(b, c);
    expect(await b.db.catalogos.count()).toBe(3);
    expect(await b.db.registros.count()).toBe(await a.db.registros.count());
    await abrirTurno(b.db, { operador: 'Caja B', base: 0 }, b.ctx);
    const r = await entrar(b, 'BBB111');
    expect(r).toMatchObject({ serie: 'B', consecutivo: 1 });
    await vueltas(b, c);
    expect(await contar(e, 'registro', "serie = 'B'")).toBe(1);
    // HU-Q7.9: la B, al día, tiene todo lo de la nube y su archivo lleva lo de las dos cajas.
    const frente = await compararConLaNube(b.db, { fetchFn: c.fn });
    expect(frente?.registros[0]).toBe(frente?.registros[1]);
    const archivo = await armarRespaldo(b.db, b.ctx, '0.3.0');
    const series = new Set(archivo.json.tablas.registro.filas.map((f) => f.serie));
    expect(series).toEqual(new Set(['A', 'B', null]));
  });

  it('❌ una caja con datos propios no se suma, y una segunda caja del piloto no reclama', async () => {
    const { c, org } = await parqueaderoConA();
    const otra = telefono();
    await piloto(otra, 2);
    await canjear(otra.db, 'codigo', CORE, { fetchFn: c.fn, ahora: otra.ahora });
    await expect(sumarCaja(otra.db, CORE, org, { fetchFn: c.fn })).rejects.toThrow('datos propios');
    await expect(subirParqueadero(otra.db, CORE, { fetchFn: c.fn })).rejects.toThrow(
      'ya tiene cajas en la nube',
    );
    expect((await otra.db.meta.get('nube'))?.clave).toBeUndefined();
  });

  it('CA2 y CA3 ❌ · la caja retirada no sube más, y lo suyo de antes sigue en la nube', async () => {
    const { a, c, org } = await parqueaderoConA();
    const b = telefono();
    await canjear(b.db, 'codigo', CORE, { fetchFn: c.fn, ahora: b.ahora });
    await sumarCaja(b.db, CORE, org, { fetchFn: c.fn, ahora: b.ahora });
    await vueltas(b, c);
    await abrirTurno(b.db, { operador: 'Caja B', base: 0 }, b.ctx);
    await vueltas(b, c);
    const antes = await contar(e, 'registro');
    const destinoA = await destinoDeLaCaja(a.db);
    const idB = (await destinoDeLaCaja(b.db))?.dispositivo;
    if (!destinoA || !idB) throw new Error('faltan las cajas');
    await retirarCaja(destinoA, idB, { fetchFn: c.fn });
    // Y su sesión de la cuenta se cierra: la de la A sigue abierta.
    expect(await cerrarSesionesDeLaCaja(a.db, CORE, idB, { fetchFn: c.fn })).toBe(1);
    expect(c.sesiones.filter((s) => s.revocada).map((s) => s.dispositivo)).toEqual([idB]);
    await entrar(b, 'ROB001');
    await vueltas(b, c, 2);
    // Lo nuevo se queda en la caja retirada, en su cola: nada se pierde, nada sube.
    expect(await b.db.outbox.count()).toBe(1);
    expect(await contar(e, 'registro')).toBe(antes);
    expect(await contar(e, 'registro', `dispositivo_id = '${idB}'`)).toBe(1); // su turno
  });
});

describe('HU-Q7.11 · los términos de la nube', () => {
  const terminosDe = (org: string, dispositivo: string) =>
    e.db
      .prepare(
        'SELECT terminos_version, terminos_aceptados FROM dispositivo WHERE org_id = ? AND id = ?',
      )
      .bind(org, dispositivo)
      .first();

  it('CA3 ❌ y CA1 · sin aceptarlos la caja no sube nada; aceptados, la celda guarda versión y hora', async () => {
    const t = telefono();
    const c = cuenta();
    await piloto(t, 2);
    await canjear(t.db, 'codigo', CORE, { fetchFn: c.fn, ahora: t.ahora });
    await subirParqueadero(t.db, CORE, { fetchFn: c.fn, ahora: t.ahora });
    const nube = crearNube(t.db, { reloj: t.ahora, app: '0.3.0', core: CORE, fetchFn: c.fn });
    expect(await nube.ahora()).toEqual({ tipo: 'sin-terminos' });
    nube.detener();
    expect(await contar(e, 'registro')).toBe(0);
    expect(await t.db.outbox.count()).toBeGreaterThan(0);

    t.avanzar(5);
    const cuando = new Date(t.ahora()).toISOString();
    await aceptarTerminos(t.db, t.ahora);
    expect(await estadoDeLosTerminos(t.db)).toBe('por-registrar');
    await vueltas(t, c);
    expect(await contar(e, 'registro')).toBe(await t.db.registros.count());
    expect(await estadoDeLosTerminos(t.db)).toBe('al-dia');
    const caja = await destinoDeLaCaja(t.db);
    expect(await terminosDe(c.creadas[0] as string, caja?.dispositivo ?? '')).toEqual({
      terminos_version: VERSION_DE_LOS_TERMINOS,
      terminos_aceptados: cuando,
    });
  });

  it('CA3 ❌ · con términos de una versión anterior la caja vuelve a la pausa', async () => {
    const t = telefono();
    const c = cuenta();
    await piloto(t, 1);
    await canjear(t.db, 'codigo', CORE, { fetchFn: c.fn, ahora: t.ahora });
    await subirParqueadero(t.db, CORE, { fetchFn: c.fn, ahora: t.ahora });
    await vueltas(t, c);
    await t.db.meta.put({ clave: 'terminos', version: '0', aceptados: T0, registrados: '0' });
    await entrar(t, 'VIE001');
    const nube = crearNube(t.db, { reloj: t.ahora, app: '0.3.0', core: CORE, fetchFn: c.fn });
    expect(await nube.ahora()).toEqual({ tipo: 'sin-terminos' });
    nube.detener();
    expect(await t.db.outbox.count()).toBe(1);
  });
});

async function sesionDe(db: BaseDeLaCaja) {
  const m = await db.meta.get('sesion');
  return m?.clave === 'sesion' ? m.sesion : null;
}
