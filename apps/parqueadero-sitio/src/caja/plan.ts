/**
 * El plan del parqueadero en la caja (HU-Q7.10; PARQUEADERO §11.1 y §14.2): qué plan tiene, hasta
 * cuándo sigue la nube, y pagar 1, 3, 6 o 12 meses con Bold por el CORE, como el cuaderno de
 * CultivoPro (`apps/cuaderno/src/almacen/pago.ts`, HU-E0.7 y HU-C5.3).
 *
 * El CORE pone el monto y firma el cobro; aquí solo se abre el checkout de Bold con eso, y al volver
 * se le pide al CORE que confirme con Bold: la dirección de vuelta no se cree. Pagado, la caja
 * renueva su acceso y el token trae el plan nuevo; la celda lo lee de ahí (`apps/parqueadero-api/
 * src/plan.ts`). Un plan vencido nunca detiene una entrada: solo pausa la nube (CA3).
 */
import planes from '../../../../content/parqueadero/planes.json' with { type: 'json' };
import type { Sesion } from './datos.ts';
import { fechaBogota } from './fecha.ts';

export interface Cobro {
  readonly orden: string;
  readonly pruebas: boolean;
  readonly libreria: string;
  readonly checkout: Record<string, string>;
}

export type EstadoDelPago = 'esperando' | 'aprobado' | 'rechazado' | 'revisar';

export interface RespuestaDelPago {
  readonly estado: EstadoDelPago;
  readonly motivo: string | null;
  readonly plan?: string;
  readonly plan_vence?: string | null;
}

/** Un periodo que se puede pagar: cuántos meses, el total, lo que sale al mes y lo que se ahorra. */
export interface Periodo {
  readonly meses: number;
  readonly total: number;
  readonly porMes: number;
  /** Frente a pagar mes a mes el mismo tiempo; 0 en el de un mes. */
  readonly ahorro: number;
}

interface PlanDelArchivo {
  readonly id: string;
  readonly nombre: string;
  readonly gratuito?: boolean;
  readonly cobro?: Readonly<Record<string, number>>;
}

const PLANES = planes.planes as readonly PlanDelArchivo[];

/** El plan que trae la nube: el que no es gratuito (`planes.json`, P2). */
export const PLAN_CON_NUBE = PLANES.find((p) => !p.gratuito)?.id ?? 'parqueadero';

export const nombreDelPlan = (id: string) => PLANES.find((p) => p.id === id)?.nombre ?? id;

/**
 * Los periodos del plan, de `cobro` en planes.json: la misma fuente que el despliegue copia a los
 * precios del CORE, que es quien cobra. Solo los de monto mayor que 0: nunca «COP 0».
 */
export function periodosDe(plan: string = PLAN_CON_NUBE): Periodo[] {
  const montos = Object.entries(PLANES.find((p) => p.id === plan)?.cobro ?? {})
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

export const nombreDelPeriodo = (meses: number) => (meses === 1 ? 'un mes' : `${meses} meses`);

/** «$29.900», como los montos de la caja. */
export const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`;

type Org = Sesion['organizaciones'][number];

/** Lo que la caja dice del plan de esa organización, en una o dos frases. */
export function textoDelPlan(org: Org, ahora: number): string {
  const plan = org.plan ?? 'gratis';
  if (plan !== PLAN_CON_NUBE) {
    return `Plan ${nombreDelPlan(plan)}: la caja funciona completa en este teléfono. La nube y las varias cajas son del plan ${nombreDelPlan(PLAN_CON_NUBE)}.`;
  }
  if (!org.plan_vence) return `Plan ${nombreDelPlan(plan)}: con la nube y las varias cajas.`;
  const hasta = fechaBogota(Date.parse(org.plan_vence));
  if (org.aviso === 'en-gracia') {
    return `El pago del plan ${nombreDelPlan(plan)} venció. La nube sigue hasta el ${hasta}, por los días de gracia; después queda en pausa y la caja sigue igual.`;
  }
  const dias = Math.ceil((Date.parse(org.plan_vence) - ahora) / 86_400_000);
  return `Plan ${nombreDelPlan(plan)}: la nube sigue hasta el ${hasta}${dias <= 7 ? ` (${dias === 1 ? 'mañana' : `en ${dias} días`})` : ''}.`;
}

/** La orden que vuelve de Bold en la dirección (`?pago=`), si es de un cobro del parqueadero. */
export function ordenDeLaVuelta(busqueda: string): string | null {
  const orden = new URLSearchParams(busqueda).get('pago');
  return orden && /^parqueadero-[0-9a-f-]{36}$/.test(orden) ? orden : null;
}

export class ErrorDePago extends Error {
  override name = 'ErrorDePago';
}

async function alCore<T>(
  core: string,
  ruta: string,
  acceso: string,
  cuerpo: unknown,
  fetchFn: typeof fetch,
): Promise<T> {
  let r: Response;
  try {
    r = await fetchFn(`${core}${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${acceso}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorDePago('Sin señal: el pago necesita internet. La caja sigue igual.');
  }
  const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    throw new ErrorDePago(
      typeof datos['motivo'] === 'string' ? datos['motivo'] : 'El pago no se pudo preparar.',
    );
  }
  return datos as T;
}

/** Prepara el cobro de `meses` del plan. El monto no viaja: el CORE lo saca de su precio vigente. */
export const crearCobro = (
  core: string,
  acceso: string,
  meses: number,
  vuelta: string,
  fetchFn: typeof fetch = fetch,
) =>
  alCore<Cobro>(
    core,
    '/api/core/pago/crear',
    acceso,
    { plan: PLAN_CON_NUBE, meses, vuelta },
    fetchFn,
  );

/** Al volver de Bold, el CORE pregunta a Bold cómo quedó el pago. */
export const confirmarCobro = (
  core: string,
  acceso: string,
  orden: string,
  fetchFn: typeof fetch = fetch,
) => alCore<RespuestaDelPago>(core, '/api/core/pago/confirmar', acceso, { orden }, fetchFn);

declare global {
  interface Window {
    BoldCheckout?: new (datos: Record<string, string>) => { open: () => void };
  }
}

/**
 * Carga el programa de Bold (solo al pagar: la política de la cuenta lo declara en
 * `scripts_al_pagar`, y la CSP de staging solo lo deja como script) y abre el checkout.
 */
export async function abrirCheckout(cobro: Cobro): Promise<void> {
  if (!window.BoldCheckout) {
    await new Promise<void>((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = cobro.libreria;
      s.async = true;
      s.onload = () => resolver();
      s.onerror = () => rechazar(new ErrorDePago('No cargó el pago. Intente otra vez.'));
      document.head.append(s);
    });
  }
  const Checkout = window.BoldCheckout;
  if (!Checkout) throw new ErrorDePago('No cargó el pago. Intente otra vez.');
  new Checkout(cobro.checkout).open();
}
