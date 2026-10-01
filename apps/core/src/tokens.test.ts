import { describe, expect, it } from 'vitest';
import {
  DURACION_ACCESO_MS,
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
  TokenInvalido,
  verificarAcceso,
} from './tokens.ts';

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
