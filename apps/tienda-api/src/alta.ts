/**
 * El alta de una tienda por el comercio (HU-T13.4, TIENDA-3.0 §13.3; análisis de integración §5).
 *
 * El panel, con la sesión del CORE recién creada:
 * 1. pregunta si la dirección está libre (`disponibilidad`), mientras se escribe;
 * 2. crea la organización en el CORE, que le asigna celda y shard, y renueva su sesión hacia ella;
 * 3. abre la tienda aquí (`abrirTienda`): la verificación de Turnstile, el nombre corto en la base de
 *    control (único: de dos altas con el mismo nombre a la vez, una gana), la dirección de la
 *    plataforma como canónica, y la tienda en su shard en `borrador`, con las formas de pago de
 *    fábrica (D-T4). Después vienen los términos, los datos legales, el WhatsApp, el primer producto
 *    y publicar, que ya existen.
 *
 * Repetir la misma `op`, o abrir otra vez la tienda que ya se abrió, no crea nada nuevo.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  direccionDeLaTienda,
  FORMAS_DE_FABRICA,
  leerDireccion,
  MOTIVO_DE_LA_RESERVA,
} from '@ed1/tienda-schema/alta';
import { z } from 'zod';
import { guardarOperacion, type Problema, yaAplicada } from './catalogo.ts';
import { apuntarLaTienda, type QuienDelDominio } from './dominios.ts';
import { anotar } from './registro.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export type Disponibilidad =
  | { disponible: true; slug: string; direccion: string }
  | { disponible: false; motivo: string };

/** Si la dirección se puede tomar, o por qué no. Una lectura por la llave de cada tabla. */
export async function disponibilidad(
  control: BaseD1,
  texto: string,
  ambiente: 'staging' | 'produccion',
): Promise<Disponibilidad> {
  const leida = leerDireccion(texto);
  if (!leida.ok) return { disponible: false, motivo: leida.motivo };
  const reservado = await control
    .prepare('SELECT motivo FROM slug_reservado WHERE slug = ?')
    .bind(leida.slug)
    .first<{ motivo: string }>();
  if (reservado)
    return {
      disponible: false,
      motivo: MOTIVO_DE_LA_RESERVA[reservado.motivo] ?? 'Esa dirección no está disponible.',
    };
  const tomado = await control
    .prepare('SELECT 1 AS si FROM slug WHERE slug = ?')
    .bind(leida.slug)
    .first<{ si: number }>();
  if (tomado) return { disponible: false, motivo: 'Esa dirección ya la tiene otra tienda.' };
  return {
    disponible: true,
    slug: leida.slug,
    direccion: direccionDeLaTienda(leida.slug, ambiente),
  };
}

/** Turnstile de Cloudflare: el token del widget, verificado en el servidor (CA1). */
export async function verificarTurnstile(
  secreto: string,
  token: string,
  ip: string | undefined,
  f: Fetch,
): Promise<boolean> {
  try {
    const cuerpo = new URLSearchParams({ secret: secreto, response: token });
    if (ip) cuerpo.set('remoteip', ip);
    const r = await f('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: cuerpo,
    });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

const Alta = z.object({
  op: z.string().min(8).max(64),
  slug: z.string().max(80),
  nombre: z.string().trim().min(2).max(80),
  turnstile: z.string().min(1).max(4096),
});

export type ResultadoDelAlta =
  | { estado: 'guardado'; id: string; version: number; slug: string; direccion: string }
  | { estado: 'problemas'; problemas: Problema[] }
  | { estado: 'sin-configurar'; motivo: string };

const problema = (campo: string, mensaje: string): ResultadoDelAlta => ({
  estado: 'problemas',
  problemas: [{ campo, mensaje }],
});

/** CA1 a CA3: abre la tienda de la organización de la sesión. */
export async function abrirTienda(
  q: QuienDelDominio & { plan: string | null },
  cuerpo: unknown,
  d: {
    ambiente: 'staging' | 'produccion';
    /** Verifica el token de Turnstile; `null` si el ambiente no tiene su secreto. */
    turnstile: ((token: string) => Promise<boolean>) | null;
  },
): Promise<ResultadoDelAlta> {
  const r0 = Alta.safeParse(cuerpo);
  if (!r0.success) {
    const campo = String(r0.error.issues[0]?.path[0] ?? 'nombre');
    return problema(
      campo,
      campo === 'turnstile'
        ? 'Confirma que eres una persona.'
        : 'Escribe el nombre de tu tienda y su dirección.',
    );
  }
  const previa = await yaAplicada<ResultadoDelAlta>(q, r0.data.op);
  if (previa) return previa;
  const leida = leerDireccion(r0.data.slug);
  if (!leida.ok) return problema('slug', leida.motivo);
  const slug = leida.slug;
  const direccion = direccionDeLaTienda(slug, d.ambiente);
  const listo: ResultadoDelAlta = { estado: 'guardado', id: q.org, version: 1, slug, direccion };

  // Abrirla otra vez es la misma tienda; otra dirección para la misma organización, no.
  const yaTiene = await q.db
    .prepare('SELECT slug FROM tienda WHERE org_id = ?')
    .bind(q.org)
    .first<{ slug: string }>();
  if (yaTiene) {
    return yaTiene.slug === slug
      ? listo
      : problema(
          'slug',
          `Tu tienda ya existe, en ${direccionDeLaTienda(yaTiene.slug, d.ambiente)}.`,
        );
  }
  if (!d.turnstile) {
    return {
      estado: 'sin-configurar',
      motivo: 'Abrir una tienda todavía no está disponible. Intenta más tarde.',
    };
  }
  if (!(await d.turnstile(r0.data.turnstile)))
    return problema('turnstile', 'No pudimos confirmar que eres una persona. Intenta otra vez.');

  // CA3: el nombre corto, único en la base de control. De dos altas a la vez, la segunda choca aquí.
  try {
    await q.control
      .prepare('INSERT INTO slug (slug, org_id, celda_id, creado) VALUES (?, ?, ?, ?)')
      .bind(slug, q.org, q.celda, q.instante)
      .run();
  } catch (e) {
    const t = String(e);
    if (/slug-reservado/.test(t)) {
      const motivo = await q.control
        .prepare('SELECT motivo FROM slug_reservado WHERE slug = ?')
        .bind(slug)
        .first<{ motivo: string }>();
      return problema(
        'slug',
        MOTIVO_DE_LA_RESERVA[motivo?.motivo ?? ''] ?? 'Esa dirección no está disponible.',
      );
    }
    if (/UNIQUE constraint failed: slug\.org_id/i.test(t)) {
      // Un intento anterior de esta misma organización dejó su nombre: se sigue si es este.
      const suyo = await q.control
        .prepare('SELECT slug FROM slug WHERE org_id = ?')
        .bind(q.org)
        .first<{ slug: string }>();
      if (suyo?.slug !== slug)
        return problema('slug', 'Tu cuenta ya empezó a abrir una tienda con otra dirección.');
    } else if (/UNIQUE constraint failed: slug\.slug/i.test(t)) {
      return problema('slug', 'Esa dirección la acaba de tomar otra tienda. Elige otra.');
    } else throw e;
  }
  await q.control
    .prepare(
      `INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado, activado)
       VALUES (?, ?, ?, 'plataforma', 'canonico', 'activo', ?, ?) ON CONFLICT (hostname) DO NOTHING`,
    )
    .bind(direccion, q.org, q.celda, q.instante, q.instante)
    .run();
  await q.db.batch([
    q.db
      .prepare(
        "INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES (?, ?, ?, 'borrador', ?, ?, ?)",
      )
      .bind(q.org, slug, r0.data.nombre, q.plan ?? 'gratis', q.instante, q.instante),
    q.db
      .prepare(
        "INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, 'identidad', 1, ?, ?, ?)",
      )
      .bind(q.org, JSON.stringify({ nombre: r0.data.nombre }), q.instante, q.actor),
    // CA2: las formas de pago de fábrica (D-T4); el pedido llega por WhatsApp.
    q.db
      .prepare(
        "INSERT INTO ajuste (org_id, seccion, esquema, datos, actualizado, actualizado_por) VALUES (?, 'venta', 1, ?, ?, ?)",
      )
      .bind(
        q.org,
        JSON.stringify({ modo: 'whatsapp', formas: FORMAS_DE_FABRICA.map((forma) => ({ forma })) }),
        q.instante,
        q.actor,
      ),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'tienda.alta',
      entidad: 'tienda',
      entidadId: q.org,
      antes: null,
      despues: { slug, nombre: r0.data.nombre },
      instante: q.instante,
    }),
    guardarOperacion(q, r0.data.op, 'alta', listo),
  ]);
  await apuntarLaTienda(q);
  return listo;
}
