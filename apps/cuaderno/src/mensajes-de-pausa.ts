/**
 * «Sincronización en pausa» dicho como es (HU-E8.6). Un solo catálogo para todas las causas por
 * las que el teléfono no sincroniza (CA1). Cada mensaje dice qué pasó, que los registros están a
 * salvo en el teléfono y qué hacer (CA2, P15). Ninguna pantalla escribe su propio texto de pausa.
 *
 * La hora de reanudación sale del reinicio de la cuota de D1, a las 00:00 UTC, y se dice siempre
 * en hora de Colombia, aunque el teléfono esté en otro huso (CA3, P8).
 */
import { proximoReinicioDeCuota } from '@ed1/agro-schema/sync';
import type { ResultadoDeEnvio } from './almacen/envio.ts';
import type { ResultadoDeRecepcion } from './almacen/recepcion.ts';
import type { EstadoDeSincronizacion } from './sincronizacion.ts';

export const CAUSAS = [
  'sin-senal',
  'sin-sesion',
  'ahorro',
  'esencial',
  'bloqueo',
  'apagado',
  'app-vieja',
  'mudanza',
  'espera',
] as const;
export type Causa = (typeof CAUSAS)[number];

export interface Mensaje {
  /** Qué pasó. */
  que: string;
  /** Que los datos están a salvo. Igual en todos: es lo que más importa saber. */
  datos: string;
  /** Qué hacer. */
  hacer: string;
}

export const DATOS_A_SALVO = 'Tus registros están guardados en este teléfono.';

const ZONA = 'America/Bogota';
const diaEnColombia = (ms: number) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ms);
const horaEnColombia = (ms: number) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ms);

/** «las 19:00 de hoy», «las 19:00 de mañana» o con la fecha, en hora de Colombia. */
export function cuandoVuelve(reanudaMs: number, ahoraMs: number): string {
  const hora = horaEnColombia(reanudaMs);
  const hoy = diaEnColombia(ahoraMs);
  const dia = diaEnColombia(reanudaMs);
  if (dia === hoy) return `las ${hora} de hoy`;
  if (dia === diaEnColombia(ahoraMs + 86_400_000)) return `las ${hora} de mañana`;
  const fecha = new Intl.DateTimeFormat('es-CO', {
    timeZone: ZONA,
    day: 'numeric',
    month: 'long',
  }).format(reanudaMs);
  return `las ${hora} del ${fecha}`;
}

export function mensajeDePausa(
  causa: Causa,
  contexto: { ahora: number; reanuda?: number; ms?: number },
): Mensaje {
  const reanuda = contexto.reanuda ?? proximoReinicioDeCuota(contexto.ahora);
  const hasta = `${cuandoVuelve(reanuda, contexto.ahora)} (hora de Colombia)`;
  const minutos = Math.max(1, Math.round((contexto.ms ?? 60_000) / 60_000));
  const m = (que: string, hacer: string): Mensaje => ({ que, datos: DATOS_A_SALVO, hacer });
  switch (causa) {
    case 'sin-senal':
      return m(
        'No hay señal para sincronizar.',
        'Sigue registrando: se envía solo cuando vuelva la señal.',
      );
    case 'sin-sesion':
      return m(
        'La sesión para sincronizar venció.',
        'Se renueva sola cuando haya señal. Si sigue así, entra de nuevo en «Cuenta».',
      );
    case 'ahorro':
      return m(
        'La nube está ahorrando: lo del equipo se revisa cada hora y las fotos se suben más tarde.',
        'No tienes que hacer nada.',
      );
    case 'esencial':
      return m(
        `La nube está en modo esencial hasta ${hasta}: tus registros suben, pero lo del equipo baja después.`,
        'No tienes que hacer nada; sigue registrando.',
      );
    case 'bloqueo':
      return m(
        `La sincronización está en pausa hasta ${hasta}: la nube llegó a su límite de hoy.`,
        'Sigue registrando: todo se envía solo después de esa hora.',
      );
    case 'apagado':
      return m(
        'La sincronización está en pausa por mantenimiento.',
        `Sigue registrando: se reintenta sola en unos ${minutos} min.`,
      );
    case 'app-vieja':
      return m(
        'Esta versión del cuaderno ya es vieja.',
        'Actualízala: abre el cuaderno con señal y toca «Actualizar ahora» cuando aparezca.',
      );
    case 'mudanza':
      return m(
        'Tu finca se está mudando de servidor.',
        'No tienes que hacer nada: lo pendiente se envía solo cuando termine.',
      );
    case 'espera':
      return m('La nube pidió una pausa corta.', `Se reintenta sola en unos ${minutos} min.`);
  }
}

const deServidor = (estado: string | undefined): Causa | null => {
  if (
    estado === 'apagado' ||
    estado === 'bloqueo' ||
    estado === 'esencial' ||
    estado === 'mudanza'
  ) {
    return estado;
  }
  if (estado === 'protocolo') return 'app-vieja';
  return null;
};

/** La causa de la pausa en un estado de la sincronización, o null si no hay pausa. */
export function causaDe(e: EstadoDeSincronizacion): {
  causa: Causa;
  reanuda?: number;
  ms?: number;
} | null {
  if (e.tipo === 'sin-sesion') return { causa: 'sin-sesion' };
  if (e.tipo !== 'resultado') return null;
  const envio: ResultadoDeEnvio = e.resultado;
  if (envio.estado === 'sin-senal') return { causa: 'sin-senal' };
  if (envio.estado === 'sin-sesion') return { causa: 'sin-sesion' };
  if (envio.estado === 'esperar')
    return conCausa(deServidor(envio.causa) ?? 'espera', envio.reanuda, envio.ms);
  if (envio.estado === 'error') {
    const c = deServidor(envio.causa);
    return c ? { causa: c } : null;
  }
  if (envio.estado === 'al-dia' && envio.actualizar) return { causa: 'app-vieja' };
  const r: ResultadoDeRecepcion | undefined = e.recepcion;
  if (!r) return null;
  if (r.estado === 'sin-senal') return { causa: 'sin-senal' };
  if (r.estado === 'sin-sesion') return { causa: 'sin-sesion' };
  if (r.estado === 'esperar') return conCausa(deServidor(r.causa) ?? 'espera', r.reanuda, r.ms);
  if (r.estado === 'al-dia' && r.nivel === 'ahorro') return { causa: 'ahorro' };
  return null;
}

function conCausa(causa: Causa, reanuda: string | undefined, ms: number) {
  const fecha = reanuda ? Date.parse(reanuda) : Number.NaN;
  return Number.isFinite(fecha) ? { causa, reanuda: fecha, ms } : { causa, ms };
}

/**
 * No es una pausa: la celda vio la hora de este teléfono adelantada más de 10 min (ARQUITECTURA
 * §5.7, P8). Los registros se guardaron, pero con la hora del teléfono; se pide corregirla.
 */
export const AVISO_RELOJ: Mensaje = {
  que: 'La hora de este teléfono está adelantada.',
  datos: 'Tus registros se guardaron, con la hora que marcaba el teléfono.',
  hacer: 'Corrige la fecha y la hora en los ajustes del teléfono (activa «hora automática»).',
};

/** Las que merecen un aviso arriba en todas las pantallas; las demás se ven en Cuenta. */
export const CAUSAS_CON_AVISO: ReadonlySet<Causa> = new Set([
  'esencial',
  'bloqueo',
  'apagado',
  'mudanza',
]);
