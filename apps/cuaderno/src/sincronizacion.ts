/**
 * Cuándo sube el teléfono (ARQUITECTURA §5.6): al abrir la app, al volver la señal y cada 15 min
 * con la app abierta. Si la celda pide esperar (429 o 503), se espera cada vez más (HU-E5.2, CA5).
 *
 * Solo sube con la finca vinculada (HU-E4.3) y una sesión activa: sin eso, no intenta nada y el
 * estado lo dice. Registrar nunca espera esto: guardar es local (ARQUITECTURA §5.3, regla 1).
 */
import { conEscritura } from './actividad.ts';
import { cuaderno } from './almacen/abierto.ts';
import { idDispositivo } from './almacen/dispositivo.ts';
import { enviarPendientes, type ResultadoDeEnvio } from './almacen/envio.ts';
import { estadoDeSesion, renovarSiHaceFalta, urlDelCore } from './almacen/sesion.ts';
import { estadoDelVinculo } from './almacen/vinculo.ts';

export const CADA_MS = 15 * 60_000;

export type EstadoDeSincronizacion =
  | { tipo: 'inactiva'; motivo: 'sin-cuenta' | 'sin-vincular' | 'otra-cuenta' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'enviando' }
  | { tipo: 'resultado'; resultado: ResultadoDeEnvio; cuando: number };

type Oyente = (e: EstadoDeSincronizacion) => void;
const oyentes = new Set<Oyente>();
let estado: EstadoDeSincronizacion = { tipo: 'inactiva', motivo: 'sin-cuenta' };
let corriendo: Promise<EstadoDeSincronizacion> | null = null;
let fallos = 0;
let proxima: ReturnType<typeof setTimeout> | null = null;

const cambiar = (nuevo: EstadoDeSincronizacion) => {
  estado = nuevo;
  for (const o of oyentes) o(estado);
};

export const estadoDeSincronizacion = () => estado;
export function escucharSincronizacion(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function programar(ms: number) {
  if (proxima) clearTimeout(proxima);
  proxima = setTimeout(() => void sincronizarAhora(), ms);
}

async function una(): Promise<EstadoDeSincronizacion> {
  const db = cuaderno();
  const { sesion } = await renovarSiHaceFalta(db, urlDelCore(location.hostname));
  const vinculo = await estadoDelVinculo(db, sesion);
  if (!sesion) return { tipo: 'inactiva', motivo: 'sin-cuenta' };
  if (vinculo === 'otra-cuenta') return { tipo: 'inactiva', motivo: 'otra-cuenta' };
  if (vinculo !== 'vinculada') return { tipo: 'inactiva', motivo: 'sin-vincular' };
  if (estadoDeSesion(sesion, Date.now()) !== 'activa' || !sesion.url_api)
    return { tipo: 'sin-sesion' };
  cambiar({ tipo: 'enviando' });
  const resultado = await conEscritura(async () =>
    enviarPendientes(
      db,
      {
        api: sesion.url_api ?? '',
        acceso: sesion.acceso,
        dispositivo: await idDispositivo(db),
        app: __VERSION_APP__,
      },
      { fallosPrevios: fallos },
    ),
  );
  fallos = resultado.estado === 'esperar' ? fallos + 1 : 0;
  programar(resultado.estado === 'esperar' ? resultado.ms : CADA_MS);
  return { tipo: 'resultado', resultado, cuando: Date.now() };
}

/** Sube lo pendiente ahora. Si ya hay una subida en curso, espera esa en vez de empezar otra. */
export function sincronizarAhora(): Promise<EstadoDeSincronizacion> {
  corriendo ??= una()
    .catch((e: unknown): EstadoDeSincronizacion => {
      console.error('cuaderno: la sincronización falló', e);
      return {
        tipo: 'resultado',
        resultado: {
          estado: 'error',
          enviados: 0,
          rechazados: 0,
          motivo: 'Algo falló al sincronizar; se intentará de nuevo.',
        },
        cuando: Date.now(),
      };
    })
    .then((final) => {
      cambiar(final);
      return final;
    })
    .finally(() => {
      corriendo = null;
    });
  return corriendo;
}

/** Lo llama la app al arrancar. Devuelve cómo detenerlo. */
export function iniciarSincronizacion(): () => void {
  const alVolverLaSenal = () => void sincronizarAhora();
  window.addEventListener('online', alVolverLaSenal);
  void sincronizarAhora();
  programar(CADA_MS);
  return () => {
    window.removeEventListener('online', alVolverLaSenal);
    if (proxima) clearTimeout(proxima);
  };
}
