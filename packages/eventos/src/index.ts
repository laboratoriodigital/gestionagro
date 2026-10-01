/**
 * Eventos de herramienta en lote (HU-E1.6, ARQUITECTURA §5.1, ED1 [H4]).
 *
 * Los eventos se cuentan en la página y salen en **un solo** `sendBeacon` cuando la página se
 * oculta o se cierra. Una sesión cuesta una invocación del Worker. Lo que ocurra después de ese
 * envío no se manda: se prefiere perder un evento tardío a gastar una segunda invocación.
 *
 * Sin datos personales: solo producto, nombre del evento y cuántas veces pasó (P13).
 */

export const EVENTOS = ['tool.opened', 'tool.completed', 'tool.shared', 'tool.next_step'] as const;
export type NombreDeEvento = (typeof EVENTOS)[number];

export const VERSION_DEL_LOTE = 1;

export interface Lote {
  v: typeof VERSION_DEL_LOTE;
  producto: string;
  eventos: Partial<Record<NombreDeEvento, number>>;
}

/** Lo mínimo del navegador que usa el colector; inyectable para las pruebas. */
export interface Entorno {
  sendBeacon: (url: string, datos: string) => boolean;
  alOcultar: (fn: () => void) => void;
}

export interface Colector {
  registrar: (nombre: NombreDeEvento) => void;
  /** Cuenta pendiente, para depurar y para las pruebas. */
  pendientes: () => Lote['eventos'];
  enviado: () => boolean;
}

export interface OpcionesDelColector {
  producto: string;
  endpoint?: string;
  /** Eventos que solo cuentan la primera vez (p. ej. `tool.completed`, HU-E2.2 CA6). */
  unaVez?: readonly NombreDeEvento[];
  entorno: Entorno;
}

export function crearColector(opciones: OpcionesDelColector): Colector {
  const {
    producto,
    endpoint = '/api/eventos',
    unaVez = ['tool.opened', 'tool.completed'],
    entorno,
  } = opciones;
  const cuentas: Lote['eventos'] = {};
  let enviado = false;

  const enviar = () => {
    if (enviado || Object.keys(cuentas).length === 0) return;
    enviado = true;
    const lote: Lote = { v: VERSION_DEL_LOTE, producto, eventos: { ...cuentas } };
    // Texto plano: sendBeacon no dispara una verificación previa (CORS) con text/plain.
    entorno.sendBeacon(endpoint, JSON.stringify(lote));
  };
  entorno.alOcultar(enviar);

  return {
    registrar(nombre) {
      if (enviado) return;
      const actual = cuentas[nombre] ?? 0;
      if (actual > 0 && unaVez.includes(nombre)) return;
      cuentas[nombre] = actual + 1;
    },
    pendientes: () => ({ ...cuentas }),
    enviado: () => enviado,
  };
}

/** Entorno real del navegador: se envía al ocultar la pestaña o al salir de la página. */
export function entornoDelNavegador(): Entorno {
  return {
    sendBeacon: (url, datos) => navigator.sendBeacon(url, datos),
    alOcultar: (fn) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') fn();
      });
      addEventListener('pagehide', fn);
    },
  };
}
