/**
 * El diálogo de impresión del equipo (HU-Q2.5, PARQUEADERO §7.5): un PC con Windows y la PT-210
 * por USB, o una impresora común. `window.print()` se reemplaza para guardar la hoja que la caja
 * puso en la página; su forma al imprimir se mide con los medios de impresión de Chromium.
 */
import { expect, type Page, test } from '@playwright/test';
import {
  abrirControlada,
  abrirTurno,
  instalarImpresoraFalsa,
  llenarAjustes,
  teclearPlaca,
} from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

/** `print()` guarda la hoja y avisa que terminó, como Chrome con `--kiosk-printing`. */
function dialogoFalso() {
  const hojas: string[] = [];
  Object.assign(window, { __hojas: hojas });
  window.print = () => {
    hojas.push(document.querySelector('.impresion-del-sistema')?.innerHTML ?? '(sin hoja)');
    dispatchEvent(new Event('afterprint'));
  };
}

const hojas = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hojas: string[] }).__hojas);

test('HU-Q2.5 · con el diálogo de impresión, el recibo sale en una hoja de 48 mm y vuelve sola', async ({
  page,
}) => {
  await page.addInitScript(instalarImpresoraFalsa);
  await page.addInitScript(dialogoFalso);
  await page.clock.setFixedTime(new Date('2026-10-06T23:05:00Z'));
  await abrirControlada(page);

  await page.getByRole('button', { name: 'Configurar impresora' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Usar el diálogo de impresión' }).click();
  await expect(page.getByTestId('conectada')).toHaveText(
    'Conectada: Diálogo de impresión del equipo',
  );
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Imprimir página de prueba' }).click();
  await expect(page.getByTestId('enviada')).toHaveText('Enviado a la impresora.');
  const [prueba] = await hojas(page);
  expect(prueba).toContain('Él tenía más años');
  expect(prueba).toContain('<svg class="qr"');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  // Una sola pregunta: las tildes y el QR los dibuja el sistema, no la página de códigos.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    '4 de 4 · Mire la hoja que acaba de salir',
  );
  await expect(page.getByRole('button', { name: 'Falta decir si salió bien' })).toBeDisabled();
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByTestId('resumen')).toContainText('diálogo de impresión del equipo');
  await page.getByRole('button', { name: 'Volver a la caja' }).click();
  await expect(page.getByTestId('senal-impresora')).toHaveText('Impresora conectada');

  await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
  await llenarAjustes(page, { ensayo: 'uno', imprimir: 'Sí' });
  await page.getByRole('button', { name: 'Nueva entrada' }).click();
  await abrirTurno(page);
  await teclearPlaca(page, 'ABC123');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo de entrada A-000001');
  await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
  const recibo = (await hojas(page)).at(-1) ?? '';
  for (const t of ['PARQUEADERO ENSAYO UNO', 'RECIBO DE ENTRADA', 'A-000001', 'ABC123']) {
    expect(recibo).toContain(t);
  }
  expect(recibo).toContain('Póliza: Aseguradora 0000000');
  expect(recibo).toContain('<svg class="qr"');
  // En pantalla, la hoja ya no está: solo existió mientras se imprimía.
  await expect(page.locator('.impresion-del-sistema')).toHaveCount(0);

  // Al imprimir: solo la hoja, de 48 mm, y ninguna línea se sale de ella.
  await page.evaluate((html) => {
    const hoja = document.createElement('div');
    hoja.className = 'impresion-del-sistema';
    hoja.innerHTML = html;
    document.body.append(hoja);
    document.documentElement.classList.add('imprimiendo-hoja-58');
  }, recibo);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#caja')).toBeHidden();
  const medidas = await page.evaluate(() => {
    const hoja = document.querySelector<HTMLElement>('.hoja-58');
    const mm = (px: number) => (px * 25.4) / 96;
    return {
      ancho: mm(hoja?.getBoundingClientRect().width ?? 0),
      desbordadas: [...(hoja?.querySelectorAll<HTMLElement>('.l') ?? [])].filter(
        (l) => l.scrollWidth > l.clientWidth,
      ).length,
      qr: mm(hoja?.querySelector('svg')?.getBoundingClientRect().width ?? 0),
    };
  });
  expect(medidas.ancho).toBeCloseTo(48, 0);
  expect(medidas.desbordadas).toBe(0);
  expect(medidas.qr).toBeCloseTo(28, 0);
  await page.emulateMedia({ media: 'screen' });

  // Al abrir otra vez la caja, sin elegir nada (CA1 de HU-Q2.4, ahora también con el diálogo).
  await page.reload();
  await expect(page.getByTestId('senal-impresora')).toHaveText('Impresora conectada');
});
