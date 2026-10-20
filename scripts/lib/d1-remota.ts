/**
 * Una base D1 por la API de Cloudflare (`/d1/database/{id}/query`), con la forma de `BaseD1` del
 * CORE: los scripts del dueño corren la misma función que se prueba contra el D1 local, sin una
 * ruta nueva en el Worker (HU-C5.8).
 *
 * `batch` manda las sentencias una tras otra: por esta API no hay transacción. Quien la usa escribe
 * en un orden que no deja nada a medias (ver `apps/core/src/pago-en-efectivo.ts`).
 */
import type { BaseD1, ResultadoD1, SentenciaD1 } from '@ed1/d1';
import type { Fetch } from './despliegue.ts';

const API = 'https://api.cloudflare.com/client/v4';

interface RespuestaDeD1 {
  success?: boolean;
  errors?: { message?: string }[];
  result?: { results?: Record<string, unknown>[]; meta?: ResultadoD1['meta'] }[];
}

/** El id de la base con ese nombre, sin crearla. Lanza si no existe o si el token no la ve. */
export async function idDeLaBaseD1(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  nombre: string,
): Promise<string> {
  const r = await fetchFn(
    `${API}/accounts/${cuenta}/d1/database?name=${encodeURIComponent(nombre)}&per_page=100`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (r.status === 401 || r.status === 403)
    throw new Error('al token le falta «Account → D1: Edit»');
  const cuerpo = (await r.json().catch(() => ({}))) as {
    result?: { uuid: string; name: string }[];
  };
  const base = cuerpo.result?.find((b) => b.name === nombre);
  if (!base) throw new Error(`no hay una base D1 llamada ${nombre}`);
  return base.uuid;
}

export function baseD1Remota(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  baseId: string,
): BaseD1 {
  async function consultar(sql: string, valores: unknown[]): Promise<ResultadoD1> {
    const r = await fetchFn(`${API}/accounts/${cuenta}/d1/database/${baseId}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql, params: valores }),
    });
    const cuerpo = (await r.json().catch(() => ({}))) as RespuestaDeD1;
    if (!r.ok || cuerpo.success === false) {
      const detalle = cuerpo.errors?.map((e) => e.message).join('; ') || `HTTP ${r.status}`;
      throw new Error(`D1 no aceptó la consulta: ${detalle}`);
    }
    const primero = cuerpo.result?.[0];
    return { results: primero?.results ?? [], meta: primero?.meta ?? {} };
  }

  const sentencia = (sql: string, valores: unknown[] = []): SentenciaD1 => ({
    bind: (...nuevos: unknown[]) => sentencia(sql, nuevos),
    first: async <T>() => ((await consultar(sql, valores)).results[0] as T | undefined) ?? null,
    all: async <T>() => (await consultar(sql, valores)) as ResultadoD1<T>,
    run: () => consultar(sql, valores),
  });

  return {
    prepare: (sql) => sentencia(sql),
    async batch(sentencias) {
      const resultados: ResultadoD1[] = [];
      for (const s of sentencias) resultados.push(await s.run());
      return resultados;
    },
  };
}
