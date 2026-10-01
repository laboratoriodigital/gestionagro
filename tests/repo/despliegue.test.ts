import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUTAS_APP, rutaDe } from '../../apps/cuaderno/src/rutas.ts';
import { RUTA_WRANGLER_SITIO, textoWranglerDelSitio } from '../../scripts/generar-wrangler.ts';
import {
  type ConfigCeldas,
  cargarCeldas,
  planDeDespliegue,
  secretosDeCeldas,
} from '../../scripts/lib/celdas.ts';
import {
  causaDeWrangler,
  type Fetch,
  humo,
  resumenDespliegue,
  urlDeWorkersDev,
  verificarToken,
} from '../../scripts/lib/despliegue.ts';
import { secretosDocumentados } from '../../scripts/lib/flujos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const real = cargarCeldas();
const c0 = real.celdas[0];
if (!c0) throw new Error('celdas.json sin celdas');

const conCeldas = (celdas: Partial<ConfigCeldas['celdas'][number]>[]): ConfigCeldas => ({
  ...real,
  celdas: celdas.map((c, i) => ({ ...c0, id: `c${i}`, ...c })),
});

describe('celdas.json, fuente única (HU-E1.5, CA1)', () => {
  it('el real es válido y el sitio vive en una celda activa', () => {
    expect(real.sitio.dominio).toBe('agro.laboratorio-digital.com');
    expect(real.celdas.find((c) => c.id === real.sitio.celda)?.estado).toBe('activa');
  });

  it('wrangler.jsonc del sitio es exactamente el generado (P2)', () => {
    expect(readFileSync(RUTA_WRANGLER_SITIO, 'utf8')).toBe(textoWranglerDelSitio(real));
  });

  it('ningún id de cuenta ni token queda escrito en la configuración (ADR-6)', () => {
    const texto =
      readFileSync(RUTA_WRANGLER_SITIO, 'utf8') +
      readFileSync(join(RAIZ, 'infrastructure', 'celdas.json'), 'utf8');
    expect(texto).not.toMatch(/\b[0-9a-f]{32}\b/);
  });

  it('el sitio solo ejecuta el Worker en /api/* (ED1 [H3])', () => {
    expect(
      JSON.parse(textoWranglerDelSitio(real).replace(/^\/\/.*\n/, '')).assets.run_worker_first,
    ).toEqual(['/api/*']);
  });

  it.each([
    ['ids repetidos', { ...real, celdas: [c0, c0] }, /repite ids/],
    [
      'sitio en una celda que no existe',
      { ...real, sitio: { ...real.sitio, celda: 'c9' } },
      /no existe/,
    ],
    [
      'sitio en una celda «fuera»',
      { ...real, celdas: [{ ...c0, estado: 'fuera' }] },
      /está «fuera»/,
    ],
    ['campo desconocido', { ...real, extra: 1 }, /inválido/],
  ])('rechaza %s', (_caso, datos, motivo) => {
    expect(() => cargarCeldas(datos)).toThrow(motivo);
  });
});

describe('orden del despliegue (CA3, CA4)', () => {
  const config = conCeldas([
    { anillo_despliegue: 2 },
    { anillo_despliegue: 0 },
    { anillo_despliegue: 1, estado: 'fuera' },
    { anillo_despliegue: 1 },
  ]);

  it('va por anillo y deja fuera las marcadas «fuera»', () => {
    const plan = planDeDespliegue(config);
    expect(plan.aDesplegar.map((c) => c.id)).toEqual(['c1', 'c3', 'c0']);
    expect(plan.fuera.map((c) => c.id)).toEqual(['c2']);
  });

  it('«solo» despliega una celda, y nunca una «fuera»', () => {
    expect(planDeDespliegue(config, 'c3').aDesplegar.map((c) => c.id)).toEqual(['c3']);
    expect(() => planDeDespliegue(config, 'c2')).toThrow(/está «fuera»/);
    expect(() => planDeDespliegue(config, 'c7')).toThrow(/No existe/);
  });
});

describe('secretos de las celdas (P18)', () => {
  const flujo = readFileSync(join(RAIZ, '.github', 'workflows', 'desplegar.yml'), 'utf8');
  const documentados = secretosDocumentados(
    readFileSync(join(RAIZ, 'docs', 'ARQUITECTURA.md'), 'utf8'),
  );

  it.each(secretosDeCeldas(real))('%s está en ARQUITECTURA §7.5 y el flujo lo pasa', (secreto) => {
    expect(documentados).toContain(secreto);
    expect(flujo).toContain(`\${{ secrets.${secreto} }}`);
  });
});

/** fetch falso: responde según la ruta; registra lo que se pidió. */
function fetchFalso(
  respuestas: Record<
    string,
    { estado: number; cuerpo?: unknown; texto?: string; cabeceras?: Record<string, string> }
  >,
) {
  const pedidos: string[] = [];
  const fn = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    const clave = `${init?.method ?? 'GET'} ${url}`;
    pedidos.push(clave);
    // Primero la coincidencia exacta; si no hay, la parcial (para rutas de la API de Cloudflare).
    const r = respuestas[clave] ??
      Object.entries(respuestas).find(([patron]) => clave.includes(patron))?.[1] ?? {
        estado: 404,
      };
    const cuerpo = r.texto ?? JSON.stringify(r.cuerpo ?? {});
    const sinCuerpo = r.estado === 204 || (r.estado >= 300 && r.estado < 400);
    return new Response(sinCuerpo ? null : cuerpo, {
      status: r.estado,
      headers: r.cabeceras ?? {},
    });
  }) as Fetch;
  return { fn, pedidos };
}

const tokenActivo = {
  'tokens/verify': { estado: 200, cuerpo: { success: true, result: { status: 'active' } } },
  'storage/kv/namespaces': { estado: 200, cuerpo: { success: true, result: [] } },
};

describe('verificar el token antes de desplegar (CA2, P12)', () => {
  it('con permisos completos no hay fallas', async () => {
    const { fn } = fetchFalso({
      ...tokenActivo,
      'workers/scripts': { estado: 200, cuerpo: { success: true, result: [] } },
      'zones?name=': { estado: 200, cuerpo: { result: [{ id: 'z1' }] } },
      'zones/z1/workers/routes': { estado: 200, cuerpo: { result: [] } },
    });
    expect(await verificarToken(fn, c0, 't', 'a', 'produccion', 'laboratorio-digital.com')).toEqual(
      [],
    );
  });

  it('sin el secreto, lo nombra', async () => {
    const { fn, pedidos } = fetchFalso({});
    expect(await verificarToken(fn, c0, undefined, 'a', 'staging', 'x.com')).toEqual([
      'c0: falta el secreto CF_API_TOKEN en GitHub',
    ]);
    expect(pedidos).toEqual([]);
  });

  it('un token vencido se dice como vencido', async () => {
    const { fn } = fetchFalso({
      'tokens/verify': { estado: 200, cuerpo: { result: { status: 'expired' } } },
    });
    expect((await verificarToken(fn, c0, 't', 'a', 'staging', 'x.com'))[0]).toMatch(
      /no es válido o está vencido \(expired\)/,
    );
  });

  it('sin Workers Scripts nombra ese permiso y la celda', async () => {
    const { fn } = fetchFalso({ ...tokenActivo, 'workers/scripts': { estado: 403 } });
    expect(await verificarToken(fn, c0, 't', 'a', 'staging', 'x.com')).toEqual([
      'c0: al token le falta «Account → Workers Scripts: Edit» en la cuenta ED1 principal',
    ]);
  });

  it('en producción, sin acceso a la zona nombra Workers Routes', async () => {
    const { fn } = fetchFalso({
      ...tokenActivo,
      'workers/scripts': { estado: 200, cuerpo: { result: [] } },
      'zones?name=': { estado: 200, cuerpo: { result: [] } },
    });
    expect(
      (await verificarToken(fn, c0, 't', 'a', 'produccion', 'laboratorio-digital.com'))[0],
    ).toMatch(/no ve la zona laboratorio-digital.com; le falta «Zone → Workers Routes: Edit»/);
  });

  it('sin Workers KV nombra ese permiso (HU-E8.1: el despliegue crea el KV de flags)', async () => {
    const { fn } = fetchFalso({
      ...tokenActivo,
      'workers/scripts': { estado: 200, cuerpo: { result: [] } },
      'storage/kv/namespaces': { estado: 403 },
    });
    expect(await verificarToken(fn, c0, 't', 'a', 'staging', 'x.com')).toEqual([
      'c0: al token le falta «Account → Workers KV Storage: Edit» en la cuenta ED1 principal',
    ]);
  });

  it('en staging no pide la zona', async () => {
    const { fn, pedidos } = fetchFalso({
      ...tokenActivo,
      'workers/scripts': { estado: 200, cuerpo: { result: [] } },
    });
    await verificarToken(fn, c0, 't', 'a', 'staging', 'x.com');
    expect(pedidos.some((p) => p.includes('zones'))).toBe(false);
  });
});

describe('prueba de humo (CA5, P11)', () => {
  const sano = {
    'GET https://s.dev/': {
      estado: 301,
      cabeceras: { location: 'https://s.dev/herramientas/agro/' },
    },
    'GET https://s.dev/herramientas/agro/calculadora-dpv/': {
      estado: 200,
      texto: 'Calculadora de DPV',
    },
    'GET https://s.dev/herramientas/agro/': { estado: 200, texto: 'Herramientas agronómicas' },
    'GET https://s.dev/agro/app/manifest.webmanifest': {
      estado: 200,
      texto: '{"scope":"/agro/app/"}',
    },
    'GET https://s.dev/agro/app/sw.js': { estado: 200, texto: 'precacheAndRoute precache' },
    // Cada ruta del cuaderno, de la misma lista que usa la prueba de humo (P2).
    ...Object.fromEntries(
      RUTAS_APP.map(({ segmento }) => [
        `GET https://s.dev${rutaDe(segmento)}`,
        {
          estado: 200,
          texto: '<meta name="robots" content="noindex">',
          cabeceras: {
            'content-security-policy': "default-src 'self'; connect-src 'self' https://x",
          },
        },
      ]),
    ),
    'GET https://s.dev/api/eventos': { estado: 405, texto: 'Solo POST' },
    'POST https://s.dev/api/eventos': { estado: 400, texto: 'El lote no es JSON' },
  };

  it('un despliegue sano pasa, y nunca escribe un evento válido', async () => {
    const { fn, pedidos } = fetchFalso(sano);
    expect(await humo(fn, 'https://s.dev')).toEqual([]);
    expect(pedidos.filter((p) => p.startsWith('POST'))).toEqual(['POST https://s.dev/api/eventos']);
  });

  it('detecta una raíz que no redirige (la página intermedia de antes)', async () => {
    const { fn } = fetchFalso({
      ...sano,
      'GET https://s.dev/': { estado: 200, texto: 'Redirecting to…' },
    });
    expect((await humo(fn, 'https://s.dev'))[0]).toMatch(/^\/: respondió 200/);
  });

  it('detecta una API que no valida y una app sin noindex', async () => {
    const { fn } = fetchFalso({
      ...sano,
      'POST https://s.dev/api/eventos': { estado: 204 },
      'GET https://s.dev/agro/app/': { estado: 200, texto: '<html>' },
    });
    const fallas = await humo(fn, 'https://s.dev');
    expect(fallas).toEqual(
      expect.arrayContaining([
        '/agro/app/: no contiene «noindex»',
        '/api/eventos (POST inválido): respondió 204, se esperaba 400',
      ]),
    );
  });

  it('detecta un cuaderno que llega sin su CSP (HU-E0.5)', async () => {
    const { fn } = fetchFalso({
      ...sano,
      'GET https://s.dev/agro/app/': {
        estado: 200,
        texto: '<meta name="robots" content="noindex">',
      },
    });
    expect(await humo(fn, 'https://s.dev')).toEqual([
      '/agro/app/: no trae la cabecera Content-Security-Policy del cuaderno (_headers)',
    ]);
  });
});

describe('resumen del despliegue (CA3, P15)', () => {
  it('al detenerse nombra la celda, las que quedaron sin tocar y cómo seguir', () => {
    const texto = resumenDespliegue('staging', [
      { celda: 'c0', estado: 'desplegada', detalle: ['https://x.workers.dev'] },
      { celda: 'c1', estado: 'fallo', detalle: ['al token le falta algo'] },
      { celda: 'c2', estado: 'sin-tocar', detalle: [] },
      { celda: 'c3', estado: 'fuera', detalle: [] },
    ]);
    expect(texto).toContain('se detuvo en **c1**');
    expect(texto).toContain('Quedaron sin tocar: c2.');
    expect(texto).toContain('«solo_celda: c1»');
    expect(texto).toContain('"estado": "fuera"');
  });

  it('lee la URL de workers.dev de la salida de wrangler', () => {
    expect(
      urlDeWorkersDev(
        'Deployed agro-sitio-staging triggers\n  https://agro-sitio-staging.mi-cuenta.workers.dev\n',
      ),
    ).toBe('https://agro-sitio-staging.mi-cuenta.workers.dev');
    expect(urlDeWorkersDev('sin url')).toBeNull();
  });
});

describe('causa de una falla de wrangler en el resumen (P15)', () => {
  // Salida real del primer despliegue a staging (1 oct 2026), con sus códigos de color.
  const salidaReal = [
    'Uploaded 19 of 19 assets',
    '\u001b[31m✘ \u001b[41;31m[\u001b[41;97mERROR\u001b[41;31m]\u001b[0m \u001b[1mA request to the Cloudflare API (/accounts/***/workers/scripts/agro-sitio-staging) failed.\u001b[0m',
    '  You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable: \u001b[4mhttps://dash.cloudflare.com/***/workers/analytics-engine\u001b[0m [code: 10089]',
    '  If you think this is a bug, please open an issue at: https://github.com/cloudflare/workers-sdk/issues/new/choose',
    '🪵  Logs were written to "/home/runner/.config/.wrangler/logs/wrangler.log"',
  ].join('\n');

  it('cita el error tal cual, sin colores, y dice qué hacer con el código conocido', () => {
    const causa = causaDeWrangler(salidaReal);
    expect(causa[0]).toBe(
      'A request to the Cloudflare API (/accounts/***/workers/scripts/agro-sitio-staging) failed.',
    );
    expect(causa.join(' ')).toContain('You need to enable Analytics Engine');
    expect(causa.at(-1)).toMatch(/^Qué hacer: Activa Analytics Engine creando sus datasets/);
    expect(causa.join(' ')).not.toContain('\u001b');
    expect(causa.join(' ')).not.toContain('If you think this is a bug');
  });

  it('con un código desconocido cita el error sin inventar una acción', () => {
    const causa = causaDeWrangler(salidaReal.replace('10089', '99999'));
    expect(causa.some((l) => l.startsWith('Qué hacer'))).toBe(false);
    expect(causa.join(' ')).toContain('[code: 99999]');
  });

  it('sin bloque de error lo dice', () => {
    expect(causaDeWrangler('todo raro')).toEqual([
      'sin mensaje de error de wrangler; revisa el registro de la corrida',
    ]);
  });
});
