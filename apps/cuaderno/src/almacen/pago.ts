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

/** Un periodo que se puede pagar: cuántos meses, el total, lo que sale al mes y lo que se ahorra. */
export interface Periodo {
  meses: number;
  total: number;
  porMes: number;
  /** Frente a pagar mes a mes el mismo tiempo; 0 en el de un mes. */
  ahorro: number;
}

/**
 * Los periodos de un plan que se paga en línea (HU-C5.7), de `cobro` en planes.json: la misma
 * fuente que el despliegue copia a los precios del CORE (P2), que es quien cobra. Solo los que
 * tienen un monto mayor que 0: un periodo sin precio no aparece, y nunca se muestra «COP 0» (CA3).
 * Vacío si el plan no se paga en línea.
 */
export function periodosDe(plan: string): Periodo[] {
  const p = configPlanes.planes.find((x) => x.id === plan) as
    | { cobro?: Record<string, number> }
    | undefined;
  const montos = Object.entries(p?.cobro ?? {})
    .map(([meses, total]) => ({ meses: Number(meses), total }))
    .filter(({ meses, total }) => Number.isInteger(meses) && meses > 0 && total > 0)
    .sort((a, b) => a.meses - b.meses);
  const mensual = montos.find((m) => m.meses === 1)?.total;
  return montos.map(({ meses, total }) => ({
    meses,
    total,
    porMes: Math.round(total / meses),
    ahorro: mensual === undefined ? 0 : Math.max(0, mensual * meses - total),
  }));
}

/** «un mes», «3 meses». */
export const nombreDelPeriodo = (meses: number) => (meses === 1 ? 'un mes' : `${meses} meses`);

/** «COP 39.000» con el punto de miles de Colombia. */
export const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;

export const crearCobro = (
  db: CuadernoDb,
  core: string,
  plan: string,
  meses: number,
  vuelta: string,
  fetchFn: typeof fetch = fetch,
) =>
  // El monto no viaja: el CORE lo saca de su precio vigente para ese plan y ese periodo (HU-C5.3).
  pedirAlCore<Cobro>(db, core, '/api/core/pago/crear', { plan, meses, vuelta }, fetchFn);

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
