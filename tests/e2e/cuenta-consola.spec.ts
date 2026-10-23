/**
 * HU-C13.5: la consola del dueño como boletín del día, con el CORE simulado en el mismo origen, como
 * en `cuenta.spec.ts`. Quién la ve y qué dice cada bloque se prueba en `apps/core/src/consola.test.ts`;
 * aquí, la página: la entrada con la app `consola`, una fila por producto en su lugar de siempre, el
 * desempeño por la regla escrita, el renglón guía, que nada cambie nada, los 360 px y la accesibilidad.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const CUENTA = 'http://localhost:4330';
const ahora = new Date().toISOString();

const vacio = { total_cop: 0, detalle: [] };
const BLOQUES = {
  hoy: {
    estado: 'ok',
    entro: {
      hoy: {
        total_cop: 24_900,
        detalle: [{ producto: 'TiendaPro', medio: 'Bold', pagos: 1, cop: 24_900 }],
      },
      semana: {
        total_cop: 166_900,
        detalle: [{ producto: 'TiendaPro', medio: 'Bold', pagos: 2, cop: 166_900 }],
      },
      mes: {
        total_cop: 216_900,
        detalle: [{ producto: 'TiendaPro', medio: 'Bold', pagos: 3, cop: 216_900 }],
      },
    },
    vencen: [
      {
        espacio: 'Panadería Ensayo',
        producto: 'TiendaPro',
        plan: 'Pro',
        vence: ahora,
        aviso: 'vence-en-7-dias',
      },
    ],
    para_revisar: [],
  },
  crecio: {
    estado: 'ok',
    cuentas_nuevas: [{ semana: '2026-10-19', n: 3 }],
    espacios_nuevos: [{ producto: 'Parqueadero', semanas: [{ n: 0 }, { n: 1 }] }],
    por_plan: [{ producto: 'TiendaPro', plan: 'Gratis', gratuito: true, espacios: 5 }],
    pagaron_por_primera_vez: [],
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
};

type Respuesta = { status: number; json: unknown };

/** El dueño con su sesión de la consola guardada, y el CORE que renueva y responde los bloques. */
async function conSesion(page: Page, bloques: Partial<Record<string, Respuesta>> = {}) {
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

const fila = (page: Page, producto: string) => page.locator(`li[data-producto="${producto}"]`);

test('sin sesión: entra con la app consola y vuelve a /consola/, como cualquier persona', async ({
  page,
}) => {
  await page.goto(`${CUENTA}/consola/`);
  const formulario = page.locator('form.portada__formulario');
  await expect(formulario.locator('input[name="producto"]')).toHaveValue('consola');
  await expect(formulario.locator('input[name="vuelta"]')).toHaveValue(`${CUENTA}/consola/`);
  await expect(page.locator('form[data-entrar-correo]')).toBeVisible();
  await expect(page.locator('li[data-producto]').first()).toBeHidden();
});

test('el boletín: una fila por producto en su lugar, el desempeño por la regla escrita y el renglón guía', async ({
  page,
}) => {
  const pedidos = await conSesion(page);
  await page.goto(`${CUENTA}/consola/`);
  // El lugar de cada producto es el del registro y nunca cambia.
  expect(
    await page
      .locator('li[data-producto]')
      .evaluateAll((xs) => xs.map((x) => x.getAttribute('data-producto'))),
  ).toEqual(['CultivoPro', 'Parqueadero', 'TiendaPro']);
  // TiendaPro: entró plata, pero un plan vence: Básico, con su observación.
  await expect(fila(page, 'TiendaPro').locator('[data-sello]')).toHaveText('Básico');
  await expect(fila(page, 'TiendaPro').locator('[data-hoy]')).toHaveText('COP 24.900');
  await expect(fila(page, 'TiendaPro').locator('[data-observacion]')).toHaveText(
    '1 plan vence esta semana.',
  );
  // Parqueadero: un espacio nuevo esta semana y nada pendiente: Superior.
  await expect(fila(page, 'Parqueadero').locator('[data-sello]')).toHaveText('Superior');
  // CultivoPro: al día, sin novedades: Alto.
  await expect(fila(page, 'CultivoPro').locator('[data-sello]')).toHaveText('Alto');
  await expect(fila(page, 'CultivoPro')).toHaveAttribute('data-desempeno', 'alto');
  // El renglón guía cuenta lo que pide atención: TiendaPro, la solicitud urgente y la copia.
  await expect(page.locator('[data-guia]')).toHaveText(
    '3 productos · 1 pide atención · 2 observaciones',
  );
  await expect(page.locator('[data-general="copia"]')).toHaveAttribute('data-estado', 'atencion');
  await expect(page.locator('[data-general="correos"]')).toHaveAttribute('data-estado', 'bien');
  // El detalle de una fila se abre sin salir de la página.
  await fila(page, 'TiendaPro').locator('summary').click();
  await expect(
    fila(page, 'TiendaPro').getByText(/Panadería Ensayo · Pro · vence el/),
  ).toBeVisible();
  // Una sola renovación para los cuatro bloques, y cada uno con el acceso de la consola.
  expect(pedidos.filter((p) => p === 'refrescar')).toHaveLength(1);
  expect(pedidos.filter((p) => p.endsWith('Bearer acceso-consola'))).toHaveLength(4);
  // CA3 ❌: con la sesión abierta no hay un solo formulario: nada de aquí cambia algo.
  expect(
    await page.locator('[data-con-sesion] form, [data-con-sesion]:not([hidden]) form').count(),
  ).toBe(0);
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
  expect(
    violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''}`).join(' | ')}`,
    ),
  ).toEqual([]);
});

test('un pago en revisión pone el producto en Bajo, aunque haya entrado plata', async ({
  page,
}) => {
  await conSesion(page, {
    hoy: {
      status: 200,
      json: {
        ...BLOQUES.hoy,
        entro: { hoy: vacio, semana: vacio, mes: vacio },
        vencen: [],
        para_revisar: [
          { producto: 'CultivoPro', medio: 'Bold', cop: 39_000, estado: 'revisar', desde: ahora },
        ],
      },
    },
  });
  await page.goto(`${CUENTA}/consola/`);
  await expect(fila(page, 'CultivoPro').locator('[data-sello]')).toHaveText('Bajo');
  await expect(fila(page, 'CultivoPro').locator('[data-observacion]')).toHaveText(
    '1 pago en revisión: míralo en Bold.',
  );
});

test('a una cuenta que no es la del dueño no le muestra nada', async ({ page }) => {
  const prohibido = {
    status: 403,
    json: { estado: 'prohibido', motivo: 'Esta página no es para tu cuenta.' },
  };
  await conSesion(page, { hoy: prohibido, crecio: prohibido, revisar: prohibido, roto: prohibido });
  await page.goto(`${CUENTA}/consola/`);
  await expect(page.getByText('Esta página no es para tu cuenta.')).toBeVisible();
  await expect(page.locator('li[data-producto]').first()).toBeHidden();
});

test('si no se pudo leer cómo va cada producto, lo dice con la causa y se puede reintentar', async ({
  page,
}) => {
  let fallar = true;
  await conSesion(page);
  await page.route(`${CUENTA}/api/core/consola/hoy`, async (r) => {
    await r.fulfill(
      fallar
        ? {
            status: 503,
            json: { estado: 'no-se-pudo', motivo: 'No se pudo leer este bloque (Error).' },
          }
        : { json: BLOQUES.hoy },
    );
  });
  await page.goto(`${CUENTA}/consola/`);
  await expect(page.locator('[data-error-materias]')).toContainText(
    'No se pudo leer este bloque (Error).',
  );
  // Las observaciones generales siguen.
  await expect(page.locator('[data-general="copia"]')).toHaveAttribute('data-estado', 'atencion');
  fallar = false;
  await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
  await expect(fila(page, 'TiendaPro').locator('[data-sello]')).toHaveText('Básico');
});
