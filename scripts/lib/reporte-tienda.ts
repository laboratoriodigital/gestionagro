/**
 * La Tienda en el reporte semanal del dueño (HU-T14.7, ED1 §31.1, ADR-16, estudio §16.3): cuántas
 * tiendas hay y venden, el pago real de los planes, el soporte que anotó el dueño, el costo del mes
 * y las métricas de validación con su umbral (`content/tienda/validacion.json`, HU-T0.3).
 *
 * Solo conteos ([H6], CA2): ningún nombre, celular, correo, dirección ni código de pedido sale de
 * aquí. Lee cada base de la Tienda (shards y control) y la del CORE con la API de D1, y lo gratis de
 * R2 con las mismas consultas del freno (bitácora tienda3 27). Una parte que no se puede leer dice
 * por qué y el resto sale igual (P1).
 */
import validacion from '../../content/tienda/validacion.json' with { type: 'json' };

type Fetch = typeof fetch;
const API = 'https://api.cloudflare.com/client/v4';
const DIA = 24 * 60 * 60 * 1000;

export interface Seccion {
  titulo: string;
  lineas: string[];
}

export interface BasesDeLaTienda {
  shards: readonly string[];
  control: string;
  core: string;
}

const n = (x: number) => Math.round(x).toLocaleString('es-CO');

/** Una consulta a una base D1 por su nombre; devuelve la primera fila. */
async function primeraFila(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  base: string,
  sql: string,
  params: unknown[],
): Promise<Record<string, number>> {
  const pedir = async (ruta: string, init?: RequestInit) => {
    const r = await fetchFn(`${API}/accounts/${cuenta}/d1/database${ruta}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
    const cuerpo = (await r.json().catch(() => null)) as { result?: unknown } | null;
    if (r.status !== 200 || !cuerpo?.result) throw new Error(`D1 respondió ${r.status} (${base})`);
    return cuerpo.result;
  };
  const bases = (await pedir(`?name=${encodeURIComponent(base)}`)) as {
    uuid: string;
    name: string;
  }[];
  const id = bases.find((b) => b.name === base)?.uuid;
  if (!id) throw new Error(`no existe la base ${base}`);
  const resultado = (await pedir(`/${id}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  })) as { results?: Record<string, number>[] }[];
  const f = resultado[0]?.results?.[0];
  if (!f) throw new Error(`la consulta a ${base} no devolvió filas`);
  return f;
}

/** Lo de cada shard, sumado: las tiendas, sus pedidos de la semana y sus cobros. */
const SQL_DEL_SHARD = `SELECT
  (SELECT count(*) FROM tienda WHERE estado = 'abierta') AS abiertas,
  (SELECT count(*) FROM tienda WHERE creado >= ?1) AS nuevas,
  (SELECT count(*) FROM tienda WHERE estado = 'abierta' AND version_publicada IS NOT NULL) AS publicadas,
  (SELECT count(*) FROM pedido WHERE creado >= ?1) AS pedidos,
  (SELECT count(*) FROM pedido WHERE creado >= ?1 AND estado IN ('confirmado', 'pagado', 'despachado', 'entregado')) AS vendidos,
  (SELECT count(*) FROM cobro WHERE ambiente = 'produccion' AND estado IN ('aprobado', 'aprobado_sin_existencias') AND actualizado >= ?1) AS cobros,
  (SELECT count(*) FROM cobro WHERE estado IN ('esperando', 'revisar') AND creado < ?2) AS sin_cerrar`;

const SQL_DEL_CONTROL = `SELECT count(DISTINCT org_id) AS atendidos, coalesce(sum(minutos), 0) AS minutos
  FROM soporte WHERE dia >= ?1`;

const SQL_DEL_CORE = `SELECT
  (SELECT count(*) FROM organizacion WHERE producto = 'tienda') AS tiendas,
  (SELECT count(DISTINCT org_id) FROM pago WHERE producto = 'tienda' AND estado = 'aprobado' AND ambiente = 'produccion') AS pagaron`;

const umbral = (id: string) =>
  validacion.metricas.find((m) => m.id === id && 'umbral' in m) as { umbral: string } | undefined;

export async function laTiendaEnLaSemana(
  fetchFn: Fetch,
  tokenD1: string,
  cuenta: string,
  bases: BasesDeLaTienda,
  ahora: number,
  r2: { uso: Partial<Record<'espacio' | 'clase_a' | 'clase_b', number>>; fallas: string[] },
  titulo = 'Tienda',
): Promise<Seccion> {
  const lineas: string[] = [];
  const semana = new Date(ahora - 7 * DIA).toISOString();
  const dia = new Date(ahora - 7 * DIA - 5 * 3_600_000).toISOString().slice(0, 10);
  const hace24 = new Date(ahora - DIA).toISOString();
  if (!tokenD1) return { titulo, lineas: ['No se pudo leer: falta el secreto CF_API_TOKEN.'] };

  let tiendas: Record<string, number> | null = null;
  try {
    const filas = await Promise.all(
      bases.shards.map((b) =>
        primeraFila(fetchFn, tokenD1, cuenta, b, SQL_DEL_SHARD, [semana, hace24]),
      ),
    );
    tiendas = {};
    for (const f of filas)
      for (const [k, v] of Object.entries(f)) tiendas[k] = (tiendas[k] ?? 0) + Number(v ?? 0);
  } catch (e) {
    lineas.push(`- Las tiendas: no se pudo leer (${(e as Error).message}).`);
  }
  if (tiendas) {
    lineas.push(
      `- Tiendas abiertas: ${n(tiendas['abiertas'] ?? 0)} (nuevas esta semana: ${n(tiendas['nuevas'] ?? 0)}; con su catálogo publicado: ${n(tiendas['publicadas'] ?? 0)})`,
      `- Pedidos de la semana: ${n(tiendas['pedidos'] ?? 0)}, de ellos vendidos: ${n(tiendas['vendidos'] ?? 0)}`,
      `- Cobros en línea reales: ${n(tiendas['cobros'] ?? 0)} · sin estado final después de 24 horas: ${n(tiendas['sin_cerrar'] ?? 0)} (umbral: ${umbral('confiabilidad-del-cobro')?.umbral ?? 'sin umbral'})`,
    );
  }

  try {
    const core = await primeraFila(fetchFn, tokenD1, cuenta, bases.core, SQL_DEL_CORE, []);
    lineas.push(
      `- Pago real: ${n(core['pagaron'] ?? 0)} de ${n(core['tiendas'] ?? 0)} tiendas pagaron su plan (umbral: ${umbral('pago-real')?.umbral ?? 'sin umbral'})`,
    );
  } catch (e) {
    lineas.push(`- Pago real: no se pudo leer (${(e as Error).message}).`);
  }

  try {
    const s = await primeraFila(fetchFn, tokenD1, cuenta, bases.control, SQL_DEL_CONTROL, [dia]);
    const atendidos = s['atendidos'] ?? 0;
    lineas.push(
      atendidos === 0
        ? '- Soporte: nada anotado esta semana (se anota con el flujo «anotar-soporte-tienda»)'
        : `- Soporte: ${n(s['minutos'] ?? 0)} minutos con ${n(atendidos)} comercio(s), ${n((s['minutos'] ?? 0) / atendidos)} por comercio (umbral: ${umbral('soporte-por-comercio')?.umbral ?? 'sin umbral'})`,
    );
  } catch (e) {
    lineas.push(`- Soporte: no se pudo leer (${(e as Error).message}).`);
  }

  const partes = (
    [
      ['espacio', 'espacio'],
      ['clase_a', 'escrituras'],
      ['clase_b', 'lecturas'],
    ] as const
  )
    .filter(([k]) => r2.uso[k] !== undefined)
    .map(([k, nombre]) => `${nombre} ${r2.uso[k]} %`);
  lineas.push(
    partes.length > 0
      ? `- Costo del mes: R2 usa ${partes.join(', ')} de lo gratis; Workers en el plan gratuito (umbral: ${umbral('costo-por-uso')?.umbral ?? 'sin umbral'})`
      : `- Costo del mes: no se pudo leer R2 (${r2.fallas.join('; ') || 'sin datos'}).`,
  );

  lineas.push(
    `- Umbrales de validación: ${validacion.estado === 'fijada' ? `fijados el ${validacion.fijada}` : 'todavía en propuesta (content/tienda/validacion.json)'}. Retención y activación se ven en el tablero de cada tienda.`,
  );
  return { titulo, lineas };
}
