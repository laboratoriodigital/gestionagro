/**
 * Subir lo de esta caja y bajar lo de las demás cajas del parqueadero (HU-Q7.5; PARQUEADERO §5.3
 * reglas 3 y 4, §12). El protocolo es el del cuaderno (`@ed1/sync`, ADR-39), con las mismas reglas:
 *
 * - **Lotes de ≤ 25 operaciones**, la sede primero, después los demás catálogos y al final los
 *   registros. Un catálogo editado varias veces viaja una vez, con su versión vigente.
 * - **La cola solo cambia con una respuesta en la mano** (CA4): si la red se corta a mitad, nada
 *   sale de la cola y el lote se reenvía; la celda contesta `duplicado` a lo que ya tenía.
 * - **Cuarentena:** la operación sale de la cola y su motivo queda en `rechazos`; el dato sigue en
 *   la caja (P1). `reintentar` se queda en la cola.
 * - **Bajar:** cada página se aplica con su cursor en una transacción. Los registros son
 *   inmutables: si ya está, se deja. En un catálogo gana la versión mayor, salvo que esta caja
 *   tenga una edición suya pendiente: entonces la de la nube queda en el historial como conflicto.
 *   Lo que baja abre o cierra la estadía en esta caja: un carro que entró por la otra caja sale
 *   por esta.
 * - **429 o 503:** se espera cada vez más, de 30 s a 30 min; `Retry-After` manda si viene.
 */
import type { Catalogo, Registro } from '@ed1/parqueadero-schema';
import { numeroDeRecibo } from '@ed1/parqueadero-schema';
import {
  type Ack,
  type CambioDeCatalogo,
  CURSOR_INICIAL,
  type Cursor,
  type Entidad,
  LOTE_MAXIMO,
  type Operacion,
  PROTOCOLO,
  type RespuestaPull,
} from '@ed1/parqueadero-schema/sync';
import type { BaseDeLaCaja, Estadia, OperacionSalida } from './datos.ts';
import { conTerminos } from './terminos.ts';

export const ESPERA_MINIMA_MS = 30_000;
export const ESPERA_MAXIMA_MS = 30 * 60_000;

/** Espera antes del siguiente intento después de `fallos` respuestas 429/503 seguidas. */
export const esperaTrasFallo = (fallos: number): number =>
  Math.min(ESPERA_MINIMA_MS * 2 ** Math.max(0, fallos), ESPERA_MAXIMA_MS);

/** Adónde y con qué sube esta caja: la celda de su parqueadero y su token. */
export interface Destino {
  readonly api: string;
  readonly acceso: string;
  readonly dispositivo: string;
  readonly app: string;
}

interface Opciones {
  readonly fetchFn?: typeof fetch;
  readonly ahora?: () => number;
}

export type Resultado =
  | { readonly estado: 'al-dia'; readonly enviados: number; readonly rechazados: number }
  | { readonly estado: 'sin-senal'; readonly enviados: number; readonly rechazados: number }
  | {
      readonly estado: 'esperar';
      readonly enviados: number;
      readonly rechazados: number;
      readonly ms: number;
      readonly causa?: string;
    }
  | {
      readonly estado: 'sin-sesion' | 'error';
      readonly enviados: number;
      readonly rechazados: number;
      readonly motivo: string;
    };

const prioridad = (e: Entidad) => (e === 'sede' ? 0 : e === 'registro' ? 2 : 1);

interface Pieza {
  readonly op: Operacion;
  /** Operaciones de la cola que la respuesta a `op` resuelve. */
  readonly cubre: readonly OperacionSalida[];
}

/** El siguiente lote: una operación por entidad, la sede primero y los registros al final. */
export async function siguienteLote(db: BaseDeLaCaja): Promise<Pieza[]> {
  const cola = await db.outbox.orderBy('creado').toArray();
  const grupos = new Map<string, OperacionSalida[]>();
  for (const op of cola) grupos.set(op.entidad_id, [...(grupos.get(op.entidad_id) ?? []), op]);
  const ordenados = [...grupos.values()].sort(
    (a, b) => prioridad(a[0]?.entidad ?? 'registro') - prioridad(b[0]?.entidad ?? 'registro'),
  );
  const lote: Pieza[] = [];
  for (const grupo of ordenados) {
    if (lote.length >= LOTE_MAXIMO) break;
    const primera = grupo[0];
    if (!primera) continue;
    const datos =
      primera.entidad === 'registro'
        ? await db.registros.get(primera.entidad_id)
        : await db.catalogos.get(primera.entidad_id);
    if (!datos) continue; // nadie borra (P21); si pasara, la operación se queda y se ve
    const version = 'version' in datos ? datos.version : 1;
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

/** Aplica las respuestas de un lote en una transacción. */
async function aplicarAcks(db: BaseDeLaCaja, lote: readonly Pieza[], acks: Ack[], ahora: number) {
  const porId = new Map(lote.map((p) => [p.op.id, p]));
  let enviados = 0;
  let rechazados = 0;
  await db.transaction('rw', db.outbox, db.rechazos, async () => {
    for (const ack of acks) {
      const pieza = porId.get(ack.id);
      if (!pieza || ack.estado === 'reintentar') continue;
      if (ack.estado === 'cuarentena') {
        await db.rechazos.put({
          id: ack.id,
          entidad: pieza.op.entidad,
          entidad_id: pieza.op.entidad_id,
          motivo: ack.motivo ?? 'La nube no lo aceptó y no dijo por qué.',
          recibido: ahora,
        });
        rechazados++;
      } else {
        enviados++;
      }
      await db.outbox.bulkDelete(pieza.cubre.map((o) => o.id));
    }
  });
  return { enviados, rechazados };
}

type Cuerpo = { acks?: Ack[]; motivo?: string; estado?: string } & Partial<RespuestaPull>;

/** Lee la respuesta; `null` si una respuesta buena llegó cortada: es como no tenerla. */
async function leer(r: Response): Promise<Cuerpo | null> {
  try {
    return (await r.json()) as Cuerpo;
  } catch {
    // Un error que no es JSON es un error de la nube, no falta de señal (bitácora agro 23, P15).
    return r.ok ? null : {};
  }
}

/** Lo que dicen los estados de error de la celda, igual para subir y para bajar. */
function falla(
  r: Response,
  cuerpo: Cuerpo,
  fallosPrevios: number,
  cuenta: { enviados: number; rechazados: number },
): Resultado | null {
  if (r.status === 401) {
    return { estado: 'sin-sesion', ...cuenta, motivo: cuerpo.motivo ?? 'La sesión venció' };
  }
  if (r.status === 429 || r.status === 503) {
    const pedido = Number(r.headers.get('retry-after'));
    const ms =
      Number.isFinite(pedido) && pedido > 0 ? pedido * 1000 : esperaTrasFallo(fallosPrevios);
    return { estado: 'esperar', ...cuenta, ms, ...(cuerpo.estado ? { causa: cuerpo.estado } : {}) };
  }
  if (!r.ok) {
    return { estado: 'error', ...cuenta, motivo: cuerpo.motivo ?? `La nube respondió ${r.status}` };
  }
  return null;
}

/** Sube la cola de a lotes hasta vaciarla, o hasta que la red o la celda digan que no. */
export async function enviarPendientes(
  db: BaseDeLaCaja,
  destino: Destino,
  o: Opciones & { readonly fallosPrevios?: number } = {},
): Promise<Resultado> {
  const { fetchFn = fetch, ahora = () => Date.now(), fallosPrevios = 0 } = o;
  const cuenta = { enviados: 0, rechazados: 0 };
  for (;;) {
    const lote = await siguienteLote(db);
    if (lote.length === 0) return { estado: 'al-dia', ...cuenta };
    let r: Response;
    try {
      r = await fetchFn(conTerminos(`${destino.api}/api/v1/sync/push`), {
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
      return { estado: 'sin-senal', ...cuenta };
    }
    const cuerpo = await leer(r);
    if (!cuerpo) return { estado: 'sin-senal', ...cuenta };
    const mal = falla(r, cuerpo, fallosPrevios, cuenta);
    if (mal) return mal;
    if (!Array.isArray(cuerpo.acks)) {
      return { estado: 'error', ...cuenta, motivo: 'La nube respondió sin acuses' };
    }
    const hecho = await aplicarAcks(db, lote, cuerpo.acks, ahora());
    cuenta.enviados += hecho.enviados;
    cuenta.rechazados += hecho.rechazados;
    // Un lote sin avance (todo «reintentar») no se repite en seguida: espera el turno siguiente.
    if (hecho.enviados + hecho.rechazados === 0) {
      return { estado: 'esperar', ...cuenta, ms: ESPERA_MINIMA_MS };
    }
  }
}

// ── Bajar ──────────────────────────────────────────────────────────────────────────────────────

export async function leerCursor(db: BaseDeLaCaja): Promise<Cursor> {
  const c = await db.meta.get('cursor');
  return c?.clave === 'cursor' ? { registro: c.registro, catalogo: c.catalogo } : CURSOR_INICIAL;
}

/**
 * Deja `estadias` como dicen los registros de esas estadías: abierta mientras la entrada no tenga
 * una salida vigente ni esté anulada (la misma regla de `reconstruirEstadias`, para unas pocas).
 */
async function rehacerEstadias(db: BaseDeLaCaja, ids: ReadonlySet<string>): Promise<void> {
  for (const id of ids) {
    const suyos = await db.registros.where('estadia_id').equals(id).toArray();
    const anulados = new Set(suyos.filter((r) => r.tipo === 'anulacion').map((r) => r.anula_id));
    const entrada = suyos.find((r) => r.id === id && r.tipo === 'entrada' && !anulados.has(r.id));
    const salio = suyos.some((r) => r.tipo === 'salida' && !anulados.has(r.id));
    if (!entrada || salio || entrada.serie === null || entrada.consecutivo === null) {
      await db.estadias.delete(id);
      continue;
    }
    const d = entrada.datos as { placa: string; vehiculo: Estadia['vehiculo'] };
    await db.estadias.put({
      id,
      placa: d.placa,
      vehiculo: d.vehiculo,
      numero: numeroDeRecibo(entrada.serie, entrada.consecutivo),
      entrada: Date.parse(entrada.instante_evento),
    });
  }
}

/** El catálogo que baja: gana la versión mayor, salvo una edición de esta caja pendiente. */
async function aplicarCatalogo(
  db: BaseDeLaCaja,
  { entidad, datos }: CambioDeCatalogo,
  pendiente: boolean,
  instante: string,
): Promise<'recibido' | 'conflicto' | 'nada'> {
  const local = await db.catalogos.get(datos.id);
  if (local && local.version > datos.version) return 'nada'; // la de aquí es más nueva y sube
  if (local && local.version === datos.version && !pendiente) return 'nada';
  if (local && pendiente) {
    const iguales =
      local.version === datos.version &&
      JSON.stringify({ ...local, org_id: null }) === JSON.stringify({ ...datos, org_id: null });
    if (iguales) return 'nada';
    const { id, version, ...resto } = datos;
    await db.historial.put({
      id: `${id}@v${version}#nube`,
      entidad,
      entidad_id: id,
      version,
      datos: resto,
      reemplazada: instante,
      motivo: 'conflicto',
    });
    return 'conflicto';
  }
  if (local) {
    const { id, version, ...resto } = local;
    await db.historial.put({
      id: `${id}@v${version}`,
      entidad,
      entidad_id: id,
      version,
      datos: resto,
      reemplazada: instante,
      motivo: 'edicion',
    });
  }
  await db.catalogos.put(datos as unknown as Catalogo);
  return 'recibido';
}

/** Aplica una página con su cursor, en una transacción. Lo que baja no entra a la cola. */
export async function aplicarPagina(
  db: BaseDeLaCaja,
  pagina: RespuestaPull,
  instante: string,
): Promise<{ recibidos: number; conflictos: number }> {
  let recibidos = 0;
  let conflictos = 0;
  const tablas = [db.registros, db.catalogos, db.historial, db.estadias, db.outbox, db.meta];
  await db.transaction('rw', tablas, async () => {
    const pendientes = new Set((await db.outbox.toArray()).map((o) => o.entidad_id));
    for (const cambio of pagina.catalogos) {
      const r = await aplicarCatalogo(db, cambio, pendientes.has(cambio.datos.id), instante);
      if (r === 'recibido') recibidos++;
      if (r === 'conflicto') conflictos++;
    }
    const ya = await db.registros.bulkGet(pagina.registros.map((r) => r.id));
    const nuevos: Registro[] = pagina.registros.filter((_, i) => !ya[i]);
    await db.registros.bulkAdd(nuevos);
    recibidos += nuevos.length;
    await rehacerEstadias(
      db,
      new Set(nuevos.map((r) => r.estadia_id).filter((x): x is string => x !== null)),
    );
    await db.meta.put({ clave: 'cursor', ...pagina.cursor });
  });
  return { recibidos, conflictos };
}

export type ResultadoDeRecepcion =
  | { readonly estado: 'al-dia'; readonly recibidos: number; readonly conflictos: number }
  | Exclude<Resultado, { estado: 'al-dia' }>;

/** Baja páginas hasta que la celda diga que no hay más. */
export async function recibirCambios(
  db: BaseDeLaCaja,
  destino: Pick<Destino, 'api' | 'acceso'> & { readonly dispositivo?: string },
  o: Opciones & { readonly fallosPrevios?: number; readonly maxPaginas?: number } = {},
): Promise<ResultadoDeRecepcion> {
  const { fetchFn = fetch, ahora = () => Date.now(), fallosPrevios = 0, maxPaginas = 500 } = o;
  let recibidos = 0;
  let conflictos = 0;
  const cuenta = () => ({ enviados: 0, rechazados: 0 });
  for (let n = 0; n < maxPaginas; n++) {
    const c = await leerCursor(db);
    let r: Response;
    try {
      r = await fetchFn(
        conTerminos(
          `${destino.api}/api/v1/sync/pull?registro=${c.registro}&catalogo=${c.catalogo}${destino.dispositivo ? `&dispositivo=${encodeURIComponent(destino.dispositivo)}` : ''}`,
        ),
        { headers: { authorization: `Bearer ${destino.acceso}` } },
      );
    } catch {
      return { estado: 'sin-senal', ...cuenta() };
    }
    const cuerpo = await leer(r);
    if (!cuerpo) return { estado: 'sin-senal', ...cuenta() };
    const mal = falla(r, cuerpo, fallosPrevios, cuenta());
    if (mal && mal.estado !== 'al-dia') return mal;
    if (!Array.isArray(cuerpo.registros) || !Array.isArray(cuerpo.catalogos) || !cuerpo.cursor) {
      return { estado: 'error', ...cuenta(), motivo: 'La nube respondió algo que no se entiende' };
    }
    const hecho = await aplicarPagina(db, cuerpo as RespuestaPull, new Date(ahora()).toISOString());
    recibidos += hecho.recibidos;
    conflictos += hecho.conflictos;
    if (!cuerpo.mas) break;
  }
  return { estado: 'al-dia', recibidos, conflictos };
}
