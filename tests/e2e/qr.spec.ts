/**
 * QR de trazabilidad (HU-E6.4) en un teléfono de 360 px: la etiqueta del lote en el cuaderno y la
 * página pública `/agro/t/`. Las claves de la página se ponen en la prueba igual que lo hace el
 * despliegue (reemplazando `[]` en `#claves-qr`); la firma, con WebCrypto como la celda.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  codificar,
  type DatosQr,
  fragmento,
  mensajeAFirmar,
} from '../../packages/trazabilidad/src/index.ts';
import { FINCA_ENSAYO_UNO } from '../fixtures/fincas.ts';
import { configurar, conPlan } from './ayudas.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Secciones del cuaderno' });

const DATOS: DatosQr = {
  v: 1,
  l: 'T-27MAR-2',
  f: 'Finca Ensayo Uno',
  m: 'Municipio Ensayo',
  r: 'ecologico',
  c: 'Cultivo Ensayo',
  va: 'Variedad Ensayo',
  a: ['Nave 1'],
  d: ['2027-03-20', '2027-03-27'],
};

async function firmado() {
  const par = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const x = ((await crypto.subtle.exportKey('jwk', par.publicKey)) as JsonWebKey).x ?? '';
  const codificado = codificar({ ...DATOS, k: 'kid-e2e' });
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, par.privateKey, mensajeAFirmar(codificado)),
  );
  return { frag: fragmento(codificado, firma), clave: { kid: 'kid-e2e', x } };
}

/** Como el despliegue: las claves de la celda dentro de la página. */
async function conClaves(page: Page, claves: object[]) {
  await page.route(/\/agro\/t\/$/, async (ruta) => {
    const respuesta = await ruta.fetch();
    const html = (await respuesta.text()).replace(
      'id="claves-qr">[]<',
      `id="claves-qr">${JSON.stringify(claves)}<`,
    );
    await ruta.fulfill({ response: respuesta, body: html });
  });
}

const estado = (page: Page) => page.locator('#qr-estado');

test.describe('página pública /agro/t/ (CA2)', () => {
  test('con la firma de la celda: verificado, con finca, cultivo, área y fechas', async ({
    page,
  }) => {
    const { frag, clave } = await firmado();
    await conClaves(page, [clave]);
    await page.goto(`/agro/t/#${frag}`);
    await expect(estado(page)).toHaveText(
      'Verificado por Gestión Agro: estos datos son los que la finca registró.',
    );
    const datos = page.locator('#qr-datos');
    await expect(datos).toContainText('T-27MAR-2');
    await expect(datos).toContainText('Finca Ensayo Uno, Municipio Ensayo');
    await expect(datos).toContainText('Ecológica');
    await expect(datos).toContainText('Cultivo Ensayo · Variedad Ensayo');
    await expect(datos).toContainText('del 20/03/2027 al 27/03/2027');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });

  test('control negativo: un carácter cambiado se dice en rojo, nunca como verificado', async ({
    page,
  }) => {
    const { frag, clave } = await firmado();
    await conClaves(page, [clave]);
    const i = 30;
    const alterado = frag.slice(0, i) + (frag[i] === 'A' ? 'B' : 'A') + frag.slice(i + 1);
    await page.goto(`/agro/t/#${alterado}`);
    await expect(estado(page)).toHaveAttribute('data-estado', /no-coincide|danado/);
    await expect(estado(page)).not.toContainText('Verificado');
  });

  test('un texto con HTML en los datos se muestra como texto, no se ejecuta', async ({ page }) => {
    const malo = codificar({ ...DATOS, f: '<img src=x onerror="window.atacado=1">' });
    await page.goto(`/agro/t/#${malo}`);
    await expect(page.locator('#qr-datos')).toContainText('<img src=x');
    expect(
      await page.evaluate(() => (window as unknown as { atacado?: number }).atacado),
    ).toBeUndefined();
  });
});

test('CA1 y CA4: sin señal, el lote da una etiqueta de 5 × 5 cm «sin confirmar» que se puede escanear', async ({
  page,
  context,
}) => {
  const area = FINCA_ENSAYO_UNO.areas[0];
  if (!area) throw new Error('sin áreas');
  await configurar(page, FINCA_ENSAYO_UNO);
  await context.setOffline(true);
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await page.getByLabel('Cantidad cosechada').fill('20');
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.locator('[data-prueba="elegir-cosechas"] input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  const codigo = (await page.locator('.codigo-lote').first().textContent()) ?? '';
  await page.getByRole('button', { name: `Etiqueta QR del lote ${codigo}` }).click();

  const etiqueta = page.locator('[data-prueba="etiqueta-qr"]');
  await expect(etiqueta.getByRole('img', { name: `Código QR del lote ${codigo}` })).toBeVisible();
  await expect(etiqueta.locator('.etiqueta-estado')).toHaveText('Sin confirmar');
  // Dice por qué no está confirmada y qué hacer (revisión del dueño, 3 oct 2026).
  await expect(etiqueta.locator('[data-prueba="estado-etiqueta"]')).toContainText(
    'No hay señal. Inténtalo cuando la haya.',
  );
  // «Intentar confirmar» responde: dice que lo intentó, a qué hora, y por qué sigue igual.
  await etiqueta.getByRole('button', { name: 'Intentar confirmar' }).click();
  await expect(etiqueta.locator('[data-prueba="estado-etiqueta"]')).toContainText(
    /Se intentó a las \d{2}:\d{2} y sigue sin confirmar\./,
  );
  // CA4: al imprimir mide 5 × 5 cm (96 px por pulgada).
  await page.emulateMedia({ media: 'print' });
  const caja = await etiqueta.locator('.etiqueta-imprimible').boundingBox();
  expect(Math.round((caja?.width ?? 0) / (96 / 2.54))).toBe(5);
  expect(Math.round((caja?.height ?? 0) / (96 / 2.54))).toBe(5);
  await page.emulateMedia({ media: 'screen' });

  // Lo que verá quien la escanee: la misma página pública, «sin verificar», con los datos.
  const enlace = (await etiqueta.locator('[data-prueba="enlace-qr"]').getAttribute('href')) ?? '';
  expect(enlace).toMatch(/\/agro\/t\/#[A-Za-z0-9_-]+$/);
  await context.setOffline(false);
  await page.goto(enlace);
  await expect(estado(page)).toHaveAttribute('data-estado', 'sin-verificar');
  await expect(page.locator('#qr-datos')).toContainText(codigo);
  await expect(page.locator('#qr-datos')).toContainText(FINCA_ENSAYO_UNO.finca.nombre);
});

test('revisión del dueño: imprimir la etiqueta da una sola hoja de 5 × 5 cm', async ({ page }) => {
  // window.print abre el diálogo del sistema: aquí se reemplaza y se genera el PDF como lo haría.
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await configurar(page, FINCA_ENSAYO_UNO);
  const area = FINCA_ENSAYO_UNO.areas[0];
  if (!area) throw new Error('sin áreas');
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await page.getByLabel('Cantidad cosechada').fill('20');
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.locator('[data-prueba="elegir-cosechas"] input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  const codigo = (await page.locator('.codigo-lote').first().textContent()) ?? '';
  await page.getByRole('button', { name: `Etiqueta QR del lote ${codigo}` }).click();
  await page.getByRole('button', { name: 'Imprimir' }).click();
  const pdf = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  const hojas = pdf.match(/\/Type\s*\/Page(?!s)/g) ?? [];
  expect(hojas).toHaveLength(1);
  const caja = pdf.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
  // 5 cm = 141,7 puntos PDF.
  expect(Math.round(Number(caja?.[1]))).toBe(142);
  expect(Math.round(Number(caja?.[2]))).toBe(142);
});

/** Arma un lote sin señal y abre su etiqueta; devuelve el código del lote. */
async function abrirEtiqueta(page: Page): Promise<string> {
  await configurar(page, FINCA_ENSAYO_UNO);
  const area = FINCA_ENSAYO_UNO.areas[0];
  if (!area) throw new Error('sin áreas');
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await page.getByLabel('Cantidad cosechada').fill('20');
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.locator('[data-prueba="elegir-cosechas"] input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  const codigo = (await page.locator('.codigo-lote').first().textContent()) ?? '';
  await page.getByRole('button', { name: `Etiqueta QR del lote ${codigo}` }).click();
  return codigo;
}

test('revisión del dueño: compartir con el menú del teléfono manda la etiqueta como imagen y el enlace', async ({
  page,
}) => {
  // El menú nativo no existe en la prueba: se reemplaza y se guarda lo que recibió.
  await page.addInitScript(() => {
    const w = window as unknown as { compartido?: unknown };
    Object.assign(navigator, {
      canShare: (d: { files?: File[] }) => Boolean(d.files?.every((f) => f.type === 'image/png')),
      share: async (d: { title: string; text: string; files: File[] }) => {
        const [f] = d.files;
        const imagen = f ? await createImageBitmap(f) : null;
        w.compartido = {
          titulo: d.title,
          texto: d.text,
          archivo: f?.name,
          tipo: f?.type,
          lado: imagen ? [imagen.width, imagen.height] : null,
        };
      },
    });
  });
  const codigo = await abrirEtiqueta(page);
  await page.getByRole('button', { name: 'Compartir' }).click();
  const enlace =
    (await page.locator('[data-prueba="enlace-qr"]').getAttribute('href')) ?? 'sin enlace';
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { compartido?: unknown }).compartido))
    .toEqual({
      titulo: `Lote ${codigo} · ${FINCA_ENSAYO_UNO.finca.nombre}`,
      texto: `Lote ${codigo} · ${FINCA_ENSAYO_UNO.finca.nombre}. De dónde viene: ${enlace}`,
      archivo: `lote-${codigo}.png`,
      tipo: 'image/png',
      lado: [720, 720],
    });
});

test('sin menú de compartir (un computador): descarga la imagen, copia el enlace y lo dice', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    Object.assign(navigator, { share: undefined });
  });
  await abrirEtiqueta(page);
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Compartir' }).click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/^lote-.+\.png$/);
  await expect(page.locator('[data-prueba="aviso-compartir"]')).toContainText(
    'La imagen de la etiqueta quedó en tus descargas y el enlace, copiado',
  );
  const enlace = await page.locator('[data-prueba="enlace-qr"]').getAttribute('href');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(enlace);
});

/** Un PNG de 1 × 1 px, como logo de prueba. */
const LOGO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test('revisión del dueño: con el plan Finca, el logo de la finca sale en la etiqueta; con el gratuito, no', async ({
  page,
}) => {
  await configurar(page, FINCA_ENSAYO_UNO);
  await conPlan(page, 'finca');
  await page.goto('/agro/app/');
  const codigo = await abrirEtiquetaDesdeAqui(page);
  const etiqueta = page.locator('[data-prueba="etiqueta-qr"]');
  await expect(etiqueta.locator('.etiqueta-logo')).toHaveCount(0);
  await etiqueta.getByLabel('Poner el logo de la finca').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: LOGO_PNG,
  });
  await expect(etiqueta.locator('.etiqueta-imprimible .etiqueta-logo')).toHaveAttribute(
    'alt',
    `Logo de ${FINCA_ENSAYO_UNO.finca.nombre}`,
  );
  await expect(etiqueta.locator('.etiqueta-codigo')).toContainText(codigo);
  // Sigue al volver a abrir la etiqueta: se guardó en el teléfono.
  await etiqueta.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: `Etiqueta QR del lote ${codigo}` }).click();
  await expect(page.locator('[data-prueba="etiqueta-qr"] .etiqueta-logo')).toHaveCount(1);
  await page
    .locator('[data-prueba="etiqueta-qr"]')
    .getByRole('button', { name: 'Quitar el logo' })
    .click();
  await expect(page.locator('[data-prueba="etiqueta-qr"] .etiqueta-logo')).toHaveCount(0);
});

test('con el plan gratuito, la etiqueta dice que el logo viene con el plan Finca', async ({
  page,
}) => {
  await abrirEtiqueta(page);
  await expect(page.locator('[data-prueba="logo-etiqueta"]')).toContainText(
    'viene con el plan Finca',
  );
  await expect(page.getByLabel('Poner el logo de la finca')).toHaveCount(0);
});

/** Como abrirEtiqueta, sin configurar la finca otra vez. Devuelve el código del lote. */
async function abrirEtiquetaDesdeAqui(page: Page): Promise<string> {
  const area = FINCA_ENSAYO_UNO.areas[0];
  if (!area) throw new Error('sin áreas');
  await nav(page).getByRole('link', { name: 'Registrar' }).click();
  await page.getByRole('button', { name: 'Cosecha', exact: true }).click();
  await page.getByLabel('Área', { exact: true }).selectOption({ label: area.nombre });
  await page.getByLabel('Cantidad cosechada').fill('20');
  const form = page.locator('[data-prueba="formulario-cosecha"]');
  await form.getByLabel('kg', { exact: true }).check();
  await form.getByLabel('Primera', { exact: true }).check();
  await page.getByRole('button', { name: 'Guardar cosecha' }).click();
  await nav(page).getByRole('link', { name: 'Lotes' }).click();
  await page.locator('[data-prueba="elegir-cosechas"] input[type=checkbox]').first().check();
  await page.getByRole('button', { name: 'Armar lote' }).click();
  const codigo = (await page.locator('.codigo-lote').first().textContent()) ?? '';
  await page.getByRole('button', { name: `Etiqueta QR del lote ${codigo}` }).click();
  return codigo;
}
