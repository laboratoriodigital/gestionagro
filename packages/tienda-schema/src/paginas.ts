/**
 * Las páginas propias de la tienda (HU-T10.2, TIENDA §5.3 `pagina`): «Quiénes somos», «Cómo
 * comprar»… en Markdown seguro, cada una en `/<dirección>/`, con su enlace en el pie. Una página no
 * toma la dirección de un texto legal ni de una ruta del sistema (CA2): esa lista vive aquí, y una
 * prueba del horno la ata a lo que de verdad hornea y sirve (P2).
 */
import { z } from 'zod';

/**
 * El primer tramo de las rutas que hornea la vitrina o que atiende el despacho y la API. Ninguna
 * página propia puede llamarse así.
 */
export const DIRECCIONES_DEL_SISTEMA: ReadonlySet<string> = new Set([
  'p',
  'c',
  'productos',
  'carrito',
  'buscar',
  'pedido',
  'legal',
  'solicitud',
  'feeds',
  'api',
  'mcp',
  'catalogo',
  'sitemap',
  'robots',
  'llms',
  'manifest',
  // HU-T15.2 a HU-T15.4: la API pública, las habilidades y la tarjeta del MCP.
  'openapi',
  '.well-known',
  'index',
  'well-known',
  'paginas',
]);

export const LARGO_DEL_CUERPO = 50_000;

export type DireccionLeida = { ok: true; slug: string } | { ok: false; motivo: string };

/** La dirección de una página: minúsculas, sin tildes ni espacios, y libre del sistema (CA2). */
export function leerDireccionDePagina(texto: string): DireccionLeida {
  const slug = texto.trim().toLowerCase();
  if (slug.length < 2 || slug.length > 40)
    return { ok: false, motivo: 'La dirección va de 2 a 40 letras.' };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    return {
      ok: false,
      motivo: 'Usa letras sin tildes, números y un guion entre palabras, como quienes-somos.',
    };
  if (DIRECCIONES_DEL_SISTEMA.has(slug))
    return { ok: false, motivo: 'Esa dirección la usa la tienda. Elige otra, como quienes-somos.' };
  return { ok: true, slug };
}

/** Lo que el panel manda al guardar una página (con `id` y `version`, si ya existe). */
export const GuardarPagina = z.object({
  op: z.string().min(8).max(64),
  id: z.string().min(1).max(40).optional(),
  version: z.number().int().min(1).optional(),
  slug: z.string().max(80),
  titulo: z
    .string()
    .trim()
    .min(2, { error: 'escribe el título de la página' })
    .max(80, { error: 'el título va hasta 80 letras' }),
  cuerpo: z
    .string()
    .trim()
    .min(1, { error: 'escribe el texto de la página' })
    .max(LARGO_DEL_CUERPO, { error: 'el texto es demasiado largo' }),
  visible: z.boolean(),
});
export type GuardarPagina = z.infer<typeof GuardarPagina>;
