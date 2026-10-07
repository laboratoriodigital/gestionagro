import { describe, expect, it } from 'vitest';
import { FalloDeImpresora, type Trabajo } from './contrato.ts';
import {
  crearImpresoraSerial,
  nombreDelPuerto,
  type PuertoSerie,
  puertoRecordado,
  SERVICIO_SERIE,
  type SerialWeb,
  TROZO_SERIE,
} from './serial.ts';

const sinEsperar = async () => undefined;
const recibo = (n: number): Extract<Trabajo, { formato: 'escpos' }> => ({
  id: 'r1',
  formato: 'escpos',
  bytes: Uint8Array.from({ length: n }, (_, i) => i % 251),
});

/** Una PT-210 emparejada, vista como puerto serie. `fallos`: escrituras (1, 2…) que fallan. */
function puertoFalso(fallos: number[] = [], info = { bluetoothServiceClassId: SERVICIO_SERIE }) {
  const escrito: number[] = [];
  const aperturas: number[] = [];
  let abierto = false;
  let n = 0;
  const puerto: PuertoSerie = {
    async open(o) {
      if (abierto) throw new DOMException('The port is already open.', 'InvalidStateError');
      abierto = true;
      aperturas.push(o.baudRate);
    },
    async close() {
      abierto = false;
    },
    get writable() {
      if (!abierto) return null;
      return new WritableStream<Uint8Array>({
        write(d) {
          n++;
          if (fallos.includes(n)) throw new DOMException('Failed to write.', 'NetworkError');
          escrito.push(...d);
        },
      });
    },
    getInfo: () => info,
  };
  const pedidos: unknown[] = [];
  const serial: SerialWeb = {
    async requestPort(o) {
      pedidos.push(o);
      return puerto;
    },
    getPorts: async () => [puerto],
  };
  return { puerto, serial, escrito, aperturas, pedidos };
}

describe('Web Serial (HU-Q2.4)', () => {
  it('vincula desde un toque con el perfil serie y abre el puerto', async () => {
    const f = puertoFalso();
    const impresora = crearImpresoraSerial({ serial: f.serial, esperar: sinEsperar });
    const v = await impresora.vincular();
    expect(v).toEqual({
      camino: 'serial',
      nombre: 'Impresora emparejada por Bluetooth',
      id: `bt:${SERVICIO_SERIE}`,
    });
    expect(f.pedidos).toEqual([{ allowedBluetoothServiceClassIds: [SERVICIO_SERIE] }]);
    expect(f.aperturas).toEqual([9600]);
    expect(impresora.estado()).toBe('conectada');
  });

  it('en la sesión siguiente toma el puerto sin selector e imprime (CA1)', async () => {
    const f = puertoFalso();
    const puerto = await puertoRecordado(f.serial, `bt:${SERVICIO_SERIE}`);
    const impresora = crearImpresoraSerial({ serial: f.serial, puerto, esperar: sinEsperar });
    expect(await impresora.reconectar()).toBe(true);
    expect((await impresora.imprimir(recibo(600))).ok).toBe(true);
    expect(f.pedidos).toEqual([]);
    expect(Uint8Array.from(f.escrito)).toEqual(recibo(600).bytes);
  });

  it('manda en trozos de 256 bytes', async () => {
    const f = puertoFalso();
    const impresora = crearImpresoraSerial({ serial: f.serial, esperar: sinEsperar });
    await impresora.vincular();
    await impresora.imprimir(recibo(600));
    expect(Math.ceil(600 / TROZO_SERIE.bytes)).toBe(3);
    expect(f.escrito).toHaveLength(600);
  });

  it('si falla la primera escritura, abre otra vez y reintenta una vez (CA2)', async () => {
    const f = puertoFalso([1]);
    const impresora = crearImpresoraSerial({ serial: f.serial, esperar: sinEsperar });
    await impresora.vincular();
    const r = await impresora.imprimir(recibo(100));
    expect(r.ok).toBe(true);
    expect(f.aperturas).toHaveLength(2);
    expect(impresora.diagnostico()).toContain('se abre otra vez y se reintenta una vez');
  });

  it('si falla a mitad del recibo no lo repite, y dice que no salió (CA2 ❌)', async () => {
    const f = puertoFalso([2]);
    const impresora = crearImpresoraSerial({ serial: f.serial, esperar: sinEsperar });
    await impresora.vincular();
    const r = await impresora.imprimir(recibo(600));
    expect(r).toMatchObject({ ok: false, motivo: 'fuera_de_alcance' });
    expect(f.escrito).toHaveLength(TROZO_SERIE.bytes);
    expect(impresora.estado()).toBe('desconectada');
  });

  it('cerrar el selector es «No eligió impresora»', async () => {
    const serial: SerialWeb = {
      requestPort: () => Promise.reject(new DOMException('No port selected.', 'NotFoundError')),
      getPorts: async () => [],
    };
    const fallo = await crearImpresoraSerial({ serial })
      .vincular()
      .catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(FalloDeImpresora);
    expect((fallo as FalloDeImpresora).motivo).toBe('cancelado');
  });

  it('un puerto USB y uno sin datos se nombran para soporte', () => {
    expect(nombreDelPuerto({ usbVendorId: 0x0416, usbProductId: 0x5011 }).id).toBe('usb:0416:5011');
    expect(nombreDelPuerto({}).nombre).toBe('Impresora en un puerto serie');
  });
});
