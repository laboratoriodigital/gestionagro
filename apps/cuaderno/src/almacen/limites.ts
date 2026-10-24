/**
 * Lo que cabe en cada plan (HU-E0.13), de `limites` en `content/agro/cuaderno/planes.json`: la
 * misma fuente que usan la celda y el CORE (P2). Vale sin señal y sin cuenta, como las funciones:
 * el teléfono sin finca en la nube está en el plan gratuito. Al llegar al tope no se agrega más,
 * pero nada de lo que ya existe se esconde ni se borra.
 */
import configPlanes from '../../../../content/agro/cuaderno/planes.json' with { type: 'json' };

/** `areas`: las áreas principales activas (las camas y los surcos no cuentan). `miembros`: las personas con cuenta, contando al propietario. */
export type Limite = 'areas' | 'miembros';

const gratuito = configPlanes.planes.find((p) => 'gratuito' in p && p.gratuito === true);

/** El tope del plan; null si no tiene. Un plan que el archivo no nombra cuenta como el gratuito. */
export function topeDelPlan(limite: Limite, plan: string): number | null {
  const delPlan = configPlanes.planes.find((p) => p.id === plan) ?? gratuito;
  return delPlan && 'limites' in delPlan ? delPlan.limites[limite] : null;
}

/** El nombre del plan para los avisos: «Gratis». */
export const nombreDelPlan = (plan: string): string =>
  (configPlanes.planes.find((p) => p.id === plan) ?? gratuito)?.nombre ?? plan;
