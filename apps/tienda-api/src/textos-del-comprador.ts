/**
 * HU-P1.5 (sprint PF3): el texto que un producto le pide al comprador en la ficha («Nombre para
 * grabar», «Mensaje de la tarjeta»). La isla lo manda con la línea; aquí se vuelve a validar contra
 * lo que pide el producto, en la base (nunca contra lo que diga el navegador):
 *
 * - Un producto que no pide texto no guarda ninguno, aunque llegue.
 * - Si lo pide y es obligatorio, sin él no hay pedido; nunca pasa de su largo (hasta 200).
 * - Es un dato del comprador: va cifrado en el sobre de la entrega del pedido (`pedido_contacto`),
 *   con su misma llave y su misma purga. El panel lo ve al abrir los datos de la entrega, y el
 *   WhatsApp del pedido lo lleva debajo de su línea. Se escapa al mostrarlo: nunca se ejecuta.
 */
import type { BaseD1 } from '@ed1/d1';
import { pideTextoLeido } from '@ed1/tienda-schema';

export interface TextoDeLinea {
  variante: string;
  /** El producto, como lo lee el comercio: «Taza de cerámica». */
  nombre: string;
  texto: string;
}

export type TextosLeidos = { ok: true; textos: TextoDeLinea[] } | { ok: false; motivo: string };

export async function textosDelPedido(
  db: BaseD1,
  org: string,
  lineas: readonly { variante: string; texto?: string | undefined }[],
): Promise<TextosLeidos> {
  if (lineas.length === 0) return { ok: true, textos: [] };
  const { results } = await db
    .prepare(
      `SELECT v.id, p.nombre, p.pide_texto FROM variante v
         JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.id IN (${lineas.map(() => '?').join(', ')})`,
    )
    .bind(org, ...lineas.map((l) => l.variante))
    .all<{ id: string; nombre: string; pide_texto: string | null }>();
  const porId = new Map(results.map((r) => [r.id, r]));
  const textos: TextoDeLinea[] = [];
  for (const l of lineas) {
    const v = porId.get(l.variante);
    const pide = pideTextoLeido(v?.pide_texto);
    if (!v || !pide) continue;
    const texto = l.texto?.trim() ?? '';
    if (!texto) {
      if (pide.obligatorio)
        return {
          ok: false,
          motivo: `Falta «${pide.etiqueta}» de ${v.nombre}. Escríbelo en su página.`,
        };
      continue;
    }
    if (texto.length > pide.largo)
      return {
        ok: false,
        motivo: `«${pide.etiqueta}» de ${v.nombre} va hasta ${pide.largo} caracteres.`,
      };
    textos.push({ variante: l.variante, nombre: v.nombre, texto });
  }
  return { ok: true, textos };
}
