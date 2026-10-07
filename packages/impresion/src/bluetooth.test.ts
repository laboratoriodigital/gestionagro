import { describe, expect, it } from 'vitest';
import {
  type BluetoothBle,
  type CaracteristicaBle,
  crearImpresoraBluetooth,
  type DispositivoBle,
  enviarEnTrozos,
  FalloDeImpresora,
  SERVICIOS_DE_IMPRESORA,
  type ServidorGatt,
  TEXTO_DEL_MOTIVO,
  TROZO_NORMAL,
  TROZO_PEQUENO,
  type Trabajo,
  type Trozo,
} from './index.ts';

const PT210 = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const ESCRIBIR = '49535343-8841-43f4-a8d4-ecbe34729bb3';
const NOTIFICAR = '49535343-1e4d-4bd9-ba61-23c647249616';

function error(nombre: string, mensaje = nombre): DOMException {
  return new DOMException(mensaje, nombre);
}

/** Una PT-210 falsa: rechaza escrituras de más de `maximo` bytes, como un navegador con MTU chico. */
function pt210Falsa(maximo = 512) {
  const escrituras: Uint8Array[] = [];
  let conectada = false;
  let alDesconectar: () => void = () => undefined;
  const caracteristicas: CaracteristicaBle[] = [
    {
      uuid: NOTIFICAR,
      properties: { write: false, writeWithoutResponse: false, notify: true },
      writeValueWithoutResponse: () => Promise.reject(error('NotSupportedError')),
      writeValueWithResponse: () => Promise.reject(error('NotSupportedError')),
    },
    {
      uuid: ESCRIBIR,
      properties: { write: true, writeWithoutResponse: true, notify: false },
      async writeValueWithoutResponse(d) {
        if (!conectada) throw error('NetworkError', 'GATT Server is disconnected.');
        if (d.length > maximo) throw error('InvalidModificationError', 'Value is too long');
        escrituras.push(d.slice());
      },
      writeValueWithResponse: () => Promise.reject(error('NotSupportedError')),
    },
  ];
  const gatt: ServidorGatt = {
    get connected() {
      return conectada;
    },
    async connect() {
      conectada = true;
      return gatt;
    },
    async getPrimaryService(s) {
      if (s !== PT210) throw error('NotFoundError', 'No Services matching UUID found');
      return { uuid: PT210, getCharacteristics: async () => caracteristicas };
    },
  };
  const dispositivo: DispositivoBle = {
    id: 'abc=',
    name: 'PT-210_1A2B',
    gatt,
    addEventListener: (_t, oyente) => {
      alDesconectar = oyente;
    },
  };
  const pedidos: unknown[] = [];
  const bluetooth: BluetoothBle = {
    async requestDevice(opciones) {
      pedidos.push(opciones);
      return dispositivo;
    },
  };
  return {
    bluetooth,
    escrituras,
    pedidos,
    apagar() {
      conectada = false;
      alDesconectar();
    },
  };
}

const sinEsperar = async (): Promise<void> => undefined;
const recibo = (n: number): Extract<Trabajo, { formato: 'escpos' }> => ({
  id: 'r1',
  formato: 'escpos',
  bytes: Uint8Array.from({ length: n }, (_, i) => i % 251),
});
const unir = (partes: Uint8Array[]) => Uint8Array.from(partes.flatMap((p) => [...p]));

describe('vincular', () => {
  it('pide la PT por nombre y por los servicios de §7.4, y toma la característica de escritura', async () => {
    const f = pt210Falsa();
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth });
    const vinculo = await impresora.vincular();
    expect(f.pedidos[0]).toMatchObject({
      filters: [{ namePrefix: 'PT' }, ...SERVICIOS_DE_IMPRESORA.map((s) => ({ services: [s] }))],
      optionalServices: SERVICIOS_DE_IMPRESORA,
    });
    expect(vinculo).toMatchObject({
      nombre: 'PT-210_1A2B',
      servicio: PT210,
      caracteristica: ESCRIBIR,
    });
    expect(impresora.estado()).toBe('conectada');
    expect(impresora.diagnostico()).toContain(`${NOTIFICAR}: notify`);
  });

  it('«Ver todos los equipos» pide con acceptAllDevices y los mismos servicios', async () => {
    const f = pt210Falsa();
    await crearImpresoraBluetooth({ bluetooth: f.bluetooth, verTodos: true }).vincular();
    expect(f.pedidos[0]).toEqual({
      acceptAllDevices: true,
      optionalServices: SERVICIOS_DE_IMPRESORA,
    });
  });

  it('cerrar el selector es «No eligió impresora»', async () => {
    const bluetooth: BluetoothBle = { requestDevice: () => Promise.reject(error('NotFoundError')) };
    const fallo = await crearImpresoraBluetooth({ bluetooth })
      .vincular()
      .catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(FalloDeImpresora);
    expect(TEXTO_DEL_MOTIVO[(fallo as FalloDeImpresora).motivo]).toBe('No eligió impresora');
  });

  it('un equipo sin servicio conocido es «Esta impresora no se reconoce»', async () => {
    const f = pt210Falsa();
    const otro: BluetoothBle = {
      requestDevice: async (o) => {
        const d = await f.bluetooth.requestDevice(o);
        return {
          ...d,
          gatt: {
            ...d.gatt,
            connected: true,
            connect: async () =>
              ({
                ...d.gatt,
                getPrimaryService: () => Promise.reject(error('NotFoundError')),
              }) as ServidorGatt,
          } as ServidorGatt,
        };
      },
    };
    const fallo = (await crearImpresoraBluetooth({ bluetooth: otro })
      .vincular()
      .catch((e: unknown) => e)) as FalloDeImpresora;
    expect(TEXTO_DEL_MOTIVO[fallo.motivo]).toBe('Esta impresora no se reconoce');
  });
});

describe('imprimir', () => {
  it('manda en trozos de 180 cada 30 ms y llegan todos los bytes en orden', async () => {
    const f = pt210Falsa();
    const pausas: number[] = [];
    const impresora = crearImpresoraBluetooth({
      bluetooth: f.bluetooth,
      esperar: async (ms) => {
        pausas.push(ms);
      },
    });
    await impresora.vincular();
    const r = await impresora.imprimir(recibo(1_000));
    expect(r).toMatchObject({ ok: true, bytes: 1_000, papel: 'desconocido' });
    expect(f.escrituras.map((e) => e.length)).toEqual([180, 180, 180, 180, 180, 100]);
    expect(pausas).toEqual([30, 30, 30, 30, 30]);
    expect(unir(f.escrituras)).toEqual(recibo(1_000).bytes);
  });

  it('si el navegador rechaza trozos de más de 100 bytes, baja, termina y lo recuerda', async () => {
    const f = pt210Falsa(100);
    const recordados: Trozo[] = [];
    const impresora = crearImpresoraBluetooth({
      bluetooth: f.bluetooth,
      esperar: sinEsperar,
      alCambiarTrozo: (t) => recordados.push(t),
    });
    await impresora.vincular();
    expect((await impresora.imprimir(recibo(735))).ok).toBe(true);
    expect(f.escrituras.every((e) => e.length <= 100)).toBe(true);
    expect(unir(f.escrituras)).toEqual(recibo(735).bytes);
    expect(recordados).toEqual([TROZO_PEQUENO]);
    // El segundo recibo ya sale con el trozo pequeño, sin rechazo.
    f.escrituras.length = 0;
    await impresora.imprimir(recibo(250));
    expect(f.escrituras.map((e) => e.length)).toEqual([100, 100, 50]);
    expect(recordados).toHaveLength(1);
  });

  it('se apagó: lo dice, y al imprimir reconecta sin selector', async () => {
    const f = pt210Falsa();
    const estados: string[] = [];
    const impresora = crearImpresoraBluetooth({
      bluetooth: f.bluetooth,
      esperar: sinEsperar,
      alCambiarEstado: (e) => estados.push(e),
    });
    await impresora.vincular();
    f.apagar();
    expect(impresora.estado()).toBe('desconectada');
    expect((await impresora.imprimir(recibo(10))).ok).toBe(true);
    expect(f.pedidos).toHaveLength(1);
    expect(estados).toEqual(['conectada', 'desconectada', 'conectada', 'ocupada', 'conectada']);
  });

  it('nunca manda bytes que no vengan de un trabajo', async () => {
    const f = pt210Falsa();
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth, esperar: sinEsperar });
    await impresora.vincular();
    f.apagar();
    await impresora.reconectar();
    expect(f.escrituras).toEqual([]);
  });

  it('una desconexión a mitad de recibo es «apagada o lejos», no un trozo más pequeño', async () => {
    let n = 0;
    const escribir = async () => {
      if (++n === 2) throw error('NetworkError');
    };
    await expect(
      enviarEnTrozos(escribir, recibo(500).bytes, TROZO_NORMAL, sinEsperar),
    ).rejects.toThrow('NetworkError');
    expect(n).toBe(2);
  });

  it('HTML no sale por Bluetooth', async () => {
    const f = pt210Falsa();
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth });
    await impresora.vincular();
    expect(await impresora.imprimir({ id: 'h', formato: 'html', html: '<p>' })).toMatchObject({
      ok: false,
      motivo: 'no_soportado',
    });
  });
});
