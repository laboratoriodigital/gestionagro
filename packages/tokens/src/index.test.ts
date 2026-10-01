import { describe, expect, it } from 'vitest';
import {
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
