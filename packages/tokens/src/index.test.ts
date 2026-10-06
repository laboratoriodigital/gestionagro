import { describe, expect, it } from 'vitest';
import {
  aceptarEnProducto,
  base64url,
  DURACION_ACCESO_MS,
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
  TokenInvalido,
  verificarAcceso,
  verificarConClaves,
} from './index.ts';

const T0 = Date.UTC(2026, 9, 1, 12);
const datos = {
  sub: 'u1',
  org: 'o1',
  rol: 'operario',
  celda: 'c0',
  shard: 'agro_c0_s1',
  anillo: 1,
};

describe('access token Ed25519 (ADR-10, CA5)', () => {
  it('se verifica solo con la clave pública, que no trae la parte privada', async () => {
    const f = await firmanteDesde(await generarClavePrivada());
    expect(Object.keys(f.publica).sort()).toEqual(['alg', 'crv', 'kid', 'kty', 'use', 'x']);
    const { token } = await firmarAcceso(f, datos, T0);
    expect(await verificarAcceso(f.publica, token, T0 + 1000)).toMatchObject(datos);
  });

  it('rechaza un token alterado, uno firmado con otra clave y uno vencido', async () => {
    const f = await firmanteDesde(await generarClavePrivada());
    const otra = await firmanteDesde(await generarClavePrivada());
    const { token } = await firmarAcceso(f, datos, T0);
    const [cabecera, cuerpo, firma] = token.split('.');
    const alterado = `${cabecera}.${cuerpo?.slice(0, -2)}xx.${firma}`;
    await expect(verificarAcceso(f.publica, alterado, T0)).rejects.toThrow(TokenInvalido);
    await expect(verificarAcceso(otra.publica, token, T0)).rejects.toThrow(
      'La firma no corresponde',
    );
    await expect(verificarAcceso(f.publica, token, T0 + DURACION_ACCESO_MS)).rejects.toThrow(
      'El token venció',
    );
  });

  it('un secreto que no es una clave Ed25519 no arranca: no hay clave por defecto (P1)', async () => {
    await expect(firmanteDesde('no-es-una-clave')).rejects.toThrow();
  });
});

describe('verificar con las claves publicadas (celdas, HU-E5.1)', () => {
  it('elige la clave por kid: sirve la vigente y la anterior durante una rotación', async () => {
    const vieja = await firmanteDesde(await generarClavePrivada());
    const nueva = await firmanteDesde(await generarClavePrivada());
    const { token } = await firmarAcceso(vieja, datos, T0);
    expect(await verificarConClaves([nueva.publica, vieja.publica], token, T0)).toMatchObject(
      datos,
    );
    await expect(verificarConClaves([nueva.publica], token, T0)).rejects.toThrow(
      `Clave desconocida: ${vieja.publica.kid}`,
    );
  });

  it('rechaza un token que no se puede leer o que pide otro algoritmo', async () => {
    const f = await firmanteDesde(await generarClavePrivada());
    await expect(verificarConClaves([f.publica], 'basura', T0)).rejects.toThrow(TokenInvalido);
    const ninguno = `${btoa(JSON.stringify({ alg: 'none', kid: f.publica.kid }))}.e30.`;
    await expect(verificarConClaves([f.publica], ninguno, T0)).rejects.toThrow(
      'Algoritmo no aceptado: none',
    );
  });
});

describe('HU-C4.1 · fase N: las celdas aceptan v1 y v2 (PLATAFORMA §4.6)', () => {
  const v2 = {
    ...datos,
    aud: 'agro',
    plan: 'finca',
    plan_vence: 1_800_000_000,
    auth_time: T0 / 1000,
  };

  /** Cada token, firmado de verdad, contra cada celda: lo que la celda acepta o por qué no. */
  const casos = [
    {
      nombre: 'v1 sin aud',
      version: 1,
      d: datos,
      agro: 'gratuito',
      ensayo: 'Un token sin producto solo vale en agro',
    },
    {
      nombre: 'v2 del agro',
      version: 2,
      d: v2,
      agro: 'finca',
      ensayo: 'El token es de agro y esta celda es de ensayo',
    },
    {
      nombre: 'v2 del ensayo',
      version: 2,
      // Sin plan: la celda resuelve el mínimo.
      d: { ...datos, aud: 'ensayo' },
      agro: 'El token es de ensayo y esta celda es de agro',
      ensayo: 'gratuito',
    },
  ] as const;

  it.each(casos)(
    '$nombre: agro → $agro · ensayo → $ensayo',
    async ({ version, d, agro, ensayo }) => {
      const f = await firmanteDesde(await generarClavePrivada());
      const { token } = await firmarAcceso(f, d, T0, version);
      const reclamos = await verificarConClaves([f.publica], token, T0);
      for (const [producto, espera] of [
        ['agro', agro],
        ['ensayo', ensayo],
      ] as const) {
        if (espera === 'gratuito' || espera === 'finca') {
          expect(aceptarEnProducto(reclamos, producto)).toMatchObject({ producto, plan: espera });
        } else {
          expect(() => aceptarEnProducto(reclamos, producto)).toThrow(espera);
        }
      }
    },
  );

  it('v2 lleva su emisor y su versión; v1 sigue con los de siempre', async () => {
    const f = await firmanteDesde(await generarClavePrivada());
    const leer = async (version: 1 | 2) =>
      verificarConClaves([f.publica], (await firmarAcceso(f, v2, T0, version)).token, T0);
    expect(await leer(2)).toMatchObject({
      iss: 'ed1-core',
      ver: 2,
      aud: 'agro',
      auth_time: T0 / 1000,
    });
    expect(await leer(1)).toMatchObject({ iss: 'agro-core' });
    expect((await leer(1)).ver).toBeUndefined();
  });

  it('un v2 sin producto no se firma', async () => {
    const f = await firmanteDesde(await generarClavePrivada());
    await expect(firmarAcceso(f, datos, T0, 2)).rejects.toThrow('Un token v2 nombra su producto');
  });

  it('CA3 · un token de ed1-core sin aud o sin ver 2 se rechaza aunque la firma sea buena', async () => {
    const f = await firmanteDesde(await generarClavePrivada());
    const firmar = async (reclamos: Record<string, unknown>) => {
      const cuerpo = `${b64({ alg: 'EdDSA', typ: 'JWT', kid: f.publica.kid })}.${b64(reclamos)}`;
      const firma = new Uint8Array(
        await crypto.subtle.sign({ name: 'Ed25519' }, f.privada, new TextEncoder().encode(cuerpo)),
      );
      return `${cuerpo}.${base64url(firma)}`;
    };
    const base = { ...datos, iss: 'ed1-core', iat: T0 / 1000, exp: T0 / 1000 + 3600 };
    for (const r of [base, { ...base, ver: 2 }, { ...base, aud: 'agro' }]) {
      await expect(verificarConClaves([f.publica], await firmar(r), T0)).rejects.toThrow(
        'Un token de ed1-core trae ver 2 y su producto',
      );
    }
    // Control negativo: el mismo token, completo, pasa.
    expect(
      await verificarConClaves([f.publica], await firmar({ ...base, ver: 2, aud: 'agro' }), T0),
    ).toMatchObject({
      aud: 'agro',
    });
    await expect(
      verificarConClaves([f.publica], await firmar({ ...base, iss: 'otro' }), T0),
    ).rejects.toThrow('Emisor desconocido: otro');
  });
});

const b64 = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)));
