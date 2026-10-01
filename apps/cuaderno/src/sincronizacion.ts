/**
 * Cuándo sube y baja el teléfono (ARQUITECTURA §5.6): al abrir la app, al volver la señal, cada
 * 15 min con la app abierta, a los pocos segundos de guardar algo y al volver a la app
 * (`disparadores.ts`). Si la celda pide esperar (429 o 503), se espera cada vez más (HU-E5.2, CA5).
 *
 * Solo sube con la finca vinculada (HU-E4.3) y una sesión activa: sin eso, no intenta nada y el
 * estado lo dice. Registrar nunca espera esto: guardar es local (ARQUITECTURA §5.3, regla 1).
 */
import { conEscritura, escucharActividad } from './actividad.ts';
import { cuaderno } from './almacen/abierto.ts';
import { idDispositivo } from './almacen/dispositivo.ts';
import { enviarPendientes, type ResultadoDeEnvio } from './almacen/envio.ts';
import { type ResultadoDeRecepcion, recibirCambios } from './almacen/recepcion.ts';
import { estadoDeSesion, renovarSiHaceFalta, rolEnLaFinca, urlDelCore } from './almacen/sesion.ts';
import { estadoDelVinculo } from './almacen/vinculo.ts';
import { DEMORA_TRAS_GUARDAR_MS, debeSincronizar } from './disparadores.ts';

export const CADA_MS = 15 * 60_000;
export const CADA_EN_AHORRO_MS = 60 * 60_000;

export type EstadoDeSincronizacion =
  | { tipo: 'inactiva'; motivo: 'sin-cuenta' | 'sin-vincular' | 'otra-cuenta' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'enviando' }
  | {
      tipo: 'resultado';
      resultado: ResultadoDeEnvio;
      /** Lo que bajó del equipo (HU-E5.3); no se baja si la subida no terminó. */
      recepcion?: ResultadoDeRecepcion;
      cuando: number;
    };

type Oyente = (e: EstadoDeSincronizacion) => void;
const oyentes = new Set<Oyente>();
let estado: EstadoDeSincronizacion = { tipo: 'inactiva', motivo: 'sin-cuenta' };
let corriendo: Promise<EstadoDeSincronizacion> | null = null;
let fallos = 0;
let proxima: ReturnType<typeof setTimeout> | null = null;
let tras: ReturnType<typeof setTimeout> | null = null;
/** Hasta cuándo pidió esperar la nube, y cuándo terminó la última vuelta (ms Unix). */
let esperarHasta = 0;
let ultima = 0;

const cambiar = (nuevo: EstadoDeSincronizacion) => {
  estado = nuevo;
  for (const o of oyentes) o(estado);
};

export const estadoDeSincronizacion = () => estado;
export function escucharSincronizacion(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

function programar(ms: number, esperando = false) {
  if (proxima) clearTimeout(proxima);
  esperarHasta = esperando ? Date.now() + ms : 0;
  proxima = setTimeout(() => void sincronizarAhora(), ms);
}

/** Sincroniza si las reglas de `disparadores.ts` lo permiten en este momento. */
async function quizas(motivo: 'guardado' | 'visible') {
  const situacion = {
    ahora: Date.now(),
    enLinea: navigator.onLine,
    corriendo: corriendo !== null,
    esperarHasta,
    ultima,
    pendientes: await cuaderno().outbox.count(),
  };
  if (debeSincronizar(motivo, situacion)) void sincronizarAhora();
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
  if (resultado.estado !== 'al-dia') {
    fallos = resultado.estado === 'esperar' ? fallos + 1 : 0;
    programar(
      resultado.estado === 'esperar' ? resultado.ms : CADA_MS,
      resultado.estado === 'esperar',
    );
    return { tipo: 'resultado', resultado, cuando: Date.now() };
  }
  // Primero sube lo propio, después baja lo del equipo: lo pendiente aquí no se pisa (HU-E5.3).
  cambiar({ tipo: 'enviando' });
  const recepcion = await conEscritura(() =>
    recibirCambios(db, {
      api: sesion.url_api ?? '',
      acceso: sesion.acceso,
      rol: rolEnLaFinca(sesion),
    }),
  );
  fallos = recepcion.estado === 'esperar' ? fallos + 1 : 0;
  // En «ahorro» la celda pide revisar menos seguido (ARQUITECTURA §8.2).
  const cada =
    recepcion.estado === 'al-dia' && recepcion.nivel === 'ahorro' ? CADA_EN_AHORRO_MS : CADA_MS;
  programar(recepcion.estado === 'esperar' ? recepcion.ms : cada, recepcion.estado === 'esperar');
  return { tipo: 'resultado', resultado, recepcion, cuando: Date.now() };
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
      corriendo = null;
      ultima = Date.now();
      cambiar(final);
      // Lo que se guardó mientras corría esta vuelta no esperó: sale en la siguiente. Solo si la
      // vuelta terminó bien; tras un error o sin señal se espera al turno siguiente, sin bucle.
      const bien =
        final.tipo === 'resultado' &&
        final.resultado.estado === 'al-dia' &&
        (final.recepcion?.estado ?? 'al-dia') === 'al-dia';
      if (bien) void quizas('guardado');
      return final;
    });
  return corriendo;
}

/** Lo llama la app al arrancar. Devuelve cómo detenerlo. */
export function iniciarSincronizacion(): () => void {
  const alVolverLaSenal = () => void sincronizarAhora();
  const alVerse = () => {
    if (document.visibilityState === 'visible') void quizas('visible');
  };
  window.addEventListener('online', alVolverLaSenal);
  document.addEventListener('visibilitychange', alVerse);
  // Después de guardar: espera unos segundos a que termine lo que se anota seguido. Las
  // escrituras de la propia sincronización no cuentan (`quizas` mira si hay una corriendo).
  const dejarActividad = escucharActividad((a) => {
    if (a.escriturasEnCurso > 0 || corriendo) return;
    if (tras) clearTimeout(tras);
    tras = setTimeout(() => void quizas('guardado'), DEMORA_TRAS_GUARDAR_MS);
  });
  void sincronizarAhora();
  programar(CADA_MS);
  return () => {
    window.removeEventListener('online', alVolverLaSenal);
    document.removeEventListener('visibilitychange', alVerse);
    dejarActividad();
    if (proxima) clearTimeout(proxima);
    if (tras) clearTimeout(tras);
  };
}
