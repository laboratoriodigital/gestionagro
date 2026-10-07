/**
 * La impresora de la caja: el adaptador, la cola y lo que se guarda en `impresora` (§5.2). La
 * caja tiene una sola impresora y una sola cola (PARQUEADERO §7.3). Dos caminos: Web Bluetooth y
 * Web Serial, la impresora emparejada que la caja encuentra sola al abrir (§7.5, HU-Q2.4).
 */
import {
  type AjustesDeImpresion,
  type Bloque,
  type BluetoothBle,
  type Cola,
  codificar,
  crearCola,
  crearImpresoraBluetooth,
  crearImpresoraSerial,
  type EstadoImpresora,
  FalloDeImpresora,
  type Impresora,
  type MotivoDeFallo,
  type PuertoSerie,
  puertoRecordado,
  type Resultado,
  type SerialWeb,
  type Vinculo,
} from '@ed1/impresion';
import { conImpresion } from './actividad.ts';
import type { BaseDeLaCaja, RegistroImpresora } from './datos.ts';
import { conMarcaDeEntorno } from './entorno.ts';

export interface OpcionesDeControl {
  readonly bluetooth: BluetoothBle | undefined;
  /** Web Serial: Chrome 138+ en Android y Chrome o Edge en el PC. */
  readonly serial?: SerialWeb | undefined;
  readonly hostname: string;
  readonly reloj: () => number;
  readonly nuevoId: () => string;
  /**
   * Dónde queda el diagnóstico al cerrar la caja, para leerlo después de recargarla (bitácora
   * 21). En el navegador, `localStorage`; puede faltar o fallar, y la caja sigue igual.
   */
  readonly guardado?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
}

export interface ControlDeImpresora {
  /**
   * Solo desde un toque del cajero: el navegador abre su selector. Sin `camino`, el de la
   * impresora guardada; sin impresora guardada, Bluetooth.
   */
  conectar(verTodos: boolean, camino?: CaminoDeLaCaja): Promise<Vinculo>;
  /**
   * Al abrir la caja: si la impresora guardada es la emparejada (Web Serial), la toma sin selector
   * (HU-Q2.4 CA1). `false` si no hay o no abrió.
   */
  recuperar(): Promise<boolean>;
  /** Sin selector, sobre la impresora de esta sesión. `false` si no hay o no respondió. */
  reconectar(forzar?: boolean): Promise<boolean>;
  /**
   * Codifica con los ajustes guardados (o los que se pasen) y encola. Nunca lanza. Si es un
   * recibo (`reciboId`) y no sale, queda en `entregas_pendientes`, también sin impresora conectada
   * (HU-Q3.3 CA4).
   */
  imprimir(
    bloques: readonly Bloque[],
    ajustes?: AjustesDeImpresion,
    reciboId?: string,
  ): Promise<Resultado>;
  estado(): EstadoImpresora;
  escuchar(oyente: (estado: EstadoImpresora) => void): () => void;
  /** Lo que el adaptador vio, más el de la sesión anterior si la caja se recargó. */
  diagnostico(): string;
  /** Al cerrar o recargar la caja: suelta la conexión y guarda el diagnóstico. */
  soltar(): void;
  /** Qué caminos tiene este navegador: la caja ofrece solo los que funcionan (HU-Q2.4 CA3). */
  caminos(): { readonly bluetooth: boolean; readonly serial: boolean };
}

export type CaminoDeLaCaja = 'bluetooth' | 'serial';

const CLAVE_DEL_DIAGNOSTICO = 'caja-diagnostico-anterior';

/** Un adaptador con su diagnóstico para soporte (§7.4 paso 6). */
type Adaptador = Impresora & { diagnostico(): string };

export function ajustesDelRegistro(r: RegistroImpresora): AjustesDeImpresion {
  return { paginaDeCodigos: r.paginaDeCodigos, qr: r.qr, columnas: r.columnas, avanceFinal: 3 };
}

export function crearControl(db: BaseDeLaCaja, opciones: OpcionesDeControl): ControlDeImpresora {
  /** La que imprime: la de la cola. */
  let enUso: Adaptador | undefined;
  /** La del último intento de conectar, aunque haya fallado: la que cuenta el diagnóstico. */
  let ultima: Adaptador | undefined;
  let cola: Cola | undefined;
  let estado: EstadoImpresora = 'sin_vincular';
  const oyentes = new Set<(e: EstadoImpresora) => void>();
  /** El recibo de cada trabajo en la cola, para que su entrega pendiente lo nombre. */
  const reciboDelTrabajo = new Map<string, string>();
  const pendiente = (trabajoId: string, r: { motivo: MotivoDeFallo; detalle: string }) => {
    const reciboId = reciboDelTrabajo.get(trabajoId);
    reciboDelTrabajo.delete(trabajoId);
    return db.entregas_pendientes.add({
      trabajoId,
      canal: 'papel',
      motivo: r.motivo,
      detalle: r.detalle,
      creadaEn: opciones.reloj(),
      ...(reciboId ? { reciboId } : {}),
    });
  };
  const cambiar = (e: EstadoImpresora) => {
    estado = e;
    for (const o of oyentes) o(e);
  };

  /**
   * Un adaptador nuevo. Una impresora reemplazada ya no habla por la cabecera; si la nueva no se
   * vincula, el estado que queda lo decide quien la creó, no ella.
   */
  function crear(
    camino: CaminoDeLaCaja,
    o: { verTodos: boolean; anterior: RegistroImpresora | undefined; puerto?: PuertoSerie },
  ): Adaptador {
    const alCambiarEstado = (e: EstadoImpresora) => {
      if (nueva === enUso || (nueva === ultima && e !== 'sin_vincular')) cambiar(e);
    };
    let nueva: Adaptador;
    if (camino === 'serial') {
      if (!opciones.serial) {
        throw new FalloDeImpresora(
          'no_soportado',
          'Este navegador no puede usar la impresora emparejada',
        );
      }
      nueva = crearImpresoraSerial({ serial: opciones.serial, puerto: o.puerto, alCambiarEstado });
    } else {
      if (!opciones.bluetooth) {
        throw new FalloDeImpresora('no_soportado', 'Este navegador no tiene Bluetooth web');
      }
      nueva = crearImpresoraBluetooth({
        bluetooth: opciones.bluetooth,
        verTodos: o.verTodos,
        ...(o.anterior?.trozo ? { trozo: o.anterior.trozo } : {}),
        alCambiarEstado,
        alCambiarTrozo: (trozo) => void db.impresora.update('actual', { trozo }),
      });
    }
    return nueva;
  }

  function usar(a: Adaptador): void {
    enUso = a;
    cola = crearCola(a, { alFallar: (trabajo, r) => pendiente(trabajo.id, r) });
  }

  return {
    async conectar(verTodos, camino) {
      const anterior = await db.impresora.get('actual');
      const nueva = crear(camino ?? (anterior?.camino === 'serial' ? 'serial' : 'bluetooth'), {
        verTodos,
        anterior,
      });
      // El diagnóstico tiene que contar lo que vio también cuando vincular falla.
      ultima = nueva;
      let vinculo: Vinculo;
      try {
        vinculo = await nueva.vincular();
      } catch (e) {
        // Si había una impresora conectada, sigue siendo la de la caja.
        cambiar(enUso?.estado() ?? 'sin_vincular');
        throw e;
      }
      usar(nueva);
      // Otra impresora pierde la prueba: sus tildes y su QR pueden ser otros.
      const misma = anterior?.dispositivoId === vinculo.id;
      await db.impresora.put({
        id: 'actual',
        camino: vinculo.camino,
        nombre: vinculo.nombre,
        dispositivoId: vinculo.id,
        ...(vinculo.servicio ? { servicio: vinculo.servicio } : {}),
        ...(vinculo.caracteristica ? { caracteristica: vinculo.caracteristica } : {}),
        ...(misma && anterior?.trozo ? { trozo: anterior.trozo } : {}),
        paginaDeCodigos: misma && anterior ? anterior.paginaDeCodigos : 'cp850',
        qr: misma && anterior ? anterior.qr : 'nativo',
        columnas: misma && anterior ? anterior.columnas : 32,
        probada: misma && anterior ? anterior.probada : false,
        ...(misma && anterior?.probadaEn ? { probadaEn: anterior.probadaEn } : {}),
      });
      return vinculo;
    },

    async imprimir(bloques, ajustes, reciboId) {
      const registro = await db.impresora.get('actual');
      if (!cola || !registro) {
        const r = { motivo: 'sin_permiso', detalle: 'Falta conectar la impresora' } as const;
        if (reciboId) {
          const id = opciones.nuevoId();
          reciboDelTrabajo.set(id, reciboId);
          await pendiente(id, r);
        }
        return { ok: false, ...r };
      }
      let bytes: Uint8Array;
      try {
        bytes = await codificar(
          conMarcaDeEntorno(bloques, opciones.hostname),
          ajustes ?? ajustesDelRegistro(registro),
        );
      } catch (e) {
        // Un recibo que no se pudo codificar se dice, nunca deja la pantalla esperando (P15).
        return { ok: false, motivo: 'no_soportado', detalle: `No se pudo armar: ${String(e)}` };
      }
      const enCola = cola;
      const id = opciones.nuevoId();
      if (reciboId) reciboDelTrabajo.set(id, reciboId);
      const r = await conImpresion(() => enCola.imprimir({ id, formato: 'escpos', bytes }));
      reciboDelTrabajo.delete(id);
      return r;
    },

    async recuperar() {
      const guardada = await db.impresora.get('actual');
      if (enUso || guardada?.camino !== 'serial' || !opciones.serial) return false;
      const puerto = await puertoRecordado(opciones.serial, guardada.dispositivoId);
      if (!puerto) return false;
      const a = crear('serial', { verTodos: false, anterior: guardada, puerto });
      ultima = a;
      if (!(await a.reconectar())) {
        cambiar('sin_vincular');
        return false;
      }
      usar(a);
      cambiar(a.estado());
      return true;
    },

    reconectar: (forzar) => enUso?.reconectar(forzar) ?? Promise.resolve(false),

    estado: () => estado,

    escuchar(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },

    caminos: () => ({ bluetooth: Boolean(opciones.bluetooth), serial: Boolean(opciones.serial) }),

    diagnostico() {
      // Primero, qué puede este navegador: dice si la impresora emparejada estaba a mano (bitácora 24).
      const si = (x: unknown) => (x ? 'sí' : 'no');
      const navegador = `Este navegador: Bluetooth web ${si(opciones.bluetooth)} · impresora emparejada ${si(opciones.serial)}`;
      const ahora = `${navegador}\n${ultima?.diagnostico() ?? 'Impresora: sin vincular en esta sesión'}`;
      let antes: string | null = null;
      try {
        antes = opciones.guardado?.getItem(CLAVE_DEL_DIAGNOSTICO) ?? null;
      } catch {
        // Sin almacenamiento, solo esta sesión.
      }
      return antes ? `${ahora}\n\n--- Antes de recargar la caja ---\n${antes}` : ahora;
    },

    soltar() {
      try {
        if (ultima) opciones.guardado?.setItem(CLAVE_DEL_DIAGNOSTICO, ultima.diagnostico());
      } catch {
        // Sin almacenamiento no se guarda; soltar la conexión es lo que importa.
      }
      enUso?.soltar?.();
    },
  };
}

/** Más tiempo que esto con la caja oculta, y la conexión se abre de nuevo al volver (bitácora 19). */
export const MS_PARA_REFRESCAR = 2 * 60_000;

/**
 * Qué hacer con la impresora cuando la caja vuelve a la pantalla: si se soltó, reconectar; si estuvo
 * oculta un buen rato (el teléfono se bloqueó), abrir otra conexión aunque el navegador diga que la
 * vieja sigue abierta. Volver de WhatsApp al rato de enviar un recibo no reconecta nada.
 */
export function alVolverALaCaja(
  estado: EstadoImpresora,
  msOculta: number,
): 'nada' | 'reconectar' | 'refrescar' {
  if (estado === 'sin_vincular' || estado === 'ocupada' || estado === 'conectando') return 'nada';
  if (msOculta >= MS_PARA_REFRESCAR) return 'refrescar';
  return estado === 'desconectada' ? 'reconectar' : 'nada';
}
