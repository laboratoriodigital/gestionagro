/**
 * Hablar con la API desde el panel (HU-T8.1): un 401 se renueva una vez; «sin sesión», «sin
 * tienda» y «error» son distintos (CA2). La API y el CORE son `fetch` de mentira.
 */
import { describe, expect, it } from 'vitest';
import { almacenEnMemoria } from './almacen.ts';
import { pedirAlPanel } from './api.ts';
import type { Sesion } from './sesion.ts';

const CORE = 'https://core.ejemplo.test';
const AHORA = 1_800_000_000_000;
const tienda = `x.${btoa(JSON.stringify({ aud: 'tienda' }))}.y`;

const sesion = (o: Partial<Sesion> = {}): Sesion => ({
  acceso: 'acceso-viejo',
  acceso_vence: AHORA + 60_000,
  refresh: 'r',
  refresh_vence: AHORA + 86_400_000,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@ejemplo.test' },
  organizaciones: [{ org_id: 'o', nombre: 'Comercio Ensayo Uno', rol: 'propietario' }],
  org_id: 'o',
  ...o,
});

/** Responde por URL; anota cada pedido con su cabecera de autorización. */
function red(respuestas: Record<string, (() => Response)[]>) {
  const pedidos: string[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    const auth = new Headers(init?.headers).get('authorization');
    pedidos.push(`${url}${auth ? ` ${auth}` : ''}`);
    const r = respuestas[url]?.shift();
    if (!r) throw new Error(`sin respuesta para ${url}`);
    return r();
  }) as unknown as typeof fetch;
  return { pedidos, fetchFn };
}

const json = (estado: number, cuerpo: unknown) => () =>
  new Response(JSON.stringify(cuerpo), { status: estado });

const renovada = json(200, { ...sesion(), acceso: tienda, acceso_vence: AHORA + 3_600_000 });

describe('pedirAlPanel', () => {
  it('con el acceso vigente, pide con él', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { pedidos, fetchFn } = red({ '/api/panel/v1/yo': [json(200, { org: 'o' })] });
    const r = await pedirAlPanel({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'yo');
    expect(r).toEqual({ tipo: 'ok', datos: { org: 'o' } });
    expect(pedidos).toEqual(['/api/panel/v1/yo Bearer acceso-viejo']);
  });

  it('un 401 se renueva una vez y se repite con el acceso nuevo', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { pedidos, fetchFn } = red({
      '/api/panel/v1/yo': [json(401, {}), json(200, { org: 'o' })],
      [`${CORE}/api/core/auth/refrescar`]: [renovada],
    });
    const r = await pedirAlPanel({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'yo');
    expect(r.tipo).toBe('ok');
    expect(pedidos).toEqual([
      '/api/panel/v1/yo Bearer acceso-viejo',
      `${CORE}/api/core/auth/refrescar`,
      `/api/panel/v1/yo Bearer ${tienda}`,
    ]);
  });

  it('un acceso vencido se renueva antes de pedir', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion({ acceso_vence: AHORA - 1 }) });
    const { pedidos, fetchFn } = red({
      '/api/panel/v1/yo': [json(200, {})],
      [`${CORE}/api/core/auth/refrescar`]: [renovada],
    });
    await pedirAlPanel({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'yo');
    expect(pedidos[0]).toBe(`${CORE}/api/core/auth/refrescar`);
  });

  it('❌ CA2: 401 aun renovando es «sin sesión», con un motivo que no asusta', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { fetchFn } = red({
      '/api/panel/v1/yo': [json(401, {})],
      [`${CORE}/api/core/auth/refrescar`]: [json(401, {})],
    });
    const r = await pedirAlPanel({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'yo');
    expect(r).toEqual({ tipo: 'sin-sesion', motivo: expect.stringMatching(/Vuelve a entrar/) });
  });

  it('❌ HU-T10.3 CA2: «reautenticar» no renueva: pide entrar, con el motivo de la API', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { pedidos, fetchFn } = red({
      '/api/panel/v1/ajustes/guardar': [
        json(401, { estado: 'reautenticar', motivo: 'Para cambiar esto, vuelve a entrar.' }),
      ],
      [`${CORE}/api/core/auth/refrescar`]: [renovada],
    });
    const r = await pedirAlPanel(
      { almacen, core: CORE, fetchFn, ahora: () => AHORA },
      'ajustes/guardar',
      { cuerpo: {} },
    );
    expect(r).toEqual({ tipo: 'sin-sesion', motivo: 'Para cambiar esto, vuelve a entrar.' });
    expect(pedidos).toEqual(['/api/panel/v1/ajustes/guardar Bearer acceso-viejo']);
  });

  it('❌ sin sesión guardada no se llama a la API', async () => {
    const { pedidos, fetchFn } = red({});
    const r = await pedirAlPanel(
      { almacen: almacenEnMemoria(), core: CORE, fetchFn, ahora: () => AHORA },
      'yo',
    );
    expect(r.tipo).toBe('sin-sesion');
    expect(pedidos).toEqual([]);
  });

  it('«sin tienda», «otra celda» y un 500 se dicen distinto', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const { fetchFn } = red({
      '/api/panel/v1/yo': [
        json(403, { estado: 'sin-tienda' }),
        json(403, { estado: 'otra-celda', motivo: 'Vuelve a entrar.' }),
        json(500, {}),
      ],
    });
    const c = { almacen, core: CORE, fetchFn, ahora: () => AHORA };
    expect((await pedirAlPanel(c, 'yo')).tipo).toBe('sin-tienda');
    expect((await pedirAlPanel(c, 'yo')).tipo).toBe('sin-sesion');
    expect(await pedirAlPanel(c, 'yo')).toEqual({
      tipo: 'error',
      motivo: 'La tienda no respondió bien (500). Intenta de nuevo.',
    });
  });

  it('HU-T8.2: 422 trae los problemas por campo; 409, la versión actual; 404, que ya no está', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const problemas = [{ campo: 'variantes.0.precioCop', mensaje: 'un precio de 0 no se guarda' }];
    const { fetchFn } = red({
      '/api/panel/v1/productos/guardar': [
        json(422, { estado: 'problemas', problemas }),
        json(409, { estado: 'cambiado', motivo: 'Alguien más cambió esto.', version: 4 }),
        json(404, { estado: 'no-existe', motivo: 'Eso ya no está.' }),
      ],
    });
    const c = { almacen, core: CORE, fetchFn, ahora: () => AHORA };
    const pedir = () => pedirAlPanel(c, 'productos/guardar', { cuerpo: {} });
    expect(await pedir()).toEqual({
      tipo: 'error',
      estado: 'problemas',
      problemas,
      motivo: 'Falta corregir una cosa.',
    });
    expect(await pedir()).toEqual({
      tipo: 'error',
      estado: 'cambiado',
      version: 4,
      motivo: 'Alguien más cambió esto.',
    });
    expect(await pedir()).toEqual({
      tipo: 'error',
      estado: 'no-existe',
      motivo: 'Eso ya no está.',
    });
  });

  it('❌ HU-T10.4 CA1: la compuerta trae todas sus fallas, con dónde se arregla', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const fallas = [
      { codigo: 'sin-foto', mensaje: 'Sube una foto de «Pan»', donde: 'Productos' },
      { codigo: 'envio', mensaje: 'El envío «Bodega» tarda más de 30 días', donde: 'Envíos' },
    ];
    const { fetchFn } = red({
      '/api/panel/v1/publicar': [json(422, { estado: 'compuerta', fallas })],
    });
    const c = { almacen, core: CORE, fetchFn, ahora: () => AHORA };
    expect(await pedirAlPanel(c, 'publicar', { cuerpo: {} })).toEqual({
      tipo: 'error',
      estado: 'compuerta',
      fallas,
      motivo: 'Antes de publicar, corrige 2 cosas.',
    });
  });

  it('❌ sin red es un error con palabras, no una excepción', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    const fetchFn = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const r = await pedirAlPanel({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'yo');
    expect(r).toEqual({ tipo: 'error', motivo: expect.stringMatching(/Sin conexión/) });
  });

  it('un cuerpo va como JSON con POST', async () => {
    const almacen = almacenEnMemoria({ sesion: sesion() });
    let init: RequestInit | undefined;
    const fetchFn = (async (_url: string, i?: RequestInit) => {
      init = i;
      return new Response('{}');
    }) as unknown as typeof fetch;
    await pedirAlPanel({ almacen, core: CORE, fetchFn, ahora: () => AHORA }, 'x', {
      cuerpo: { a: 1 },
    });
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
  });
});
