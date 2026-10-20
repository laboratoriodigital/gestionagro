/**
 * `node scripts/tienda/simulacro-de-restauracion.ts` (HU-T17.4 CA1, TIENDA §15.4 punto 4): el
 * simulacro de restauración en staging, antes de guardar datos de terceros.
 *
 * 1. Lee a Comercio Ensayo Uno de la base de staging del shard, tabla por tabla, como lo lee el
 *    respaldo semanal (`filasDeLaTienda`): es su respaldo `tienda-respaldo/2`, armado aquí, porque
 *    staging no tiene cron.
 * 2. Crea una base vacía (`tienda-simulacro-<instante>`), le aplica las migraciones del shard y
 *    restaura el respaldo con el mismo SQL que el operador usaría (`sqlDeRestauracion`). La base es
 *    un D1 local de workerd en el mismo runner (`destinoLocal`): el plan gratuito admite 10 bases
 *    por cuenta y ya están las 10 (bitácora tienda3 38). Con `--en-la-cuenta`, una base de verdad en
 *    la cuenta, cuando haya lugar (Workers Paid).
 * 3. Vuelve a leer la tienda en la base nueva y compara las huellas, tabla por tabla.
 * 4. Borra la base del simulacro, aunque algo haya fallado.
 *
 * Todo por la API HTTP de D1, con `CF_API_TOKEN` y `CF_ACCOUNT_ID` (como `sembrar-volumen.ts`). Lo
 * corre el flujo `simulacro-restauracion-tienda` a mano. Con Ensayo Uno lleno lee unas 40.000 filas
 * y escribe unas 20.000, en una base que se borra al final: una vez, no cada semana.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Filas,
  filasDeLaTienda,
  huellasDeLasFilas,
  type Respaldo,
  TABLAS_DEL_RESPALDO,
} from '../../apps/tienda-api/src/respaldos.ts';
import { sqlDeRestauracion } from '../../apps/tienda-api/src/restaurar.ts';
import type { BaseD1 } from '../../packages/d1/src/index.ts';
import { baseLocal, sentenciasDe } from '../../packages/d1/src/local.ts';
import { ENSAYO_UNO } from '../../packages/tienda-schema/src/ensayos.ts';
import { RAIZ } from '../lib/repo.ts';
import { baseDeStaging } from './sembrar-volumen.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class SimulacroFallido extends Error {}

/** Lo que el simulacro usa de la API de D1. */
export interface ApiDeD1 {
  buscar(nombre: string): Promise<string | null>;
  crear(nombre: string): Promise<string>;
  borrar(id: string): Promise<void>;
  /** Con `params`, una sentencia; sin ellos, varias separadas por `;`. */
  consultar(id: string, sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export function apiDeD1(token: string, cuenta: string, f: Fetch = fetch): ApiDeD1 {
  const api = `https://api.cloudflare.com/client/v4/accounts/${cuenta}/d1/database`;
  const cabeceras = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const pedir = async <T>(url: string, init: RequestInit = {}): Promise<T> => {
    const r = await f(url, { ...init, headers: cabeceras });
    const cuerpo = (await r.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: { message?: string }[];
      result?: T;
    };
    if (!r.ok || cuerpo.success === false) {
      throw new SimulacroFallido(
        `${r.status === 401 || r.status === 403 ? 'al token le falta «Account → D1: Edit», o la cuenta no deja: ' : ''}D1 respondió ${r.status}: ${cuerpo.errors?.map((e) => e.message).join('; ') || 'sin detalle'}`,
      );
    }
    return cuerpo.result as T;
  };
  return {
    async buscar(nombre) {
      const bases = await pedir<{ uuid: string; name: string }[]>(
        `${api}?name=${encodeURIComponent(nombre)}&per_page=100`,
      );
      return bases.find((b) => b.name === nombre)?.uuid ?? null;
    },
    async crear(nombre) {
      return (
        await pedir<{ uuid: string }>(api, {
          method: 'POST',
          body: JSON.stringify({ name: nombre }),
        })
      ).uuid;
    },
    async borrar(id) {
      await pedir(`${api}/${id}`, { method: 'DELETE' });
    },
    async consultar(id, sql, params) {
      const r = await pedir<{ results?: Record<string, unknown>[] }[]>(`${api}/${id}/query`, {
        method: 'POST',
        body: JSON.stringify(params ? { sql, params } : { sql }),
      });
      return r[0]?.results ?? [];
    },
  };
}

/** Dónde se restaura: crear la base vacía, escribir y leer en ella, y borrarla. */
export type DestinoDelSimulacro = Pick<ApiDeD1, 'crear' | 'consultar' | 'borrar'>;

/**
 * Bitácora tienda3 38: la base del simulacro, en un D1 local de workerd del mismo runner (el de las
 * pruebas de `main`), sin migraciones: el simulacro aplica las suyas. No ocupa una de las 10 bases
 * de la cuenta y desaparece al cerrar.
 */
export function destinoLocal(): DestinoDelSimulacro {
  const abiertas = new Map<string, Awaited<ReturnType<typeof baseLocal>>>();
  return {
    async crear(nombre) {
      abiertas.set(
        nombre,
        await baseLocal({
          configuracion: 'apps/tienda-api/wrangler.c1.jsonc',
          binding: 'tienda_c1_s1',
          base: 'tienda',
          instrumento: 'workerd',
          antesDe: '0000',
        }),
      );
      return nombre;
    },
    async consultar(id, sql, params) {
      const b = abiertas.get(id);
      if (!b) throw new SimulacroFallido(`la base ${id} no está abierta`);
      if (params)
        return (
          await b.db
            .prepare(sql)
            .bind(...params)
            .all()
        ).results as Record<string, unknown>[];
      let ultimas: Record<string, unknown>[] = [];
      for (const sentencia of sentenciasDe(sql))
        ultimas = (await b.db.prepare(sentencia).all()).results as Record<string, unknown>[];
      return ultimas;
    },
    async borrar(id) {
      await abiertas.get(id)?.cerrar();
      abiertas.delete(id);
    },
  };
}

/** Una base de D1 por la API HTTP, con lo que `filasDeLaTienda` necesita: leer. */
export function comoBase(api: Pick<ApiDeD1, 'consultar'>, id: string): BaseD1 {
  const sentencia = (sql: string, params: unknown[]) => ({
    bind: (...p: unknown[]) => sentencia(sql, p),
    all: async () => ({ results: await api.consultar(id, sql, params), success: true }),
    first: async () => (await api.consultar(id, sql, params))[0] ?? null,
    run: async () => ({ results: await api.consultar(id, sql, params), success: true }),
  });
  return {
    prepare: (sql: string) => sentencia(sql, []),
    batch: async () => {
      throw new SimulacroFallido('el simulacro no escribe por lotes en la base de origen');
    },
  } as unknown as BaseD1;
}

/** El SQL de la restauración, en trozos que caben en una consulta de la API (100 KB). */
export function enTrozos(sql: string, maximo = 90_000): string[] {
  const trozos: string[] = [];
  let actual = '';
  for (const sentencia of sql.split(/;\n/).filter((s) => s.trim())) {
    const con = `${sentencia};\n`;
    if (actual && actual.length + con.length > maximo) {
      trozos.push(actual);
      actual = '';
    }
    actual += con;
  }
  if (actual) trozos.push(actual);
  return trozos;
}

/** La fila de la tienda sin sus consecutivos, que la restauración sube por encima de lo restaurado. */
const sinConsecutivos = (f: Filas): Filas => ({
  ...f,
  tienda: f.tienda.map(({ ultimo_numero: _n, ultima_solicitud: _s, ...t }) => t),
});

export interface OpcionesDelSimulacro {
  api: ApiDeD1;
  /** La base de staging del shard (su nombre). */
  base: string;
  org: string;
  instante: number;
  /** Las migraciones del shard, en orden. */
  migraciones: readonly string[];
  decir?: (linea: string) => void;
  /** Dónde se restaura; sin él, una base nueva en la cuenta por la misma API. */
  destino?: DestinoDelSimulacro;
}

export interface ResultadoDelSimulacro {
  ok: boolean;
  tablas: { tabla: string; filas: number; igual: boolean }[];
}

export async function simulacro(o: OpcionesDelSimulacro): Promise<ResultadoDelSimulacro> {
  const decir = o.decir ?? ((l: string) => console.log(l));
  const origen = await o.api.buscar(o.base);
  if (!origen) throw new SimulacroFallido(`no existe la base ${o.base} en la cuenta`);
  const filas: Filas = await filasDeLaTienda(comoBase(o.api, origen), o.org);
  if (filas.tienda.length !== 1) {
    throw new SimulacroFallido(
      `la tienda ${o.org} no está en ${o.base}: despliega staging primero`,
    );
  }
  const respaldo = {
    formato: 'tienda-respaldo/2',
    org: o.org,
    hecho: new Date(o.instante).toISOString(),
    tienda: null,
    filas,
    recuentos: null,
  } as unknown as Respaldo;
  decir(
    `Leída la tienda de ${o.base}: ${filas.producto.length} productos, ${filas.pedido.length} pedidos.`,
  );

  const nombre = `tienda-simulacro-${new Date(o.instante).toISOString().replace(/\D/g, '').slice(0, 12)}`;
  const d = o.destino ?? o.api;
  const temporal = await d.crear(nombre);
  decir(`Base vacía ${nombre} creada.`);
  try {
    for (const m of o.migraciones) await d.consultar(temporal, m);
    const trozos = enTrozos(sqlDeRestauracion(respaldo));
    for (const [i, t] of trozos.entries()) {
      await d.consultar(temporal, t);
      if ((i + 1) % 20 === 0 || i + 1 === trozos.length)
        decir(`  ${i + 1} de ${trozos.length} trozos restaurados`);
    }
    const restauradas = await filasDeLaTienda(comoBase(d, temporal), o.org);
    const [antes, despues] = await Promise.all([
      huellasDeLasFilas(sinConsecutivos(filas)),
      huellasDeLasFilas(sinConsecutivos(restauradas)),
    ]);
    const tablas: ResultadoDelSimulacro['tablas'] = TABLAS_DEL_RESPALDO.map(([tabla]) => ({
      tabla,
      filas: filas[tabla].length,
      igual: antes[tabla] === despues[tabla],
    }));
    // Los consecutivos los sube la restauración a propósito: no pueden quedar por debajo de lo restaurado.
    const mayor = Math.max(1000, ...restauradas.pedido.map((p) => Number(p['numero'])));
    const consecutivo = Number(restauradas.tienda[0]?.['ultimo_numero'] ?? 0);
    tablas.push({ tabla: 'consecutivo de pedidos', filas: 1, igual: consecutivo >= mayor });
    for (const t of tablas) decir(`${t.igual ? '✅' : '❌'} ${t.tabla}: ${t.filas} filas`);
    return { ok: tablas.every((t) => t.igual), tablas };
  } finally {
    await d.borrar(temporal);
    decir(`Base ${nombre} borrada.`);
  }
}

/** Las migraciones del shard de la Tienda, en orden. */
export function migracionesDelShard(): string[] {
  const dir = join(RAIZ, 'infrastructure', 'migraciones', 'tienda');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'));
}

if (process.argv[1]?.endsWith('simulacro-de-restauracion.ts')) {
  const token = process.env['CF_API_TOKEN'];
  const cuenta = process.env['CF_ACCOUNT_ID'];
  if (!token || !cuenta) {
    console.error('Faltan CF_API_TOKEN y CF_ACCOUNT_ID.');
    process.exit(2);
  }
  try {
    const r = await simulacro({
      api: apiDeD1(token, cuenta),
      base: baseDeStaging(),
      org: ENSAYO_UNO.org,
      instante: Date.now(),
      migraciones: migracionesDelShard(),
      ...(process.argv.includes('--en-la-cuenta') ? {} : { destino: destinoLocal() }),
    });
    console.log(
      r.ok ? '✅ La tienda volvió igual, tabla por tabla.' : '❌ Alguna tabla no volvió igual.',
    );
    process.exit(r.ok ? 0 : 1);
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
