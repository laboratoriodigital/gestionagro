/**
 * `POST /api/v1/sync/push` del parqueadero (HU-Q7.4, PARQUEADERO §10.2 y §12): sube un lote de
 * ≤ 25 operaciones de una caja. Es el push de la celda agro con dos diferencias que exige el shard:
 *
 * 1. **`ON CONFLICT (id) DO NOTHING`, no `INSERT OR IGNORE`.** `OR IGNORE` también se salta en
 *    silencio un número de recibo repetido: el recibo se perdería con el ack «duplicado». Así, el
 *    reenvío del mismo id es `duplicado` y un consecutivo repetido **falla** (CA2).
 * 2. **Un lote que falla se reintenta de a una operación.** Un `batch` de D1 es todo o nada: si la
 *    base rechaza una operación (un consecutivo repetido, una serie que no es del dispositivo, una
 *    anulación de algo que no está), las demás se escriben solas y solo la mala va a cuarentena,
 *    con el motivo de la base en palabras. Nada se descarta (P1).
 *
 * Presupuesto de consultas (P17): D1 gratuito admite 50 por invocación. El camino normal hace 4
 * lecturas y un `batch` con una sentencia por operación: 25 operaciones son 29 consultas. Si el
 * batch falla, cada operación reintentada cuesta 1 consulta, o 2 si va a cuarentena; cuando no
 * alcanza, las que faltan vuelven como `reintentar` y la caja las manda en el envío siguiente.
 *
 * Permisos (HU-Q7.8, WI-Q7.8.2): cada operación pasa por `decidirEscritura` con el rol y el usuario
 * del token. Una negada va a cuarentena con su motivo y el lote sigue.
 *
 * Una caja retirada (HU-Q7.7 CA3) no sube nada: 403 `retirado`, y su cola queda en ella.
 *
 * Tenant: la organización sale del token. Un dato que dice ser de otro parqueadero, o un id que ya
 * usa otro, va a cuarentena.
 */
import type { SentenciaD1 } from '@ed1/d1';
import type { Registro } from '@ed1/parqueadero-schema';
import {
  decidirEscritura,
  entidadesQuePuede,
  type OperacionValida,
  validarOperacion,
} from '@ed1/parqueadero-schema/sync';
import { type Ack, LOTE_MAXIMO, PROTOCOLO, RELOJ_CORRIDO_MS } from '@ed1/sync';
import { estadoDeLaCaja, RETIRADA } from './dispositivos.ts';
import type { ContextoCelda } from './worker.ts';

/** D1 gratuito: consultas por invocación (Cloudflare, límites de D1). */
export const CONSULTAS_POR_INVOCACION = 50;

type Plan =
  | { tipo: 'cuarentena'; id: string; motivo: string; operacion: unknown }
  | { tipo: 'duplicado'; id: string }
  | {
      tipo: 'escritura';
      id: string;
      sentencia: SentenciaD1;
      operacion: unknown;
      /** Qué responder si la sentencia no cambió ninguna fila. */
      siCero: 'duplicado' | 'reintentar';
    };

/**
 * Lo que la base dice cuando rechaza un dato (los `RAISE` de la migración 0001 y sus restricciones).
 * Cualquier otro error es de la base o del código, no del dato: se lanza y la caja reintenta.
 */
const RECHAZOS_DE_LA_BASE = [
  'este tipo de registro es un recibo y necesita serie y consecutivo',
  'este tipo de registro no lleva número de recibo',
  'una entrada abre su propia estadía: estadia_id = id',
  'una anulación necesita el registro que anula',
  'anula un registro que este parqueadero no tiene',
  'la serie del recibo no es la del dispositivo que lo hizo',
  'un catálogo no cambia de parqueadero ni de entidad',
  'la versión de un catálogo solo sube',
] as const;

/** El motivo en palabras de un rechazo de la base, o `null` si el error no es del dato. */
export function motivoDeLaBase(error: unknown): string | null {
  const mensaje = error instanceof Error ? error.message : String(error);
  if (
    /UNIQUE constraint failed: registro\.org_id, registro\.serie, registro\.consecutivo/.test(
      mensaje,
    )
  )
    return 'Ese número de recibo ya lo tiene otro registro de este parqueadero';
  const propio = RECHAZOS_DE_LA_BASE.find((r) => mensaje.includes(r));
  if (propio) return `La nube lo rechazó: ${propio}`;
  if (/constraint failed|SQLITE_CONSTRAINT/i.test(mensaje))
    return `La nube lo rechazó: ${mensaje.replace(/^D1_ERROR: /, '').replace(/: SQLITE_CONSTRAINT.*$/, '')}`;
  return null;
}

const marcadores = (n: number) => Array.from({ length: n }, () => '?').join(', ');
/** Los datos de un catálogo sin su número de versión: para saber si ya se tenían. */
const sinVersion = (datos: string) => JSON.stringify({ ...JSON.parse(datos), version: 0 });

export async function push(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const { org, rol, usuario, db } = c.get('sesion');
  if (entidadesQuePuede(rol, 'escribir').length === 0) {
    return c.json(
      {
        estado: 'sin-permiso',
        motivo: `Con el rol de ${rol} no se registra en este parqueadero.`,
      },
      403,
    );
  }
  let cuerpo: { protocolo?: unknown; dispositivo?: unknown; ops?: unknown };
  try {
    cuerpo = (await c.req.json()) as typeof cuerpo;
  } catch {
    return c.json({ estado: 'invalido', motivo: 'El lote no es JSON' }, 400);
  }
  if (cuerpo.protocolo !== PROTOCOLO) {
    return c.json({ estado: 'protocolo', motivo: 'Actualice la caja para sincronizar.' }, 400);
  }
  const dispositivo =
    typeof cuerpo.dispositivo === 'string' ? cuerpo.dispositivo.slice(0, 120) : '';
  if (!dispositivo) return c.json({ estado: 'invalido', motivo: 'Falta la caja' }, 400);
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
  const delLote = new Map(
    validas.flatMap((o) => (o.entidad === 'registro' ? [[o.entidad_id, o.registro] as const] : [])),
  );
  // Los registros del lote y los que sus anulaciones anulan, en una sola lectura.
  const idsRegistro = [
    ...new Set([
      ...delLote.keys(),
      ...[...delLote.values()].flatMap((r) => (r.anula_id ? [r.anula_id] : [])),
    ]),
  ];
  const idsCatalogo = validas.filter((o) => o.entidad !== 'registro').map((o) => o.entidad_id);
  const anteriores = validas
    .filter((o) => o.entidad !== 'registro')
    .map((o) => `${o.entidad_id}@v${o.version}`);

  // Las 4 lecturas, como mucho: la caja y lo que el lote nombra.
  let consultas = 1 + [idsRegistro, idsCatalogo, anteriores].filter((l) => l.length > 0).length;
  const [caja, registros, catalogos, historial] = await Promise.all([
    estadoDeLaCaja(db, org, dispositivo),
    idsRegistro.length > 0
      ? db
          .prepare(
            `SELECT id, org_id, autor_usuario_id, instante_evento FROM registro WHERE id IN (${marcadores(idsRegistro.length)})`,
          )
          .bind(...idsRegistro)
          .all<{
            id: string;
            org_id: string;
            autor_usuario_id: string | null;
            instante_evento: string;
          }>()
      : { results: [] },
    idsCatalogo.length > 0
      ? db
          .prepare(
            `SELECT id, org_id, entidad, version, datos FROM catalogo WHERE id IN (${marcadores(idsCatalogo.length)})`,
          )
          .bind(...idsCatalogo)
          .all<{ id: string; org_id: string; entidad: string; version: number; datos: string }>()
      : { results: [] },
    anteriores.length > 0
      ? db
          .prepare(
            `SELECT id, datos FROM entidad_historial WHERE org_id = ? AND id IN (${marcadores(anteriores.length)})`,
          )
          .bind(org, ...anteriores)
          .all<{ id: string; datos: string }>()
      : { results: [] },
  ]);
  if (caja === 'retirado') return c.json(RETIRADA, 403);
  const yaVisto = new Map(historial.results.map((h) => [h.id, sinVersion(h.datos)]));
  const registroGuardado = new Map(registros.results.map((r) => [r.id, r]));
  const catalogoGuardado = new Map(catalogos.results.map((r) => [r.id, r]));

  const cuarentena = (id: string, motivo: string, operacion: unknown): Plan => ({
    tipo: 'cuarentena',
    id,
    motivo,
    operacion,
  });

  /** El registro que una anulación anula: el de la celda, de este parqueadero, o uno del lote. */
  const anuladoDe = (
    r: Registro,
  ): Pick<Registro, 'autor_usuario_id' | 'instante_evento'> | null => {
    if (!r.anula_id) return null;
    const guardado = registroGuardado.get(r.anula_id);
    if (guardado) return guardado.org_id === org ? guardado : null;
    return delLote.get(r.anula_id) ?? null;
  };

  const planear = (op: OperacionValida, entrada: unknown): Plan => {
    const datos = op.entidad === 'registro' ? op.registro : op.catalogo;
    if (datos.org_id !== null && datos.org_id !== org) {
      return cuarentena(op.id, 'El dato es de otro parqueadero', entrada);
    }
    const decision = decidirEscritura(
      { rol, usuario_id: usuario },
      op,
      op.entidad === 'registro' ? anuladoDe(op.registro) : null,
    );
    if (!decision.ok) return cuarentena(op.id, decision.motivo, entrada);

    if (op.entidad === 'registro') {
      const guardado = registroGuardado.get(op.entidad_id);
      if (guardado && guardado.org_id !== org)
        return cuarentena(op.id, 'Ese id ya lo usa otro parqueadero', entrada);
      if (guardado) return { tipo: 'duplicado', id: op.id };
      const r = op.registro;
      const sentencia = db
        .prepare(
          `INSERT INTO registro (id, org_id, seq, tipo, v, fecha_local, instante_evento,
             instante_recibido, autor_usuario_id, dispositivo_id, origen, anula_id, estadia_id, serie,
             consecutivo, datos)
           VALUES (?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM registro WHERE org_id = ?), ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO NOTHING`,
        )
        .bind(
          r.id,
          org,
          org,
          r.tipo,
          r.v,
          r.fecha_local,
          r.instante_evento,
          instante,
          r.autor_usuario_id,
          r.dispositivo_id,
          r.origen,
          r.anula_id,
          r.estadia_id,
          r.serie,
          r.consecutivo,
          JSON.stringify(r.datos),
        );
      return { tipo: 'escritura', id: op.id, sentencia, operacion: entrada, siCero: 'duplicado' };
    }

    const cat = { ...op.catalogo, org_id: org };
    const texto = JSON.stringify(cat);
    const guardado = catalogoGuardado.get(op.entidad_id);
    if (guardado && guardado.org_id !== org)
      return cuarentena(op.id, 'Ese id ya lo usa otro parqueadero', entrada);
    if (guardado && guardado.entidad !== op.entidad)
      return cuarentena(op.id, `Ese id ya es un ${guardado.entidad}`, entrada);
    if (!guardado || cat.version > guardado.version) {
      // Un solo upsert, que solo actualiza si la versión es mayor; el trigger catalogo_a_historial
      // guarda la anterior. Si no cambia nada, otra caja escribió en ese instante: `reintentar`.
      const sentencia = db
        .prepare(
          `INSERT INTO catalogo (id, org_id, seq, entidad, version, v, datos, actualizado, dispositivo_id)
           VALUES (?, ?, (SELECT coalesce(max(seq), 0) + 1 FROM catalogo WHERE org_id = ?), ?, ?, 1, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET version = excluded.version, datos = excluded.datos,
             actualizado = excluded.actualizado, dispositivo_id = excluded.dispositivo_id, seq = excluded.seq,
             reemplazo = NULL
           WHERE excluded.version > catalogo.version AND catalogo.org_id = excluded.org_id`,
        )
        .bind(cat.id, org, org, op.entidad, cat.version, texto, cat.actualizado, dispositivo);
      return { tipo: 'escritura', id: op.id, sentencia, operacion: entrada, siCero: 'reintentar' };
    }
    // Lo que la celda ya tiene (la vigente, o esa misma versión en el historial) es un reenvío.
    const propio = sinVersion(texto);
    if (
      sinVersion(guardado.datos) === propio ||
      yaVisto.get(`${op.entidad_id}@v${cat.version}`) === propio
    ) {
      return { tipo: 'duplicado', id: op.id };
    }
    // Versión menor, o la misma con otros datos: dos cajas editaron sin señal. Gana la que llega
    // después, con la versión siguiente; la anterior queda en el historial como «conflicto».
    const sentencia = db
      .prepare(
        `UPDATE catalogo SET
           version = version + 1,
           datos = json_set(?, '$.version', version + 1),
           actualizado = ?,
           dispositivo_id = ?,
           seq = (SELECT coalesce(max(seq), 0) + 1 FROM catalogo WHERE org_id = ?),
           reemplazo = CASE WHEN dispositivo_id = ? THEN NULL
             ELSE json_object('version', version, 'dispositivo', dispositivo_id, 'por_usuario', ?) END
         WHERE id = ? AND org_id = ? AND entidad = ?`,
      )
      .bind(
        texto,
        cat.actualizado,
        dispositivo,
        org,
        dispositivo,
        usuario,
        op.entidad_id,
        org,
        op.entidad,
      );
    return { tipo: 'escritura', id: op.id, sentencia, operacion: entrada, siCero: 'reintentar' };
  };

  const planes: Plan[] = validadas.map(({ entrada, r }, i) =>
    r.ok
      ? planear(r.op, entrada)
      : cuarentena(r.id ?? `sin-id-${instante}-${i}`, r.motivo, entrada),
  );

  const aCuarentena = (id: string, motivo: string, operacion: unknown) =>
    db
      .prepare(
        'INSERT OR IGNORE INTO cuarentena (id, org_id, dispositivo_id, recibido, motivo, operacion) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(id, org, dispositivo, instante, motivo, JSON.stringify(operacion ?? null));
  const sentenciaDe = (p: Plan): SentenciaD1 | null =>
    p.tipo === 'escritura'
      ? p.sentencia
      : p.tipo === 'cuarentena'
        ? aCuarentena(p.id, p.motivo, p.operacion)
        : null;

  /** Por operación: las filas que cambió, o lo que hay que responder sin mirar las filas. */
  const resultado = new Map<number, number | Ack>();
  const escrituras = planes.flatMap((p, indice) => {
    const sentencia = sentenciaDe(p);
    return sentencia ? [{ indice, sentencia }] : [];
  });
  if (escrituras.length > 0) {
    consultas += escrituras.length;
    try {
      const filas = await db.batch(escrituras.map((e) => e.sentencia));
      escrituras.forEach((e, i) => {
        resultado.set(e.indice, filas[i]?.meta.changes ?? 0);
      });
    } catch (error) {
      if (motivoDeLaBase(error) === null) throw error;
      // La base rechazó una operación y el batch no dejó nada: de a una, solo la mala a cuarentena.
      for (const { indice } of escrituras) {
        const p = planes[indice] as Plan;
        if (consultas + 2 > CONSULTAS_POR_INVOCACION) {
          resultado.set(indice, {
            id: p.id,
            estado: 'reintentar',
            motivo: 'Este envío llegó al límite de consultas de la nube; sube en el siguiente.',
          });
          continue;
        }
        consultas++;
        try {
          resultado.set(indice, (await (sentenciaDe(p) as SentenciaD1).run()).meta.changes ?? 0);
        } catch (e) {
          const motivo = motivoDeLaBase(e);
          if (motivo === null || p.tipo !== 'escritura') throw e;
          consultas++;
          await aCuarentena(p.id, motivo, p.operacion).run();
          resultado.set(indice, { id: p.id, estado: 'cuarentena', motivo });
        }
      }
    }
  }

  // Reloj de la caja adelantado (P8): el registro dice haber pasado en el futuro de la celda. Se
  // guarda igual y se avisa; nunca se corrige la hora en silencio.
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
    const r = resultado.get(i);
    if (typeof r === 'object') return r;
    if (p.tipo === 'cuarentena') return { id: p.id, estado: 'cuarentena', motivo: p.motivo };
    const aviso = corridos.has(p.id) ? { aviso: 'reloj-corrido' as const } : {};
    if (p.tipo === 'duplicado') return { id: p.id, estado: 'duplicado', ...aviso };
    return { id: p.id, estado: (r ?? 0) > 0 ? 'aceptado' : p.siCero, ...aviso };
  });
  return c.json({ acks });
}
