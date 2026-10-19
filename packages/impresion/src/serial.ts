/**
 * El adaptador Web Serial (PARQUEADERO §7.5, ADR-34, HU-Q2.4): la PT-210 emparejada una vez en el
 * teléfono (Bluetooth clásico, el perfil serie) o el puerto COM que Windows crea al emparejarla.
 *
 * - Vincula desde un toque con `requestPort()`. En la sesión siguiente `getPorts()` devuelve el
 *   puerto sin selector: la caja vuelve a encontrar la impresora sola (CA1).
 * - En Android no hay eventos de conexión: si escribir falla, cierra, abre otra vez y reintenta una
 *   vez antes de decir que no salió (CA2). Un recibo a medias no se repite.
 * - Nunca manda bytes para mantener despierta la impresora: podrían imprimir.
 */
import {
  type EstadoImpresora,
  FalloDeImpresora,
  type Impresora,
  type Resultado,
  type Trabajo,
  type Vinculo,
} from './contrato.ts';

/** El perfil serie estándar (SPP) de Bluetooth clásico. */
export const SERVICIO_SERIE = '00001101-0000-1000-8000-00805f9b34fb';

/** Lo mínimo de Web Serial que usa el adaptador; TypeScript no trae sus tipos. */
export interface InfoDePuerto {
  readonly usbVendorId?: number | undefined;
  readonly usbProductId?: number | undefined;
  readonly bluetoothServiceClassId?: string | number | undefined;
}
export interface PuertoSerie {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly writable: WritableStream<Uint8Array> | null;
  getInfo(): InfoDePuerto;
}
export interface SerialWeb {
  requestPort(o?: { allowedBluetoothServiceClassIds?: string[] }): Promise<PuertoSerie>;
  getPorts(): Promise<PuertoSerie[]>;
}

export interface OpcionesSerial {
  readonly serial: SerialWeb;
  /** Un puerto que el navegador ya dio permiso de usar (`getPorts`): se abre sin selector. */
  readonly puerto?: PuertoSerie | undefined;
  /** 9600 es lo de fábrica de la PT-210; por Bluetooth el número no cambia nada. */
  readonly baudios?: number;
  readonly alCambiarEstado?: (estado: EstadoImpresora) => void;
  readonly esperar?: (ms: number) => Promise<void>;
  readonly reloj?: () => number;
}

export interface ImpresoraSerial extends Impresora {
  diagnostico(): string;
}

/** Trozos chicos y una pausa: la PT-210 no pide parar, y un búfer lleno pierde bytes. */
export const TROZO_SERIE = { bytes: 256, ms: 15 } as const;

/** Cómo se llama el puerto para el cajero y para soporte. */
export function nombreDelPuerto(info: InfoDePuerto): { nombre: string; id: string } {
  if (info.bluetoothServiceClassId !== undefined) {
    return {
      nombre: 'Impresora emparejada por Bluetooth',
      id: `bt:${info.bluetoothServiceClassId}`,
    };
  }
  if (info.usbVendorId !== undefined) {
    const hex = (n: number | undefined) => (n ?? 0).toString(16).padStart(4, '0');
    return {
      nombre: 'Impresora por USB',
      id: `usb:${hex(info.usbVendorId)}:${hex(info.usbProductId)}`,
    };
  }
  return { nombre: 'Impresora en un puerto serie', id: 'serie' };
}

function detalleDe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function crearImpresoraSerial(opciones: OpcionesSerial): ImpresoraSerial {
  const esperar = opciones.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const reloj = opciones.reloj ?? (() => performance.now());
  const baudios = opciones.baudios ?? 9600;
  let puerto = opciones.puerto;
  let abierto = false;
  let estado: EstadoImpresora = 'sin_vincular';
  let ultimoError = '';
  /** El escritor del trabajo en curso, para cortarlo si la cola lo da por perdido. */
  let escritor: WritableStreamDefaultWriter<Uint8Array> | undefined;
  /**
   * El número del trabajo que puede escribir. `cancelar` lo sube: el que la cola dio por perdido
   * no manda un trozo más ni se reintenta, aunque otro haya empezado después.
   */
  let vigente = 0;
  const vistos: string[] = [];
  /** Lo último que pasó, para soporte; sin crecer sin fin en un turno largo. */
  const anotar = (v: string) => {
    vistos.push(v);
    if (vistos.length > 20) vistos.shift();
  };

  function cambiar(nuevo: EstadoImpresora): void {
    if (nuevo === estado) return;
    estado = nuevo;
    opciones.alCambiarEstado?.(nuevo);
  }

  async function cerrar(): Promise<void> {
    abierto = false;
    await puerto?.close().catch(() => undefined);
  }

  /** Abre el puerto; si ya estaba abierto o a medio cerrar, lo cierra antes. */
  async function abrir(): Promise<boolean> {
    if (!puerto) return false;
    cambiar('conectando');
    try {
      if (abierto) await cerrar();
      await puerto.open({ baudRate: baudios });
      abierto = true;
      cambiar('conectada');
      return true;
    } catch (error) {
      // `InvalidStateError`: el navegador lo tenía abierto de otra vez. Se cierra y se abre.
      if (error instanceof Error && error.name === 'InvalidStateError') {
        await cerrar();
        try {
          await puerto.open({ baudRate: baudios });
          abierto = true;
          cambiar('conectada');
          return true;
        } catch (otra) {
          ultimoError = detalleDe(otra);
        }
      } else {
        ultimoError = detalleDe(error);
      }
      anotar(`No abrió: ${ultimoError}`);
      cambiar('desconectada');
      return false;
    }
  }

  async function escribir(
    bytes: Uint8Array,
    salieron: { n: number },
    cortado: () => boolean,
  ): Promise<void> {
    const destino = puerto?.writable;
    if (!destino) throw new DOMException('El puerto no está abierto', 'InvalidStateError');
    const w = destino.getWriter();
    escritor = w;
    try {
      for (let i = 0; i < bytes.length; i += TROZO_SERIE.bytes) {
        if (cortado()) throw new DOMException('La cola lo dio por perdido', 'AbortError');
        await w.write(bytes.subarray(i, i + TROZO_SERIE.bytes));
        salieron.n++;
        if (i + TROZO_SERIE.bytes < bytes.length) await esperar(TROZO_SERIE.ms);
      }
    } finally {
      escritor = undefined;
      w.releaseLock();
    }
  }

  return {
    camino: 'serial',

    async vincular(): Promise<Vinculo> {
      try {
        // Sin filtros: en Windows el puerto COM del emparejamiento no dice que es Bluetooth.
        puerto = await opciones.serial.requestPort({
          allowedBluetoothServiceClassIds: [SERVICIO_SERIE],
        });
      } catch (error) {
        ultimoError = detalleDe(error);
        const cancelado = error instanceof Error && error.name === 'NotFoundError';
        throw new FalloDeImpresora(cancelado ? 'cancelado' : 'sin_permiso', ultimoError);
      }
      if (!(await abrir())) {
        throw new FalloDeImpresora(
          'fuera_de_alcance',
          `${ultimoError}. Revise que la impresora esté prendida y emparejada en el teléfono`,
        );
      }
      const { nombre, id } = nombreDelPuerto(puerto.getInfo());
      return { camino: 'serial', nombre, id };
    },

    async reconectar(forzar = false) {
      if (!puerto) return false;
      if (abierto && !forzar) return true;
      return abrir();
    },

    async imprimir(trabajo: Trabajo): Promise<Resultado> {
      if (trabajo.formato !== 'escpos') {
        return {
          ok: false,
          motivo: 'no_soportado',
          detalle: 'Por el puerto serie solo salen bytes ESC/POS',
        };
      }
      if (!puerto)
        return { ok: false, motivo: 'sin_permiso', detalle: 'Falta conectar la impresora' };
      if (!abierto && !(await abrir())) {
        return {
          ok: false,
          motivo: 'fuera_de_alcance',
          detalle: ultimoError || 'No abrió el puerto',
        };
      }
      const inicio = reloj();
      const salieron = { n: 0 };
      const mio = ++vigente;
      const cortado = () => mio !== vigente;
      cambiar('ocupada');
      try {
        try {
          await escribir(trabajo.bytes, salieron, cortado);
        } catch (error) {
          // Android no avisa que la impresora se apagó: se nota al escribir (CA2).
          if (salieron.n > 0 || cortado()) throw error;
          anotar(`Al imprimir: ${detalleDe(error)}; se abre otra vez y se reintenta una vez`);
          if (!(await abrir())) throw error;
          cambiar('ocupada');
          await escribir(trabajo.bytes, salieron, cortado);
        }
      } catch (error) {
        // Ya cortado, el puerto es de quien siguió: este trabajo no lo cierra ni cambia el estado.
        if (cortado()) return { ok: false, motivo: 'tiempo', detalle: 'Se cortó por tiempo' };
        ultimoError = detalleDe(error);
        await cerrar();
        cambiar('desconectada');
        return { ok: false, motivo: 'fuera_de_alcance', detalle: ultimoError };
      }
      if (cortado()) return { ok: false, motivo: 'tiempo', detalle: 'Se cortó por tiempo' };
      cambiar('conectada');
      return {
        ok: true,
        bytes: trabajo.bytes.length,
        ms: Math.round(reloj() - inicio),
        papel: 'desconocido',
      };
    },

    soltar() {
      void cerrar();
    },

    cancelar() {
      // `abort` descarta lo que el navegador tenía por mandar; cerrar suelta el puerto colgado.
      vigente++;
      anotar('La cola lo dio por perdido: se cortó lo que faltaba por mandar');
      const w = escritor;
      escritor = undefined;
      void (w ? w.abort().catch(() => undefined) : Promise.resolve()).then(cerrar);
      cambiar('desconectada');
    },

    estado: () => estado,

    diagnostico(): string {
      const info = puerto ? nombreDelPuerto(puerto.getInfo()) : null;
      return [
        `Impresora: ${info ? `${info.nombre} (${info.id})` : 'sin vincular'}`,
        'Camino: puerto serie',
        `Estado: ${estado}`,
        `Baudios: ${baudios}`,
        `Trozo: ${TROZO_SERIE.bytes} bytes cada ${TROZO_SERIE.ms} ms`,
        'Visto:',
        ...(vistos.length ? vistos.map((v) => `  ${v}`) : ['  -']),
        `Último error: ${ultimoError || '-'}`,
      ].join('\n');
    },
  };
}

/** El puerto que el navegador ya dejó usar, para abrir la caja sin selector (CA1). */
export async function puertoRecordado(
  serial: SerialWeb,
  id: string,
): Promise<PuertoSerie | undefined> {
  const puertos = await serial.getPorts().catch(() => [] as PuertoSerie[]);
  return puertos.find((p) => nombreDelPuerto(p.getInfo()).id === id) ?? puertos[0];
}
