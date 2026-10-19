/**
 * HU-T10.5 CA3: el colaborador, con un token del CORE firmado de verdad y recién entrado, recibe 403
 * en cada ruta de lo que es solo del propietario, aunque el panel no se lo ofrezca. La lista sale
 * de la matriz (`permisos.ts`): una acción nueva solo del propietario sin su fila aquí rompe esta
 * prueba, y una que hoy no tiene ruta en la API la rompe el día que la tenga.
 */
import { readdirSync, readFileSync } from 'node:fs';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { ACCIONES, type Accion, puede } from '@ed1/tienda-schema/permisos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { textosVigentes } from './terminos.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-del-colaborador';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d5';
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
  for (const sql of siembraDelShard([ENSAYO_UNO, ENSAYO_DOS], AHORA))
    await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl([ENSAYO_UNO, ENSAYO_DOS], 'c1', AHORA))
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

/** Recién entrado: lo que pide entrada reciente no puede escudarse en un 401. */
const token = async (rol: 'propietario' | 'colaborador') =>
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
        auth_time: Math.floor(T0 / 1000),
      },
      T0,
      2,
    )
  ).token;

const pedir = async (ruta: string, cuerpo: unknown, rol: 'propietario' | 'colaborador') =>
  crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${await token(rol)}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );

interface Ajustes {
  secciones: Record<string, { datos: Record<string, unknown>; version: number }>;
}
const ajustes = async () =>
  (await (await pedir('ajustes', undefined, 'propietario')).json()) as Ajustes;

let ops = 0;
const op = () => `op-colaborador-${++ops}`.padEnd(16, '0');
const guardar = async (seccion: string, cambio: Record<string, unknown>) => {
  const actual = (await ajustes()).secciones[seccion] ?? { datos: {}, version: 0 };
  return {
    op: op(),
    seccion,
    version: actual.version,
    datos: { ...actual.datos, ...cambio },
  };
};

const carga = {
  formato: 'tienda-import/1',
  productos: [{ titulo: 'Camisa de ensayo', variantes: [{ precio_cop: 1000 }] }],
};

type Intento = () => Promise<[ruta: string, cuerpo: unknown]>;

/**
 * Cada acción solo del propietario: sus rutas en la API de la Tienda, o por qué hoy no tiene. Es un
 * `Record` de las acciones solo del propietario: si `permisos.ts` suma una, falta su fila.
 */
const SOLO_DEL_PROPIETARIO: Record<string, Intento[] | { sinRuta: string }> = {
  'ajustes.modo_pedido': [
    async () => ['ajustes/guardar', await guardar('venta', { modo: 'ambos' })],
  ],
  'cobro.gestionar': [
    async () => ['ajustes/guardar', await guardar('cobro', { ambiente: 'pruebas' })],
    // HU-T11.2: la pantalla Cobro, verla, pegar las llaves y probarlas.
    async () => ['cobro', undefined],
    async () => [
      'cobro/llaves',
      { op: op(), ambiente: 'pruebas', identidad: 'i'.repeat(20), secreta: 's'.repeat(20) },
    ],
    async () => ['cobro/probar', { ambiente: 'pruebas' }],
  ],
  importar: [
    async () => ['importar/revisar', { carga }],
    async () => ['importar/aplicar', { carga, parte: 0 }],
  ],
  'equipo.gestionar': { sinRuta: 'el equipo es del CORE: invitar pide un rol que administra' },
  // HU-T13.1 y HU-T13.2: conectar, elegir el principal y desconectar. Verlo, no: lo ve el equipo.
  'dominios.gestionar': [
    async () => ['dominios/conectar', { op: op(), hostname: 'www.tienda-uno.example' }],
    async () => ['dominios/canonico', { op: op(), hostname: 'www.tienda-uno.example' }],
    async () => ['dominios/retirar', { op: op(), hostname: 'www.tienda-uno.example' }],
  ],
  'plan.gestionar': { sinRuta: 'el plan se cambia en el CORE' },
  'terminos.aceptar': [
    async () => [
      'terminos/aceptar',
      { op: op(), cual: 'terminos', huella: (await textosVigentes()).terminos.huella },
    ],
  ],
  'factura.gestionar': { sinRuta: 'la factura llega con el cobro en línea' },
  'exportar.datos_personales': [async () => ['exportar?datos=personales', undefined]],
  'titular.gestionar': [
    async () => ['titular/buscar', { celular: '3001234567' }],
    async () => ['titular/exportar', { celular: '3001234567' }],
    async () => [
      'titular/corregir',
      { op: op(), celular: '3001234567', contacto: { ciudad: 'x' } },
    ],
    async () => ['titular/suprimir', { op: op(), celular: '3001234567' }],
    async () => ['ajustes/guardar', await guardar('legal', { conservacionMeses: 12 })],
  ],
};

const fuentesDeLaApi = readdirSync('apps/tienda-api/src')
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  .map((f) => readFileSync(`apps/tienda-api/src/${f}`, 'utf8'))
  .join('\n');

describe('el colaborador y lo que es solo del propietario (HU-T10.5)', () => {
  it('la tabla tiene exactamente las acciones que la matriz niega al colaborador', () => {
    const negadas = ACCIONES.filter((a: Accion) => !puede('colaborador', a));
    expect(Object.keys(SOLO_DEL_PROPIETARIO).sort()).toEqual([...negadas].sort());
    // Y el propietario sí puede cada una: la matriz no niega por error a los dos.
    for (const a of negadas) expect(puede('propietario', a)).toBe(true);
  });

  it('❌ lo que todavía no tiene ruta no aparece en la API: el día que la tenga, va su 403 aquí', () => {
    for (const [accion, rutas] of Object.entries(SOLO_DEL_PROPIETARIO)) {
      if ('sinRuta' in rutas) expect(fuentesDeLaApi, accion).not.toContain(`'${accion}'`);
    }
  });

  it('❌ CA3: 403 en cada ruta, aunque el panel no la ofrezca, y nada cambia', async () => {
    const antes = await ajustes();
    const productos = async () =>
      (
        await shard
          .prepare('SELECT count(*) AS n FROM producto WHERE org_id = ?')
          .bind(UNO)
          .first<{ n: number }>()
      )?.n;
    const productosAntes = await productos();
    for (const [accion, rutas] of Object.entries(SOLO_DEL_PROPIETARIO)) {
      if ('sinRuta' in rutas) continue;
      for (const intento of rutas) {
        const [ruta, cuerpo] = await intento();
        const r = await pedir(ruta, cuerpo, 'colaborador');
        expect(r.status, `${accion} en ${ruta}`).toBe(403);
        expect(await r.json(), `${accion} en ${ruta}`).toMatchObject({ estado: 'prohibido' });
      }
    }
    expect(await ajustes()).toEqual(antes);
    expect(await productos()).toBe(productosAntes);
  });

  it('el mismo cambio del propietario sí pasa: el 403 es por el rol, no por el pedido', async () => {
    const r = await pedir(
      'ajustes/guardar',
      await guardar('venta', { modo: 'ambos' }),
      'propietario',
    );
    expect(r.status).toBe(200);
    const importar = await pedir('importar/revisar', { carga }, 'propietario');
    expect(importar.status).not.toBe(403);
  });

  it('el día a día sí: pedidos, productos, inventario, envíos, ajustes y el registro', async () => {
    for (const ruta of ['pedidos', 'productos', 'inventario', 'venta', 'ajustes', 'registro']) {
      expect((await pedir(ruta, undefined, 'colaborador')).status, ruta).toBe(200);
    }
    // Ve los ajustes, menos el cobro.
    const r = (await (await pedir('ajustes', undefined, 'colaborador')).json()) as Ajustes;
    expect(Object.keys(r.secciones)).not.toContain('cobro');
    expect(Object.keys(r.secciones)).toContain('venta');
  });
});
