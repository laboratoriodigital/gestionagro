/**
 * Monitoreo de plagas y enfermedades (HU-E3.11) en un teléfono de 360 px y sin señal, con las dos
 * fincas de prueba (P4). Las fotos son del plan Finca (ARQUITECTURA §2.4): con el gratuito no se
 * ofrecen. La foto es ruido de 2.400 × 1.800 px, lo que peor se comprime: tiene que quedar en
 * ≤ 150 KB.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { configurar, conPlan } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

/** Una foto PNG grande de ruido, hecha en el navegador. */
async function fotoGrande(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = 2400;
    lienzo.height = 1800;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return '';
    const img = ctx.createImageData(lienzo.width, lienzo.height);
    for (let i = 0; i < img.data.length; i += 4) {
      img.data[i] = (i * 13) % 251;
      img.data[i + 1] = (i * 7 + ((i / 4) % 97)) % 253;
      img.data[i + 2] = (i * 3) % 241;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return lienzo.toDataURL('image/png').split(',')[1] ?? '';
  });
  return Buffer.from(base64, 'base64');
}

test('CA3: con el plan gratuito no se ofrecen fotos, y el monitoreo se guarda igual', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0];
  const area = f?.areas[0];
  if (!f || !area) throw new Error('sin finca');
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Monitoreo', exact: true }).click();
  const form = page.locator('[data-prueba="formulario-monitoreo"]');
  await expect(form.locator('[data-prueba="fotos-plan"]')).toHaveText(
    'Las fotos de monitoreo vienen con el plan Finca. El monitoreo se guarda igual, sin foto.',
  );
  await expect(form.getByLabel('Foto (opcional)')).toHaveCount(0);
  await form.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await form.getByLabel('Qué viste').fill('Enfermedad Ensayo');
  await form.getByLabel('Enfermedad', { exact: true }).check();
  await form.getByLabel('Observación').check();
  await form.getByLabel('Bajo').check();
  await form.getByRole('button', { name: 'Guardar monitoreo' }).click();
  await expect(page.locator('[data-prueba="registro-monitoreo"]')).toContainText(
    'Monitoreo · Enfermedad Ensayo · nivel bajo · observación',
  );
});

for (const f of FINCAS_DE_PRUEBA) {
  test(`${f.finca.nombre} · CA1, CA2 y CA3: plan Finca, monitoreo con foto liviana, sin señal`, async ({
    page,
    context,
  }) => {
    const area = f.areas[0];
    if (!area) throw new Error('sin áreas');
    await configurar(page, f);
    await conPlan(page, 'finca');
    const png = await fotoGrande(page);
    expect(png.length).toBeGreaterThan(150 * 1024);
    await context.setOffline(true);
    await nav(page).getByRole('link', { name: 'Registrar' }).click();
    await page.getByRole('button', { name: 'Monitoreo', exact: true }).click();
    const form = page.locator('[data-prueba="formulario-monitoreo"]');
    await form.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
    await form.getByLabel('Qué viste').fill('Plaga Ensayo');
    await form.getByLabel('Plaga', { exact: true }).check();
    await form.getByLabel('Trampa').check();
    await form.getByLabel('Individuos en la trampa (opcional)').fill('12');
    await form.getByLabel('Medio').check();
    await expect(form.locator('[data-prueba="cuota-fotos"]')).toContainText(
      '0 de 120 fotos este mes en este teléfono',
    );
    await form.getByLabel('Foto (opcional)').setInputFiles({
      name: 'trampa.png',
      mimeType: 'image/png',
      buffer: png,
    });
    // Ruido es lo que peor se comprime: con la suite en paralelo puede tardar varios segundos.
    await expect(form.locator('[data-prueba="foto-lista"]')).toBeVisible({ timeout: 30_000 });
    const kb = Number(
      ((await form.locator('[data-prueba="foto-lista"]').textContent()) ?? '').match(
        /(\d+) KB/,
      )?.[1],
    );
    expect(kb).toBeGreaterThan(0);
    expect(kb).toBeLessThanOrEqual(150);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await form.getByRole('button', { name: 'Guardar monitoreo' }).click();
    await expect(page.getByText('Monitoreo guardado en este teléfono.')).toBeVisible();
    await expect(form.locator('[data-prueba="cuota-fotos"]')).toContainText(
      '1 de 120 fotos este mes',
    );
    const r = page.locator('[data-prueba="registro-monitoreo"]');
    await expect(r).toContainText(
      'Monitoreo · Plaga Ensayo · nivel medio · trampa · 12 individuos · con foto',
    );
    await expect(r).toContainText('Solo en este teléfono');

    // CA1: el nombre ya anotado se sugiere la próxima vez.
    await expect(form.locator('#monitoreo-plagas option')).toHaveAttribute('value', 'Plaga Ensayo');
    // La foto está en el teléfono y pesa lo que dijo.
    const tamanos = await page.evaluate(
      () =>
        new Promise<number[]>((resolver) => {
          const pedido = indexedDB.open('gestionagro-cuaderno');
          pedido.onsuccess = () => {
            const tx = pedido.result.transaction('foto', 'readonly');
            const todo = tx.objectStore('foto').getAll();
            todo.onsuccess = () =>
              resolver((todo.result as { tamano: number }[]).map((x) => x.tamano));
          };
        }),
    );
    expect(tamanos).toHaveLength(1);
    expect(tamanos[0]).toBeLessThanOrEqual(150 * 1024);

    // Revisión del dueño (5 oct 2026): la foto se puede ver, no solo guardar.
    const verFoto = r.getByRole('button', { name: 'Ver foto' });
    await verFoto.click();
    const imagen = r.locator('[data-prueba="foto-del-registro-imagen"]');
    await expect(imagen).toBeVisible();
    await expect(imagen).toHaveAttribute('alt', /^Foto de Plaga Ensayo en /);
    // Que la imagen cargó de verdad (no un cuadro roto), con el tamaño ya achicado.
    const ancho = await imagen.evaluate((img) => (img as HTMLImageElement).naturalWidth);
    expect(ancho).toBeGreaterThan(0);
    expect(ancho).toBeLessThanOrEqual(1280);
    await r.getByRole('button', { name: 'Ocultar foto' }).click();
    await expect(imagen).toHaveCount(0);

    // Una foto que no está en este teléfono (el registro llegó de otro) se dice, no se rompe.
    await page.evaluate(
      () =>
        new Promise<void>((listo) => {
          const pedido = indexedDB.open('gestionagro-cuaderno');
          pedido.onsuccess = () => {
            const tx = pedido.result.transaction('foto', 'readwrite');
            tx.objectStore('foto').clear();
            tx.oncomplete = () => {
              pedido.result.close();
              listo();
            };
          };
        }),
    );
    await verFoto.click();
    await expect(r.locator('[data-prueba="foto-en-otro-telefono"]')).toHaveText(
      'Esta foto se tomó en otro teléfono. Por ahora las fotos se quedan en el teléfono donde se toman.',
    );
    await expect(imagen).toHaveCount(0);

    // En Historial, el mismo registro también ofrece su foto.
    await page
      .getByRole('navigation', { name: 'Secciones del cuaderno' })
      .getByRole('link', { name: 'Historial' })
      .click();
    const enHistorial = page.locator('[data-prueba="historial-monitoreo"]');
    await enHistorial.getByRole('button', { name: 'Ver foto' }).click();
    await expect(enHistorial.locator('[data-prueba="foto-en-otro-telefono"]')).toBeVisible();
  });
}
