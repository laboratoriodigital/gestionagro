/**
 * Las solicitudes en el panel (HU-T9.7, TIENDA-3.0 §8.6), con el permiso `solicitudes.gestionar`.
 *
 * - **La lista** dice cada una con su vencimiento en días de Colombia: las abiertas primero, de la
 *   que vence antes a la que vence después, así que una vencida sin respuesta queda arriba (CA3).
 *   Avisa a 3 días y el día que vence (CA1). El retracto vence con el reloj del reembolso, 15 días
 *   calendario (`vencimiento` en `solicitudes.ts`); un pago aprobado sin existencias lleva el suyo,
 *   15 días calendario desde que se aprobó (Ley 2439, lit. h; CA2).
 * - **Abrirla** descifra lo que contó la persona y lo deja en el registro, como ver los datos de
 *   entrega de un pedido (HU-T9.2): es la única respuesta del panel con el contacto en claro.
 * - **Responder** guarda la respuesta en el mismo sobre cifrado y la pasa a «respondida»; el panel
 *   ofrece mandarla por el canal que dejó la persona. **Cerrar** pide haberla respondido; la base
 *   tampoco deja cerrar una sin respuesta (`solicitud_cerrada_respondida`).
 */
import { fechaEnBogota, sumarDiasCalendario } from '@ed1/calendario';
import { cifrarSobre, DescifradoFallido, descifrarSobre, type Kek } from '@ed1/cifrado';
import { z } from 'zod';
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { deksDeLaTienda, dekVigente } from './llaves.ts';
import { anotar } from './registro.ts';
import { DIAS_DEL_REEMBOLSO, NOMBRE_DEL_TIPO, type TipoDeSolicitud } from './solicitudes.ts';

/** A cuántos días del vencimiento empieza el aviso (CA1). */
export const DIAS_DE_AVISO = 3;

export type Alerta = 'vencida' | 'hoy' | 'pronto' | null;

export interface FilaDeSolicitud {
  id: string;
  radicado: string;
  tipo: string;
  tipoId: TipoDeSolicitud;
  estado: 'radicada' | 'en_tramite' | 'respondida' | 'cerrada';
  creada: string;
  vence: string;
  respondida: string | null;
  cerrada: string | null;
  /** El número del pedido que nombra, si es de esta tienda. */
  pedido: number | null;
  /** Días calendario de hoy (Colombia) al vencimiento; negativo si ya venció. */
  dias: number;
  /** Solo las que esperan respuesta tienen aviso. */
  alerta: Alerta;
  /** Qué cuenta el reloj: la respuesta o, en el retracto, el reembolso. */
  reloj: 'respuesta' | 'reembolso';
}

/** Un pago aprobado cuando ya no había unidades: el comercio repone o devuelve en 15 días. */
export interface ReembolsoPendiente {
  pedidoId: string;
  pedido: number;
  aprobado: string;
  vence: string;
  dias: number;
  alerta: Alerta;
}

const abierta = (estado: string) => estado === 'radicada' || estado === 'en_tramite';

/** Días entre dos fechas `AAAA-MM-DD`, con el calendario: nada de husos ni de horas. */
export const diasEntre = (desde: string, hasta: string) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000);

export function alertaDe(dias: number): Alerta {
  if (dias < 0) return 'vencida';
  if (dias === 0) return 'hoy';
  return dias <= DIAS_DE_AVISO ? 'pronto' : null;
}

interface FilaCruda {
  id: string;
  radicado: number;
  tipo: TipoDeSolicitud;
  estado: FilaDeSolicitud['estado'];
  creada: string;
  vence: string;
  respondida: string | null;
  cerrada: string | null;
  numero: number | null;
}

const COLUMNAS = `s.id, s.radicado, s.tipo, s.estado, s.creada, s.vence, s.respondida, s.cerrada,
  (SELECT p.numero FROM pedido p WHERE p.org_id = ? AND p.id = s.pedido_id) AS numero`;

function enFila(f: FilaCruda, hoy: string): FilaDeSolicitud {
  const dias = diasEntre(hoy, f.vence);
  return {
    id: f.id,
    radicado: `R-${f.radicado}`,
    tipo: NOMBRE_DEL_TIPO[f.tipo] ?? f.tipo,
    tipoId: f.tipo,
    estado: f.estado,
    creada: f.creada,
    vence: f.vence,
    respondida: f.respondida,
    cerrada: f.cerrada,
    pedido: f.numero,
    dias,
    alerta: abierta(f.estado) ? alertaDe(dias) : null,
    reloj: f.tipo === 'retracto' ? 'reembolso' : 'respuesta',
  };
}

/** CA1 a CA3: las abiertas por vencimiento, después las respondidas y al final las cerradas. */
export async function listarSolicitudes(
  q: Quien,
  ahoraMs: number,
): Promise<{ solicitudes: FilaDeSolicitud[]; reembolsos: ReembolsoPendiente[] }> {
  const hoy = fechaEnBogota(ahoraMs);
  const [{ results }, cobros] = await Promise.all([
    q.db
      .prepare(
        `SELECT ${COLUMNAS} FROM solicitud s WHERE s.org_id = ?
          ORDER BY CASE s.estado WHEN 'radicada' THEN 0 WHEN 'en_tramite' THEN 0 WHEN 'respondida' THEN 1 ELSE 2 END,
                   CASE WHEN s.estado = 'cerrada' THEN NULL ELSE s.vence END, s.creada DESC
          LIMIT 500`,
      )
      .bind(q.org, q.org)
      .all<FilaCruda>(),
    q.db
      .prepare(
        `SELECT p.id, p.numero, c.actualizado FROM cobro c
           JOIN pedido p ON p.org_id = ? AND p.id = c.pedido_id
          WHERE c.org_id = ? AND c.estado = 'aprobado_sin_existencias'
          ORDER BY c.actualizado`,
      )
      .bind(q.org, q.org)
      .all<{ id: string; numero: number; actualizado: string }>(),
  ]);
  return {
    solicitudes: results.map((f) => enFila(f, hoy)),
    reembolsos: cobros.results.map((c) => {
      const vence = sumarDiasCalendario(
        fechaEnBogota(Date.parse(c.actualizado)),
        DIAS_DEL_REEMBOLSO,
      );
      const dias = diasEntre(hoy, vence);
      return {
        pedidoId: c.id,
        pedido: c.numero,
        aprobado: c.actualizado,
        vence,
        dias,
        alerta: alertaDe(dias),
      };
    }),
  };
}

/** Lo que guarda el sobre de la solicitud (HU-T6.4) y, desde HU-T9.7, su respuesta. */
const Sobre = z.object({
  contacto: z.string(),
  texto: z.string(),
  pedido: z.string().nullable(),
  autorizacion: z.unknown(),
  respuesta: z.object({ texto: z.string(), instante: z.string() }).optional(),
});
type Sobre = z.infer<typeof Sobre>;

const contexto = (org: string, id: string) => ({ org, tabla: 'solicitud', campo: 'sobre', id });
const bytes = (v: ArrayBuffer | Uint8Array) => (v instanceof Uint8Array ? v : new Uint8Array(v));

type Lectura =
  | { estado: 'ok'; fila: FilaDeSolicitud; sobre: Sobre }
  | { estado: 'no-existe'; motivo: string }
  | { estado: 'sin-llave'; motivo: string };

const NO_ESTA = { estado: 'no-existe', motivo: 'Esa solicitud no está.' } as const;
const SIN_LLAVE = {
  estado: 'sin-llave',
  motivo: 'No pudimos abrir la solicitud ahora. Intenta en unos minutos.',
} as const;

async function leer(q: Quien, kek: Kek | null, id: string, ahoraMs: number): Promise<Lectura> {
  const f = await q.db
    .prepare(
      `SELECT ${COLUMNAS}, s.sobre, s.iv, s.llave_version FROM solicitud s WHERE s.org_id = ? AND s.id = ?`,
    )
    .bind(q.org, q.org, id)
    .first<
      FilaCruda & {
        sobre: ArrayBuffer | Uint8Array;
        iv: ArrayBuffer | Uint8Array;
        llave_version: number;
      }
    >();
  if (!f) return NO_ESTA;
  if (!kek) {
    console.error('tienda-api: sin la KEK no se abren las solicitudes');
    return SIN_LLAVE;
  }
  const deks = await deksDeLaTienda(q.db, q.org, 'datos_personales', new Map([[kek.id, kek]]));
  try {
    const texto = await descifrarSobre(deks, contexto(q.org, id), {
      sobre: bytes(f.sobre),
      iv: bytes(f.iv),
      version: f.llave_version,
    });
    const sobre = Sobre.parse(JSON.parse(texto));
    return { estado: 'ok', fila: enFila(f, fechaEnBogota(ahoraMs)), sobre };
  } catch (e) {
    if (!(e instanceof DescifradoFallido) && !(e instanceof z.ZodError)) throw e;
    console.error('tienda-api: una solicitud no se pudo abrir');
    return SIN_LLAVE;
  }
}

const PeticionDeSolicitud = z.object({ id: z.string().min(1).max(64) });

export type Detalle =
  | {
      estado: 'ok';
      solicitud: FilaDeSolicitud;
      contacto: string;
      texto: string;
      codigoDelPedido: string | null;
      respuesta: { texto: string; instante: string } | null;
    }
  | Exclude<Lectura, { estado: 'ok' }>;

/** Abrir una solicitud: lo que contó la persona, en claro, y la lectura en el registro. */
export async function verSolicitud(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
  ahoraMs: number,
): Promise<Detalle> {
  const r0 = PeticionDeSolicitud.safeParse(cuerpo);
  if (!r0.success) return NO_ESTA;
  const l = await leer(q, kek, r0.data.id, ahoraMs);
  if (l.estado !== 'ok') return l;
  await q.db.batch([
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'solicitud.ver',
      entidad: 'solicitud',
      entidadId: l.fila.id,
      antes: null,
      despues: { radicado: l.fila.radicado },
      instante: q.instante,
    }),
  ]);
  return {
    estado: 'ok',
    solicitud: l.fila,
    contacto: l.sobre.contacto,
    texto: l.sobre.texto,
    codigoDelPedido: l.sobre.pedido,
    respuesta: l.sobre.respuesta ?? null,
  };
}

const Respuesta = z.object({
  op: z.string().min(8).max(64),
  id: z.string().min(1).max(64),
  respuesta: z
    .string()
    .trim()
    .min(10, 'la respuesta necesita al menos 10 caracteres')
    .max(4000, 'la respuesta no puede pasar de 4.000 caracteres'),
});

const problemas = (campo: string, mensaje: string): Resultado => ({
  estado: 'problemas',
  problemas: [{ campo, mensaje }],
});

const YA_RESPONDIDA =
  'Esta solicitud ya tiene respuesta: alguien del equipo la respondió mientras escribías. Ábrela otra vez para verla.';

async function correr(
  q: Quien,
  op: string,
  lote: Parameters<Quien['db']['batch']>[0],
  r: Resultado,
) {
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e)) return { estado: 'cambiado', motivo: YA_RESPONDIDA, version: null } as const;
    if (esOperacionRepetida(e)) return (await yaAplicada(q, op)) ?? r;
    if (/solicitud_cerrada_respondida/.test(String(e)))
      return problemas(
        'solicitud',
        'Primero respóndela: una solicitud no se cierra sin respuesta.',
      );
    throw e;
  }
}

/** Responder (CA1): la respuesta va en el sobre, con la llave vigente, y la solicitud queda respondida. */
export async function responderSolicitud(
  q: Quien,
  kek: Kek | null,
  cuerpo: unknown,
  ahoraMs: number,
): Promise<Resultado | typeof SIN_LLAVE> {
  const r0 = Respuesta.safeParse(cuerpo);
  if (!r0.success) {
    const i = r0.error.issues[0];
    return problemas(String(i?.path[0] ?? 'respuesta'), i?.message ?? 'falta la respuesta');
  }
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const l = await leer(q, kek, d.id, ahoraMs);
  if (l.estado === 'no-existe') return { estado: 'no-existe', motivo: l.motivo };
  if (l.estado === 'sin-llave' || !kek) return SIN_LLAVE;
  if (!abierta(l.fila.estado)) return { estado: 'cambiado', motivo: YA_RESPONDIDA, version: null };
  const dek = await dekVigente(q.db, q.org, 'datos_personales', kek, q.instante);
  const sobre = await cifrarSobre(
    dek,
    contexto(q.org, d.id),
    JSON.stringify({ ...l.sobre, respuesta: { texto: d.respuesta, instante: q.instante } }),
  );
  const r: Resultado = { estado: 'guardado', id: d.id, version: 1 };
  return correr(
    q,
    d.op,
    [
      q.db
        .prepare(
          `UPDATE solicitud SET sobre = ?, iv = ?, llave_version = ?, estado = 'respondida', respondida = ?
            WHERE org_id = ? AND id = ? AND estado IN ('radicada', 'en_tramite')`,
        )
        .bind(sobre.sobre, sobre.iv, sobre.version, q.instante, q.org, d.id),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'solicitud.responder',
        entidad: 'solicitud',
        entidadId: d.id,
        antes: { estado: l.fila.estado },
        despues: { radicado: l.fila.radicado, estado: 'respondida' },
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'solicitudes/responder', r),
    ],
    r,
  );
}

const Cierre = z.object({ op: z.string().min(8).max(64), id: z.string().min(1).max(64) });

/** Cerrar (CA3 ❌): solo una respondida. La base lo vuelve a revisar. */
export async function cerrarSolicitud(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Cierre.safeParse(cuerpo);
  if (!r0.success) return { estado: 'no-existe', motivo: NO_ESTA.motivo };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const f = await q.db
    .prepare('SELECT radicado, estado FROM solicitud WHERE org_id = ? AND id = ?')
    .bind(q.org, d.id)
    .first<{ radicado: number; estado: string }>();
  if (!f) return { estado: 'no-existe', motivo: NO_ESTA.motivo };
  if (f.estado === 'cerrada') return { estado: 'guardado', id: d.id, version: 1 };
  const r: Resultado = { estado: 'guardado', id: d.id, version: 1 };
  return correr(
    q,
    d.op,
    [
      q.db
        .prepare(
          `UPDATE solicitud SET estado = 'cerrada', cerrada = ? WHERE org_id = ? AND id = ? AND estado <> 'cerrada'`,
        )
        .bind(q.instante, q.org, d.id),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'solicitud.cerrar',
        entidad: 'solicitud',
        entidadId: d.id,
        antes: { estado: f.estado },
        despues: { radicado: `R-${f.radicado}`, estado: 'cerrada' },
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'solicitudes/cerrar', r),
    ],
    r,
  );
}
