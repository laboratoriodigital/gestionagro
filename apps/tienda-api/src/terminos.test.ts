/**
 * HU-T7.2: los términos del servicio y el contrato de transmisión que acepta el comercio, con un
 * token del CORE firmado de verdad, contra el shard local con los dos comercios de prueba.
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
import plantilla from '../../../content/tienda/comercio/terminos.json' with { type: 'json' };
import { textosVigentes } from './terminos.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-los-terminos';
const T0 = Date.UTC(2026, 9, 19, 15);
const PERSONA = '0199e0a0-0000-7000-8000-0000000000e1';
const UNO = ENSAYO_UNO.org;

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
  const ahora = new Date(T0).toISOString();
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], ahora))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', ahora))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());
}, 120_000);
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

const token = async (rol: 'propietario' | 'colaborador', org = UNO) =>
  (
    await firmarAcceso(
      firmante,
      {
        sub: PERSONA,
        org,
        rol,
        celda: 'c1',
        shard: 'tienda_c1_s1',
        anillo: 1,
        aud: 'tienda',
        plan: 'pro',
        auth_time: Math.floor(T0 / 1000),
      },
      T0,
      2,
    )
  ).token;

const pedir = async (
  ruta: string,
  cuerpo?: unknown,
  rol: 'propietario' | 'colaborador' = 'propietario',
  org = UNO,
) => {
  const r = await crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${await token(rol, org)}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
  return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
};

let ops = 0;
const op = () => `op-terminos-${++ops}`.padEnd(16, '0');

interface Textos {
  estado: string;
  terminos: { huella: string; version: string; aceptados: boolean; secciones: [string, string][] };
  custodia: { huella: string; aceptada: boolean; secciones: [string, string][] };
}
const textos = async (org = UNO) =>
  (await pedir('terminos', undefined, 'propietario', org)).cuerpo as unknown as Textos;
const fila = (org = UNO) =>
  shard
    .prepare(
      'SELECT terminos_huella, terminos_aceptados, terminos_por, custodia_huella FROM tienda WHERE org_id = ?',
    )
    .bind(org)
    .first<Record<string, string | null>>();
const registro = (org = UNO) =>
  shard
    .prepare(
      "SELECT accion, entidad_id, despues FROM registro WHERE org_id = ? AND entidad IN ('terminos', 'custodia') ORDER BY id",
    )
    .bind(org)
    .all<{ accion: string; entidad_id: string; despues: string }>()
    .then((r) => r.results);

describe('los términos del comercio (HU-T7.2)', () => {
  it('CA2: dicen que el dinero va a la cuenta de Bold del comercio, que no es el vendedor, y prohíben el fraude', async () => {
    const t = (await textos()).terminos.secciones.map(([a, b]) => `${a}. ${b}`).join('\n');
    expect(t).toMatch(/va directo a tu cuenta de Bold/);
    expect(t).toMatch(/Laboratorio Digital no es el vendedor/);
    expect(t).toMatch(/no recibe, no guarda ni reparte ese dinero/);
    expect(t).toMatch(/Una tienda fraudulenta/);
    // El contrato de transmisión: el comercio responde, Laboratorio Digital guarda por su cuenta.
    expect(t).toMatch(/Tu tienda es la Responsable/);
    expect(t).toMatch(/contrato de transmisión/);
    // HU-T18.6 CA2: lo que falta del encargado se omite, sin inventarlo ni dejar un hueco a la vista.
    expect(t).toMatch(/Encargado\. Laboratorio Digital, domicilio Medellín, Colombia, correo /);
    expect(t).not.toMatch(/por completar|identificación|teléfono|\{\w+\}/);
  });

  it('CA1: al entrar por primera vez el panel sabe que faltan, y la API los da con su huella', async () => {
    const yo = await pedir('yo');
    expect(yo.cuerpo['terminos']).toEqual({ aceptados: false });
    const t = await textos();
    expect(t.terminos.huella).toMatch(/^[0-9a-f]{64}$/);
    expect(t.terminos.version).toBe(plantilla.version);
    expect(t.terminos.aceptados).toBe(false);
    expect(t.custodia.aceptada).toBe(false);
    expect(t.estado).toBe('borrador');
    // El colaborador los puede leer, aunque no aceptarlos.
    expect((await pedir('terminos', undefined, 'colaborador')).status).toBe(200);
  });

  it('❌ CA3: sin aceptar, la API no deja publicar ni volver a una versión, aunque el panel no lo pida', async () => {
    for (const [ruta, cuerpo] of [
      ['publicar', {}],
      ['publicaciones/volver', { version: 1 }],
    ] as const) {
      const r = await pedir(ruta, cuerpo);
      expect(r.status, ruta).toBe(403);
      expect(r.cuerpo['estado'], ruta).toBe('sin-terminos');
      expect(String(r.cuerpo['motivo'])).toMatch(/aceptar los términos/);
    }
  });

  it('❌ el colaborador no los acepta en nombre de la tienda', async () => {
    const t = await textos();
    const r = await pedir(
      'terminos/aceptar',
      { op: op(), cual: 'terminos', huella: t.terminos.huella },
      'colaborador',
    );
    expect(r.status).toBe(403);
    expect(r.cuerpo['estado']).toBe('prohibido');
    expect((await fila())?.['terminos_huella']).toBeNull();
  });

  it('❌ una huella que no es la vigente no se acepta: el texto cambió mientras se leía', async () => {
    const r = await pedir('terminos/aceptar', {
      op: op(),
      cual: 'terminos',
      huella: 'a'.repeat(64),
    });
    expect(r.status).toBe(409);
    expect(r.cuerpo['estado']).toBe('cambiado');
    expect((await fila())?.['terminos_huella']).toBeNull();
    expect(await registro()).toEqual([]);
  });

  it('CA1: aceptar deja la huella en la tienda y en el registro; publicar ya no se detiene por ellos', async () => {
    const t = await textos();
    const r = await pedir('terminos/aceptar', {
      op: op(),
      cual: 'terminos',
      huella: t.terminos.huella,
    });
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ estado: 'guardado', id: 'terminos' });
    expect(await fila()).toMatchObject({
      terminos_huella: t.terminos.huella,
      terminos_aceptados: new Date(T0).toISOString(),
      terminos_por: `usuario:${PERSONA}`,
      // La custodia de las llaves es otra aceptación (HU-T11.2).
      custodia_huella: null,
    });
    expect(await registro()).toEqual([
      {
        accion: 'terminos.aceptar',
        entidad_id: t.terminos.huella,
        despues: JSON.stringify({ version: plantilla.version }),
      },
    ]);
    expect((await pedir('yo')).cuerpo['terminos']).toEqual({ aceptados: true });
    // Sin almacén configurado, publicar llega hasta la configuración: ya no son los términos.
    const p = await pedir('publicar', {});
    expect(p.cuerpo['estado']).toBe('sin-configurar');
    // La frase del registro.
    const frases = (await pedir('registro')).cuerpo['filas'] as { frase: string }[];
    expect(frases[0]?.frase).toBe(
      `Tú aceptaste los términos del servicio y el contrato de datos (versión ${plantilla.version})`,
    );
  });

  it('aceptar otra vez la misma versión no cambia nada ni deja otra fila; la misma op responde igual', async () => {
    const t = await textos();
    const primera = op();
    const a = await pedir('terminos/aceptar', {
      op: primera,
      cual: 'terminos',
      huella: t.terminos.huella,
    });
    expect(a.cuerpo).toMatchObject({ estado: 'guardado' });
    const b = await pedir('terminos/aceptar', {
      op: primera,
      cual: 'terminos',
      huella: t.terminos.huella,
    });
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(await registro()).toHaveLength(1);
  });

  it('CA1: cuando cambia la versión, la tienda tiene que aceptarlos otra vez', async () => {
    // Una aceptación de una versión anterior: otra huella en la fila.
    await shard
      .prepare('UPDATE tienda SET terminos_huella = ? WHERE org_id = ?')
      .bind('b'.repeat(64), UNO)
      .run();
    expect((await pedir('yo')).cuerpo['terminos']).toEqual({ aceptados: false });
    expect((await pedir('publicar', {})).cuerpo['estado']).toBe('sin-terminos');
    const v = await textosVigentes();
    await pedir('terminos/aceptar', { op: op(), cual: 'terminos', huella: v.terminos.huella });
    expect((await pedir('yo')).cuerpo['terminos']).toEqual({ aceptados: true });
  });

  it('❌ lo que acepta una tienda no vale para la otra (P4)', async () => {
    expect(
      (await pedir('yo', undefined, 'propietario', ENSAYO_DOS.org)).cuerpo['terminos'],
    ).toEqual({
      aceptados: false,
    });
  });
});
