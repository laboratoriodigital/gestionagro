/**
 * De la calculadora al cuaderno (HU-E2.7) en un teléfono de 360 px. Cada prueba arranca con un
 * navegador limpio: sin cuaderno usado, salvo que la prueba lo configure.
 */
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar } from './ayudas.ts';

const DPV = '/herramientas/agro/calculadora-dpv/';
const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
const area = f.areas[0]?.nombre ?? '';

async function calcular(page: Page, t: string, hr: string, hoja?: string) {
  await page.goto(DPV);
  await page.getByLabel(/^Temperatura del aire/).fill(t);
  await page.getByLabel(/^Humedad relativa/).fill(hr);
  if (hoja) {
    await page.getByText('Opción avanzada: temperatura de la hoja').click();
    await page.getByLabel(/^Temperatura de la hoja/).fill(hoja);
  }
  await expect(page.locator('[data-prueba="dpv-aire"]')).toBeVisible();
}

test('CA1 y CA3: con el cuaderno en uso, «Guardar en mi cuaderno» abre Clima con la lectura y emite tool.next_step', async ({
  page,
}) => {
  await configurar(page, f);
  const cuerpos: string[] = [];
  await page.route('**/api/eventos', async (ruta) => {
    cuerpos.push(ruta.request().postData() ?? '');
    await ruta.fulfill({ status: 204 });
  });
  await calcular(page, '24,5', '70', '22');

  // CA3. El envío real sale en `pagehide` al irse al cuaderno, y Playwright no ve las solicitudes
  // de una página que se descarga. Se detiene esa navegación, se comprueba que el clic contó
  // tool.next_step y se dispara el envío como al ocultar la pestaña (como en sitio.spec.ts).
  await page.evaluate(() =>
    document.addEventListener('click', (e) => e.preventDefault(), { once: true }),
  );
  await page.locator('[data-prueba="guardar-en-cuaderno"]').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => cuerpos.length).toBe(1);
  expect(JSON.parse(cuerpos[0] ?? '{}')).toMatchObject({
    producto: 'agro-calculadora-dpv',
    eventos: { 'tool.next_step': 1 },
  });

  await calcular(page, '24,5', '70', '22');
  await expect(page.locator('[data-prueba="que-es-el-cuaderno"]')).toHaveCount(0);
  const boton = page.getByRole('link', { name: 'Guardar en mi cuaderno' });
  await expect(boton).toHaveAttribute('href', '/agro/app/registrar/#t=24.5&hr=70&th=22');
  await boton.click();

  await expect(page.getByRole('heading', { level: 2, name: 'Clima' })).toBeVisible();
  await expect(page.locator('[data-prueba="lectura-de-calculadora"]')).toBeVisible();
  await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('24.5');
  await expect(page.getByLabel('Humedad relativa (%)')).toHaveValue('70');
  await expect(page.getByLabel('Temperatura de la hoja (°C, opcional)')).toHaveValue('22');
  // El fragmento se borra del enlace: recargar no repite la lectura.
  expect(new URL(page.url()).hash).toBe('');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.locator('[data-prueba="registro-clima"]')).toContainText(
    'Clima · 24,5 °C · 70 %',
  );
});

test('CA2: sin cuaderno, explica en una línea qué es, lo abre sin pedir cuenta y la lectura espera a la finca', async ({
  page,
}) => {
  await calcular(page, '23', '75');
  await expect(page.locator('[data-prueba="que-es-el-cuaderno"]')).toHaveText(
    'El cuaderno de campo guarda tus lecturas en este teléfono: gratis, sin cuenta y sin señal.',
  );
  await page.getByRole('link', { name: 'Abrir el cuaderno con esta lectura' }).click();
  await expect(page.locator('[data-prueba="lectura-guardada-para-despues"]')).toBeVisible();
  // Nada en la pantalla pide cuenta (ED1 §28). El enlace «Cuenta» del menú es opcional y no
  // cuenta como pedirla: se mira solo el contenido.
  await expect(page.locator('main').getByText(/cuenta|contraseña|correo/i)).toHaveCount(0);

  await configurar(page, f);
  await page
    .getByRole('navigation', { name: 'Secciones del cuaderno' })
    .getByRole('link', { name: 'Registrar' })
    .click();
  await expect(page.locator('[data-prueba="lectura-de-calculadora"]')).toBeVisible();
  await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('23');
  await expect(page.getByLabel('Humedad relativa (%)')).toHaveValue('75');
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.locator('[data-prueba="registro-clima"]')).toHaveCount(1);
  // Se usa una sola vez: al volver, el formulario está vacío.
  await page.reload();
  await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('');
});

test('sin resultado válido no aparece el botón: no se lleva una lectura a medias', async ({
  page,
}) => {
  await page.goto(DPV);
  await page.getByLabel(/^Temperatura del aire/).fill('24');
  await page.getByLabel(/^Humedad relativa/).fill('120');
  await expect(page.locator('[data-prueba="guardar-en-cuaderno"]')).toHaveCount(0);
});
