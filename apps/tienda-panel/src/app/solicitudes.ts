/**
 * Las solicitudes en el panel sin la pantalla (HU-T9.7): el vencimiento en palabras, con su tono, y
 * cómo le llega la respuesta a la persona. Puras, para probarlas sin navegador.
 */
import type { Tono } from './componentes/estados.ts';

export type Alerta = 'vencida' | 'hoy' | 'pronto' | null;
export type EstadoDeSolicitud = 'radicada' | 'en_tramite' | 'respondida' | 'cerrada';

export interface FilaDeSolicitud {
  id: string;
  radicado: string;
  tipo: string;
  tipoId: string;
  estado: EstadoDeSolicitud;
  creada: string;
  vence: string;
  respondida: string | null;
  cerrada: string | null;
  pedido: number | null;
  dias: number;
  alerta: Alerta;
  reloj: 'respuesta' | 'reembolso';
}

export interface ReembolsoPendiente {
  pedidoId: string;
  pedido: number;
  aprobado: string;
  vence: string;
  dias: number;
  alerta: Alerta;
}

export interface Solicitudes {
  solicitudes: FilaDeSolicitud[];
  reembolsos: ReembolsoPendiente[];
}

export interface DetalleDeSolicitud {
  estado: 'ok';
  solicitud: FilaDeSolicitud;
  contacto: string;
  texto: string;
  codigoDelPedido: string | null;
  respuesta: { texto: string; instante: string } | null;
}

export const ESTADOS_DE_SOLICITUD: Readonly<
  Record<EstadoDeSolicitud, { texto: string; tono: Tono }>
> = {
  radicada: { texto: 'Por responder', tono: 'pendiente' },
  en_tramite: { texto: 'En trámite', tono: 'en-curso' },
  respondida: { texto: 'Respondida', tono: 'bien' },
  cerrada: { texto: 'Cerrada', tono: 'neutro' },
};

const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
/** «30 de octubre», de un `AAAA-MM-DD`. */
export const enFecha = (fecha: string) => FECHA.format(new Date(`${fecha}T12:00:00Z`));

const dias = (n: number) => (n === 1 ? '1 día' : `${n} días`);

/**
 * El vencimiento en palabras y su tono (CA1 y CA3). El texto dice lo mismo que el color: vencida
 * es «mal», a 3 días o el mismo día es «pendiente»; sin aviso, la fecha y nada más.
 */
export function vencimientoEnPalabras(
  f: Pick<FilaDeSolicitud, 'vence' | 'dias' | 'alerta'>,
  plazo: 'responder' | 'reembolsar' = 'responder',
): { texto: string; tono: Tono } {
  if (f.alerta === 'vencida')
    return {
      texto: `Venció hace ${dias(-f.dias)}, sin ${plazo === 'responder' ? 'respuesta' : 'reembolso'}`,
      tono: 'mal',
    };
  if (f.alerta === 'hoy')
    return { texto: `Vence hoy: ${plazo} antes de que acabe el día`, tono: 'pendiente' };
  if (f.alerta === 'pronto')
    return { texto: `Vence en ${dias(f.dias)}, el ${enFecha(f.vence)}`, tono: 'pendiente' };
  return { texto: `Vence el ${enFecha(f.vence)}`, tono: 'neutro' };
}

export const MINIMO_DE_LA_RESPUESTA = 10;

/** Lo que revisa «Guardar la respuesta», lo mismo que la API (422). */
export function revisarRespuesta(texto: string): { campo: string; mensaje: string }[] {
  const t = texto.trim();
  if (t.length < MINIMO_DE_LA_RESPUESTA)
    return [
      {
        campo: 'respuesta',
        mensaje: t
          ? 'La respuesta necesita al menos 10 caracteres: di qué vas a hacer.'
          : 'Escribe la respuesta que le vas a mandar.',
      },
    ];
  if (t.length > 4000)
    return [{ campo: 'respuesta', mensaje: 'La respuesta pasa de 4.000 caracteres: acórtala.' }];
  return [];
}

export const mensajeDeRespuesta = (radicado: string, respuesta: string) =>
  `Respuesta a tu solicitud ${radicado}:\n\n${respuesta.trim()}`;

/**
 * Por dónde le llega la respuesta: el contacto que dejó la persona. Un correo abre el correo; un
 * celular de Colombia abre WhatsApp con ese número; lo demás no se adivina y queda para copiar.
 */
export function envioDeLaRespuesta(
  contacto: string,
  radicado: string,
  respuesta: string,
): { por: 'correo' | 'whatsapp'; href: string } | null {
  const mensaje = mensajeDeRespuesta(radicado, respuesta);
  const c = contacto.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))
    return {
      por: 'correo',
      href: `mailto:${c}?subject=${encodeURIComponent(`Tu solicitud ${radicado}`)}&body=${encodeURIComponent(mensaje)}`,
    };
  const numero = c.replace(/[\s().-]/g, '').replace(/^\+/, '');
  const celular = /^3\d{9}$/.test(numero)
    ? `57${numero}`
    : /^573\d{9}$/.test(numero)
      ? numero
      : null;
  if (celular)
    return {
      por: 'whatsapp',
      href: `https://wa.me/${celular}?text=${encodeURIComponent(mensaje)}`,
    };
  return null;
}
