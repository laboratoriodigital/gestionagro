/**
 * Eventos de herramienta en lote (HU-E1.6, ARQUITECTURA §5.1, ED1 [H4]).
 *
 * Los eventos se cuentan en la página y salen en **un solo** `sendBeacon` cuando la página se
 * oculta o se cierra. Una sesión cuesta una invocación del Worker. Lo que ocurra después de ese
 * envío no se manda: se prefiere perder un evento tardío a gastar una segunda invocación.
 *
 * Sin datos personales: solo producto, nombre del evento y cuántas veces pasó (P13).
 *
 * Los de la caja del parqueadero, con su propio lote, en `parqueadero.ts` (HU-Q5.3).
 */

export * from './parqueadero.ts';

export const EVENTOS = ['tool.opened', 'tool.completed', 'tool.shared', 'tool.next_step'] as const;
export type NombreDeEvento = (typeof EVENTOS)[number];

export const VERSION_DEL_LOTE = 1;

export interface Lote {
  v: typeof VERSION_DEL_LOTE;
  producto: string;
  eventos: Partial<Record<NombreDeEvento, number>>;
}

/** Lo más que un lote de herramienta cuenta de un evento: una sesión, con holgura. */
export const CUENTA_MAXIMA_DEL_LOTE = 100;

/**
 * Valida un lote de herramienta para los `productos` que el Worker atiende. Devuelve el motivo
 * del rechazo, o `null` si es válido. La usan el sitio del agro y el del parqueadero (HU-Q11.5).
 */
export function motivoDeRechazoDelLote(lote: unknown, productos: readonly string[]): string | null {
  if (typeof lote !== 'object' || lote === null) return 'el lote no es un objeto';
  const l = lote as Partial<Lote>;
  if (l.v !== VERSION_DEL_LOTE) return `versión de lote desconocida: ${String(l.v)}`;
  if (typeof l.producto !== 'string' || !productos.includes(l.producto)) {
    return `producto desconocido: ${String(l.producto)}`;
  }
  if (typeof l.eventos !== 'object' || l.eventos === null) return 'faltan los eventos';
  if (Object.keys(l.eventos).length === 0) return 'el lote no trae eventos';
  for (const [nombre, cuenta] of Object.entries(l.eventos)) {
    if (!(EVENTOS as readonly string[]).includes(nombre)) return `evento desconocido: ${nombre}`;
    if (
      !Number.isInteger(cuenta) ||
      (cuenta as number) < 1 ||
      (cuenta as number) > CUENTA_MAXIMA_DEL_LOTE
    ) {
      return `cuenta inválida para ${nombre}: ${String(cuenta)}`;
    }
  }
  return null;
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
