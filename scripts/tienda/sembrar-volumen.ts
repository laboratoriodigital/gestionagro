/**
 * `node scripts/tienda/sembrar-volumen.ts --destino local|staging` (HU-T3.7): llena a Comercio
 * Ensayo Uno con 2.000 productos de 6 combinaciones y 300 pedidos del mes, para revisar la vitrina
 * y el panel con la tienda llena (`docs/runbooks/tienda-revision-con-la-tienda-llena.md`).
 *
 * - **Solo local y staging (CA1).** Cualquier otro destino se rechaza antes de leer credenciales: la
 *   siembra nunca llega a producción.
 * - `local`: escribe `apps/tienda-api/volumen.local.sql` (fuera de git) y lo aplica con wrangler a
 *   la base local del shard, después de sus migraciones y de la siembra de los comercios de prueba.
 * - `staging`: por la API HTTP de D1, con `CF_API_TOKEN` y `CF_ACCOUNT_ID`, sentencia por sentencia,
 *   sobre la base de staging del shard de la Tienda. Exige que Ensayo Uno ya exista (lo crea el
 *   despliegue de staging) y que tenga al menos una foto subida desde el panel: esa foto se le pone
 *   a cada producto que no tiene, porque sin foto la tienda no se publica (bitácora tienda3 22).
 *   Volver a correrlo no duplica nada.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENSAYO_UNO, siembraDelShard } from '../../packages/tienda-schema/src/ensayos.ts';
import {
  fotosDeVolumen,
  siembraDeVolumen,
  VOLUMEN,
} from '../../packages/tienda-schema/src/volumen.ts';
import { baseDelShard } from '../generar-wrangler.ts';
import { cargarCeldas } from '../lib/celdas.ts';
import { RAIZ } from '../lib/repo.ts';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export class SiembraRechazada extends Error {}

export const DESTINOS = ['local', 'staging'] as const;
export const ARCHIVO_LOCAL = 'volumen.local.sql';

/** La base de staging del shard de la Tienda, de `celdas.json` (P2). */
export function baseDeStaging(): string {
  const celdas = cargarCeldas().celdas.filter((c) => c.producto === 'tienda');
  const shard = celdas[0]?.shards[0];
  if (celdas.length !== 1 || !shard || celdas[0]?.shards.length !== 1) {
    throw new SiembraRechazada(
      'la Tienda tiene más de una celda o de un shard: este script todavía no sabe cuál llenar',
    );
  }
  return baseDelShard(shard, true);
}

export interface OpcionesDeStaging {
  token: string;
  cuenta: string;
  ahora: string;
  fetch?: Fetch;
  decir?: (linea: string) => void;
}

/** Llena la base de staging. Devuelve cuántas sentencias aplicó. */
export async function sembrarEnStaging(o: OpcionesDeStaging): Promise<number> {
  const f = o.fetch ?? fetch;
  const decir = o.decir ?? ((l: string) => console.log(l));
  const base = baseDeStaging();
  const api = `https://api.cloudflare.com/client/v4/accounts/${o.cuenta}/d1/database`;
  const cabeceras = { authorization: `Bearer ${o.token}`, 'content-type': 'application/json' };
  const lista = await f(`${api}?name=${encodeURIComponent(base)}&per_page=100`, {
    headers: cabeceras,
  });
  const bases = (
    (await lista.json().catch(() => ({}))) as { result?: { uuid: string; name: string }[] }
  ).result;
  const id = bases?.find((b) => b.name === base)?.uuid;
  if (!lista.ok || !id) {
    throw new SiembraRechazada(
      lista.status === 401 || lista.status === 403
        ? 'al token le falta «Account → D1: Edit»'
        : `no existe la base ${base} en esa cuenta (HTTP ${lista.status})`,
    );
  }
  const consultar = async (sql: string, params: unknown[] = []) => {
    const r = await f(`${api}/${id}/query`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ sql, params }),
    });
    const cuerpo = (await r.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: { message?: string }[];
      result?: { results?: Record<string, unknown>[] }[];
    };
    if (!r.ok || cuerpo.success === false) {
      throw new SiembraRechazada(
        `D1 respondió ${r.status}: ${cuerpo.errors?.map((e) => e.message).join('; ') || 'sin detalle'}`,
      );
    }
    return cuerpo.result?.[0]?.results ?? [];
  };
  const tienda = await consultar('SELECT org_id FROM tienda WHERE org_id = ?', [ENSAYO_UNO.org]);
  if (tienda.length === 0) {
    throw new SiembraRechazada(
      `${ENSAYO_UNO.nombre} no está en ${base}: despliega staging primero, que lo crea (HU-T2.6)`,
    );
  }
  const [fotos] = await consultar('SELECT count(*) AS n FROM medio WHERE org_id = ?', [
    ENSAYO_UNO.org,
  ]);
  if (!Number(fotos?.['n'])) {
    throw new SiembraRechazada(
      `${ENSAYO_UNO.nombre} no tiene ninguna foto, y sin fotos la tienda no se publica: sube una a cualquier producto desde el panel de staging y vuelve a correr esto`,
    );
  }
  const sentencias = [
    ...siembraDeVolumen(ENSAYO_UNO, o.ahora),
    fotosDeVolumen(ENSAYO_UNO, o.ahora),
  ];
  for (const [i, sql] of sentencias.entries()) {
    await consultar(sql.replace(/;$/, ''));
    if ((i + 1) % 25 === 0 || i + 1 === sentencias.length)
      decir(`  ${i + 1} de ${sentencias.length} sentencias aplicadas`);
  }
  return sentencias.length;
}

function sembrarEnLocal(ahora: string): void {
  const dir = join(RAIZ, 'apps', 'tienda-api');
  writeFileSync(
    join(dir, ARCHIVO_LOCAL),
    `${[...siembraDelShard([ENSAYO_UNO], ahora), ...siembraDeVolumen(ENSAYO_UNO, ahora), fotosDeVolumen(ENSAYO_UNO, ahora)].join('\n')}\n`,
  );
  const correr = (argumentos: string) => {
    const r = spawnSync(
      `pnpm --filter @ed1/tienda-api exec wrangler ${argumentos} -c wrangler.c1.jsonc`,
      { cwd: RAIZ, shell: true, stdio: 'inherit' },
    );
    if (r.status !== 0) throw new SiembraRechazada(`wrangler ${argumentos} falló`);
  };
  correr('d1 migrations apply tienda_c1_s1 --local');
  correr(`d1 execute tienda_c1_s1 --local --file ${ARCHIVO_LOCAL}`);
}

/** El destino, revisado antes de tocar nada. */
export function destinoDe(argv: readonly string[]): (typeof DESTINOS)[number] {
  const i = argv.indexOf('--destino');
  const d = i >= 0 ? argv[i + 1] : undefined;
  if (!d || !(DESTINOS as readonly string[]).includes(d)) {
    throw new SiembraRechazada(
      `--destino es local o staging${d ? `, nunca ${d}` : ''}: la tienda llena es solo para revisar (HU-T3.7)`,
    );
  }
  return d as (typeof DESTINOS)[number];
}

if (process.argv[1]?.endsWith('sembrar-volumen.ts')) {
  try {
    const destino = destinoDe(process.argv);
    const ahora = new Date().toISOString();
    if (destino === 'local') {
      sembrarEnLocal(ahora);
    } else {
      const token = process.env['CF_API_TOKEN'];
      const cuenta = process.env['CF_ACCOUNT_ID'];
      if (!token || !cuenta) throw new SiembraRechazada('faltan CF_API_TOKEN y CF_ACCOUNT_ID');
      await sembrarEnStaging({ token, cuenta, ahora });
    }
    console.log(
      `✅ ${ENSAYO_UNO.nombre} quedó llena en ${destino}: ${VOLUMEN.productos} productos de ${VOLUMEN.combinaciones} combinaciones y ${VOLUMEN.pedidos} pedidos del mes. Publícala desde el panel para ver la vitrina.`,
    );
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
