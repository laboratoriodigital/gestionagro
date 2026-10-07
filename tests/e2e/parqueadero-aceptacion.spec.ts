/**
 * La aceptación de M0 (BACKLOG-PARKING_MVP HU-Q6.3, PARQUEADERO §15.2): un turno entero sin red, a
 * 360 px, en los dos parqueaderos de prueba. Si un cambio rompe el recorrido del MVP, esta prueba
 * se pone en rojo. Cada paso espera lo que la caja muestra al terminar de guardar, nunca un tiempo
 * (bitácora agro, terreno: navegar justo después de guardar corta la escritura de IndexedDB).
 */
import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import {
  abrirControlada,
  abrirTurno,
  bytesImpresos,
  configurarImpresora,
  ENSAYOS,
  instalarImpresoraFalsa,
  llenarAjustes,
  SITIO,
  sinDesborde,
  teclearPlaca,
} from './parqueadero-ayudas.ts';

test.use({ testIdAttribute: 'data-prueba' });

const NUMERO = '300 123 4567';
/** 6 oct 2026, 18:05 de Bogotá. */
const ENTRADA = new Date('2026-10-06T23:05:00Z');
const minutosDespues = (m: number) => new Date(ENTRADA.getTime() + m * 60_000);

async function sinViolaciones(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

/** Los registros de la caja, leídos de IndexedDB: la verdad, no lo que dice la pantalla. */
const registros = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ tipo: string; serie: string | null; consecutivo: number | null }[]>(
        (listo, falla) => {
          const abrir = indexedDB.open('parqueadero-caja');
          abrir.onerror = () => falla(abrir.error);
          abrir.onsuccess = () => {
            const todos = abrir.result.transaction('registros').objectStore('registros').getAll();
            todos.onsuccess = () => listo(todos.result);
          };
        },
      ),
  );

for (const ensayo of ['uno', 'dos'] as const) {
  const e = ENSAYOS[ensayo];
  const siempre = ensayo === 'uno';

  test(`HU-Q6.3 · un turno entero sin red en ${e.nombre}`, async ({ page, context }) => {
    test.setTimeout(90_000);
    await context.route('https://wa.me/**', (r) => r.fulfill({ status: 200, body: 'WhatsApp' }));
    await page.addInitScript(instalarImpresoraFalsa);
    await page.clock.setFixedTime(ENTRADA);
    // La primera carga, con red, instala la caja; desde ahí, nada sale del teléfono.
    await abrirControlada(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('estadias')).toBeVisible();
    await sinViolaciones(page);

    await configurarImpresora(page, 'Línea 1');
    await page.getByRole('button', { name: 'Volver a la caja' }).click();
    await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
    await llenarAjustes(page, { ensayo, imprimir: siempre ? 'Sí' : 'No', aviso: true });

    // Apertura y entrada con el WhatsApp del conductor.
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await abrirTurno(page);
    await teclearPlaca(page, 'ABC123');
    await page.getByLabel('WhatsApp del conductor (opcional)').fill(NUMERO);
    await page.getByLabel(/Autoriza que le enviemos/).check();
    await sinViolaciones(page);
    const sinNada = (await bytesImpresos(page)).length;
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000001');
    await sinDesborde(page);
    await sinViolaciones(page);

    // El recibo: en papel siempre (Uno) o primero lo digital (Dos).
    if (siempre) {
      await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
      const papel = (await bytesImpresos(page)).slice(sinNada);
      for (const t of ['A-000001', 'ABC123', 'Aseguradora 0000000']) expect(papel).toContain(t);
    } else {
      await expect(page.getByTestId('pregunta-papel')).toBeVisible();
      expect((await bytesImpresos(page)).length).toBe(sinNada);
    }

    // El enlace de WhatsApp lleva el número y el texto del recibo (§6.4).
    const boton = page.getByTestId('whatsapp');
    const href = (await boton.getAttribute('href')) ?? '';
    expect(href).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
    const texto = new URL(href).searchParams.get('text') ?? '';
    expect(texto).toContain(`Recibo de entrada A-000001 - ${e.nombre}`);
    expect(texto).toContain('Placa ABC123');
    expect(texto).toContain('/r/#');
    const [chat] = await Promise.all([page.waitForEvent('popup'), boton.click()]);
    await chat.close();
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByTestId('estadia')).toContainText('ABC123');

    // Salida y liquidación: 3 h a $230 el minuto, sin tope por día.
    await page.clock.setFixedTime(minutosDespues(180));
    await page.getByTestId('estadia').click();
    await expect(page.getByTestId('total')).toHaveText('$41.400');
    await page.getByRole('button', { name: 'Efectivo' }).click();
    await page.getByLabel('Recibido').fill('50.000');
    await expect(page.getByTestId('cambio')).toHaveText('Cambio: $8.600');
    await sinViolaciones(page);
    const antesDeLaSalida = (await bytesImpresos(page)).length;
    await page.getByRole('button', { name: 'Cobrar $41.400' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000002');
    await expect(page.getByTestId('whatsapp')).toHaveAttribute('href', /wa\.me\/573001234567\?/);
    if (siempre) {
      await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
      const papel = (await bytesImpresos(page)).slice(antesDeLaSalida);
      for (const t of ['RECIBO DE SALIDA', 'A-000002', '$41.400', 'Cambio $8.600']) {
        expect(papel).toContain(t);
      }
    }
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByTestId('estadias')).toContainText('No hay vehículos adentro.');

    // Una entrada mal hecha se anula con motivo y PIN; no se borra.
    await page.clock.setFixedTime(minutosDespues(190));
    await page.getByRole('button', { name: 'Nueva entrada' }).click();
    await teclearPlaca(page, 'XYZ789');
    await page.getByRole('button', { name: 'Registrar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000003');
    await page.getByRole('button', { name: 'Anular la entrada' }).click();
    const anular = page.getByTestId('anular');
    await anular.getByLabel('Motivo').fill('placa mal digitada');
    await anular.getByLabel('PIN de administrador').fill('2468');
    await anular.getByRole('button', { name: 'Anular la entrada' }).click();
    await expect(page.getByTestId('anulado')).toContainText('Recibo anulado');
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByTestId('estadias')).toContainText('No hay vehículos adentro.');

    // El cierre impreso: 100.000 de base + 41.400 en efectivo, contado sin diferencia.
    await page.getByRole('button', { name: 'Cerrar turno' }).click();
    await expect(page.getByTestId('esperado')).toHaveText('Efectivo esperado: $141.400');
    const cierre = page.getByTestId('cerrar-turno');
    for (const [d, n] of [
      ['$100.000', '1'],
      ['$20.000', '2'],
      ['$1.000', '1'],
      ['$200', '2'],
    ] as const) {
      await cierre.getByLabel(d, { exact: true }).fill(n);
    }
    await expect(page.getByTestId('contado')).toHaveText('$141.400');
    await sinDesborde(page);
    await sinViolaciones(page);
    const antesDelCierre = (await bytesImpresos(page)).length;
    await cierre.getByRole('button', { name: 'Cerrar e imprimir' }).click();
    await expect(page.getByTestId('estado-del-cierre')).toHaveText('Cierre enviado a la impresora');
    const papelDelCierre = (await bytesImpresos(page)).slice(antesDelCierre);
    for (const t of ['CIERRE DE TURNO', 'T-001', '$141.400', 'Anulaciones']) {
      expect(papelDelCierre).toContain(t);
    }
    await page.getByRole('button', { name: 'Volver al inicio' }).click();
    await expect(page.getByTestId('tarjeta-turno')).toContainText('Abra el turno');

    // El respaldo, también sin red: se descarga con todo lo del turno.
    await page.getByRole('button', { name: 'Respaldo', exact: true }).click();
    const descarga = page.waitForEvent('download', (d) => d.suggestedFilename().endsWith('.json'));
    await page.getByRole('button', { name: 'Hacer el respaldo' }).click();
    const respaldo = JSON.parse(readFileSync(await (await descarga).path(), 'utf8')) as {
      tablas: { registro: { filas: { tipo: string }[] } };
    };
    await expect(page.getByTestId('estado-del-respaldo')).toContainText('Respaldo descargado');
    const tiposEnElRespaldo = respaldo.tablas.registro.filas.map((r) => r.tipo);
    for (const t of ['turno_apertura', 'entrada', 'salida', 'anulacion', 'turno_cierre']) {
      expect(tiposEnElRespaldo).toContain(t);
    }
    // El WhatsApp del cliente no se guarda (P4). Entero: un hash podría tener «4567».
    expect(JSON.stringify(respaldo)).not.toContain('3001234567');

    // Recargada la caja, sin red, todo sigue ahí: cada escritura terminó antes de seguir.
    await page.reload();
    await expect(page.getByTestId('estadias')).toContainText('No hay vehículos adentro.');
    const todos = await registros(page);
    const numeros = todos.filter((r) => r.consecutivo !== null).map((r) => r.consecutivo);
    expect(numeros.sort()).toEqual([1, 2, 3]);
    expect(todos.filter((r) => r.tipo === 'anulacion')).toHaveLength(1);
    await context.setOffline(false);
  });
}

test('HU-Q6.3 · una versión nueva en medio de una impresión no recarga la caja (CA2)', async ({
  page,
}) => {
  await page.addInitScript(instalarImpresoraFalsa);
  await abrirControlada(page);
  await configurarImpresora(page, 'Línea 1');
  await page.getByRole('button', { name: 'Volver a la caja' }).click();
  await page.getByRole('button', { name: 'Ajustes del parqueadero' }).click();
  await llenarAjustes(page, { ensayo: 'uno' });
  await page.getByRole('button', { name: 'Nueva entrada' }).click();
  await abrirTurno(page);
  await teclearPlaca(page, 'ABC123');
  // La impresora se queda recibiendo: el recibo está saliendo.
  await page.evaluate(() => (window as unknown as { __retener: () => void }).__retener());
  await page.getByRole('button', { name: 'Registrar' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Recibo A-000001');
  await page.evaluate(() => Object.assign(window, { marcaDeSesion: 'sigue-aqui' }));
  expect((await page.request.post(`${SITIO}/__prueba/version-nueva`)).status()).toBe(204);
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  const aviso = page.getByTestId('aviso-actualizacion');
  await expect(aviso).toContainText('Se podrá actualizar al terminar');
  await expect(page.getByRole('button', { name: 'Actualizar' })).toHaveCount(0);

  // Termina la impresión: recién ahí se ofrece, y la caja no se recargó sola.
  await page.evaluate(() => (window as unknown as { __soltar: () => void }).__soltar());
  await expect(page.getByTestId('estado-del-papel')).toHaveText('Enviado a la impresora');
  await expect(page.getByRole('button', { name: 'Actualizar' })).toBeVisible();
  expect(await page.evaluate(() => (window as { marcaDeSesion?: string }).marcaDeSesion)).toBe(
    'sigue-aqui',
  );
  expect((await bytesImpresos(page)).length).toBeGreaterThan(0);
});
