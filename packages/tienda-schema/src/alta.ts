/**
 * El alta de una tienda (HU-T13.4, TIENDA-3.0 §4.1 y §13.3): el nombre corto de su dirección,
 * `<nombre>.laboratorio-digital.app`. Lo usan el panel, que sugiere y explica mientras se escribe, y
 * la API, que decide (P2). Las mismas reglas que el `CHECK` de la tabla `slug` de la base de control:
 * de 3 a 40 letras, números y guiones, sin guion al principio, al final ni doble (`--` es de la
 * plataforma: `<nombre>--staging`).
 */
export type DireccionLeida = { ok: true; slug: string } | { ok: false; motivo: string };

/** Lo que el comercio escribió como dirección, o por qué no sirve. */
export function leerDireccion(texto: string): DireccionLeida {
  const slug = texto.trim().toLowerCase();
  if (slug.length < 3) return { ok: false, motivo: 'Usa al menos 3 letras o números.' };
  if (slug.length > 40) return { ok: false, motivo: 'Usa hasta 40 letras o números.' };
  if (/[^a-z0-9-]/.test(slug))
    return { ok: false, motivo: 'Solo letras sin tildes, números y guiones, sin espacios.' };
  if (slug.startsWith('-') || slug.endsWith('-'))
    return { ok: false, motivo: 'No puede empezar ni terminar con guion.' };
  if (slug.includes('--')) return { ok: false, motivo: 'Usa un solo guion entre palabras.' };
  return { ok: true, slug };
}

/** Una dirección a partir del nombre de la tienda: «Panadería Doña Rosa» → `panaderia-dona-rosa`. */
export function sugerirDireccion(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** La dirección completa de una tienda, en su ambiente. */
export const direccionDeLaTienda = (slug: string, ambiente: 'staging' | 'produccion') =>
  ambiente === 'staging'
    ? `${slug}--staging.laboratorio-digital.app`
    : `${slug}.laboratorio-digital.app`;

/** Por qué un nombre reservado no se puede usar, según su motivo en `slug_reservado`. */
export const MOTIVO_DE_LA_RESERVA: Readonly<Record<string, string>> = {
  infraestructura: 'Esa dirección la usa la plataforma. Elige otra.',
  suplantacion: 'Ese nombre se parece al de otra tienda o servicio y podría confundir. Elige otro.',
  proyecto: 'Esa dirección es de otro proyecto de Laboratorio Digital. Elige otra.',
  marca: 'Ese nombre es de una marca conocida. Si es tu marca, escríbenos; si no, elige otro.',
};

/** Las formas de pago de fábrica de una tienda nueva (D-T4): a convenir y transferencia. */
export const FORMAS_DE_FABRICA = ['a_convenir', 'transferencia'] as const;
