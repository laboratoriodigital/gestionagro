/**
 * Copia en el Google Drive del productor (HU-E8.4, etapa 1) en un teléfono de 360 px. El CORE y
 * Google Drive se reemplazan interceptando la red: esta prueba no ve Google de verdad (P17). El
 * permiso real se prueba en staging (P16).
 */
import { createHash } from 'node:crypto';
import { AxeBuilder } from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';
import { coreFalso, crearDrive, T0 } from './drive-falso.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

async function registrarClima(page: Page, area: string) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Temperatura del aire (°C)').fill('24,5');
  await page.getByLabel('Humedad relativa (%)').fill('70');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.getByText('Guardado en este teléfono.')).toBeVisible();
}

const seccion = (page: Page) => page.locator('[data-prueba="copia-en-drive"]');

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('guardar la copia en su Drive y traerla en otro teléfono vacío', async ({
      page,
      browser,
    }) => {
      await page.clock.setFixedTime(T0);
      const drive = crearDrive();
      await drive.atender(page);
      const pedidos = await coreFalso(page);
      await configurar(page, f);
      await registrarClima(page, f.areas[0]?.nombre ?? '');
      await nav(page).getByRole('link', { name: 'Respaldo' }).click();
      await expect(seccion(page).locator('[data-prueba="ultima-copia-drive"]')).toHaveText(
        'Todavía no has guardado una copia en tu Drive.',
      );

      await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
      await expect(seccion(page).locator('[data-prueba="drive-hecho"]')).toContainText(
        'Copia guardada en tu Google Drive, en la carpeta «CultivoPro · respaldos», como cuaderno-finca-ensayo-',
      );
      // El sello no se queda en la barra de direcciones.
      expect(new URL(page.url()).hash).toBe('');
      // Al CORE solo salió el SHA-256 del verificador; el verificador, recién en el canje.
      expect(
        createHash('sha256')
          .update(pedidos.verificador ?? '')
          .digest('base64url'),
      ).toBe(pedidos.desafio);
      const copias = drive.archivos.filter((a) => a.parents.length > 0);
      expect(copias).toHaveLength(1);
      expect(JSON.parse(copias[0]?.contenido ?? '{}')).toMatchObject({
        formato: 'agro-export',
        version: 1,
      });
      await expect(seccion(page).locator('[data-prueba="ultima-copia-drive"]')).toHaveText(
        /^Última copia en tu Drive: /,
      );

      // Otro teléfono, vacío: trae la copia de su Drive y la une.
      const otro: BrowserContext = await browser.newContext({
        viewport: { width: 360, height: 780 },
      });
      const telefono = await otro.newPage();
      await drive.atender(telefono);
      await coreFalso(telefono);
      await telefono.goto(`${new URL(page.url()).origin}${APP}respaldo/`);
      await expect(
        seccion(telefono).getByRole('button', { name: 'Guardar copia en mi Google Drive' }),
      ).toHaveCount(0);
      await seccion(telefono)
        .getByRole('button', { name: 'Traer una copia de mi Google Drive' })
        .click();
      const lista = seccion(telefono).locator('[data-prueba="drive-copias"] li');
      await expect(lista).toHaveCount(1);
      await lista.getByRole('button', { name: 'Traer esta copia' }).click();
      const resumen = telefono.locator('[data-prueba="respaldo-resumen"]');
      await expect(resumen.getByRole('row', { name: /^Registros/ })).toHaveText(
        /Registros\s*1\s*0/,
      );
      await telefono.getByRole('button', { name: /^Importar \d+ datos nuevos$/ }).click();
      await expect(telefono.getByText(/^Importado: 1 registro/)).toBeVisible();
      await otro.close();
    });
  });
}

test('si la persona cancela en Google, lo dice y no guarda nada', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  const drive = crearDrive();
  await drive.atender(page);
  await coreFalso(page, 'cancelada');
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Respaldo' }).click();
  await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
  await expect(seccion(page).locator('[data-prueba="drive-error"]')).toHaveText(
    'Cancelaste el permiso en Google. No se guardó ni se trajo nada.',
  );
  expect(drive.archivos).toHaveLength(0);
});

test('sin señal no ofrece hablar con Google; a los 7 días sin copia lo recuerda; WCAG 2.1 AA', async ({
  page,
  context,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  await page.clock.setFixedTime(T0);
  const drive = crearDrive();
  await drive.atender(page);
  await coreFalso(page);
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Respaldo' }).click();
  await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
  await expect(seccion(page).locator('[data-prueba="drive-hecho"]')).toBeVisible();

  await page.clock.setFixedTime(new Date(T0.getTime() + 8 * 24 * 3600_000));
  await page.reload();
  await expect(seccion(page).locator('[data-prueba="ultima-copia-drive"]')).toHaveText(
    /^Hace 8 días de tu última copia en Drive \(.+\)\. Guarda una nueva\.$/,
  );

  await context.setOffline(true);
  await expect(seccion(page).locator('[data-prueba="drive-sin-senal"]')).toBeVisible();
  await expect(
    seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }),
  ).toBeDisabled();
  await expect(
    seccion(page).getByRole('button', { name: 'Traer una copia de mi Google Drive' }),
  ).toBeDisabled();
  await context.setOffline(false);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
