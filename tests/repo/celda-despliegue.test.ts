/**
 * La API de la celda en el despliegue (HU-E5.1): configuración generada por celda, ids solo en el
 * destino, clave del CORE y prueba de humo. Con `fetch` falso: nada toca Cloudflare.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIGRACIONES_CELDA,
  rutaWranglerCelda,
  textoWranglerDeLaCelda,
  wranglerDeLaCelda,
} from '../../scripts/generar-wrangler.ts';
import { clavesDelCore, configDeLaCelda, humoCelda } from '../../scripts/lib/api-celda.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

const real = cargarCeldas();

describe('configuración de la API por celda (P2, ADR-6)', () => {
  it.each(real.celdas.map((c) => [c.id, c] as const))(
    'wrangler.%s.jsonc es el generado, sin ids, con un binding por shard',
    (_id, celda) => {
      const texto = readFileSync(rutaWranglerCelda(celda.id), 'utf8');
      expect(texto).toBe(textoWranglerDeLaCelda(celda));
      expect(texto).not.toMatch(/database_id|account_id/);
      const generada = wranglerDeLaCelda(celda) as { d1_databases: { binding: string }[] };
      expect(generada.d1_databases.map((d) => d.binding)).toEqual(celda.shards);
    },
  );

  it('las URL de la API siguen el nombre del Worker de cada celda', () => {
    for (const c of real.celdas) {
      expect(new URL(c.api).hostname.split('.')[0]).toBe(`agro-api-${c.id}`);
      expect(new URL(c.api_staging).hostname.split('.')[0]).toBe(`agro-api-${c.id}-staging`);
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
  };

  it('ids de bases, KV, clave del CORE y orígenes van solo al destino; CELDA se conserva', () => {
    const staging = configDeLaCelda(wranglerDeLaCelda(c0), 'staging', despliegue);
    const env = (staging['env'] as Record<string, Record<string, unknown>>)['staging'] ?? {};
    expect(env['vars']).toEqual({
      CELDA: c0.id,
      CORE_CLAVES: '[{"kid":"k1"}]',
      ORIGENES_APP: 'https://agro.ejemplo.test',
    });
    expect(JSON.stringify(env['d1_databases'])).toContain(`"database_id":"id-${c0.shards[0]}"`);
    expect(JSON.stringify(staging['d1_databases'])).not.toContain('database_id');
    expect(staging['vars']).toEqual({ CELDA: c0.id });
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
