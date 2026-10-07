/**
 * El adaptador Web Bluetooth (PARQUEADERO §7.4, HU-Q2.3). Recibe `navigator.bluetooth` como
 * parámetro: en la caja es el del navegador, en las pruebas un falso que rechaza trozos grandes.
 *
 * - Vincula solo desde un toque y recorre los servicios en orden: toma la primera característica
 *   con `writeWithoutResponse` o, si no hay, `write`.
 * - Envía en trozos de 180 bytes cada 30 ms. Si el navegador rechaza un trozo, baja a 100 bytes y
 *   50 ms, reintenta y lo recuerda (`alCambiarTrozo`).
 * - Mientras la caja siga abierta, reconecta con `gatt.connect()` antes de imprimir, sin selector.
 * - Nunca manda bytes para mantener despierta la impresora: podrían imprimir.
 */
import {
  type EstadoImpresora,
  FalloDeImpresora,
  type Impresora,
  type MotivoDeFallo,
  type Resultado,
  type Trabajo,
  type Vinculo,
} from './contrato.ts';

/** PT-210 según el SDK no oficial, otras revisiones del firmware y térmicas genéricas (§7.4). */
export const SERVICIOS_DE_IMPRESORA: readonly (string | number)[] = [
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  0xff00,
  0x18f0,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

export interface Trozo {
  readonly bytes: number;
  readonly ms: number;
}

export const TROZO_NORMAL: Trozo = { bytes: 180, ms: 30 };
export const TROZO_PEQUENO: Trozo = { bytes: 100, ms: 50 };

// Lo mínimo de Web Bluetooth que usa el adaptador; TypeScript no trae sus tipos.
export interface PropiedadesBle {
  readonly write: boolean;
  readonly writeWithoutResponse: boolean;
  readonly notify: boolean;
}
export interface CaracteristicaBle {
  readonly uuid: string;
  readonly properties: PropiedadesBle;
  writeValueWithoutResponse(datos: Uint8Array): Promise<void>;
  writeValueWithResponse(datos: Uint8Array): Promise<void>;
}
export interface ServicioBle {
  readonly uuid: string;
  getCharacteristics(): Promise<CaracteristicaBle[]>;
}
export interface ServidorGatt {
  readonly connected: boolean;
  connect(): Promise<ServidorGatt>;
  getPrimaryService(servicio: string | number): Promise<ServicioBle>;
}
export interface DispositivoBle {
  readonly id: string;
  readonly name?: string | undefined;
  readonly gatt?: ServidorGatt | undefined;
  addEventListener(tipo: 'gattserverdisconnected', oyente: () => void): void;
}
export interface BluetoothBle {
  requestDevice(opciones: {
    filters?: ({ namePrefix: string } | { services: (string | number)[] })[];
    acceptAllDevices?: boolean;
    optionalServices: (string | number)[];
  }): Promise<DispositivoBle>;
}

export interface OpcionesBluetooth {
  readonly bluetooth: BluetoothBle;
  /** «Ver todos los equipos»: la impresora anuncia otro nombre. */
  readonly verTodos?: boolean;
  /** El trozo que la caja recordó de una impresión anterior. */
  readonly trozo?: Trozo;
  readonly alCambiarTrozo?: (trozo: Trozo) => void;
  /** La cabecera lo muestra (§7.4 paso 4). */
  readonly alCambiarEstado?: (estado: EstadoImpresora) => void;
  readonly esperar?: (ms: number) => Promise<void>;
  readonly reloj?: () => number;
}

export interface ImpresoraBluetooth extends Impresora {
  /** Para Ajustes › Impresora › Diagnóstico: se copia como texto para soporte (§7.4 paso 6). */
  diagnostico(): string;
}

function nombreDelError(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function detalleDe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Los errores del navegador en motivos (§7.4 paso 5). */
export function motivoDelError(error: unknown, alElegir: boolean): MotivoDeFallo {
  switch (nombreDelError(error)) {
    case 'NotFoundError':
      return alElegir ? 'cancelado' : 'sin_caracteristica';
    case 'SecurityError':
    case 'NotAllowedError':
      return 'sin_permiso';
    case 'NotSupportedError':
      return 'no_soportado';
    case 'TimeoutError':
      return 'tiempo';
    default:
      return 'fuera_de_alcance';
  }
}

/**
 * Manda `bytes` en trozos. Si un trozo se rechaza por algo que no es una desconexión, baja una vez a
 * `TROZO_PEQUENO` y reintenta el mismo trozo. Devuelve el trozo con que terminó.
 */
export async function enviarEnTrozos(
  escribir: (datos: Uint8Array) => Promise<void>,
  bytes: Uint8Array,
  inicial: Trozo,
  esperar: (ms: number) => Promise<void>,
): Promise<Trozo> {
  let trozo = inicial;
  let i = 0;
  while (i < bytes.length) {
    const parte = bytes.subarray(i, i + trozo.bytes);
    try {
      await escribir(parte);
    } catch (error) {
      if (nombreDelError(error) === 'NetworkError' || trozo.bytes <= TROZO_PEQUENO.bytes)
        throw error;
      trozo = TROZO_PEQUENO;
      continue;
    }
    i += parte.length;
    if (i < bytes.length) await esperar(trozo.ms);
  }
  return trozo;
}

interface Conexion {
  readonly dispositivo: DispositivoBle;
  servicio: string | number;
  caracteristica: CaracteristicaBle;
}

export function crearImpresoraBluetooth(opciones: OpcionesBluetooth): ImpresoraBluetooth {
  const esperar = opciones.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const reloj = opciones.reloj ?? (() => performance.now());
  let trozo = opciones.trozo ?? TROZO_NORMAL;
  let estado: EstadoImpresora = 'sin_vincular';
  let conexion: Conexion | undefined;
  const vistos: string[] = [];
  let ultimoError = '';

  function cambiar(nuevo: EstadoImpresora): void {
    if (nuevo === estado) return;
    estado = nuevo;
    opciones.alCambiarEstado?.(nuevo);
  }

  /** Recorre los servicios en orden y toma la primera característica donde se puede escribir. */
  async function buscar(
    gatt: ServidorGatt,
    soloEste?: string | number,
  ): Promise<{ servicio: string | number; caracteristica: CaracteristicaBle } | undefined> {
    vistos.length = 0;
    for (const s of soloEste === undefined ? SERVICIOS_DE_IMPRESORA : [soloEste]) {
      let servicio: ServicioBle;
      try {
        servicio = await gatt.getPrimaryService(s);
      } catch {
        continue; // Este equipo no tiene ese servicio.
      }
      const caracteristicas = await servicio.getCharacteristics();
      for (const c of caracteristicas) {
        const p = c.properties;
        vistos.push(
          `${servicio.uuid} › ${c.uuid}: ${[p.write && 'write', p.writeWithoutResponse && 'writeWithoutResponse', p.notify && 'notify'].filter(Boolean).join(', ') || 'sin escritura'}`,
        );
      }
      const elegida =
        caracteristicas.find((c) => c.properties.writeWithoutResponse) ??
        caracteristicas.find((c) => c.properties.write);
      if (elegida) return { servicio: s, caracteristica: elegida };
    }
    return undefined;
  }

  async function reconectar(): Promise<boolean> {
    if (!conexion?.dispositivo.gatt) return false;
    try {
      const gatt = await conexion.dispositivo.gatt.connect();
      const hallado = await buscar(gatt, conexion.servicio);
      if (!hallado) return false;
      conexion.caracteristica = hallado.caracteristica;
      cambiar('conectada');
      return true;
    } catch (error) {
      ultimoError = detalleDe(error);
      cambiar('desconectada');
      return false;
    }
  }

  return {
    camino: 'bluetooth',

    async vincular(): Promise<Vinculo> {
      let dispositivo: DispositivoBle;
      const optionalServices = [...SERVICIOS_DE_IMPRESORA];
      try {
        dispositivo = await opciones.bluetooth.requestDevice(
          opciones.verTodos
            ? { acceptAllDevices: true, optionalServices }
            : {
                filters: [
                  { namePrefix: 'PT' },
                  ...optionalServices.map((s) => ({ services: [s] })),
                ],
                optionalServices,
              },
        );
      } catch (error) {
        ultimoError = detalleDe(error);
        throw new FalloDeImpresora(motivoDelError(error, true), ultimoError);
      }
      if (!dispositivo.gatt) {
        throw new FalloDeImpresora('no_soportado', 'El equipo no ofrece GATT');
      }
      let hallado: Awaited<ReturnType<typeof buscar>>;
      try {
        hallado = await buscar(await dispositivo.gatt.connect());
      } catch (error) {
        ultimoError = detalleDe(error);
        throw new FalloDeImpresora(motivoDelError(error, false), ultimoError);
      }
      if (!hallado) {
        ultimoError = 'Ningún servicio conocido tiene una característica de escritura';
        throw new FalloDeImpresora('sin_caracteristica', ultimoError);
      }
      conexion = { dispositivo, ...hallado };
      dispositivo.addEventListener('gattserverdisconnected', () => cambiar('desconectada'));
      cambiar('conectada');
      return {
        camino: 'bluetooth',
        nombre: dispositivo.name ?? 'Sin nombre',
        id: dispositivo.id,
        servicio: String(hallado.servicio),
        caracteristica: hallado.caracteristica.uuid,
      };
    },

    reconectar,

    async imprimir(trabajo: Trabajo): Promise<Resultado> {
      if (trabajo.formato !== 'escpos') {
        return {
          ok: false,
          motivo: 'no_soportado',
          detalle: 'Por Bluetooth solo salen bytes ESC/POS',
        };
      }
      if (!conexion)
        return { ok: false, motivo: 'sin_permiso', detalle: 'Falta conectar la impresora' };
      if (!conexion.dispositivo.gatt?.connected && !(await reconectar())) {
        return { ok: false, motivo: 'fuera_de_alcance', detalle: ultimoError || 'No reconectó' };
      }
      const { caracteristica } = conexion;
      const escribir = caracteristica.properties.writeWithoutResponse
        ? (d: Uint8Array) => caracteristica.writeValueWithoutResponse(d)
        : (d: Uint8Array) => caracteristica.writeValueWithResponse(d);
      const inicio = reloj();
      cambiar('ocupada');
      try {
        const final = await enviarEnTrozos(escribir, trabajo.bytes, trozo, esperar);
        if (final !== trozo) {
          trozo = final;
          opciones.alCambiarTrozo?.(final);
        }
      } catch (error) {
        ultimoError = detalleDe(error);
        cambiar(conexion.dispositivo.gatt?.connected ? 'conectada' : 'desconectada');
        return { ok: false, motivo: motivoDelError(error, false), detalle: ultimoError };
      }
      cambiar('conectada');
      return {
        ok: true,
        bytes: trabajo.bytes.length,
        ms: Math.round(reloj() - inicio),
        papel: 'desconocido',
      };
    },

    estado: () => estado,

    diagnostico(): string {
      return [
        `Impresora: ${conexion?.dispositivo.name ?? 'sin vincular'}`,
        `Id: ${conexion?.dispositivo.id ?? '-'}`,
        `Estado: ${estado}`,
        `Escribe en: ${conexion ? `${String(conexion.servicio)} › ${conexion.caracteristica.uuid}` : '-'}`,
        `Trozo: ${trozo.bytes} bytes cada ${trozo.ms} ms`,
        'Características:',
        ...(vistos.length ? vistos.map((v) => `  ${v}`) : ['  -']),
        `Último error: ${ultimoError || '-'}`,
      ].join('\n');
    },
  };
}
