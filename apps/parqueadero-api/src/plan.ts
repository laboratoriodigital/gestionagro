/**
 * El plan del parqueadero en la celda (HU-Q7.10 CA3; PARQUEADERO §11.1 y §14.2). La nube es del
 * plan pagado: con el gratuito, o pasada la gracia de un plan vencido, la celda no sincroniza y lo
 * dice. La caja sigue registrando, cobrando e imprimiendo sin ella: un plan nunca detiene una
 * entrada (PARQUEADERO §5.3 regla 1).
 *
 * El plan sale del token (`plan`, que el CORE ya pone con la gracia del producto, HU-C5.5), no de
 * una copia en la celda: el acceso dura minutos y la caja lo renueva, así que un pago se ve en la
 * vuelta siguiente sin que el CORE le avise a nadie. Qué plan trae la nube sale de
 * `content/parqueadero/planes.json` (P2): uno que no es gratuito.
 */
import planes from '../../../content/parqueadero/planes.json' with { type: 'json' };

const CON_NUBE = new Set(
  (planes.planes as { id: string; gratuito?: boolean }[])
    .filter((p) => !p.gratuito)
    .map((p) => p.id),
);

/** ¿Ese plan trae la nube? Un plan que no está en el archivo, no (P1). */
export const planConNube = (plan: string): boolean => CON_NUBE.has(plan);

export const SIN_PLAN = {
  estado: 'sin-plan',
  motivo:
    'El plan del parqueadero no está al día: la nube queda en pausa hasta pagarlo en «Cuenta y nube». La caja sigue registrando, cobrando e imprimiendo.',
} as const;
