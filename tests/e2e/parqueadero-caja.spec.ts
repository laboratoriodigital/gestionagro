/**
 * La caja del parqueadero (BACKLOG-PARKING_MVP HU-Q3.1, HU-Q2.6, HU-Q5.1), en su propio origen
 * como en staging. La PT-210 es un falso que se instala como `navigator.bluetooth` y guarda los
 * bytes: lo que la prueba lee es lo que habría salido por Bluetooth.
 */
import { gzipSync } from 'node:zlib';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const SITIO = 'http://localhost:4331';
const CAJA = `${SITIO}/caja/`;
const KB = 1024;

/** Una PT-210 falsa. Cada escritura se guarda en `window.__escrito`. */
function instalarImpresoraFalsa() {
  const escrito: number[] = [];
  Object.assign(window, { __escrito: escrito });
  const caracteristica = {
    uuid: '49535343-8841-43f4-a8d4-ecbe34729bb3',
    properties: { write: true, writeWithoutResponse: true, notify: false },
    writeValueWithoutResponse: async (d: Uint8Array) => {
      escrito.push(...d);
    },
    writeValueWithResponse: async () => undefined,
  };
  const gatt = {
    connected: true,
    connect: async () => gatt,
    getPrimaryService: async () => ({
      uuid: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      getCharacteristics: async () => [caracteristica],
    }),
  };
  const bluetooth = {
    requestDevice: async () => ({
      id: 'falsa',
      name: 'PT-210_FALSA',
      gatt,
      addEventListener: () => undefined,
    }),
  };
  Object.defineProperty(Navigator.prototype, 'bluetooth', {
    get: () => bluetooth,
    configurable: true,
  });
}

async function abrirControlada(page: Page) {
  await page.goto(CAJA);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

async function configurarImpresora(page: Page, linea: string) {
  await page.getByRole('button', { name: 'Configurar impresora' }).click();
  await expect(page.getByTestId('propuesta')).toHaveText(
    'Este equipo puede imprimir por Bluetooth.',
  );
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Conectar impresora' }).click();
  await expect(page.getByTestId('conectada')).toHaveText('Conectada: PT-210_FALSA');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Imprimir página de prueba' }).click();
  await expect(page.getByTestId('enviada')).toHaveText('Enviado a la impresora.');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(
    '4 de 4 · Mire el papel que acaba de salir',
  );
  await expect(page.getByRole('button', { name: 'Falta decir qué línea se lee' })).toBeDisabled();
  await page.getByRole('button', { name: linea, exact: true }).click();
  await page.getByRole('button', { name: 'Los dos' }).click();
  await page.getByRole('button', { name: 'Sí', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
}

/** Los ajustes del Parqueadero Ensayo Dos (sin póliza), con la tarifa del carro. */
async function llenarAjustes(page: Page, o: { valor?: string; imprimir?: 'Sí' | 'No' } = {}) {
  const f = page.getByTestId('ajustes');
  await f.getByLabel('Nombre del parqueadero', { exact: true }).fill('Parqueadero Ensayo Dos');
  await f.getByLabel('NIT, con el dígito', { exact: true }).fill('800123456-7');
  await f.getByLabel('Dirección', { exact: true }).fill('Carrera 10 # 20-30 Local 4');
  await f.getByLabel('Ciudad', { exact: true }).fill('Tunja');
  await f.getByLabel('Teléfono', { exact: true }).fill('+57 310 000 0000');
  await f
    .getByRole('group', { name: '¿Tiene póliza de responsabilidad?' })
    .getByRole('button', { name: 'No' })
    .click();
  await f
    .getByRole('group', { name: '¿Imprimir el recibo al registrar?' })
    .getByRole('button', { name: o.imprimir ?? 'Sí' })
    .click();
  const carro = f.getByTestId('tarifa-carro');
  await carro.getByLabel('Pesos por minuto', { exact: true }).fill(o.valor ?? '230');
  await carro.getByLabel('Tope legal por minuto', { exact: true }).fill('230');
  await carro.getByLabel('Minutos de gracia', { exact: true }).fill('5');
  await carro.getByLabel('Redondeo', { exact: true }).selectOption('ninguno');
  await f.getByLabel('PIN (4 a 6 números)', { exact: true }).fill('2468');
  await f.getByLabel('Repita el PIN', { exact: true }).fill('2468');
  await f.getByRole('button', { name: 'Guardar', exact: true }).click();
}

/** Escribe la placa con el teclado de la caja, no con el del sistema. */
async function teclearPlaca(page: Page, placa: string) {
  const teclado = page.getByRole('group', { name: 'Teclado de la placa' });
  for (const t of placa) await teclado.getByRole('button', { name: t, exact: true }).click();
}

const bytesImpresos = (page: Page) =>
  page
    .evaluate(() => (window as unknown as { __escrito: number[] }).__escrito)
    .then((b) => Buffer.from(b).toString('latin1'));

test.use({ testIdAttribute: 'data-prueba' });

test.describe('la caja del parqueadero', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(instalarImpresoraFalsa);
  });

  test('HU-Q3.1 · abre con sus cuatro señales y, fuera de producción, la marca de PRUEBA', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await expect(page.getByTestId('senal-impresora')).toHaveText('Impresora sin configurar');
    await expect(page.getByTestId('senal-respaldo')).toBeVisible();
    await expect(page.getByTestId('senal-hora')).toBeVisible();
    await expect(page.getByTestId('senal-pendientes')).toHaveText('Sin entregas pendientes');
    await expect(page.getByTestId('marca-prueba')).toContainText('PRUEBA');
  });

  test('HU-Q3.1 · abre sin red después de la primera carga', async ({ page, context }) => {
    await abrirControlada(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Antes del primer recibo, configure la impresora',
    );
    await context.setOffline(false);
  });

  test('HU-Q3.1 · JS inicial ≤ 80 KB con gzip, todo del mismo origen y sin el codificador', async ({
    page,
  }) => {
    const scripts: { url: string; cuerpo: Promise<Buffer> }[] = [];
    page.on('response', (r) => {
      if (r.request().resourceType() === 'script') scripts.push({ url: r.url(), cuerpo: r.body() });
    });
    await page.goto(CAJA, { waitUntil: 'load' });
    await expect(page.getByTestId('senal-impresora')).toBeVisible();
    expect(scripts.filter((s) => new URL(s.url).origin !== SITIO).map((s) => s.url)).toEqual([]);
    expect(scripts.map((s) => s.url).filter((u) => u.includes('receipt-printer-encoder'))).toEqual(
      [],
    );
    let total = 0;
    for (const s of scripts) {
      const cuerpo = await s.cuerpo;
      total += gzipSync(cuerpo).length;
      // El codificador (29 KB) se carga al imprimir, no al abrir (bitácora parqueadero 10).
      expect(
        cuerpo.includes('Images are not supported in table cells'),
        `${s.url} trae el codificador`,
      ).toBe(false);
    }
    expect(total, `JS inicial: ${total} bytes con gzip`).toBeLessThanOrEqual(80 * KB);
  });

  test('HU-Q2.6 · el asistente imprime la página de prueba y guarda las respuestas', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await configurarImpresora(page, 'Línea 2');
    await expect(page.getByTestId('resumen')).toContainText('Las tildes salen con la línea 2.');
    const bytes = await page.evaluate(
      () => (window as unknown as { __escrito: number[] }).__escrito,
    );
    const papel = Buffer.from(bytes).toString('latin1');
    expect(papel).toContain('PRUEBA'); // HU-Q5.1 CA2: nada de staging vale como recibo
    expect(papel).toContain('12345678901234567890123456789012');
    expect(papel).toContain('4) Sin tildes: aeiou nN ?! $');
    await page.getByRole('button', { name: 'Volver a la caja' }).click();
    await expect(page.getByTestId('senal-impresora')).toHaveText('Impresora conectada');
    await expect(page.getByTestId('pagina-de-codigos')).toContainText('Tildes con WPC1252');
  });

  test('HU-Q2.6 · si ninguna línea con tildes se ve bien, translitera y lo dice en Ajustes', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await configurarImpresora(page, 'Ninguna');
    await page.getByRole('button', { name: 'Volver a la caja' }).click();
    await expect(page.getByTestId('pagina-de-codigos')).toHaveText(
      'Imprime sin tildes: ninguna página de códigos se vio bien en la prueba.',
    );
  });

  test('HU-Q3.1 · una versión nueva no recarga la caja con el asistente abierto', async ({
    page,
  }) => {
    await abrirControlada(page);
    await page.getByRole('button', { name: 'Configurar impresora' }).click();
    await page.evaluate(() => Object.assign(window, { marcaDeSesion: 'sigue-aqui' }));
    expect((await page.request.post(`${SITIO}/__prueba/version-nueva`)).status()).toBe(204);
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
    const aviso = page.getByTestId('aviso-actualizacion');
    await expect(aviso).toContainText('Se podrá actualizar al terminar');
    await expect(page.getByRole('button', { name: 'Actualizar' })).toHaveCount(0);
    expect(await page.evaluate(() => (window as { marcaDeSesion?: string }).marcaDeSesion)).toBe(
      'sigue-aqui',
    );
    await expect(page.getByTestId('asistente')).toBeVisible();
  });

  test('HU-Q3.2 · sin ajustes, «Nueva entrada» dice qué falta y lleva al campo', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await expect(page.getByTestId('falta')).toHaveText(
      'Antes del primer recibo falta: el nombre, el NIT, la dirección, la ciudad, el teléfono, la póliza y la tarifa de carro.',
    );
    await page.getByRole('button', { name: 'Completar los ajustes' }).click();
    await expect(page.getByLabel('Nombre del parqueadero')).toBeFocused();
    await expect(page.getByLabel('Nombre del parqueadero')).toHaveValue('');
  });

  test('HU-Q3.2 · una tarifa por encima del tope no se guarda y dice por qué (CA3 ❌)', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await llenarAjustes(page, { valor: '250' });
    await expect(page.getByTestId('hay-errores')).toBeVisible();
    await expect(page.getByLabel('Pesos por minuto').first()).toBeFocused();
    await expect(page.getByTestId('ajustes')).toContainText('tope');
    await page.getByTestId('tarifa-carro').getByLabel('Pesos por minuto').fill('230');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByTestId('estadias')).toBeVisible();
    // Después, los ajustes piden el PIN.
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await expect(page.getByTestId('pedir-pin')).toBeVisible();
  });

  test('HU-Q3.3 · registra ABC123 y el recibo sale solo con su número y su placa', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await configurarImpresora(page, 'Línea 1');
    await page.getByRole('button', { name: 'Volver a la caja' }).click();
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await llenarAjustes(page);
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    const antes = (await bytesImpresos(page)).length;
    await teclearPlaca(page, 'ABC123');
    await expect(page.getByTestId('placa')).toHaveText('ABC123');
    await expect(page.getByRole('button', { name: 'Carro' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000001');
    await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
    const recibo = (await bytesImpresos(page)).slice(antes);
    expect(recibo).toContain('A-000001');
    expect(recibo).toContain('ABC123');
    expect(recibo).toContain('PRUEBA');
    expect(recibo).not.toContain('COPIA');
    // Reimprimir sale con «COPIA 1» (HU-Q3.6 CA2).
    const conOriginal = (await bytesImpresos(page)).length;
    await page.getByRole('button', { name: 'Imprimir otra vez' }).click();
    await expect(page.getByTestId('estado-del-papel')).toHaveText('Copia 1 enviada a la impresora');
    expect((await bytesImpresos(page)).slice(conOriginal)).toContain('*** COPIA 1 ***');
    // La misma placa no abre otra estadía (CA3).
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await teclearPlaca(page, 'ABC123');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByTestId('aviso-entrada')).toContainText('ABC123');
  });

  test('HU-Q3.4 y HU-Q3.5 · la estadía aparece adentro, se busca y se cobra con su recibo de salida', async ({
    page,
  }) => {
    const entrada = new Date('2026-10-06T23:05:00Z');
    await page.clock.setFixedTime(entrada);
    await page.goto(CAJA);
    await configurarImpresora(page, 'Línea 1');
    await page.getByRole('button', { name: 'Volver a la caja' }).click();
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await llenarAjustes(page);
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await teclearPlaca(page, 'ABC123');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
    await page.getByRole('button', { name: 'Volver al inicio' }).click();

    const estadia = page.getByTestId('estadia');
    await expect(estadia).toContainText('ABC123');
    await expect(estadia).toContainText('Entró 18:05');
    await page.getByLabel('Buscar por placa').fill('xyz');
    await expect(estadia).toHaveCount(0);
    await page.getByLabel('Buscar por placa').fill('abc');
    await expect(estadia).toHaveCount(1);

    // Tres horas después: 180 × $230 = $41.400 (estos ajustes no tienen tope por día).
    await page.clock.setFixedTime(new Date(entrada.getTime() + 180 * 60_000));
    await estadia.click();
    await expect(page.getByTestId('total')).toHaveText('$41.400');
    const cobrar = page.getByRole('button', { name: /^Cobrar|Elija|Lo recibido|Escriba/ });
    await expect(cobrar).toHaveText('Elija el medio de pago');
    await page.getByRole('button', { name: 'Cortesía' }).click();
    await expect(cobrar).toHaveText('Escriba el motivo de la cortesía');
    await expect(cobrar).toBeDisabled();
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await page.getByLabel('Recibido').fill('40.000');
    await expect(cobrar).toHaveText('Lo recibido no alcanza: el total es $41.400');
    await expect(cobrar).toBeDisabled();
    await page.getByLabel('Recibido').fill('50.000');
    await expect(page.getByTestId('cambio')).toHaveText('Cambio: $8.600');
    const antes = (await bytesImpresos(page)).length;
    await cobrar.click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000002');
    await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
    const papel = (await bytesImpresos(page)).slice(antes);
    expect(papel).toContain('RECIBO DE SALIDA');
    expect(papel).toContain('A-000002');
    expect(papel).toContain('$41.400');
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByTestId('estadias')).toContainText('No hay vehículos adentro.');
  });

  test('HU-Q3.3 · sin impresora conectada, el registro existe y la entrega queda pendiente (CA4 ❌)', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await llenarAjustes(page);
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await teclearPlaca(page, 'XYZ98');
    await page.getByTestId('confirmar-placa').click();
    await page.getByRole('button', { name: 'Carro' }).click();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000001');
    await expect(page.getByTestId('estado-del-papel')).toContainText(
      'Quedó en entregas pendientes',
    );
    await expect(page.getByTestId('senal-pendientes')).toContainText('1');
  });

  test('HU-Q3.3 · sin red, la entrada abre y registra', async ({ page, context }) => {
    await abrirControlada(page);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await llenarAjustes(page, { imprimir: 'No' });
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await teclearPlaca(page, 'ABC12D');
    // Solo el carro tiene tarifa: la moto que propone el patrón no se ofrece.
    await expect(page.getByRole('button', { name: 'Moto' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Carro' }).click();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000001');
    await expect(page.getByTestId('estado-del-papel')).toHaveText('');
    await context.setOffline(false);
  });
});

for (const esquema of ['light', 'dark'] as const) {
  test(`HU-Q3.1 · la caja y el asistente terminado pasan WCAG 2.1 AA en modo ${esquema}`, async ({
    page,
  }) => {
    await page.addInitScript(instalarImpresoraFalsa);
    await page.emulateMedia({ colorScheme: esquema });
    const revisar = async () => {
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    };
    await page.goto(CAJA);
    await expect(page.getByTestId('senal-impresora')).toBeVisible();
    await revisar();
    await configurarImpresora(page, 'Línea 1');
    await revisar();
    await page.getByRole('button', { name: 'Volver a la caja' }).click();
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await expect(page.getByTestId('ajustes')).toBeVisible();
    await revisar();
    await llenarAjustes(page, { imprimir: 'No' });
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await teclearPlaca(page, 'ABC123');
    await revisar();
    await page.getByRole('button', { name: 'Registrar' }).click();
    await page.getByRole('button', { name: 'Mostrar QR' }).click();
    await expect(page.getByTestId('qr-en-pantalla')).toBeVisible();
    await revisar();
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByTestId('estadia')).toBeVisible();
    await revisar();
    await page.getByTestId('estadia').click();
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await expect(page.getByTestId('total')).toBeVisible();
    await revisar();
  });
}

test.describe('en iPhone', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });

  test('HU-Q2.6 · lo dice desde el paso 1 y no ofrece un botón que no puede funcionar', async ({
    page,
  }) => {
    await page.goto(CAJA);
    await page.getByRole('button', { name: 'Configurar impresora' }).click();
    await expect(page.getByTestId('propuesta')).toContainText('En iPhone ningún navegador');
    await expect(
      page.getByRole('button', { name: 'Falta un navegador que pueda imprimir' }),
    ).toBeDisabled();
  });
});
