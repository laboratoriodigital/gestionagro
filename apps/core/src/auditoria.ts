/**
 * Auditoría de lo que toca seguridad o dinero (HU-C2.4, PLATAFORMA §4.12, migración 0008).
 *
 * Una fila por hecho: una entrada, una invitación aceptada, un cambio de rol, una persona quitada,
 * un teléfono retirado y un pago cerrado (que, si se aprobó, es también el cambio de plan). No se
 * registran lecturas ni renovaciones: cada fila cuesta escrituras de la cuota (ARQUITECTURA §6.2).
 * La excepción es una renovación rechazada por venir de otra app (HU-C4.4): es un posible robo.
 *
 * La fila se escribe en el mismo lote que el hecho, con `INSERT … SELECT … WHERE EXISTS`: queda
 * solo si el hecho quedó. Nunca hay una auditoría de algo que no pasó, ni un hecho sin su fila.
 *
 * La lectura (`POST /api/core/auditoria/ver`) está en `equipo.ts`, con la revisión de quién
 * administra.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';

export type Accion =
  | 'entrada'
  | 'invitacion_aceptada'
  | 'rol_cambiado'
  | 'persona_quitada'
  | 'telefono_retirado'
  | 'pago_cerrado'
  /** Un refresh presentado desde la app de otro producto (HU-C4.4): posible robo. */
  | 'refresh_rechazado'
  /** La persona cerró una sesión, o todas menos la suya, desde su cuenta (HU-C7.5). */
  | 'sesion_cerrada'
  /** Una persona dio acceso a un agente sobre una organización (HU-C9.4). */
  | 'concesion_creada'
  /** Se quitó el acceso de un agente: a pedido, o por reuso de un refresh (HU-C9.5, HU-C9.6). */
  | 'concesion_revocada'
  /**
   * El dueño vio un bloque de la consola (HU-C13.1 CA4). Es la única lectura que se registra: la
   * consola ve números de toda la plataforma, y lo que ve alguien así queda dicho.
   */
  | 'consola_vista';

export interface Hecho {
  instante: string;
  /** Hasta HU-C3.1 todo es del agro: la sesión todavía no dice su producto. */
  producto: string;
  org_id: string | null;
  /** Quién hizo el hecho. */
  usuario_id: string | null;
  accion: Accion;
  detalle?: Record<string, unknown>;
}

/**
 * La fila del hecho, condicionada a que `condicion` (un `EXISTS` con sus valores) se cumpla en el
 * mismo lote. Sin condición, se escribe siempre.
 */
export function filaDeAuditoria(
  db: BaseD1,
  hecho: Hecho,
  condicion?: { sql: string; valores: unknown[] },
): SentenciaD1 {
  const valores = [
    hecho.instante,
    hecho.producto,
    hecho.org_id,
    hecho.usuario_id,
    hecho.accion,
    hecho.detalle ? JSON.stringify(hecho.detalle) : null,
  ];
  const sql =
    'INSERT INTO auditoria (instante, producto, org_id, usuario_id, accion, detalle) ' +
    `SELECT ?, ?, ?, ?, ?, ?${condicion ? ` WHERE EXISTS (${condicion.sql})` : ''}`;
  return db.prepare(sql).bind(...valores, ...(condicion?.valores ?? []));
}
