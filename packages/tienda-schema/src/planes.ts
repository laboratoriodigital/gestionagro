/**
 * Lo que permite cada plan de la Tienda (HU-T2.2, TIENDA-3.0 §1.4): `content/tienda/funciones.json`
 * leído por el panel, la API y el horno con las mismas reglas (P2). Los precios viven en
 * `content/tienda/planes.json`; una prueba ata los dos archivos.
 */

/** Un límite (`null`: sin límite) o una función encendida o apagada. */
export type ValorDeFuncion = number | boolean | null;

/** `{ función: { plan: valor } }`, sin la `nota` del archivo. */
export type FuncionesPorPlan = Readonly<Record<string, Readonly<Record<string, ValorDeFuncion>>>>;

/**
 * Las fallas de `funciones.json` frente a los planes: cada función nombra todos los planes y
 * ninguno más, y sus valores son límites enteros no negativos, `null` o booleanos. Todas a la vez
 * (P15). Un plan que falta no cuenta como el gratuito: se dice (P1).
 */
export function fallasDeFunciones(planes: readonly string[], funciones: unknown): string[] {
  if (typeof funciones !== 'object' || funciones === null || Array.isArray(funciones)) {
    return ['funciones.json no es un objeto'];
  }
  const fallas: string[] = [];
  for (const [funcion, porPlan] of Object.entries(funciones)) {
    if (funcion === 'nota') continue;
    if (typeof porPlan !== 'object' || porPlan === null || Array.isArray(porPlan)) {
      fallas.push(`«${funcion}» no dice un valor por plan`);
      continue;
    }
    const nombrados = Object.keys(porPlan);
    for (const plan of planes.filter((p) => !nombrados.includes(p))) {
      fallas.push(`«${funcion}» no dice nada del plan «${plan}»`);
    }
    for (const plan of nombrados.filter((p) => !planes.includes(p))) {
      fallas.push(`«${funcion}» nombra el plan «${plan}», que no está en planes.json`);
    }
    for (const [plan, valor] of Object.entries(porPlan as Record<string, unknown>)) {
      const valido =
        valor === null ||
        typeof valor === 'boolean' ||
        (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0);
      if (!valido) {
        fallas.push(
          `«${funcion}» en «${plan}» vale ${JSON.stringify(valor)}: tiene que ser un entero, null o un booleano`,
        );
      }
    }
  }
  return fallas;
}

/**
 * El valor de una función en un plan. Lanza si la función o el plan no están: un límite que no se
 * puede leer nunca se vuelve «sin límite» ni «apagado» en silencio (P1).
 */
export function valorDe(
  funciones: FuncionesPorPlan,
  funcion: string,
  plan: string,
): ValorDeFuncion {
  const porPlan = funciones[funcion];
  if (!porPlan) throw new Error(`la función «${funcion}» no está en funciones.json`);
  const valor = porPlan[plan];
  if (valor === undefined) throw new Error(`«${funcion}» no dice nada del plan «${plan}»`);
  return valor;
}

/** Si caben `cantidad` cosas con ese límite (`null`: sin límite). */
export const cabe = (limite: number | null, cantidad: number): boolean =>
  limite === null || cantidad <= limite;

/**
 * Lo que permite un plan, función por función (HU-T8.1 CA1: la sesión del panel lo trae). Un plan
 * que `funciones.json` no nombra devuelve `null`: nunca «todo encendido» ni «sin límite» (P1).
 */
export function funcionesDelPlan(
  funciones: FuncionesPorPlan,
  plan: string,
): Record<string, ValorDeFuncion> | null {
  const del: Record<string, ValorDeFuncion> = {};
  for (const [funcion, porPlan] of Object.entries(funciones)) {
    // La `nota` del archivo no es una función.
    if (typeof porPlan !== 'object' || porPlan === null) continue;
    const valor = porPlan[plan];
    if (valor === undefined) return null;
    del[funcion] = valor;
  }
  return del;
}
