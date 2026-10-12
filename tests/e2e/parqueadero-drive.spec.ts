/**
 * HU-Q10.1 en un teléfono de 360 px: la caja guarda su copia en el Google Drive de la cuenta y otra
 * caja vacía la trae, como el cuaderno de CultivoPro (HU-E8.4), con la CSP de staging de verdad.
 * El CORE y Google Drive son falsos (`drive-falso.ts`); el permiso real se prueba en staging.
 */
import { createHash } from 'node:crypto';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { coreFalso, crearDrive } from './drive-falso.ts';
import {
  abrirTurno,
  CAJA,
  llenarAjustes,
  PNG,
  sinDesborde,
  teclearPlaca,
} from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

const seccion = (page: Page) => page.getByTestId('copia-en-drive');

test('HU-Q10.1 · guarda la copia en su Drive y otra caja vacía la trae sin borrar nada', async ({
  page,
  browser,
}) => {
  const drive = crearDrive();
  await drive.atender(page);
  const pedidos = await coreFalso(page);
  await page.goto(CAJA);
  await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
  await llenarAjustes(page, { imprimir: 'No' });
  await page.getByRole('button', { name: 'Nueva entrada' }).click();
  await abrirTurno(page);
  await teclearPlaca(page, 'DRV123');
  await page
    .getByLabel(/Foto del vehículo/)
    .setInputFiles({ name: 'frente.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.getByText('Foto del vehículo (opcional, 1 de 4)')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  await expect(page.getByTestId('senal-respaldo')).toHaveText('Respaldo sin hacer');
  await page.getByRole('button', { name: 'Respaldo', exact: true }).click();

  await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
  await expect(page.getByTestId('estado-del-respaldo')).toContainText(
    'Copia guardada en su Google Drive, en la carpeta «Caja del parqueadero · respaldos», como ',
  );
  // Volvió a «Respaldo», y el sello no se queda en la barra de direcciones.
  // HU-Q8.3: la foto subió con la copia, a la carpeta de la caja A.
  await expect(page.getByTestId('estado-del-respaldo')).toContainText(
    'Subió 1 foto de los vehículos a «Caja del parqueadero · fotos».',
  );
  const carpetaDeFotos = drive.archivos.find(
    (a) => a.name === 'Caja del parqueadero · fotos · caja A',
  );
  const fotos = drive.archivos.filter(
    (a) => carpetaDeFotos && a.parents.includes(carpetaDeFotos.id),
  );
  expect(fotos.map((a) => a.mimeType)).toEqual([expect.stringMatching(/^image\/(webp|jpeg)$/)]);
  expect(new URL(page.url()).hash).toBe('');
  // Al CORE solo salió el SHA-256 del verificador; el verificador, recién en el canje.
  expect(
    createHash('sha256')
      .update(pedidos.verificador ?? '')
      .digest('base64url'),
  ).toBe(pedidos.desafio);
  const copias = drive.archivos.filter((a) => a.mimeType === 'application/json');
  expect(copias).toHaveLength(1);
  expect(JSON.parse(copias[0]?.contenido ?? '{}')).toMatchObject({
    formato: 'parqueadero-export',
    version: 1,
  });
  await sinDesborde(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  await expect(page.getByTestId('senal-respaldo')).toContainText('Respaldo: ');

  // Otra caja, vacía: trae la copia de su Drive y la une.
  const otro = await browser.newContext({ viewport: { width: 360, height: 780 } });
  const nueva = await otro.newPage();
  await drive.atender(nueva);
  await coreFalso(nueva);
  await nueva.goto(CAJA);
  await nueva.getByRole('button', { name: 'Respaldo', exact: true }).click();
  await seccion(nueva).getByRole('button', { name: 'Traer una copia de mi Google Drive' }).click();
  const lista = nueva.getByTestId('copias-en-drive').getByRole('listitem');
  await expect(lista).toHaveCount(1);
  await lista.getByRole('button', { name: /^Traer la copia del / }).click();
  await expect(nueva.getByTestId('estado-del-respaldo')).toContainText('No se borró nada.');
  await nueva.getByRole('button', { name: 'Volver al inicio' }).click();
  await expect(nueva.getByTestId('estadia')).toContainText('DRV123');
  await otro.close();
});

test('HU-Q10.1 · si cancela en Google lo dice y no guarda nada; sin señal no sale de la caja', async ({
  page,
  context,
}) => {
  const drive = crearDrive();
  await drive.atender(page);
  await coreFalso(page, 'cancelada');
  await page.goto(CAJA);
  await page.getByRole('button', { name: 'Respaldo', exact: true }).click();
  await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
  await expect(page.getByTestId('aviso-respaldo')).toHaveText(
    'Canceló el permiso en Google. No se guardó ni se trajo nada.',
  );
  expect(drive.archivos).toHaveLength(0);

  await context.setOffline(true);
  await seccion(page).getByRole('button', { name: 'Traer una copia de mi Google Drive' }).click();
  await expect(page.getByTestId('aviso-respaldo')).toHaveText(
    'No hay señal para hablar con Google. Intente cuando tenga internet.',
  );
  expect(new URL(page.url()).pathname).toBe('/caja/');
  await context.setOffline(false);
});
