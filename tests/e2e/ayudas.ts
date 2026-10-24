/**
 * Ayudas compartidas por las e2e del cuaderno (una sola copia, P2).
 */
import { expect, type Page } from '@playwright/test';
import type { FincaDePrueba } from '../fixtures/fincas.ts';

export const APP = '/agro/app/';
export const TIPO = { nave: 'Nave', bloque: 'Bloque', lote: 'Lote' } as const;
export const REGIMEN = { ecologico: 'Ecológico/orgánico', convencional: 'Convencional' } as const;

type AreaDePrueba = Pick<FincaDePrueba['areas'][number], 'tipo' | 'nombre' | 'area_m2'>;

/** Llena las filas del paso «Tus áreas»: cada área con su propio tipo. */
export async function llenarAreas(page: Page, areas: readonly AreaDePrueba[]) {
  for (const [i, a] of areas.entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Agregar otra área' }).click();
    const fila = page.getByRole('group', { name: `Área ${i + 1}`, exact: true });
    await fila.getByLabel('Tipo').selectOption({ label: TIPO[a.tipo as keyof typeof TIPO] });
    await fila.getByLabel('Nombre').fill(a.nombre);
    await fila.getByLabel('Tamaño (m²)').fill(String(a.area_m2));
  }
}

/** La barra de abajo del cuaderno (HU-E0.11): Inicio, Carencias, Anotar, Historial y Más. */
export const barra = (page: Page) =>
  page.getByRole('navigation', { name: 'Secciones del cuaderno' });

/**
 * Va a una sección del cuaderno como lo haría la persona: por la barra de abajo si está ahí, o por
 * «Más», donde están todas (HU-E0.11). «Áreas» es la misma pantalla que «Inicio».
 */
export async function irASeccion(page: Page, seccion: string) {
  const enLaBarra = barra(page).getByRole('link', {
    name: seccion === 'Áreas' ? 'Inicio' : seccion,
    exact: true,
  });
  if ((await enLaBarra.count()) > 0) {
    await enLaBarra.click();
    return;
  }
  await barra(page).getByRole('link', { name: 'Más', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Todas las secciones' })
    .getByRole('link', { name: seccion, exact: true })
    .click();
}

/**
 * Abre el cuaderno y, si sale la bienvenida de un teléfono nuevo (HU-E0.10), elige «empezar sin
 * cuenta»: queda el asistente de la finca, como antes de la bienvenida.
 */
export async function abrirSinCuenta(page: Page) {
  await page.goto(APP);
  const empezar = page.getByRole('button', { name: 'Empezar en este teléfono, sin cuenta' });
  const asistente = page.getByRole('heading', { level: 1, name: 'Tu finca', exact: true });
  await expect(empezar.or(asistente)).toBeVisible();
  if (await empezar.isVisible()) await empezar.click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
}

export async function configurar(
  page: Page,
  f: FincaDePrueba,
  areas: readonly AreaDePrueba[] = f.areas,
) {
  await abrirSinCuenta(page);
  await page.getByLabel('Nombre de la finca').fill(f.finca.nombre);
  await page.getByLabel('Municipio').fill(f.finca.municipio);
  await page.getByLabel(REGIMEN[f.finca.regimen]).check();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tus áreas');
  await llenarAreas(page, areas);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revisa y guarda');
  await expect(page.locator('[data-prueba="resumen-areas"] li')).toHaveCount(areas.length);
  await page.getByRole('button', { name: 'Guardar mi finca' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.finca.nombre);
}

export const ROL = {
  operario: 'Operario',
  supervisor: 'Supervisor',
  propietario: 'Propietario',
} as const;
export const TIPO_INSUMO = {
  bioinsumo: 'Bioinsumo',
  fertilizante: 'Fertilizante',
  fitosanitario: 'Fitosanitario (plaguicida)',
  sustrato: 'Sustrato',
  otro: 'Otro',
} as const;

export async function agregarInsumo(page: Page, i: FincaDePrueba['insumos'][number]) {
  await page.getByRole('button', { name: 'Agregar insumo' }).click();
  await page.getByLabel('Nombre comercial').fill(i.nombre_comercial);
  await page.getByLabel(TIPO_INSUMO[i.tipo]).check();
  if (i.registro_ica) await page.getByLabel('Registro ICA (opcional)').fill(i.registro_ica);
  if (i.ingrediente_activo)
    await page.getByLabel('Ingrediente activo (opcional)').fill(i.ingrediente_activo);
  await page.getByLabel('Unidad').selectOption(i.unidad);
  if (i.carencia_dias !== null)
    await page.getByLabel('Periodo de carencia (días)').fill(String(i.carencia_dias));
  if (i.reentrada_horas !== null)
    await page.getByLabel('Periodo de reentrada (horas)').fill(String(i.reentrada_horas));
  const eco =
    i.permitido_ecologico === true ? /^Sí/ : i.permitido_ecologico === false ? 'No' : 'No sé';
  await page.getByRole('radio', { name: eco, exact: typeof eco === 'string' }).check();
  await page.getByRole('button', { name: 'Guardar insumo' }).click();
  await expect(
    page.locator('[data-prueba="insumo"]').filter({ hasText: i.nombre_comercial }),
  ).toHaveCount(1);
}

/**
 * Vigila el DOM desde ya y recuerda si `texto` apareció aunque sea un instante. Esperar a que
 * desaparezca lo escondería: un «no hay» mientras carga es justo lo que se quiere atrapar.
 */
export async function vigilarTexto(page: Page, texto: string): Promise<() => Promise<boolean>> {
  type Vistos = { __vistos?: Record<string, boolean> };
  await page.evaluate((t) => {
    const w = window as unknown as Vistos;
    w.__vistos ??= {};
    const vistos = w.__vistos;
    vistos[t] = document.body.innerText.includes(t);
    new MutationObserver(() => {
      if (document.body.innerText.includes(t)) vistos[t] = true;
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  }, texto);
  return () => page.evaluate((t) => Boolean((window as unknown as Vistos).__vistos?.[t]), texto);
}

/** Una sesión con la finca en ese plan y con ese rol, como la daría el CORE. */
export async function conPlan(page: Page, plan: string, rol = 'propietario') {
  await page.evaluate(
    ([elPlan, elRol]) =>
      new Promise<void>((resolver) => {
        const pedido = indexedDB.open('gestionagro-cuaderno');
        pedido.onsuccess = () => {
          const tx = pedido.result.transaction('meta', 'readwrite');
          const org = '0199a1b2-0000-7000-8000-0000000000fa';
          tx.objectStore('meta').put({
            clave: 'sesion',
            valor: {
              acceso: 'acceso',
              acceso_vence: Date.now() + 3_600_000,
              refresh: 'refresh',
              refresh_vence: Date.now() + 86_400_000,
              usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
              organizaciones: [{ org_id: org, nombre: 'Finca Ensayo', rol: elRol, plan: elPlan }],
              org_id: org,
            },
            actualizado: '',
          });
          tx.oncomplete = () => resolver();
        };
      }),
    [plan, rol] as const,
  );
}
