/**
 * Dónde está cada dato (HU-E3.14) en un teléfono de 360 px.
 */
import { expect, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar, irASeccion } from './ayudas.ts';

test('CA1 y CA2: el indicador cuenta lo que está solo en el teléfono y explica qué hacer', async ({
  page,
  context,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  const indicador = page.locator('[data-prueba="indicador-datos"]');
  await expect(indicador).toHaveText('Sin registros pendientes');

  await irASeccion(page, 'Registrar');
  await page
    .locator('[data-prueba="formulario-clima"]')
    .getByLabel('Área')
    .selectOption({ label: f.areas[0]?.nombre ?? '' });
  await context.setOffline(true);
  for (const [t, hr] of [
    ['24', '70'],
    ['28', '55'],
  ]) {
    await page.getByLabel('Temperatura del aire (°C)').fill(t ?? '');
    await page.getByLabel('Humedad relativa (%)').fill(hr ?? '');
    await page.getByRole('button', { name: 'Guardar clima' }).click();
    await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('');
  }
  await expect(indicador).toHaveText('2 registros solo en este teléfono');

  await indicador.click();
  await expect(indicador).toHaveAttribute('aria-expanded', 'true');
  const explicacion = page.locator('[data-prueba="explicacion-datos"]');
  await expect(explicacion).toContainText('Todavía no se envían a la nube.');
  await expect(explicacion).toContainText('haz una copia cada semana');
  await context.setOffline(false);

  await page.reload();
  await expect(indicador).toHaveText('2 registros solo en este teléfono');
});
