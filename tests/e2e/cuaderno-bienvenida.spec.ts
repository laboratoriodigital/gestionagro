/**
 * La bienvenida del cuaderno (HU-E0.10) en un teléfono de 360 px: lo primero que ve un teléfono
 * sin finca y sin cuenta. Entrar pide la política aceptada y señal, igual que «Cuenta»; empezar
 * sin cuenta lleva al asistente y se recuerda; sin señal lo dice; y cumple WCAG 2.1 AA.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';

const bienvenida = (page: import('@playwright/test').Page) =>
  page.locator('[data-prueba="bienvenida"]');

test('un teléfono nuevo ve la bienvenida; entrar pide la política, y llevar a Google vuelve a Cuenta', async ({
  page,
}) => {
  await page.goto(APP);
  await expect(bienvenida(page)).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /^(Buenos días|Buenas tardes|Buenas noches)\. Tu finca te espera\.$/,
  );
  const google = page.getByRole('button', { name: 'Entrar con Google' });
  await expect(google).toBeDisabled();
  await expect(page.getByText('acepta primero la política')).toBeVisible();
  await page.getByLabel(/Leí y acepto la/).check();
  await expect(google).toBeEnabled();
  // El correo se abre al pedirlo, con el mismo formulario de «Cuenta».
  await page.getByRole('button', { name: 'Recibir un enlace en mi correo' }).click();
  await expect(page.getByLabel('Tu correo')).toBeVisible();
  // Google vuelve a «Cuenta» con la versión de la política aceptada.
  let destino = '';
  await page.route('**/api/core/auth/google/inicio**', async (ruta) => {
    destino = ruta.request().url();
    await ruta.fulfill({ status: 204 });
  });
  await google.click();
  await expect.poll(() => destino).toContain('/api/core/auth/google/inicio');
  const url = new URL(destino);
  expect(url.searchParams.get('vuelta')).toMatch(/\/agro\/app\/cuenta\/$/);
  expect(url.searchParams.get('politica')).toBeTruthy();
});

test('empezar sin cuenta abre el asistente, y el teléfono ya no vuelve a mostrar la bienvenida', async ({
  page,
}) => {
  await page.goto(APP);
  await page.getByRole('button', { name: 'Empezar en este teléfono, sin cuenta' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await expect(bienvenida(page)).toHaveCount(0);
});

test('❌ con una finca en el teléfono no sale la bienvenida', async ({ page }) => {
  await configurar(page, FINCAS_DE_PRUEBA[0] as FincaDePrueba);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    (FINCAS_DE_PRUEBA[0] as FincaDePrueba).finca.nombre,
  );
  await expect(bienvenida(page)).toHaveCount(0);
});

test('sin señal lo dice, no deja entrar y sí deja empezar en el teléfono', async ({
  page,
  context,
}) => {
  await page.goto(APP);
  await expect(bienvenida(page)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Necesitas señal para entrar.')).toBeVisible();
  await page.getByLabel(/Leí y acepto la/).check();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeDisabled();
  await page.getByRole('button', { name: 'Empezar en este teléfono, sin cuenta' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await context.setOffline(false);
});

for (const esquema of ['light', 'dark'] as const) {
  test(`la bienvenida cumple WCAG 2.1 AA en modo ${esquema === 'light' ? 'claro' : 'oscuro'} y no desborda`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: esquema });
    await page.goto(APP);
    await expect(bienvenida(page)).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
  });
}
