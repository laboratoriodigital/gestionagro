/**
 * Quién puede qué en el panel de una tienda (TIENDA-3.0 §12.1 y §12.3, HU-T1.4).
 *
 * La matriz es un dato, una sola para el panel, que esconde, y la API, que decide (P2). Lo que no
 * está en la matriz está negado, como en el agro (HU-E4.5). Un permiso escondido en la página es
 * un adorno: lo que cuenta es la API (bitácora ecommerce 64).
 *
 * El colaborador hace todo lo del día a día, menos lo que decide a dónde llega la plata o quién
 * entra: cobro, dominio, equipo, plan, exportar datos personales, los derechos del titular y el
 * modo de pedido (TIENDA-3.0 §12.1). Tampoco acepta los términos en nombre de la tienda (HU-T7.2).
 */
import type { Seccion } from './secciones.ts';

export const ROLES = ['propietario', 'colaborador'] as const;
export type Rol = (typeof ROLES)[number];

export const ACCIONES = [
  'sesion.ver',
  'tablero.ver',
  'catalogo.editar',
  'inventario.ajustar',
  'avisame.atender',
  'pedidos.ver',
  'pedidos.gestionar',
  'pedidos.contacto_ver',
  'pedidos.link_pago',
  'recaudos.gestionar',
  'envios.editar',
  'cupones.editar',
  'paginas.editar',
  'solicitudes.gestionar',
  'ajustes.editar',
  'ajustes.contacto',
  'ajustes.modo_pedido',
  'cobro.gestionar',
  'factura.gestionar',
  'dominios.gestionar',
  'publicar',
  'registro.ver',
  'exportar',
  'exportar.datos_personales',
  'titular.gestionar',
  'importar',
  'equipo.gestionar',
  'plan.gestionar',
  'terminos.aceptar',
  'tienda.baja',
] as const;
export type Accion = (typeof ACCIONES)[number];

const SOLO_PROPIETARIO: ReadonlySet<Accion> = new Set<Accion>([
  'ajustes.modo_pedido',
  'cobro.gestionar',
  'factura.gestionar',
  'dominios.gestionar',
  'exportar.datos_personales',
  'titular.gestionar',
  'importar',
  'equipo.gestionar',
  'plan.gestionar',
  // HU-T7.2: los términos del servicio y la custodia de las llaves se aceptan en nombre de la tienda.
  'terminos.aceptar',
  // HU-T13.7: dar de baja la tienda borra los datos de sus compradores.
  'tienda.baja',
]);

export const MATRIZ: Readonly<Record<Accion, readonly Rol[]>> = Object.fromEntries(
  ACCIONES.map((a) => [
    a,
    SOLO_PROPIETARIO.has(a) ? ['propietario'] : ['propietario', 'colaborador'],
  ]),
) as unknown as Record<Accion, readonly Rol[]>;

/**
 * Lo que mueve la plata, cambia por dónde llegan los pedidos o abre los datos de un comprador pide
 * haber entrado hace poco (§12.3).
 */
export const PIDEN_ENTRADA_RECIENTE: ReadonlySet<Accion> = new Set<Accion>([
  'ajustes.contacto',
  'ajustes.modo_pedido',
  'cobro.gestionar',
  'factura.gestionar',
  'exportar.datos_personales',
  'titular.gestionar',
  'tienda.baja',
]);

/** Diez minutos desde la última entrada interactiva (`auth_time` del token). */
export const ENTRADA_RECIENTE_S = 600;

export function puede(rol: string, accion: string): boolean {
  return (MATRIZ[accion as Accion] as readonly string[] | undefined)?.includes(rol) ?? false;
}

export function entradaRecienteVigente(authTimeS: number, ahoraS: number): boolean {
  return (
    Number.isFinite(authTimeS) && ahoraS - authTimeS <= ENTRADA_RECIENTE_S && authTimeS <= ahoraS
  );
}

export type Decision = 'permitido' | 'prohibido' | 'reautenticar';

/** La decisión de la API para una acción. */
export function decidir(rol: string, accion: string, authTimeS: number, ahoraS: number): Decision {
  if (!puede(rol, accion)) return 'prohibido';
  if (PIDEN_ENTRADA_RECIENTE.has(accion as Accion) && !entradaRecienteVigente(authTimeS, ahoraS)) {
    return 'reautenticar';
  }
  return 'permitido';
}

/**
 * Qué acciones pide guardar una sección de ajustes. Cambiar el WhatsApp o el modo de pedido pide
 * más que cambiar el horario; `cobro` es siempre del propietario.
 */
export function accionesDeAjuste(
  seccion: Seccion,
  antes: Record<string, unknown> | undefined,
  despues: Record<string, unknown>,
): Accion[] {
  if (seccion === 'cobro') return ['cobro.gestionar'];
  const acciones: Accion[] = ['ajustes.editar'];
  if (seccion === 'contacto' && antes?.['whatsapp'] !== despues['whatsapp']) {
    acciones.push('ajustes.contacto');
  }
  if (seccion === 'venta' && antes?.['modo'] !== despues['modo'])
    acciones.push('ajustes.modo_pedido');
  // HU-T7.3: cuánto se guardan los contactos de los compradores lo decide quien responde por ellos.
  if (seccion === 'legal' && antes?.['conservacionMeses'] !== despues['conservacionMeses'])
    acciones.push('titular.gestionar');
  return acciones;
}
