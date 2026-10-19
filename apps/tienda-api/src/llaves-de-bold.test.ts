/**
 * HU-T11.2: las llaves de Bold del comercio, por la API del panel, con un token del CORE firmado de
 * verdad y un Bold de mentira que responde lo que diga cada prueba.
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
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { llavesDeBold } from './credenciales.ts';
import { kekDelEntorno } from './llaves.ts';
import { type Almacen, publicar } from './publicar.ts';
import { textosVigentes } from './terminos.ts';
import { CABECERA_DESPACHO, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-las-llaves';
const T0 = Date.UTC(2026, 9, 19, 16);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000e2';
const UNO = ENSAYO_UNO.org;
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 41)).toString('base64');
// Las llaves que pega el comercio: la prueba CA4 las busca en todo lo que sale.
const IDENTIDAD = 'IdentidadDePruebas_0123456789-wxyz';
const SECRETA = 'SecretaDePruebas_9876543210-abcd';

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

/** Lo que responde el Bold de mentira, y lo que se le pidió. */
let bold: 'reconoce' | 401 | 403 | 500 | 'sin-red' = 'reconoce';
const pedidasABold: { url: string; autorizacion: string | null }[] = [];
const boldFalso: typeof fetch = async (url, init) => {
  pedidasABold.push({
    url: String(url),
    autorizacion: new Headers(init?.headers).get('authorization'),
  });
  if (bold === 'sin-red') throw new TypeError('fetch failed');
  if (bold === 'reconoce') return new Response('{}', { status: 404 });
  return new Response('{"errors":[]}', { status: bold });
};

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
afterEach(() => {
  bold = 'reconoce';
});

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  TIENDA_KEK_V1: KEK,
  tienda_c1_s1: shard,
  tienda_control: control,
});

const token = async (rol: 'propietario' | 'colaborador', hace = 0) =>
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
        auth_time: Math.floor((T0 - hace) / 1000),
      },
      T0,
      2,
    )
  ).token;

/** Cada respuesta, tal cual llegó: CA4 las revisa todas. */
const respuestas: string[] = [];
const pedir = async (
  ruta: string,
  cuerpo?: unknown,
  o: { rol?: 'propietario' | 'colaborador'; hace?: number } = {},
) => {
  const r = await crearApp({
    ahora: () => T0,
    enSegundoPlano: () => undefined,
    fetch: boldFalso,
  }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${await token(o.rol ?? 'propietario', o.hace ?? 0)}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
  const texto = await r.text();
  respuestas.push(texto);
  return { status: r.status, cuerpo: JSON.parse(texto) as Record<string, unknown> };
};

let ops = 0;
const op = () => `op-llaves-${++ops}`.padEnd(16, '0');
const llaves = (o: Record<string, unknown> = {}) => ({
  op: op(),
  ambiente: 'pruebas',
  identidad: IDENTIDAD,
  secreta: SECRETA,
  ...o,
});
const credenciales = () =>
  shard
    .prepare(
      'SELECT ambiente, campo, huella, verificada FROM credencial WHERE org_id = ? ORDER BY campo',
    )
    .bind(UNO)
    .all<Record<string, string | null>>()
    .then((r) => r.results);
const aceptar = async (cual: 'terminos' | 'custodia') =>
  pedir('terminos/aceptar', { op: op(), cual, huella: (await textosVigentes())[cual].huella });

describe('las llaves de Bold del comercio (HU-T11.2)', () => {
  it('❌ CA1: sin los términos ni la custodia aceptados, no se conecta el cobro', async () => {
    const sinTerminos = await pedir('cobro/llaves', llaves());
    expect(sinTerminos.status).toBe(403);
    expect(sinTerminos.cuerpo['estado']).toBe('sin-terminos');
    await aceptar('terminos');
    const sinCustodia = await pedir('cobro/llaves', llaves());
    expect(sinCustodia.status).toBe(403);
    expect(sinCustodia.cuerpo['estado']).toBe('sin-custodia');
    expect(await credenciales()).toEqual([]);
    expect(pedidasABold).toEqual([]);
  });

  it('CA1: la custodia se acepta aparte, con su huella en el registro', async () => {
    const r = await aceptar('custodia');
    expect(r.cuerpo).toMatchObject({ estado: 'guardado', id: 'custodia' });
    const fila = await shard
      .prepare("SELECT entidad_id FROM registro WHERE org_id = ? AND accion = 'custodia.aceptar'")
      .bind(UNO)
      .first<{ entidad_id: string }>();
    expect(fila?.entidad_id).toBe((await textosVigentes()).custodia.huella);
    expect((await pedir('cobro')).cuerpo).toMatchObject({ terminos: true, custodia: true });
  });

  it('❌ CA1: pegarlas pide haber entrado hace menos de 10 minutos', async () => {
    const r = await pedir('cobro/llaves', llaves(), { hace: 11 * 60_000 });
    expect(r.status).toBe(401);
    expect(r.cuerpo['estado']).toBe('reautenticar');
    expect(await credenciales()).toEqual([]);
  });

  it('❌ el colaborador no ve ni toca el cobro', async () => {
    for (const [ruta, cuerpo] of [
      ['cobro', undefined],
      ['cobro/llaves', llaves()],
      ['cobro/probar', { ambiente: 'pruebas' }],
    ] as const) {
      const r = await pedir(ruta, cuerpo, { rol: 'colaborador' });
      expect(r.status, ruta).toBe(403);
      expect(r.cuerpo['estado'], ruta).toBe('prohibido');
    }
  });

  it.each([401, 403] as const)(
    '❌ CA2: si Bold responde %i, la llave no es válida, se dice así y no se guarda',
    async (estado) => {
      bold = estado;
      const r = await pedir('cobro/llaves', llaves());
      expect(r.status).toBe(422);
      expect(r.cuerpo['problemas']).toEqual([
        {
          campo: 'identidad',
          mensaje:
            'Bold no reconoce esta llave de identidad de pruebas. Cópiala otra vez desde tu panel de Bold, en el ambiente de pruebas.',
        },
      ]);
      expect(await credenciales()).toEqual([]);
    },
  );

  it.each(['sin-red', 500] as const)(
    '❌ CA2: si Bold no responde (%s), no se guarda nada y se dice',
    async (caso) => {
      bold = caso;
      const r = await pedir('cobro/llaves', llaves());
      expect(r.status).toBe(503);
      expect(r.cuerpo['estado']).toBe('sin-respuesta');
      expect(await credenciales()).toEqual([]);
    },
  );

  it('❌ una llave a medias o la misma dos veces no se manda a Bold', async () => {
    const antes = pedidasABold.length;
    const corta = await pedir('cobro/llaves', llaves({ identidad: 'abc' }));
    expect(corta.status).toBe(422);
    const igual = await pedir('cobro/llaves', llaves({ secreta: IDENTIDAD }));
    expect(igual.cuerpo['problemas']).toEqual([
      { campo: 'secreta', mensaje: 'es igual a la de identidad: en Bold son dos llaves distintas' },
    ]);
    expect(pedidasABold.length).toBe(antes);
  });

  it('CA1 y CA2: con la identidad que Bold reconoce, las dos se guardan cifradas y solo se ven sus últimos 4', async () => {
    const r = await pedir('cobro/llaves', llaves());
    expect(r.status).toBe(200);
    expect(r.cuerpo).toMatchObject({ estado: 'guardado', id: 'pruebas' });
    // La consulta de Bold fue con la llave de identidad y una referencia que no existe.
    const ultima = pedidasABold.at(-1);
    expect(ultima?.url).toMatch(/payment-voucher\/ed1-comprobar-/);
    expect(ultima?.autorizacion).toBe(`x-api-key ${IDENTIDAD}`);
    expect(await credenciales()).toEqual([
      { ambiente: 'pruebas', campo: 'identidad', huella: 'wxyz', verificada: AHORA },
      { ambiente: 'pruebas', campo: 'secreta', huella: 'abcd', verificada: null },
    ]);
    const cobro = (await pedir('cobro')).cuerpo as {
      llaves: Record<string, Record<string, unknown>>;
    };
    expect(cobro.llaves['pruebas']).toEqual({
      identidad: { fin: 'wxyz', guardada: AHORA, verificada: AHORA },
      secreta: { fin: 'abcd', guardada: AHORA, verificada: null },
    });
    expect(cobro.llaves['produccion']).toEqual({ identidad: null, secreta: null });
    // Cifradas: el cobro (HU-T11.4) las abre con la KEK, y son las que se pegaron.
    const kek = await kekDelEntorno(KEK);
    expect(kek).not.toBeNull();
    expect(await llavesDeBold(shard, UNO, 'pruebas', kek as NonNullable<typeof kek>)).toEqual({
      identidad: IDENTIDAD,
      secreta: SECRETA,
      ambiente: 'pruebas',
    });
    const frases = (await pedir('registro')).cuerpo['filas'] as { frase: string }[];
    expect(frases[0]?.frase).toBe('Tú guardaste las llaves de Bold de pruebas');
  });

  it('«Probar» vuelve a preguntarle a Bold por la llave guardada, y dice si ya no la reconoce', async () => {
    const bien = await pedir('cobro/probar', { ambiente: 'pruebas' });
    expect(bien.cuerpo).toEqual({
      estado: 'valida',
      motivo: 'Bold reconoce tu llave de identidad de pruebas.',
    });
    bold = 401;
    const mal = await pedir('cobro/probar', { ambiente: 'pruebas' });
    expect(mal.cuerpo['estado']).toBe('invalida');
    expect(String(mal.cuerpo['motivo'])).toMatch(/ya no reconoce/);
    const nada = await pedir('cobro/probar', { ambiente: 'produccion' });
    expect(nada.cuerpo['estado']).toBe('sin-llaves');
  });

  it('CA3: con el pago en línea encendido, el panel sabe qué falta para cobrar, en palabras', async () => {
    const ajustes = (await pedir('ajustes')).cuerpo as {
      secciones: Record<string, { version: number; datos: Record<string, unknown> }>;
    };
    const venta = ajustes.secciones['venta'] ?? { version: 0, datos: {} };
    const g = await pedir('ajustes/guardar', {
      op: op(),
      seccion: 'venta',
      version: venta.version,
      datos: { ...venta.datos, modo: 'ambos' },
    });
    expect(g.status).toBe(200);
    // Las de pruebas están: cobra en pruebas, nada falta.
    expect((await pedir('yo')).cuerpo['cobro']).toEqual({ faltan: [] });
    // Sin ellas, lo dice con su nombre.
    await shard
      .prepare('DELETE FROM credencial WHERE org_id = ? AND campo = ?')
      .bind(UNO, 'secreta')
      .run();
    expect((await pedir('yo')).cuerpo['cobro']).toEqual({
      faltan: ['la llave secreta de pruebas'],
    });
    // Y la otra tienda, que no cobra en línea, no tiene nada que decir.
    await pedir('cobro/llaves', llaves());
  });

  it('❌ CA4: las llaves no están en ninguna respuesta, ni en el registro, ni en un log, ni en lo horneado', async () => {
    const logs: string[] = [];
    const espias = (['log', 'error', 'warn', 'info'] as const).map((m) =>
      vi
        .spyOn(console, m)
        .mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' '))),
    );
    try {
      // Otra vuelta completa, con los logs vigilados: guardar, probar y leer.
      await pedir('cobro/llaves', llaves());
      await pedir('cobro/probar', { ambiente: 'pruebas' });
      await pedir('cobro');
      await pedir('yo');
      // Lo horneado de una tienda que cobra en línea (la compuerta de HU-T11.3 se omite aquí).
      const objetos = new Map<string, string>();
      const sitios: Almacen = {
        get: async (k) => {
          const t = objetos.get(k);
          return t === undefined ? null : { text: async () => t };
        },
        put: async (k, v) => void objetos.set(k, v),
      };
      const r = await publicar({
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
        omitir: ['sin-foto', 'pago-en-linea'],
      });
      expect(r.estado).toBe('publicada');
      expect(objetos.size).toBeGreaterThan(10);
      const registro = await shard
        .prepare('SELECT antes, despues, entidad_id FROM registro WHERE org_id = ?')
        .bind(UNO)
        .all();
      const cifradas = await shard
        .prepare('SELECT hex(cifrado) AS c, huella FROM credencial WHERE org_id = ?')
        .bind(UNO)
        .all();
      const todo = [
        ...respuestas,
        ...logs,
        ...objetos.values(),
        JSON.stringify(registro.results),
        JSON.stringify(cifradas.results),
      ].join('\n');
      for (const valor of [IDENTIDAD, SECRETA]) {
        expect(todo).not.toContain(valor);
        expect(todo).not.toContain(Buffer.from(valor).toString('hex').toUpperCase());
      }
      // La prueba mira de verdad: el valor sí está en lo que se le mandó a Bold, que es su lugar.
      expect(pedidasABold.map((p) => p.autorizacion).join('\n')).toContain(IDENTIDAD);
    } finally {
      for (const e of espias) e.mockRestore();
    }
  });
});
