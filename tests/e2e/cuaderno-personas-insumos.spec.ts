/**
 * Personas (HU-E3.5) e insumos (HU-E3.6) en un teléfono de 360 px, con las dos fincas de prueba
 * (P4). Se esperan estados, no tiempos (P19).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { RUTAS_APP } from '../../apps/cuaderno/src/rutas.ts';
import { RAIZ } from '../../scripts/lib/repo.ts';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { agregarInsumo, configurar, ROL } from './ayudas.ts';

async function irA(page: Page, seccion: 'Personas' | 'Insumos') {
  await page
    .getByRole('navigation', { name: 'Secciones del cuaderno' })
    .getByRole('link', { name: seccion })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(seccion);
}

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('HU-E3.5 CA1 y CA2: agrega personas con nombre y rol, sin cédula ni teléfono', async ({
      page,
    }) => {
      await configurar(page, f);
      await irA(page, 'Personas');
      for (const p of f.personas) {
        await page.getByRole('button', { name: 'Agregar persona' }).click();
        await expect(page.getByLabel(/cédula|teléfono|celular/i)).toHaveCount(0);
        await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
        await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
        await page.getByLabel('Valor del jornal en pesos (opcional)').fill('60.000');
        await page.getByRole('button', { name: 'Guardar persona' }).click();
      }
      const activas = page.locator('[data-prueba="personas-activas"] li');
      await expect(activas).toHaveCount(f.personas.length);
      for (const p of f.personas)
        await expect(activas.filter({ hasText: `${p.nombre} · ${ROL[p.rol]}` })).toHaveCount(1);
    });

    test('HU-E3.5 CA3: quien ya no trabaja sale de la lista y se puede reactivar', async ({
      page,
    }) => {
      await configurar(page, f);
      await irA(page, 'Personas');
      const p = f.personas[0];
      if (!p) throw new Error('sin personas');
      await page.getByRole('button', { name: 'Agregar persona' }).click();
      await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
      await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
      await page.getByRole('button', { name: 'Guardar persona' }).click();
      await page.getByRole('button', { name: `Desactivar a ${p.nombre}` }).click();
      await expect(page.locator('[data-prueba="personas-activas"]')).toHaveCount(0);
      await page.getByText(/Personas que ya no trabajan aquí \(1\)/).click();
      await page.getByRole('button', { name: `Reactivar a ${p.nombre}` }).click();
      await expect(page.locator('[data-prueba="personas-activas"] li')).toHaveCount(1);
    });

    test('HU-E3.6 CA1, CA2 y CA4: insumos con datos de etiqueta; carencia vacía es «desconocida»', async ({
      page,
    }) => {
      await configurar(page, f);
      await irA(page, 'Insumos');
      await page.getByRole('button', { name: 'Agregar insumo' }).click();
      await expect(page.locator('[data-prueba="texto-etiqueta"]')).toHaveText(
        'Copia estos datos de la etiqueta del producto registrado ante el ICA. Esta app no recomienda productos ni dosis.',
      );
      await page.getByRole('button', { name: 'Cancelar' }).click();
      for (const i of f.insumos) await agregarInsumo(page, i);
      for (const i of f.insumos) {
        const item = page.locator('[data-prueba="insumo"]').filter({ hasText: i.nombre_comercial });
        if (i.registro_ica) await expect(item).toContainText(`Registro ICA ${i.registro_ica}`);
        if (i.carencia_dias === null) {
          await expect(item.locator('.desconocida')).toHaveText('Carencia: desconocida');
        } else {
          await expect(item).toContainText(
            `Carencia: ${i.carencia_dias} ${i.carencia_dias === 1 ? 'día' : 'días'}`,
          );
        }
      }
      await page.reload();
      await expect(page.locator('[data-prueba="insumo"]')).toHaveCount(f.insumos.length);
    });

    test('HU-E3.6 CA3: aviso ecológico solo en finca ecológica y sin bloquear', async ({
      page,
    }) => {
      await configurar(page, f);
      await irA(page, 'Insumos');
      for (const i of f.insumos) await agregarInsumo(page, i);
      const conAviso = f.insumos.filter(
        (i) => f.finca.regimen === 'ecologico' && i.permitido_ecologico !== true,
      );
      await expect(page.locator('[data-prueba="aviso-ecologico"]')).toHaveCount(conAviso.length);
      for (const i of conAviso) {
        await expect(
          page
            .locator('[data-prueba="insumo"]')
            .filter({ hasText: i.nombre_comercial })
            .locator('[data-prueba="aviso-ecologico"]'),
        ).toContainText('no lo bloquea');
      }
    });
  });
}

test('un plazo ilegible no se guarda y lo dice junto al campo', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  await irA(page, 'Insumos');
  await page.getByRole('button', { name: 'Agregar insumo' }).click();
  await page.getByLabel('Nombre comercial').fill('Insumo Ensayo X');
  await page.getByLabel('Bioinsumo').check();
  await page.getByLabel('Unidad').selectOption('L');
  await page.getByLabel('Periodo de carencia (días)').fill('1,5');
  await page.getByRole('radio', { name: 'No sé' }).check();
  await page.getByRole('button', { name: 'Guardar insumo' }).click();
  await expect(page.getByText(/Escribe un número entero de días/)).toBeVisible();
  await expect(page.locator('[data-prueba="insumo"]')).toHaveCount(0);
});

test('un enlace directo a /agro/app/insumos/ abre la pantalla, y las dos pantallas cumplen WCAG 2.1 AA', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  await configurar(page, f);
  for (const [ruta, titulo] of [
    ['/agro/app/personas/', 'Personas'],
    ['/agro/app/insumos/', 'Insumos'],
  ] as const) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(titulo);
    await page
      .getByRole('button', { name: titulo === 'Personas' ? 'Agregar persona' : 'Agregar insumo' })
      .click();
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  }
});

test('el paquete de despliegue trae un index.html en cada ruta del cuaderno', async () => {
  // En producción no hay fallback de SPA: sin esta copia, un enlace directo da 404 hasta que el
  // service worker se instala. El servidor de pruebas sí tiene fallback, por eso se mira el paquete.
  for (const { segmento } of RUTAS_APP) {
    const archivo = join(RAIZ, 'apps', 'sitio', 'dist', 'agro', 'app', segmento, 'index.html');
    expect(existsSync(archivo), `${archivo} (corre «pnpm build»)`).toBe(true);
    expect(readFileSync(archivo, 'utf8')).toContain('noindex');
  }
});

test.describe('insumos: editar y unidad propia (revisión del dueño, 1 oct 2026)', () => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;

  test('un insumo se edita con sus datos cargados y guarda la versión anterior', async ({
    page,
  }) => {
    await configurar(page, f);
    await irA(page, 'Insumos');
    const sinCarencia = f.insumos.find((i) => i.carencia_dias === null);
    if (!sinCarencia) throw new Error('la finca de prueba necesita un insumo sin carencia');
    await agregarInsumo(page, sinCarencia);
    await page.getByRole('button', { name: `Editar ${sinCarencia.nombre_comercial}` }).click();
    await expect(page.getByLabel('Nombre comercial')).toHaveValue(sinCarencia.nombre_comercial);
    await expect(page.getByLabel('Periodo de carencia (días)')).toHaveValue('');
    await page.getByLabel('Periodo de carencia (días)').fill('3');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    const item = page
      .locator('[data-prueba="insumo"]')
      .filter({ hasText: sinCarencia.nombre_comercial });
    await expect(item).toContainText('Carencia: 3 días');
    await expect(item.locator('.desconocida').filter({ hasText: 'Carencia' })).toHaveCount(0);
  });

  test('«Otra unidad…» guarda una unidad propia y la conserva al editar', async ({ page }) => {
    await configurar(page, f);
    await irA(page, 'Insumos');
    await page.getByRole('button', { name: 'Agregar insumo' }).click();
    await page.getByLabel('Nombre comercial').fill('Abono Ensayo Bulto');
    await page.getByLabel('Fertilizante').check();
    await page.getByLabel('Unidad').selectOption({ label: 'Otra unidad…' });
    await page.getByRole('button', { name: 'Guardar insumo' }).click();
    await expect(page.getByText('Escribe la unidad, por ejemplo «bulto 25 kg».')).toBeVisible();
    await page.getByLabel('Nombre de la unidad').fill('bulto 25 kg');
    await page.getByRole('radio', { name: 'No sé' }).check();
    await page.getByRole('button', { name: 'Guardar insumo' }).click();
    const item = page.locator('[data-prueba="insumo"]').filter({ hasText: 'Abono Ensayo Bulto' });
    await expect(item).toContainText('Fertilizante · bulto 25 kg');
    await page.getByRole('button', { name: 'Editar Abono Ensayo Bulto' }).click();
    await expect(page.getByLabel('Unidad', { exact: true })).toHaveValue('__otra__');
    await expect(page.getByLabel('Nombre de la unidad')).toHaveValue('bulto 25 kg');
  });
});
