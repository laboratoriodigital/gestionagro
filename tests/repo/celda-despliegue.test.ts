/**
 * La API de la celda en el despliegue (HU-E5.1): configuración generada por celda, ids solo en el
 * destino, clave del CORE y prueba de humo. Con `fetch` falso: nada toca Cloudflare.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  celdasDelAgro,
  celdasDelParqueadero,
  MIGRACIONES_CELDA,
  MIGRACIONES_PARQUEADERO,
  presupuestoDeLaCelda,
  rutaWranglerCelda,
  rutaWranglerCeldaDelParqueadero,
  textoWranglerDeLaCelda,
  textoWranglerDeLaCeldaDelParqueadero,
  wranglerDeLaCelda,
  wranglerDeLaCeldaDelParqueadero,
} from '../../scripts/generar-wrangler.ts';
import {
  clavesDelCore,
  configDeLaCelda,
  humoCelda,
  secretosDeLaCelda,
} from '../../scripts/lib/api-celda.ts';
import {
  celdasDelDirectorio,
  configDeLaCeldaDelParqueadero,
  notaSinProduccion,
  origenesDeLaCaja,
  preparaLasCeldasDelParqueadero,
  SECRETO_DE_RECIBOS,
  secretosDeLaCeldaDelParqueadero,
  TABLAS_DEL_SHARD,
  tablasQueFaltan,
} from '../../scripts/lib/celda-parqueadero.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { clavesQrDe, conClavesQr } from '../../scripts/lib/claves-qr.ts';
import { productoDeLaBase, productosDeLasBases } from '../../scripts/lib/d1-core.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';
import { productosADesplegar } from '../../scripts/lib/publicacion.ts';
import { cargarProductos } from '../../scripts/lib/registro-productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const real = cargarCeldas();

describe('configuración de la API por celda (P2, ADR-6)', () => {
  it.each(celdasDelAgro(real).map((c) => [c.id, c] as const))(
    'wrangler.%s.jsonc es el generado, sin ids, con un binding por shard',
    (_id, celda) => {
      const texto = readFileSync(rutaWranglerCelda(celda.id), 'utf8');
      expect(texto).toBe(textoWranglerDeLaCelda(celda));
      expect(texto).not.toMatch(/database_id|account_id/);
      const generada = wranglerDeLaCelda(celda) as { d1_databases: { binding: string }[] };
      expect(generada.d1_databases.map((d) => d.binding)).toEqual(celda.shards);
    },
  );

  it('las URL de la API siguen el nombre del Worker de cada celda, con su producto', () => {
    for (const c of real.celdas) {
      expect(new URL(c.api).hostname.split('.')[0]).toBe(`${c.producto}-api-${c.id}`);
      expect(new URL(c.api_staging).hostname.split('.')[0]).toBe(
        `${c.producto}-api-${c.id}-staging`,
      );
    }
  });

  it('ninguna celda del parqueadero lleva el Worker del agro (HU-Q7.2)', () => {
    for (const c of celdasDelParqueadero(real)) {
      expect(existsSync(rutaWranglerCelda(c.id)), c.id).toBe(false);
    }
  });

  it('la carpeta de migraciones de la celda existe', () => {
    expect(
      existsSync(join(RAIZ, 'apps', 'api-celda', MIGRACIONES_CELDA, '0001_celda_v1.sql')),
    ).toBe(true);
  });

  const [c0] = real.celdas;
  if (!c0) throw new Error('celdas.json sin celdas');
  const despliegue = {
    bases: Object.fromEntries(c0.shards.map((s) => [s, `id-${s}`])),
    flagsId: 'kv',
    clavesCore: [{ kid: 'k1' }],
    origenesApp: ['https://agro.ejemplo.test'],
    cuenta: 'cuenta-ensayo',
    productosDeLasBases: { 'id-agro_c0_s1': 'agro', 'id-agro_core': 'core' },
  };

  it('ids de bases, KV, clave del CORE, orígenes y cuenta van solo al destino; CELDA, PRODUCTO y PLAN se conservan', () => {
    const staging = configDeLaCelda(wranglerDeLaCelda(c0), 'staging', despliegue);
    const env = (staging['env'] as Record<string, Record<string, unknown>>)['staging'] ?? {};
    expect(env['vars']).toEqual({
      CELDA: c0.id,
      PRODUCTO: c0.producto,
      PLAN: c0.plan,
      ...presupuestoDeLaCelda(c0),
      CORE_CLAVES: '[{"kid":"k1"}]',
      ORIGENES_APP: 'https://agro.ejemplo.test',
      CF_CUENTA: 'cuenta-ensayo',
      PRODUCTO_DE_BASE: '{"id-agro_c0_s1":"agro","id-agro_core":"core"}',
      DESTINO: 'staging',
    });
    expect(JSON.stringify(env['d1_databases'])).toContain(`"database_id":"id-${c0.shards[0]}"`);
    expect(JSON.stringify(staging['d1_databases'])).not.toContain('database_id');
    expect(staging['vars']).toEqual({
      CELDA: c0.id,
      PRODUCTO: c0.producto,
      PLAN: c0.plan,
      ...presupuestoDeLaCelda(c0),
    });
  });

  it('HU-E8.2: el vigía corre cada hora en los dos destinos', () => {
    const g = wranglerDeLaCelda(c0) as {
      triggers: unknown;
      env: { staging: { triggers: unknown } };
    };
    expect(g.triggers).toEqual({ crons: ['0 * * * *'] });
    expect(g.env.staging.triggers).toEqual({ crons: ['0 * * * *'] });
  });

  it('un shard sin id de base no se despliega', () => {
    expect(() =>
      configDeLaCelda(wranglerDeLaCelda(c0), 'produccion', { ...despliegue, bases: {} }),
    ).toThrow(`falta el id de la base del shard ${c0.shards[0]}`);
  });

  it('el despliegue publica el CORE antes que la API (la celda necesita su clave) y no versiona los ids', () => {
    const texto = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    const bucle = texto.slice(texto.indexOf('for (const celda of plan.aDesplegar)'));
    expect(bucle.indexOf('desplegarCore(')).toBeGreaterThan(0);
    expect(bucle.indexOf('desplegarCore(')).toBeLessThan(bucle.indexOf('desplegarApiCelda('));
    expect(readFileSync(join(RAIZ, '.gitignore'), 'utf8')).toContain(
      'apps/api-celda/wrangler.despliegue.jsonc',
    );
  });
});

describe('clave pública del CORE para la celda', () => {
  const responde = (estado: number, cuerpo: unknown) =>
    (async () => Response.json(cuerpo, { status: estado })) as unknown as Fetch;

  it('trae las claves que publica el CORE', async () => {
    expect(await clavesDelCore(responde(200, { claves: [{ kid: 'k' }] }), 'https://core')).toEqual([
      { kid: 'k' },
    ]);
  });

  it('sin clave no hay celda: falla y dice que se despliegue el CORE primero', async () => {
    await expect(clavesDelCore(responde(503, {}), 'https://core')).rejects.toThrow(
      'no entregó su clave pública (HTTP 503); despliega el CORE primero',
    );
  });
});

describe('prueba de humo de la celda', () => {
  const celdaFalsa = (salud: { estado: number; cuerpo: unknown }, sinToken = 401) =>
    (async (url: string) =>
      String(url).endsWith('/api/salud')
        ? Response.json(salud.cuerpo, { status: salud.estado })
        : Response.json({}, { status: sinToken })) as unknown as Fetch;

  it('pasa con los shards de celdas.json y 401 sin token', async () => {
    expect(
      await humoCelda(celdaFalsa({ estado: 200, cuerpo: { shards: 1 } }), 'https://api', 1),
    ).toEqual([]);
  });

  it('nombra el motivo de un 503, un número de shards distinto y una API abierta sin token', async () => {
    expect(
      await humoCelda(
        celdaFalsa({ estado: 503, cuerpo: { motivo: 'Falta CORE_CLAVES' } }),
        'https://api',
        1,
      ),
    ).toEqual(['/api/salud: respondió 503 (Falta CORE_CLAVES)']);
    expect(
      await humoCelda(celdaFalsa({ estado: 200, cuerpo: { shards: 2 } }), 'https://api', 1),
    ).toEqual(['/api/salud: la celda tiene 2 shards y celdas.json 1']);
    expect(
      await humoCelda(celdaFalsa({ estado: 200, cuerpo: { shards: 1 } }, 200), 'https://api', 1),
    ).toEqual(['/api/v1/yo sin token: respondió 200, se esperaba 401']);
  });
});

describe('HU-E6.4 · claves del QR en la página y clave de firma de la celda', () => {
  const PAGINA =
    '<main><script type="application/json" id="claves-qr">[]</script><h1>Trazabilidad</h1></main>';

  it('pone las claves dentro de la página, sin que una clave pueda cerrar el bloque', () => {
    const html = conClavesQr(PAGINA, [{ kid: 'k1', x: 'abc' }]);
    expect(html).toContain('id="claves-qr">[{"kid":"k1","x":"abc"}]</script>');
    expect(conClavesQr(PAGINA, [{ kid: '</script>', x: 'y' }])).not.toContain('"</script>');
    expect(() => conClavesQr('<main></main>', [])).toThrow('no tiene el bloque #claves-qr');
  });

  it('la plantilla de la página trae el bloque que el despliegue reemplaza', () => {
    expect(
      readFileSync(join(RAIZ, 'apps', 'sitio', 'src', 'pages', 'agro', 't', 'index.astro'), 'utf8'),
    ).toContain('<script type="application/json" id="claves-qr" is:inline>[]</script>');
  });

  it('lee las claves de la celda, y dice por qué si no las da', async () => {
    const fetchFn = (async () =>
      Response.json({ claves: [{ kid: 'k1', x: 'abc', otro: 'no' }] })) as unknown as Fetch;
    expect(await clavesQrDe(fetchFn, 'https://api')).toEqual([{ kid: 'k1', x: 'abc' }]);
    const sin = (async () =>
      Response.json({ estado: 'sin-configurar' }, { status: 503 })) as unknown as Fetch;
    await expect(clavesQrDe(sin, 'https://api')).rejects.toThrow('HTTP 503');
  });

  it('la clave de firma se genera solo si la celda no tiene una; el token de métricas, si existe', async () => {
    const nueva = async () => 'clave-nueva';
    expect(
      await secretosDeLaCelda([], 'tok', 'CF_METRICAS_TOKEN', nueva, { token: 'bot', chat: '1' }),
    ).toEqual({
      secretos: {
        CF_METRICAS_TOKEN: 'tok',
        CELDA_QR_PRIVATE_KEY: 'clave-nueva',
        TELEGRAM_BOT_TOKEN: 'bot',
        TELEGRAM_CHAT_ID: '1',
      },
      avisos: [],
      claveNueva: true,
    });
    const r = await secretosDeLaCelda(
      ['CELDA_QR_PRIVATE_KEY'],
      undefined,
      'CF_METRICAS_TOKEN',
      nueva,
    );
    expect(r.secretos).toEqual({});
    expect(r.claveNueva).toBe(false);
    expect(r.avisos[0]).toContain('falta el secreto CF_METRICAS_TOKEN');
    expect(r.avisos[1]).toContain('falta TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID');
  });

  it('el sitio se publica después de la API de la celda, que es de donde salen las claves', () => {
    const texto = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    const bucle = texto.slice(texto.indexOf('for (const celda of plan.aDesplegar)'));
    expect(bucle.indexOf('desplegarApiCelda(')).toBeLessThan(bucle.indexOf('desplegarSitio('));
  });
});

describe('qué producto escribe en cada base (HU-Q7.13)', () => {
  it('el CORE, los shards por su prefijo y las de staging aparte; otra base no se adivina', () => {
    expect(productoDeLaBase('agro_core', 'agro_core')).toBe('core');
    expect(productoDeLaBase('agro_core_staging', 'agro_core')).toBe('core (staging)');
    expect(productoDeLaBase('agro_c0_s1', 'agro_core')).toBe('agro');
    expect(productoDeLaBase('parqueadero_c2_s1_staging', 'agro_core')).toBe(
      'parqueadero (staging)',
    );
    expect(productoDeLaBase('mi-prueba', 'agro_core')).toBeNull();
    expect(productoDeLaBase('agro_c0', 'agro_core')).toBeNull();
  });

  it('lista todas las bases de la cuenta, página por página, y dice el permiso que falta', async () => {
    const paginas = [
      Array.from({ length: 100 }, (_, i) => ({ uuid: `u${i}`, name: `agro_c0_s${i + 1}` })),
      [
        { uuid: 'core', name: 'agro_core' },
        { uuid: 'x', name: 'otra' },
      ],
    ];
    const pedidas: string[] = [];
    const falso: Fetch = async (url) => {
      pedidas.push(String(url));
      const pagina = Number(new URL(String(url)).searchParams.get('page'));
      return new Response(JSON.stringify({ result: paginas[pagina - 1] ?? [] }));
    };
    const mapa = await productosDeLasBases(falso, 't', 'cuenta', 'agro_core');
    expect(pedidas).toHaveLength(2);
    expect(Object.keys(mapa)).toHaveLength(101);
    expect(mapa['core']).toBe('core');
    expect(mapa['x']).toBeUndefined();
    const sinPermiso: Fetch = async () => new Response('{}', { status: 403 });
    await expect(productosDeLasBases(sinPermiso, 't', 'cuenta', 'agro_core')).rejects.toThrow(
      'al token le falta «Account → D1: Edit»',
    );
  });
});

describe('las celdas del parqueadero (HU-Q7.2)', () => {
  const celdas = celdasDelParqueadero(real);

  it('hay una, c2, con su shard parqueadero_c2_s1', () => {
    expect(celdas.map((c) => [c.id, c.shards])).toEqual([['c2', ['parqueadero_c2_s1']]]);
  });

  it.each(celdas.map((c) => [c.id, c] as const))(
    'apps/parqueadero-api/wrangler.%s.jsonc es el generado, con su Worker y sin ids',
    (_id, celda) => {
      const texto = readFileSync(rutaWranglerCeldaDelParqueadero(celda.id), 'utf8');
      expect(texto).toBe(textoWranglerDeLaCeldaDelParqueadero(celda));
      expect(texto).not.toMatch(/database_id|account_id/);
      expect(texto).toContain('"main": "src/worker.ts"');
      const generada = wranglerDeLaCeldaDelParqueadero(celda) as {
        name: string;
        d1_databases: { binding: string; database_name: string; migrations_dir: string }[];
        env: { staging: { name: string; d1_databases: { database_name: string }[] } };
      };
      expect(generada.name).toBe(`parqueadero-api-${celda.id}`);
      expect(generada.env.staging.name).toBe(`parqueadero-api-${celda.id}-staging`);
      expect(generada.d1_databases.map((d) => d.binding)).toEqual(celda.shards);
      expect(generada.env.staging.d1_databases.map((d) => d.database_name)).toEqual(
        celda.shards.map((s) => `${s}_staging`),
      );
      expect(new Set(generada.d1_databases.map((d) => d.migrations_dir))).toEqual(
        new Set([MIGRACIONES_PARQUEADERO]),
      );
    },
  );

  it('su carpeta de migraciones existe, junto a la configuración', () => {
    expect(
      existsSync(
        join(RAIZ, 'apps', 'parqueadero-api', MIGRACIONES_PARQUEADERO, '0001_parqueadero_v1.sql'),
      ),
    ).toBe(true);
  });

  it('el despliegue pone los ids, el KV, las claves del CORE y la caja solo en el destino que prepara', () => {
    const [c2] = celdas;
    if (!c2) throw new Error('sin celda del parqueadero');
    const despliegue = {
      bases: { parqueadero_c2_s1: 'id-s1' },
      flagsId: 'id-kv',
      clavesCore: [{ kid: 'k1' }],
      origenesApp: ['https://caja.ejemplo.test'],
    };
    const staging = configDeLaCeldaDelParqueadero(
      wranglerDeLaCeldaDelParqueadero(c2),
      'staging',
      despliegue,
    ) as Record<string, unknown> & {
      d1_databases: object[];
      env: { staging: Record<string, unknown> & { d1_databases: object[] } };
    };
    expect(staging.env.staging.d1_databases).toEqual([
      expect.objectContaining({ database_id: 'id-s1', database_name: 'parqueadero_c2_s1_staging' }),
    ]);
    expect(staging.env.staging['kv_namespaces']).toEqual([{ binding: 'FLAGS', id: 'id-kv' }]);
    expect(staging.env.staging['vars']).toEqual({
      CELDA: 'c2',
      PRODUCTO: 'parqueadero',
      PLAN: 'free',
      CORE_CLAVES: '[{"kid":"k1"}]',
      ORIGENES_APP: 'https://caja.ejemplo.test',
    });
    expect(JSON.stringify(staging.d1_databases)).not.toContain('database_id');
    expect(staging['kv_namespaces']).toBeUndefined();
    expect(() =>
      configDeLaCeldaDelParqueadero(wranglerDeLaCeldaDelParqueadero(c2), 'staging', {
        ...despliegue,
        bases: {},
      }),
    ).toThrow(/falta el id de la base del shard parqueadero_c2_s1/);
  });

  it('el CORS de su API es el origen de la caja de ese destino (productos.json)', () => {
    const parqueadero = cargarProductos().productos.find((p) => p.id === 'parqueadero');
    expect(origenesDeLaCaja(parqueadero, 'staging')).toEqual([
      'https://ed1-parqueadero-staging.laboratoriodigital-la.workers.dev',
    ]);
    expect(origenesDeLaCaja(parqueadero, 'produccion')).toEqual([
      'https://parqueadero.laboratorio-digital.app',
    ]);
    const agro = cargarProductos().productos.find((p) => p.id === 'agro');
    expect(() => origenesDeLaCaja(agro, 'staging')).toThrow(/no declara los orígenes/);
  });

  it('en producción no entra al directorio del CORE ni se prepara (staging sí)', () => {
    const ids = (destino: 'staging' | 'produccion') =>
      celdasDelDirectorio(real.celdas, destino).map((c) => c.id);
    expect(ids('staging')).toContain('c2');
    expect(ids('produccion')).not.toContain('c2');
    expect(ids('produccion')).toContain('c0');
    expect(notaSinProduccion('c2')).toMatch(/c2 del parqueadero: en producción todavía no/);
  });

  it('staging la prepara aunque su lista de productos sea la de siempre (core y agro)', () => {
    // La corrida de staging de #145 no la pidió con «parqueadero» y se la saltó.
    expect(preparaLasCeldasDelParqueadero('staging', productosADesplegar(undefined))).toBe(true);
    expect(preparaLasCeldasDelParqueadero('produccion', productosADesplegar(undefined))).toBe(
      false,
    );
    expect(preparaLasCeldasDelParqueadero('produccion', productosADesplegar('parqueadero'))).toBe(
      true,
    );
  });

  it('HU-Q8.1 CA3 ❌: la llave de recibos se genera una vez y el despliegue nunca la reemplaza', async () => {
    let generadas = 0;
    const nueva = async () => {
      generadas++;
      return 'llave-nueva';
    };
    expect(await secretosDeLaCeldaDelParqueadero([], nueva)).toEqual({
      secretos: { CELDA_RECIBO_PRIVATE_KEY: 'llave-nueva' },
      claveNueva: true,
    });
    expect(
      await secretosDeLaCeldaDelParqueadero(['CF_METRICAS_TOKEN', SECRETO_DE_RECIBOS], nueva),
    ).toEqual({ secretos: {}, claveNueva: false });
    expect(generadas).toBe(1);
    // El despliegue solo la carga cuando es nueva: nunca manda la llave sin ese aviso.
    const texto = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    const paso = texto.slice(texto.indexOf('async function prepararCeldaDelParqueadero'));
    expect(paso).toMatch(/if \(deLaCelda\.claveNueva\) \{\s+const carga = wrangler\(/);
    expect(texto.match(/secretosDeLaCeldaDelParqueadero\(/g)).toHaveLength(1);
  });

  it('la prueba de humo del shard lee la lista de tablas de wrangler --json', () => {
    const salida = (nombres: readonly string[]) =>
      `⛅️ wrangler\n${JSON.stringify([{ results: nombres.map((name) => ({ name })), success: true }])}`;
    expect(tablasQueFaltan(salida(TABLAS_DEL_SHARD))).toEqual([]);
    expect(tablasQueFaltan(salida(TABLAS_DEL_SHARD.filter((t) => t !== 'registro')))).toEqual([
      'registro',
    ]);
    expect(tablasQueFaltan('✘ [ERROR] no such table')).toBeNull();
    // wrangler escribe avisos con corchetes antes y después del JSON (stdout y stderr juntos).
    const conAvisos = `\u001b[33m▲ [WARNING] Proxy environment variables detected.\n\n${salida(TABLAS_DEL_SHARD).split('\n')[1]}\n▲ [WARNING] otra cosa [x]\n`;
    expect(tablasQueFaltan(conAvisos)).toEqual([]);
  });
});
