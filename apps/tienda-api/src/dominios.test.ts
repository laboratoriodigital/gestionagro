/**
 * HU-T13.1 a HU-T13.3: el dominio propio sobre la base local, con un Cloudflare for SaaS de mentira
 * que guarda sus hostnames como lo haría la API de verdad. Ningún dominio es real: los de prueba
 * terminan en `.example`, que nadie puede registrar.
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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  conectarDominio,
  elegirCanonico,
  listarDominios,
  type QuienDelDominio,
  retirarDominio,
  revisarDominios,
} from './dominios.ts';
import { estadoDe, type HostnameEnCloudflare, type Saas } from './saas.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const AHORA = '2026-10-20T15:00:00.000Z';
const UNO = ENSAYO_UNO.org;
const DOS = ENSAYO_DOS.org;
const PLATAFORMA_UNO = hostDeStaging(ENSAYO_UNO.slug);

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

/** Cloudflare for SaaS de mentira: crea, lee y borra hostnames; `activar` hace lo que haría el DNS. */
function cloudflare() {
  const hostnames = new Map<string, HostnameEnCloudflare>();
  const duplicados = new Set<string>();
  const pedidos: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
  let n = 0;
  const ok = (result: unknown) => new Response(JSON.stringify({ success: true, result }));
  const fetch = async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(String(init.body)) : null;
    pedidos.push({ metodo, ruta: `${u.pathname}${u.search}`, cuerpo });
    if (u.pathname === '/client/v4/zones')
      return ok([{ id: 'zona-1', name: u.searchParams.get('name') }]);
    const m = /^\/client\/v4\/zones\/zona-1\/custom_hostnames(?:\/(.+))?$/.exec(u.pathname);
    if (!m) return new Response('{}', { status: 404 });
    if (metodo === 'POST') {
      const h = (cuerpo as { hostname: string }).hostname;
      if (duplicados.has(h)) {
        return new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 1406, message: 'Duplicate custom hostname found.' }],
          }),
          { status: 409 },
        );
      }
      const id = `ch-${++n}`;
      const nuevo: HostnameEnCloudflare = {
        id,
        hostname: h,
        status: 'pending',
        ssl: {
          status: 'pending_validation',
          validation_records: [{ txt_name: `_acme-challenge.${h}`, txt_value: `acme-${n}` }],
        },
        ownership_verification: {
          type: 'txt',
          name: `_cf-custom-hostname.${h}`,
          value: `propiedad-${n}`,
        },
      };
      hostnames.set(id, nuevo);
      return ok(nuevo);
    }
    const id = decodeURIComponent(m[1] ?? '');
    const h = hostnames.get(id);
    if (!h)
      return new Response(JSON.stringify({ success: false, errors: [{ code: 1436 }] }), {
        status: 404,
      });
    if (metodo === 'DELETE') {
      hostnames.delete(id);
      return ok({ id });
    }
    return ok(h);
  };
  const cambiar = (hostname: string, status: string, ssl: string) => {
    for (const h of hostnames.values())
      if (h.hostname === hostname) Object.assign(h, { status, ssl: { ...h.ssl, status: ssl } });
  };
  return {
    saas: { token: 'token-de-prueba-saas', zona: 'laboratorio-digital.app', fetch } satisfies Saas,
    hostnames,
    duplicados,
    pedidos,
    validando: (h: string) => cambiar(h, 'pending', 'pending_issuance'),
    activar: (h: string) => cambiar(h, 'active', 'active'),
  };
}

function kv() {
  const datos = new Map<string, string>();
  return {
    datos,
    put: async (k: string, v: string) => void datos.set(k, v),
    delete: async (k: string) => void datos.delete(k),
    get: async (k: string) => datos.get(k) ?? null,
  };
}

let n = 0;
const op = () => `op-dominio-${++n}-${'x'.repeat(6)}`;
let hosts = kv();
const quien = (org = UNO): QuienDelDominio & { plan: string } => ({
  plan: 'entrada',
  db: shard,
  org,
  actor: 'usuario:0199e0a0-0000-7000-8000-0000000000aa',
  instante: AHORA,
  control,
  celda: 'c1',
  shardNombre: 'tienda_c1_s1',
  hosts,
});

const filaDe = (hostname: string) =>
  control
    .prepare('SELECT org_id, tipo, rol, estado, cf_hostname_id FROM dominio WHERE hostname = ?')
    .bind(hostname)
    .first<{
      org_id: string;
      tipo: string;
      rol: string;
      estado: string;
      cf_hostname_id: string | null;
    }>();

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

beforeEach(async () => {
  hosts = kv();
  // Cada caso empieza sin dominios propios, y con la plataforma como canónica.
  await control.prepare("DELETE FROM dominio WHERE tipo = 'propio'").run();
  await control.prepare("UPDATE dominio SET rol = 'canonico' WHERE tipo = 'plataforma'").run();
});

describe('el estado que dice Cloudflare (HU-T13.1 CA2)', () => {
  const h = (status: string, ssl: string, extra: Partial<HostnameEnCloudflare> = {}) =>
    estadoDe({ id: 'x', hostname: 'www.x.example', status, ssl: { status: ssl }, ...extra });
  it('activo solo con el hostname y su certificado activos (P1)', () => {
    expect(h('active', 'active').estado).toBe('activo');
    expect(h('pending', 'active').estado).toBe('validando');
    expect(h('active', 'pending_deployment').estado).toBe('validando');
    expect(h('pending', 'pending_validation').estado).toBe('pendiente');
  });
  it('❌ lo vencido o bloqueado es error, con su motivo en palabras', () => {
    expect(h('pending', 'validation_timed_out')).toEqual({
      estado: 'error',
      motivo: expect.stringMatching(/Pasaron varios días/),
    });
    expect(h('blocked', 'pending_validation').motivo).toMatch(/no deja usar esta dirección/);
    expect(h('pending', 'pending_validation', { verification_errors: ['x'] }).motivo).toBe(
      'Todavía no vemos los registros.',
    );
  });
});

describe('conectar un dominio propio (HU-T13.1)', () => {
  it('CA1: crea el hostname con prevalidación y propiedad por TXT, y dice los tres registros', async () => {
    const cf = cloudflare();
    const r = await conectarDominio(quien(), cf.saas, {
      op: op(),
      hostname: 'https://WWW.Tienda-Uno.example/',
    });
    expect(r).toMatchObject({ estado: 'guardado', id: 'www.tienda-uno.example' });
    const alta = cf.pedidos.find((p) => p.metodo === 'POST');
    expect(alta?.cuerpo).toEqual({
      hostname: 'www.tienda-uno.example',
      ssl: { method: 'txt', type: 'dv', settings: { min_tls_version: '1.2' } },
    });
    expect(r.estado === 'guardado' && r.dominio).toMatchObject({
      estado: 'pendiente',
      rol: 'alias',
      registros: [
        { tipo: 'TXT', nombre: '_cf-custom-hostname.www', valor: 'propiedad-1' },
        { tipo: 'TXT', nombre: '_acme-challenge.www', valor: 'acme-1' },
        { tipo: 'CNAME', nombre: 'www', valor: 'origen.laboratorio-digital.app' },
      ],
    });
    expect(await filaDe('www.tienda-uno.example')).toEqual({
      org_id: UNO,
      tipo: 'propio',
      rol: 'alias',
      estado: 'pendiente',
      cf_hostname_id: 'ch-1',
    });
    // Nada entra a TIENDA_HOSTS hasta que Cloudflare lo active.
    expect([...hosts.datos.keys()]).toEqual([]);
    const registro = await shard
      .prepare("SELECT accion, entidad_id FROM registro WHERE org_id = ? AND entidad = 'dominio'")
      .bind(UNO)
      .all();
    expect(registro.results).toEqual([
      { accion: 'dominio.conectar', entidad_id: 'www.tienda-uno.example' },
    ]);
  });

  it('la misma op, o el mismo dominio otra vez, no crea nada nuevo', async () => {
    const cf = cloudflare();
    const una = op();
    const r1 = await conectarDominio(quien(), cf.saas, {
      op: una,
      hostname: 'www.tienda-uno.example',
    });
    expect(
      await conectarDominio(quien(), cf.saas, { op: una, hostname: 'www.tienda-uno.example' }),
    ).toEqual(r1);
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'www.tienda-uno.example' });
    expect(cf.hostnames.size).toBe(1);
  });

  it('❌ lo que no es un dominio, una dirección de la plataforma o sin Cloudflare: nada se crea', async () => {
    const cf = cloudflare();
    for (const hostname of ['tienda', '192.168.1.1', 'www.laboratorio-digital.app', 'com.co']) {
      expect((await conectarDominio(quien(), cf.saas, { op: op(), hostname })).estado).toBe(
        'problemas',
      );
    }
    expect(
      await conectarDominio(quien(), null, { op: op(), hostname: 'www.tienda-uno.example' }),
    ).toMatchObject({
      estado: 'sin-configurar',
    });
    // HU-T13.5 CA2: el dominio propio es de los planes pagos.
    expect(
      await conectarDominio({ ...quien(), plan: 'gratis' }, cf.saas, {
        op: op(),
        hostname: 'www.tienda-uno.example',
      }),
    ).toEqual({
      estado: 'problemas',
      problemas: [{ campo: 'hostname', mensaje: expect.stringMatching(/no incluye un dominio/) }],
    });
    expect(cf.pedidos).toEqual([]);
  });

  it('❌ una tienda tiene a lo sumo dos direcciones propias', async () => {
    const cf = cloudflare();
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'www.tienda-uno.example' });
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'tienda-uno.example' });
    const tercera = await conectarDominio(quien(), cf.saas, {
      op: op(),
      hostname: 'www.otra.example',
    });
    expect(tercera).toMatchObject({ estado: 'problemas' });
    expect(cf.hostnames.size).toBe(2);
  });

  it('❌ CA3: el dominio de otra tienda no se toma; uno retirado, solo con su TXT nuevo', async () => {
    const cf = cloudflare();
    await conectarDominio(quien(DOS), cf.saas, { op: op(), hostname: 'www.compartido.example' });
    const ajeno = await conectarDominio(quien(UNO), cf.saas, {
      op: op(),
      hostname: 'www.compartido.example',
    });
    expect(ajeno).toEqual({
      estado: 'problemas',
      problemas: [{ campo: 'hostname', mensaje: expect.stringMatching(/conectada a otra tienda/) }],
    });
    // Ensayo Dos lo deja; Ensayo Uno lo pide: otro hostname en Cloudflare, con otra propiedad.
    cf.activar('www.compartido.example');
    await retirarDominio(quien(DOS), cf.saas, { op: op(), hostname: 'www.compartido.example' });
    const r = await conectarDominio(quien(UNO), cf.saas, {
      op: op(),
      hostname: 'www.compartido.example',
    });
    expect(r.estado === 'guardado' && r.dominio).toMatchObject({
      estado: 'pendiente',
      registros: expect.arrayContaining([expect.objectContaining({ valor: 'propiedad-2' })]),
    });
    expect(await filaDe('www.compartido.example')).toMatchObject({
      org_id: UNO,
      estado: 'pendiente',
      cf_hostname_id: 'ch-2',
    });
  });

  it('❌ si Cloudflare ya lo tiene en otra cuenta, lo dice y no guarda nada', async () => {
    const cf = cloudflare();
    cf.duplicados.add('www.de-otra-cuenta.example');
    const r = await conectarDominio(quien(), cf.saas, {
      op: op(),
      hostname: 'www.de-otra-cuenta.example',
    });
    expect(r).toMatchObject({ estado: 'problemas' });
    expect(await filaDe('www.de-otra-cuenta.example')).toBeNull();
  });
});

describe('esperar a Cloudflare (HU-T13.1 CA2)', () => {
  it('la pantalla pregunta al abrirse: pendiente → validando → activo, y entonces entra a TIENDA_HOSTS', async () => {
    const cf = cloudflare();
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'www.tienda-uno.example' });
    expect(
      (await listarDominios(quien(), cf.saas)).dominios.map((d) => [d.hostname, d.estado]),
    ).toEqual([
      [PLATAFORMA_UNO, 'activo'],
      ['www.tienda-uno.example', 'pendiente'],
    ]);
    cf.validando('www.tienda-uno.example');
    expect((await listarDominios(quien(), cf.saas)).dominios[1]).toMatchObject({
      estado: 'validando',
      enPalabras: 'Registros encontrados: preparando el candado',
    });
    cf.activar('www.tienda-uno.example');
    const activo = (await listarDominios(quien(), cf.saas)).dominios[1];
    expect(activo).toMatchObject({ estado: 'activo', rol: 'alias', registros: [] });
    // Nace alias: lleva a la plataforma, que sigue siendo la canónica.
    expect(JSON.parse(hosts.datos.get('h:www.tienda-uno.example') ?? '{}')).toMatchObject({
      org: UNO,
      celda: 'c1',
      shard: 'tienda_c1_s1',
      canonico: PLATAFORMA_UNO,
      rol: 'alias',
    });
  });

  it('la tarea de cada hora revisa los que esperan y apunta los que se activaron', async () => {
    const cf = cloudflare();
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'www.tienda-uno.example' });
    await conectarDominio(quien(DOS), cf.saas, { op: op(), hostname: 'www.tienda-dos.example' });
    cf.activar('www.tienda-dos.example');
    const r = await revisarDominios({
      control,
      shards: [['tienda_c1_s1', shard]],
      celda: 'c1',
      hosts,
      saas: cf.saas,
      instante: AHORA,
    });
    expect(r).toEqual({ revisados: 2, activados: 1, fallas: [] });
    expect([...hosts.datos.keys()].sort()).toEqual([
      `h:${hostDeStaging(ENSAYO_DOS.slug)}`,
      'h:www.tienda-dos.example',
    ]);
    // Sin nada que esperar, no lee nada en Cloudflare.
    cf.pedidos.length = 0;
    await revisarDominios({
      control,
      shards: [['tienda_c1_s1', shard]],
      celda: 'c1',
      hosts,
      saas: cf.saas,
      instante: AHORA,
    });
    expect(cf.pedidos.filter((p) => p.ruta.includes('custom_hostnames/')).length).toBe(1);
  });
});

describe('la dirección principal (HU-T13.2)', () => {
  it('CA1: el dominio activo pasa a canónico y la plataforma a alias; desconectarlo lo revierte', async () => {
    const cf = cloudflare();
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'www.tienda-uno.example' });
    cf.activar('www.tienda-uno.example');
    await listarDominios(quien(), cf.saas);
    const r = await elegirCanonico(quien(), { op: op(), hostname: 'www.tienda-uno.example' });
    expect(r).toMatchObject({ estado: 'guardado', cambio: true });
    expect((await filaDe(PLATAFORMA_UNO))?.rol).toBe('alias');
    expect(JSON.parse(hosts.datos.get(`h:${PLATAFORMA_UNO}`) ?? '{}')).toMatchObject({
      rol: 'alias',
      canonico: 'www.tienda-uno.example',
    });
    expect(JSON.parse(hosts.datos.get('h:www.tienda-uno.example') ?? '{}')).toMatchObject({
      rol: 'canonico',
      canonico: 'www.tienda-uno.example',
    });
    // Elegirlo otra vez no cambia nada.
    expect(
      await elegirCanonico(quien(), { op: op(), hostname: 'www.tienda-uno.example' }),
    ).toMatchObject({ cambio: false });

    const fuera = await retirarDominio(quien(), cf.saas, {
      op: op(),
      hostname: 'www.tienda-uno.example',
    });
    expect(fuera).toMatchObject({ estado: 'guardado', eraCanonico: true });
    expect(await filaDe('www.tienda-uno.example')).toMatchObject({
      estado: 'retirado',
      cf_hostname_id: null,
    });
    expect((await filaDe(PLATAFORMA_UNO))?.rol).toBe('canonico');
    expect(hosts.datos.has('h:www.tienda-uno.example')).toBe(false);
    expect(JSON.parse(hosts.datos.get(`h:${PLATAFORMA_UNO}`) ?? '{}')).toMatchObject({
      rol: 'canonico',
    });
    expect(cf.hostnames.size).toBe(0);
  });

  it('❌ un dominio que todavía no está activo no puede ser el principal', async () => {
    const cf = cloudflare();
    await conectarDominio(quien(), cf.saas, { op: op(), hostname: 'www.tienda-uno.example' });
    expect(
      await elegirCanonico(quien(), { op: op(), hostname: 'www.tienda-uno.example' }),
    ).toMatchObject({
      estado: 'no-existe',
    });
    expect((await filaDe(PLATAFORMA_UNO))?.rol).toBe('canonico');
  });
});
