/**
 * HU-C9.4: la pantalla de consentimiento, en un teléfono de 360 px. El CORE se simula en el mismo
 * origen de la cuenta; sus pruebas de verdad están en `apps/core/src/autorizar.test.ts`.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';
const VUELTA = 'https://agente.example/vuelta';
const SOLICITUD = {
  pedido: { client_id: 'dcr-ensayo', redirect_uri: VUELTA, state: 'xyz' },
  cliente: { nombre: 'Asistente Ensayo', uri: null, tipo: 'dcr' },
  producto: 'agro',
  producto_nombre: 'CultivoPro',
  alcances: [
    {
      id: 'agro:registros:leer',
      descripcion:
        'Leer los registros de tu finca: riegos, aplicaciones, cosechas, monitoreos y clima. No puede cambiar nada.',
    },
  ],
  vuelve_a: 'agente.example',
};
const fragmento = (s: unknown) => Buffer.from(JSON.stringify(s)).toString('base64url');

async function conSesion(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('ed1-cuenta', JSON.stringify({ refresh: 'r', nombre: 'Ana' })),
  );
  await page.route(`${CUENTA}/api/core/auth/refrescar`, (r) =>
    r.fulfill({ json: { acceso: 'acceso-cuenta', refresh: null } }),
  );
  await page.route(`${CUENTA}/api/core/cuenta/espacios`, (r) =>
    r.fulfill({
      json: {
        espacios: [
          { org_id: 'o1', nombre: 'Finca La Esperanza', producto: 'agro', rol: 'propietario' },
          { org_id: 'o2', nombre: 'Finca Dos', producto: 'agro', rol: 'operario' },
          { org_id: 't1', nombre: 'Panadería', producto: 'ensayo', rol: 'dueno' },
        ],
      },
    }),
  );
}

test('CA2 · dice quién pide, qué podrá en palabras, sobre cuál espacio y hasta cuándo; permitir vuelve al asistente', async ({
  page,
}) => {
  await conSesion(page);
  const decisiones: unknown[] = [];
  await page.route(`${CUENTA}/api/core/cuenta/autorizar`, async (r) => {
    decisiones.push(r.request().postDataJSON());
    await r.fulfill({ json: { vuelta: `${VUELTA}?code=c0d1g0&state=xyz` } });
  });
  await page.route(`${VUELTA}?*`, (r) =>
    r.fulfill({ contentType: 'text/html', body: '<title>Asistente</title><h1>De vuelta</h1>' }),
  );
  await page.goto(`${CUENTA}/autorizar/#solicitud=${fragmento(SOLICITUD)}`);
  await expect(
    page.getByText('Asistente Ensayo quiere acceso a tu cuenta de CultivoPro.'),
  ).toBeVisible();
  await expect(page.getByText(/Leer los registros de tu finca/)).toBeVisible();
  await expect(page.getByText('Después volverá a agente.example.')).toBeVisible();
  // Solo los espacios del producto del recurso: la panadería no aparece.
  await expect(page.getByRole('radio')).toHaveCount(2);
  await expect(page.getByRole('radio', { name: 'Finca La Esperanza · Propietario' })).toBeChecked();
  await expect(page.getByText(/Nunca podrá pagar ni cambiar cómo se cobra/)).toBeVisible();
  // La solicitud no se queda en la barra de direcciones.
  expect(new URL(page.url()).hash).toBe('');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  await page.getByRole('radio', { name: 'Finca Dos · Operario' }).check();
  await page.getByRole('button', { name: 'Permitir', exact: true }).click();
  await expect(page).toHaveURL(`${VUELTA}?code=c0d1g0&state=xyz`);
  expect(decisiones).toEqual([{ pedido: SOLICITUD.pedido, decision: 'permitir', org_id: 'o2' }]);
});

test('sin sesión, primero entrar; la solicitud espera en la pestaña y vuelve a esta página', async ({
  page,
}) => {
  await page.goto(`${CUENTA}/autorizar/#solicitud=${fragmento(SOLICITUD)}`);
  await expect(page.getByText('Para decidir, primero entra a tu cuenta.')).toBeVisible();
  await expect(page.locator('input[name="vuelta"]')).toHaveValue(`${CUENTA}/autorizar/`);
  expect(await page.evaluate(() => sessionStorage.getItem('ed1-autorizar'))).toContain(
    'Asistente Ensayo',
  );
  await expect(page.getByRole('button', { name: 'Permitir', exact: true })).toBeHidden();
});

test('CA3 ❌ · una solicitud que el CORE rechazó se dice, y no hay botón para permitir', async ({
  page,
}) => {
  await conSesion(page);
  await page.goto(
    `${CUENTA}/autorizar/#error=${encodeURIComponent('La dirección a la que volvería este asistente no es una de las suyas.')}`,
  );
  await expect(
    page.getByText('La dirección a la que volvería este asistente no es una de las suyas.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Permitir', exact: true })).toBeHidden();
});

test('sin espacios en ese producto, no se puede permitir', async ({ page }) => {
  await conSesion(page);
  await page.goto(
    `${CUENTA}/autorizar/#solicitud=${fragmento({ ...SOLICITUD, producto: 'parqueadero', producto_nombre: 'Parqueadero' })}`,
  );
  await expect(page.getByText(/No tienes espacios en este producto/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Permitir', exact: true })).toBeDisabled();
});
