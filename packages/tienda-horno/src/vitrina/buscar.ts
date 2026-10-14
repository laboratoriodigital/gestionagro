/**
 * Buscar en el teléfono, sin red (HU-T5.3, TIENDA-3.0 §11.2): sobre `catalogo.json`, ya cargado,
 * sin distinguir tildes ni mayúsculas. Escribir no hace ninguna solicitud al servidor.
 */

export interface ProductoDelCatalogo {
  slug: string;
  nombre: string;
  url: string;
}

/** Sin tildes, sin mayúsculas y con los espacios juntos: «Vestido  Rosá» → «vestido rosa». */
export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Los productos que tienen todas las palabras buscadas, en el orden del catálogo. */
export function buscar<P extends ProductoDelCatalogo>(
  productos: readonly P[],
  consulta: string,
): P[] {
  const palabras = normalizar(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return [];
  return productos.filter((p) => {
    const texto = normalizar(`${p.nombre} ${p.slug.replaceAll('-', ' ')}`);
    return palabras.every((palabra) => texto.includes(palabra));
  });
}
