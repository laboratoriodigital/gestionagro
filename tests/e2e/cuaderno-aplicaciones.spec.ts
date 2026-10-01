/**
 * Aplicaciones y vencimientos (HU-E3.10) en un teléfono de 360 px, con las dos fincas de prueba
 * (P4). El reloj del navegador es fijo; uno de los casos corre con el teléfono en otro huso (P8).
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, ROL, vigilarTexto } from './ayudas.ts';

/** 10/12/2026 a las 9:30 en Bogotá. */
const APLICADO = new Date('2026-12-10T14:30:00Z');

const TRES_DIAS: FincaDePrueba['insumos'][number] = {
  nombre_comercial: 'Producto Tres Días',
  tipo: 'fitosanitario',
  registro_ica: 'REG-ENSAYO-0099',
  ingrediente_activo: 'Sustancia de ensayo',
  unidad: 'mL',
  carencia_dias: 3,
  reentrada_horas: 4,
  permitido_ecologico: true,
};

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const form = (page: Page) => page.locator('[data-prueba="formulario-aplicacion"]');

async function preparar(page: Page, f: FincaDePrueba) {
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Personas' }).click();
  const p = f.personas[0];
  if (!p) throw new Error('sin personas');
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();
  await nav(page).getByRole('link', { name: 'Insumos' }).click();
  for (const i of [...f.insumos, TRES_DIAS]) await agregarInsumo(page, i);
  return p.nombre;
}

async function abrirAplicaciones(page: Page) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Aplicaciones', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Aplicaciones' })).toBeVisible();
}

async function aplicar(page: Page, area: string, insumo: string, persona: string) {
  await form(page).getByLabel(area, { exact: true }).check();
  await page.getByLabel('Insumo', { exact: true }).selectOption({ label: insumo });
  await page.getByLabel('Cantidad').fill('2');
  await page.getByLabel(/^Unidad, como en la etiqueta/).fill('cm³ por litro');
  await form(page).getByLabel(persona, { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar aplicación' }).click();
}

const areaEnFinca = (page: Page, nombre: string) =>
  page.locator('[data-prueba="area"]').filter({
    has: page.locator('.area-titulo strong', { hasText: new RegExp(`^${nombre}$`) }),
  });

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA1: aplicada el 10/12 con 3 días de carencia, la nave dice «No cosechar hasta el 13/12» y la reentrada, sin señal', async ({
      page,
      context,
    }) => {
      await page.clock.setFixedTime(APLICADO);
      const area = f.areas[f.areas.length - 1]?.nombre ?? '';
      const persona = await preparar(page, f);
      // Con insumos y personas guardados, nunca debe decir que faltan, ni mientras carga.
      const vioInsumos = await vigilarTexto(page, 'Primero agrega los insumos');
      const vioPersonas = await vigilarTexto(page, 'Primero agrega las personas');
      await abrirAplicaciones(page);
      await expect(page.getByLabel('Insumo', { exact: true })).toBeVisible();
      expect(await vioInsumos()).toBe(false);
      expect(await vioPersonas()).toBe(false);
      await context.setOffline(true);
      await aplicar(page, area, TRES_DIAS.nombre_comercial, persona);
      const guardada = page.locator('[data-prueba="aplicacion-guardada"]');
      await expect(guardada).toContainText('Aplicación guardada en este teléfono.');
      await expect(guardada).toContainText('No cosechar hasta el 13/12 (Producto Tres Días)');
      await expect(page.locator('[data-prueba="registro-aplicacion"]')).toContainText(
        `Aplicación · Producto Tres Días · 2 cm³ por litro · ${persona}`,
      );

      await nav(page).getByRole('link', { name: 'Áreas' }).click();
      const nave = areaEnFinca(page, area);
      await expect(nave.locator('[data-prueba="carencia"]')).toHaveText(
        'No cosechar hasta el 13/12 (Producto Tres Días)',
      );
      await expect(nave.locator('[data-prueba="reentrada"]')).toHaveText(
        'Reentrada desde 10/12/2026 13:30 (Producto Tres Días)',
      );
      // Solo el área aplicada.
      await expect(page.locator('[data-prueba="vencimientos"]')).toHaveCount(1);
      await context.setOffline(false);
    });
  });
}

test('CA2: la app no sugiere dosis; la dosis va como número y unidad de la etiqueta', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  const persona = await preparar(page, f);
  await abrirAplicaciones(page);
  await form(page)
    .getByLabel(f.areas[0]?.nombre ?? '', { exact: true })
    .check();
  await page
    .getByLabel('Insumo', { exact: true })
    .selectOption({ label: TRES_DIAS.nombre_comercial });
  await expect(
    form(page).getByRole('group', { name: 'Dosis según etiqueta del producto' }),
  ).toContainText('Esta app no sugiere dosis.');
  await expect(page.getByLabel('Cantidad')).toHaveValue('');
  await expect(page.getByLabel(/^Unidad, como en la etiqueta/)).toHaveValue('');
  await form(page).getByLabel(persona, { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar aplicación' }).click();
  await expect(page.locator('#aplicacion-dosis-error')).toHaveText(
    'Escribe la dosis de la etiqueta.',
  );
  await expect(page.locator('#aplicacion-dosis-unidad-error')).toHaveText(
    'Escribe la unidad como dice la etiqueta.',
  );
  await expect(page.locator('[data-prueba="registro-aplicacion"]')).toHaveCount(0);
});

test('CA4 y CA5: carencia desconocida bloquea en rojo; en finca ecológica aparece el aviso del insumo', async ({
  page,
}) => {
  await page.clock.setFixedTime(APLICADO);
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  const sinCarencia = f.insumos.find((i) => i.carencia_dias === null);
  if (!sinCarencia) throw new Error('la finca de prueba necesita un insumo sin carencia');
  const area = f.areas[0]?.nombre ?? '';
  const persona = await preparar(page, f);
  await abrirAplicaciones(page);
  await page
    .getByLabel('Insumo', { exact: true })
    .selectOption({ label: sinCarencia.nombre_comercial });
  await expect(page.locator('[data-prueba="aplicacion-plazos"] .desconocida')).toHaveText(
    'Carencia: desconocida',
  );
  await expect(page.locator('[data-prueba="aviso-ecologico"]')).toContainText(
    'No está marcado como permitido en producción ecológica',
  );
  await page
    .getByLabel('Insumo', { exact: true })
    .selectOption({ label: TRES_DIAS.nombre_comercial });
  await expect(page.locator('[data-prueba="aviso-ecologico"]')).toHaveCount(0);

  await aplicar(page, area, sinCarencia.nombre_comercial, persona);
  await nav(page).getByRole('link', { name: 'Áreas' }).click();
  const carencia = areaEnFinca(page, area).locator('[data-prueba="carencia"]');
  await expect(carencia).toHaveText(
    `Carencia desconocida de ${sinCarencia.nombre_comercial}: no cosechar hasta completarla en Insumos`,
  );
  await expect(carencia).toHaveClass('bloqueo');
});

test.describe('con el teléfono en otro huso horario', () => {
  test.use({ timezoneId: 'Asia/Tokyo' });

  test('CA3: aplicada a las 22:30 de Bogotá cuenta el día de la finca, no el del teléfono ni el UTC; cumple WCAG 2.1 AA', async ({
    page,
  }) => {
    // 10/12 22:30 en Bogotá = 11/12 03:30 UTC = 11/12 12:30 en Tokio.
    await page.clock.setFixedTime(new Date('2026-12-11T03:30:00Z'));
    const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
    const area = f.areas[0]?.nombre ?? '';
    const persona = await preparar(page, f);
    await abrirAplicaciones(page);
    await aplicar(page, area, TRES_DIAS.nombre_comercial, persona);
    await nav(page).getByRole('link', { name: 'Áreas' }).click();
    const nave = areaEnFinca(page, area);
    await expect(nave.locator('[data-prueba="carencia"]')).toHaveText(
      'No cosechar hasta el 13/12 (Producto Tres Días)',
    );
    await expect(nave.locator('[data-prueba="reentrada"]')).toHaveText(
      'Reentrada desde 11/12/2026 02:30 (Producto Tres Días)',
    );
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
