/**
 * El CORE como servidor de autorización OAuth 2.1 para agentes (PLATAFORMA §5.4, ADR-41). Lo de
 * este sprint (HU-C9.2): los metadatos de RFC 8414 en `/.well-known/oauth-authorization-server`.
 *
 * **Solo en staging por ahora** (P1): los metadatos anuncian `/oauth/token` y `/oauth/revoke`, que
 * llegan con HU-C9.5 y HU-C9.6. Anunciarlos en producción antes sería prometer lo que no responde.
 * El despliegue de producción sigue diciendo 404 hasta que `servidorOAuthActivo` cambie.
 */
import type { CatalogoDelCore } from './productos.ts';

/** Los destinos donde el servidor ya se anuncia. Producción entra con el canje (HU-C9.5). */
export const servidorOAuthActivo = (destino: string | undefined) => destino === 'staging';

/** Los alcances de todos los productos activos, como los declara `productos.json`. */
export function alcancesDelCatalogo(catalogo: CatalogoDelCore): string[] {
  return catalogo.productos
    .filter((p) => p.estado === 'activo')
    .flatMap((p) => (p.alcances ?? []).map((a) => a.id))
    .sort();
}

export function metadatosDelServidor(emisor: string, catalogo: CatalogoDelCore) {
  return {
    issuer: emisor,
    authorization_endpoint: `${emisor}/oauth/authorize`,
    token_endpoint: `${emisor}/oauth/token`,
    registration_endpoint: `${emisor}/oauth/register`,
    revocation_endpoint: `${emisor}/oauth/revoke`,
    jwks_uri: `${emisor}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // PKCE solo con S256: `plain` no protege el código (PLATAFORMA §5.4).
    code_challenge_methods_supported: ['S256'],
    // Clientes públicos (un agente en el teléfono o en un escritorio): sin secreto, con PKCE.
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: alcancesDelCatalogo(catalogo),
    // El client_id puede ser la URL de su documento de metadatos (CIMD, HU-C9.3).
    client_id_metadata_document_supported: true,
  };
}
