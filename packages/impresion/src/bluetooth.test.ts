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
    gatt,
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
                connected: true,
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

describe('las PT-210 que escriben por otro servicio', () => {
  /** Un equipo con un solo servicio, `uuid`, y una característica de escritura. */
  const conServicio = (uuid: string | number, visibles: string[] = []): BluetoothBle => {
    const caracteristica = {
      uuid: 'escritura',
      properties: { write: true, writeWithoutResponse: false, notify: false },
      writeValueWithoutResponse: async () => undefined,
      writeValueWithResponse: async () => undefined,
    };
    const gatt: ServidorGatt = {
      connected: true,
      connect: async () => gatt,
      getPrimaryService: async (s) => {
        if (s !== uuid) throw error('NotFoundError');
        return { uuid: String(uuid), getCharacteristics: async () => [caracteristica] };
      },
      getPrimaryServices: async () =>
        visibles.map((v) => ({ uuid: v, getCharacteristics: async () => [] })),
    };
    return {
      requestDevice: async (o) => {
        // Web Bluetooth solo deja ver lo que se pidió en optionalServices.
        if (!o.optionalServices.includes(uuid))
          gatt.getPrimaryService = () => Promise.reject(error('SecurityError'));
        return { id: 'pt', name: 'PT-210', gatt, addEventListener: () => undefined };
      },
    };
  };

  it.each([0xae30, 0xffe0, 0xfff0])('la que escribe por %s se reconoce', async (uuid) => {
    const v = await crearImpresoraBluetooth({ bluetooth: conServicio(uuid) }).vincular();
    expect(v.servicio).toBe(String(uuid));
  });

  it('si suelta la conexión mientras busca, reconecta y la encuentra (PT210L)', async () => {
    const caracteristica = {
      uuid: '00002af1-0000-1000-8000-00805f9b34fb',
      properties: { write: true, writeWithoutResponse: true, notify: false },
      writeValueWithoutResponse: async () => undefined,
      writeValueWithResponse: async () => undefined,
    };
    let conexiones = 0;
    const gatt: ServidorGatt = {
      get connected() {
        return conexiones > 1;
      },
      connect: async () => {
        conexiones++;
        return gatt;
      },
      getPrimaryService: async (s) => {
        if (conexiones < 2) throw error('NetworkError');
        if (s !== 0x18f0) throw error('NotFoundError');
        return {
          uuid: '000018f0-0000-1000-8000-00805f9b34fb',
          getCharacteristics: async () => [caracteristica],
        };
      },
    };
    const impresora = crearImpresoraBluetooth({
      bluetooth: {
        requestDevice: async () => ({
          id: 'pt',
          name: 'PT210L_30F2',
          gatt,
          addEventListener: () => undefined,
        }),
      },
      esperar: sinEsperar,
    });
    const v = await impresora.vincular();
    expect(v.caracteristica).toBe(caracteristica.uuid);
    expect(impresora.diagnostico()).toContain('0x18f0: NetworkError');
  });

  /** Una PT210L recién prendida en Android: la conexión se cae `caidas` veces antes de quedarse. */
  function seCaeAlConectar(caidas: number) {
    const caracteristica = {
      uuid: '00002af1-0000-1000-8000-00805f9b34fb',
      properties: { write: true, writeWithoutResponse: true, notify: false },
      writeValueWithoutResponse: async () => undefined,
      writeValueWithResponse: async () => undefined,
    };
    let conexiones = 0;
    const consultas: (string | number)[] = [];
    const pausas: number[] = [];
    const gatt: ServidorGatt = {
      get connected() {
        return conexiones > caidas;
      },
      connect: async () => {
        conexiones++;
        return gatt;
      },
      getPrimaryService: async (s) => {
        consultas.push(s);
        if (conexiones <= caidas) {
          throw error('NetworkError', 'GATT Server is disconnected. Cannot retrieve services.');
        }
        if (s !== 0x18f0) throw error('NotFoundError');
        return {
          uuid: '000018f0-0000-1000-8000-00805f9b34fb',
          getCharacteristics: async () => [caracteristica],
        };
      },
    };
    const impresora = crearImpresoraBluetooth({
      bluetooth: {
        requestDevice: async () => ({
          id: 'pt',
          name: 'PT210L_30F2',
          gatt,
          addEventListener: () => undefined,
        }),
      },
      esperar: async (ms) => {
        pausas.push(ms);
      },
    });
    return { impresora, consultas, pausas, conexiones: () => conexiones };
  }

  it('si la conexión se cae apenas abre, espera y lo intenta otra vez, hasta 4 veces (bitácora 17)', async () => {
    const p = seCaeAlConectar(3);
    const v = await p.impresora.vincular();
    expect(v.servicio).toBe(String(0x18f0));
    expect(p.conexiones()).toBe(4);
    expect(p.pausas).toEqual([1_000, 2_000, 3_000]);
    // Desconectada, no pregunta por los otros ocho servicios: cada caída cuesta una consulta.
    expect(p.consultas.slice(0, 3)).toEqual([0x18f0, 0x18f0, 0x18f0]);
    expect(p.impresora.diagnostico()).toContain('Intento 3: se desconectó al buscar los servicios');
  });

  it('si se cae en los 4 intentos, dice «apagada o lejos», no «no se reconoce» (CA ❌)', async () => {
    const p = seCaeAlConectar(10);
    const fallo = await p.impresora.vincular().catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(FalloDeImpresora);
    expect((fallo as FalloDeImpresora).motivo).toBe('fuera_de_alcance');
    expect((fallo as FalloDeImpresora).message).toContain('Apague y prenda el Bluetooth');
    expect(p.conexiones()).toBe(4);
    expect(p.impresora.estado()).toBe('sin_vincular');
  });

  it('un servicio que no entrega sus características no tumba la búsqueda', async () => {
    const buena = {
      uuid: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
      properties: { write: true, writeWithoutResponse: false, notify: true },
      writeValueWithoutResponse: async () => undefined,
      writeValueWithResponse: async () => undefined,
    };
    const gatt: ServidorGatt = {
      connected: true,
      connect: async () => gatt,
      getPrimaryService: async (s) => {
        if (s === 0x18f0) {
          return { uuid: '18f0', getCharacteristics: () => Promise.reject(error('NotFoundError')) };
        }
        if (s === 'e7810a71-73ae-499d-8c15-faa9aef0c3f2') {
          return { uuid: String(s), getCharacteristics: async () => [buena] };
        }
        throw error('NotFoundError');
      },
    };
    const impresora = crearImpresoraBluetooth({
      bluetooth: {
        requestDevice: async () => ({
          id: 'pt',
          name: 'PT210L',
          gatt,
          addEventListener: () => undefined,
        }),
      },
    });
    expect((await impresora.vincular()).caracteristica).toBe(buena.uuid);
    expect(impresora.diagnostico()).toContain('18f0: sin características (NotFoundError');
  });

  it('si no se reconoce, el diagnóstico dice el equipo y los servicios que se ven', async () => {
    const impresora = crearImpresoraBluetooth({
      bluetooth: conServicio(0x1234, ['0000abcd-0000-1000-8000-00805f9b34fb']),
    });
    const fallo = (await impresora.vincular().catch((e: unknown) => e)) as FalloDeImpresora;
    expect(fallo.motivo).toBe('sin_caracteristica');
    const d = impresora.diagnostico();
    expect(d).toContain('Impresora: PT-210 (sin usar)');
    expect(d).toContain('Servicios visibles: 0000abcd-0000-1000-8000-00805f9b34fb');
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
    expect(estados).toEqual([
      'conectando',
      'conectada',
      'desconectada',
      'conectando',
      'conectada',
      'ocupada',
      'conectada',
    ]);
  });

  /** Envuelve `connect()` de la falsa para contar o cambiar lo que hace. */
  function conConnect(
    f: ReturnType<typeof pt210Falsa>,
    connect: (original: () => Promise<ServidorGatt>) => Promise<ServidorGatt>,
  ) {
    const original = f.gatt.connect.bind(f.gatt);
    Object.assign(f.gatt, { connect: () => connect(original) });
  }

  it('antes de reconectar suelta la conexión vieja de Android (bitácora 18)', async () => {
    const f = pt210Falsa();
    const orden: string[] = [];
    conConnect(f, (original) => {
      orden.push('connect');
      return original();
    });
    Object.assign(f.gatt, { disconnect: () => orden.push('disconnect') });
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth, esperar: sinEsperar });
    await impresora.vincular();
    f.apagar();
    orden.length = 0;
    expect((await impresora.imprimir(recibo(10))).ok).toBe(true);
    expect(orden).toEqual(['disconnect', 'connect']);
  });

  it('un connect() que no responde se corta y se intenta otra vez (bitácora 18)', async () => {
    const f = pt210Falsa();
    let llamadas = 0;
    // El primero se queda esperando, como un Android con la conexión vieja.
    conConnect(f, (original) =>
      ++llamadas === 1 ? new Promise<ServidorGatt>(() => undefined) : original(),
    );
    const impresora = crearImpresoraBluetooth({
      bluetooth: f.bluetooth,
      esperar: sinEsperar,
      msPorIntento: 5,
    });
    await impresora.vincular();
    expect(llamadas).toBe(2);
    expect(impresora.diagnostico()).toContain('Intento 1: no conectó (TimeoutError');
  });

  it('dos reconexiones a la vez abren una sola conexión', async () => {
    const f = pt210Falsa();
    let llamadas = 0;
    // Como en un teléfono, la conexión tarda: mientras tanto `connected` sigue en falso.
    conConnect(f, async (original) => {
      llamadas++;
      await new Promise((r) => setTimeout(r, 1));
      return original();
    });
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth, esperar: sinEsperar });
    await impresora.vincular();
    f.apagar();
    llamadas = 0;
    const [a, b] = await Promise.all([impresora.reconectar(), impresora.imprimir(recibo(10))]);
    expect(a).toBe(true);
    expect(b.ok).toBe(true);
    expect(llamadas).toBe(1);
  });

  it('si no reconecta, queda «desconectada», nunca «conectando»', async () => {
    const f = pt210Falsa();
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth, esperar: sinEsperar });
    await impresora.vincular();
    f.apagar();
    conConnect(f, () => Promise.reject(error('NetworkError', 'apagada')));
    const r = await impresora.imprimir(recibo(10));
    expect(r).toMatchObject({ ok: false, motivo: 'fuera_de_alcance' });
    expect(impresora.estado()).toBe('desconectada');
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

  /** Una falsa cuya conexión dice estar abierta y está muerta, como al desbloquear el teléfono. */
  function muertaAlVolver(fallos: number[]) {
    const f = pt210Falsa();
    const orden: string[] = [];
    let n = 0;
    const impresora = crearImpresoraBluetooth({ bluetooth: f.bluetooth, esperar: sinEsperar });
    return {
      f,
      orden,
      impresora,
      async armar() {
        await impresora.vincular();
        const caracteristica = (
          await (await f.gatt.getPrimaryService(PT210)).getCharacteristics()
        )[1];
        const original = caracteristica?.writeValueWithoutResponse.bind(caracteristica);
        Object.assign(caracteristica ?? {}, {
          writeValueWithoutResponse: (d: Uint8Array) => {
            n++;
            if (fallos.includes(n))
              return Promise.reject(error('NetworkError', 'GATT operation failed'));
            return original?.(d);
          },
        });
        Object.assign(f.gatt, { disconnect: () => orden.push('disconnect') });
      },
    };
  }

  it('si el primer trozo falla con la conexión «abierta», reconecta y reimprime una vez (bitácora 19)', async () => {
    const m = muertaAlVolver([1]);
    await m.armar();
    const r = await m.impresora.imprimir(recibo(250));
    expect(r.ok).toBe(true);
    expect(m.orden).toContain('disconnect');
    expect(unir(m.f.escrituras)).toEqual(recibo(250).bytes);
    expect(m.impresora.diagnostico()).toContain('se reconecta y se reintenta una vez');
  });

  it('si falla a mitad del recibo, no lo repite: un papel a medias no sale dos veces', async () => {
    const m = muertaAlVolver([2]);
    await m.armar();
    const r = await m.impresora.imprimir(recibo(250));
    expect(r).toMatchObject({ ok: false, motivo: 'fuera_de_alcance' });
    expect(m.orden).toEqual([]);
    expect(m.f.escrituras).toHaveLength(1);
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
