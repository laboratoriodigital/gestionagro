/**
 * QR de trazabilidad (HU-E6.4) en un teléfono de 360 px: la etiqueta del lote en el cuaderno y la
 * página pública `/agro/t/`. Las claves de la página se ponen en la prueba igual que lo hace el
 * despliegue (reemplazando `[]` en `#claves-qr`); la firma, con WebCrypto como la celda.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  codificar,
  type DatosQr,
  fragmento,
  mensajeAFirmar,
} from '../../packages/trazabilidad/src/index.ts';
import { FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { configurar } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

const DATOS: DatosQr = {
  v: 1,
  l: 'T-27MAR-2',
  f: 'Finca Ensayo Uno',
  m: 'Municipio Ensayo',
  r: 'ecologico',
  c: 'Cultivo Ensayo',
  va: 'Variedad Ensayo',
  a: ['Nave 1'],
  d: ['2027-03-20', '2027-03-27'],
};

async function firmado() {
  const par = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const x = ((await crypto.subtle.exportKey('jwk', par.publicKey)) as JsonWebKey).x ?? '';
  const codificado = codificar({ ...DATOS, k: 'kid-e2e' });
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, par.privateKey, mensajeAFirmar(codificado)),
  );
  return { frag: fragmento(codificado, firma), clave: { kid: 'kid-e2e', x } };
}

/** Como el despliegue: las claves de la celda dentro de la página. */
async function conClaves(page: Page, claves: object[]) {
  await page.route(/\/agro\/t\/$/, async (ruta) => {
    const respuesta = await ruta.fetch();
    const html = (await respuesta.text()).replace(
      'id="claves-qr">[]<',
      `id="claves-qr">${JSON.stringify(claves)}<`,
    );
    await ruta.fulfill({ response: respuesta, body: html });
  });
}

const estado = (page: Page) => page.locator('#qr-estado');

test.describe('página pública /agro/t/ (CA2)', () => {
  test('con la firma de la celda: verificado, con finca, cultivo, área y fechas', async ({
    page,
  }) => {
    const { frag, clave } = await firmado();
    await conClaves(page, [clave]);
    await page.goto(`/agro/t/#${frag}`);
    await expect(estado(page)).toHaveText(
      'Verificado por Gestión Agro: estos datos son los que la finca registró.',
    );
    const datos = page.locator('#qr-datos');
    await expect(datos).toContainText('T-27MAR-2');
    await expect(datos).toContainText('Finca Ensayo Uno, Municipio Ensayo');
    await expect(datos).toContainText('Ecológica');
    await expect(datos).toContainText('Cultivo Ensayo · Variedad Ensayo');
    await expect(datos).toContainText('del 20/03/2027 al 27/03/2027');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('control negativo: un carácter cambiado se dice en rojo, nunca como verificado', async ({
    page,
  }) => {
    const { frag, clave } = await firmado();
    await conClaves(page, [clave]);
    const i = 30;
    const alterado = frag.slice(0, i) + (frag[i] === 'A' ? 'B' : 'A') + frag.slice(i + 1);
    await page.goto(`/agro/t/#${alterado}`);
    await expect(estado(page)).toHaveAttribute('data-estado', /no-coincide|danado/);
    await expect(estado(page)).not.toContainText('Verificado');
  });

  test('un texto con HTML en los datos se muestra como texto, no se ejecuta', async ({ page }) => {
    const malo = codificar({ ...DATOS, f: '<img src=x onerror="window.atacado=1">' });
    await page.goto(`/agro/t/#${malo}`);
    await expect(page.locator('#qr-datos')).toContainText('<img src=x');
    expect(
      await page.evaluate(() => (window as unknown as { atacado?: number }).atacado),
    ).toBeUndefined();
  });
});

test('CA1 y CA4: sin señal, el lote da una etiqueta de 5 × 5 cm «sin confirmar» que se puede escanear', async ({
  page,
  context,
}) => {
  const area = FINCA_ENSAYO_UNO.areas[0];
  if (!area) throw new Error('sin áreas');
  await configurar(page, FINCA_ENSAYO_UNO);
  await context.setOffline(true);
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await page.getByLabel('Cantidad cosechada').fill('20');
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.locator('[data-prueba="elegir-cosechas"] input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  const codigo = (await page.locator('.codigo-lote').first().textContent()) ?? '';
  await page.getByRole('button', { name: `Etiqueta QR del lote ${codigo}` }).click();

  const etiqueta = page.locator('[data-prueba="etiqueta-qr"]');
  await expect(etiqueta.getByRole('img', { name: `Código QR del lote ${codigo}` })).toBeVisible();
  await expect(etiqueta.locator('.etiqueta-estado')).toHaveText('Sin confirmar');
  await expect(etiqueta.locator('[data-prueba="estado-etiqueta"]')).toContainText('sin confirmar');
  // CA4: al imprimir mide 5 × 5 cm (96 px por pulgada).
  await page.emulateMedia({ media: 'print' });
  const caja = await etiqueta.locator('.etiqueta-imprimible').boundingBox();
  expect(Math.round((caja?.width ?? 0) / (96 / 2.54))).toBe(5);
  expect(Math.round((caja?.height ?? 0) / (96 / 2.54))).toBe(5);
  await page.emulateMedia({ media: 'screen' });

  // Lo que verá quien la escanee: la misma página pública, «sin verificar», con los datos.
  const enlace = (await etiqueta.locator('[data-prueba="enlace-qr"]').getAttribute('href')) ?? '';
  expect(enlace).toMatch(/\/agro\/t\/#[A-Za-z0-9_-]+$/);
  await context.setOffline(false);
  await page.goto(enlace);
  await expect(estado(page)).toHaveAttribute('data-estado', 'sin-verificar');
  await expect(page.locator('#qr-datos')).toContainText(codigo);
  await expect(page.locator('#qr-datos')).toContainText(FINCA_ENSAYO_UNO.finca.nombre);
});
