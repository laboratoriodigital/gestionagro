/**
 * Pagar un plan en línea con Bold (HU-E0.7), desde la pantalla de Planes. El CORE pone el monto y
 * firma el cobro; aquí solo se abre el checkout de Bold con exactamente eso, y al volver se le pide
 * al CORE que confirme con Bold. La dirección de vuelta no se cree: la puede escribir cualquiera.
 * Con señal, como todo lo de la cuenta.
 */
import configPlanes from '../../../../content/agro/cuaderno/planes.json' with { type: 'json' };
import type { CuadernoDb } from './db.ts';
import { pedirAlCore } from './equipo.ts';

export interface Cobro {
  orden: string;
  pruebas: boolean;
  libreria: string;
  checkout: Record<string, string>;
}

export type EstadoDelPago = 'esperando' | 'aprobado' | 'rechazado' | 'revisar';

export interface RespuestaDelPago {
  estado: EstadoDelPago;
  motivo: string | null;
  plan?: string;
  plan_vence?: string | null;
}

/** Lo que se cobra al mes por un plan (planes.json, P2); null si no se paga en línea. */
export function cobroMensual(plan: string): number | null {
  const p = configPlanes.planes.find((x) => x.id === plan) as
    | { cobro_mensual_cop?: number }
    | undefined;
  return p?.cobro_mensual_cop ?? null;
}

/** «COP 39.000» con el punto de miles de Colombia. */
export const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;

export const crearCobro = (
  db: CuadernoDb,
  core: string,
  plan: string,
  vuelta: string,
  fetchFn: typeof fetch = fetch,
) => pedirAlCore<Cobro>(db, core, '/api/core/pago/crear', { plan, vuelta }, fetchFn);

export const confirmarCobro = (
  db: CuadernoDb,
  core: string,
  orden: string,
  fetchFn: typeof fetch = fetch,
) => pedirAlCore<RespuestaDelPago>(db, core, '/api/core/pago/confirmar', { orden }, fetchFn);

/** La orden que Bold devuelve en la dirección (`?pago=`), si tiene la forma de las del CORE. */
export function ordenDeLaVuelta(busqueda: string): string | null {
  const orden = new URLSearchParams(busqueda).get('pago');
  return orden && /^agro-[0-9a-f-]{36}$/.test(orden) ? orden : null;
}

/** Días que le quedan a un plan pagado; null si no vence. */
export function diasParaVencer(vence: string | null | undefined, ahora: number): number | null {
  if (!vence) return null;
  return Math.max(0, Math.ceil((Date.parse(vence) - ahora) / (24 * 60 * 60 * 1000)));
}

declare global {
  interface Window {
    BoldCheckout?: new (datos: Record<string, string>) => { open: () => void };
  }
}

/** Carga el programa de Bold (solo al pagar: la política lo declara así) y abre el checkout. */
export async function abrirCheckout(cobro: Cobro): Promise<void> {
  if (!window.BoldCheckout) {
    await new Promise<void>((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = cobro.libreria;
      s.async = true;
      s.onload = () => resolver();
      s.onerror = () => rechazar(new Error('No cargó Bold'));
      document.head.append(s);
    });
  }
  const Checkout = window.BoldCheckout;
  if (!Checkout) throw new Error('No cargó Bold');
  new Checkout(cobro.checkout).open();
}
