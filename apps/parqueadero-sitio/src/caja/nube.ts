/**
 * Cuándo sube y baja la caja (HU-Q7.5 CA1): al abrir, al volver la señal, al volver a la caja, a
 * los pocos segundos de registrar algo y cada 2 minutos con la caja abierta (lo que entró por otra
 * caja tiene que poder salir por esta). Registrar nunca espera esto: el envío corre aparte y nunca
 * entre el toque de «Registrar» y el recibo.
 *
 * Sin `nube` en `meta` (una caja sin cuenta, como las de `v0.2.x`) no hace nada y no carga el
 * código de la sincronización: la caja abre igual de rápido (P10, HU-Q3.1 CA3).
 */
import type { BaseDeLaCaja } from './datos.ts';
import type { Resultado, ResultadoDeRecepcion } from './sincronizar.ts';

export const CADA_MS = 2 * 60_000;
/** Lo que se espera después de registrar: lo que se anota seguido sale en un lote. */
export const DEMORA_TRAS_REGISTRAR_MS = 3_000;

export type EstadoDeLaNube =
  | { readonly tipo: 'sin-vincular' }
  | { readonly tipo: 'enviando' }
  | {
      readonly tipo: 'resultado';
      readonly envio: Resultado;
      /** Lo que bajó; no se baja si la subida no terminó. */
      readonly recepcion?: ResultadoDeRecepcion;
      readonly cuando: number;
    };

type Oyente = (e: EstadoDeLaNube) => void;

export interface Nube {
  readonly estado: () => EstadoDeLaNube;
  readonly escuchar: (o: Oyente) => () => void;
  /** Sube y baja ahora. Si ya hay una vuelta en curso, espera esa en vez de empezar otra. */
  readonly ahora: () => Promise<EstadoDeLaNube>;
  /** Avisa que algo se registró: sale en unos segundos, sin hacer esperar a nadie. */
  readonly registrado: () => void;
  readonly detener: () => void;
}

interface OpcionesDeLaNube {
  readonly reloj: () => number;
  readonly app: string;
  readonly fetchFn?: typeof fetch;
  /** Sin ventana (pruebas): no escucha la red ni la visibilidad. */
  readonly ventana?: Pick<Window, 'addEventListener' | 'removeEventListener'> & {
    readonly document: Pick<
      Document,
      'visibilityState' | 'addEventListener' | 'removeEventListener'
    >;
  };
}

export function crearNube(db: BaseDeLaCaja, o: OpcionesDeLaNube): Nube {
  const oyentes = new Set<Oyente>();
  let estado: EstadoDeLaNube = { tipo: 'sin-vincular' };
  let corriendo: Promise<EstadoDeLaNube> | null = null;
  let fallos = 0;
  let proxima: ReturnType<typeof setTimeout> | null = null;
  let tras: ReturnType<typeof setTimeout> | null = null;
  let detenida = false;

  const cambiar = (nuevo: EstadoDeLaNube) => {
    estado = nuevo;
    for (const f of oyentes) f(estado);
  };
  const programar = (ms: number) => {
    if (proxima) clearTimeout(proxima);
    if (!detenida) proxima = setTimeout(() => void ahora(), ms);
  };

  async function vuelta(): Promise<EstadoDeLaNube> {
    const nube = await db.meta.get('nube');
    const disp = await db.meta.get('dispositivo');
    if (nube?.clave !== 'nube' || disp?.clave !== 'dispositivo') return { tipo: 'sin-vincular' };
    const s = await import('./sincronizar.ts');
    const destino = { api: nube.api, acceso: nube.acceso, dispositivo: disp.id, app: o.app };
    const opciones = {
      fallosPrevios: fallos,
      ahora: o.reloj,
      ...(o.fetchFn ? { fetchFn: o.fetchFn } : {}),
    };
    cambiar({ tipo: 'enviando' });
    const envio = await s.enviarPendientes(db, destino, opciones);
    if (envio.estado !== 'al-dia') {
      fallos = envio.estado === 'esperar' ? fallos + 1 : 0;
      programar(envio.estado === 'esperar' ? envio.ms : CADA_MS);
      return { tipo: 'resultado', envio, cuando: o.reloj() };
    }
    // Primero sube lo propio, después baja lo de las otras cajas: lo pendiente aquí no se pisa.
    const recepcion = await s.recibirCambios(db, destino, opciones);
    fallos = recepcion.estado === 'esperar' ? fallos + 1 : 0;
    programar(recepcion.estado === 'esperar' ? recepcion.ms : CADA_MS);
    return { tipo: 'resultado', envio, recepcion, cuando: o.reloj() };
  }

  function ahora(): Promise<EstadoDeLaNube> {
    corriendo ??= vuelta()
      .catch((e: unknown): EstadoDeLaNube => {
        console.error('caja: la sincronización falló', e);
        programar(CADA_MS);
        return {
          tipo: 'resultado',
          envio: {
            estado: 'error',
            enviados: 0,
            rechazados: 0,
            motivo: 'Algo falló al sincronizar; se intentará de nuevo.',
          },
          cuando: o.reloj(),
        };
      })
      .then((final) => {
        corriendo = null;
        cambiar(final);
        return final;
      });
    return corriendo;
  }

  const registrado = () => {
    if (tras) clearTimeout(tras);
    if (!detenida) tras = setTimeout(() => void ahora(), DEMORA_TRAS_REGISTRAR_MS);
  };

  const v = o.ventana;
  const alVolverLaSenal = () => void ahora();
  const alVerse = () => {
    if (v?.document.visibilityState === 'visible') void ahora();
  };
  v?.addEventListener('online', alVolverLaSenal);
  v?.document.addEventListener('visibilitychange', alVerse);

  return {
    estado: () => estado,
    escuchar: (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    ahora,
    registrado,
    detener: () => {
      detenida = true;
      v?.removeEventListener('online', alVolverLaSenal);
      v?.document.removeEventListener('visibilitychange', alVerse);
      if (proxima) clearTimeout(proxima);
      if (tras) clearTimeout(tras);
    },
  };
}
