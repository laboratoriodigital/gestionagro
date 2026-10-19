/**
 * El adaptador del proveedor de pagos (ED1 §5.3: «el CORE se comunica con el proveedor a través de
 * un adaptador para poder cambiarlo»). Vivía en el CORE; pasó aquí con HU-T11.1 para que haya uno
 * solo (P2): el CORE lo usa con sus llaves para cobrar los planes y la Tienda con las de cada
 * comercio para cobrar sus ventas. Las llaves llegan en cada llamada; el paquete no guarda nada.
 * Quien lo usa decide qué se cobra y qué se activa; aquí solo se habla con el proveedor.
 *
 * Bold, el primero (HU-E0.7), con el Botón de pagos y el método que la Tienda 2.0 ya probó (su
 * `PAGOS-BOLD.md`): la firma de integridad es SHA-256 de orden + monto + COP + llave secreta, y la
 * verdad de un pago se le pregunta a su API autenticada (`payment-voucher`).
 *
 * Los estados de Bold se traducen solo aquí (TIENDA §9.5). Uno que no se conoce es «revisar»,
 * nunca «aprobado» (CA3): si Bold estrena un estado, nadie recibe un plan o un pedido pagado por
 * un nombre que nadie leyó. `VOIDED` sigue siendo rechazo, como en el CORE; la Tienda distingue el
 * reembolso por `crudo` (HU-T11.6).
 */

/** Lo que el proveedor dice de un cobro, ya traducido. */
export interface EstadoEnElProveedor {
  estado: 'aprobado' | 'rechazado' | 'esperando' | 'revisar';
  /** Lo que el proveedor dice que se pagó; null si no lo sabe todavía. */
  total: number | null;
  transaccion: string | null;
  /** Lo que respondió, tal cual, para el log y para decir «en proceso» o «sin noticias». */
  crudo: string;
}

export interface ProveedorDePago {
  nombre: 'bold';
  ambiente: 'pruebas' | 'produccion';
  /** Lo que la página necesita para abrir el pago: el programa y los datos firmados. */
  prepararCobro(cobro: {
    orden: string;
    monto: number;
    descripcion: string;
    vuelta: string;
  }): Promise<{ libreria: string; checkout: Record<string, string> }>;
  consultar(orden: string): Promise<EstadoEnElProveedor>;
  /**
   * HU-T11.8 (TIENDA §9.6): un link de pago de monto cerrado, con la referencia del cobro y su
   * vencimiento. El aviso de Bold trae esa referencia, como el del botón.
   */
  crearLink(link: {
    referencia: string;
    monto: number;
    descripcion: string;
    /** Instante ISO en que deja de servir. */
    vence: string;
  }): Promise<{ link: string; url: string }>;
  /** El estado de un link (`GET /online/link/v1/{id}`), traducido como el de un cobro. */
  consultarLink(link: string): Promise<EstadoEnElProveedor>;
}

/** Bold respondió con un error: `estado` es el HTTP, para que quien llama distinga un 429 (HU-T11.6). */
export class ErrorDeBold extends Error {
  readonly estado: number;
  constructor(estado: number) {
    super(`Bold respondió ${estado}`);
    this.name = 'ErrorDeBold';
    this.estado = estado;
  }
}

export const LIBRERIA_BOLD = 'https://checkout.bold.co/library/boldPaymentButton.js';
const CONSULTA_BOLD = 'https://payments.api.bold.co/v2/payment-voucher/';
/** La API de links de pago (developers.bold.co, «API Link de pagos»). */
export const LINKS_BOLD = 'https://integrations.api.bold.co/online/link/v1';
/** Los estados que Bold documenta, y lo que cada uno quiere decir aquí (TIENDA §9.5). */
export const ESTADOS_BOLD: Readonly<Record<string, EstadoEnElProveedor['estado']>> = {
  APPROVED: 'aprobado',
  REJECTED: 'rechazado',
  FAILED: 'rechazado',
  VOIDED: 'rechazado',
  PENDING: 'esperando',
  PROCESSING: 'esperando',
  NO_TRANSACTION_FOUND: 'esperando',
};

/**
 * Los estados de un link de pago. `ACTIVE` sigue esperando aunque un intento haya fallado;
 * `EXPIRED` y `CANCELLED` ya no se pagan: quien llama vence el cobro (HU-T11.8 CA2).
 */
export const ESTADOS_LINK: Readonly<Record<string, EstadoEnElProveedor['estado']>> = {
  ACTIVE: 'esperando',
  PROCESSING: 'esperando',
  PAID: 'aprobado',
  REJECTED: 'rechazado',
  CANCELLED: 'rechazado',
  EXPIRED: 'rechazado',
};

/** El estado de Bold, traducido. Lo que no está en la lista es «revisar» (CA3). */
export const estadoDeBold = (crudo: string): EstadoEnElProveedor['estado'] =>
  Object.hasOwn(ESTADOS_BOLD, crudo)
    ? (ESTADOS_BOLD[crudo] as EstadoEnElProveedor['estado'])
    : 'revisar';

export interface LlavesBold {
  identidad: string;
  secreta: string;
  ambiente: 'pruebas' | 'produccion';
}

export async function firmaDeIntegridad(
  orden: string,
  monto: number,
  secreta: string,
): Promise<string> {
  const datos = new TextEncoder().encode(`${orden}${monto}COP${secreta}`);
  const resumen = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function proveedorBold(llaves: LlavesBold, fetchFn: typeof fetch): ProveedorDePago {
  return {
    nombre: 'bold',
    ambiente: llaves.ambiente,
    async prepararCobro({ orden, monto, descripcion, vuelta }) {
      return {
        libreria: LIBRERIA_BOLD,
        checkout: {
          orderId: orden,
          currency: 'COP',
          amount: String(monto),
          apiKey: llaves.identidad,
          integritySignature: await firmaDeIntegridad(orden, monto, llaves.secreta),
          description: descripcion.slice(0, 100),
          redirectionUrl: vuelta,
        },
      };
    },
    async crearLink({ referencia, monto, descripcion, vence }) {
      const r = await fetchFn(LINKS_BOLD, {
        method: 'POST',
        headers: {
          authorization: `x-api-key ${llaves.identidad}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          amount_type: 'CLOSE',
          amount: { currency: 'COP', total_amount: monto, tip_amount: 0, taxes: [] },
          reference: referencia,
          description: descripcion.slice(0, 100),
          // Nanosegundos desde la época, como `expirationDate` del botón.
          expiration_date: Number(BigInt(Date.parse(vence)) * 1_000_000n),
        }),
      });
      const dato = (await r.json().catch(() => null)) as {
        payload?: { payment_link?: unknown; url?: unknown };
      } | null;
      const link = dato?.payload?.payment_link;
      const url = dato?.payload?.url;
      if (
        !r.ok ||
        typeof link !== 'string' ||
        typeof url !== 'string' ||
        !url.startsWith('https://')
      )
        throw new ErrorDeBold(r.status);
      return { link, url };
    },
    async consultarLink(link) {
      const r = await fetchFn(`${LINKS_BOLD}/${encodeURIComponent(link)}`, {
        headers: { authorization: `x-api-key ${llaves.identidad}`, accept: 'application/json' },
      });
      const d = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      if (!r.ok || !d) throw new ErrorDeBold(r.status);
      const crudo = String(d['status'] ?? '').toUpperCase();
      return {
        estado: Object.hasOwn(ESTADOS_LINK, crudo)
          ? (ESTADOS_LINK[crudo] as EstadoEnElProveedor['estado'])
          : 'revisar',
        total: typeof d['total'] === 'number' ? d['total'] : null,
        transaccion:
          typeof d['transaction_id'] === 'string' ? d['transaction_id'].slice(0, 80) : null,
        crudo,
      };
    },
    async consultar(orden) {
      const r = await fetchFn(`${CONSULTA_BOLD}${encodeURIComponent(orden)}`, {
        headers: { authorization: `x-api-key ${llaves.identidad}`, accept: 'application/json' },
      });
      // 404 es la forma de Bold de decir «todavía no sé nada»: no es un rechazo.
      if (r.status === 404) {
        return {
          estado: 'esperando',
          total: null,
          transaccion: null,
          crudo: 'NO_TRANSACTION_FOUND',
        };
      }
      const dato = (await r.json().catch(() => null)) as Record<string, unknown> | null;
      if (!r.ok || !dato) throw new ErrorDeBold(r.status);
      const d = (dato['payload'] as Record<string, unknown> | undefined) ?? dato;
      const crudo = String(d['payment_status'] ?? 'NO_TRANSACTION_FOUND').toUpperCase();
      const total = d['total'];
      return {
        estado: estadoDeBold(crudo),
        total: total === undefined || total === null || total === '' ? null : Number(total),
        transaccion:
          typeof d['transaction_id'] === 'string' ? d['transaction_id'].slice(0, 80) : null,
        crudo,
      };
    },
  };
}
