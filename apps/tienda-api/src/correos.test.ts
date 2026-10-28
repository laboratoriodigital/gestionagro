/**
 * HU-T14.3: los correos de la tienda. Contra el shard local con Comercio Ensayo Uno; Gmail es un
 * `fetch` de mentira que cambia el permiso por un acceso, guarda cada mensaje decodificado y falla
 * cuando se le pide. Los cobros nacen por `POST /api/v1/cobros` (HU-T11.4) y los avisos de pruebas
 * llegan firmados con la llave vacía de Bold, como los manda su ambiente de pruebas (HU-T11.5).
 */
import { importarKek } from '@ed1/cifrado';
import { correoGmail } from '@ed1/correo';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import {
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { avisarAlComprador, correoDelEstado } from './avisos-al-comprador.ts';
import {
  CORREOS,
  type ContextoDeCorreo,
  correosDeLaCelda,
  fechaEnPalabras,
  mandarUnaVez,
  resumenDeLaTienda,
  resumenDiario,
  TOPE_DE_LA_CELDA,
  TOPE_POR_TIENDA,
} from './correos.ts';
import { dekDeCredenciales, guardarCredencial } from './credenciales.ts';
import { KEK_VIGENTE, kekDelEntorno } from './llaves.ts';
import type { FilaDeSolicitud } from './panel-solicitudes.ts';
import { periodos, type Tablero } from './panel-tablero.ts';
import type { EntornoDeTareas } from './tareas.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, correoDe, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
/** Las 10 de la mañana del viernes 16 de octubre en Bogotá. */
const AHORA = '2026-10-16T15:00:00.000Z';
const SECRETO = 'secreto-de-prueba-del-despacho';
const UNO = ENSAYO_UNO.org;
const TERMINOS = 'c'.repeat(64);
const HOST = 'ensayo-uno--staging.mitiendapro.co';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 41)).toString('base64');
const GMAIL = {
  CORREO_GMAIL_CLIENTE_ID: 'cliente-de-prueba',
  CORREO_GMAIL_CLIENTE_SECRETO: 'secreto-de-prueba',
  CORREO_GMAIL_REFRESH: 'refresh-de-prueba',
  CORREO_GMAIL_REMITENTE: 'envios@ensayo.example',
};

interface Enviado {
  de: string;
  para: string;
  responderA: string | null;
  asunto: string;
  texto: string;
}

/** Lee un encabezado, con sus palabras codificadas de RFC 2047 ya en texto. */
function encabezado(mensaje: string, nombre: string): string | null {
  const linea = (mensaje.split('\r\n\r\n')[0] ?? '')
    .replace(/\r\n /g, ' ')
    .split('\r\n')
    .find((l) => l.startsWith(`${nombre}: `));
  if (!linea) return null;
  return linea
    .slice(nombre.length + 2)
    .replace(/=\?UTF-8\?B\?([^?]*)\?=( (?==\?))?/g, (_, b) =>
      Buffer.from(b, 'base64').toString('utf8'),
    );
}

/**
 * Gmail de mentira: `fallar` dice con qué estado responde el próximo envío. Bold contesta 404 a
 * toda consulta (todavía no sabe nada), para que la página no mueva lo que mueve el aviso.
 */
function gmail() {
  const enviados: Enviado[] = [];
  const fallar: number[] = [];
  let envios = 0;
  const fetchFalso = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = String(entrada);
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'acceso-de-prueba' });
    }
    if (url.startsWith('https://gmail.googleapis.com/')) {
      envios++;
      const estado = fallar.shift();
      if (estado)
        return Response.json({ error: { errors: [{ reason: 'x' }] } }, { status: estado });
      const { raw } = JSON.parse(String(init?.body)) as { raw: string };
      const m = Buffer.from(raw, 'base64url').toString('utf8');
      enviados.push({
        de: encabezado(m, 'From') ?? '',
        para: encabezado(m, 'To') ?? '',
        responderA: encabezado(m, 'Reply-To'),
        asunto: encabezado(m, 'Subject') ?? '',
        texto: Buffer.from(m.split('\r\n\r\n')[1] ?? '', 'base64')
          .toString('utf8')
          .replace(/\r\n/g, '\n'),
      });
      return Response.json({ id: `msg-${envios}` });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
  return { enviados, fallar, fetchFalso, envios: () => envios };
}

let shard: BaseD1;
let control: BaseD1;
const cerrar: (() => Promise<void>)[] = [];

const ajuste = (seccion: string, datos: unknown) =>
  shard
    .prepare(
      `INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, ?, 1, ?, ?, 'sistema')
       ON CONFLICT (org_id, seccion) DO UPDATE SET datos = excluded.datos`,
    )
    .bind(UNO, seccion, JSON.stringify(datos), AHORA);

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
  const venta = ENSAYO_UNO.ajustes['venta'] as Record<string, unknown>;
  await shard.batch([
    shard.prepare('UPDATE tienda SET version_publicada = 1 WHERE org_id = ?').bind(UNO),
    shard
      .prepare("UPDATE variante SET stock = 100 WHERE org_id = ? AND id = 'v-camisa-m-arena'")
      .bind(UNO),
    ajuste('venta', { ...venta, modo: 'ambos' }),
  ]);
  const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
  const dek = await dekDeCredenciales(shard, UNO, kek, AHORA);
  for (const [campo, valor] of [
    ['identidad', 'identidad-de-prueba-0001'],
    ['secreta', 'secreta-de-prueba-0002'],
  ] as const) {
    await (
      await guardarCredencial(
        shard,
        dek,
        { org: UNO, proveedor: 'bold', ambiente: 'pruebas', campo, valor },
        AHORA,
      )
    ).run();
  }
}, 60_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

const sitios = {
  put: async () => undefined,
  get: async (clave: string) =>
    clave === `sitios/${UNO}/1/manifiesto.json`
      ? {
          text: async () =>
            JSON.stringify({ archivos: { '/legal/terminos/index.md': { huella: TERMINOS } } }),
        }
      : null,
};

/** La app con su Gmail de mentira; espera lo que queda en segundo plano antes de devolver. */
async function pedir(
  ruta: string,
  cuerpo: BodyInit,
  g: ReturnType<typeof gmail>,
  extra: Partial<Env> & { cabeceras?: Record<string, string> } = {},
) {
  const trabajos: Promise<unknown>[] = [];
  const { cabeceras, ...entorno } = extra;
  const r = await crearApp({
    ahora: () => Date.parse(AHORA),
    fetch: g.fetchFalso,
    enSegundoPlano: (t) => trabajos.push(t),
  }).request(
    `https://${HOST}${ruta}`,
    {
      method: 'POST',
      body: cuerpo,
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
        ...cabeceras,
      },
    },
    {
      CELDA: 'c1',
      SECRETO_DESPACHO: SECRETO,
      TIENDA_KEK_V1: KEK,
      tienda_c1_s1: shard,
      tienda_control: control,
      SITIOS: sitios,
      ...GMAIL,
      ...entorno,
    } as Env,
  );
  await Promise.all(trabajos);
  return r;
}

const cobrar = (codigo: string, g: ReturnType<typeof gmail>, correo?: string, extra = {}) =>
  pedir(
    '/api/v1/cobros',
    JSON.stringify({
      codigo,
      lineas: [{ variante: 'v-camisa-m-arena', cantidad: 1 }],
      acepta: true,
      terminos: TERMINOS,
      seguimiento: `seguimiento-${codigo}-xxxxxxxxx`.slice(0, 22),
      token: `token-${codigo}-xxxxxxxxxxxxx`.slice(0, 22),
      totalVisto: 129000,
      entrega: {
        nombre: 'Ensayo Dos Compradora',
        celular: '3001234567',
        direccion: 'Calle de prueba 99',
        ...(correo ? { correo } : {}),
      },
    }),
    g,
    extra,
  );

const uno = async <T>(sql: string, ...v: unknown[]) =>
  (await shard
    .prepare(sql)
    .bind(...v)
    .first<T>()) as T;
const filaDe = (clave: string) =>
  uno<{
    estado: string;
    motivo: string | null;
    intentos: number;
    proveedor_id: string | null;
  } | null>(
    'SELECT estado, motivo, intentos, proveedor_id FROM correo WHERE org_id = ? AND clave = ?',
    UNO,
    clave,
  );

const contexto = (g: ReturnType<typeof gmail>, ahora: string, conf = true): ContextoDeCorreo => ({
  db: shard,
  org: UNO,
  ahora,
  correo: correoGmail(
    conf
      ? {
          clienteId: GMAIL.CORREO_GMAIL_CLIENTE_ID,
          clienteSecreto: GMAIL.CORREO_GMAIL_CLIENTE_SECRETO,
          refresh: GMAIL.CORREO_GMAIL_REFRESH,
          remitente: GMAIL.CORREO_GMAIL_REMITENTE,
        }
      : {},
    g.fetchFalso,
  ),
  enLaCelda: (d) => correosDeLaCelda([shard], d),
});
const CORREO = {
  para: 'ensayo-uno@ejemplo.test',
  asunto: 'Prueba',
  texto: 'Hola',
  nombre: 'Comercio Ensayo Uno',
};

/** Avisos de Bold de pruebas: los firma la llave vacía, que WebCrypto rellena a 64 ceros. */
async function avisoDePruebas(tipo: string, referencia: string, total = 129000) {
  const cuerpo = JSON.stringify({
    id: `aviso-${referencia}-${tipo}`,
    type: tipo,
    subject: `tx-${referencia}`,
    data: {
      payment_id: `tx-${referencia}`,
      amount: { total },
      metadata: { reference: referencia },
    },
  });
  const llave = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(64),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign(
    'HMAC',
    llave,
    new TextEncoder().encode(Buffer.from(cuerpo).toString('base64')),
  );
  return { cuerpo, firma: Buffer.from(firma).toString('hex') };
}

describe('HU-T14.3 · una vez por clave, y solo `enviado` es enviado', () => {
  it('CA3 ❌ · sin el adaptador configurado responde «no disponible», no toca la red y no cuenta', async () => {
    const g = gmail();
    expect(
      await mandarUnaVez(
        contexto(g, '2026-10-01T15:00:00.000Z', false),
        'p:sin',
        'resumen',
        () => CORREO,
      ),
    ).toBe('fallido');
    expect(await filaDe('p:sin')).toMatchObject({ estado: 'fallido', motivo: 'no-disponible' });
    expect(g.envios()).toBe(0);
    expect(await correosDeLaCelda([shard], '2026-10-01')).toBe(0);
  });

  it('CA3 ❌ · un envío que Gmail no aceptó queda fallido, no cuenta, y se reintenta hasta lograrlo', async () => {
    const g = gmail();
    const c = contexto(g, '2026-10-02T15:00:00.000Z');
    g.fallar.push(500);
    expect(await mandarUnaVez(c, 'p:falla', 'resumen', () => CORREO)).toBe('fallido');
    expect(await filaDe('p:falla')).toMatchObject({
      estado: 'fallido',
      motivo: 'falla',
      intentos: 1,
    });
    expect(await correosDeLaCelda([shard], '2026-10-02')).toBe(0);
    expect(await mandarUnaVez(c, 'p:falla', 'resumen', () => CORREO)).toBe('enviado');
    expect(await filaDe('p:falla')).toMatchObject({
      estado: 'enviado',
      intentos: 2,
      proveedor_id: 'msg-2',
    });
    expect(await mandarUnaVez(c, 'p:falla', 'resumen', () => CORREO)).toBe('repetido');
    expect(g.envios()).toBe(2);
    expect(g.enviados).toHaveLength(1);
  });

  it('un rechazo de Gmail no se reintenta, y tres fallas agotan los intentos', async () => {
    const g = gmail();
    const c = contexto(g, '2026-10-03T15:00:00.000Z');
    g.fallar.push(400);
    expect(await mandarUnaVez(c, 'p:rechazo', 'resumen', () => CORREO)).toBe('fallido');
    expect(await mandarUnaVez(c, 'p:rechazo', 'resumen', () => CORREO)).toBe('repetido');
    g.fallar.push(500, 500, 500, 500);
    for (let i = 0; i < 3; i++) await mandarUnaVez(c, 'p:tres', 'resumen', () => CORREO);
    expect(await filaDe('p:tres')).toMatchObject({ estado: 'fallido', intentos: 3 });
    expect(await mandarUnaVez(c, 'p:tres', 'resumen', () => CORREO)).toBe('repetido');
    expect(g.envios()).toBe(4);
  });

  it('un envío que quedó a mitad (el Worker se cayó) no se repite', async () => {
    const g = gmail();
    await shard
      .prepare(
        `INSERT INTO correo (org_id, clave, tipo, dia, estado, creado, actualizado)
         VALUES (?, 'p:mitad', 'resumen', '2026-10-04', 'enviando', ?, ?)`,
      )
      .bind(UNO, AHORA, AHORA)
      .run();
    expect(
      await mandarUnaVez(
        contexto(g, '2026-10-04T15:00:00.000Z'),
        'p:mitad',
        'resumen',
        () => CORREO,
      ),
    ).toBe('repetido');
    expect(g.envios()).toBe(0);
  });

  it(`CA2 · tope de ${TOPE_POR_TIENDA} por tienda al día: los fallidos no lo gastan`, async () => {
    const g = gmail();
    const dia = '2026-10-05';
    const insertar = (estado: string, i: number) =>
      shard
        .prepare(
          `INSERT INTO correo (org_id, clave, tipo, dia, estado, motivo, proveedor_id, creado, actualizado)
           VALUES (?, ?, 'acuse', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          UNO,
          `t:${estado}:${i}`,
          dia,
          estado,
          estado === 'fallido' ? 'falla' : null,
          estado === 'enviado' ? `m${i}` : null,
          AHORA,
          AHORA,
        );
    await shard.batch(Array.from({ length: 50 }, (_, i) => insertar('fallido', i)));
    await shard.batch(
      Array.from({ length: TOPE_POR_TIENDA - 1 }, (_, i) => insertar('enviado', i)),
    );
    const c = contexto(g, `${dia}T15:00:00.000Z`);
    expect(await mandarUnaVez(c, 't:ultimo', 'acuse', () => CORREO)).toBe('enviado');
    expect(await mandarUnaVez(c, 't:de-mas', 'acuse', () => CORREO)).toBe('fallido');
    expect(await filaDe('t:de-mas')).toMatchObject({ estado: 'fallido', motivo: 'tope' });
    expect(g.enviados).toHaveLength(1);
  });

  it(`CA2 · la celda entera corta en ${TOPE_DE_LA_CELDA}, sumados sus shards`, async () => {
    const g = gmail();
    const c = {
      ...contexto(g, '2026-10-06T15:00:00.000Z'),
      enLaCelda: async () => TOPE_DE_LA_CELDA,
    };
    expect(await mandarUnaVez(c, 'p:celda', 'resumen', () => CORREO)).toBe('fallido');
    expect(await filaDe('p:celda')).toMatchObject({ motivo: 'tope' });
    expect(g.envios()).toBe(0);
  });
});

describe('HU-T14.3 · el acuse al comprador (HU-T11.9 CA1)', () => {
  it('sale al nacer el pedido, con el enlace de seguimiento, el nombre de la tienda y Reply-To al comercio', async () => {
    const g = gmail();
    expect((await cobrar('CRA001', g, 'compradora@ensayo.example')).status).toBe(200);
    expect(g.enviados).toHaveLength(1);
    const [m] = g.enviados as [Enviado];
    expect(m.de).toBe('Comercio Ensayo Uno vía TiendaPro <envios@ensayo.example>');
    expect(m.para).toBe('<compradora@ensayo.example>');
    expect(m.responderA).toBe('<ensayo-uno@ejemplo.test>');
    expect(m.asunto).toBe('Tu pedido CRA001 en Comercio Ensayo Uno');
    expect(m.texto).toContain('Hola, Ensayo Dos Compradora:');
    expect(m.texto).toContain('Pedido CRA001 · #');
    expect(m.texto).toContain('Total: $129.000');
    expect(m.texto).toContain(
      `Sigue tu pedido: https://${HOST}/pedido/#c=CRA001&s=seguimiento-CRA001-xxx`,
    );
    // El correo no guarda nada de la persona: ni su dirección ni el texto.
    const fila = await uno<Record<string, unknown>>(
      "SELECT * FROM correo WHERE org_id = ? AND clave LIKE 'acuse:%' AND estado = 'enviado'",
      UNO,
    );
    expect(JSON.stringify(fila)).not.toContain('compradora');
    // Reenviar el mismo pedido es un duplicado: no sale otro.
    expect((await cobrar('CRA001', g, 'compradora@ensayo.example')).status).toBe(200);
    expect(g.enviados).toHaveLength(1);
  });

  it('sin correo no sale nada, y con ks:tienda-correos apagado tampoco', async () => {
    const g = gmail();
    await cobrar('CRA002', g);
    const flags = { get: async (k: string) => (k === 'ks:tienda-correos' ? 'apagado' : null) };
    await cobrar('CRA003', g, 'compradora@ensayo.example', { FLAGS: flags });
    expect(g.envios()).toBe(0);
  });

  it('CA3 ❌ · sin Gmail configurado el pedido nace igual y el acuse queda «no disponible»', async () => {
    const g = gmail();
    const r = await cobrar('CRA004', g, 'compradora@ensayo.example', { CORREO_GMAIL_REFRESH: '' });
    expect(r.status).toBe(200);
    expect(g.envios()).toBe(0);
    const fila = await uno<{ estado: string; motivo: string }>(
      `SELECT c.estado, c.motivo FROM correo c JOIN pedido p ON p.org_id = c.org_id AND c.clave = 'acuse:' || p.id
        WHERE c.org_id = ? AND p.codigo = 'CRA004'`,
      UNO,
    );
    expect(fila).toEqual({ estado: 'fallido', motivo: 'no-disponible' });
  });

  it('CA3 ❌ · si Gmail falla, el pago sigue su curso y el acuse no cuenta como enviado', async () => {
    const g = gmail();
    g.fallar.push(503);
    const r = await cobrar('CRA005', g, 'compradora@ensayo.example');
    expect(r.status).toBe(200);
    expect(((await r.json()) as { estado: string }).estado).toBe('registrado');
    const fila = await uno<{ estado: string; motivo: string }>(
      `SELECT c.estado, c.motivo FROM correo c JOIN pedido p ON p.org_id = c.org_id AND c.clave = 'acuse:' || p.id
        WHERE c.org_id = ? AND p.codigo = 'CRA005'`,
      UNO,
    );
    expect(fila).toEqual({ estado: 'fallido', motivo: 'falla' });
  });
});

describe('HU-P2.1 · los correos del pedido al comprador', () => {
  it('uno por estado, con el código y sin el secreto del seguimiento; ❌ un estado viejo no sale', async () => {
    const g = gmail();
    await cobrar('CRE001', g, 'compradora@ensayo.example');
    const p = await uno<{ id: string }>(
      "SELECT id FROM pedido WHERE org_id = ? AND codigo = 'CRE001'",
      UNO,
    );
    if (!p) throw new Error('sin pedido');
    const kek = await kekDelEntorno(KEK);
    const c = contexto(g, AHORA);
    // Todavía por pagar: el correo de «pagado» no sale.
    expect(await avisarAlComprador(c, kek, p.id, 'pagado')).toBe('no-toca');
    await shard
      .prepare("UPDATE pedido SET estado = 'pagado' WHERE org_id = ? AND id = ?")
      .bind(UNO, p.id)
      .run();
    expect(await avisarAlComprador(c, kek, p.id, 'pagado')).toBe('enviado');
    expect(await avisarAlComprador(c, kek, p.id, 'pagado')).toBe('repetido');
    const m = g.enviados.at(-1) as Enviado;
    expect(m.para).toBe('<compradora@ensayo.example>');
    expect(m.asunto).toBe('Recibimos tu pago del pedido CRE001');
    expect(m.texto).toContain('Hola, Ensayo Dos Compradora:');
    expect(m.texto).not.toContain('seguimiento-CRE001');
    // Sin la llave no se abre el contacto: no hay a quién.
    expect(await avisarAlComprador(c, null, p.id, 'pagado')).toBe('no-toca');
  });

  it('los textos de cada estado: lo que pasó y lo que sigue', () => {
    const d = {
      tienda: 'Lino Taller',
      codigo: 'ABC123',
      nombre: 'Ana',
      totalCop: 129000,
      responderA: true,
    };
    expect(correoDelEstado('confirmado', d).asunto).toBe('Lino Taller confirmó tu pedido ABC123');
    const despachado = correoDelEstado('despachado', {
      ...d,
      transportadora: 'Servientrega',
      guia: '123456',
    });
    expect(despachado.asunto).toBe('Tu pedido ABC123 va en camino');
    expect(despachado.texto).toContain('Va con Servientrega, guía 123456.');
    expect(correoDelEstado('cancelado', d).texto).toContain('la tienda te devuelve el dinero');
    expect(correoDelEstado('pagado', { ...d, responderA: false }).texto).not.toContain('Responde');
  });
});

describe('HU-T14.3 · el resultado del cobro de prueba, al comercio', () => {
  it('por el aviso: lo dice, una sola vez por cobro', async () => {
    const g = gmail();
    await cobrar('CRP001', g);
    const a = await avisoDePruebas('SALE_APPROVED', 'CRP001-1');
    const r = await pedir('/api/v1/avisos/bold', a.cuerpo, g, {
      cabeceras: { 'x-bold-signature': a.firma },
    });
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(g.enviados).toHaveLength(1);
    const [m] = g.enviados as [Enviado];
    expect(m.para).toBe('<ensayo-uno@ejemplo.test>');
    expect(m.asunto).toBe('Comercio Ensayo Uno · el cobro de prueba salió aprobado');
    expect(m.texto).toContain(
      'El cobro de prueba del pedido CRP001, por $129.000, salió aprobado.',
    );
    expect(m.texto).toContain('Lo supimos por el aviso de Bold');
    // El mismo aviso otra vez es repetido: ni mueve nada ni manda otro.
    await pedir('/api/v1/avisos/bold', a.cuerpo, g, { cabeceras: { 'x-bold-signature': a.firma } });
    expect(g.enviados).toHaveLength(1);
  });

  it('va al correo de Avisos si lo hay, y un rechazo también se cuenta', async () => {
    const g = gmail();
    await ajuste('avisos', { correo: 'avisos-uno@ejemplo.test' }).run();
    await cobrar('CRP002', g);
    const a = await avisoDePruebas('SALE_REJECTED', 'CRP002-1');
    await pedir('/api/v1/avisos/bold', a.cuerpo, g, { cabeceras: { 'x-bold-signature': a.firma } });
    await ajuste('avisos', {}).run();
    expect(g.enviados.map((m) => [m.para, m.asunto])).toEqual([
      ['<avisos-uno@ejemplo.test>', 'Comercio Ensayo Uno · el cobro de prueba salió rechazado'],
    ]);
  });

  it('el correo nunca cambia lo que se le responde a Bold: con Gmail caído, el aviso queda aplicado', async () => {
    const g = gmail();
    await cobrar('CRP003', g);
    g.fallar.push(500);
    const a = await avisoDePruebas('SALE_APPROVED', 'CRP003-1');
    const r = await pedir('/api/v1/avisos/bold', a.cuerpo, g, {
      cabeceras: { 'x-bold-signature': a.firma },
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ resultado: 'aplicado' });
    expect(await filaDe('prueba:CRP003-1')).toMatchObject({ estado: 'fallido', motivo: 'falla' });
  });
});

describe('HU-T14.3 · el resumen diario', () => {
  it('fechas en palabras con el calendario', () => {
    expect(fechaEnPalabras('2026-10-16')).toBe('viernes 16 de octubre');
    expect(fechaEnPalabras('2028-02-29')).toBe('martes 29 de febrero');
  });

  const tableroCon = (pendientes: Partial<Tablero['pendientes']>, ahora = AHORA): Tablero => {
    const cero = { pedidos: 0, vendidos: 0, ventasCop: 0, ticketCop: null, tasaDeCierre: null };
    return {
      periodos: periodos(Date.parse(ahora)),
      hoy: cero,
      mes: { ...cero, ventasCop: 1_258_000 },
      anterior: { ...cero, ventasCop: 900_000 },
      cuadre: null,
      pendientes: {
        porConfirmar: 0,
        porDespachar: 0,
        recaudosAtrasados: 0,
        solicitudesPorVencer: 0,
        solicitudesVencidas: 0,
        pagosSinExistencias: 0,
        cobrosARevisar: 0,
        agotados: 0,
        porAgotarse: 0,
        ...pendientes,
      },
      contraentrega: {
        cerrados: 0,
        devueltos: 0,
        cobradoCop: 0,
        costosCop: 0,
        netoCop: 0,
        sinCostos: 0,
        enCamino: 0,
      },
    };
  };
  const ayer = {
    pedidos: 3,
    vendidos: 2,
    ventasCop: 258_000,
    ticketCop: 129_000,
    tasaDeCierre: 2 / 3,
  };
  const solicitud = (radicado: string, dias: number, vence: string): FilaDeSolicitud => ({
    id: radicado,
    radicado,
    tipo: 'Petición, queja o reclamo',
    tipoId: 'pqr' as FilaDeSolicitud['tipoId'],
    estado: 'radicada',
    creada: AHORA,
    vence,
    respondida: null,
    cerrada: null,
    pedido: null,
    dias,
    alerta: dias < 0 ? 'vencida' : dias === 0 ? 'hoy' : dias <= 3 ? 'pronto' : null,
    reloj: 'respuesta',
  });

  it('lleva lo de hoy, las solicitudes por vencer con su radicado y lo vendido ayer', () => {
    const r = resumenDiario({
      tienda: 'Comercio Ensayo Uno',
      dia: '2026-10-16',
      tablero: tableroCon({
        porConfirmar: 2,
        porDespachar: 1,
        recaudosAtrasados: 1,
        pagosSinExistencias: 1,
      }),
      ayer,
      solicitudes: [
        solicitud('R-12', 0, '2026-10-16'),
        solicitud('R-13', 2, '2026-10-18'),
        solicitud('R-20', 9, '2026-10-25'),
      ],
    });
    expect(r?.asunto).toBe('Comercio Ensayo Uno · una solicitud vence hoy o ya venció');
    expect(r?.texto).toBe(
      [
        'Buenos días. Esto es lo que tiene Comercio Ensayo Uno para hoy, viernes 16 de octubre:',
        '',
        'Para hacer hoy',
        '- 2 pedidos por confirmar.',
        '- 1 pedido por despachar.',
        '- 1 pago sin existencias: repón las unidades o devuelve el dinero.',
        '- 1 recaudo atrasado: la transportadora lleva más de 3 días hábiles sin liquidarlo.',
        '',
        'Solicitudes por vencer',
        '- R-12 · Petición, queja o reclamo · vence hoy.',
        '- R-13 · Petición, queja o reclamo · vence en 2 días (el 18 de octubre).',
        '',
        'Ayer vendiste $258.000 en 2 pedidos.',
        'En el mes van $1.258.000, frente a $900.000 del mes anterior a la misma altura.',
        '',
        'Entra al panel: https://app.tiendapro.co/',
        '',
        'Este correo te llega porque lo pediste en Ajustes, Avisos. Para dejar de recibirlo, borra el correo de esa sección.',
      ].join('\n'),
    );
  });

  it('sin nada que hacer ni ventas ayer no sale; sin urgencias, el asunto es el del día', () => {
    const base = { tienda: 'Comercio Ensayo Uno', dia: '2026-10-16', solicitudes: [] };
    const sinVentas = { ...ayer, vendidos: 0, ventasCop: 0 };
    expect(resumenDiario({ ...base, tablero: tableroCon({}), ayer: sinVentas })).toBeNull();
    expect(
      resumenDiario({
        ...base,
        tablero: tableroCon({}),
        ayer: sinVentas,
        solicitudes: [solicitud('R-20', 9, '2026-10-25')],
      }),
    ).toBeNull();
    expect(
      resumenDiario({ ...base, tablero: tableroCon({ agotados: 3 }), ayer: sinVentas })?.asunto,
    ).toBe('Comercio Ensayo Uno · lo de hoy, viernes 16 de octubre');
  });

  it('HU-T6.5, 26 oct 2026: nombra las agotadas que más personas esperan, sin decir quiénes', () => {
    const r = resumenDiario({
      tienda: 'Comercio Ensayo Uno',
      dia: '2026-10-16',
      tablero: tableroCon({}),
      ayer: { ...ayer, vendidos: 0, ventasCop: 0 },
      solicitudes: [],
      esperan: [
        { nombre: 'Camisa de lino', clave: 'L|Azul', personas: 3 },
        { nombre: 'Bolso', clave: '', personas: 1 },
      ],
    });
    // Solo con personas esperando, ya hay algo que hacer: sale.
    expect(r?.texto).toContain(
      '- 3 personas esperan Camisa de lino (L, Azul): avísales por WhatsApp cuando haya.',
    );
    expect(r?.texto).toContain('- 1 persona espera Bolso: avísales por WhatsApp cuando haya.');
  });

  it('CA2 · sale a la hora de Bogotá que eligió el comercio, una vez al día, al correo de Avisos', async () => {
    const g = gmail();
    await ajuste('avisos', { correo: 'avisos-uno@ejemplo.test', hora: '08:30' }).run();
    // 7:59 de Bogotá: todavía no. 8:05: sí (la hora cuenta entera). 9:05: ya salió.
    const a = (hora: string) => contexto(g, `2026-10-20T${hora}:00.000Z`);
    expect(await resumenDeLaTienda(a('12:59'))).toBe('no-toca');
    expect(await resumenDeLaTienda(a('13:05'))).toBe('enviado');
    expect(await resumenDeLaTienda(a('14:05'))).toBe('repetido');
    expect(g.enviados).toHaveLength(1);
    const [m] = g.enviados as [Enviado];
    expect(m.para).toBe('<avisos-uno@ejemplo.test>');
    expect(m.asunto).toBe('Comercio Ensayo Uno · lo de hoy, martes 20 de octubre');
    // La talla L azul de la siembra está agotada.
    expect(m.texto).toContain('- 1 variante agotada.');
    await ajuste('avisos', {}).run();
  });

  it('sin correo en Avisos no sale: es la forma de pedirlo', async () => {
    const g = gmail();
    expect(await resumenDeLaTienda(contexto(g, '2026-10-21T20:00:00.000Z'))).toBe('no-toca');
    expect(g.envios()).toBe(0);
  });

  const entorno = (
    g: ReturnType<typeof gmail>,
    flags: Record<string, string> = {},
  ): EntornoDeTareas => ({
    celda: 'c1',
    shards: [['tienda_c1_s1', shard]],
    control,
    hosts: { get: async () => null, put: async () => undefined },
    flags: { get: async (k) => flags[k] ?? null, put: async () => undefined },
    telegram: { token: undefined, chat: undefined },
    correo: contexto(g, AHORA).correo,
    fetch: g.fetchFalso,
  });

  it('la tarea de cada hora: ks:tienda-correos apagado no manda nada, y un permiso vencido la marca fallida', async () => {
    await ajuste('avisos', { correo: 'avisos-uno@ejemplo.test' }).run();
    const g = gmail();
    expect(
      await CORREOS.correr(
        entorno(g, { 'ks:tienda-correos': 'apagado' }),
        Date.parse('2026-10-22T15:00:00.000Z'),
      ),
    ).toMatch(/apagado/);
    expect(g.envios()).toBe(0);
    // Gmail dice que el permiso ya no sirve: la tarea falla, para que la salud lo diga.
    g.fallar.push(403);
    await expect(
      CORREOS.correr(entorno(g), Date.parse('2026-10-22T15:00:00.000Z')),
    ).rejects.toThrow(/permiso de Gmail/);
    expect(await filaDe('resumen:2026-10-22')).toMatchObject({
      estado: 'fallido',
      motivo: 'no-disponible',
    });
    await ajuste('avisos', {}).run();
  });
});

describe('HU-T18.4 · el proveedor de cada ambiente (D-T11)', () => {
  const sinRed = (async () => {
    throw new Error('no debe tocar la red');
  }) as unknown as typeof fetch;
  const gmailCompleto = {
    CORREO_GMAIL_CLIENTE_ID: 'cliente-de-prueba',
    CORREO_GMAIL_CLIENTE_SECRETO: 'secreto-de-prueba',
    CORREO_GMAIL_REFRESH: 'refresh-de-prueba',
    CORREO_GMAIL_REMITENTE: 'envios@ensayo.example',
  };

  it('producción manda con Resend desde la marca; staging, con Gmail', () => {
    const produccion = correoDe(
      {
        AMBIENTE: 'produccion',
        RESEND_API_KEY: 're_de_prueba',
        CORREO_REMITENTE: 'avisos@tiendapro.co',
      } as Env,
      sinRed,
    );
    expect([produccion.proveedor, produccion.disponible]).toEqual(['resend', true]);
    const staging = correoDe({ AMBIENTE: 'staging', ...gmailCompleto } as Env, sinRed);
    expect([staging.proveedor, staging.disponible]).toEqual(['gmail', true]);
  });

  it('CA3 ❌ · producción sin la clave de Resend no cae a Gmail: «no disponible» y no finge', async () => {
    const correo = correoDe(
      { AMBIENTE: 'produccion', CORREO_REMITENTE: 'avisos@tiendapro.co', ...gmailCompleto } as Env,
      sinRed,
    );
    expect([correo.proveedor, correo.disponible]).toEqual(['resend', false]);
    expect(
      await correo.enviar({ para: 'a@ensayo.example', asunto: 'Hola', texto: 'Hola' }),
    ).toMatchObject({ enviado: false, motivo: 'no-disponible' });
  });
});
