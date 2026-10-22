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

/**
 * HU-T13.5 CA2: lo que la API y el horno limitan de un plan, con nombre y tipo. Son los mismos
 * valores de `funciones.json`; las funciones que todavía no tienen su historia no están aquí.
 */
export interface LimitesDelPlan {
  /** Cuántos productos muestra la vitrina (`null`: todos). Los demás quedan ocultos, nunca borrados. */
  productos: number | null;
  /** Cuántas personas tiene el equipo, contando al propietario (`null`: sin límite). */
  usuarios: number | null;
  cobroEnLinea: boolean;
  contraentrega: boolean;
  dominioPropio: boolean;
  feeds: boolean;
  /** HU-T18.2: sin el sello «Hecha con TiendaPro» al pie de la tienda. */
  sinMarca: boolean;
  /** HU-T18.3: los asistentes de los compradores preparan pedidos por el MCP público. */
  mcpPublico: boolean;
}

/**
 * Los límites de un plan. Un plan que `funciones.json` no nombra tiene los del gratuito: nunca
 * «todo encendido» (P1). Si el archivo tampoco nombra el gratuito, lanza.
 */
export function limitesDelPlan(
  funciones: FuncionesPorPlan,
  plan: string,
  gratuito: string,
): LimitesDelPlan {
  const del = funcionesDelPlan(funciones, plan) ?? funcionesDelPlan(funciones, gratuito);
  if (!del) throw new Error(`funciones.json no dice nada del plan gratuito «${gratuito}»`);
  const limite = (f: string): number | null => {
    const v = del[f];
    if (v === null || typeof v === 'number') return v;
    throw new Error(`«${f}» tiene que ser un límite en funciones.json`);
  };
  const encendida = (f: string): boolean => {
    const v = del[f];
    if (typeof v === 'boolean') return v;
    throw new Error(`«${f}» tiene que ser un booleano en funciones.json`);
  };
  return {
    productos: limite('productos'),
    usuarios: limite('usuarios'),
    cobroEnLinea: encendida('cobro_en_linea'),
    contraentrega: encendida('contraentrega'),
    dominioPropio: encendida('dominio_propio'),
    feeds: encendida('feeds'),
    sinMarca: encendida('sin_marca'),
    mcpPublico: encendida('mcp_publico'),
  };
}

/**
 * Lo que permiten los dos a la vez: el menor límite y solo lo que los dos encienden. El re-horneado
 * lo usa para que un plan que baja recorte enseguida y uno que sube espere a que el comercio publique
 * (y la compuerta revise lo que vuelve a mostrarse). `a` es lo guardado con la versión publicada: una
 * versión de antes de HU-T18.3 no trae `sinMarca` ni `mcpPublico`, y en ellos manda el plan de hoy.
 */
export function limitesMasEstrictos(a: LimitesDelPlan, b: LimitesDelPlan): LimitesDelPlan {
  const menor = (x: number | null, y: number | null) =>
    x === null ? y : y === null ? x : Math.min(x, y);
  return {
    productos: menor(a.productos, b.productos),
    usuarios: menor(a.usuarios, b.usuarios),
    cobroEnLinea: a.cobroEnLinea && b.cobroEnLinea,
    contraentrega: a.contraentrega && b.contraentrega,
    dominioPropio: a.dominioPropio && b.dominioPropio,
    feeds: a.feeds && b.feeds,
    sinMarca: (a.sinMarca ?? b.sinMarca) && b.sinMarca,
    mcpPublico: (a.mcpPublico ?? b.mcpPublico) && b.mcpPublico,
  };
}

/**
 * Las formas de pago que el plan deja ofrecer (HU-T13.5 CA3). Sin el plan que las incluye, salen el
 * pago en línea y la contraentrega. Si el plan quitó algo (también el pago en línea de una tienda que
 * cobra en línea, `enLinea`) y no queda ninguna forma para pedir por WhatsApp, queda «a convenir»:
 * la tienda sigue recibiendo pedidos. Lo que el plan no toca queda como el comercio lo eligió.
 */
export function formasDelPlan<F extends { forma: string }>(
  formas: readonly F[],
  l: Pick<LimitesDelPlan, 'cobroEnLinea' | 'contraentrega'>,
  enLinea = false,
): (F | { forma: 'a_convenir' })[] {
  const quedan: (F | { forma: 'a_convenir' })[] = formas.filter(
    (f) =>
      (f.forma !== 'en_linea' || l.cobroEnLinea) &&
      (f.forma !== 'contraentrega' || l.contraentrega),
  );
  const quito = quedan.length < formas.length || (enLinea && !l.cobroEnLinea);
  if (quito && !quedan.some((f) => f.forma !== 'en_linea')) quedan.push({ forma: 'a_convenir' });
  return quedan;
}
