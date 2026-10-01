/**
 * Historial y corregir sin borrar (HU-E3.12) en un teléfono de 360 px, con las dos fincas de
 * prueba (P4). Se esperan estados, no tiempos (P19); el único tiempo medido es el del CA1.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { configurar, ROL } from './ayudas.ts';

/** 10/12/2026 a las 10:00 en Bogotá. */
const HOY = new Date('2026-12-10T15:00:00Z');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(HOY);
});

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });
const items = (page: Page) => page.locator('[data-prueba="historial"] > li');

async function registrarClima(page: Page, area: string, t: string, hr: string) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Clima', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Temperatura del aire (°C)').fill(t);
  await page.getByLabel('Humedad relativa (%)').fill(hr);
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.getByText('Guardado en este teléfono.')).toBeVisible();
}

async function abrirHistorial(page: Page) {
  await nav(page).getByRole('link', { name: 'Historial' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Historial' })).toBeVisible();
}

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('CA2 y CA3: corregir crea otra versión; la anterior se ve con cuándo y dónde; no hay borrar', async ({
      page,
    }) => {
      const area = f.areas[0]?.nombre ?? '';
      await configurar(page, f);
      await registrarClima(page, area, '24', '70');
      await abrirHistorial(page);
      await expect(items(page)).toHaveCount(1);
      await expect(items(page)).toContainText('Clima · 24 °C · 70 %');

      await page.clock.setFixedTime(new Date(HOY.getTime() + 2 * 3_600_000));
      await items(page).getByRole('button', { name: 'Corregir' }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Corregir clima' })).toBeVisible();
      await expect(page.locator('[data-prueba="evento-que-se-corrige"]')).toContainText(
        `${area} · 10/12/2026 10:00`,
      );
      await expect(page.getByLabel('Temperatura del aire (°C)')).toHaveValue('24');
      await page.getByLabel('Temperatura del aire (°C)').fill('26');
      await page.getByRole('button', { name: 'Guardar corrección' }).click();
      await expect(page.getByText('Corrección guardada en este teléfono.')).toBeVisible();

      // Sigue siendo un solo evento, con su hora original, ahora corregido.
      await expect(items(page)).toHaveCount(1);
      await expect(items(page)).toContainText(`${area} · 10/12/2026 10:00 · Corregido`);
      await expect(items(page)).toContainText('Clima · 26 °C · 70 %');
      await items(page).getByRole('button', { name: 'Versiones anteriores (1)' }).click();
      const anulada = page.locator('[data-prueba="version-anulada"]');
      await expect(anulada).toContainText('Clima · 24 °C · 70 %');
      await expect(anulada).toContainText(
        'Anotado el 10/12/2026 10:00 en este teléfono · corregido el 10/12/2026 12:00 en este teléfono',
      );
      // CA3: ninguna acción borra.
      await expect(page.getByRole('button', { name: /borrar|eliminar/i })).toHaveCount(0);

      // Registrar muestra solo la versión vigente.
      await nav(page).getByRole('link', { name: 'Registrar' }).click();
      const ultimos = page.locator('[data-prueba="registro-clima"]');
      await expect(ultimos).toHaveCount(1);
      await expect(ultimos).toContainText('26 °C');
    });
  });
}

test('corregir un riego y una labor abre el formulario con lo guardado', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  const area = f.areas[0]?.nombre ?? '';
  const p = f.personas[0];
  if (!p) throw new Error('sin personas');
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Personas' }).click();
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill(p.nombre);
  await page.getByRole('radio', { name: ROL[p.rol], exact: true }).check();
  await page.getByRole('button', { name: 'Guardar persona' }).click();

  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Riego', exact: true }).click();
  const riego = page.locator('[data-prueba="formulario-riego"]');
  await riego.getByLabel(area, { exact: true }).check();
  await riego.getByLabel('L por área').check();
  await page.getByLabel('Volumen aplicado').fill('1200');
  await page.getByLabel('Duración del riego en minutos (opcional)').fill('15');
  await page.getByRole('button', { name: 'Guardar riego' }).click();
  await page.getByRole('button', { name: 'Labores', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.locator('[data-prueba="formulario-labor"]').getByLabel('Poda').check();
  await page.locator('[data-prueba="formulario-labor"]').getByLabel(p.nombre).check();
  await page.getByLabel('Horas por persona').fill('8');
  await page.getByRole('button', { name: 'Guardar labor' }).click();
  await expect(page.getByText('Labor guardada en este teléfono.')).toBeVisible();

  await abrirHistorial(page);
  const delRiego = page.locator('[data-prueba="historial-riego"]');
  await delRiego.getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByLabel('Volumen aplicado')).toHaveValue('1200');
  await expect(page.getByLabel('Duración del riego en minutos (opcional)')).toHaveValue('15');
  await expect(
    page.locator('[data-prueba="formulario-riego"]').getByLabel('L por área'),
  ).toBeChecked();
  await page.getByLabel('Volumen aplicado').fill('1000');
  await page.getByRole('button', { name: 'Guardar corrección' }).click();
  await expect(delRiego).toContainText('Riego · 1000 L por área · 15 min');

  const deLabor = page.locator('[data-prueba="historial-labor"]');
  await deLabor.getByRole('button', { name: 'Corregir' }).click();
  await expect(page.getByLabel('Horas por persona')).toHaveValue('8');
  await expect(page.locator('[data-prueba="formulario-labor"]').getByLabel('Poda')).toBeChecked();
  await page.getByLabel('Horas por persona').fill('6');
  await page.getByRole('button', { name: 'Guardar corrección' }).click();
  // Corregir 8 h a 6 h no suma 14 h: no aparece el aviso de más de 12 h.
  await expect(deLabor).toContainText(`Labor · Poda · 6 h por persona · ${p.nombre}`);
  await expect(page.locator('[data-prueba="labor-aviso-horas"]')).toHaveCount(0);
  await expect(items(page)).toHaveCount(2);
});

test('CA1: filtra por área, tipo y fechas, y 90 días cargan en menos de 1 s con la CPU ×4; cumple WCAG 2.1 AA', async ({
  page,
}) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  await configurar(page, f);
  // 90 días × 15 registros, sembrados directo en IndexedDB para no tardar minutos en la UI.
  const sembrados = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, mal) => {
      const r = indexedDB.open('gestionagro-cuaderno');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    const leer = <T>(tabla: string) =>
      new Promise<T[]>((ok) => {
        const r = db.transaction(tabla).objectStore(tabla).getAll();
        r.onsuccess = () => ok(r.result as T[]);
      });
    const [finca] = await leer<{ id: string }>('finca');
    const areas = (await leer<{ id: string; padre_id: string | null }>('area')).filter(
      (a) => a.padre_id === null,
    );
    const tx = db.transaction('registro', 'readwrite');
    let n = 0;
    for (let d = 0; d < 90; d++) {
      const dia = new Date(Date.UTC(2026, 11, 10 - d)).toISOString().slice(0, 10);
      for (let k = 0; k < 15; k++) {
        const area = areas[k % areas.length];
        tx.objectStore('registro').add({
          id: crypto.randomUUID(),
          org_id: null,
          finca_id: finca?.id,
          area_ids: [area?.id],
          ciclo_id: null,
          tipo: 'clima',
          v: 1,
          fecha_agronomica: dia,
          instante_evento: `${dia}T${String(11 + (k % 10)).padStart(2, '0')}:00:00.000Z`,
          autor_usuario_id: null,
          persona_ids: [],
          dispositivo_id: 'telefono-ensayo',
          origen: 'manual',
          anula_id: null,
          datos: {
            temperaturaC: 20 + (k % 8),
            humedadRelativaPct: 70,
            temperaturaHojaC: null,
            dpvKPa: 0.7,
          },
        });
        n++;
      }
    }
    await new Promise((ok) => {
      tx.oncomplete = ok;
    });
    return n;
  });
  expect(sembrados).toBe(1350);

  await abrirHistorial(page);
  const cuenta = page.locator('[data-prueba="historial-cuenta"]');
  // Por defecto, los últimos 30 días.
  await expect(cuenta).toHaveText('450 registros');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Se mide dentro de la página, del cambio de fecha a la lista dibujada: sin el sondeo de
  // Playwright, que bajo carga suma cientos de ms que el teléfono no tiene.
  const medida = page.evaluate(
    () =>
      new Promise<number>((ok) => {
        let inicio = 0;
        document.getElementById('historial-desde')?.addEventListener(
          'input',
          () => {
            inicio = performance.now();
          },
          { once: true },
        );
        const listo = () =>
          document.querySelector('[data-prueba="historial-cuenta"]')?.textContent ===
            '1350 registros' &&
          document.querySelectorAll('[data-prueba="historial"] > li').length === 50;
        new MutationObserver((_, obs) => {
          if (inicio && listo()) {
            obs.disconnect();
            requestAnimationFrame(() => ok(performance.now() - inicio));
          }
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      }),
  );
  await page.getByLabel('Desde').fill('2026-09-12');
  await expect(cuenta).toHaveText('1350 registros');
  await expect(items(page)).toHaveCount(50);
  const ms = Math.round(await medida);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  expect(ms, `90 días tardaron ${ms} ms`).toBeLessThan(1000);
  await expect(page.getByRole('button', { name: 'Ver más (1300 restantes)' })).toBeVisible();

  const area = f.areas[0]?.nombre ?? '';
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  const porArea = Math.ceil(15 / f.areas.length) * 90;
  await expect(cuenta).toHaveText(`${porArea} registros`);
  await page.getByLabel('Tipo').selectOption({ label: 'Riego' });
  await expect(page.locator('[data-prueba="historial-vacio"]')).toHaveText(
    'No hay registros con estos filtros.',
  );
  await page.getByLabel('Tipo').selectOption({ label: 'Clima' });
  await page.getByLabel('Desde').fill('2026-12-10');
  await page.getByLabel('Hasta').fill('2026-12-01');
  await expect(page.locator('#historial-fechas-error')).toHaveText('«Desde» va antes de «Hasta».');
  await page.getByLabel('Hasta').fill('2026-12-10');
  await expect(cuenta).toHaveText(`${Math.ceil(15 / f.areas.length)} registros`);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
