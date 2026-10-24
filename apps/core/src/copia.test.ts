/**
 * La copia semanal fuera de Cloudflare (HU-C11.4) contra un D1 local, con Cloudflare y Drive de
 * mentira: el export de D1 que contesta por partes, y un Drive que guarda en memoria lo que se le
 * sube. Que el permiso de Drive real y el token de Cloudflare sirvan se comprueba en staging (P16).
 */
import { readFileSync } from 'node:fs';
import type { BaseD1 } from '@ed1/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { CORTADA, type EnvDeCopia, INTENTOS_POR_BASE, pasoDeLaCopia } from './copia.ts';
import {
  basesDeLaCopia,
  CopiaIlegible,
  cifrarCopia,
  descifrarCopia,
  filasDelVolcado,
  importarLlave,
  semanaDe,
  semanasQueSeQuedan,
} from './copia-formato.ts';

/** Lunes 26 oct 2026, 3:00 a. m. de Bogotá. */
const T0 = Date.UTC(2026, 9, 26, 8, 0);
const LLAVE = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)));
const VOLCADO = (base: string) =>
  `PRAGMA defer_foreign_keys=TRUE;\nCREATE TABLE usuario (id TEXT PRIMARY KEY, nombre TEXT);\nINSERT INTO "usuario" VALUES('u-1','Ana de ${base}');\nINSERT INTO "usuario" VALUES('u-2','Beto');\n`;

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
}, 60_000);
afterAll(async () => cerrar?.());

/** El Drive de mentira: archivos por id, con su carpeta. */
let drive: Map<
  string,
  { name: string; parent?: string | undefined; bytes: Uint8Array<ArrayBuffer> }
>;
let avisos: string[];
let exportResponde = 200;
let preguntasAntesDeListo = 1;
/** Con un texto, el export termina en `status: 'error'` con esa causa. */
let exportFalla: string | null = null;
let dañarAlSubir = false;
/** Con esto, la subida a Drive no contesta nunca: así se ve una vuelta que el cron corta. */
let alSubirSeCorta: (() => void) | null = null;
let cuota = { usage: '1000', limit: '10000' };
const env: EnvDeCopia = {
  DESTINO: 'staging',
  COPIA_LLAVE: LLAVE,
  COPIA_DRIVE_CLIENTE_ID: 'cliente',
  COPIA_DRIVE_CLIENTE_SECRETO: 'secreto',
  COPIA_DRIVE_REFRESH: 'refresh',
  COPIA_CF_TOKEN: 'token-copia',
  COPIA_CF_CUENTA: 'cuenta-1',
};

const fetchFalso: typeof fetch = async (entrada, init) => {
  const url = new URL(String(entrada instanceof Request ? entrada.url : entrada));
  const metodo = init?.method ?? 'GET';
  if (url.hostname === 'api.telegram.org') {
    avisos.push(JSON.parse(String(init?.body)).text);
    return Response.json({ ok: true });
  }
  if (url.hostname === 'api.cloudflare.com') {
    const nombre = url.searchParams.get('name');
    if (nombre) return Response.json({ result: [{ uuid: `id-${nombre}`, name: nombre }] });
    if (exportResponde !== 200) return Response.json({}, { status: exportResponde });
    const id = url.pathname.split('/').at(-2) ?? '';
    const cuerpo = JSON.parse(String(init?.body)) as { current_bookmark?: string };
    const n = Number(cuerpo.current_bookmark ?? '0');
    // La forma de la API de D1 (developers.cloudflare.com/api, «Export D1 Database as SQL»): el
    // enlace llega en `result.result.signed_url`, solo cuando el export terminó.
    const respuesta = (result: Record<string, unknown>) =>
      Response.json({
        errors: [],
        messages: [],
        success: true,
        result: { type: 'export', ...result },
      });
    if (exportFalla) return respuesta({ status: 'error', success: false, error: exportFalla });
    if (n < preguntasAntesDeListo)
      return respuesta({ status: 'active', success: true, at_bookmark: String(n + 1) });
    return respuesta({
      status: 'complete',
      success: true,
      at_bookmark: String(n),
      result: { filename: `${id}.sql`, signed_url: `https://volcados.test/${id.slice(3)}` },
    });
  }
  if (url.hostname === 'volcados.test') return new Response(VOLCADO(url.pathname.slice(1)));
  if (url.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'acceso' });
  if (url.pathname === '/drive/v3/about') return Response.json({ storageQuota: cuota });
  if (url.pathname === '/upload/drive/v3/files') {
    if (alSubirSeCorta) {
      alSubirSeCorta();
      return new Promise<Response>(() => undefined);
    }
    const cuerpo = new Uint8Array(await new Response(init?.body as BodyInit).arrayBuffer());
    const texto = new TextDecoder('latin1').decode(cuerpo);
    const meta = JSON.parse(/\r\n\r\n(\{.*?\})\r\n--/.exec(texto)?.[1] ?? '{}') as {
      name: string;
      parents: string[];
    };
    const inicio = texto.indexOf('application/octet-stream\r\n\r\n') + 28;
    const fin = texto.lastIndexOf('\r\n--');
    const bytes = cuerpo.slice(inicio, fin);
    if (dañarAlSubir) bytes[bytes.length - 1] = (bytes.at(-1) ?? 0) ^ 1;
    const id = `f-${drive.size + 1}`;
    drive.set(id, { name: meta.name, parent: meta.parents[0], bytes });
    return Response.json({ id });
  }
  if (url.pathname === '/drive/v3/files' && metodo === 'POST') {
    const id = `carpeta-${drive.size + 1}`;
    drive.set(id, { name: JSON.parse(String(init?.body)).name, bytes: new Uint8Array() });
    return Response.json({ id });
  }
  if (url.pathname === '/drive/v3/files') {
    const q = url.searchParams.get('q') ?? '';
    const enCarpeta = /^'(.+)' in parents/.exec(q)?.[1];
    const nombre = /name = '(.+?)'/.exec(q)?.[1];
    const files = [...drive.entries()]
      .filter(([, a]) => (enCarpeta ? a.parent === enCarpeta : a.name === nombre && !a.parent))
      .map(([id, a]) => ({ id, name: a.name }));
    return Response.json({ files });
  }
  const archivo = /^\/drive\/v3\/files\/(.+)$/.exec(url.pathname)?.[1];
  if (archivo && metodo === 'DELETE') {
    drive.delete(archivo);
    return new Response(null, { status: 204 });
  }
  if (archivo) {
    const a = drive.get(archivo);
    return a ? new Response(a.bytes) : new Response('', { status: 404 });
  }
  return new Response('no esperado', { status: 599 });
};

const BASES = ['agro_core_staging', 'agro_c0_s1_staging'];
const paso = (ahora = T0, otro: EnvDeCopia = env) =>
  pasoDeLaCopia(
    db,
    otro,
    {
      fetch: fetchFalso,
      esperar: async () => undefined,
      bases: BASES,
      telegram: { token: 't', chat: 'c' },
    },
    ahora,
  );

beforeEach(async () => {
  await vaciarCore(db);
  await db.prepare('DELETE FROM copia_base').run();
  drive = new Map();
  avisos = [];
  exportResponde = 200;
  preguntasAntesDeListo = 1;
  exportFalla = null;
  dañarAlSubir = false;
  alSubirSeCorta = null;
  cuota = { usage: '1000', limit: '10000' };
});

describe('HU-C11.4 · la copia semanal', () => {
  it('CA1: una base por vuelta, cifrada, en la carpeta de la app; con todas, el cierre; después, al día', async () => {
    expect(await paso()).toMatchObject({ estado: 'hecha', base: 'agro_core_staging' });
    expect(await paso()).toMatchObject({ estado: 'hecha', base: 'agro_c0_s1_staging' });
    expect(await paso()).toMatchObject({ estado: 'cierre', borradas: 0, cuota: 0.1 });
    expect(await paso()).toEqual({ estado: 'al-dia' });
    const archivos = [...drive.values()].filter((a) => a.parent);
    expect(archivos.map((a) => a.name)).toEqual([
      '2026-10-26_agro_core_staging.sql.ed1',
      '2026-10-26_agro_c0_s1_staging.sql.ed1',
    ]);
    const carpeta = [...drive.values()].find((a) => !a.parent);
    expect(carpeta?.name).toBe('Laboratorio Digital · copias semanales (staging)');
    // Cifrada antes de salir: el nombre de la persona no está en lo que tiene Drive.
    for (const a of archivos) expect(new TextDecoder().decode(a.bytes)).not.toContain('Beto');
  });

  it('CA2: la copia se abre con la llave y trae el volcado y sus filas, que la base también guarda', async () => {
    await paso();
    const [, a] = [...drive.entries()].find(([, x]) => x.parent) ?? [];
    const abierta = await descifrarCopia(
      await importarLlave(LLAVE),
      { base: 'agro_core_staging', semana: '2026-10-26' },
      new Uint8Array(a?.bytes ?? []),
    );
    expect(new TextDecoder().decode(abierta.volcado)).toBe(VOLCADO('agro_core_staging'));
    expect(abierta.manifiesto.filas).toEqual({ usuario: 2 });
    const fila = await db
      .prepare("SELECT estado, huella, filas FROM copia_base WHERE base = 'agro_core_staging'")
      .first<{ estado: string; huella: string; filas: string }>();
    expect(fila?.estado).toBe('hecha');
    expect(fila?.huella).toBe(abierta.manifiesto.huella);
    expect(JSON.parse(fila?.filas ?? '{}')).toEqual({ usuario: 2 });
  });

  it('CA3 ❌: una copia que llega dañada a Drive no queda como hecha, y a la tercera avisa con la causa', async () => {
    dañarAlSubir = true;
    for (let i = 0; i < INTENTOS_POR_BASE; i++) {
      expect(await paso()).toMatchObject({ estado: 'fallida', base: 'agro_core_staging' });
    }
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('agro_core_staging');
    expect(avisos[0]).toContain('no se pudo descifrar');
    // Agotados sus intentos, la vuelta sigue con la siguiente base.
    dañarAlSubir = false;
    expect(await paso()).toMatchObject({ estado: 'hecha', base: 'agro_c0_s1_staging' });
  });

  it('CA3 ❌: un token de Cloudflare sin permiso falla con su causa, sin subir nada', async () => {
    exportResponde = 403;
    const r = await paso();
    expect(r).toMatchObject({ estado: 'fallida' });
    expect(r.estado === 'fallida' && r.motivo).toContain('no puede exportar');
    expect([...drive.values()].filter((a) => a.parent)).toHaveLength(0);
  });

  it('❌ un export que Cloudflare termina en error falla con la causa que da, sin subir nada', async () => {
    exportFalla = 'database is too large';
    const r = await paso();
    expect(r).toMatchObject({ estado: 'fallida' });
    expect(r.estado === 'fallida' && r.motivo).toContain('database is too large');
    expect([...drive.values()].filter((a) => a.parent)).toHaveLength(0);
  });

  it('❌ una vuelta que el cron corta a mitad deja su intento anotado; a la tercera, falla y avisa', async () => {
    const fila = () =>
      db
        .prepare("SELECT estado, intentos, motivo FROM copia_base WHERE base = 'agro_core_staging'")
        .first<{ estado: string; intentos: number; motivo: string | null }>();
    for (let i = 1; i <= INTENTOS_POR_BASE; i++) {
      // La vuelta se queda en la subida, como cuando el cron la mata: ni éxito ni falla anotados.
      await new Promise<void>((llego) => {
        alSubirSeCorta = llego;
        void paso();
      });
      expect(await fila()).toEqual({ estado: 'pendiente', intentos: i, motivo: CORTADA });
    }
    expect(avisos).toHaveLength(0);
    alSubirSeCorta = null;
    // La vuelta siguiente la da por fallida, avisa una vez y sigue con la otra base.
    expect(await paso()).toMatchObject({ estado: 'hecha', base: 'agro_c0_s1_staging' });
    expect(await fila()).toMatchObject({ estado: 'fallida', intentos: INTENTOS_POR_BASE });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain(CORTADA);
    expect(await paso()).toMatchObject({ estado: 'cierre' });
    expect(avisos).toHaveLength(1);
  });

  it('el cron espera la copia: en `waitUntil` muere 30 s después de terminar la vuelta', () => {
    const fuente = readFileSync(new URL('./worker.ts', import.meta.url), 'utf8');
    const programado = fuente.slice(fuente.indexOf('async scheduled('));
    expect(programado).toContain('await pasoDeLaCopia(');
    expect(programado).not.toMatch(/waitUntil\(\s*pasoDeLaCopia/);
  });

  it('el export que tarda se espera en la misma vuelta; si no termina, falla', async () => {
    preguntasAntesDeListo = 4;
    expect(await paso()).toMatchObject({ estado: 'hecha' });
    preguntasAntesDeListo = 99;
    expect(await paso()).toMatchObject({
      estado: 'fallida',
      motivo: expect.stringContaining('no terminó'),
    });
  });

  it('sin la configuración no hace nada ni escribe nada', async () => {
    const { COPIA_LLAVE: _sinLlave, ...sinLlave } = env;
    expect(await paso(T0, sinLlave)).toEqual({
      estado: 'sin-configurar',
    });
    expect((await db.prepare('SELECT count(*) AS n FROM copia_base').first())?.['n']).toBe(0);
  });

  it('CA1c: el cierre avisa al 70 % de la cuota de Drive', async () => {
    cuota = { usage: '7100', limit: '10000' };
    for (let i = 0; i < 3; i++) await paso();
    expect(avisos).toEqual([expect.stringContaining('71 %')]);
  });

  it('CA1c: el cierre borra las copias que ya no se quedan', async () => {
    await paso();
    const carpeta = [...drive.entries()].find(([, a]) => !a.parent)?.[0] ?? '';
    for (const semana of ['2026-08-03', '2026-08-10', '2026-08-17']) {
      drive.set(`viejo-${semana}`, {
        name: `${semana}_agro_core_staging.sql.ed1`,
        parent: carpeta,
        bytes: new Uint8Array(),
      });
    }
    for (let s = 0; s < 8; s++) {
      const semana = new Date(Date.UTC(2026, 8, 28) - s * 7 * 864e5).toISOString().slice(0, 10);
      drive.set(`reciente-${semana}`, {
        name: `${semana}_agro_core_staging.sql.ed1`,
        parent: carpeta,
        bytes: new Uint8Array(),
      });
    }
    await paso();
    const r = await paso();
    // Las 8 más recientes van del 26 oct al 17 ago; de las anteriores, la primera de agosto.
    expect(r).toMatchObject({ estado: 'cierre' });
    const quedan = [...drive.keys()];
    expect(quedan).toContain('viejo-2026-08-03');
    expect(quedan).toContain('viejo-2026-08-17');
    expect(quedan).not.toContain('viejo-2026-08-10');
    expect(quedan).not.toContain('reciente-2026-08-10');
  });
});

describe('HU-C11.4 · el formato', () => {
  it('las bases salen de celdas.json, con _staging fuera de producción', () => {
    const config = {
      core: { d1: 'agro_core' },
      celdas: [
        { estado: 'activa', shards: ['agro_c0_s1'] },
        { estado: 'fuera', shards: ['viejo_c9_s1'] },
      ],
    };
    expect(basesDeLaCopia(config, 'produccion')).toEqual(['agro_core', 'agro_c0_s1']);
    expect(basesDeLaCopia(config, 'staging')).toEqual(['agro_core_staging', 'agro_c0_s1_staging']);
  });

  it('la semana es el lunes de Bogotá, también el domingo a las 11 p. m. y el lunes a medianoche', () => {
    expect(semanaDe(Date.UTC(2026, 10, 2, 4, 59))).toBe('2026-10-26'); // dom 1 nov, 11:59 p. m.
    expect(semanaDe(Date.UTC(2026, 10, 2, 5, 0))).toBe('2026-11-02'); // lun 2 nov, 0:00
  });

  it('cuenta las filas por tabla del volcado, con o sin comillas', () => {
    expect(
      filasDelVolcado(
        'INSERT INTO "a" VALUES(1);\nINSERT INTO a VALUES(2);\nINSERT INTO `b` VALUES(3);\n-- INSERT INTO c',
      ),
    ).toEqual({ a: 2, b: 1 });
  });

  it('❌ una copia renombrada a otra base o semana, o con otra llave, no se abre', async () => {
    const llave = await importarLlave(LLAVE);
    const { archivo } = await cifrarCopia(llave, {
      base: 'agro_core',
      semana: '2026-10-26',
      volcado: new TextEncoder().encode(VOLCADO('x')),
    });
    await expect(
      descifrarCopia(llave, { base: 'agro_c0_s1', semana: '2026-10-26' }, archivo),
    ).rejects.toBeInstanceOf(CopiaIlegible);
    const otra = await importarLlave(btoa(String.fromCharCode(...new Uint8Array(32))));
    await expect(
      descifrarCopia(otra, { base: 'agro_core', semana: '2026-10-26' }, archivo),
    ).rejects.toBeInstanceOf(CopiaIlegible);
  });

  it('se quedan 8 semanales y una por mes hasta 12 meses', () => {
    const semanas = Array.from({ length: 80 }, (_, i) =>
      new Date(Date.UTC(2026, 9, 26) - i * 7 * 864e5).toISOString().slice(0, 10),
    );
    const quedan = semanasQueSeQuedan(semanas);
    expect([...quedan].sort().reverse().slice(0, 8)).toEqual(semanas.slice(0, 8));
    expect(quedan.size).toBeLessThanOrEqual(8 + 12);
    expect(quedan.has(semanas.at(-1) ?? '')).toBe(false);
  });
});
