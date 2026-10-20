/**
 * La entrada de una dirección en `TIENDA_HOSTS` (TIENDA-3.0 §5.6): la tienda, su celda y su shard,
 * la versión publicada, su dirección canónica y el rol de esta. La escriben publicar, la diaria que
 * reconstruye el KV y el dominio propio al activarse (HU-T13.1); un solo formato para los tres, así
 * la diaria no ve diferencias donde no las hay. El despacho la lee con `destinoDe`.
 */
export interface Puntero {
  org: string;
  celda: string;
  shard: string;
  version: number | null;
  canonico: string | undefined;
  estado: string;
  rol: string;
}

/** El texto de la entrada, siempre con las claves en el mismo orden. */
export const punteroDelHost = (p: Puntero): string =>
  JSON.stringify({
    org: p.org,
    celda: p.celda,
    shard: p.shard,
    version: p.version,
    canonico: p.canonico,
    estado: p.estado,
    rol: p.rol,
  });

export const claveDelHost = (hostname: string) => `h:${hostname}`;

/**
 * HU-T13.5 CA3: las direcciones activas como las deja el plan. Si el plan no incluye el dominio
 * propio y el canónico es propio, la dirección de la plataforma pasa a ser la canónica y la propia
 * queda de alias, que el despacho redirige con un 301. La base no cambia: con el plan de vuelta, el
 * dominio propio vuelve a ser el principal.
 */
export function direccionesDelPlan<F extends { hostname: string; tipo: string; rol: string }>(
  activas: readonly F[],
  dominioPropio: boolean,
): { filas: F[]; canonico: string | undefined } {
  const canonica = activas.find((f) => f.rol === 'canonico');
  const plataforma = activas.find((f) => f.tipo === 'plataforma');
  if (dominioPropio || canonica?.tipo !== 'propio' || !plataforma)
    return { filas: [...activas], canonico: canonica?.hostname };
  return {
    filas: activas.map((f) =>
      f === plataforma
        ? { ...f, rol: 'canonico' }
        : f.tipo === 'propio'
          ? { ...f, rol: 'alias' }
          : f,
    ),
    canonico: plataforma.hostname,
  };
}
