/**
 * Arnés de teléfonos simulados contra una celda en memoria (HU-E5.2, HU-E5.3; base de HU-E5.6).
 *
 * - La celda es el Worker real de `apps/api-celda` con el D1 local de wrangler.
 * - Cada teléfono es un cuaderno real sobre su propio fake-indexeddb.
 * - `fetch` llama al Worker en memoria; se puede cortar la respuesta después de N pedidos.
 * - La sesión y el vínculo se escriben directo en el teléfono: el CORE tiene sus propias pruebas.
 *
 * Lo que no imita (P17): la red de verdad, los límites de D1 en Cloudflare y el CORE.
 */
import { uuidv7 } from '@ed1/agro-schema';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal, vaciar } from '@ed1/d1/local';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { crearApp, TABLAS_DEL_SHARD } from '../../apps/api-celda/src/worker.ts';
import { guardarClima } from '../../apps/cuaderno/src/almacen/clima.ts';
import { abrirCuaderno, type CuadernoDb } from '../../apps/cuaderno/src/almacen/db.ts';
import { CLAVE_DISPOSITIVO } from '../../apps/cuaderno/src/almacen/dispositivo.ts';
import { enviarPendientes } from '../../apps/cuaderno/src/almacen/envio.ts';
import { crearFincaConAreas } from '../../apps/cuaderno/src/almacen/finca.ts';
import { recibirCambios } from '../../apps/cuaderno/src/almacen/recepcion.ts';
import { CLAVE_VINCULO } from '../../apps/cuaderno/src/almacen/vinculo.ts';
import type { FincaDePrueba } from '../fixtures/fincas.ts';

export const SHARD = 'agro_c0_s1';
export const API = 'https://agro-api-c0.ejemplo.test';
export const T0 = Date.UTC(2026, 9, 1, 12);

export interface OpcionesDeRed {
  /** La celda responde, pero la respuesta no llega después de N pedidos (corte a la mitad). */
  cortarDespuesDe?: number;
  /** Sin señal: ningún pedido sale del teléfono. */
  sinSenal?: boolean;
  /** Cada pedido llega dos veces a la celda (un reintento de la red); el teléfono ve el último. */
  duplicar?: boolean;
  /** KV de flags de la celda: nivel y kill switches. */
  flags?: Record<string, string>;
  /** Otra base para el shard (p. ej. una que falla). */
  base?: BaseD1;
}

export interface Celda {
  db: BaseD1;
  cerrar: () => Promise<void>;
  vaciar: () => Promise<void>;
  /** `fetch` del teléfono contra el Worker en memoria; cuenta los lotes y puede romperse. */
  red: (opciones?: OpcionesDeRed) => {
    fn: typeof fetch;
    lotes: number[];
  };
  /** Token de la organización; `emitido` permite uno ya vencido (12 h después). */
  acceso: (org: string, emitido?: number, rol?: string) => Promise<string>;
  /** Reloj de la celda (ms Unix). Arranca en T0. */
  reloj: { ahora: number };
  contar: (tabla: string) => Promise<number>;
}

export async function montarCelda(): Promise<Celda> {
  const { db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  });
  const firmante: Firmante = await firmanteDesde(await generarClavePrivada());
  const reloj = { ahora: T0 };
  const api = crearApp({ ahora: () => reloj.ahora });
  return {
    db,
    cerrar,
    vaciar: () => vaciar(db, [...TABLAS_DEL_SHARD]),
    reloj,
    red: ({ cortarDespuesDe, sinSenal, duplicar, flags, base = db } = {}) => {
      const lotes: number[] = [];
      const env = {
        CELDA: 'c0',
        PRODUCTO: 'agro',
        CORE_CLAVES: JSON.stringify([firmante.publica]),
        ORIGENES_APP: 'https://agro.ejemplo.test',
        [SHARD]: base,
        ...(flags ? { FLAGS: { get: async (k: string) => flags[k] ?? null } } : {}),
      };
      const fn = (async (url: string, init?: RequestInit) => {
        if (sinSenal) throw new TypeError('Failed to fetch');
        if (duplicar) await api.fetch(new Request(url, init), env);
        const r = await api.fetch(new Request(url, init), env);
        lotes.push(JSON.parse(String(init?.body ?? '{}')).ops?.length ?? 0);
        if (cortarDespuesDe !== undefined && lotes.length > cortarDespuesDe) {
          throw new TypeError('Failed to fetch'); // la celda respondió, pero la respuesta no llegó
        }
        return r;
      }) as unknown as typeof fetch;
      return { fn, lotes };
    },
    acceso: async (org, emitido = T0, rol = 'propietario') =>
      (
        await firmarAcceso(
          firmante,
          { sub: 'u1', org, rol, celda: 'c0', shard: SHARD, anillo: 1 },
          emitido,
        )
      ).token,
    contar: async (tabla) =>
      (await db.prepare(`SELECT count(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n ?? 0,
  };
}

export interface Telefono {
  db: CuadernoDb;
  org: string;
  destino: { api: string; acceso: string; dispositivo: string; app: string; rol: string };
  /** Sube lo pendiente y baja lo del equipo, como la app (sincronizacion.ts). */
  sincronizar: (fetchFn: typeof fetch) => Promise<void>;
}

async function telefono(
  celda: Celda,
  db: CuadernoDb,
  org: string,
  fincaId: string | null,
  dispositivo: string,
  rol = 'propietario',
): Promise<Telefono> {
  // La celda conoce al teléfono por el `dispositivo` de sus envíos; la app lo saca de
  // `idDispositivo`. Aquí son el mismo, como en la app (HU-E5.4).
  await db.meta.put({ clave: CLAVE_DISPOSITIVO, valor: dispositivo, actualizado: '' });
  await db.meta.put({
    clave: CLAVE_VINCULO,
    valor: { org_id: org, finca_id: fincaId, vinculado: '2026-10-01T12:00:00.000Z' },
    actualizado: '',
  });
  const destino = {
    api: API,
    acceso: await celda.acceso(org, T0, rol),
    dispositivo,
    app: '0.1.0',
    rol,
  };
  return {
    db,
    org,
    destino,
    sincronizar: async (fetchFn) => {
      const subida = await enviarPendientes(db, destino, { fetchFn, ahora: () => T0 });
      if (subida.estado !== 'al-dia') throw new Error(`la subida no terminó: ${subida.estado}`);
      const bajada = await recibirCambios(db, destino, { fetchFn, ahora: () => T0 });
      if (bajada.estado !== 'al-dia') throw new Error(`la bajada no terminó: ${bajada.estado}`);
    },
  };
}

const nuevaBase = () => abrirCuaderno({ indexedDB: new IDBFactory(), IDBKeyRange });

/** Teléfono con una finca de prueba, dos áreas y `registros` climas, vinculado a `org`. */
export async function telefonoConFinca(
  celda: Celda,
  f: FincaDePrueba,
  registros: number,
  org = uuidv7(),
) {
  const db = nuevaBase();
  const { finca, areas } = await crearFincaConAreas(
    db,
    { nombre: f.finca.nombre, municipio: f.finca.municipio, regimen: f.finca.regimen },
    f.areas.slice(0, 2).map((a) => ({
      tipo: a.tipo,
      nombre: a.nombre,
      area_m2: a.area_m2,
      capacidad_plantas: null,
    })),
  );
  const area = areas[0];
  if (!area) throw new Error('sin áreas');
  for (let i = 0; i < registros; i++) {
    await guardarClima(db, finca.id, area.id, {
      temperaturaC: 20 + (i % 10),
      humedadRelativaPct: 70,
      temperaturaHojaC: null,
    });
  }
  return { ...(await telefono(celda, db, org, finca.id, 'telefono-1')), finca, areas };
}

/**
 * Teléfono nuevo sin finca, vinculado a la organización: de la misma cuenta (HU-E5.3, CA4) o de
 * alguien del equipo con su rol (HU-E4.5).
 */
export function telefonoNuevo(
  celda: Celda,
  org: string,
  dispositivo = 'telefono-2',
  rol = 'propietario',
): Promise<Telefono> {
  return telefono(celda, nuevaBase(), org, null, dispositivo, rol);
}

/** Anota `n` climas en la primera área del teléfono con SU reloj (puede estar corrido); devuelve los ids. */
export async function anotar(db: CuadernoDb, n: number, reloj = T0): Promise<string[]> {
  const finca = await db.finca.toCollection().first();
  const area = (await db.area.toArray())[0];
  if (!finca || !area) throw new Error('el teléfono no tiene finca');
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await guardarClima(
      db,
      finca.id,
      area.id,
      { temperaturaC: 20 + (i % 10), humedadRelativaPct: 70, temperaturaHojaC: null },
      { ahora: () => new Date(reloj + i * 1000) },
    );
    ids.push(r.id);
  }
  return ids;
}

/**
 * La regla de la batería de caos (HU-E5.6, CA2): al final, cada registro creado en cualquier
 * teléfono existe exactamente una vez en la celda y en todos los teléfonos, y no queda nada
 * pendiente. Devuelve lo que falta, sobra o se repite; todo en cero es el éxito.
 */
export async function invariante(
  celda: Celda,
  telefonos: readonly CuadernoDb[],
  creados: readonly string[],
) {
  const esperados = new Set(creados);
  const enCelda = (
    await celda.db.prepare('SELECT id FROM registro').all<{ id: string }>()
  ).results.map((r) => r.id);
  const conjunto = new Set(enCelda);
  return {
    celda: {
      faltan: [...esperados].filter((id) => !conjunto.has(id)).length,
      sobran: enCelda.filter((id) => !esperados.has(id)).length,
      repetidos: enCelda.length - conjunto.size,
    },
    telefonos: await Promise.all(
      telefonos.map(async (db) => {
        const ids = new Set((await db.registro.toCollection().primaryKeys()) as string[]);
        return {
          faltan: [...esperados].filter((id) => !ids.has(id)).length,
          sobran: [...ids].filter((id) => !esperados.has(id)).length,
          pendientes: await db.outbox.filter((o) => o.entidad === 'registro').count(),
        };
      }),
    ),
  };
}

/** Lo que `invariante` devuelve cuando todo está bien. */
export const sinDiferencias = (telefonos: number) => ({
  celda: { faltan: 0, sobran: 0, repetidos: 0 },
  telefonos: Array.from({ length: telefonos }, () => ({ faltan: 0, sobran: 0, pendientes: 0 })),
});
