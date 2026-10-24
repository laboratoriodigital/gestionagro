/**
 * HU-E4.7 · Varias fincas en un mismo teléfono, a 360 px. Cada finca guarda lo suyo: lo que se
 * registra en una no aparece en la otra (control negativo), y cambiar es un toque desde la cabecera.
 * La nube se reemplaza interceptando la red, como en `cuaderno-cuenta.spec.ts`.
 */
import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { FINCA_ENSAYO_DOS, FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { APP, configurar, irASeccion } from './ayudas.ts';

const { core, celdas } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
  celdas: { api_staging: string }[];
};
const CORE = core.url_staging;
const API = celdas[0]?.api_staging ?? '';
const permitir = { 'access-control-allow-origin': '*' };

const menu = (page: Page, nombre: string) => irASeccion(page, nombre);

async function unClima(page: Page, temperatura: string) {
  await menu(page, 'Registrar');
  await page
    .getByLabel('Área', { exact: true })
    .selectOption({ label: FINCA_ENSAYO_UNO.areas[0]?.nombre ?? '' });
  await page.getByLabel('Temperatura del aire (°C)').fill(temperatura);
  await page.getByLabel('Humedad relativa (%)').fill('70');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    '1 registro solo en este teléfono',
  );
}

test('sin cuenta: agregar otra finca, registrar en cada una y cambiar sin mezclar', async ({
  page,
}) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await unClima(page, '24');
  // Con una sola finca, la cabecera no cambia.
  await expect(page.locator('[data-prueba="finca-activa"]')).toHaveCount(0);

  await page.goto(`${APP}cuenta/`);
  await page.getByRole('button', { name: 'Agregar otra finca en este teléfono' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu finca');
  await configurar(page, FINCA_ENSAYO_DOS, FINCA_ENSAYO_UNO.areas);
  await expect(page.locator('[data-prueba="finca-activa"]')).toHaveText(
    `Finca: ${FINCA_ENSAYO_DOS.finca.nombre} · cambiar`,
  );
  // Control negativo: el clima de la otra finca no está aquí.
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    'Sin registros pendientes',
  );
  await unClima(page, '31');

  await page.locator('[data-prueba="finca-activa"]').click();
  const lista = page.locator('[data-prueba="fincas-del-telefono"]');
  await expect(lista).toContainText(
    `${FINCA_ENSAYO_DOS.finca.nombre} · solo en este teléfono · abierta`,
  );
  await lista.getByRole('button', { name: 'Cambiar a esta finca' }).click();
  await expect(page.locator('[data-prueba="finca-activa"]')).toHaveText(
    `Finca: ${FINCA_ENSAYO_UNO.finca.nombre} · cambiar`,
  );
  await menu(page, 'Historial');
  await expect(page.getByText('24 °C').first()).toBeVisible();
  await expect(page.getByText('31 °C')).toHaveCount(0);
});

test('con cuenta: abrir en este teléfono otra finca de la nube la baja sola, aparte', async ({
  page,
}) => {
  const ORG = '0199a1b2-0000-7000-8000-0000000000aa';
  const FINCA = '0199a1b2-0000-7000-8000-0000000000bb';
  const actualizado = '2026-10-01T12:00:00.000Z';
  const sesion = {
    acceso: 'acceso-e2e',
    acceso_vence: Date.now() + 12 * 60 * 60 * 1000,
    refresh: 'refresh-e2e',
    refresh_vence: Date.now() + 60 * 24 * 60 * 60 * 1000,
    usuario: { nombre: 'Persona Ensayo', email: 'ensayo@example.com' },
    organizaciones: [{ org_id: ORG, nombre: 'Finca Ensayo Dos', rol: 'propietario' }],
    org_id: null,
    aviso: null,
  };
  await page.route(`${CORE}/api/core/auth/google/inicio?*`, async (ruta) => {
    const vuelta = new URL(ruta.request().url()).searchParams.get('vuelta');
    await ruta.fulfill({ status: 302, headers: { location: `${vuelta}#entrar=codigo-e2e` } });
  });
  await page.route(`${CORE}/api/core/auth/canje`, (r) =>
    r.fulfill({ json: sesion, headers: permitir }),
  );
  for (const [ruta, json] of [
    ['telefonos/ver', { telefonos: [] }],
    ['equipo/ver', { miembros: [] }],
  ] as const) {
    await page.route(`${CORE}/api/core/${ruta}`, (r) => r.fulfill({ json, headers: permitir }));
  }
  const renovaciones: (string | null)[] = [];
  await page.route(`${CORE}/api/core/auth/refrescar`, async (ruta) => {
    const pedida = (ruta.request().postDataJSON() as { org_id: string | null }).org_id;
    renovaciones.push(pedida);
    await ruta.fulfill({
      json: { ...sesion, refresh: null, org_id: pedida, url_api: API },
      headers: permitir,
    });
  });
  await page.route(`${API}/api/v1/sync/pull?*`, (ruta) =>
    ruta.fulfill({
      headers: permitir,
      json: {
        catalogos: [
          {
            entidad: 'finca',
            datos: {
              id: FINCA,
              org_id: ORG,
              version: 1,
              actualizado,
              nombre: 'Finca Ensayo Dos',
              municipio: 'Municipio Ensayo',
              regimen: 'convencional',
            },
          },
        ],
        registros: [],
        cursor: { registro: 0, catalogo: 1 },
        mas: false,
      },
    }),
  );

  // El teléfono ya lleva otra finca, solo local, con un registro.
  await configurar(page, FINCA_ENSAYO_UNO);
  await unClima(page, '24');
  await page.goto(`${APP}cuenta/`);
  await page.getByLabel(/Leí y acepto la política de tratamiento de datos/).check();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  const nube = page.locator('[data-prueba="cuenta-fincas"]');
  await nube.getByRole('button', { name: 'Abrir en este teléfono' }).click();

  // Se recarga en una finca nueva que baja sola, con la misma sesión.
  await expect(page.locator('[data-prueba="nube-sync"]')).toContainText(
    'Se bajó 1 cambio del equipo.',
  );
  expect(renovaciones).toContain(ORG);
  await expect(nube).toContainText('Finca Ensayo Dos');
  await expect(nube).toContainText('abierta en este teléfono');
  await expect(page.locator('[data-prueba="finca-activa"]')).toHaveText(
    'Finca: Finca Ensayo Dos · cambiar',
  );
  // Control negativo: el registro de la finca local no subió a la de la nube.
  await expect(page.locator('[data-prueba="indicador-datos"]')).toHaveText(
    'Sin registros pendientes',
  );
  await expect(page.locator('[data-prueba="fincas-del-telefono"]')).toContainText(
    `${FINCA_ENSAYO_UNO.finca.nombre} · solo en este teléfono`,
  );
});
