/**
 * `POST /api/v1/sync/push` (HU-E5.2, ARQUITECTURA §5.6): sube un lote de ≤ 25 operaciones.
 *
 * Presupuesto de consultas (CA1, P17): D1 gratuito admite 50 por invocación. Este endpoint hace
 * 3 lecturas (registros y catálogos ya guardados, y la finca de la organización) y UNA escritura
 * por operación, todas en un solo `batch`, que es una transacción: o queda el lote o no queda nada.
 * 25 operaciones = 28 consultas.
 *
 * Por operación:
 * - **Registro:** `INSERT OR IGNORE` por id. Si ya estaba, `duplicado` (CA2).
 * - **Catálogo:** si es nuevo, se inserta; si trae una versión mayor, se actualiza y el trigger
 *   guarda la anterior en `entidad_historial`; si trae la misma versión con los mismos datos,
 *   `duplicado`; si trae una versión menor o la misma con otros datos (dos teléfonos sin señal),
 *   se guarda en `entidad_historial` como conflicto. Nada se pierde (HU-E5.4 decidirá qué mostrar).
 * - **Lo que no sirve** va a `cuarentena` con el motivo en palabras, nunca se descarta (CA3, P1).
 *
 * Tenant (HU-E5.1): la organización sale del token. Un dato que dice ser de otra organización, de
 * otra finca, o un id que ya usa otra organización, va a cuarentena.
 */

import type { SentenciaD1 } from '@gestionagro/d1';
import {
  type Ack,
  LOTE_MAXIMO,
  type OperacionValida,
  PROTOCOLO,
  pedidoDeActualizar,
  RELOJ_CORRIDO_MS,
  validarOperacion,
} from '@gestionagro/sync';
import { nivelDeLaCelda, respuestaDePausa } from './nivel.ts';
import type { ContextoCelda } from './worker.ts';

type Plan =
  | { tipo: 'cuarentena'; id: string; motivo: string; operacion: unknown }
  | { tipo: 'duplicado'; id: string }
  | {
      tipo: 'escritura';
      id: string;
      sentencia: SentenciaD1;
      /** Qué responder si la sentencia no cambió ninguna fila. */
      siCero: 'duplicado' | 'aceptado' | 'reintentar';
    };

const marcadores = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export async function push(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const { org, db } = c.get('sesion');
  // Con la cuota de D1 agotada, escribir fallaría: se dice por qué y cuándo vuelve (HU-E8.6).
  if ((await nivelDeLaCelda(c.env.FLAGS)) === 'bloqueo')
    return respuestaDePausa(c, 'bloqueo', ahora());
  let cuerpo: { protocolo?: unknown; dispositivo?: unknown; app?: unknown; ops?: unknown };
  try {
    cuerpo = (await c.req.json()) as typeof cuerpo;
  } catch {
    return c.json({ estado: 'invalido', motivo: 'El lote no es JSON' }, 400);
  }
  if (cuerpo.protocolo !== PROTOCOLO) {
    // El teléfono conserva todo: no se descarta nada, se le pide actualizar (ADR-13).
    return c.json({ estado: 'protocolo', motivo: 'Actualiza la app para sincronizar.' }, 400);
  }
  const dispositivo =
    typeof cuerpo.dispositivo === 'string' ? cuerpo.dispositivo.slice(0, 120) : '';
  if (!dispositivo) return c.json({ estado: 'invalido', motivo: 'Falta el teléfono' }, 400);
  if (!Array.isArray(cuerpo.ops) || cuerpo.ops.length === 0) {
    return c.json({ estado: 'invalido', motivo: 'El lote no trae operaciones' }, 400);
  }
  if (cuerpo.ops.length > LOTE_MAXIMO) {
    return c.json(
      { estado: 'lote-grande', motivo: `Un lote lleva como máximo ${LOTE_MAXIMO} operaciones` },
      413,
    );
  }

  const instante = new Date(ahora()).toISOString();
  const validadas = cuerpo.ops.map((op) => ({ entrada: op, r: validarOperacion(op) }));
  const validas = validadas.flatMap(({ r }) => (r.ok ? [r.op] : []));
  const idsRegistro = validas.filter((o) => o.entidad === 'registro').map((o) => o.entidad_id);
  const idsCatalogo = validas.filter((o) => o.entidad !== 'registro').map((o) => o.entidad_id);

  // Las 3 lecturas.
  const [registros, catalogos, fincaDeLaOrg] = await Promise.all([
    idsRegistro.length > 0
      ? db
          .prepare(
            `SELECT id, org_id FROM registro WHERE id IN (${marcadores(idsRegistro.length)})`,
          )
          .bind(...idsRegistro)
          .all<{ id: string; org_id: string }>()
      : { results: [] },
    idsCatalogo.length > 0
      ? db
          .prepare(
            `SELECT id, org_id, entidad, version, datos FROM catalogo WHERE id IN (${marcadores(idsCatalogo.length)})`,
          )
          .bind(...idsCatalogo)
          .all<{ id: string; org_id: string; entidad: string; version: number; datos: string }>()
      : { results: [] },
    db
      .prepare("SELECT id FROM catalogo WHERE org_id = ? AND entidad = 'finca' LIMIT 1")
      .bind(org)
      .first<{ id: string }>(),
  ]);
  const registroGuardado = new Map(registros.results.map((r) => [r.id, r]));
  const catalogoGuardado = new Map(catalogos.results.map((r) => [r.id, r]));
  // La finca del lote cuenta para las operaciones que vienen después en el mismo lote.
  let finca = fincaDeLaOrg?.id ?? null;

  const cuarentena = (id: string, motivo: string, operacion: unknown): Plan => ({
    tipo: 'cuarentena',
    id,
    motivo,
    operacion,
  });

  const planear = (op: OperacionValida, entrada: unknown): Plan => {
    const datos = op.entidad === 'registro' ? op.registro : op.catalogo;
    if (datos.org_id !== null && datos.org_id !== org) {
      return cuarentena(op.id, 'El dato es de otra organización', entrada);
    }
    if (op.entidad === 'finca') {
      if (finca && finca !== op.entidad_id) {
        return cuarentena(
          op.id,
          'Esta organización ya tiene otra finca en la nube; no se mezclan',
          entrada,
        );
      }
      finca = op.entidad_id;
    } else {
      const deFinca = (datos as { finca_id?: string }).finca_id;
      if (!finca)
        return cuarentena(
          op.id,
          'La finca todavía no está en la nube: debe subir primero',
          entrada,
        );
      if (deFinca !== undefined && deFinca !== finca) {
        return cuarentena(op.id, 'El dato es de otra finca', entrada);
      }
    }

    if (op.entidad === 'registro') {
      const guardado = registroGuardado.get(op.entidad_id);
      if (guardado && guardado.org_id !== org)
        return cuarentena(op.id, 'Ese id ya lo usa otra organización', entrada);
      if (guardado) return { tipo: 'duplicado', id: op.id };
      const r = op.registro;
      const sentencia = db
        .prepare(
          `INSERT OR IGNORE INTO registro (id, org_id, seq, finca_id, area_ids, ciclo_id, tipo, v,
             fecha_agronomica, instante_evento, instante_recibido, autor_usuario_id, persona_ids,
             dispositivo_id, origen, anula_id, datos)
           VALUES (?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM registro WHERE org_id = ?), ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          r.id,
          org,
          org,
          r.finca_id,
          JSON.stringify(r.area_ids),
          r.ciclo_id,
          r.tipo,
          r.v,
          r.fecha_agronomica,
          r.instante_evento,
          instante,
          r.autor_usuario_id,
          JSON.stringify(r.persona_ids),
          r.dispositivo_id,
          r.origen,
          r.anula_id,
          JSON.stringify(r.datos),
        );
      return { tipo: 'escritura', id: op.id, sentencia, siCero: 'duplicado' };
    }

    const cat = { ...op.catalogo, org_id: org };
    const texto = JSON.stringify(cat);
    const guardado = catalogoGuardado.get(op.entidad_id);
    if (guardado && guardado.org_id !== org)
      return cuarentena(op.id, 'Ese id ya lo usa otra organización', entrada);
    if (guardado && guardado.entidad !== op.entidad)
      return cuarentena(op.id, `Ese id ya es un ${guardado.entidad}`, entrada);
    if (!guardado || cat.version > guardado.version) {
      // Un solo upsert, que solo actualiza si la versión es mayor; el trigger catalogo_a_historial
      // guarda la anterior (migración 0002). Si no cambia nada, otro teléfono escribió en ese
      // instante: `reintentar`, y la vuelta siguiente decide sin perder la versión.
      const sentencia = db
        .prepare(
          `INSERT INTO catalogo (id, org_id, seq, entidad, version, v, datos, actualizado, dispositivo_id)
           VALUES (?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM catalogo WHERE org_id = ?), ?, ?, 1, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET version = excluded.version, datos = excluded.datos,
             actualizado = excluded.actualizado, dispositivo_id = excluded.dispositivo_id, seq = excluded.seq
           WHERE excluded.version > catalogo.version AND catalogo.org_id = excluded.org_id`,
        )
        .bind(cat.id, org, org, op.entidad, cat.version, texto, cat.actualizado, dispositivo);
      return { tipo: 'escritura', id: op.id, sentencia, siCero: 'reintentar' };
    }
    if (cat.version === guardado.version && JSON.stringify(JSON.parse(guardado.datos)) === texto) {
      return { tipo: 'duplicado', id: op.id };
    }
    // Versión menor, o la misma con otros datos: dos teléfonos editaron sin señal. Se guarda.
    const sentencia = db
      .prepare(
        `INSERT OR IGNORE INTO entidad_historial (id, org_id, entidad, entidad_id, version, datos, reemplazada, motivo)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'conflicto')`,
      )
      .bind(
        `${op.id}#${dispositivo}`,
        org,
        op.entidad,
        op.entidad_id,
        cat.version,
        texto,
        instante,
      );
    return { tipo: 'escritura', id: op.id, sentencia, siCero: 'aceptado' };
  };

  const planes: Plan[] = validadas.map(({ entrada, r }, i) =>
    r.ok
      ? planear(r.op, entrada)
      : cuarentena(r.id ?? `sin-id-${instante}-${i}`, r.motivo, entrada),
  );

  const escrituras: { indice: number; sentencia: SentenciaD1 }[] = [];
  planes.forEach((p, indice) => {
    if (p.tipo === 'escritura') escrituras.push({ indice, sentencia: p.sentencia });
    if (p.tipo === 'cuarentena') {
      escrituras.push({
        indice,
        sentencia: db
          .prepare(
            'INSERT OR IGNORE INTO cuarentena (id, org_id, dispositivo_id, recibido, motivo, operacion) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(p.id, org, dispositivo, instante, p.motivo, JSON.stringify(p.operacion ?? null)),
      });
    }
  });
  const resultados =
    escrituras.length > 0 ? await db.batch(escrituras.map((e) => e.sentencia)) : [];
  const cambios = new Map(escrituras.map((e, i) => [e.indice, resultados[i]?.meta.changes ?? 0]));

  // Reloj del teléfono adelantado (ARQUITECTURA §5.7, P8): el registro dice haber pasado en el
  // futuro de la celda. Se guarda igual y se avisa; nunca se corrige la hora en silencio.
  const corridos = new Set(
    validas
      .filter(
        (o) =>
          o.entidad === 'registro' &&
          Date.parse(o.registro.instante_evento) - ahora() > RELOJ_CORRIDO_MS,
      )
      .map((o) => o.id),
  );
  const acks: Ack[] = planes.map((p, i) => {
    if (p.tipo === 'cuarentena') return { id: p.id, estado: 'cuarentena', motivo: p.motivo };
    const aviso = corridos.has(p.id) ? { aviso: 'reloj-corrido' as const } : {};
    if (p.tipo === 'duplicado') return { id: p.id, estado: 'duplicado', ...aviso };
    return { id: p.id, estado: (cambios.get(i) ?? 0) > 0 ? 'aceptado' : p.siCero, ...aviso };
  });
  const actualizar = pedidoDeActualizar(cuerpo.app);
  return c.json(actualizar ? { acks, actualizar } : { acks });
}
