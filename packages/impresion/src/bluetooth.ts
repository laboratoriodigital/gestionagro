/**
 * El adaptador Web Bluetooth (PARQUEADERO §7.4, HU-Q2.3). Recibe `navigator.bluetooth` como
 * parámetro: en la caja es el del navegador, en las pruebas un falso que rechaza trozos grandes.
 *
 * - Vincula solo desde un toque y recorre los servicios en orden: toma la primera característica
 *   con `writeWithoutResponse` o, si no hay, `write`.
 * - Envía en trozos de 180 bytes cada 30 ms. Si el navegador rechaza un trozo, baja a 100 bytes y
 *   50 ms, reintenta y lo recuerda (`alCambiarTrozo`).
 * - Mientras la caja siga abierta, reconecta con `gatt.connect()` antes de imprimir, sin selector.
 * - Si la conexión se cae apenas abre (Android, después de apagar y prender la impresora), lo
 *   intenta hasta 4 veces, con 1, 2 y 3 s de pausa (bitácora parqueadero 17).
 * - Antes de cada intento suelta la conexión vieja, y corta el que no responde en 6 s: un
 *   `connect()` de Android puede quedarse esperando sin fin (bitácora parqueadero 18).
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

/**
 * PT-210 según el SDK no oficial, otras revisiones del firmware y térmicas genéricas (§7.4). Web
 * Bluetooth solo deja ver los servicios que se nombran aquí: una PT-210 de campo que escribe por
 * otro (la primera prueba del 7 oct 2026 dijo «no se reconoce») queda muda aunque se vincule. Los
 * últimos cinco son los de los módulos BLE de las térmicas baratas (bitácora parqueadero 12).
 */
export const SERVICIOS_DE_IMPRESORA: readonly (string | number)[] = [
  // La PT210L de la prueba de campo anuncia estos dos (nRF Connect, 7 oct 2026): van primero.
  0x18f0,
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  0xff00,
  0xae30,
  0xffe0,
  0xfff0,
  0xfee7,
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
];

export interface Trozo {
  readonly bytes: number;
  readonly ms: number;
}

/** Las pausas entre un intento de conexión y el siguiente: 4 intentos en total. */
export const PAUSAS_ENTRE_INTENTOS: readonly number[] = [1_000, 2_000, 3_000];
/** Cuánto se espera un `connect()`. Con los 4 intentos y sus pausas, a lo sumo 30 s. */
export const MS_POR_INTENTO = 6_000;

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
  /** Suelta la conexión y corta un `connect()` pendiente. No hace nada si no hay conexión. */
  disconnect?(): void;
  getPrimaryService(servicio: string | number): Promise<ServicioBle>;
  /** Los servicios que el permiso deja ver; para el diagnóstico. */
  getPrimaryServices?(): Promise<ServicioBle[]>;
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
  /** Para las pruebas; en la caja, `MS_POR_INTENTO`. */
  readonly msPorIntento?: number;
}

export interface ImpresoraBluetooth extends Impresora {
  /** Para Ajustes › Impresora › Diagnóstico: se copia como texto para soporte (§7.4 paso 6). */
  diagnostico(): string;
}

function nombreDelError(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

/** `0x18f0` en vez de `6384`: como lo muestra nRF Connect. */
const nombreDeServicio = (s: string | number): string =>
  typeof s === 'number' ? `0x${s.toString(16).padStart(4, '0')}` : s;

function detalleDe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** La promesa, o un `TimeoutError` si no termina en `ms`. */
function conPlazo<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const plazo = new Promise<never>((_, rechazar) => {
    reloj = setTimeout(
      () => rechazar(new DOMException(`Sin respuesta en ${ms / 1000} s`, 'TimeoutError')),
      ms,
    );
  });
  return Promise.race([promesa, plazo]).finally(() => clearTimeout(reloj));
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
  const msPorIntento = opciones.msPorIntento ?? MS_POR_INTENTO;
  let trozo = opciones.trozo ?? TROZO_NORMAL;
  let estado: EstadoImpresora = 'sin_vincular';
  let conexion: Conexion | undefined;
  const vistos: string[] = [];
  let ultimoError = '';
  /** El nombre del último equipo elegido, aunque no se haya podido usar. */
  let nombre = '';
  /**
   * Cada cambio de estado con los segundos desde que se creó el adaptador: dice cuándo se cayó la
   * conexión y qué pasaba antes (bitácora parqueadero 21). Las últimas 30.
   */
  const inicioDeSesion = reloj();
  const lineaDeTiempo: string[] = [];
  const marcar = (que: string) => {
    lineaDeTiempo.push(`+${Math.round((reloj() - inicioDeSesion) / 1000)} s ${que}`);
    if (lineaDeTiempo.length > 30) lineaDeTiempo.shift();
  };

  function cambiar(nuevo: EstadoImpresora): void {
    if (nuevo === estado) return;
    estado = nuevo;
    marcar(nuevo);
    opciones.alCambiarEstado?.(nuevo);
  }

  /** Recorre los servicios en orden y toma la primera característica donde se puede escribir. */
  async function buscar(
    gatt: ServidorGatt,
    soloEste?: string | number,
  ): Promise<{ servicio: string | number; caracteristica: CaracteristicaBle } | undefined> {
    for (const s of soloEste === undefined ? SERVICIOS_DE_IMPRESORA : [soloEste]) {
      let servicio: ServicioBle;
      try {
        servicio = await gatt.getPrimaryService(s);
      } catch (error) {
        // Este equipo no tiene ese servicio, o se desconectó buscándolo: el diagnóstico lo dice.
        if (nombreDelError(error) !== 'NotFoundError')
          vistos.push(`${nombreDeServicio(s)}: ${detalleDe(error)}`);
        // Desconectada, ningún otro servicio va a responder: se reintenta la conexión.
        if (!gatt.connected) return undefined;
        continue;
      }
      let caracteristicas: CaracteristicaBle[];
      try {
        caracteristicas = await servicio.getCharacteristics();
      } catch (error) {
        vistos.push(`${servicio.uuid}: sin características (${detalleDe(error)})`);
        continue;
      }
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

  /**
   * Conecta y busca la característica. Si la conexión se cae antes de encontrarla, espera y lo
   * intenta otra vez; si sigue conectada y no la encuentra, el equipo no es una impresora conocida.
   * Lanza el error del último `connect()` que falló.
   */
  async function conectarYBuscar(
    gattDelEquipo: ServidorGatt,
    soloEste?: string | number,
  ): Promise<Awaited<ReturnType<typeof buscar>>> {
    vistos.length = 0;
    cambiar('conectando');
    for (let intento = 0; ; intento++) {
      // Android puede quedarse con una conexión que ya no sirve: se suelta antes de abrir otra, y
      // eso también corta el `connect()` que no respondió (bitácora parqueadero 18).
      if (!gattDelEquipo.connected) gattDelEquipo.disconnect?.();
      let gatt: ServidorGatt | undefined;
      try {
        gatt = await conPlazo(gattDelEquipo.connect(), msPorIntento);
      } catch (error) {
        vistos.push(`Intento ${intento + 1}: no conectó (${detalleDe(error)})`);
        if (intento >= PAUSAS_ENTRE_INTENTOS.length) {
          gattDelEquipo.disconnect?.();
          throw error;
        }
      }
      if (gatt) {
        const hallado = await buscar(gatt, soloEste);
        if (hallado || gatt.connected) return hallado;
        vistos.push(`Intento ${intento + 1}: se desconectó al buscar los servicios`);
      }
      const pausa = PAUSAS_ENTRE_INTENTOS[intento];
      if (pausa === undefined) return undefined;
      await esperar(pausa);
    }
  }

  async function intentarReconectar(actual: Conexion, gatt: ServidorGatt): Promise<boolean> {
    try {
      const hallado = await conectarYBuscar(gatt, actual.servicio);
      if (hallado) {
        actual.caracteristica = hallado.caracteristica;
        cambiar('conectada');
        return true;
      }
      ultimoError = 'La conexión se cayó en todos los intentos';
    } catch (error) {
      ultimoError = detalleDe(error);
    }
    cambiar('desconectada');
    return false;
  }

  /**
   * Un toque en «Reconectar» mientras imprime no abre una segunda conexión: espera la misma.
   * `forzar` suelta antes la que el navegador cree abierta: después de bloquear el teléfono puede
   * decir `connected` y estar muerta (bitácora parqueadero 19).
   */
  let reconectando: Promise<boolean> | undefined;
  function reconectar(forzar = false): Promise<boolean> {
    const gatt = conexion?.dispositivo.gatt;
    if (!conexion || !gatt) return Promise.resolve(false);
    if (forzar && !reconectando) gatt.disconnect?.();
    reconectando ??= intentarReconectar(conexion, gatt).finally(() => {
      reconectando = undefined;
    });
    return reconectando;
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
        // Un equipo ya emparejado, o recién prendido, puede soltar la conexión GATT mientras se
        // recorren sus servicios: se reconecta con pausas (bitácora parqueadero 13 y 17).
        hallado = await conectarYBuscar(dispositivo.gatt);
      } catch (error) {
        ultimoError = detalleDe(error);
        cambiar('sin_vincular');
        throw new FalloDeImpresora(motivoDelError(error, false), ultimoError);
      }
      if (!hallado) {
        // Nunca queda «conectando»: la cabecera esperaría para siempre.
        cambiar('sin_vincular');
        nombre = dispositivo.name ?? 'Sin nombre';
        const visibles = await dispositivo.gatt
          .getPrimaryServices?.()
          .then((ss) => ss.map((x) => x.uuid).join(', '))
          .catch(() => '');
        // Se cayó en todos los intentos: no es que no se reconozca (bitácora parqueadero 17).
        if (!dispositivo.gatt.connected) {
          ultimoError = `La conexión se cayó en los ${PAUSAS_ENTRE_INTENTOS.length + 1} intentos. Apague y prenda el Bluetooth del teléfono, y cierre otra app conectada a la impresora`;
          throw new FalloDeImpresora('fuera_de_alcance', ultimoError);
        }
        ultimoError = `Ningún servicio conocido tiene una característica de escritura. Servicios visibles: ${visibles || 'ninguno'}`;
        throw new FalloDeImpresora('sin_caracteristica', ultimoError);
      }
      conexion = { dispositivo, ...hallado };
      // Mientras reintenta, cada caída es parte del intento: la cabecera sigue en «conectando».
      dispositivo.addEventListener('gattserverdisconnected', () => {
        if (estado !== 'conectando') cambiar('desconectada');
      });
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

    /**
     * Al cerrar o recargar la caja: suelta la conexión a propósito. Si no, Android puede dejarla
     * viva sin dueño, la impresora sigue «conectada» y la caja nueva no entra (bitácora 21).
     */
    soltar() {
      if (!conexion?.dispositivo.gatt?.connected) return;
      marcar('soltada al cerrar la caja');
      conexion.dispositivo.gatt.disconnect?.();
    },

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
      // Con una reconexión en curso, la característica vieja ya no sirve: se espera la nueva.
      const lista = conexion.dispositivo.gatt?.connected && !reconectando;
      if (!lista && !(await reconectar())) {
        return { ok: false, motivo: 'fuera_de_alcance', detalle: ultimoError || 'No reconectó' };
      }
      const actual = conexion;
      const inicio = reloj();
      /** Cuántos trozos salieron: si falla el primero, nada se imprimió y se puede reintentar. */
      let salieron = 0;
      const enviar = () => {
        const c = actual.caracteristica;
        const escribir = c.properties.writeWithoutResponse
          ? (d: Uint8Array) => c.writeValueWithoutResponse(d)
          : (d: Uint8Array) => c.writeValueWithResponse(d);
        return enviarEnTrozos(
          (d) => escribir(d).then(() => void salieron++),
          trabajo.bytes,
          trozo,
          esperar,
        );
      };
      cambiar('ocupada');
      try {
        let final: Trozo;
        try {
          final = await enviar();
        } catch (error) {
          // La conexión parecía abierta y estaba muerta (el teléfono se bloqueó): se abre otra y
          // se manda una vez más. Solo si no salió nada: un recibo a medias no se repite.
          if (salieron > 0 || nombreDelError(error) !== 'NetworkError') throw error;
          const nota = `Al imprimir: ${detalleDe(error)}; se reconecta y se reintenta una vez`;
          // Reconectar limpia lo visto: la nota va después, para que el diagnóstico la cuente.
          const reconecto = await reconectar(true);
          vistos.push(nota);
          if (!reconecto) throw error;
          cambiar('ocupada');
          final = await enviar();
        }
        if (final !== trozo) {
          trozo = final;
          opciones.alCambiarTrozo?.(final);
        }
      } catch (error) {
        ultimoError = detalleDe(error);
        marcar(`no imprimió: ${ultimoError}`);
        cambiar(actual.dispositivo.gatt?.connected ? 'conectada' : 'desconectada');
        return { ok: false, motivo: motivoDelError(error, false), detalle: ultimoError };
      }
      cambiar('conectada');
      marcar(`imprimió ${trabajo.bytes.length} bytes`);
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
        `Impresora: ${conexion?.dispositivo.name ?? (nombre ? `${nombre} (sin usar)` : 'sin vincular')}`,
        `Id: ${conexion?.dispositivo.id ?? '-'}`,
        `Estado: ${estado}`,
        `Escribe en: ${conexion ? `${String(conexion.servicio)} › ${conexion.caracteristica.uuid}` : '-'}`,
        `Trozo: ${trozo.bytes} bytes cada ${trozo.ms} ms`,
        'Características:',
        ...(vistos.length ? vistos.map((v) => `  ${v}`) : ['  -']),
        'Línea de tiempo:',
        ...(lineaDeTiempo.length ? lineaDeTiempo.map((v) => `  ${v}`) : ['  -']),
        `Último error: ${ultimoError || '-'}`,
      ].join('\n');
    },
  };
}
