import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  abrirControlada,
  abrirMenu,
  instalarImpresoraFalsa,
  llenarAjustes,
  sinDesborde,
} from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

for (const ensayo of ['uno', 'dos'] as const) {
  for (const width of [360, 1280]) {
    test(`sin turnos · ${ensayo} · ${width}px · entrada, cobro exacto y reporte sin red`, async ({
      page,
      context,
    }, info) => {
      await page.setViewportSize({ width, height: width === 360 ? 740 : 900 });
      const inicio = new Date('2026-10-12T15:00:00Z');
      await page.clock.setFixedTime(inicio);
      await page.addInitScript(instalarImpresoraFalsa);
      await abrirControlada(page);
      await expect(page.getByTestId('tarjeta-turno')).toHaveCount(0);
      await expect(page.getByTestId('mas-opciones')).not.toHaveAttribute('open', '');
      await abrirMenu(page, 'Ajustes del parqueadero');
      await expect(page.getByRole('button', { name: 'Sin turnos', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await llenarAjustes(page, { ensayo, sinTurnos: true, imprimir: 'No' });
      await expect(page.getByTestId('estadias')).toBeVisible();
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByTestId('tarjeta-turno')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Nueva entrada' })).toBeInViewport();
      await page.screenshot({ path: info.outputPath('inicio.png'), fullPage: true, scale: 'css' });
      await page.getByRole('button', { name: 'Nueva entrada' }).click();
      await expect(page.getByTestId('entrada')).toBeVisible();
      await expect(page.getByTestId('abrir-turno')).toHaveCount(0);
      await page.getByLabel('Placa', { exact: true }).fill('abc123');
      await expect(page.getByLabel('Placa', { exact: true })).toHaveValue('ABC123');
      await expect(page.getByRole('button', { name: 'Carro', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(page.getByLabel(/Foto del vehículo/)).not.toBeVisible();
      await sinDesborde(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath('entrada.png'), fullPage: true, scale: 'css' });
      await page.getByRole('button', { name: 'Registrar', exact: true }).click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'Recibo de entrada A-000001',
      );
      await page.getByRole('button', { name: 'Mostrar QR' }).click();
      await expect(page.getByTestId('qr-en-pantalla')).toBeVisible();
      await page.getByRole('button', { name: 'Ya lo escaneó', exact: true }).click();
      await expect(page.getByTestId('entregas')).toContainText('El conductor escaneó el QR.');
      await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
      await page.clock.setFixedTime(new Date(inicio.getTime() + 60 * 60_000));
      await page.getByLabel('Buscar por placa', { exact: true }).fill('abc');
      await page.getByTestId('estadia').click();
      const cobrar = page.getByRole('button', { name: /^Cobrar/ });
      await expect(cobrar).toBeEnabled();
      await expect(page.getByLabel('Recibido', { exact: true })).toHaveValue('');
      await sinDesborde(page);
      await page.screenshot({ path: info.outputPath('salida.png'), fullPage: true, scale: 'css' });
      await cobrar.click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo de salida A-000002');
      await page.getByRole('button', { name: 'Mostrar QR' }).click();
      await page.getByRole('button', { name: 'Ya lo escaneó', exact: true }).click();
      await expect(page.getByTestId('entregas')).toContainText('El conductor escaneó el QR.');
      await page.getByRole('button', { name: 'Volver al inicio', exact: true }).click();
      await expect(page.getByTestId('estadia')).toHaveCount(0);
      await abrirMenu(page, 'Reportes');
      await expect(page.getByTestId('totales')).toContainText('Efectivo');
      await expect(page.getByTestId('totales')).toContainText('$13.800');
      await expect(page.getByTestId('turno-del-reporte')).toHaveCount(0);
      await expect(page.getByTestId('sin-turnos')).toHaveCount(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: info.outputPath('reporte.png'), fullPage: true, scale: 'css' });
      await context.setOffline(false);
    });
  }
}
