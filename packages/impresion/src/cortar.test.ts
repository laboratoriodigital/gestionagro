/**
 * Bitácora parqueadero 43: un recibo que la cola dio por perdido no sale después. Antes, la cola
 * dejaba de esperar a los 45 s pero el adaptador seguía mandando: cuando la impresora volvía,
 * imprimía de largo lo que la caja ya había dado por no salido.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CaracteristicaBle,
  crearImpresoraBluetooth,
  type DispositivoBle,
  enviarEnTrozos,
  type ServidorGatt,
  TROZO_NORMAL,
} from './bluetooth.ts';
import { crearCola } from './cola.ts';
import type { Impresora, Trabajo } from './contrato.ts';
import { crearImpresoraSerial, type PuertoSerie, SERVICIO_SERIE } from './serial.ts';

afterEach(() => {
  vi.useRealTimers();
});

const recibo = (n: number): Extract<Trabajo, { formato: 'escpos' }> => ({
  id: `r${n}`,
  formato: 'escpos',
  bytes: Uint8Array.from({ length: n }, (_, i) => i % 251),
});

/** Una espera que se suelta a mano: la impresora dormida que despierta cuando la prueba diga. */
function compuerta() {
  let abrir: () => void = () => undefined;
  const cerrada = new Promise<void>((r) => {
    abrir = r;
  });
  return { cerrada, abrir };
}

/** Un puerto cuyo segundo trozo se queda esperando hasta que la impresora «despierta». */
function puertoDormido() {
  const escrito: number[] = [];
  const despierta = compuerta();
  let abierto = false;
  let n = 0;
  let abortos = 0;
  let stream: WritableStream<Uint8Array> | null = null;
  const puerto: PuertoSerie = {
    async open() {
      if (abierto) throw new DOMException('The port is already open.', 'InvalidStateError');
      abierto = true;
      stream = new WritableStream<Uint8Array>({
        async write(d) {
          n++;
          if (n === 2) await despierta.cerrada;
          escrito.push(...d);
        },
        abort() {
          abortos++;
        },
      });
    },
    async close() {
      abierto = false;
      stream = null;
    },
    get writable() {
      return stream;
    },
    getInfo: () => ({ bluetoothServiceClassId: SERVICIO_SERIE }),
  };
  return {
    puerto,
    serial: { requestPort: async () => puerto, getPorts: async () => [puerto] },
    escrito,
    despierta,
    abortos: () => abortos,
  };
}

describe('lo que la cola dio por perdido no sale después (bitácora 43)', () => {
  it('la cola le pide al adaptador que corte el trabajo al vencer el tiempo', async () => {
    vi.useFakeTimers();
    let cortes = 0;
    const muda: Impresora = {
      camino: 'prueba',
      vincular: async () => ({ camino: 'prueba', nombre: 'x', id: 'x' }),
      reconectar: async () => true,
      imprimir: () => new Promise<never>(() => undefined),
      estado: () => 'conectada',
      cancelar: () => {
        cortes++;
      },
    };
    const pendiente = crearCola(muda, { msMaximo: 5_000 }).imprimir(recibo(10));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(await pendiente).toMatchObject({ ok: false, motivo: 'tiempo' });
    expect(cortes).toBe(1);
  });

  it('por el puerto serie: cortado, la impresora que despierta no recibe el resto', async () => {
    const f = puertoDormido();
    const impresora = crearImpresoraSerial({ serial: f.serial, esperar: async () => undefined });
    await impresora.vincular();
    // Tres trozos: el segundo se queda esperando a la impresora.
    const enCurso = impresora.imprimir(recibo(700));
    await vi.waitFor(() => expect(f.escrito.length).toBe(256));
    impresora.cancelar?.();
    f.despierta.abrir();
    expect(await enCurso).toMatchObject({ ok: false, motivo: 'tiempo' });
    expect(f.abortos()).toBe(1);
    // ❌ Sin cortar, el tercer trozo habría salido: el recibo completo, tarde.
    expect(f.escrito.length).toBeLessThan(700);
    // El siguiente recibo abre el puerto otra vez y sale entero.
    expect(await impresora.imprimir(recibo(100))).toMatchObject({ ok: true });
  });

  it('por Bluetooth: un trozo cortado no se reintenta más chico', async () => {
    const escrito: number[] = [];
    let llamadas = 0;
    await expect(
      enviarEnTrozos(
        async (d) => {
          llamadas++;
          if (llamadas === 2) throw new DOMException('cortado', 'AbortError');
          escrito.push(...d);
        },
        new Uint8Array(500),
        TROZO_NORMAL,
        async () => undefined,
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(llamadas).toBe(2);
    expect(escrito.length).toBe(TROZO_NORMAL.bytes);
  });

  it('por Bluetooth: cortado a mitad, la característica no recibe un trozo más', async () => {
    const despierta = compuerta();
    const escrito: number[] = [];
    let n = 0;
    const caracteristica: CaracteristicaBle = {
      uuid: '49535343-8841-43f4-a8d4-ecbe34729bb3',
      properties: { write: true, writeWithoutResponse: true, notify: false },
      async writeValueWithoutResponse(d) {
        n++;
        if (n === 2) await despierta.cerrada;
        escrito.push(...d);
      },
      writeValueWithResponse: () => Promise.reject(new DOMException('no', 'NotSupportedError')),
    };
    const gatt: ServidorGatt = {
      connected: true,
      connect: async () => gatt,
      getPrimaryService: async () => ({
        uuid: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        getCharacteristics: async () => [caracteristica],
      }),
    };
    const dispositivo: DispositivoBle = {
      id: 'pt',
      name: 'PT-210_1A2B',
      gatt,
      addEventListener: () => undefined,
    };
    const impresora = crearImpresoraBluetooth({
      bluetooth: { requestDevice: async () => dispositivo },
      esperar: async () => undefined,
    });
    await impresora.vincular();
    const enCurso = impresora.imprimir(recibo(600));
    await vi.waitFor(() => expect(n).toBe(2));
    impresora.cancelar?.();
    despierta.abrir();
    expect(await enCurso).toMatchObject({ ok: false, motivo: 'tiempo' });
    // Salieron el primero y el que ya estaba en camino; el resto, no.
    expect(escrito.length).toBe(2 * TROZO_NORMAL.bytes);
  });
});
