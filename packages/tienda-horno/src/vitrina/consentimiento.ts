/**
 * GA4 y el píxel de Meta, solo con el consentimiento del comprador (HU-T14.4, TIENDA §11.6,
 * Decreto 1377 art. 7: el silencio no autoriza; D-T13).
 *
 * - El aviso viene horneado y oculto (`[data-consentimiento]`), con los códigos que el comercio
 *   configuró. Se muestra mientras la persona no decida esta versión del aviso; aceptar y rechazar
 *   son dos botones iguales.
 * - Nada de Google ni de Meta carga antes de aceptar: ni un programa ni una solicitud.
 * - La decisión se guarda en el teléfono con su versión y su fecha. Si el aviso cambia de versión,
 *   se vuelve a preguntar. «Tus datos de medición», en el pie, vuelve a abrir el aviso.
 * - GA4 deja su cookie solo en la dirección de la tienda (`cookie_domain`): una tienda en
 *   laboratorio-digital.app no comparte al comprador con las demás (D-T13).
 * - Cada compra lleva el código del pedido (CA1): `transaction_id` en GA4 y `eventID` en Meta.
 */

export const VERSION_DEL_CONSENTIMIENTO = 1;
export const CLAVE_DEL_CONSENTIMIENTO = 'tienda:consentimiento';
const GA4 = /^G-[A-Z0-9]{4,12}$/;
const PIXEL = /^\d{8,20}$/;

export interface Decision {
  v: number;
  acepta: boolean;
  instante: string;
}

interface Almacen {
  getItem(clave: string): string | null;
  setItem(clave: string, valor: string): void;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: unknown };
    _fbq?: unknown;
  }
}

/** La decisión vigente, si la persona ya decidió esta versión del aviso. */
export function leerDecision(almacen: Almacen | null): Decision | null {
  try {
    const d = JSON.parse(almacen?.getItem(CLAVE_DEL_CONSENTIMIENTO) ?? 'null') as Decision | null;
    return d && d.v === VERSION_DEL_CONSENTIMIENTO && typeof d.acepta === 'boolean' ? d : null;
  } catch {
    return null;
  }
}

function guardarDecision(almacen: Almacen | null, acepta: boolean): void {
  try {
    almacen?.setItem(
      CLAVE_DEL_CONSENTIMIENTO,
      JSON.stringify({
        v: VERSION_DEL_CONSENTIMIENTO,
        acepta,
        instante: new Date().toISOString(),
      } satisfies Decision),
    );
  } catch {
    // Sin almacén, se vuelve a preguntar en la próxima página: nunca se asume que aceptó.
  }
}

let cargados = false;

function programa(src: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.append(s);
}

/** Carga lo que el comercio configuró. Solo se llama después de aceptar. */
function cargar(ga4: string | undefined, pixel: string | undefined): void {
  if (cargados) return;
  cargados = true;
  if (ga4 && GA4.test(ga4)) {
    window.dataLayer = window.dataLayer ?? [];
    // GA4 lee el objeto `arguments`, no un arreglo.
    window.gtag = function gtag() {
      // biome-ignore lint/complexity/noArguments: así lo pide gtag.js.
      window.dataLayer?.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', ga4, { cookie_domain: location.hostname });
    programa(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`);
  }
  if (pixel && PIXEL.test(pixel)) {
    const fbq = function pixelDeMeta(...args: unknown[]) {
      const f = window.fbq;
      if (f && typeof f.callMethod === 'function')
        (f.callMethod as (...a: unknown[]) => void)(...args);
      else f?.queue?.push(args);
    } as NonNullable<Window['fbq']>;
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    programa('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', pixel);
    fbq('track', 'PageView');
  }
}

/** Muestra el aviso si hace falta y carga lo aceptado. Sin aviso horneado, no hace nada. */
export function iniciarConsentimiento(almacen: Almacen | null = guardado()): void {
  const aviso = document.querySelector<HTMLElement>('[data-consentimiento]');
  if (!aviso || document.documentElement.hasAttribute('data-vista-previa')) return;
  const { ga4, pixel } = aviso.dataset;
  const decision = leerDecision(almacen);
  if (decision?.acepta) cargar(ga4, pixel);
  else if (!decision) aviso.hidden = false;
  const decidir = (acepta: boolean) => {
    guardarDecision(almacen, acepta);
    aviso.hidden = true;
    if (acepta) cargar(ga4, pixel);
    // Rechazar después de aceptar: lo ya cargado se va con la próxima página.
  };
  aviso.querySelector('[data-aceptar]')?.addEventListener('click', () => decidir(true));
  aviso.querySelector('[data-rechazar]')?.addEventListener('click', () => decidir(false));
  for (const b of document.querySelectorAll('[data-preferencias]'))
    b.addEventListener('click', () => {
      aviso.hidden = false;
      aviso.querySelector<HTMLElement>('[data-aceptar]')?.focus();
    });
}

/** CA1: una compra, con el código del pedido. Solo si la persona aceptó y algo se cargó. */
export function medirCompra(codigo: string, totalCop?: number): void {
  if (!cargados) return;
  const valor = typeof totalCop === 'number' ? { value: totalCop, currency: 'COP' } : {};
  window.gtag?.('event', 'purchase', { transaction_id: codigo, ...valor });
  window.fbq?.('track', 'Purchase', { ...valor }, { eventID: codigo });
}

function guardado(): Almacen | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}
