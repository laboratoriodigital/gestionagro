/**
 * HU-C13.5: la consola del dueño en el navegador, con el CORE simulado en el mismo origen, como en
 * `cuenta.spec.ts`. Quién la ve y qué dice cada bloque se prueba en `apps/core/src/consola.test.ts`;
 * aquí, la página: la entrada con la app `consola`, los cuatro bloques, que nada cambie nada, los
 * 360 px y la accesibilidad.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';

const BLOQUES = {
  hoy: {
    estado: 'ok',
    entro: {
      hoy: { total_cop: 24_900, detalle: [] },
      semana: { total_cop: 166_900, detalle: [] },
      mes: {
        total_cop: 216_900,
        detalle: [{ producto: 'TiendaPro', medio: 'Bold', pagos: 2, cop: 166_900 }],
      },
    },
    vencen: [
      {
        espacio: 'Panadería Ensayo',
        producto: 'TiendaPro',
        plan: 'Pro',
        vence: '2026-10-26T15:00:00.000Z',
        aviso: 'vence-en-7-dias',
      },
    ],
    para_revisar: [],
  },
  crecio: {
    estado: 'ok',
    cuentas_nuevas: [{ semana: '2026-10-19', n: 3 }],
    espacios_nuevos: [{ producto: 'TiendaPro', semanas: [{ n: 2 }] }],
    por_plan: [{ producto: 'TiendaPro', plan: 'Gratis', gratuito: true, espacios: 5 }],
    pagaron_por_primera_vez: [{ producto: 'TiendaPro', espacios: 1 }],
    interes: [],
  },
  revisar: {
    estado: 'ok',
    radicados: [
      {
        numero: 'LD-20261023-A1B2C3',
        tipo: 'consulta',
        vence: '2026-10-27',
        dias_habiles: 2,
        urgente: true,
      },
    ],
  },
  roto: {
    estado: 'ok',
    copia: {
      semana: '2026-10-19',
      bases: [
        { base: 'agro_core', estado: 'hecha', intentos: 1, motivo: null },
        { base: 'tienda_c1_s1', estado: 'fallida', intentos: 3, motivo: 'Drive respondió 403' },
      ],
    },
    correos: { cupo: 100, usados: 4, por_estado: [] },
  },
} as const;

/** El dueño con su sesión de la consola guardada, y el CORE que renueva y responde los bloques. */
async function conSesion(
  page: Page,
  bloques: Partial<Record<string, { status: number; json: unknown }>> = {},
) {
  await page.addInitScript(() =>
    localStorage.setItem('ed1-consola', JSON.stringify({ refresh: 'r' })),
  );
  const pedidos: string[] = [];
  await page.route(`${CUENTA}/api/core/auth/refrescar`, async (r) => {
    pedidos.push('refrescar');
    await r.fulfill({ json: { acceso: 'acceso-consola', refresh: null } });
  });
  for (const [bloque, json] of Object.entries(BLOQUES)) {
    await page.route(`${CUENTA}/api/core/consola/${bloque}`, async (r) => {
      pedidos.push(`${bloque} ${r.request().headers()['authorization'] ?? ''}`);
      await r.fulfill(bloques[bloque] ?? { json });
    });
  }
  return pedidos;
}

test('sin sesión: entra con la app consola y vuelve a /consola/, como cualquier persona', async ({
  page,
}) => {
  await page.goto(`${CUENTA}/consola/`);
  const formulario = page.locator('form.portada__formulario');
  await expect(formulario.locator('input[name="producto"]')).toHaveValue('consola');
  await expect(formulario.locator('input[name="vuelta"]')).toHaveValue(`${CUENTA}/consola/`);
  await expect(page.locator('form[data-entrar-correo]')).toBeVisible();
  await expect(page.locator('[data-bloque]').first()).toBeHidden();
});

test('con sesión: los cuatro bloques en el orden del Command Center, sin nada que cambie algo', async ({
  page,
}) => {
  const pedidos = await conSesion(page);
  await page.goto(`${CUENTA}/consola/`);
  const hoy = page.locator('[data-bloque="hoy"]');
  await expect(hoy.getByText('COP 216.900')).toBeVisible();
  await expect(hoy.getByText('Panadería Ensayo · TiendaPro')).toBeVisible();
  await expect(
    page.locator('[data-bloque="crecio"]').getByText('TiendaPro · Gratis'),
  ).toBeVisible();
  await expect(page.locator('[data-bloque="revisar"]').getByText('Urgente')).toBeVisible();
  await expect(
    page.locator('[data-bloque="roto"]').getByText('Falló 3 veces: Drive respondió 403'),
  ).toBeVisible();
  expect(await page.locator('h2.portada__subtitulo').allTextContents()).toEqual([
    'Hoy',
    'Lo que creció',
    'Para revisar',
    'Lo que se rompió',
  ]);
  // Una sola renovación para los cuatro, y cada bloque con el acceso de la consola.
  expect(pedidos.filter((p) => p === 'refrescar')).toHaveLength(1);
  expect(pedidos.filter((p) => p.endsWith('Bearer acceso-consola'))).toHaveLength(4);
  // CA3 ❌: con la sesión abierta no hay un solo formulario: nada de aquí cambia algo.
  expect(await page.locator('[data-con-sesion] form, [data-bloque] form').count()).toBe(0);
  // A 360 px nada se sale de la pantalla.
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter(
          (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5,
        )
        .map(
          (el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`,
        ),
    ),
  ).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('a una cuenta que no es la del dueño no le muestra nada', async ({ page }) => {
  const prohibido = {
    status: 403,
    json: { estado: 'prohibido', motivo: 'Esta página no es para tu cuenta.' },
  };
  await conSesion(page, { hoy: prohibido, crecio: prohibido, revisar: prohibido, roto: prohibido });
  await page.goto(`${CUENTA}/consola/`);
  await expect(page.getByText('Esta página no es para tu cuenta.')).toBeVisible();
  await expect(page.locator('[data-bloque]').first()).toBeHidden();
});

test('un bloque que no se pudo leer dice la causa y se puede reintentar; los demás siguen', async ({
  page,
}) => {
  let fallar = true;
  await conSesion(page);
  await page.route(`${CUENTA}/api/core/consola/roto`, async (r) => {
    await r.fulfill(
      fallar
        ? {
            status: 503,
            json: { estado: 'no-se-pudo', motivo: 'No se pudo leer este bloque (Error).' },
          }
        : { json: BLOQUES.roto },
    );
  });
  await page.goto(`${CUENTA}/consola/`);
  const roto = page.locator('[data-bloque="roto"]');
  await expect(roto.getByRole('alert')).toContainText('No se pudo leer este bloque (Error).');
  await expect(page.locator('[data-bloque="hoy"]').getByText('COP 216.900')).toBeVisible();
  fallar = false;
  await roto.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await expect(roto.getByText('agro_core')).toBeVisible();
});
