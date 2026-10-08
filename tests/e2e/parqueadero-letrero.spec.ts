/**
 * El aviso de tarifas, medios de pago y derechos para la entrada (HU-Q11.3): no sale sin los datos
 * legales (CA3), sale de los ajustes (CA1) y se imprime en una sola hoja carta u oficio. La hoja se
 * mide con el PDF que Chromium arma como si imprimiera: `window.print()` se reemplaza para que la
 * copia del aviso quede puesta hasta entonces, y el PDF avisa `afterprint` al terminar.
 */
import { expect, type Page, test } from '@playwright/test';
import { CAJA, instalarImpresoraFalsa, llenarAjustes, sinDesborde } from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

/** `print()` cuenta la llamada y no avisa que terminó: la hoja sigue puesta para medirla. */
function dialogoQueNoTermina() {
  Object.assign(window, { __impresiones: 0 });
  window.print = () => {
    (window as unknown as { __impresiones: number }).__impresiones += 1;
  };
}

/** Las hojas del PDF y el tamaño de la primera, en puntos. */
async function hojasDelPdf(page: Page) {
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString(
    'latin1',
  );
  const caja = /\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(pdf);
  return {
    hojas: pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0,
    ancho: Number(caja?.[1]),
    alto: Number(caja?.[2]),
  };
}

test('HU-Q11.3 · sin los datos legales no hay aviso; con ellos sale en una hoja carta u oficio', async ({
  page,
}) => {
  await page.addInitScript(instalarImpresoraFalsa);
  await page.addInitScript(dialogoQueNoTermina);
  await page.goto(CAJA);

  // CA3 ❌: la caja recién instalada no tiene sede ni tarifas.
  await page.getByRole('button', { name: 'Aviso de tarifas' }).click();
  await expect(page.getByTestId('letrero-falta')).toContainText('el nombre');
  await expect(page.getByTestId('letrero-falta')).toContainText('la tarifa de carro');
  await expect(page.getByTestId('hoja-letrero')).toHaveCount(0);
  await page.getByRole('button', { name: 'Completar los ajustes' }).click();
  await llenarAjustes(page, { ensayo: 'uno', qr: true });

  // CA1: los datos de la sede, la tarifa como en el recibo, los medios, la póliza y los derechos.
  await page.getByRole('button', { name: 'Aviso de tarifas' }).click();
  const hoja = page.getByTestId('hoja-letrero');
  for (const t of [
    'Parqueadero Ensayo Uno',
    'NIT 900.000.000-0',
    'Tarifas y derechos del usuario',
    'Tarifa: $230 por minuto',
    'Tope legal: $230 por minuto',
    'Efectivo · QR o transferencia',
    'Póliza de responsabilidad: Aseguradora 0000000',
    'Superintendencia de Industria y Comercio',
    'Pida su recibo por WhatsApp.',
  ]) {
    await expect(hoja).toContainText(t);
  }
  await sinDesborde(page);

  // Sin ningún medio de pago no se imprime: el aviso tiene que decir cómo se paga.
  const efectivo = page.getByRole('button', { name: 'Efectivo', exact: true });
  const qr = page.getByRole('button', { name: 'QR o transferencia', exact: true });
  await efectivo.click();
  await qr.click();
  await expect(page.getByTestId('letrero-sin-medios')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Imprimir en hoja/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Datáfono', exact: true }).click();
  await expect(hoja).toContainText('Datáfono');
  await expect(hoja).not.toContainText('Efectivo');

  for (const [papel, ancho, alto] of [
    ['Carta', 612, 792],
    ['Oficio', 612.3, 935.4],
  ] as const) {
    await page
      .getByRole('group', { name: 'Papel' })
      .getByRole('button', { name: papel, exact: true })
      .click();
    await page.getByRole('button', { name: `Imprimir en hoja ${papel.toLowerCase()}` }).click();
    await expect(page.locator('.letrero-impreso')).toHaveCount(1);
    // Al imprimir, el aviso es lo único: la caja no sale en la hoja.
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#caja')).toBeHidden();
    await expect(page.locator('.letrero-impreso .letrero')).toBeVisible();
    // `null`, no `screen`: con `screen` el PDF también sale con los estilos de pantalla.
    await page.emulateMedia({ media: null });
    // Chromium arma el PDF como lo imprimiría, y al terminar avisa `afterprint`.
    const medida = await hojasDelPdf(page);
    expect(medida.hojas, papel).toBe(1);
    expect(medida.ancho).toBeCloseTo(ancho, 0);
    expect(medida.alto).toBeCloseTo(alto, 0);
    // Cuando el diálogo termina, la página queda como estaba.
    await expect(page.locator('.letrero-impreso')).toHaveCount(0);
    expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
  }
  expect(
    await page.evaluate(() => (window as unknown as { __impresiones: number }).__impresiones),
  ).toBe(2);
});
