/**
 * Buscar en el teléfono, sin red (HU-T5.3, TIENDA-3.0 §11.2): sobre `catalogo.json`, ya cargado,
 * sin distinguir tildes ni mayúsculas. Escribir no hace ninguna solicitud al servidor.
 */

export interface ProductoDelCatalogo {
  slug: string;
  nombre: string;
  url: string;
  /** La foto más pequeña del producto, para las coincidencias (validación del 21 oct 2026). */
  foto?: string;
}

/** Sin tildes, sin mayúsculas y con los espacios juntos: «Vestido  Rosá» → «vestido rosa». */
export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Los productos que tienen todas las palabras buscadas: primero los que empiezan por lo escrito
 * (validación del 21 oct 2026: al escribir «cam», la camisa antes que el gorro de campo), y después
 * los demás, en el orden del catálogo.
 */
export function buscar<P extends ProductoDelCatalogo>(
  productos: readonly P[],
  consulta: string,
): P[] {
  const q = normalizar(consulta);
  const palabras = q.split(' ').filter(Boolean);
  if (palabras.length === 0) return [];
  const hallados = productos.filter((p) => {
    const texto = normalizar(`${p.nombre} ${p.slug.replaceAll('-', ' ')}`);
    return palabras.every((palabra) => texto.includes(palabra));
  });
  const empieza = (p: P) => normalizar(p.nombre).startsWith(q);
  return [...hallados.filter(empieza), ...hallados.filter((p) => !empieza(p))];
}
