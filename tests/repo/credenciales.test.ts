/**
 * HU-C11.5: credenciales por propósito. Con la API de Cloudflare simulada: un token responde 200 a
 * lo que su permiso deja leer y 403 a lo demás. Lo que no ve (P17): que Cloudflare responda 403, y
 * no otra cosa, a una lectura sin permiso; la primera corrida de staging lo dice en su resumen.
 */
import { describe, expect, it } from 'vitest';
import {
  idsDeZonas,
  PERMISOS_DE_MAS,
  permisosDeMas,
  verificarTokenDeMetricas,
} from '../../scripts/lib/credenciales.ts';
import type { Fetch } from '../../scripts/lib/despliegue.ts';

/** Una API que responde 200 a las rutas que contienen alguno de `permitidas`, y 403 al resto. */
function api(permitidas: readonly string[], otras: Record<string, number | Response> = {}) {
  const pedidos: string[] = [];
  const fn = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    pedidos.push(`${init?.method ?? 'GET'} ${url}`);
    const otra = Object.entries(otras).find(([p]) => url.includes(p))?.[1];
    if (otra instanceof Response) return otra.clone();
    if (typeof otra === 'number') return new Response('{}', { status: otra });
    if (permitidas.some((p) => url.includes(p)))
      return Response.json({ success: true, result: [{ id: 'z1' }] });
    return Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 });
  }) as Fetch;
  return { fn, pedidos };
}

/** Lo que el token de despliegue sí tiene (ARQUITECTURA §7.5). */
const DESPLIEGUE = ['workers/scripts', 'storage/kv', 'd1/database', 'members', 'workers/routes'];

describe('HU-C11.5 · cada token con lo suyo y nada más', () => {
  it('el de despliegue con lo declarado pasa, y solo lee', async () => {
    const { fn, pedidos } = api(DESPLIEGUE);
    expect(await permisosDeMas(fn, 'despliegue', 't', 'cuenta', ['z1'])).toEqual([]);
    expect(pedidos.every((p) => p.startsWith('GET '))).toBe(true);
  });

  it('CA3 ❌ · uno que también crea tokens o edita el DNS falla y nombra cada permiso de más', async () => {
    const { fn } = api([...DESPLIEGUE, 'user/tokens', 'dns_records']);
    expect(await permisosDeMas(fn, 'despliegue', 't', 'cuenta', ['z1', 'z2'])).toEqual([
      'CF_API_TOKEN tiene un permiso de más: «User → API Tokens». Quítalo del token en Cloudflare (docs/runbooks/credenciales.md)',
      'CF_API_TOKEN tiene un permiso de más: «Zone → DNS». Quítalo del token en Cloudflare (docs/runbooks/credenciales.md)',
      'CF_API_TOKEN tiene un permiso de más: «Zone → DNS». Quítalo del token en Cloudflare (docs/runbooks/credenciales.md)',
    ]);
  });

  it('sin zonas (staging), las sondas de zona no corren', async () => {
    const { fn, pedidos } = api(DESPLIEGUE);
    await permisosDeMas(fn, 'despliegue', 't', 'cuenta');
    expect(pedidos.some((p) => p.includes('dns_records'))).toBe(false);
  });

  it('CA3 ❌ · el de métricas que también despliega falla y lo dice', async () => {
    const { fn } = api(['graphql', 'workers/scripts']);
    expect(await permisosDeMas(fn, 'metricas', 't', 'cuenta')).toEqual([
      'CF_METRICAS_TOKEN tiene un permiso de más: «Account → Workers Scripts». Quítalo del token en Cloudflare (docs/runbooks/credenciales.md)',
    ]);
  });

  it('una respuesta que no es ni 200 ni «sin permiso» no se da por buena (P1)', async () => {
    const { fn } = api(DESPLIEGUE, { 'r2/buckets': 500 });
    expect(await permisosDeMas(fn, 'despliegue', 't', 'cuenta')).toEqual([
      'CF_API_TOKEN: no se pudo comprobar «Account → Workers R2 Storage» (HTTP 500)',
    ]);
  });

  it('lo declarado de cada propósito nunca se sonda como de más', () => {
    const permisos = (p: keyof typeof PERMISOS_DE_MAS) => PERMISOS_DE_MAS[p].map((s) => s.permiso);
    for (const declarado of [
      'Account → Workers Scripts',
      'Account → Workers KV Storage',
      'Account → D1',
      'Account → Account Settings',
    ])
      expect(permisos('despliegue')).not.toContain(declarado);
    expect(permisos('metricas')).not.toContain('Account → Account Analytics');
  });

  it('CA1 · el de métricas se prueba con la consulta que hará el vigía antes de cargarlo', async () => {
    const lee = Response.json({ data: { viewer: { accounts: [{ accountTag: 'cuenta' }] } } });
    const { fn, pedidos } = api([], { graphql: lee });
    expect(await verificarTokenDeMetricas(fn, 't', 'cuenta')).toEqual({ fallas: [], avisos: [] });
    expect(pedidos[0]).toBe('POST https://api.cloudflare.com/client/v4/graphql');
  });

  it('CA1 · uno que no lee las métricas avisa sin detener; sin token, nada', async () => {
    const noLee = Response.json({ data: null, errors: [{ message: 'not authorized' }] });
    const { fn } = api([], { graphql: noLee });
    const r = await verificarTokenDeMetricas(fn, 't', 'cuenta');
    expect(r.fallas).toEqual([]);
    expect(r.avisos[0]).toMatch(/no puede leer las métricas de la cuenta/);
    expect(await verificarTokenDeMetricas(fn, undefined, 'cuenta')).toEqual({
      fallas: [],
      avisos: [],
    });
  });

  it('los ids de las zonas salen del mismo token', async () => {
    const { fn } = api(['zones?name=cultivopro.co']);
    expect(await idsDeZonas(fn, 't', ['cultivopro.co', 'otra.com'])).toEqual(['z1']);
  });
});
