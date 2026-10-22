/**
 * La sesión del panel (HU-T8.1) sin navegador: el CORE es un `fetch` de mentira. Cada caso malo es
 * su control negativo (P5).
 */

import { describe, expect, it } from 'vitest';
import politica from '../../../../content/tienda/privacidad/politica.json' with { type: 'json' };
import { almacenEnMemoria } from './almacen.ts';
import {
  audienciaDe,
  canjear,
  estadoDeSesion,
  leerRegreso,
  leerSesion,
  OTRA_APLICACION,
  pantallaDe,
  renovar,
  type Sesion,
  urlDeEntrada,
  urlDelCore,
} from './sesion.ts';

const CORE = 'https://core.ejemplo.test';
const AHORA = 1_800_000_000_000;

/** Un token con esa audiencia; la firma no importa aquí (la verifica la API). */
const token = (aud: string) =>
  `x.${btoa(JSON.stringify({ aud })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.y`;

const respuesta = (o: Partial<Sesion> = {}) => ({
  acceso: token('tienda'),
  acceso_vence: AHORA + 3_600_000,
  refresh: 'refresh-1',
  refresh_vence: AHORA + 30 * 86_400_000,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@ejemplo.test' },
  organizaciones: [
    { org_id: 'org-uno', nombre: 'Comercio Ensayo Uno', rol: 'propietario', plan: 'pro' },
  ],
  org_id: 'org-uno',
  ...o,
});

function core(estado: number, cuerpo: unknown) {
  const pedidos: { url: string; cuerpo: Record<string, unknown> }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, cuerpo: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify(cuerpo), { status: estado });
  }) as unknown as typeof fetch;
  return { pedidos, fetchFn };
}

describe('entrar', () => {
  it('el CORE de producción solo en el dominio del panel; en cualquier otro, el de staging', () => {
    const config = { panel: 'panel.ejemplo.test', url: 'https://p', url_staging: 'https://s' };
    expect(urlDelCore('panel.ejemplo.test', config)).toBe('https://p');
    expect(urlDelCore('tienda-panel-staging.workers.dev', config)).toBe('https://s');
    expect(urlDelCore('localhost', config)).toBe('https://s');
  });

  it('lleva el producto, la pantalla de vuelta y la política vigente (HU-E0.5 CA3)', () => {
    const url = new URL(urlDeEntrada(CORE, 'https://panel.ejemplo.test/pedidos/'));
    expect(url.pathname).toBe('/api/core/auth/google/inicio');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      producto: 'tienda',
      vuelta: 'https://panel.ejemplo.test/pedidos/',
      politica: politica.version,
    });
  });

  it('lee el código o el error del fragmento', () => {
    expect(leerRegreso('#entrar=abc')).toEqual({ codigo: 'abc' });
    expect(leerRegreso('#entrar-error=cancelada')).toEqual({ error: 'cancelada' });
    expect(leerRegreso('')).toBeNull();
    expect(leerRegreso('#otra=1')).toBeNull();
  });
});

describe('canjear', () => {
  it('guarda la sesión con el dispositivo de este teléfono', async () => {
    const almacen = almacenEnMemoria();
    const { pedidos, fetchFn } = core(200, respuesta());
    await canjear(almacen, CORE, 'codigo-1', fetchFn);
    await canjear(almacen, CORE, 'codigo-2', fetchFn);
    expect(pedidos[0]?.url).toBe(`${CORE}/api/core/auth/canje`);
    expect(pedidos[0]?.cuerpo['codigo']).toBe('codigo-1');
    // Un mismo dispositivo para las dos entradas.
    expect(pedidos[1]?.cuerpo['dispositivo']).toBe(pedidos[0]?.cuerpo['dispositivo']);
    expect((await leerSesion(almacen))?.org_id).toBe('org-uno');
  });

  it('❌ CA3: un token de otro producto no se guarda y se dice por qué', async () => {
    const almacen = almacenEnMemoria();
    const { fetchFn } = core(200, respuesta({ acceso: token('agro') }));
    await expect(canjear(almacen, CORE, 'c', fetchFn)).rejects.toThrow(OTRA_APLICACION);
    expect(await leerSesion(almacen)).toBeNull();
  });

  it('❌ un 403 del CORE es otra aplicación; otro error, su motivo', async () => {
    await expect(canjear(almacenEnMemoria(), CORE, 'c', core(403, {}).fetchFn)).rejects.toThrow(
      OTRA_APLICACION,
    );
    await expect(
      canjear(almacenEnMemoria(), CORE, 'c', core(400, { motivo: 'El código ya se usó.' }).fetchFn),
    ).rejects.toThrow('El código ya se usó.');
  });

  it('❌ sin red, lo dice en palabras', async () => {
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(canjear(almacenEnMemoria(), CORE, 'c', fetchFn)).rejects.toThrow(/Sin conexión/);
  });
});

describe('renovar y elegir la tienda', () => {
  it('elegir es renovar hacia esa tienda; el refresh anterior sigue si el CORE no rota', async () => {
    const almacen = almacenEnMemoria({ sesion: respuesta({ org_id: null }) });
    const { pedidos, fetchFn } = core(200, { ...respuesta({ org_id: 'org-uno' }), refresh: null });
    const r = await renovar(almacen, CORE, { org: 'org-uno', fetchFn });
    expect(pedidos[0]?.cuerpo).toEqual({ refresh: 'refresh-1', org_id: 'org-uno' });
    expect(r.sesion?.org_id).toBe('org-uno');
    expect(r.sesion?.refresh).toBe('refresh-1');
  });

  it('❌ un refresh vencido borra la sesión y dice que hay que volver a entrar', async () => {
    const almacen = almacenEnMemoria({ sesion: respuesta() });
    const r = await renovar(almacen, CORE, { fetchFn: core(401, {}).fetchFn });
    expect(r).toEqual({ sesion: null, motivo: expect.stringMatching(/Vuelve a entrar/) });
    expect(await leerSesion(almacen)).toBeNull();
  });

  it('un CORE caído no borra la sesión', async () => {
    const almacen = almacenEnMemoria({ sesion: respuesta() });
    const r = await renovar(almacen, CORE, { fetchFn: core(503, {}).fetchFn });
    expect(r.sesion?.acceso).toBe(respuesta().acceso);
  });
});

describe('qué pantalla toca', () => {
  it('cada caso dice algo distinto', () => {
    expect(pantallaDe(null)).toBe('entrar');
    expect(pantallaDe(respuesta({ organizaciones: [], org_id: null }))).toBe('sin-tienda');
    expect(pantallaDe(respuesta({ org_id: null }))).toBe('elegir');
    expect(pantallaDe(respuesta())).toBe('panel');
  });

  it('el estado de la sesión por sus vencimientos', () => {
    expect(estadoDeSesion(null, AHORA)).toBe('sin-sesion');
    expect(estadoDeSesion(respuesta(), AHORA)).toBe('activa');
    expect(estadoDeSesion(respuesta({ acceso_vence: AHORA }), AHORA)).toBe('por-renovar');
    expect(estadoDeSesion(respuesta({ refresh_vence: AHORA }), AHORA)).toBe('vencida');
  });

  it('la audiencia de un token, o null si no se puede leer', () => {
    expect(audienciaDe(token('tienda'))).toBe('tienda');
    expect(audienciaDe('sin-puntos')).toBeNull();
    expect(audienciaDe('x.%%%.y')).toBeNull();
  });
});
