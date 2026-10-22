/**
 * Bitácora tienda3 52: la lista de secretos de wrangler se lee aunque la salida traiga una
 * advertencia antes o después. La salida de abajo es la del despliegue de staging del 22 oct 2026,
 * acortada, con la advertencia que detuvo a la Tienda.
 */
import { describe, expect, it } from 'vitest';
import { nombresDeSecretos } from '../../scripts/lib/secretos-de-wrangler.ts';

const LISTA = `[
  {
    "name": "SECRETO_DESPACHO",
    "type": "secret_text"
  },
  {
    "name": "TIENDA_KEK_V1",
    "type": "secret_text"
  }
]`;
const ADVERTENCIA = `\u001b[33m▲ \u001b[43;33m[\u001b[43;30mWARNING\u001b[43;33m]\u001b[0m \u001b[1mProcessing wrangler.despliegue.jsonc configuration:\u001b[0m

    - "env.staging" environment configuration
      - The following vars exist at the top level, but not on "env.staging.vars".
        - CORREO_REMITENTE
`;

describe('nombresDeSecretos (bitácora tienda3 52)', () => {
  it('lee la lista sola, con una advertencia después o antes', () => {
    const nombres = ['SECRETO_DESPACHO', 'TIENDA_KEK_V1'];
    expect(nombresDeSecretos(LISTA)).toEqual(nombres);
    expect(nombresDeSecretos(`${LISTA}\n${ADVERTENCIA}`)).toEqual(nombres);
    expect(nombresDeSecretos(`${ADVERTENCIA}\n${LISTA}\n`)).toEqual(nombres);
  });

  it('una lista vacía no tiene secretos', () => {
    expect(nombresDeSecretos('[]\n')).toEqual([]);
  });

  it('❌ sin lista, o con una que no se puede leer, lanza: nunca «no tiene secretos» (P1)', () => {
    expect(() => nombresDeSecretos(ADVERTENCIA)).toThrow(/no trae la lista/);
    expect(() => nombresDeSecretos('[\n  { "name": "A", ')).toThrow(/no es JSON/);
    expect(() => nombresDeSecretos('[{"tipo": "x"}]')).toThrow(/sin nombre/);
  });
});
