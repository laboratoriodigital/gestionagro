/**
 * Claves de kill switch y KV de flags en el despliegue (HU-E8.1, CA2), con una API de
 * Cloudflare falsa en memoria: ninguna prueba toca Cloudflare.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { wranglerDelSitio } from '../../scripts/generar-wrangler.ts';
import { cargarCeldas } from '../../scripts/lib/celdas.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';
import {
  asegurarClaves,
  asegurarNamespace,
  clavesDeKillSwitch,
  configDeDespliegue,
  nombreKvFlags,
} from '../../scripts/lib/kv-flags.ts';
import { cargarProductos } from '../../scripts/lib/productos.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';

/** Cloudflare en memoria: namespaces paginados de a 2 y valores por namespace. */
function cloudflareFalso(
  opciones: { namespaces?: string[]; valores?: Record<string, string>; fallar?: number } = {},
) {
  const namespaces = (opciones.namespaces ?? []).map((title, i) => ({ id: `ns${i}`, title }));
  const valores = new Map(Object.entries(opciones.valores ?? {}));
  const escrituras: string[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET';
    if (opciones.fallar) return new Response('{}', { status: opciones.fallar });
    const u = new URL(url);
    if (u.pathname.endsWith('/storage/kv/namespaces') && metodo === 'GET') {
      const pagina = Number(u.searchParams.get('page') ?? '1');
      const porPagina = 2;
      return Response.json({
        success: true,
        result: namespaces.slice((pagina - 1) * porPagina, pagina * porPagina),
        result_info: { total_pages: Math.max(1, Math.ceil(namespaces.length / porPagina)) },
      });
    }
    if (u.pathname.endsWith('/storage/kv/namespaces') && metodo === 'POST') {
      const { title } = JSON.parse(String(init?.body)) as { title: string };
      const nuevo = { id: `ns${namespaces.length}`, title };
      namespaces.push(nuevo);
      return Response.json({ success: true, result: nuevo });
    }
    const valor = u.pathname.match(/\/namespaces\/([^/]+)\/values\/(.+)$/);
    if (valor) {
      const clave = `${valor[1]}/${decodeURIComponent(valor[2] ?? '')}`;
      if (metodo === 'PUT') {
        escrituras.push(clave);
        valores.set(clave, String(init?.body));
        return Response.json({ success: true });
      }
      const v = valores.get(clave);
      return v === undefined ? new Response('', { status: 404 }) : new Response(v, { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as Fetch;
  return { fn, namespaces, valores, escrituras };
}

describe('claves de kill switch (CA2)', () => {
  it('una por cada contrato con kill_switch: true, desde los product.yaml (P2)', () => {
    const productos = cargarProductos();
    const conKill = productos.filter((p) => p.kill_switch).map((p) => `ks:${p.id}`);
    expect(conKill.length).toBeGreaterThan(0);
    expect(clavesDeKillSwitch(productos)).toEqual(conKill);
    expect(clavesDeKillSwitch(productos)).toContain('ks:agro-calculadora-dpv');
  });

  it('el despliegue asegura esas claves antes de publicar el Worker', () => {
    const texto = readFileSync(join(RAIZ, 'scripts', 'desplegar.ts'), 'utf8');
    const asegura = texto.indexOf('clavesDeKillSwitch(cargarProductos())');
    expect(asegura).toBeGreaterThan(0);
    // Cómo se publica el Worker del sitio en desplegar.ts (texto literal de la plantilla).
    const publica = texto.indexOf(`deploy -c $${'{'}ARCHIVO_DESPLIEGUE}`);
    expect(publica).toBeGreaterThan(0);
    expect(asegura).toBeLessThan(publica);
  });

  it('el nombre del KV sale de la celda y del destino (ARQUITECTURA §5.5)', () => {
    expect(nombreKvFlags('c0', 'produccion')).toBe('agro-c0-flags');
    expect(nombreKvFlags('c0', 'staging')).toBe('agro-c0-flags-staging');
  });
});

describe('KV de flags en el despliegue', () => {
  it('crea el namespace si no existe y reusa el que existe aunque esté en otra página', async () => {
    const vacio = cloudflareFalso();
    expect(await asegurarNamespace(vacio.fn, 't', 'a', 'agro-c0-flags')).toEqual({
      id: 'ns0',
      creado: true,
    });
    const lleno = cloudflareFalso({ namespaces: ['otro-1', 'otro-2', 'agro-c0-flags'] });
    expect(await asegurarNamespace(lleno.fn, 't', 'a', 'agro-c0-flags')).toEqual({
      id: 'ns2',
      creado: false,
    });
    expect(lleno.namespaces).toHaveLength(3);
  });

  it('crea en «encendido» las claves que faltan y nunca vuelve a encender una apagada', async () => {
    const cf = cloudflareFalso({ valores: { 'ns0/ks:agro-calculadora-dpv': 'apagado' } });
    const claves = ['ks:agro-calculadora-dpv', 'ks:agro-cuaderno'];
    const r = await asegurarClaves(cf.fn, 't', 'a', 'ns0', claves);
    expect(r).toEqual({ creadas: ['ks:agro-cuaderno'], existentes: ['ks:agro-calculadora-dpv'] });
    expect(cf.valores.get('ns0/ks:agro-calculadora-dpv')).toBe('apagado');
    expect(cf.valores.get('ns0/ks:agro-cuaderno')).toBe('encendido');
    expect(cf.escrituras).toEqual(['ns0/ks:agro-cuaderno']);
    // Un segundo despliegue no escribe nada.
    await asegurarClaves(cf.fn, 't', 'a', 'ns0', claves);
    expect(cf.escrituras).toHaveLength(1);
  });

  it('sin permiso nombra el permiso; un error de lectura no escribe nada', async () => {
    await expect(
      asegurarNamespace(cloudflareFalso({ fallar: 403 }).fn, 't', 'a', 'x'),
    ).rejects.toThrow('al token le falta «Account → Workers KV Storage: Edit»');
    const cf = cloudflareFalso({ fallar: 500 });
    await expect(asegurarClaves(cf.fn, 't', 'a', 'ns0', ['ks:a', 'ks:b'])).rejects.toThrow(
      'no se pudo leer ks:a (HTTP 500); no se tocó nada más',
    );
    expect(cf.escrituras).toEqual([]);
  });

  it('la configuración de despliegue lleva FLAGS solo en el destino; la del repositorio no lleva ids', () => {
    const generada = wranglerDelSitio(cargarCeldas());
    const prod = configDeDespliegue(generada, 'produccion', 'idprod');
    expect(prod['kv_namespaces']).toEqual([{ binding: 'FLAGS', id: 'idprod' }]);
    const staging = configDeDespliegue(generada, 'staging', 'idstg') as {
      kv_namespaces?: unknown;
      env: { staging: { kv_namespaces: unknown; name: string } };
    };
    expect(staging.kv_namespaces).toBeUndefined();
    expect(staging.env.staging.kv_namespaces).toEqual([{ binding: 'FLAGS', id: 'idstg' }]);
    expect(staging.env.staging.name).toBe('agro-sitio-staging');
    expect(JSON.stringify(generada)).not.toContain('kv_namespaces');
    expect(readFileSync(join(RAIZ, '.gitignore'), 'utf8')).toContain(
      'apps/sitio/wrangler.despliegue.jsonc',
    );
  });
});
