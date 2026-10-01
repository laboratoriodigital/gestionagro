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
import { uuidv7 } from '@gestionagro/agro-schema';
import type { BaseD1 } from '@gestionagro/d1';
import { baseLocal, vaciar } from '@gestionagro/d1/local';
import {
  type Firmante,
  firmanteDesde,
  firmarAcceso,
  generarClavePrivada,
} from '@gestionagro/tokens';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { crearApp, TABLAS_DEL_SHARD } from '../../apps/api-celda/src/worker.ts';
import { guardarClima } from '../../apps/cuaderno/src/almacen/clima.ts';
import { abrirCuaderno, type CuadernoDb } from '../../apps/cuaderno/src/almacen/db.ts';
import { enviarPendientes } from '../../apps/cuaderno/src/almacen/envio.ts';
import { crearFincaConAreas } from '../../apps/cuaderno/src/almacen/finca.ts';
import { recibirCambios } from '../../apps/cuaderno/src/almacen/recepcion.ts';
import { CLAVE_VINCULO } from '../../apps/cuaderno/src/almacen/vinculo.ts';
import type { FincaDePrueba } from '../fixtures/fincas.ts';

export const SHARD = 'agro_c0_s1';
export const API = 'https://agro-api-c0.ejemplo.test';
export const T0 = Date.UTC(2026, 9, 1, 12);

export interface Celda {
  db: BaseD1;
  cerrar: () => Promise<void>;
  vaciar: () => Promise<void>;
  /** `fetch` del teléfono contra el Worker en memoria; cuenta los lotes y puede cortar. */
  red: (opciones?: { cortarDespuesDe?: number; base?: BaseD1 }) => {
    fn: typeof fetch;
    lotes: number[];
  };
  acceso: (org: string, dispositivo?: string) => Promise<string>;
  contar: (tabla: string) => Promise<number>;
}

export async function montarCelda(): Promise<Celda> {
  const { db, cerrar } = await baseLocal({
    configuracion: 'apps/api-celda/wrangler.c0.jsonc',
    binding: SHARD,
    base: 'celda',
  });
  const firmante: Firmante = await firmanteDesde(await generarClavePrivada());
  const api = crearApp({ ahora: () => T0 });
  return {
    db,
    cerrar,
    vaciar: () => vaciar(db, [...TABLAS_DEL_SHARD]),
    red: ({ cortarDespuesDe, base = db } = {}) => {
      const lotes: number[] = [];
      const env = {
        CELDA: 'c0',
        CORE_CLAVES: JSON.stringify([firmante.publica]),
        ORIGENES_APP: 'https://agro.ejemplo.test',
        [SHARD]: base,
      };
      const fn = (async (url: string, init?: RequestInit) => {
        const r = await api.fetch(new Request(url, init), env);
        lotes.push(JSON.parse(String(init?.body ?? '{}')).ops?.length ?? 0);
        if (cortarDespuesDe !== undefined && lotes.length > cortarDespuesDe) {
          throw new TypeError('Failed to fetch'); // la celda respondió, pero la respuesta no llegó
        }
        return r;
      }) as unknown as typeof fetch;
      return { fn, lotes };
    },
    acceso: async (org) =>
      (
        await firmarAcceso(
          firmante,
          { sub: 'u1', org, rol: 'propietario', celda: 'c0', shard: SHARD, anillo: 1 },
          T0,
        )
      ).token,
    contar: async (tabla) =>
      (await db.prepare(`SELECT count(*) AS n FROM ${tabla}`).first<{ n: number }>())?.n ?? 0,
  };
}

export interface Telefono {
  db: CuadernoDb;
  org: string;
  destino: { api: string; acceso: string; dispositivo: string; app: string };
  /** Sube lo pendiente y baja lo del equipo, como la app (sincronizacion.ts). */
  sincronizar: (fetchFn: typeof fetch) => Promise<void>;
}

async function telefono(
  celda: Celda,
  db: CuadernoDb,
  org: string,
  fincaId: string | null,
  dispositivo: string,
): Promise<Telefono> {
  await db.meta.put({
    clave: CLAVE_VINCULO,
    valor: { org_id: org, finca_id: fincaId, vinculado: '2026-10-01T12:00:00.000Z' },
    actualizado: '',
  });
  const destino = { api: API, acceso: await celda.acceso(org), dispositivo, app: '0.1.0' };
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

/** Teléfono nuevo de la misma cuenta: sin finca, vinculado a la organización (HU-E5.3, CA4). */
export function telefonoNuevo(
  celda: Celda,
  org: string,
  dispositivo = 'telefono-2',
): Promise<Telefono> {
  return telefono(celda, nuevaBase(), org, null, dispositivo);
}
