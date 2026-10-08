/**
 * El recibo firmado en `/r/` (HU-Q8.2 CA1, CA2 y CA4), en el navegador: la página lee las llaves
 * de `#claves-recibo` (las pone el despliegue; aquí, la prueba al servirla) y verifica con
 * @noble/ed25519 sin pedir nada. El enlace se firma en la prueba como lo firma la caja: una celda
 * certifica la llave de la caja A, y la caja firma `<versión>.<datos>`.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { base64url, firmarCertificado } from '../../packages/firma/src/index.ts';
import {
  armarRecibo,
  conFirma,
  emitidoEn,
  enlaceCompleto,
  mensajeAFirmar,
} from '../../packages/parqueadero-recibos/src/index.ts';
import {
  AJUSTE_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
} from '../../packages/parqueadero-schema/src/ensayos.fixture.ts';
import { SITIO, sinDesborde } from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

const RECIBO = armarRecibo(
  SALIDA_ENSAYO,
  { sede: SEDE_ENSAYO_UNO, tarifa: TARIFA_CARRO, ajuste: AJUSTE_ENSAYO },
  { prueba: false },
);

async function par() {
  const p = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const x = base64url(new Uint8Array(await crypto.subtle.exportKey('raw', p.publicKey)));
  const huella = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(x)));
  return {
    x,
    kid: base64url(huella).slice(0, 16),
    firmar: async (m: Uint8Array<ArrayBuffer>) =>
      new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, p.privateKey, m)),
  };
}

/** Un enlace firmado por la caja A, y la llave de su celda. */
async function firmado(hasta = emitidoEn(RECIBO) + 30 * 86_400) {
  const celda = await par();
  const caja = await par();
  const certificado = await firmarCertificado(
    {
      kid: celda.kid,
      llave: caja.x,
      org: '0199b8a0-0000-7000-8000-0000000000a1',
      serie: 'A',
      hasta,
    },
    celda.firmar,
  );
  const enlace = await enlaceCompleto(RECIBO, `${SITIO}/r/`);
  return {
    enlace: conFirma(enlace, await caja.firmar(mensajeAFirmar(enlace)), certificado),
    llaves: [{ kid: celda.kid, x: celda.x }],
  };
}

/** Sirve `/r/` con las llaves dentro, como la deja el despliegue (`scripts/lib/claves-qr.ts`). */
async function conLlaves(page: Page, llaves: readonly { kid: string; x: string }[]) {
  await page.route(`${SITIO}/r/`, async (ruta) => {
    const r = await ruta.fetch();
    const html = (await r.text()).replace(
      '<script type="application/json" id="claves-recibo">[]</script>',
      `<script type="application/json" id="claves-recibo">${JSON.stringify(llaves)}</script>`,
    );
    expect(html).toContain(llaves[0]?.kid ?? '');
    await ruta.fulfill({ response: r, body: html });
  });
}

test.describe('el recibo firmado en /r/', () => {
  test('HU-Q8.2 CA2 · verificado: en verde, con el parqueadero y la caja, sin pedir nada', async ({
    page,
  }) => {
    const { enlace, llaves } = await firmado();
    await conLlaves(page, llaves);
    const pedidos: string[] = [];
    page.on('request', (r) => pedidos.push(`${r.resourceType()} ${new URL(r.url()).pathname}`));
    await page.goto(enlace);
    await expect(page.getByTestId('sello')).toHaveText(
      `Verificado: emitido por ${SEDE_ENSAYO_UNO.nombre} desde la caja A`,
    );
    await expect(page.getByText('Copia digital del recibo.')).toHaveCount(0);
    await sinDesborde(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(pedidos.filter((p) => !/^(document|stylesheet|script) /.test(p))).toEqual([]);
  });

  test('HU-Q8.2 CA2 · emitido con el certificado vencido: en ámbar', async ({ page }) => {
    const { enlace, llaves } = await firmado(emitidoEn(RECIBO) - 60);
    await conLlaves(page, llaves);
    await page.goto(enlace);
    await expect(page.getByTestId('sello')).toHaveText('Emitido con un certificado vencido');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('HU-Q8.2 CA4 ❌ · un carácter cambiado de la firma: «Este recibo fue modificado»', async ({
    page,
  }) => {
    const { enlace, llaves } = await firmado();
    await conLlaves(page, llaves);
    const partes = enlace.split('.');
    const firma = partes.at(-2) ?? '';
    partes.splice(-2, 1, `${firma[0] === 'Q' ? 'R' : 'Q'}${firma.slice(1)}`);
    await page.goto(partes.join('.'));
    await expect(page.getByTestId('sello')).toHaveText('Este recibo fue modificado');
    await expect(page.getByTestId('sello')).toHaveClass(/sello-modificado/);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('HU-Q8.2 CA4 · un enlace sin firma, como los de M0, sigue siendo la copia digital', async ({
    page,
  }) => {
    const { llaves } = await firmado();
    await conLlaves(page, llaves);
    await page.goto(await enlaceCompleto(RECIBO, `${SITIO}/r/`));
    await expect(page.getByText('Copia digital del recibo.')).toBeVisible();
    await expect(page.getByTestId('sello')).toHaveCount(0);
  });
});
