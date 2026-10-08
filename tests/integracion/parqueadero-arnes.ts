/**
 * Arnés de cajas simuladas contra la celda del parqueadero en memoria (HU-Q7.5), como el de los
 * teléfonos del agro (`arnes.ts`).
 *
 * - La celda es el Worker real de `apps/parqueadero-api` con el D1 local del shard de c2.
 * - Cada caja es la caja real (`almacen.ts`, `sincronizar.ts`) sobre su propia base de
 *   fake-indexeddb, con su dispositivo y su serie.
 * - `fetch` llama al Worker en memoria; puede no tener señal o perder la respuesta de un pedido
 *   que la celda sí atendió.
 * - La entrada con la cuenta (HU-Q7.6) y el alta de la caja con su serie (HU-Q7.7) todavía no
 *   existen: el arnés escribe `nube` en la caja y la fila de `dispositivo` en la celda.
 *
 * Lo que no imita (P17): la red de verdad, los límites de D1 en Cloudflare y el CORE.
 */
import 'fake-indexeddb/auto';
import { uuidv7 } from '@ed1/ids';
import { SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO } from '@ed1/parqueadero-schema/ensayos';
import {
  alta,
  app,
  type Entorno,
  env,
  ORG_UNO,
  T0,
  token,
} from '../../apps/parqueadero-api/src/prueba.fixture.ts';
import {
  abrirTurno,
  type Contexto,
  guardarSede,
  guardarTarifa,
} from '../../apps/parqueadero-sitio/src/caja/almacen.ts';
import { abrirBase, type BaseDeLaCaja } from '../../apps/parqueadero-sitio/src/caja/datos.ts';
import {
  enviarPendientes,
  recibirCambios,
} from '../../apps/parqueadero-sitio/src/caja/sincronizar.ts';

export const API = 'https://parqueadero-api-c2.ejemplo.test';

export interface Red {
  /** Ningún pedido sale de la caja. */
  readonly sinSenal?: boolean;
  /** La celda atiende el pedido número N (desde 1), pero su respuesta no llega. */
  readonly perderRespuesta?: number;
  /** KV de flags de la celda: `ks:parqueadero`. */
  readonly flags?: Record<string, string>;
}

/** El `fetch` de una caja contra el Worker en memoria. Cuenta los pedidos que llegan a la celda. */
export function red(e: Entorno, o: Red = {}) {
  const pedidos: string[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    if (o.sinSenal) throw new TypeError('Failed to fetch');
    pedidos.push(new URL(url).pathname);
    const r = await app.fetch(
      new Request(url, init),
      env(e, o.flags ? { FLAGS: { get: async (k: string) => o.flags?.[k] ?? null } } : {}),
    );
    if (pedidos.length === o.perderRespuesta) throw new TypeError('Failed to fetch');
    return r;
  }) as unknown as typeof fetch;
  return { fn, pedidos };
}

export interface Caja {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly dispositivo: string;
  readonly serie: string;
  readonly destino: { api: string; acceso: string; dispositivo: string; app: string };
  /** Mueve el reloj de esta caja. */
  readonly avanzar: (minutos: number) => void;
  /** Sube lo pendiente y baja lo de las otras cajas, como `nube.ts`. Lanza si no terminó. */
  readonly sincronizar: (fetchFn: typeof fetch) => Promise<void>;
}

const sinMeta = <T extends object>(c: T) => {
  const {
    id: _i,
    org_id: _o,
    version: _v,
    actualizado: _a,
    entidad: _e,
    ...resto
  } = c as T & Record<'id' | 'org_id' | 'version' | 'actualizado' | 'entidad', unknown>;
  return resto;
};

/**
 * Una caja vinculada a la celda de Ensayo Uno, con su serie dada de alta en la celda (salvo
 * `alta: false`, la caja que HU-Q7.7 todavía no registra). Su reloj arranca en T0, el de la celda:
 * el aviso de reloj corrido no es de estas pruebas.
 */
export async function caja(
  e: Entorno,
  serie: string,
  { org = ORG_UNO, conAlta = true }: { org?: string; conAlta?: boolean } = {},
): Promise<Caja> {
  let ms = T0;
  const ctx: Contexto = { reloj: () => (ms += 1_000), nuevoId: () => uuidv7(() => ms) };
  const db = abrirBase(`caja-${serie}-${uuidv7()}`);
  const dispositivo = `caja-${serie.toLowerCase()}-${uuidv7()}`;
  await db.meta.put({ clave: 'dispositivo', id: dispositivo, serie });
  await db.meta.put({ clave: 'nube', api: API, acceso: await token(e, { org }) });
  if (conAlta) await alta(e.db, org, dispositivo, serie);
  const destino = { api: API, acceso: await token(e, { org }), dispositivo, app: '0.3.0' };
  return {
    db,
    ctx,
    dispositivo,
    serie,
    destino,
    avanzar: (minutos) => {
      ms += minutos * 60_000;
    },
    sincronizar: async (fetchFn) => {
      const subida = await enviarPendientes(db, destino, { fetchFn, ahora: () => ms });
      if (subida.estado !== 'al-dia') throw new Error(`la subida no terminó: ${subida.estado}`);
      const bajada = await recibirCambios(db, destino, { fetchFn, ahora: () => ms });
      if (bajada.estado !== 'al-dia') throw new Error(`la bajada no terminó: ${bajada.estado}`);
    },
  };
}

/** Los ajustes de Ensayo Uno (sede, carro y moto) y el turno abierto. */
export async function configurar(c: Caja): Promise<void> {
  await guardarSede(c.db, sinMeta(SEDE_ENSAYO_UNO), null, c.ctx);
  await guardarTarifa(c.db, sinMeta(TARIFA_CARRO), null, c.ctx);
  await guardarTarifa(c.db, sinMeta(TARIFA_MOTO), null, c.ctx);
}

export const turno = (c: Caja, operador = `Caja ${c.serie}`) =>
  abrirTurno(c.db, { operador, base: 100_000 }, c.ctx);

/** Cuántas filas tiene una tabla del shard. */
export const contar = async (e: Entorno, tabla: string, donde = '1 = 1') =>
  (await e.db.prepare(`SELECT count(*) AS n FROM ${tabla} WHERE ${donde}`).first<{ n: number }>())
    ?.n ?? 0;
