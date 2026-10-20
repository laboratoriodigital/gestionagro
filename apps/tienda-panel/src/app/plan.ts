/**
 * El plan de la tienda (HU-T13.5 CA1): los planes y sus periodos de 1, 3, 6 o 12 meses, y pagarlos
 * con el Bold de Laboratorio Digital, en el CORE. El CORE pone el monto (de su precio vigente, nunca
 * del panel) y confirma con Bold; aquí solo se abre el checkout con lo que el CORE firmó y, al
 * volver, se le pide confirmar. Después la sesión se renueva: el token nuevo trae el plan pagado.
 */
import planes from '../../../../content/tienda/planes.json' with { type: 'json' };
import type { Conexion } from './api.ts';
import { ErrorDeSesion, leerSesion, renovar } from './sesion.ts';

export interface Periodo {
  meses: number;
  total: number;
  porMes: number;
  /** Frente a pagar mes a mes el mismo tiempo; 0 en el de un mes. */
  ahorro: number;
}

export interface PlanDeLaTienda {
  id: string;
  nombre: string;
  gratuito: boolean;
  paraQuien: string;
  incluye: string[];
  periodos: Periodo[];
}

/** Los planes de `planes.json`, con los periodos que se pagan en línea (la misma fuente del CORE). */
export function planesDeLaTienda(): PlanDeLaTienda[] {
  return planes.planes.map((p) => {
    const cobro = ('cobro' in p ? p.cobro : {}) as Record<string, number>;
    const montos = Object.entries(cobro)
      .map(([meses, total]) => ({ meses: Number(meses), total }))
      .filter(({ meses, total }) => Number.isInteger(meses) && meses > 0 && total > 0)
      .sort((a, b) => a.meses - b.meses);
    const mensual = montos.find((m) => m.meses === 1)?.total;
    return {
      id: p.id,
      nombre: p.nombre,
      gratuito: 'gratuito' in p && p.gratuito === true,
      paraQuien: p.para_quien,
      incluye: p.incluye,
      periodos: montos.map(({ meses, total }) => ({
        meses,
        total,
        porMes: Math.round(total / meses),
        ahorro: mensual === undefined ? 0 : Math.max(0, mensual * meses - total),
      })),
    };
  });
}

/** «un mes», «3 meses». */
export const nombreDelPeriodo = (meses: number) => (meses === 1 ? 'un mes' : `${meses} meses`);

/** «COP 39.000», con el punto de miles de Colombia. */
export const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;

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

type Respuesta<T> = { tipo: 'ok'; datos: T } | { tipo: 'problema'; motivo: string };

const SIN_SENAL =
  'Sin conexión: no pudimos hablar con tu cuenta. Revisa la señal e intenta de nuevo.';

/** Un POST al CORE con la sesión vigente; la renueva si hace falta. */
async function alCore<T>(c: Conexion, ruta: string, cuerpo: unknown): Promise<Respuesta<T>> {
  let sesion = await leerSesion(c.almacen);
  if (!sesion) throw new ErrorDeSesion('Entra con tu cuenta.');
  if (sesion.acceso_vence <= (c.ahora ?? Date.now)()) {
    const r = await renovar(c.almacen, c.core, c.fetchFn ? { fetchFn: c.fetchFn } : {});
    if (!r.sesion) throw new ErrorDeSesion(r.motivo ?? 'Tu sesión venció. Vuelve a entrar.');
    sesion = r.sesion;
  }
  let r: Response;
  try {
    r = await (c.fetchFn ?? fetch)(`${c.core}${ruta}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion.acceso}`, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    return { tipo: 'problema', motivo: SIN_SENAL };
  }
  if (r.status === 401) throw new ErrorDeSesion('Tu sesión venció. Vuelve a entrar.');
  const datos = (await r.json().catch(() => ({}))) as T & { motivo?: string };
  if (!r.ok)
    return { tipo: 'problema', motivo: datos.motivo ?? 'No pudimos hablar con tu cuenta ahora.' };
  return { tipo: 'ok', datos };
}

/** CA1: el cobro de un plan por un periodo. El monto no viaja: lo pone el CORE. */
export const crearCobro = (c: Conexion, plan: string, meses: number, vuelta: string) =>
  alCore<Cobro>(c, '/api/core/pago/crear', { plan, meses, vuelta });

/**
 * Al volver de Bold: el CORE confirma con Bold. Si quedó aprobado, la sesión se renueva para que el
 * token traiga el plan nuevo.
 */
export async function confirmarCobro(
  c: Conexion,
  orden: string,
): Promise<Respuesta<RespuestaDelPago>> {
  const r = await alCore<RespuestaDelPago>(c, '/api/core/pago/confirmar', { orden });
  if (r.tipo === 'ok' && r.datos.estado === 'aprobado')
    await renovar(c.almacen, c.core, c.fetchFn ? { fetchFn: c.fetchFn } : {});
  return r;
}

/** La orden que vuelve en la dirección (`?pago=`), si tiene la forma de las de la Tienda en el CORE. */
export function ordenDeLaVuelta(busqueda: string): string | null {
  const orden = new URLSearchParams(busqueda).get('pago');
  return orden && /^tienda-[0-9a-f-]{36}$/.test(orden) ? orden : null;
}

/** Días que le quedan a un plan pagado (con la gracia); null si no vence. */
export function diasParaVencer(vence: string | null | undefined, ahora: number): number | null {
  if (!vence) return null;
  return Math.max(0, Math.ceil((Date.parse(vence) - ahora) / (24 * 60 * 60 * 1000)));
}

declare global {
  interface Window {
    BoldCheckout?: new (datos: Record<string, string>) => { open: () => void };
  }
}

/** Carga el programa de Bold (solo al pagar) y abre su checkout, que lleva a la página de Bold. */
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
