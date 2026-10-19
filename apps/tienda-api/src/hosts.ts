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
