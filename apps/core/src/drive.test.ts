/**
 * Permiso de Drive del productor (HU-E8.4, etapa 1) con un Google falso. Que Google acepte el
 * cliente, la dirección de regreso y el permiso `drive.file` se comprueba en staging (P16).
 */
import type { BaseD1 } from '@ed1/d1';
import { generarClavePrivada } from '@ed1/tokens';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ALCANCE_DRIVE,
  abrir,
  type ProveedorDrive,
  proveedorDrive,
  sellar,
  sha256B64url,
  VIDA_SELLO_MS,
} from './drive.ts';
import { crearApp, type Env } from './worker.ts';

const APP = 'https://agro.ejemplo.test';
const CORE = 'https://core.ejemplo.test';
const VUELTA = `${APP}/agro/app/respaldo/`;
const T0 = Date.UTC(2026, 9, 5, 12);
const TOKEN_GOOGLE = 'ya29.token-de-drive-de-prueba';
const VERIFICADOR = 'verificador-del-telefono-con-suficiente-azar-0123456789';

const driveFalso: ProveedorDrive = {
  urlDeAutorizacion: (state, _verifier, redirect) =>
    new URL(
      `https://accounts.google.test/o/oauth2/auth?state=${state}&redirect_uri=${encodeURIComponent(redirect)}`,
    ),
  acceso: async (code) => {
    if (code !== 'code-bueno') throw new Error('code inválido');
    return { token: TOKEN_GOOGLE, vence: T0 + 3600_000 };
  },
};

let reloj = T0;
let env: Env;
const app = crearApp({ drive: () => driveFalso, ahora: () => reloj });
const pedir = (ruta: string, init: RequestInit = {}) =>
  app.fetch(new Request(`${CORE}${ruta}`, init), env);
const canjear = (cuerpo: unknown, origen = APP) =>
  pedir('/api/core/drive/canje', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: origen },
    body: JSON.stringify(cuerpo),
  });

beforeAll(async () => {
  env = {
    DB: {} as BaseD1, // el permiso de Drive no toca la base
    CORE_JWT_PRIVATE_KEY: await generarClavePrivada(),
    GOOGLE_CLIENT_ID: 'cliente',
    GOOGLE_CLIENT_SECRET: 'secreto',
    ORIGENES_APP: APP,
  };
});

/** Inicio + regreso de Google: devuelve el sello del fragmento y todas las URL por las que pasó. */
async function pedirPermiso(desafio?: string) {
  reloj = T0;
  const ida = await pedir(
    `/api/core/drive/inicio?vuelta=${encodeURIComponent(VUELTA)}&desafio=${desafio ?? (await sha256B64url(VERIFICADOR))}`,
  );
  const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const aGoogle = ida.headers.get('location') ?? '';
  const state = new URL(aGoogle).searchParams.get('state');
  const vuelta = await pedir(`/api/core/drive/callback?code=code-bueno&state=${state}`, {
    headers: { cookie },
  });
  const destino = vuelta.headers.get('location') ?? '';
  return { ida, aGoogle, destino, sello: destino.split('#drive=')[1] ?? '' };
}

describe('permiso de Drive del productor', () => {
  it('el proveedor real pide solo drive.file y sin refresh token', () => {
    const url = proveedorDrive('cliente', 'secreto').urlDeAutorizacion(
      'estado',
      'verificador-pkce-con-longitud-suficiente-para-arctic-000000',
      `${CORE}/api/core/drive/callback`,
    );
    expect(url.searchParams.get('scope')).toBe(ALCANCE_DRIVE);
    expect(url.searchParams.get('access_type')).toBe('online');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it.each([
    ['otro sitio', 'https://malo.test/agro/app/respaldo/', 'x'.repeat(43)],
    ['fuera del cuaderno', `${APP}/herramientas/agro/`, 'x'.repeat(43)],
    ['sin desafío', VUELTA, ''],
    ['desafío que no es un SHA-256', VUELTA, 'corto'],
  ])('inicio rechaza %s', async (_caso, vuelta, desafio) => {
    const r = await pedir(
      `/api/core/drive/inicio?vuelta=${encodeURIComponent(vuelta)}&desafio=${desafio}`,
    );
    expect(r.status).toBe(400);
  });

  it('va a Google con el regreso del CORE, guarda el estado en una cookie protegida y vuelve con un sello', async () => {
    const { ida, aGoogle, destino, sello } = await pedirPermiso();
    expect(new URL(aGoogle).searchParams.get('redirect_uri')).toBe(
      `${CORE}/api/core/drive/callback`,
    );
    const cookie = ida.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/Path=\/api\/core\/drive\//);
    expect(destino.startsWith(`${VUELTA}#drive=`)).toBe(true);
    // P13: el token de Google no queda legible en ninguna URL.
    expect(`${aGoogle} ${destino}`).not.toContain(TOKEN_GOOGLE);
    expect(sello).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('con el verificador del teléfono, el canje entrega el token de Google de una hora', async () => {
    const { sello } = await pedirPermiso();
    const r = await canjear({ sellado: sello, verificador: VERIFICADOR });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe(APP);
    expect(await r.json()).toEqual({ acceso: TOKEN_GOOGLE, vence: T0 + 3600_000 });
  });

  it('quien copie el fragmento sin el verificador no obtiene nada; tampoco después de 2 minutos', async () => {
    const { sello } = await pedirPermiso();
    const ajeno = await canjear({ sellado: sello, verificador: 'otro-verificador' });
    expect(ajeno.status).toBe(400);
    expect(await ajeno.json()).toMatchObject({
      motivo: 'Este permiso de Drive se pidió desde otro teléfono',
    });
    reloj = T0 + VIDA_SELLO_MS + 1;
    const tarde = await canjear({ sellado: sello, verificador: VERIFICADOR });
    expect(await tarde.json()).toMatchObject({
      motivo: 'El permiso de Drive venció; vuelve a intentarlo',
    });
  });

  it('un sello alterado o hecho con otra clave no se abre', async () => {
    const { sello } = await pedirPermiso();
    const [iv, cifrado] = sello.split('.');
    const alterado = `${iv}.${(cifrado ?? '').slice(0, -2)}AA`;
    expect((await canjear({ sellado: alterado, verificador: VERIFICADOR })).status).toBe(400);
    const desafio = await sha256B64url(VERIFICADOR);
    const ajeno = await sellar('otra-clave', { token: 't', vence: 0, desafio, sellado: T0 });
    await expect(abrir(env.CORE_JWT_PRIVATE_KEY ?? '', ajeno, VERIFICADOR, T0)).rejects.toThrow(
      'no es válido',
    );
  });

  it('si la persona cancela en Google o el estado no coincide, vuelve con un motivo, sin sello', async () => {
    const ida = await pedir(
      `/api/core/drive/inicio?vuelta=${encodeURIComponent(VUELTA)}&desafio=${await sha256B64url(VERIFICADOR)}`,
    );
    const cookie = (ida.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const cancelada = await pedir('/api/core/drive/callback?error=access_denied', {
      headers: { cookie },
    });
    expect(cancelada.headers.get('location')).toBe(`${VUELTA}#drive-error=cancelada`);
    const otro = await pedir('/api/core/drive/callback?code=code-bueno&state=otro', {
      headers: { cookie },
    });
    expect(otro.headers.get('location')).toBe(`${VUELTA}#drive-error=invalida`);
  });

  it('el canje solo responde al cuaderno, y el kill switch del CORE lo apaga', async () => {
    const { sello } = await pedirPermiso();
    const ajeno = await canjear({ sellado: sello, verificador: VERIFICADOR }, 'https://malo.test');
    expect(ajeno.headers.get('access-control-allow-origin')).toBeNull();
    const apagado = { ...env, FLAGS: { get: async () => 'apagado' } };
    const r = await app.fetch(
      new Request(`${CORE}/api/core/drive/inicio?vuelta=${encodeURIComponent(VUELTA)}`),
      apagado,
    );
    expect(r.status).toBe(503);
  });
});
