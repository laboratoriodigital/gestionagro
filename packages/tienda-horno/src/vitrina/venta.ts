/**
 * Qué falta para enviar el pedido (HU-T6.1): el botón dice lo primero que falta, y al tocarlo lleva
 * a ese campo, como el de la ficha (HU-T3.4). Pagando en línea (HU-T11.4) faltan también el nombre
 * y el celular de quien recibe, porque no hay chat donde darlos. Puro, para probarlo sin navegador.
 */

export type Falta = 'lineas' | 'forma' | 'envio' | 'entrega' | 'acepta';

export interface EstadoDeLaVenta {
  listo: boolean;
  texto: string;
  falta?: Falta;
}

const TEXTOS: Record<Falta, string> = {
  lineas: 'Tu pedido está vacío',
  forma: 'Elige cómo pagar',
  envio: 'Elige cómo te llega',
  entrega: 'Escribe tu nombre y tu celular',
  acepta: 'Acepta los términos para enviar',
};

export function estadoDeLaVenta(v: {
  lineas: number;
  forma: string | null;
  hayEnvios: boolean;
  envio: string | null;
  acepta: boolean;
  /** Pagando en línea: el nombre y el celular de quien recibe están bien escritos. */
  entrega?: boolean;
}): EstadoDeLaVenta {
  const enLinea = v.forma === 'en_linea';
  const falta: Falta | undefined =
    v.lineas === 0
      ? 'lineas'
      : !v.forma
        ? 'forma'
        : v.hayEnvios && !v.envio
          ? 'envio'
          : enLinea && !v.entrega
            ? 'entrega'
            : !v.acepta
              ? 'acepta'
              : undefined;
  return falta
    ? { listo: false, texto: TEXTOS[falta], falta }
    : { listo: true, texto: enLinea ? 'Pagar en línea' : 'Enviar por WhatsApp' };
}

/** Un celular de Colombia: 10 dígitos que empiezan por 3, con o sin +57, espacios o guiones. */
export function celularValido(texto: string): boolean {
  const d = texto.replace(/\D/g, '');
  return /^3\d{9}$/.test(d.length === 12 && d.startsWith('57') ? d.slice(2) : d);
}

/** El primer dato de entrega que falta o está mal escrito; `null` si están los dos. */
export function faltaDeLaEntrega(e: {
  nombre: string;
  celular: string;
}): 'nombre' | 'celular' | null {
  if (e.nombre.trim().length < 2) return 'nombre';
  if (!celularValido(e.celular)) return 'celular';
  return null;
}

/** Lee `#c=<código>&s=<secreto>` del fragmento: nunca de la ruta ni de la consulta (P13). */
export function leerFragmento(hash: string): { codigo: string; secreto: string } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const codigo = p.get('c') ?? '';
  const secreto = p.get('s') ?? '';
  return /^[0-9A-HJKMNP-TV-Z]{6}$/.test(codigo) && /^[A-Za-z0-9_-]{22}$/.test(secreto)
    ? { codigo, secreto }
    : null;
}

/** Lo que la página hace al volver de Bold (HU-T11.9), según lo que la API dijo del cobro. */
export interface VueltaDelPago {
  /** `vaciar`: el pedido se pagó; `conservar`: tal cual; `renovar`: las líneas, con otro código. */
  carrito: 'vaciar' | 'conservar' | 'renovar';
  /** Ir al pedido con el enlace guardado, si lo hay. */
  irAlPedido: boolean;
  /** Lo que se le dice a la persona si se queda en la página. */
  texto: string | null;
}

export const TEXTO_SIN_EL_PAGO =
  'No encontramos tu pago en este navegador. Si pagaste desde otro o se cerró la página, abre el enlace de tu pedido que guardaste antes de pagar. Si no lo tienes, escríbele a la tienda con tu nombre y tu celular: con eso encuentra tu pedido.';

/**
 * HU-T11.9 CA2: la vuelta de Bold. `estado` es lo que respondió `POST /api/v1/cobros/estado` con
 * el token de esta sesión, o `null` si no hay token o no respondió: entonces se explica cómo
 * encontrar el pedido, sin un error. Lo que Bold pone en la dirección nunca entra aquí (§9.3).
 * Un pago que no pasó deja las líneas en el carrito, con otro código, para intentarlo otra vez
 * (bitácora ecommerce 47).
 */
export function vueltaDelPago(estado: string | null, hayEnlace: boolean): VueltaDelPago {
  switch (estado) {
    case 'pagado':
    case 'revisar':
    case 'reembolsado':
      return {
        carrito: 'vaciar',
        irAlPedido: hayEnlace,
        texto: hayEnlace ? null : TEXTO_SIN_EL_PAGO,
      };
    case 'esperando':
      return {
        carrito: 'conservar',
        irAlPedido: hayEnlace,
        texto: hayEnlace
          ? null
          : 'Tu pago sigue en proceso. Cuando Bold lo apruebe, la tienda lo verá en tu pedido.',
      };
    case 'rechazado':
      return {
        carrito: 'renovar',
        irAlPedido: false,
        texto:
          'Bold no aprobó el pago y no se te cobró. Tus productos siguen en el carrito para intentarlo otra vez.',
      };
    case 'vencido':
      return {
        carrito: 'renovar',
        irAlPedido: false,
        texto:
          'El pago no se completó a tiempo. Tus productos siguen en el carrito para intentarlo otra vez.',
      };
    default:
      return {
        carrito: 'conservar',
        irAlPedido: hayEnlace,
        texto: hayEnlace ? null : TEXTO_SIN_EL_PAGO,
      };
  }
}

/** Lee `#r=<radicado>&s=<secreto>` del fragmento de `/solicitud/` (HU-T6.4): nunca de otra parte. */
export function leerRadicado(hash: string): { radicado: number; secreto: string } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const r = p.get('r') ?? '';
  const secreto = p.get('s') ?? '';
  return /^[1-9][0-9]{0,8}$/.test(r) && /^[A-Za-z0-9_-]{22}$/.test(secreto)
    ? { radicado: Number(r), secreto }
    : null;
}

export type FaltaEnLaSolicitud = 'tipo' | 'texto' | 'contacto' | 'acepta';

const TEXTOS_DE_LA_SOLICITUD: Record<FaltaEnLaSolicitud, string> = {
  tipo: 'Elige qué necesitas',
  texto: 'Cuéntanos qué pasa (al menos 10 letras)',
  contacto: 'Dinos cómo te respondemos',
  acepta: 'Autoriza el uso de tus datos para enviar',
};

/** Qué falta para radicar (HU-T6.4): lo mismo que la API exige, dicho antes de enviar. */
export function estadoDeLaSolicitud(s: {
  tipo: string;
  texto: string;
  contacto: string;
  acepta: boolean;
}): { listo: boolean; texto: string; falta?: FaltaEnLaSolicitud } {
  const falta: FaltaEnLaSolicitud | undefined = !s.tipo
    ? 'tipo'
    : s.texto.trim().length < 10
      ? 'texto'
      : s.contacto.trim().length < 5
        ? 'contacto'
        : !s.acepta
          ? 'acepta'
          : undefined;
  return falta
    ? { listo: false, texto: TEXTOS_DE_LA_SOLICITUD[falta], falta }
    : { listo: true, texto: 'Enviar la solicitud' };
}
