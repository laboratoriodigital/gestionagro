/**
 * Qué falta para enviar el pedido (HU-T6.1): el botón dice lo primero que falta, y al tocarlo lleva
 * a ese campo, como el de la ficha (HU-T3.4). Puro, para probarlo sin navegador.
 */

export type Falta = 'lineas' | 'forma' | 'envio' | 'acepta';

export interface EstadoDeLaVenta {
  listo: boolean;
  texto: string;
  falta?: Falta;
}

const TEXTOS: Record<Falta, string> = {
  lineas: 'Tu pedido está vacío',
  forma: 'Elige cómo pagar',
  envio: 'Elige cómo te llega',
  acepta: 'Acepta los términos para enviar',
};

export function estadoDeLaVenta(v: {
  lineas: number;
  forma: string | null;
  hayEnvios: boolean;
  envio: string | null;
  acepta: boolean;
}): EstadoDeLaVenta {
  const falta: Falta | undefined =
    v.lineas === 0
      ? 'lineas'
      : !v.forma
        ? 'forma'
        : v.hayEnvios && !v.envio
          ? 'envio'
          : !v.acepta
            ? 'acepta'
            : undefined;
  return falta
    ? { listo: false, texto: TEXTOS[falta], falta }
    : { listo: true, texto: 'Enviar por WhatsApp' };
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
