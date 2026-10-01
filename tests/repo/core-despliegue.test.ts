/**
 * El CORE en el despliegue (HU-E4.1): configuración generada, base D1, permiso del token y prueba
 * de humo, con una API de Cloudflare falsa en memoria. Ninguna prueba toca Cloudflare.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIGRACIONES_CORE,
  RUTA_WRANGLER_CORE,
  textoWranglerDelCore,
  wranglerDelCore,
} from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import { asegurarBaseD1, configDelCore, nombreD1Core } from '../../scripts/lib/d1-core.ts';
import { type Fetch, humoCore, verificarToken } from '../../scripts/lib/despliegue.ts';
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
    const prod = configDelCore(generada, 'produccion', 'id-prod');
    expect(JSON.stringify(prod['d1_databases'])).toContain('"database_id":"id-prod"');
    expect(JSON.stringify(prod['env'])).not.toContain('database_id');
    const staging = configDelCore(generada, 'staging', 'id-stg');
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
