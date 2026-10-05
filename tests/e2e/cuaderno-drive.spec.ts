/**
 * Copia en el Google Drive del productor (HU-E8.4, etapa 1) en un teléfono de 360 px. El CORE y
 * Google Drive se reemplazan interceptando la red: esta prueba no ve Google de verdad (P17). El
 * permiso real se prueba en staging (P16).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from '../fixtures/fincas.ts';
import { APP, configurar } from './ayudas.ts';

const { core } = JSON.parse(readFileSync('infrastructure/celdas.json', 'utf8')) as {
  core: { url_staging: string };
};
const CORE = core.url_staging;
const TOKEN = 'token-drive-e2e';
const T0 = new Date('2026-10-05T15:30:00Z');

interface Archivo {
  id: string;
  name: string;
  parents: string[];
  contenido: string;
  createdTime: string;
}

/** Un Google Drive en memoria, compartido por los «teléfonos» de una prueba. */
function crearDrive() {
  const archivos: Archivo[] = [];
  let n = 0;
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, DELETE',
  };
  async function atender(page: Page) {
    await page.route('https://www.googleapis.com/**', async (ruta) => {
      const pedido = ruta.request();
      if (pedido.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
      if (pedido.headers()['authorization'] !== `Bearer ${TOKEN}`) {
        return ruta.fulfill({ status: 401, headers: cors, json: {} });
      }
      const u = new URL(pedido.url());
      if (u.pathname === '/upload/drive/v3/files') {
        const limite = (pedido.headers()['content-type'] ?? '').split('boundary=')[1] ?? '';
        const partes = (pedido.postData() ?? '').split(`--${limite}`);
        const cuerpo = (p: string) =>
          p.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/\r\n$/, '');
        const meta = JSON.parse(cuerpo(partes[1] ?? '')) as { name: string; parents: string[] };
        const id = `a${++n}`;
        archivos.push({
          id,
          name: meta.name,
          parents: meta.parents,
          contenido: cuerpo(partes[2] ?? ''),
          createdTime: new Date(T0.getTime() + n * 1000).toISOString(),
        });
        return ruta.fulfill({ headers: cors, json: { id } });
      }
      if (u.pathname === '/drive/v3/files' && pedido.method() === 'POST') {
        const meta = pedido.postDataJSON() as { name: string };
        const id = `c${++n}`;
        archivos.push({
          id,
          name: meta.name,
          parents: [],
          contenido: '',
          createdTime: T0.toISOString(),
        });
        return ruta.fulfill({ headers: cors, json: { id } });
      }
      if (u.pathname === '/drive/v3/files') {
        const q = u.searchParams.get('q') ?? '';
        const padre = q.match(/^'([^']+)' in parents/)?.[1];
        const nombre = q.match(/name = '([^']+)'/)?.[1];
        const lista = archivos
          .filter((a) => (padre ? a.parents.includes(padre) : a.name === nombre))
          .sort((x, y) => y.createdTime.localeCompare(x.createdTime))
          .map((a) => ({
            id: a.id,
            name: a.name,
            size: String(a.contenido.length),
            createdTime: a.createdTime,
          }));
        return ruta.fulfill({ headers: cors, json: { files: lista } });
      }
      const id = u.pathname.split('/').at(-1);
      const archivo = archivos.find((a) => a.id === id);
      if (!archivo) return ruta.fulfill({ status: 404, headers: cors, json: {} });
      if (pedido.method() === 'DELETE') {
        archivos.splice(archivos.indexOf(archivo), 1);
        return ruta.fulfill({ status: 204, headers: cors });
      }
      return ruta.fulfill({ headers: cors, body: archivo.contenido });
    });
  }
  return { archivos, atender };
}

/** CORE falso: el inicio «vuelve de Google» con un sello o un error; el canje entrega el token. */
async function coreFalso(page: Page, vuelta: 'sello' | 'cancelada' = 'sello') {
  const pedidos: { desafio: string; verificador?: string } = { desafio: '' };
  await page.route(`${CORE}/api/core/drive/inicio?*`, async (ruta) => {
    const u = new URL(ruta.request().url());
    pedidos.desafio = u.searchParams.get('desafio') ?? '';
    const destino = u.searchParams.get('vuelta');
    const fragmento = vuelta === 'sello' ? 'drive=sello-e2e' : 'drive-error=cancelada';
    await ruta.fulfill({ status: 302, headers: { location: `${destino}#${fragmento}` } });
  });
  await page.route(`${CORE}/api/core/drive/canje`, async (ruta) => {
    pedidos.verificador = (ruta.request().postDataJSON() as { verificador: string }).verificador;
    await ruta.fulfill({
      json: { acceso: TOKEN, vence: Date.now() + 3600_000 },
      headers: { 'access-control-allow-origin': new URL(page.url()).origin },
    });
  });
  return pedidos;
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

async function registrarClima(page: Page, area: string) {
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area });
  await page.getByLabel('Temperatura del aire (°C)').fill('24,5');
  await page.getByLabel('Humedad relativa (%)').fill('70');
  await page.getByRole('button', { name: 'Guardar clima' }).click();
  await expect(page.getByText('Guardado en este teléfono.')).toBeVisible();
}

const seccion = (page: Page) => page.locator('[data-prueba="copia-en-drive"]');

for (const f of FINCAS_DE_PRUEBA) {
  test.describe(f.finca.nombre, () => {
    test('guardar la copia en su Drive y traerla en otro teléfono vacío', async ({
      page,
      browser,
    }) => {
      await page.clock.setFixedTime(T0);
      const drive = crearDrive();
      await drive.atender(page);
      const pedidos = await coreFalso(page);
      await configurar(page, f);
      await registrarClima(page, f.areas[0]?.nombre ?? '');
      await nav(page).getByRole('link', { name: 'Respaldo' }).click();
      await expect(seccion(page).locator('[data-prueba="ultima-copia-drive"]')).toHaveText(
        'Todavía no has guardado una copia en tu Drive.',
      );

      await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
      await expect(seccion(page).locator('[data-prueba="drive-hecho"]')).toContainText(
        'Copia guardada en tu Google Drive, en la carpeta «CultivoPro · respaldos», como cuaderno-finca-ensayo-',
      );
      // El sello no se queda en la barra de direcciones.
      expect(new URL(page.url()).hash).toBe('');
      // Al CORE solo salió el SHA-256 del verificador; el verificador, recién en el canje.
      expect(
        createHash('sha256')
          .update(pedidos.verificador ?? '')
          .digest('base64url'),
      ).toBe(pedidos.desafio);
      const copias = drive.archivos.filter((a) => a.parents.length > 0);
      expect(copias).toHaveLength(1);
      expect(JSON.parse(copias[0]?.contenido ?? '{}')).toMatchObject({
        formato: 'agro-export',
        version: 1,
      });
      await expect(seccion(page).locator('[data-prueba="ultima-copia-drive"]')).toHaveText(
        /^Última copia en tu Drive: /,
      );

      // Otro teléfono, vacío: trae la copia de su Drive y la une.
      const otro: BrowserContext = await browser.newContext({
        viewport: { width: 360, height: 780 },
      });
      const telefono = await otro.newPage();
      await drive.atender(telefono);
      await coreFalso(telefono);
      await telefono.goto(`${new URL(page.url()).origin}${APP}respaldo/`);
      await expect(
        seccion(telefono).getByRole('button', { name: 'Guardar copia en mi Google Drive' }),
      ).toHaveCount(0);
      await seccion(telefono)
        .getByRole('button', { name: 'Traer una copia de mi Google Drive' })
        .click();
      const lista = seccion(telefono).locator('[data-prueba="drive-copias"] li');
      await expect(lista).toHaveCount(1);
      await lista.getByRole('button', { name: 'Traer esta copia' }).click();
      const resumen = telefono.locator('[data-prueba="respaldo-resumen"]');
      await expect(resumen.getByRole('row', { name: /^Registros/ })).toHaveText(
        /Registros\s*1\s*0/,
      );
      await telefono.getByRole('button', { name: /^Importar \d+ datos nuevos$/ }).click();
      await expect(telefono.getByText(/^Importado: 1 registro/)).toBeVisible();
      await otro.close();
    });
  });
}

test('si la persona cancela en Google, lo dice y no guarda nada', async ({ page }) => {
  const f = FINCAS_DE_PRUEBA[0] as FincaDePrueba;
  const drive = crearDrive();
  await drive.atender(page);
  await coreFalso(page, 'cancelada');
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Respaldo' }).click();
  await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
  await expect(seccion(page).locator('[data-prueba="drive-error"]')).toHaveText(
    'Cancelaste el permiso en Google. No se guardó ni se trajo nada.',
  );
  expect(drive.archivos).toHaveLength(0);
});

test('sin señal no ofrece hablar con Google; a los 7 días sin copia lo recuerda; WCAG 2.1 AA', async ({
  page,
  context,
}) => {
  const f = FINCAS_DE_PRUEBA[1] as FincaDePrueba;
  await page.clock.setFixedTime(T0);
  const drive = crearDrive();
  await drive.atender(page);
  await coreFalso(page);
  await configurar(page, f);
  await nav(page).getByRole('link', { name: 'Respaldo' }).click();
  await seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }).click();
  await expect(seccion(page).locator('[data-prueba="drive-hecho"]')).toBeVisible();

  await page.clock.setFixedTime(new Date(T0.getTime() + 8 * 24 * 3600_000));
  await page.reload();
  await expect(seccion(page).locator('[data-prueba="ultima-copia-drive"]')).toHaveText(
    /^Hace 8 días de tu última copia en Drive \(.+\)\. Guarda una nueva\.$/,
  );

  await context.setOffline(true);
  await expect(seccion(page).locator('[data-prueba="drive-sin-senal"]')).toBeVisible();
  await expect(
    seccion(page).getByRole('button', { name: 'Guardar copia en mi Google Drive' }),
  ).toBeDisabled();
  await expect(
    seccion(page).getByRole('button', { name: 'Traer una copia de mi Google Drive' }),
  ).toBeDisabled();
  await context.setOffline(false);

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
