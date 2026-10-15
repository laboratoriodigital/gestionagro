/**
 * Las solicitudes con radicado (HU-T6.4, TIENDA-3.0 §8.6 y §14.3; Ley 1480 art. 50 lit. g, que
 * modificó la Ley 2439 art. 4; Ley 1581 arts. 14 y 15).
 *
 * **Radicar** (`POST /api/v1/solicitudes`): cualquier persona, con o sin pedido. Recibe
 * `R-<consecutivo>` con la fecha y la hora, el vencimiento y un enlace para seguirla.
 * - El consecutivo es por tienda (`tienda.ultima_solicitud`), y sube en el mismo lote que escribe
 *   la solicitud: dos a la vez nunca reciben el mismo número.
 * - El contacto, el texto y el código del pedido van cifrados en `sobre` con la DEK
 *   `datos_personales` de la tienda (§14.2), atados a su fila. En claro solo quedan el tipo, las
 *   fechas y el estado.
 * - La autorización (casilla sin marcar) tiene que llegar en `true`; su instante y la huella de la
 *   política publicada van en el sobre.
 * - El vencimiento sale de `ref_tipo_solicitud` y de `@ed1/calendario`: días hábiles de Colombia
 *   con sus festivos. El retracto vence a los 15 días calendario, que es el plazo del reembolso
 *   (Ley 1480 art. 47); si cae en un día no hábil, se corre al siguiente hábil.
 * - El secreto del enlace nace en el navegador; aquí solo queda su SHA-256. Reenviar el mismo
 *   formulario responde la misma solicitud (`duplicada`).
 *
 * **Seguir** (`POST /api/v1/solicitudes/seguimiento`): con el radicado y el secreto; cualquier
 * fallo responde lo mismo, y la respuesta no dice nada de la persona.
 */

import { esHabil, fechaEnBogota, sumarDiasCalendario, sumarDiasHabiles } from '@ed1/calendario';
import { type Aleatorio, cifrarSobre, type Kek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { NOMBRE_DEL_TIPO, TIPOS_DE_SOLICITUD, type TipoDeSolicitud } from '@ed1/tienda-schema';
import { z } from 'zod';
import { dekVigente } from './llaves.ts';
import { sha256 } from './pedidos.ts';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{6}$/;
const SECRETO = /^[A-Za-z0-9_-]{22}$/;

export { NOMBRE_DEL_TIPO, TIPOS_DE_SOLICITUD, type TipoDeSolicitud };

/** El plazo del reembolso del retracto: días calendario, no hábiles (Ley 1480 art. 47). */
export const DIAS_DEL_REEMBOLSO = 15;

export const PeticionDeSolicitud = z.object({
  tipo: z.enum(TIPOS_DE_SOLICITUD),
  pedido: z.string().trim().toUpperCase().regex(CROCKFORD).optional(),
  texto: z.string().trim().min(10).max(2000),
  contacto: z.string().trim().min(5).max(120),
  /** La casilla, que nunca viene marcada: tiene que llegar en `true` (Ley 1581 art. 9). */
  acepta: z.literal(true),
  seguimiento: z.string().regex(SECRETO),
});
export type PeticionDeSolicitud = z.infer<typeof PeticionDeSolicitud>;

export const PeticionDeSeguimientoDeSolicitud = z.object({
  radicado: z.number().int().min(1),
  secreto: z.string().regex(SECRETO),
});

/** El primer día hábil desde `fecha`, incluida. */
function habilDesde(fecha: string): string {
  let f = fecha;
  while (!esHabil(f)) f = sumarDiasCalendario(f, 1);
  return f;
}

/**
 * El último día para responder (`AAAA-MM-DD`, en Colombia), desde el instante en que se radicó.
 * Días hábiles con festivos; el retracto, días calendario corridos al siguiente hábil (CA2 y CA3).
 */
export function vencimiento(tipo: TipoDeSolicitud, diasHabiles: number, creadaMs: number): string {
  const dia = fechaEnBogota(creadaMs);
  if (tipo === 'retracto') return habilDesde(sumarDiasCalendario(dia, DIAS_DEL_REEMBOLSO));
  return sumarDiasHabiles(dia, diasHabiles);
}

export interface ContextoDeSolicitud {
  db: BaseD1;
  org: string;
  /** El instante de ahora (ms). */
  ahora: number;
  kek: Kek;
  /** La huella de `/legal/privacidad/index.md` publicada; `null` si la tienda no ha publicado. */
  politicaPublicada: string | null;
  /** Un id nuevo para la solicitud (UUID). */
  id: string;
  aleatorio?: Aleatorio;
}

export interface Radicada {
  estado: 'radicada' | 'duplicada';
  radicado: string;
  numero: number;
  tipo: string;
  creada: string;
  vence: string;
}

async function laQueYaEsta(
  db: BaseD1,
  org: string,
  huella: string,
): Promise<Omit<Radicada, 'estado'> | null> {
  const s = await db
    .prepare(
      'SELECT radicado, tipo, creada, vence FROM solicitud WHERE org_id = ? AND seguimiento_huella = ?',
    )
    .bind(org, huella)
    .first<{ radicado: number; tipo: TipoDeSolicitud; creada: string; vence: string }>();
  return s
    ? {
        radicado: `R-${s.radicado}`,
        numero: s.radicado,
        tipo: NOMBRE_DEL_TIPO[s.tipo] ?? s.tipo,
        creada: s.creada,
        vence: s.vence,
      }
    : null;
}

export async function radicar(
  c: ContextoDeSolicitud,
  p: PeticionDeSolicitud,
): Promise<Radicada | { estado: 'no-existe' }> {
  const huella = await sha256(p.seguimiento);
  const previa = await laQueYaEsta(c.db, c.org, huella);
  if (previa) return { estado: 'duplicada', ...previa };

  const [tienda, ref] = await Promise.all([
    c.db
      .prepare('SELECT org_id FROM tienda WHERE org_id = ?')
      .bind(c.org)
      .first<{ org_id: string }>(),
    c.db
      .prepare('SELECT dias_habiles FROM ref_tipo_solicitud WHERE id = ?')
      .bind(p.tipo)
      .first<{ dias_habiles: number }>(),
  ]);
  if (!tienda || !ref) return { estado: 'no-existe' };
  // El pedido se enlaza si es de esta tienda; si no, el código queda solo en el sobre. La respuesta
  // es la misma en los dos casos: radicar no sirve para averiguar qué códigos existen.
  const pedido = p.pedido
    ? await c.db
        .prepare('SELECT id FROM pedido WHERE org_id = ? AND codigo = ?')
        .bind(c.org, p.pedido)
        .first<{ id: string }>()
    : null;

  const creada = new Date(c.ahora).toISOString();
  const vence = vencimiento(p.tipo, ref.dias_habiles, c.ahora);
  const dek = await dekVigente(c.db, c.org, 'datos_personales', c.kek, creada, c.aleatorio);
  const sobre = await cifrarSobre(
    dek,
    { org: c.org, tabla: 'solicitud', campo: 'sobre', id: c.id },
    JSON.stringify({
      contacto: p.contacto,
      texto: p.texto,
      pedido: p.pedido ?? null,
      autorizacion: { instante: creada, politica: c.politicaPublicada },
    }),
    c.aleatorio,
  );
  try {
    await c.db.batch([
      c.db
        .prepare('UPDATE tienda SET ultima_solicitud = ultima_solicitud + 1 WHERE org_id = ?')
        .bind(c.org),
      c.db
        .prepare(
          `INSERT INTO solicitud (org_id, id, radicado, tipo, pedido_id, canal, estado, sobre, iv, llave_version,
             creada, vence, seguimiento_huella)
           VALUES (?, ?, (SELECT ultima_solicitud FROM tienda WHERE org_id = ?), ?, ?, 'web', 'radicada', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          c.org,
          c.id,
          c.org,
          p.tipo,
          pedido?.id ?? null,
          sobre.sobre,
          sobre.iv,
          sobre.version,
          creada,
          vence,
          huella,
        ),
    ]);
  } catch (e) {
    // El mismo formulario enviado dos veces a la vez: el índice único atrapa al segundo.
    if (/UNIQUE/i.test(String(e))) {
      const ya = await laQueYaEsta(c.db, c.org, huella);
      if (ya) return { estado: 'duplicada', ...ya };
    }
    throw e;
  }
  const escrita = await laQueYaEsta(c.db, c.org, huella);
  if (!escrita) throw new Error('la solicitud recién escrita no se pudo leer');
  return { estado: 'radicada', ...escrita };
}

const ESTADO_EN_PALABRAS: Record<string, string> = {
  radicada: 'Recibida: la tienda la va a revisar',
  en_tramite: 'En trámite',
  respondida: 'Respondida',
  cerrada: 'Cerrada',
};

export interface SeguimientoDeSolicitud {
  radicado: string;
  tipo: string;
  estado: string;
  enPalabras: string;
  creada: string;
  vence: string;
  respondida: string | null;
}

/** La solicitud, si el secreto es el suyo; `null` para todo lo demás, sin decir qué falló. */
export async function seguirSolicitud(
  db: BaseD1,
  org: string,
  radicado: number,
  secreto: string,
): Promise<SeguimientoDeSolicitud | null> {
  const huella = await sha256(secreto);
  const s = await db
    .prepare(
      'SELECT radicado, tipo, estado, creada, vence, respondida, seguimiento_huella FROM solicitud WHERE org_id = ? AND radicado = ?',
    )
    .bind(org, radicado)
    .first<{
      radicado: number;
      tipo: TipoDeSolicitud;
      estado: string;
      creada: string;
      vence: string;
      respondida: string | null;
      seguimiento_huella: string | null;
    }>();
  // El mismo trabajo con o sin solicitud: comparar contra una huella de relleno.
  const guardada = s?.seguimiento_huella ?? '0'.repeat(64);
  let diferencia = guardada.length ^ huella.length;
  for (let i = 0; i < Math.max(guardada.length, huella.length); i++) {
    diferencia |= (guardada.charCodeAt(i) || 0) ^ (huella.charCodeAt(i) || 0);
  }
  if (diferencia !== 0 || !s?.seguimiento_huella) return null;
  return {
    radicado: `R-${s.radicado}`,
    tipo: NOMBRE_DEL_TIPO[s.tipo] ?? s.tipo,
    estado: s.estado,
    enPalabras: ESTADO_EN_PALABRAS[s.estado] ?? s.estado,
    creada: s.creada,
    vence: s.vence,
    respondida: s.respondida,
  };
}
