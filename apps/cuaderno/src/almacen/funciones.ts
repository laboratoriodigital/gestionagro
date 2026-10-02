/**
 * Funciones que se encienden o apagan por plan desde `content/agro/cuaderno/funciones.json` (una
 * sola fuente, P2). Se cambian con un commit y un despliegue, y valen sin señal y sin cuenta: el
 * plan gratuito no tiene sesión, así que un flag en la nube no le llegaría.
 */
import configFunciones from '../../../../content/agro/cuaderno/funciones.json' with {
  type: 'json',
};

export type Funcion = Exclude<keyof typeof configFunciones, 'nota'>;
type TablaDeFunciones = Record<Funcion, Record<string, boolean>>;

/** ¿Está encendida la función para ese plan? Un plan desconocido cuenta como el gratuito. */
export function funcionActiva(
  funcion: Funcion,
  plan: string,
  tabla: TablaDeFunciones = configFunciones,
): boolean {
  const porPlan = tabla[funcion];
  return porPlan[plan] ?? porPlan['gratuito'] ?? false;
}
