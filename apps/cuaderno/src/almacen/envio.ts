/**
 * Subir lo que está solo en este teléfono (HU-E5.2, ARQUITECTURA §5.6).
 *
 * - **Lotes de ≤ 25 operaciones** (CA1). Orden: la finca primero, después los catálogos y al final
 *   los registros: la celda no acepta un registro de una finca que todavía no conoce.
 * - **Un catálogo editado varias veces viaja una vez**, con su versión vigente; su respuesta
 *   cubre todas las operaciones de versiones anteriores en la cola.
 * - **La cola solo cambia con una respuesta en la mano** (CA4): si la señal se corta a mitad, nada
 *   sale de la cola y el lote se reenvía; la celda contesta `duplicado` a lo que ya tenía (CA2).
 * - **Cuarentena:** la operación sale de la cola y su motivo queda en `rechazo`; el dato sigue en
 *   su tabla (CA3, P1). `reintentar`: se queda en la cola.
 * - **429 o 503:** se espera cada vez más, de 30 s a 30 min (CA5); `Retry-After` manda si viene.
 */
import { type Ack, type Entidad, LOTE_MAXIMO, type Operacion, PROTOCOLO } from '@gestionagro/sync';
import type { CuadernoDb, OperacionSalida } from './db.ts';

export const ESPERA_MINIMA_MS = 30_000;
/** Cuándo vio la celda por última vez el reloj de este teléfono adelantado (ARQUITECTURA §5.7). */
export const CLAVE_RELOJ_CORRIDO = 'reloj_corrido';
export const ESPERA_MAXIMA_MS = 30 * 60_000;

/** Espera antes del siguiente intento después de `fallos` respuestas 429/503 seguidas. */
export const esperaTrasFallo = (fallos: number): number =>
  Math.min(ESPERA_MINIMA_MS * 2 ** Math.max(0, fallos), ESPERA_MAXIMA_MS);

export type ResultadoDeEnvio =
  | {
      estado: 'al-dia';
      enviados: number;
      rechazados: number;
      /** La celda pidió actualizar la app (HU-E5.5): lo subido se aceptó igual. */
      actualizar?: string;
      /** La celda vio el reloj de este teléfono adelantado (P8). */
      relojCorrido?: boolean;
    }
  | { estado: 'sin-senal'; enviados: number; rechazados: number }
  | {
      estado: 'esperar';
      enviados: number;
      rechazados: number;
      ms: number;
      /** Causa que dio la celda (`apagado`, `bloqueo`, `mudanza`…), para decirla en palabras (HU-E8.6). */
      causa?: string;
      /** Hora de reanudación que dio la celda, ISO. */
      reanuda?: string;
    }
  | {
      estado: 'sin-sesion' | 'sin-organizacion' | 'error';
      enviados: number;
      rechazados: number;
      motivo: string;
      causa?: string;
    };

export interface Destino {
  /** URL de la API de la celda de la organización (`url_api` de la sesión). */
  api: string;
  acceso: string;
  dispositivo: string;
  app: string;
}

const prioridad = (e: Entidad) => (e === 'finca' ? 0 : e === 'registro' ? 2 : 1);

interface Pieza {
  op: Operacion;
  /** Operaciones de la cola que la respuesta a `op` resuelve. */
  cubre: OperacionSalida[];
}

/** El siguiente lote: una operación por entidad, en orden de finca, catálogos y registros. */
export async function siguienteLote(db: CuadernoDb): Promise<Pieza[]> {
  const cola = await db.outbox.orderBy('creado').toArray();
  const grupos = new Map<string, OperacionSalida[]>();
  for (const op of cola) {
    const clave = `${op.entidad}:${op.entidad_id}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), op]);
  }
  const ordenados = [...grupos.values()].sort(
    (a, b) => prioridad(a[0]?.entidad ?? 'registro') - prioridad(b[0]?.entidad ?? 'registro'),
  );
  const lote: Pieza[] = [];
  for (const grupo of ordenados) {
    if (lote.length >= LOTE_MAXIMO) break;
    const primera = grupo[0];
    if (!primera) continue;
    const tabla = db.table(primera.entidad);
    const datos = (await tabla.get(primera.entidad_id)) as { version?: number } | undefined;
    if (!datos) continue; // nunca pasa: nadie borra (ADR-4); si pasara, la op se queda y se ve
    const version = primera.entidad === 'registro' ? 1 : (datos.version ?? primera.version);
    lote.push({
      op: {
        id: primera.entidad === 'registro' ? primera.id : `${primera.entidad_id}@v${version}`,
        entidad: primera.entidad,
        entidad_id: primera.entidad_id,
        version,
        datos,
      },
      cubre: grupo.filter((o) => o.version <= version),
    });
  }
  return lote;
}

/** Aplica las respuestas de un lote en una sola transacción. Devuelve cuántas salieron de la cola. */
async function aplicarAcks(db: CuadernoDb, lote: Pieza[], acks: Ack[], instante: string) {
  const porId = new Map(lote.map((p) => [p.op.id, p]));
  let enviados = 0;
  let rechazados = 0;
  let relojCorrido = false;
  await db.transaction('rw', db.outbox, db.rechazo, db.meta, async () => {
    for (const ack of acks) {
      const pieza = porId.get(ack.id);
      if (pieza && ack.aviso === 'reloj-corrido') relojCorrido = true;
      if (!pieza || ack.estado === 'reintentar') continue;
      if (ack.estado === 'cuarentena') {
        await db.rechazo.put({
          id: ack.id,
          entidad: pieza.op.entidad,
          entidad_id: pieza.op.entidad_id,
          version: pieza.op.version,
          motivo: ack.motivo ?? 'La celda no aceptó el dato y no dijo por qué.',
          recibido: instante,
        });
        rechazados++;
      } else {
        enviados++;
      }
      await db.outbox.bulkDelete(pieza.cubre.map((o) => o.id));
    }
    // Se recuerda para avisar aunque la persona no esté mirando cuando sincroniza (P8, P15).
    if (relojCorrido)
      await db.meta.put({ clave: CLAVE_RELOJ_CORRIDO, valor: instante, actualizado: instante });
  });
  return { enviados, rechazados, relojCorrido };
}

export async function enviarPendientes(
  db: CuadernoDb,
  destino: Destino,
  opciones: { fetchFn?: typeof fetch; ahora?: () => number; fallosPrevios?: number } = {},
): Promise<ResultadoDeEnvio> {
  const { fetchFn = fetch, ahora = () => Date.now(), fallosPrevios = 0 } = opciones;
  let enviados = 0;
  let rechazados = 0;
  let actualizar: string | undefined;
  let relojCorrido = false;
  for (;;) {
    const lote = await siguienteLote(db);
    if (lote.length === 0) {
      return {
        estado: 'al-dia',
        enviados,
        rechazados,
        ...(actualizar ? { actualizar } : {}),
        ...(relojCorrido ? { relojCorrido } : {}),
      };
    }
    let r: Response;
    let cuerpo: {
      acks?: Ack[];
      motivo?: string;
      estado?: string;
      reanuda?: string;
      actualizar?: { motivo?: string };
    };
    try {
      r = await fetchFn(`${destino.api}/api/v1/sync/push`, {
        method: 'POST',
        headers: { authorization: `Bearer ${destino.acceso}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          protocolo: PROTOCOLO,
          dispositivo: destino.dispositivo,
          app: destino.app,
          ops: lote.map((p) => p.op),
        }),
      });
    } catch {
      // Sin respuesta no se sabe qué guardó la celda: la cola queda igual (CA4).
      return { estado: 'sin-senal', enviados, rechazados };
    }
    try {
      cuerpo = (await r.json()) as typeof cuerpo;
    } catch {
      // Una respuesta buena cortada a mitad es como no tenerla. Un error que no es JSON es un
      // error de la nube, no falta de señal: se dice como es (bitácora agro 23, P15).
      if (r.ok) return { estado: 'sin-senal', enviados, rechazados };
      cuerpo = {};
    }
    if (r.status === 401)
      return { estado: 'sin-sesion', enviados, rechazados, motivo: cuerpo.motivo ?? 'Sin sesión' };
    if (r.status === 403) {
      return {
        estado: 'sin-organizacion',
        enviados,
        rechazados,
        motivo: cuerpo.motivo ?? 'Sin finca en la nube',
      };
    }
    if (r.status === 429 || r.status === 503) {
      const pedido = Number(r.headers.get('retry-after'));
      const ms =
        Number.isFinite(pedido) && pedido > 0 ? pedido * 1000 : esperaTrasFallo(fallosPrevios);
      return {
        estado: 'esperar',
        enviados,
        rechazados,
        ms,
        ...(cuerpo.estado ? { causa: cuerpo.estado } : {}),
        ...(cuerpo.reanuda ? { reanuda: cuerpo.reanuda } : {}),
      };
    }
    if (!r.ok || !Array.isArray(cuerpo.acks)) {
      return {
        estado: 'error',
        enviados,
        rechazados,
        motivo: cuerpo.motivo ?? `La celda respondió ${r.status}`,
        ...(cuerpo.estado ? { causa: cuerpo.estado } : {}),
      };
    }
    actualizar = cuerpo.actualizar?.motivo ?? actualizar;
    const hecho = await aplicarAcks(db, lote, cuerpo.acks, new Date(ahora()).toISOString());
    enviados += hecho.enviados;
    rechazados += hecho.rechazados;
    relojCorrido ||= hecho.relojCorrido;
    // Un lote sin avance (todo «reintentar») no se repite en seguida: espera el turno siguiente.
    if (hecho.enviados + hecho.rechazados === 0) {
      return { estado: 'esperar', enviados, rechazados, ms: ESPERA_MINIMA_MS };
    }
  }
}
