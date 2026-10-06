/**
 * Las llaves públicas del CORE (HU-C4.2, PLATAFORMA §4.6). Las celdas leen `/api/core/claves`;
 * un verificador que no es nuestro (un cliente OAuth, §5.4) lee `/.well-known/jwks.json`, el
 * formato estándar: JWK `OKP`/`Ed25519` con su `kid` (RFC 7517 y RFC 8037).
 *
 * Se publican la vigente y, durante una rotación, la anterior. La anterior llega como variable
 * `CORE_CLAVE_ANTERIOR` (su JWK pública): el CORE ya no firma con ella, solo la anuncia para que
 * los tokens que firmó sigan valiendo hasta su `exp`. De lo que llegue se copian solo los campos
 * públicos: aunque alguien pegue ahí la JWK privada, la parte `d` nunca sale.
 */
import type { ClavePublica } from '@ed1/tokens';

const B64URL = /^[A-Za-z0-9_-]+$/;

/** La JWK pública de la anterior, o null si no hay o no es una llave Ed25519 bien formada. */
export function claveAnteriorDe(valor: string | undefined): ClavePublica | null {
  if (!valor?.trim()) return null;
  let jwk: Record<string, unknown>;
  try {
    jwk = JSON.parse(valor) as Record<string, unknown>;
  } catch {
    console.error('agro-core: CORE_CLAVE_ANTERIOR no es JSON; se publica solo la vigente');
    return null;
  }
  const { kty, crv, x, kid } = jwk;
  if (
    kty !== 'OKP' ||
    crv !== 'Ed25519' ||
    typeof x !== 'string' ||
    !B64URL.test(x) ||
    typeof kid !== 'string'
  ) {
    console.error(
      'agro-core: CORE_CLAVE_ANTERIOR no es una JWK Ed25519; se publica solo la vigente',
    );
    return null;
  }
  return { kty, crv, x, kid, alg: 'EdDSA', use: 'sig' };
}

/** Vigente primero; la anterior solo si es otra llave. */
export function clavesPublicadas(
  vigente: ClavePublica,
  anterior: ClavePublica | null,
): ClavePublica[] {
  return anterior && anterior.kid !== vigente.kid ? [vigente, anterior] : [vigente];
}
