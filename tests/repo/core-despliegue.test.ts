/**
 * El CORE en el despliegue (HU-E4.1): configuración generada, base D1, permiso del token y prueba
 * de humo, con una API de Cloudflare falsa en memoria. Ninguna prueba toca Cloudflare.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  celdasDelAgro,
  celdasDelParqueadero,
  MIGRACIONES_CORE,
  RUTA_WRANGLER_CORE,
  textoWranglerDelCore,
  wranglerDeLaCelda,
  wranglerDeLaCeldaDelParqueadero,
  wranglerDelCore,
  wranglerDelSitio,
} from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import {
  asegurarBaseD1,
  configDelCore,
  huerfanasDeLaSalida,
  nombreD1Core,
  resultadosDeLaSalida,
  secretosDelCore,
} from '../../scripts/lib/d1-core.ts';
import { type Fetch, humoCore, humoEntrar, verificarToken } from '../../scripts/lib/despliegue.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const real = cargarCeldas();
const [c0] = real.celdas;
if (!c0) throw new Error('celdas.json sin celdas');

describe('configuración del CORE (P2, ADR-6)', () => {
  it('apps/core/wrangler.jsonc es exactamente el generado desde celdas.json', () => {
    expect(readFileSync(RUTA_WRANGLER_CORE, 'utf8')).toBe(textoWranglerDelCore(real));
  });

  it('no lleva ids de base ni de cuenta, y las migraciones existen', () => {
    const texto = readFileSync(RUTA_WRANGLER_CORE, 'utf8');
    expect(texto).not.toMatch(/database_id|account_id/);
    const dir = join(RAIZ, 'apps', 'core', MIGRACIONES_CORE);
    expect(readdirSync(dir).filter((f) => f.endsWith('.sql')).length).toBeGreaterThan(0);
  });

  it('el CORE vive en una celda que existe y está activa', () => {
    expect(real.celdas.find((c) => c.id === real.core.celda)?.estado).toBe('activa');
    expect(() => cargarCeldas({ ...real, core: { ...real.core, celda: 'c9' } })).toThrow(
      'El CORE apunta a la celda «c9», que no existe',
    );
  });

  it('el id de la base va solo al destino que se despliega', () => {
    const generada = wranglerDelCore(real);
    const prod = configDelCore(generada, 'produccion', {
      baseId: 'id-prod',
      flagsId: 'kv-prod',
      origenesApp: ['https://agro.ejemplo.test'],
    });
    expect(JSON.stringify(prod['d1_databases'])).toContain('"database_id":"id-prod"');
    expect(JSON.stringify(prod['env'])).not.toContain('database_id');
    const staging = configDelCore(generada, 'staging', {
      baseId: 'id-stg',
      flagsId: 'kv-stg',
      origenesApp: ['https://stg.ejemplo.test', 'http://localhost:4321'],
    });
    expect(JSON.stringify(staging['d1_databases'])).not.toContain('database_id');
    expect(JSON.stringify(staging['env'])).toContain(
      '"database_name":"agro_core_staging","migrations_dir"',
    );
    expect(JSON.stringify(staging['env'])).toContain('"database_id":"id-stg"');
  });

  it('la base se llama como dice celdas.json, con _staging en staging', () => {
    expect(nombreD1Core(real.core.d1, 'produccion')).toBe('agro_core');
    expect(nombreD1Core(real.core.d1, 'staging')).toBe('agro_core_staging');
  });

  it('el despliegue aplica migraciones y directorio antes de publicar el Worker del CORE', () => {
    const texto = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    const migra = texto.indexOf('d1 migrations apply DB --remote');
    const directorio = texto.indexOf('d1 execute DB --remote --file');
    const publica = texto.indexOf("['wrangler deploy del CORE'");
    expect(migra).toBeGreaterThan(0);
    expect(migra).toBeLessThan(directorio);
    expect(directorio).toBeLessThan(publica);
  });

  it('el archivo con el id de la base no va a git', () => {
    expect(readFileSync(join(RAIZ, '.gitignore'), 'utf8')).toContain(
      'apps/core/wrangler.despliegue.jsonc',
    );
    expect(existsSync(join(RAIZ, 'apps', 'core', 'wrangler.jsonc'))).toBe(true);
  });
});

describe('entrar con Google en el despliegue (HU-E4.2)', () => {
  it('el CORE del destino lleva el KV de flags y los orígenes del cuaderno; el otro, no', () => {
    const generada = wranglerDelCore(real);
    const prod = configDelCore(generada, 'produccion', {
      baseId: 'b',
      flagsId: 'kv-prod',
      origenesApp: ['https://agro.ejemplo.test'],
    });
    expect(prod['kv_namespaces']).toEqual([{ binding: 'FLAGS', id: 'kv-prod' }]);
    // DESTINO: el CORE de producción nunca atiende los productos de prueba (HU-C3.7).
    expect(prod['vars']).toEqual({
      ORIGENES_APP: 'https://agro.ejemplo.test',
      DESTINO: 'produccion',
    });
    expect(JSON.stringify(prod['env'])).not.toContain('ORIGENES_APP');
    const staging = configDelCore(generada, 'staging', {
      baseId: 'b',
      flagsId: 'kv-staging',
      origenesApp: ['https://agro.ejemplo.test'],
    });
    expect(
      (staging['env'] as Record<string, Record<string, unknown>>)['staging']?.['vars'],
    ).toEqual({
      ORIGENES_APP: 'https://agro.ejemplo.test',
      DESTINO: 'staging',
    });
  });

  it('carga Google siempre y genera la clave de firma solo si el Worker no tiene una', async () => {
    const google = { id: 'cliente', secreto: 'secreto' };
    const nueva = async () => 'clave-nueva';
    expect(await secretosDelCore([], google, nueva)).toEqual({
      GOOGLE_CLIENT_ID: 'cliente',
      GOOGLE_CLIENT_SECRET: 'secreto',
      CORE_JWT_PRIVATE_KEY: 'clave-nueva',
    });
    expect(await secretosDelCore(['CORE_JWT_PRIVATE_KEY'], google, nueva)).not.toHaveProperty(
      'CORE_JWT_PRIVATE_KEY',
    );
  });

  it('Bold es opcional: con las dos llaves las carga con su ambiente; con una sola, falla', async () => {
    const google = { id: 'cliente', secreto: 'secreto' };
    const nueva = async () => 'x';
    const pruebas = { identidad: 'id', secreta: 'sec', ambiente: 'pruebas' } as const;
    expect(await secretosDelCore(['CORE_JWT_PRIVATE_KEY'], google, nueva, pruebas)).toEqual({
      GOOGLE_CLIENT_ID: 'cliente',
      GOOGLE_CLIENT_SECRET: 'secreto',
      BOLD_IDENTIDAD: 'id',
      BOLD_SECRETA: 'sec',
      BOLD_AMBIENTE: 'pruebas',
    });
    const sinNinguna = { identidad: undefined, secreta: undefined, ambiente: 'pruebas' } as const;
    expect(
      await secretosDelCore(['CORE_JWT_PRIVATE_KEY'], google, nueva, sinNinguna),
    ).not.toHaveProperty('BOLD_IDENTIDAD');
    await expect(
      secretosDelCore([], google, nueva, {
        identidad: 'id',
        secreta: undefined,
        ambiente: 'produccion',
      }),
    ).rejects.toThrow('falta el secreto BOLD_SECRETA_PRODUCCION en GitHub');
  });

  it('HU-C7.7 · Telegram llega al CORE solo con el token y el chat', async () => {
    const google = { id: 'cliente', secreto: 'secreto' };
    const nueva = async () => 'x';
    expect(
      await secretosDelCore(['CORE_JWT_PRIVATE_KEY'], google, nueva, null, {
        token: 'bot',
        chat: 'chat',
      }),
    ).toMatchObject({ TELEGRAM_BOT_TOKEN: 'bot', TELEGRAM_CHAT_ID: 'chat' });
    expect(
      await secretosDelCore(['CORE_JWT_PRIVATE_KEY'], google, nueva, null, {
        token: 'bot',
        chat: undefined,
      }),
    ).not.toHaveProperty('TELEGRAM_BOT_TOKEN');
  });

  it('sin los secretos de Google en GitHub falla nombrándolos', async () => {
    await expect(
      secretosDelCore([], { id: undefined, secreto: undefined }, async () => 'x'),
    ).rejects.toThrow('falta el secreto GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en GitHub');
  });

  it('los secretos van a wrangler por stdin, nunca en un archivo ni en la línea de comandos (P13)', () => {
    const texto = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    expect(texto).toMatch(/`secret bulk \$\{c\}`, cred, JSON\.stringify\(secretos\)\)/);
    expect(texto).not.toMatch(/writeFileSync\([^)]*secretos/);
  });

  it('el flujo pasa los secretos de Google al paso de despliegue', () => {
    // Los secretos se pasan en el flujo reutilizable que despliega cada destino (4 oct 2026).
    const flujo = readFileSync(join(RAIZ, '.github', 'workflows', 'desplegar-destino.yml'), 'utf8');
    for (const secreto of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) {
      expect(flujo).toContain(`${secreto}: \${{ secrets.${secreto} }}`);
    }
  });

  const inicioQueVaA = (location: string, estado = 302) =>
    (async (url: string) =>
      String(url).includes('/claves')
        ? Response.json({ claves: [{ x: 'a' }] })
        : new Response(null, { status: estado, headers: { location } })) as unknown as Fetch;
  const base = 'https://core.ejemplo.test';
  const bien = `https://accounts.google.com/o/oauth2/v2/auth?client_id=cliente&redirect_uri=${encodeURIComponent(`${base}/api/core/auth/google/callback`)}`;

  it('la prueba de humo pasa cuando el inicio manda a Google con el cliente y el regreso correctos', async () => {
    expect(
      await humoEntrar(inicioQueVaA(bien), base, {
        clienteId: 'cliente',
        origenApp: 'https://agro.ejemplo.test',
      }),
    ).toEqual([]);
  });

  it('falla con otro client_id, otra dirección de regreso o sin redirección', async () => {
    const esperado = { clienteId: 'otro', origenApp: 'https://agro.ejemplo.test' };
    expect(await humoEntrar(inicioQueVaA(bien), base, esperado)).toEqual([
      'entrar: Google recibe otro client_id que el del secreto GOOGLE_CLIENT_ID',
    ]);
    const otroRegreso = bien.replace('core.ejemplo.test', 'otro.test');
    expect(
      (await humoEntrar(inicioQueVaA(otroRegreso), base, { ...esperado, clienteId: 'cliente' }))[0],
    ).toMatch(/la dirección de regreso es https:\/\/otro\.test/);
    expect(
      (await humoEntrar(inicioQueVaA('', 503), base, { ...esperado, clienteId: 'cliente' }))[0],
    ).toMatch(/respondió 503/);
  });
});

/** Cloudflare D1 en memoria. La búsqueda por nombre es por contenido, como la API real. */
function d1Falso(opciones: { bases?: string[]; fallar?: number } = {}) {
  const bases = (opciones.bases ?? []).map((name, i) => ({ uuid: `u${i}`, name }));
  const creadas: string[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    if (opciones.fallar) return new Response('{}', { status: opciones.fallar });
    const u = new URL(url);
    if ((init?.method ?? 'GET') === 'GET') {
      const nombre = u.searchParams.get('name') ?? '';
      return Response.json({ success: true, result: bases.filter((b) => b.name.includes(nombre)) });
    }
    const { name } = JSON.parse(String(init?.body)) as { name: string };
    creadas.push(name);
    return Response.json({ success: true, result: { uuid: 'nueva', name } });
  }) as Fetch;
  return { fn, creadas };
}

describe('base D1 del CORE en el despliegue', () => {
  it('reusa la base con el nombre exacto, aunque otra la contenga', async () => {
    const { fn, creadas } = d1Falso({ bases: ['agro_core_staging', 'agro_core'] });
    expect(await asegurarBaseD1(fn, 't', 'a', 'agro_core')).toEqual({ id: 'u1', creada: false });
    expect(creadas).toEqual([]);
  });

  it('la crea si solo existe una de nombre parecido', async () => {
    const { fn, creadas } = d1Falso({ bases: ['agro_core_staging'] });
    expect(await asegurarBaseD1(fn, 't', 'a', 'agro_core')).toEqual({ id: 'nueva', creada: true });
    expect(creadas).toEqual(['agro_core']);
  });

  it('sin permiso nombra el permiso', async () => {
    const { fn } = d1Falso({ fallar: 403 });
    await expect(asegurarBaseD1(fn, 't', 'a', 'agro_core')).rejects.toThrow(
      'al token le falta «Account → D1: Edit»',
    );
  });
});

describe('verificar el permiso de D1 (P12)', () => {
  const respuestas = (d1: number) =>
    (async (url: string) => {
      if (url.includes('tokens/verify')) return Response.json({ result: { status: 'active' } });
      if (url.includes('/d1/database')) return new Response('{}', { status: d1 });
      return Response.json({ result: [] });
    }) as Fetch;

  it('en la celda del CORE, sin D1 nombra el permiso', async () => {
    expect(await verificarToken(respuestas(403), c0, 't', 'a', 'staging', 'x.com', true)).toEqual([
      'c0: al token le falta «Account → D1: Edit» en la cuenta ED1 principal',
    ]);
  });

  it('en otra celda no pide D1', async () => {
    expect(await verificarToken(respuestas(403), c0, 't', 'a', 'staging', 'x.com')).toEqual([]);
  });
});

describe('prueba de humo del CORE', () => {
  const responde = (estado: number, cuerpo: unknown) =>
    (async () => Response.json(cuerpo, { status: estado })) as unknown as Fetch;

  it('pasa con 200 y las celdas activas de celdas.json', async () => {
    expect(await humoCore(responde(200, { estado: 'ok', celdas: 1 }), 'https://x', 1)).toEqual([]);
  });

  it('un 503 cita el motivo', async () => {
    expect(
      await humoCore(responde(503, { estado: 'sin-celdas', motivo: 'vacío' }), 'https://x', 1),
    ).toEqual(['/api/core/salud: respondió 503 (sin-celdas: vacío)']);
  });

  it('un directorio que no coincide con celdas.json falla', async () => {
    expect(await humoCore(responde(200, { estado: 'ok', celdas: 2 }), 'https://x', 1)).toEqual([
      '/api/core/salud: el directorio tiene 2 celdas activas y celdas.json 1',
    ]);
  });
});

describe('sin huérfanas antes de migrar el CORE (HU-C2.2, CA4b)', () => {
  it('sin filas en foreign_key_check, se puede migrar', () => {
    const salida = `[{"results":[],"success":true,"meta":{"duration":0.2}}]`;
    expect(huerfanasDeLaSalida(salida)).toEqual([]);
  });

  it('con huérfanas, las nombra una por una', () => {
    const salida =
      'Executing on remote database agro_core:\n' +
      '[{"results":[{"table":"membresia","rowid":7,"parent":"organizacion","fkid":0}],"success":true}]';
    expect(huerfanasDeLaSalida(salida)).toEqual([
      'membresia (fila 7) apunta a una fila de organizacion que no existe',
    ]);
  });

  it.each([
    ['una salida sin JSON', 'X [ERROR] no autorizado'],
    ['un lote que no tuvo éxito', '[{"results":[],"success":false}]'],
    ['un JSON roto', '[{"results":[}]'],
  ])('con %s no se sabe, y no se migra (P1)', (_caso, salida) => {
    expect(huerfanasDeLaSalida(salida)).toBeNull();
  });
});

describe('leer varias consultas de wrangler d1 execute --json (HU-C2.3)', () => {
  it('devuelve las filas de cada consulta, en orden, aunque haya texto antes', () => {
    const salida =
      '🌀 Executing on remote database agro_core_staging:\n' +
      '[{"results":[{"id":"agro"}],"success":true},{"results":[],"success":true}]';
    expect(resultadosDeLaSalida(salida)).toEqual([[{ id: 'agro' }], []]);
  });
});

describe('HU-C4.6 · el dominio de la cuenta', () => {
  const config = cargarCeldas();
  /** Los dominios de producción que declara alguna configuración de staging. */
  const dominiosEnStaging = (configs: Record<string, unknown>[], dominios: string[]) =>
    configs.flatMap((c) => {
      const env = (c['env'] as Record<string, { routes?: { pattern: string }[] }>)['staging'];
      // Sin `routes` propias, staging hereda las de arriba: también cuenta.
      const rutas = env?.routes ?? (c['routes'] as { pattern: string }[] | undefined) ?? [];
      return rutas.map((r) => r.pattern).filter((p) => dominios.includes(p));
    });
  const deProduccion = [config.sitio.dominio, config.core.dominio ?? ''].filter(Boolean);

  it('CA1 · el CORE de producción tiene su Custom Domain, generado desde celdas.json', () => {
    expect(config.core.dominio).toBe('cuenta.laboratorio-digital.com');
    expect(wranglerDelCore(config)['routes']).toEqual([
      { pattern: 'cuenta.laboratorio-digital.com', custom_domain: true },
    ]);
  });

  it('CA2 · la URL de workers.dev sigue viva en producción', () => {
    expect(wranglerDelCore(config)['workers_dev']).toBe(true);
  });

  it('CA4 ❌ · ningún Worker de staging declara un dominio de producción', () => {
    const generadas = [
      wranglerDelSitio(config),
      wranglerDelCore(config),
      ...celdasDelAgro(config).map((c) => wranglerDeLaCelda(c, config.core)),
      ...celdasDelParqueadero(config).map((c) => wranglerDeLaCeldaDelParqueadero(c)),
    ];
    expect(dominiosEnStaging(generadas, deProduccion)).toEqual([]);
    // Control negativo: si staging hereda las rutas del CORE, se ve.
    const mal = wranglerDelCore(config);
    const { routes: _, ...stagingSinRutas } =
      (mal['env'] as Record<string, Record<string, unknown>>)['staging'] ?? {};
    expect(
      dominiosEnStaging([{ ...mal, env: { staging: stagingSinRutas } }], deProduccion),
    ).toEqual(['cuenta.laboratorio-digital.com']);
  });

  it('el token tiene que poder editar las rutas de cada zona con dominio, no solo la del sitio', async () => {
    const pedidas: string[] = [];
    const fn = (async (url: string) => {
      pedidas.push(String(url));
      if (String(url).includes('tokens/verify'))
        return Response.json({ result: { status: 'active' } });
      if (String(url).includes('zones?name=laboratorio-digital.com'))
        return Response.json({ result: [] }); // el token no ve esta zona
      if (String(url).includes('zones?name=')) return Response.json({ result: [{ id: 'z1' }] });
      return Response.json({ success: true, result: [] });
    }) as unknown as Fetch;
    const fallas = await verificarToken(
      fn,
      config.celdas[0] as (typeof config.celdas)[number],
      't',
      'a',
      'produccion',
      ['cultivopro.co', 'laboratorio-digital.com'],
    );
    expect(fallas).toEqual([
      'c0: el token no ve la zona laboratorio-digital.com; le falta «Zone → Workers Routes: Edit» en esa zona',
    ]);
  });
});
