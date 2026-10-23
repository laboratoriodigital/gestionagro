/**
 * HU-C10.2: entrar con un enlace al correo, en la cuenta. El CORE se simula en el mismo origen, como
 * en `cuenta.spec.ts`; el flujo de verdad está en `apps/core/src/entrar-con-correo.test.ts`. Aquí se
 * prueba la página: pedir el enlace con la política aceptada, y abrirlo con un toque.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';

test('pedir el enlace exige la política y manda lo mismo que el formulario de Google', async ({
  page,
}) => {
  const pedidos: unknown[] = [];
  await page.route(`${CUENTA}/api/core/auth/correo/pedir`, async (r) => {
    pedidos.push(r.request().postDataJSON());
    await r.fulfill({
      json: { estado: 'enviado', motivo: 'Te enviamos un enlace a rosa@example.com.' },
    });
  });
  await page.goto(`${CUENTA}/`);
  const formulario = page.locator('form[data-entrar-correo]');
  await expect(formulario).toBeVisible();
  await formulario.getByLabel('Tu correo').fill('rosa@example.com');
  await formulario.getByRole('button', { name: 'Enviarme un enlace' }).click();
  // Sin la casilla, no pide nada y lo dice junto al campo.
  await expect(formulario.getByText('Primero acepta la política')).toBeVisible();
  expect(pedidos).toHaveLength(0);
  await page.getByLabel(/Leí y acepto/).check();
  await formulario.getByRole('button', { name: 'Enviarme un enlace' }).click();
  await expect(formulario.getByRole('status')).toHaveText(
    'Te enviamos un enlace a rosa@example.com.',
  );
  expect(pedidos).toEqual([
    {
      correo: 'rosa@example.com',
      producto: 'cuenta',
      vuelta: `${CUENTA}/`,
      politica: expect.any(String),
    },
  ]);
});

test('el enlace dice para quién es, se gasta solo al tocar «Entrar» y sigue a la app', async ({
  page,
}) => {
  const rutas: string[] = [];
  await page.route(`${CUENTA}/api/core/auth/correo/ver`, async (r) => {
    rutas.push(`ver:${r.request().postDataJSON().enlace}`);
    await r.fulfill({
      json: { estado: 'vigente', correo: 'rosa@example.com', producto: 'TiendaPro' },
    });
  });
  await page.route(`${CUENTA}/api/core/auth/correo/abrir`, async (r) => {
    rutas.push('abrir');
    await r.fulfill({ json: { estado: 'listo', vuelta: `${CUENTA}/privacidad/#entrar=codigo` } });
  });
  await page.goto(`${CUENTA}/entrar/correo/#enlace=codigo-del-correo`);
  await expect(page.getByText('Vas a entrar a TiendaPro como rosa@example.com.')).toBeVisible();
  // El código salió de la barra antes de hablar con el CORE (P13), y ver no lo gastó.
  expect(page.url()).toBe(`${CUENTA}/entrar/correo/`);
  expect(rutas).toEqual(['ver:codigo-del-correo']);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`${CUENTA}/privacidad/#entrar=codigo`);
  expect(rutas).toEqual(['ver:codigo-del-correo', 'abrir']);
});

test('un enlace vencido lo dice, y no ofrece entrar', async ({ page }) => {
  await page.route(`${CUENTA}/api/core/auth/correo/ver`, (r) =>
    r.fulfill({
      status: 410,
      json: {
        estado: 'vencido',
        motivo: 'Este enlace ya se usó o venció. Pide otro desde la aplicación.',
      },
    }),
  );
  await page.goto(`${CUENTA}/entrar/correo/#enlace=viejo`);
  await expect(page.getByText('Este enlace ya se usó o venció.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeHidden();
});
