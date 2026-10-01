/**
 * Lotes de venta (HU-E6.2) en un teléfono de 360 px y sin señal, con las dos fincas de prueba (P4).
 * Que una cosecha no entre en dos lotes se prueba en el almacén (`lotes.test.ts`).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { configurar } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const form = (page: Page) => page.locator('[data-prueba="formulario-cosecha"]');

async function cosechar(page: Page, area: string, cantidad: string) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Cantidad cosechada').fill(cantidad);
  await form(page).getByLabel('kg', { exact: true }).check();
  await form(page).getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await expect(page.getByText('Cosecha guardada en este teléfono.')).toBeVisible();
}

/** Día y mes en letras de hoy en Colombia (`01OCT`): el código del lote usa la fecha de la finca (P8). */
const hoyEnColombia = () => {
  const [, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
    .format(new Date())
    .split('-');
  const meses = [
    'ENE',
    'FEB',
    'MAR',
    'ABR',
    'MAY',
    'JUN',
    'JUL',
    'AGO',
    'SEP',
    'OCT',
    'NOV',
    'DIC',
  ];
  return { ddmm: `${d}${meses[Number(m) - 1]}`, corta: `${d}/${m}` };
};

for (const f of FINCAS_DE_PRUEBA) {
  test(`${f.finca.nombre} · CA1 y CA3: armar un lote sin señal, con código y de dónde viene`, async ({
    page,
    context,
  }) => {
    const [a1, a2] = f.areas;
    if (!a1 || !a2) throw new Error('faltan áreas');
    await configurar(page, f);
    await context.setOffline(true);
    await cosechar(page, a1.nombre, '30,5');
    await cosechar(page, a2.nombre, '12');
    await nav(page).getByRole('link', { name: 'Lotes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Lotes de venta' })).toBeVisible();
    const hoy = hoyEnColombia();
    await page.getByLabel(`${a1.nombre} · ${hoy.corta} · Primera · 30,5 kg`).check();
    await page.getByLabel(`${a2.nombre} · ${hoy.corta} · Primera · 12 kg`).check();
    await expect(page.locator('[data-prueba="total-lote"]')).toHaveText('2 cosechas · 42,5 kg');
    await page.getByRole('button', { name: 'Armar lote' }).click();

    const lote = page.locator('[data-prueba="lote"]');
    await expect(lote).toHaveCount(1);
    // Sin ciclo, el cultivo no se conoce: la inicial es M.
    await expect(lote.locator('.codigo-lote')).toHaveText(`M-${hoy.ddmm}-1`);
    await expect(lote).toContainText('42,5 kg');
    await expect(lote.locator('[data-prueba="origen-lote"]')).toHaveText(
      `De ${a1.nombre} (${hoy.corta}), ${a2.nombre} (${hoy.corta})`,
    );
    await expect(page.locator('[data-prueba="sin-cosechas-libres"]')).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // Cambiar las cosechas conserva el código.
    await page
      .getByRole('button', { name: `Cambiar las cosechas del lote M-${hoy.ddmm}-1` })
      .click();
    await page.getByLabel(`${a2.nombre} · ${hoy.corta} · Primera · 12 kg`).uncheck();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(lote.locator('.codigo-lote')).toHaveText(`M-${hoy.ddmm}-1`);
    await expect(lote).toContainText('30,5 kg');
    await expect(page.getByLabel(`${a2.nombre} · ${hoy.corta} · Primera · 12 kg`)).toBeVisible();
  });
}

test('HU-E6.3: despachar un lote sin señal, con cliente, precio y medio de pago; el saldo manda', async ({
  page,
  context,
}) => {
  const f = FINCAS_DE_PRUEBA[0];
  const a1 = f?.areas[0];
  if (!f || !a1) throw new Error('sin finca');
  await configurar(page, f);
  await context.setOffline(true);
  await cosechar(page, a1.nombre, '42,5');
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  const hoy = hoyEnColombia();
  await page.getByLabel(`${a1.nombre} · ${hoy.corta} · Primera · 42,5 kg`).check();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  const codigo = `M-${hoy.ddmm}-1`;

  const despachar = async (cantidad: string, precio: string) => {
    await page.getByRole('button', { name: `Despachar el lote ${codigo}` }).click();
    const formulario = page.locator('[data-prueba="formulario-despacho"]');
    await formulario.getByLabel('Cliente').fill('Cliente Ensayo');
    await formulario.getByLabel('Restaurante').check();
    await formulario.getByLabel(`Cantidad del lote ${codigo} (kg)`).fill(cantidad);
    await formulario.getByLabel('Precio por kg en pesos (opcional)').fill(precio);
    await formulario.getByLabel('Transferencia').check();
    await formulario.getByRole('button', { name: 'Guardar despacho' }).click();
    return formulario;
  };

  // CA5: un precio que no se puede leer se dice; no se guarda como cero.
  const primero = await despachar('10', 'tres mil');
  await expect(
    primero.getByText('Escribe el precio en pesos, sin decimales, o déjalo vacío.'),
  ).toBeVisible();
  await primero.getByLabel('Precio por kg en pesos (opcional)').fill('3.500');
  await primero.getByRole('button', { name: 'Guardar despacho' }).click();

  const despacho = page.locator('[data-prueba="despacho"]');
  await expect(despacho).toHaveCount(1);
  await expect(despacho).toContainText('Cliente Ensayo · restaurante');
  await expect(despacho).toContainText(`${codigo}: 10 kg`);
  await expect(despacho.locator('[data-prueba="precio-despacho"]')).toHaveText(
    '$ 3.500 por kg · total $ 35.000 · transferencia',
  );
  await expect(page.locator('[data-prueba="saldo-lote"]')).toHaveText(
    'Despachado 10 kg · quedan 32,5 kg',
  );

  // CA4: más de lo que queda avisa y no guarda.
  const otro = await despachar('40', '');
  await expect(otro.getByRole('alert')).toHaveText(
    `No se guardó: al lote ${codigo} le quedan 32,5 kg y quieres despachar 40.`,
  );
  await expect(despacho).toHaveCount(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('revisión del dueño: otro lote con una cosecha nueva, y sumarla a un lote tocando su texto', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0];
  const a1 = f?.areas[0];
  if (!f || !a1) throw new Error('sin finca');
  await configurar(page, f);
  await cosechar(page, a1.nombre, '10');
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  const hoy = hoyEnColombia();
  await page.getByText(`${a1.nombre} · ${hoy.corta} · Primera · 10 kg`).click();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  // Sin cosechas libres, dice por qué y adónde ir.
  await expect(page.locator('[data-prueba="sin-cosechas-libres"]')).toContainText(
    'todas las anotadas ya están en uno',
  );

  // Una cosecha nueva sirve para otro lote…
  await cosechar(page, a1.nombre, '20');
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.getByText(`${a1.nombre} · ${hoy.corta} · Primera · 20 kg`).click();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  await expect(page.locator('.codigo-lote')).toHaveText([`M-${hoy.ddmm}-2`, `M-${hoy.ddmm}-1`]);

  // …o para sumarla a uno ya armado, tocando el texto de la cosecha.
  await cosechar(page, a1.nombre, '5');
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.getByRole('button', { name: `Cambiar las cosechas del lote M-${hoy.ddmm}-1` }).click();
  await expect(page.getByRole('button', { name: 'Armar lote' })).toHaveCount(0);
  await page.getByText(`${a1.nombre} · ${hoy.corta} · Primera · 5 kg`).click();
  await expect(page.locator('[data-prueba="total-lote"]')).toHaveText('2 cosechas · 15 kg');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.locator('[data-prueba="lote"]').nth(1)).toContainText(
    `M-${hoy.ddmm}-1 · 15 kg`,
  );
});
