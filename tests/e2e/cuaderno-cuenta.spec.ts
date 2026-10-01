/**
 * Cuenta (HU-E4.2) en un teléfono de 360 px. El CORE y Google se reemplazan interceptando la red:
 * esta prueba no ve Google de verdad (P17). La entrada real se prueba en staging (P16).
 * Fuera de producción el cuaderno usa el CORE de staging (`celdas.json`).
 */
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { APP } from './ayudas.ts';

const { core } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
};
const CORE = core.url_staging;

const sesion = {
  acceso: 'acceso-e2e',
  acceso_vence: Date.now() + 12 * 60 * 60 * 1000,
  refresh: 'refresh-e2e',
  refresh_vence: Date.now() + 60 * 24 * 60 * 60 * 1000,
  usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
  organizaciones: [],
  org_id: null,
  aviso: null,
};

/** CORE falso: el inicio «vuelve de Google» con un código; el canje entrega la sesión. */
async function coreFalso(page: Page) {
  const canjes: { url: string; cuerpo: unknown }[] = [];
  await page.route(`${CORE}/api/core/auth/google/inicio?*`, async (ruta) => {
    const vuelta = new URL(ruta.request().url()).searchParams.get('vuelta');
    await ruta.fulfill({ status: 302, headers: { location: `${vuelta}#entrar=codigo-e2e` } });
  });
  await page.route(`${CORE}/api/core/auth/canje`, async (ruta) => {
    canjes.push({ url: ruta.request().url(), cuerpo: ruta.request().postDataJSON() });
    await ruta.fulfill({
      json: sesion,
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
    });
  });
  return canjes;
}

const cuenta = (page: Page) => page.goto(`${APP}cuenta/`);

test('sin cuenta: el cuaderno no la exige y ofrece entrar con Google', async ({ page }) => {
  await cuenta(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Cuenta' })).toBeVisible();
  await expect(page.getByText('El cuaderno funciona sin cuenta.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeEnabled();
});

test('CA1 y CA4: entrar, canjear por POST, y ningún código ni token en la URL ni en localStorage', async ({
  page,
}) => {
  const canjes = await coreFalso(page);
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await cuenta(page);
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.locator('[data-prueba="cuenta-usuario"]')).toContainText('Persona Ensayo');
  await expect(page.locator('[data-prueba="cuenta-estado"]')).toHaveText('Sesión activa.');
  await expect(page.locator('[data-prueba="cuenta-sin-fincas"]')).toBeVisible();

  expect(canjes).toHaveLength(1);
  expect(canjes[0]?.cuerpo).toMatchObject({
    codigo: 'codigo-e2e',
    dispositivo: expect.any(String),
  });
  expect(new URL(page.url()).hash).toBe(''); // el código salió de la barra de direcciones
  for (const url of urls) {
    expect(url).not.toContain('codigo-e2e');
    expect(url).not.toContain('acceso-e2e');
    expect(url).not.toContain('refresh-e2e');
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe('{}');
});

test('volver de Google con un error lo dice en palabras', async ({ page }) => {
  await page.goto(`${APP}cuenta/#entrar-error=cancelada`);
  await expect(page.locator('[data-prueba="cuenta-mensaje"]')).toHaveText(
    'Cancelaste la entrada con Google. Puedes intentarlo cuando quieras.',
  );
  expect(new URL(page.url()).hash).toBe('');
});

test('sin señal no se puede entrar, y se dice que se puede seguir registrando', async ({
  page,
  context,
}) => {
  await cuenta(page);
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeEnabled();
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeDisabled();
  await expect(
    page.getByText('Necesitas señal para entrar. Puedes seguir registrando.'),
  ).toBeVisible();
});

test('salir de la cuenta borra la sesión del teléfono y vuelve a ofrecer entrar', async ({
  page,
}) => {
  await coreFalso(page);
  await cuenta(page);
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect(page.locator('[data-prueba="cuenta-estado"]')).toBeVisible();
  await page.getByRole('button', { name: 'Salir de la cuenta' }).click();
  await expect(page.locator('[data-prueba="cuenta-mensaje"]')).toHaveText(
    'Saliste de la cuenta. Tus registros siguen en este teléfono.',
  );
  await page.reload();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});
