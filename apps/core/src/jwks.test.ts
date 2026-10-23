/**
 * HU-C4.2: las llaves del CORE en formato estándar. La prueba firma de verdad (P17): un token del
 * CORE se verifica con la llave que publica `/.well-known/jwks.json`.
 */
import {
  type ClavePublica,
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
  verificarConClaves,
} from '@ed1/tokens';
import { beforeAll, describe, expect, it } from 'vitest';
import { claveAnteriorDe } from './jwks.ts';
import { crearApp, type Env } from './worker.ts';

const T0 = Date.UTC(2026, 10, 17, 12);
let privada: string;
let anterior: ClavePublica;
let anteriorPrivadaJwk: JsonWebKey;
beforeAll(async () => {
  privada = await generarClavePrivada();
  const vieja = await firmanteDesde(await generarClavePrivada());
  anterior = vieja.publica;
  anteriorPrivadaJwk = (await crypto.subtle.exportKey('jwk', vieja.privada)) as JsonWebKey;
});

const app = crearApp({ ahora: () => T0 });
const pedir = (env: Partial<Env>, ruta = '/.well-known/jwks.json') =>
  app.fetch(new Request(`https://core.ejemplo.test${ruta}`), env as Env);

describe('HU-C4.2 · JWKS estándar', () => {
  it('CA1 · publica la vigente como JWK OKP/Ed25519 con su kid, y verifica un token del CORE', async () => {
    const r = await pedir({ CORE_JWT_PRIVATE_KEY: privada });
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
    const { keys } = (await r.json()) as { keys: ClavePublica[] };
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', use: 'sig' });
    const { token } = await firmarAcceso(
      await firmanteDesde(privada),
      { sub: 'u1', org: null, rol: null, celda: null, shard: null, anillo: null, aud: 'cuenta' },
      T0,
    );
    expect(await verificarConClaves(keys, token, T0)).toMatchObject({ sub: 'u1' });
  });

  it('durante una rotación publica también la anterior, igual en las dos rutas', async () => {
    const env = { CORE_JWT_PRIVATE_KEY: privada, CORE_CLAVE_ANTERIOR: JSON.stringify(anterior) };
    const { keys } = (await (await pedir(env)).json()) as { keys: ClavePublica[] };
    expect(keys.map((k) => k.kid)).toEqual([expect.any(String), anterior.kid]);
    const { claves } = (await (await pedir(env, '/api/core/claves')).json()) as {
      claves: ClavePublica[];
    };
    expect(claves).toEqual(keys);
  });

  it('CA2 · la parte privada nunca aparece, ni si alguien pega la JWK privada como anterior', async () => {
    expect(anteriorPrivadaJwk.d).toBeTruthy(); // control: lo que se pega sí trae «d»
    const r = await pedir({
      CORE_JWT_PRIVATE_KEY: privada,
      CORE_CLAVE_ANTERIOR: JSON.stringify({ ...anteriorPrivadaJwk, kid: anterior.kid }),
    });
    const texto = await r.text();
    expect(texto).not.toMatch(/"d"\s*:/);
    expect(texto).not.toContain(anteriorPrivadaJwk.d);
    expect(JSON.parse(texto).keys).toHaveLength(2);
  });

  it('una anterior mal formada no se publica y la vigente sigue', async () => {
    expect(claveAnteriorDe('no es json')).toBeNull();
    expect(claveAnteriorDe(JSON.stringify({ kty: 'RSA', n: 'x', kid: 'k' }))).toBeNull();
    expect(claveAnteriorDe(undefined)).toBeNull();
    const r = await pedir({ CORE_JWT_PRIVATE_KEY: privada, CORE_CLAVE_ANTERIOR: '{' });
    expect(((await r.json()) as { keys: unknown[] }).keys).toHaveLength(1);
  });

  it('sin la clave del CORE responde 503 y no inventa una (P1)', async () => {
    expect((await pedir({})).status).toBe(503);
  });
});
