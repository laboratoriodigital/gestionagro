/**
 * Lo que comparten las e2e de la caja del parqueadero: la PT-210 falsa, el asistente, los ajustes
 * de los dos parqueaderos de prueba y el turno. Ningún dato real (P4).
 */
import { expect, type Page } from '@playwright/test';

export const SITIO = 'http://localhost:4331';
export const CAJA = `${SITIO}/caja/`;

/** Una PT-210 falsa. Cada escritura se guarda en `window.__escrito`. */
export function instalarImpresoraFalsa() {
  const escrito: number[] = [];
  Object.assign(window, { __escrito: escrito });
  const caracteristica = {
    uuid: '49535343-8841-43f4-a8d4-ecbe34729bb3',
    properties: { write: true, writeWithoutResponse: true, notify: false },
    writeValueWithoutResponse: async (d: Uint8Array) => {
      await soltar;
      escrito.push(...d);
    },
    writeValueWithResponse: async () => undefined,
  };
  // `__apagar()` y `__prender()`: la impresora se apaga con la caja abierta (bitácora 18).
  // `__ocupar()`: conecta y se cae al buscarla, como la PT210L emparejada en el S24 (bitácora 24).
  let prendida = true;
  let ocupada = false;
  // `__retener()` deja las escrituras esperando hasta `__soltar()`: una impresión en curso.
  let soltar: Promise<void> = Promise.resolve();
  let alSoltar: () => void = () => undefined;
  let conectada = false;
  let alDesconectar: () => void = () => undefined;
  const gatt = {
    get connected() {
      return conectada;
    },
    connect: async () => {
      if (!prendida) throw new DOMException('Connection attempt failed.', 'NetworkError');
      conectada = true;
      return gatt;
    },
    getPrimaryService: async () => {
      if (ocupada) {
        conectada = false;
        throw new DOMException(
          'GATT Server is disconnected. Cannot retrieve services.',
          'NetworkError',
        );
      }
      return {
        uuid: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        getCharacteristics: async () => [caracteristica],
      };
    },
  };
  Object.assign(window, {
    __apagar: () => {
      prendida = false;
      conectada = false;
      alDesconectar();
    },
    __prender: () => {
      prendida = true;
    },
    __ocupar: () => {
      ocupada = true;
    },
    __retener: () => {
      soltar = new Promise((listo) => {
        alSoltar = listo;
      });
    },
    __soltar: () => alSoltar(),
  });
  const bluetooth = {
    requestDevice: async () => ({
      id: 'falsa',
      name: 'PT-210_FALSA',
      gatt,
      addEventListener: (_tipo: string, oyente: () => void) => {
        alDesconectar = oyente;
      },
    }),
  };
  Object.defineProperty(Navigator.prototype, 'bluetooth', {
    get: () => bluetooth,
    configurable: true,
  });
}

export async function abrirControlada(page: Page) {
  await page.goto(CAJA);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

/**
 * La PT-210 emparejada, vista por Web Serial (HU-Q2.4). Cada escritura se guarda en
 * `window.__escritoSerie`; el permiso del puerto se recuerda entre recargas, como en Chrome.
 */
export function instalarSerialFalso() {
  const escrito: number[] = [];
  Object.assign(window, { __escritoSerie: escrito });
  let abierto = false;
  const puerto = {
    open: async () => {
      abierto = true;
    },
    close: async () => {
      abierto = false;
    },
    get writable() {
      return abierto
        ? new WritableStream<Uint8Array>({ write: (d) => void escrito.push(...d) })
        : null;
    },
    getInfo: () => ({ bluetoothServiceClassId: '00001101-0000-1000-8000-00805f9b34fb' }),
  };
  const serial = {
    requestPort: async () => {
      localStorage.setItem('permiso-serie', 'si');
      return puerto;
    },
    getPorts: async () => (localStorage.getItem('permiso-serie') ? [puerto] : []),
  };
  Object.defineProperty(Navigator.prototype, 'serial', { get: () => serial, configurable: true });
}

export async function configurarImpresora(
  page: Page,
  linea: string,
  camino: { boton: string; nombre: string } = {
    boton: 'Conectar impresora',
    nombre: 'PT-210_FALSA',
  },
) {
  await page.getByRole('button', { name: 'Configurar impresora' }).click();
  await expect(page.getByTestId('propuesta')).toHaveText(
    'Este equipo puede imprimir por Bluetooth.',
  );
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: camino.boton }).click();
  await expect(page.getByTestId('conectada')).toHaveText(`Conectada: ${camino.nombre}`);
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

/** Un PNG de 1×1: basta para la imagen del QR de pagos. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Los dos parqueaderos de prueba de `@ed1/parqueadero-schema/ensayos` (P4): Ensayo Uno, en Bogotá
 * con póliza, y Ensayo Dos, en Tunja sin ella. Ningún dato real.
 */
export const ENSAYOS = {
  uno: {
    nombre: 'Parqueadero Ensayo Uno',
    nit: '900.000.000-0',
    direccion: 'Calle 1 # 2-3',
    ciudad: 'Bogotá',
    telefono: '3000000000',
    poliza: { aseguradora: 'Aseguradora', numero: '0000000' },
  },
  dos: {
    nombre: 'Parqueadero Ensayo Dos',
    nit: '800123456-7',
    direccion: 'Carrera 10 # 20-30 Local 4',
    ciudad: 'Tunja',
    telefono: '+57 310 000 0000',
    poliza: null,
  },
} as const;

/** Los ajustes de un parqueadero de prueba (Ensayo Dos si no se dice), con la tarifa del carro. */
export async function llenarAjustes(
  page: Page,
  o: {
    valor?: string;
    imprimir?: 'Sí' | 'No';
    qr?: boolean;
    nombre?: string;
    aviso?: boolean;
    ensayo?: keyof typeof ENSAYOS;
  } = {},
) {
  const e = ENSAYOS[o.ensayo ?? 'dos'];
  const f = page.getByTestId('ajustes');
  await f.getByLabel('Nombre del parqueadero', { exact: true }).fill(o.nombre ?? e.nombre);
  await f.getByLabel('NIT, con el dígito', { exact: true }).fill(e.nit);
  await f.getByLabel('Dirección', { exact: true }).fill(e.direccion);
  await f.getByLabel('Ciudad', { exact: true }).fill(e.ciudad);
  await f.getByLabel('Teléfono', { exact: true }).fill(e.telefono);
  await f
    .getByRole('group', { name: '¿Tiene póliza de responsabilidad?' })
    .getByRole('button', { name: e.poliza ? 'Sí' : 'No', exact: true })
    .click();
  if (e.poliza) {
    await f.getByLabel('Aseguradora', { exact: true }).fill(e.poliza.aseguradora);
    await f.getByLabel('Número', { exact: true }).fill(e.poliza.numero);
  }
  await f
    .getByRole('group', { name: '¿Cuándo sale el recibo en papel?' })
    // «No»: salvo recibo digital (HU-Q4.3); no existe «nunca».
    .getByRole('button', {
      name: o.imprimir === 'No' ? 'Si no lo recibe por WhatsApp o QR' : 'Siempre, al registrar',
    })
    .click();
  const carro = f.getByTestId('tarifa-carro');
  await carro.getByLabel('Pesos por minuto', { exact: true }).fill(o.valor ?? '230');
  await carro.getByLabel('Tope legal por minuto', { exact: true }).fill('230');
  await carro.getByLabel('Minutos de gracia', { exact: true }).fill('5');
  await carro.getByLabel('Redondeo', { exact: true }).selectOption('ninguno');
  if (o.qr) {
    await f
      .getByLabel('Imagen del QR de pagos', { exact: true })
      .setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: PNG });
  }
  if (o.aviso) await f.getByLabel(/acepta este aviso de privacidad/).check();
  await f.getByLabel('PIN (4 a 6 números)', { exact: true }).fill('2468');
  await f.getByLabel('Repita el PIN', { exact: true }).fill('2468');
  await f.getByRole('button', { name: 'Guardar', exact: true }).click();
}

/** Abre el turno que pide la primera entrada (HU-Q3.9 CA4). */
export async function abrirTurno(page: Page) {
  const f = page.getByTestId('abrir-turno');
  await f.getByLabel('Quién atiende').fill('Caja 1');
  await f.getByLabel('Base de caja (efectivo al empezar)').fill('100000');
  await f.getByRole('button', { name: 'Abrir turno' }).click();
}

/** Escribe la placa con el teclado de la caja, no con el del sistema. */
export async function teclearPlaca(page: Page, placa: string) {
  const teclado = page.getByRole('group', { name: 'Teclado de la placa' });
  for (const t of placa) await teclado.getByRole('button', { name: t, exact: true }).click();
}

export const bytesImpresos = (page: Page) =>
  page
    .evaluate(() => (window as unknown as { __escrito: number[] }).__escrito)
    .then((b) => Buffer.from(b).toString('latin1'));

/** Nada se sale de los 360 px: lo cortado no se lee (bitácora parqueadero 15 y 23). */
export async function sinDesborde(page: Page) {
  const ancho = await page.evaluate(() => ({
    contenido: document.documentElement.scrollWidth,
    ventana: document.documentElement.clientWidth,
  }));
  expect(ancho.contenido).toBeLessThanOrEqual(ancho.ventana);
}
