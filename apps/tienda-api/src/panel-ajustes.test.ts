/**
 * HU-T10.3 por la API del panel: los ajustes por sección, con tokens del CORE firmados de verdad
 * (con su `auth_time`), contra el shard y la base de control locales con los dos comercios de
 * prueba. Ningún dato es de una persona real.
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
import { type Almacen, publicar } from './publicar.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-despacho';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d1';
const UNO = ENSAYO_UNO.org;
/** Entró hace una hora: no alcanza para lo que mueve la plata (CA2). */
const HACE_UNA_HORA = Math.floor(T0 / 1000) - 3600;
const CUENTA = '123-4567890';

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
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 60_000);
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

type Rol = 'propietario' | 'colaborador';
const token = async (rol: Rol, authTime = Math.floor(T0 / 1000)) =>
  (
    await firmarAcceso(
      firmante,
      {
        sub: PERSONA,
        org: UNO,
        rol,
        celda: 'c1',
        shard: 'tienda_c1_s1',
        anillo: 1,
        aud: 'tienda',
        plan: 'entrada',
        auth_time: authTime,
      },
      T0,
      2,
    )
  ).token;

const pedir = async (ruta: string, cuerpo?: unknown, t?: string) => {
  const r = await crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${t ?? (await token('propietario'))}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
  return r;
};

interface Ajustes {
  secciones: Record<string, { datos: Record<string, unknown>; version: number }>;
  faltantes: string[];
}
const leer = async (t?: string) => (await (await pedir('ajustes', undefined, t)).json()) as Ajustes;
const seccion = async (s: string) => (await leer()).secciones[s] ?? { datos: {}, version: 0 };

let ops = 0;
const op = () => `op-ajustes-${++ops}`.padEnd(12, '0');
const guardar = async (s: string, datos: Record<string, unknown>, t?: string, version?: number) =>
  pedir(
    'ajustes/guardar',
    { op: op(), seccion: s, version: version ?? (await seccion(s)).version, datos },
    t,
  );

const frases = async () =>
  (
    (await (await pedir('registro')).json()) as {
      filas: { frase: string }[];
    }
  ).filas.map((f) => f.frase);

describe('los ajustes por sección (HU-T10.3)', () => {
  it('CA1: las 9 secciones, cada una con su versión; cobro solo para el propietario', async () => {
    const p = await leer();
    expect(Object.keys(p.secciones).sort()).toEqual(
      [
        'agentes',
        'apariencia',
        'avisos',
        'cobro',
        'contacto',
        'identidad',
        'legal',
        'medicion',
        'venta',
      ].sort(),
    );
    expect(p.secciones['identidad']).toMatchObject({ version: 1 });
    expect(p.secciones['medicion']).toEqual({ datos: {}, version: 0 });
    expect(p.faltantes).toEqual([]);
    const c = await leer(await token('colaborador'));
    expect(Object.keys(c.secciones)).not.toContain('cobro');
  });

  it('❌ CA1: guardar lleva la versión; si alguien guardó antes, 409 con la de ahora', async () => {
    const r = await guardar('identidad', { nombre: 'Comercio Ensayo Uno', frase: 'Lino nuevo.' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ estado: 'guardado', version: 2 });
    const tarde = await guardar('identidad', { nombre: 'Otro nombre' }, undefined, 1);
    expect(tarde.status).toBe(409);
    expect(await tarde.json()).toMatchObject({ estado: 'cambiado', version: 2 });
    expect((await seccion('identidad')).datos).toEqual({
      nombre: 'Comercio Ensayo Uno',
      frase: 'Lino nuevo.',
    });

    // Una sección que no existía nace con la versión 0, y solo una vez.
    const nueva = await guardar('medicion', { ga4: 'G-ENSAYO1' }, undefined, 0);
    expect(await nueva.json()).toMatchObject({ estado: 'guardado', version: 1 });
    const otra = await guardar('medicion', { ga4: 'G-ENSAYO2' }, undefined, 0);
    expect(otra.status).toBe(409);
    expect((await seccion('medicion')).datos).toEqual({ ga4: 'G-ENSAYO1' });
    expect(await frases()).toContain('Tú cambiaste los ajustes de Medición');
  });

  it('la misma operación dos veces se aplica una vez', async () => {
    const { version } = await seccion('avisos');
    const cuerpo = { op: op(), seccion: 'avisos', version, datos: { hora: '07:30' } };
    const a = await (await pedir('ajustes/guardar', cuerpo)).json();
    const b = await (await pedir('ajustes/guardar', cuerpo)).json();
    expect(b).toEqual(a);
    expect((await seccion('avisos')).version).toBe(version + 1);
  });

  it('un dato que no vale dice cuál, con su campo', async () => {
    const r = await guardar('contacto', { whatsapp: '12345' });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({
      estado: 'problemas',
      problemas: [{ campo: 'contacto.whatsapp' }],
    });
  });

  it('❌ CA2: el WhatsApp, el modo y el cobro piden haber entrado hace poco; el horario no', async () => {
    const vieja = await token('propietario', HACE_UNA_HORA);
    const antes = await seccion('contacto');

    const w = await guardar('contacto', { ...antes.datos, whatsapp: '+573009998877' }, vieja);
    expect(w.status).toBe(401);
    expect(await w.json()).toMatchObject({ estado: 'reautenticar' });
    expect(await seccion('contacto')).toEqual(antes);

    const h = await guardar('contacto', { ...antes.datos, horario: 'Lunes a sábado' }, vieja);
    expect(h.status).toBe(200);

    const venta = await seccion('venta');
    const m = await guardar('venta', { ...venta.datos, modo: 'ambos' }, vieja);
    expect(m.status).toBe(401);
    expect((await seccion('venta')).datos['modo']).toBe('whatsapp');

    const transferencia = {
      banco: 'Banco Ensayo',
      tipoCuenta: 'ahorros',
      numero: CUENTA,
      titular: 'Comercio Ensayo Uno',
      documento: '900000001-1',
    };
    const cobro = await guardar('cobro', { transferencia }, vieja);
    expect(cobro.status).toBe(401);
    expect((await seccion('cobro')).version).toBe(0);
    expect((await guardar('cobro', { transferencia })).status).toBe(200);
  });

  it('❌ CA2: el colaborador no cambia el modo ni el cobro, aunque haya entrado hace poco', async () => {
    const colaborador = await token('colaborador');
    const venta = await seccion('venta');
    const m = await guardar('venta', { ...venta.datos, modo: 'ambos' }, colaborador);
    expect(m.status).toBe(403);
    expect(await m.json()).toMatchObject({ estado: 'prohibido' });
    const c = await guardar('cobro', { ambiente: 'pruebas' }, colaborador);
    expect(c.status).toBe(403);
    // Lo demás de la venta sí.
    const min = await guardar('venta', { ...venta.datos, pedidoMinimoCop: 30000 }, colaborador);
    expect(min.status).toBe(200);
  });

  it('❌ CA3: un WhatsApp nuevo queda sin verificar hasta que el comercio lo confirma', async () => {
    const antes = await seccion('contacto');
    expect(antes.datos['whatsappVerificado']).toBe(true);
    // El formulario no puede decir que está verificado: lo dice el sistema.
    const r = await guardar('contacto', {
      ...antes.datos,
      whatsapp: '+573009998877',
      whatsappVerificado: true,
    });
    expect(r.status).toBe(200);
    const sin = await leer();
    expect(sin.secciones['contacto']?.datos).toMatchObject({
      whatsapp: '+573009998877',
      whatsappVerificado: false,
    });
    expect(sin.faltantes).toEqual(['contacto.whatsappVerificado']);

    // Guardar otra cosa no lo verifica.
    const otra = await seccion('contacto');
    await guardar('contacto', { ...otra.datos, horario: 'Todos los días' });
    expect((await seccion('contacto')).datos['whatsappVerificado']).toBe(false);

    const v = await pedir('ajustes/verificar-whatsapp', {
      op: op(),
      version: (await seccion('contacto')).version,
    });
    expect(v.status).toBe(200);
    const con = await leer();
    expect(con.secciones['contacto']?.datos['whatsappVerificado']).toBe(true);
    expect(con.faltantes).toEqual([]);

    // Guardar con el mismo número lo deja verificado.
    const ya = await seccion('contacto');
    await guardar('contacto', { ...ya.datos, horario: 'De 8 a 6' });
    expect((await seccion('contacto')).datos['whatsappVerificado']).toBe(true);
    expect(await frases()).toContain('Tú verificaste el WhatsApp de la tienda');
  });

  it('❌ CA4: lo vacío no se guarda, y la compuerta no publica sin lo obligatorio', async () => {
    const legal = await seccion('legal');
    const r = await guardar('legal', { ...legal.datos, razonSocial: '  ', ciudad: '' });
    expect(r.status).toBe(200);
    const despues = await leer();
    expect(despues.secciones['legal']?.datos).not.toHaveProperty('razonSocial');
    expect(despues.secciones['legal']?.datos).not.toHaveProperty('ciudad');
    expect(despues.faltantes).toEqual(['legal.razonSocial', 'legal.ciudad']);

    const objetos = new Map<string, string>();
    const sitios: Almacen = {
      get: async (k) => {
        const t = objetos.get(k);
        return t === undefined ? null : { text: async () => t };
      },
      put: async (k, v) => void objetos.set(k, v),
    };
    const p = await publicar({
      shard,
      shardNombre: 'tienda_c1_s1',
      control,
      sitios,
      hosts: { put: async () => undefined },
      celda: 'c1',
      release: 'r1',
      org: UNO,
      pedidaPor: 'usuario:prueba',
      ahora: AHORA,
      omitir: ['sin-foto'],
    });
    expect(p).toMatchObject({ estado: 'compuerta' });
    const fallas = (p as { fallas: { codigo: string }[] }).fallas;
    expect(fallas.filter((f) => f.codigo === 'dato-faltante')).toHaveLength(2);
  });

  it('❌ los datos de la transferencia no salen en el registro ni para el colaborador', async () => {
    const { results } = await shard
      .prepare('SELECT antes, despues FROM registro WHERE org_id = ?')
      .bind(UNO)
      .all<{ antes: string | null; despues: string | null }>();
    expect(results.length).toBeGreaterThan(0);
    for (const f of results) expect(`${f.antes}${f.despues}`).not.toContain(CUENTA);
    const colaborador = JSON.stringify(await leer(await token('colaborador')));
    expect(colaborador).not.toContain(CUENTA);
    expect(JSON.stringify(await leer())).toContain(CUENTA); // el propietario sí lo ve
  });
});
