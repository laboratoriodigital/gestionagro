/**
 * HU-T14.8: el código de Google Search Console, del código solo o de la etiqueta entera que el
 * comercio copia de Google. Los códigos de estas pruebas son inventados.
 */
import { describe, expect, it } from 'vitest';
import { validarSeccion } from './secciones.ts';
import { codigoDeVerificacionGoogle, etiquetaDeVerificacionGoogle } from './verificacion.ts';

const CODIGO = 'PruebaDeVerificacion_ensayo-uno-0123456789Ab';

describe('el código de verificación de Google (HU-T14.8)', () => {
  it('sale del código solo o de la etiqueta que muestra Search Console', () => {
    expect(codigoDeVerificacionGoogle(CODIGO)).toBe(CODIGO);
    expect(
      codigoDeVerificacionGoogle(`<meta name="google-site-verification" content="${CODIGO}" />`),
    ).toBe(CODIGO);
    expect(
      codigoDeVerificacionGoogle(`  <META content="${CODIGO}" NAME="google-site-verification">  `),
    ).toBe(CODIGO);
  });

  it('la etiqueta para el <head> lleva solo el código', () => {
    expect(etiquetaDeVerificacionGoogle(CODIGO)).toBe(
      `<meta name="google-site-verification" content="${CODIGO}">`,
    );
  });

  it.each([
    ['la etiqueta de otro buscador', `<meta name="msvalidate.01" content="${CODIGO}" />`],
    [
      'un código con comillas',
      `<meta name="google-site-verification" content="${CODIGO}&quot;x" />`,
    ],
    ['un código con un <script>', `${CODIGO}"><script>alert(1)</script>`],
    ['un código con espacios', 'codigo con espacios de mas de veinte letras'],
    ['un código corto', 'abc123'],
    ['otra etiqueta HTML', `<link rel="me" href="${CODIGO}">`],
  ])('❌ %s no se acepta', (_caso, pegado) => {
    expect(codigoDeVerificacionGoogle(pegado)).toBeNull();
  });

  it('❌ con un código inválido, la etiqueta no se arma: nunca HTML crudo (HU-T4.2)', () => {
    expect(() => etiquetaDeVerificacionGoogle(`${CODIGO}"><script>`)).toThrow(/no es válido/);
  });

  it('la sección de medición guarda el código, y rechaza la etiqueta entera sin leer', () => {
    expect(validarSeccion('medicion', { googleVerificacion: CODIGO }).ok).toBe(true);
    expect(
      validarSeccion('medicion', {
        googleVerificacion: `<meta name="google-site-verification" content="${CODIGO}" />`,
      }).ok,
    ).toBe(false);
  });
});
