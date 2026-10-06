/**
 * HU-C7.3: entrar a la cuenta y salir, en el navegador. El CORE se simula en el mismo origen de la
 * cuenta (como en producción, donde el Worker del CORE la sirve): sus pruebas de verdad están en
 * `apps/core/src/entrar.test.ts`. Aquí se prueba la página: el formulario, el canje, volver y salir.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';

/** El CORE falso: anota lo que le piden y responde como el de verdad. */
async function coreFalso(page: Page, canje: { status: number; json: unknown }) {
  const pedidos: { ruta: string; url: string; cuerpo: unknown }[] = [];
  await page.route(`${CUENTA}/api/core/auth/google/inicio?*`, async (ruta) => {
    pedidos.push({ ruta: 'inicio', url: ruta.request().url(), cuerpo: null });
    await ruta.fulfill({ status: 302, headers: { location: `${CUENTA}/#entrar=codigo-e2e` } });
  });
  await page.route(`${CUENTA}/api/core/auth/canje`, async (ruta) => {
    pedidos.push({ ruta: 'canje', url: '', cuerpo: ruta.request().postDataJSON() });
    await ruta.fulfill(canje);
  });
  await page.route(`${CUENTA}/api/core/auth/salir`, async (ruta) => {
    pedidos.push({ ruta: 'salir', url: '', cuerpo: ruta.request().postDataJSON() });
    await ruta.fulfill({ json: { estado: 'fuera' } });
  });
  return pedidos;
}

test('HU-C7.3 · CA1 y CA3: entrar con la política aceptada, ver quién entró y salir en el CORE', async ({
  page,
}) => {
  const pedidos = await coreFalso(page, {
    status: 200,
    json: { refresh: 'refresh-e2e', usuario: { nombre: 'Ana Restrepo', email: 'ana@x.co' } },
  });
  await page.goto(`${CUENTA}/`);
  const entrar = page.getByRole('button', { name: 'Entrar con Google' });
  // Sin aceptar la política, el navegador no deja salir el formulario.
  await entrar.click();
  expect(pedidos).toEqual([]);
  await page.getByLabel(/Leí y acepto la política/).check();
  await entrar.click();

  await expect(page.getByText('Entraste como Ana Restrepo.')).toBeVisible();
  const inicio = new URL(pedidos[0]?.url ?? '');
  expect(Object.fromEntries(inicio.searchParams)).toMatchObject({
    producto: 'cuenta',
    politica: '1',
    vuelta: `${CUENTA}/`,
  });
  expect(pedidos[1]).toMatchObject({ ruta: 'canje', cuerpo: { codigo: 'codigo-e2e' } });
  // El código no se queda en la barra de direcciones.
  expect(page.url()).toBe(`${CUENTA}/`);

  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(entrar).toBeVisible();
  expect(pedidos[2]).toEqual({ ruta: 'salir', url: '', cuerpo: { refresh: 'refresh-e2e' } });
  // Al volver a la página, sigue sin sesión.
  await page.reload();
  await expect(entrar).toBeVisible();
});

test('HU-C7.3 · CA2: si viene de una app declarada, dice a cuál vuelve; de otra, no', async ({
  page,
  browser,
}) => {
  await coreFalso(page, {
    status: 200,
    json: { refresh: 'refresh-e2e', usuario: { nombre: 'Ana Restrepo' } },
  });
  await page.goto(`${CUENTA}/?vuelve=${encodeURIComponent('https://cultivopro.co/agro/app/')}`);
  await expect(page.getByText('Después de entrar puedes volver a CultivoPro.')).toBeVisible();
  await page.getByLabel(/Leí y acepto la política/).check();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  const volver = page.getByRole('link', { name: 'Volver a CultivoPro' });
  await expect(volver).toHaveAttribute('href', 'https://cultivopro.co/agro/app/');

  // Otro navegador, sin sesión guardada.
  const otra = await (await browser.newContext()).newPage();
  await otra.goto(`${CUENTA}/?vuelve=${encodeURIComponent('https://otro.ejemplo.test/robar')}`);
  await expect(otra.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
  await expect(otra.getByText(/puedes volver a/)).toBeHidden();
});

test('HU-C7.3 · si el canje falla, lo dice junto a la acción', async ({ page }) => {
  await coreFalso(page, {
    status: 401,
    json: { estado: 'sin-sesion', motivo: 'Este enlace de entrada ya se usó o venció.' },
  });
  await page.goto(`${CUENTA}/#entrar=codigo-viejo`);
  await expect(page.getByText('Este enlace de entrada ya se usó o venció.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
});

test('HU-C7.3 · la portada y la política no tienen violaciones de accesibilidad', async ({
  page,
}) => {
  for (const ruta of ['/', '/privacidad/']) {
    await page.goto(`${CUENTA}${ruta}`);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${ruta} ${v.id}: ${v.help}`)).toEqual([]);
  }
});
