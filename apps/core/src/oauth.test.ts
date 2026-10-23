/**
 * HU-C9.2: los metadatos del servidor de autorización (RFC 8414), con los alcances de todos los
 * productos. Solo se anuncian donde el servidor ya está (staging): en producción, 404 hasta que
 * exista el canje de tokens (P1).
 */
import { describe, expect, it } from 'vitest';
import { alcancesDelCatalogo } from './oauth.ts';
import { CATALOGO, type CatalogoDelCore } from './productos.ts';
import { crearApp } from './worker.ts';

const pedir = (destino: string | undefined) =>
  crearApp().fetch(
    new Request('https://agro-core-staging.example/.well-known/oauth-authorization-server'),
    (destino ? { DESTINO: destino } : {}) as never,
  );

describe('HU-C9.2 · metadatos del servidor de autorización', () => {
  it('CA2 · en staging: S256, código y refresh, los alcances de todos los productos y CIMD', async () => {
    const r = await pedir('staging');
    expect(r.status).toBe(200);
    const m = (await r.json()) as Record<string, unknown>;
    expect(m).toMatchObject({
      issuer: 'https://agro-core-staging.example',
      authorization_endpoint: 'https://agro-core-staging.example/oauth/authorize',
      token_endpoint: 'https://agro-core-staging.example/oauth/token',
      jwks_uri: 'https://agro-core-staging.example/.well-known/jwks.json',
      code_challenge_methods_supported: ['S256'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      response_types_supported: ['code'],
      client_id_metadata_document_supported: true,
    });
    expect(m['scopes_supported']).toContain('agro:registros:leer');
  });

  it('P1 ❌ · en producción, o sin destino, no se anuncia lo que todavía no canjea tokens', async () => {
    expect((await pedir('produccion')).status).toBe(404);
    expect((await pedir(undefined)).status).toBe(404);
  });

  it('solo los alcances de productos activos, ordenados', () => {
    const catalogo: CatalogoDelCore = {
      ...CATALOGO,
      productos: [
        ...CATALOGO.productos,
        {
          ...(CATALOGO.productos[0] as CatalogoDelCore['productos'][number]),
          id: 'pausado',
          estado: 'pausado',
          alcances: [{ id: 'pausado:algo:leer', descripcion: 'Algo que no se ofrece.' }],
        },
      ],
    };
    // La Tienda está activa desde HU-T18.6: sus alcances del MCP del comercio se ofrecen.
    expect(alcancesDelCatalogo(catalogo)).toEqual([
      'agro:registros:leer',
      'tienda:inventario:ajustar',
      'tienda:inventario:leer',
      'tienda:pedidos:estado',
      'tienda:pedidos:leer',
    ]);
  });
});
