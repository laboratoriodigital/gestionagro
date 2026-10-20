/**
 * Los feeds en el panel (HU-T14.5 CA2): cuáles encendió el comercio, en qué dirección los lee cada
 * destino y qué productos dejó fuera la versión publicada, con su motivo. Tres lecturas de una fila:
 * lo que queda fuera lo calculó publicar, que ya lee la tienda entera.
 */
import type { BaseD1 } from '@ed1/d1';
import type { FueraDelFeed } from '@ed1/tienda-horno';

export interface FeedsDelPanel {
  encendidos: { google: boolean; meta: boolean; agentes: boolean };
  /** Las direcciones de los encendidos, en la dirección principal de la tienda. */
  urls: { google?: string; meta?: string; agentes?: string };
  /** Lo que la versión publicada dejó fuera; `null` si todavía no se publicó con feeds. */
  fuera: FueraDelFeed[] | null;
}

const RUTAS = {
  google: '/feeds/google.xml',
  meta: '/feeds/meta.csv',
  agentes: '/feeds/productos.jsonl',
} as const;

export async function feedsDelPanel(
  q: { db: BaseD1; org: string },
  control: BaseD1,
): Promise<FeedsDelPanel> {
  const ajuste = await q.db
    .prepare("SELECT datos FROM ajuste WHERE org_id = ? AND seccion = 'agentes'")
    .bind(q.org)
    .first<{ datos: string }>();
  const leidos = (() => {
    try {
      return (JSON.parse(ajuste?.datos ?? '{}') as { feeds?: Partial<FeedsDelPanel['encendidos']> })
        .feeds;
    } catch {
      return undefined;
    }
  })();
  const encendidos = {
    google: leidos?.google === true,
    meta: leidos?.meta === true,
    agentes: leidos?.agentes === true,
  };
  const publicada = await q.db
    .prepare(
      `SELECT p.fuera_de_los_feeds FROM tienda t JOIN publicacion p
         ON p.org_id = t.org_id AND p.version = t.version_publicada
        WHERE t.org_id = ?`,
    )
    .bind(q.org)
    .first<{ fuera_de_los_feeds: string | null }>();
  const canonico = await control
    .prepare(
      "SELECT hostname FROM dominio WHERE org_id = ? AND rol = 'canonico' AND estado = 'activo'",
    )
    .bind(q.org)
    .first<{ hostname: string }>();
  const urls: FeedsDelPanel['urls'] = {};
  if (canonico) {
    for (const k of ['google', 'meta', 'agentes'] as const) {
      if (encendidos[k]) urls[k] = `https://${canonico.hostname}${RUTAS[k]}`;
    }
  }
  let fuera: FueraDelFeed[] | null = null;
  try {
    fuera = publicada?.fuera_de_los_feeds
      ? (JSON.parse(publicada.fuera_de_los_feeds) as FueraDelFeed[])
      : null;
  } catch {
    fuera = null;
  }
  return { encendidos, urls, fuera };
}
