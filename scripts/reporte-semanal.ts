/**
 * `node scripts/reporte-semanal.ts`: el reporte semanal de validación (HU-E8.3, CA3 y CA4,
 * ADR-16). Lo corre el flujo «reporte-semanal» los lunes y lo publica como issue del repositorio
 * (la notificación de GitHub es gratis).
 *
 * Solo métricas agregadas, nunca datos de fincas ([H6]):
 * - **Herramientas:** eventos de Analytics Engine por producto (abiertas, completadas,
 *   compartidas, siguiente paso), esta semana y la anterior.
 * - **Cuentas:** conteos del CORE (cuentas, nuevas, fincas, personas en equipos) y el retorno a 30
 *   días. Nunca nombres ni correos. Las bases de las fincas no se tocan desde aquí.
 * - **Nube:** consumo de la semana en la cuenta de Cloudflare (Workers y D1), con las mismas
 *   consultas del vigía (HU-E8.2).
 * - **Intención de pago (HU-E0.6):** fincas que tocaron «Me interesa» en la lista de espera, sobre
 *   las cuentas, y por plan.
 * - Lo que aún no se mide se dice: Search Console (decisión del dueño: después).
 *
 * Una sección que no se puede leer dice por qué y el reporte sale igual (P1).
 * Funciones con `fetch` inyectado, para probarlas sin tocar Cloudflare ni GitHub.
 */
import { execFileSync } from 'node:child_process';
import { FUENTES } from '../apps/api-celda/src/vigia.ts';
import { EVENTOS } from '../packages/eventos/src/index.ts';
import { cargarCeldas } from './lib/celdas.ts';

type Fetch = typeof fetch;
const API = 'https://api.cloudflare.com/client/v4';
const DIA = 24 * 60 * 60 * 1000;

export type Seccion = { titulo: string; lineas: string[] };

const falla = (titulo: string, motivo: string): Seccion => ({
  titulo,
  lineas: [`No se pudo leer: ${motivo}.`],
});

const n = (x: number) => Math.round(x).toLocaleString('es-CO');

/** Eventos de herramientas por producto, de Analytics Engine, en una ventana de días. */
export async function eventosDeHerramientas(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  dataset: string,
): Promise<Seccion> {
  const titulo = `Herramientas (eventos agregados, ${dataset})`;
  if (!/^[a-z0-9_]+$/.test(dataset))
    return falla(titulo, `nombre de dataset inválido «${dataset}»`);
  const suma = (i: number) => `SUM(_sample_interval * double${i + 1})`;
  const columnas = EVENTOS.map((_e, i) => `${suma(i)} AS e${i}`).join(', ');
  const semana = (desde: number, hasta: number) =>
    `SELECT blob1 AS producto, ${columnas} FROM ${dataset} WHERE timestamp > NOW() - INTERVAL '${desde}' DAY AND timestamp <= NOW() - INTERVAL '${hasta}' DAY GROUP BY producto`;
  const leer = async (sql: string) => {
    const r = await fetchFn(`${API}/accounts/${cuenta}/analytics_engine/sql`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: sql,
    });
    const cuerpo = (await r.json().catch(() => null)) as {
      data?: Record<string, unknown>[];
    } | null;
    if (r.status !== 200 || !Array.isArray(cuerpo?.data))
      throw new Error(`Analytics Engine respondió ${r.status}`);
    return cuerpo.data;
  };
  try {
    const [esta, anterior] = await Promise.all([leer(semana(7, 0)), leer(semana(14, 7))]);
    const previa = new Map(anterior.map((f) => [String(f['producto']), f]));
    if (esta.length === 0) return { titulo, lineas: ['Sin eventos esta semana.'] };
    return {
      titulo,
      lineas: esta.map((f) => {
        const p = String(f['producto']);
        const antes = previa.get(p);
        const valores = EVENTOS.map((e, i) => {
          const ahora = Number(f[`e${i}`] ?? 0);
          const prev = Number(antes?.[`e${i}`] ?? 0);
          return `${e} ${n(ahora)} (antes ${n(prev)})`;
        });
        // HU-E2.6, CA3: la tasa de completado, la métrica de los 90 días de la herramienta.
        const tasa = (fila: Record<string, unknown> | undefined) => {
          const abiertas = Number(fila?.[`e${EVENTOS.indexOf('tool.opened')}`] ?? 0);
          return abiertas > 0
            ? `${Math.round((100 * Number(fila?.[`e${EVENTOS.indexOf('tool.completed')}`] ?? 0)) / abiertas)} %`
            : '—';
        };
        return `- ${p}: ${valores.join(' · ')} · completado ${tasa(f)} (antes ${tasa(antes)})`;
      }),
    };
  } catch (e) {
    return falla(titulo, (e as Error).message);
  }
}

/** Conteos del CORE y retorno a 30 días. Solo agregados: ni nombres ni correos. */
export async function cuentasDelCore(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  base: string,
  ahora: number,
): Promise<Seccion> {
  const titulo = `Cuentas (${base})`;
  const pedir = async (ruta: string, init?: RequestInit) => {
    const r = await fetchFn(`${API}/accounts/${cuenta}/d1/database${ruta}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    });
    const cuerpo = (await r.json().catch(() => null)) as { result?: unknown } | null;
    if (r.status !== 200 || !cuerpo?.result) throw new Error(`D1 respondió ${r.status}`);
    return cuerpo.result;
  };
  try {
    const bases = (await pedir(`?name=${encodeURIComponent(base)}`)) as {
      uuid: string;
      name: string;
    }[];
    const id = bases.find((b) => b.name === base)?.uuid;
    if (!id) return falla(titulo, `no existe la base ${base}`);
    const hace = (dias: number) => new Date(ahora - dias * DIA).toISOString();
    // El último uso de una sesión es su último giro: expira − 60 días (HU-E4.2).
    const sql = `SELECT
        (SELECT count(*) FROM usuario) AS cuentas,
        (SELECT count(*) FROM usuario WHERE creado >= ?1) AS nuevas,
        (SELECT count(*) FROM organizacion) AS fincas,
        (SELECT count(*) FROM membresia WHERE rol != 'propietario') AS equipo,
        (SELECT count(*) FROM usuario WHERE creado < ?2) AS antiguas,
        (SELECT count(DISTINCT s.usuario_id) FROM sesion s JOIN usuario u ON u.id = s.usuario_id
          WHERE u.creado < ?2 AND datetime(s.expira, '-60 days') >= datetime(?2)) AS volvieron,
        (SELECT count(DISTINCT org_id) FROM interes_plan) AS interesadas,
        (SELECT count(DISTINCT org_id) FROM interes_plan WHERE plan = 'finca') AS interes_finca,
        (SELECT count(DISTINCT org_id) FROM interes_plan WHERE plan = 'exportador') AS interes_exportador,
        (SELECT count(DISTINCT org_id) FROM interes_plan WHERE plan = 'cadena') AS interes_cadena`;
    const resultado = (await pedir(`/${id}/query`, {
      method: 'POST',
      body: JSON.stringify({ sql, params: [hace(7), hace(30)] }),
    })) as { results?: Record<string, number>[] }[];
    const f = resultado[0]?.results?.[0];
    if (!f) return falla(titulo, 'la consulta no devolvió filas');
    const retorno =
      f['antiguas'] === 0
        ? 'sin cuentas de más de 30 días todavía'
        : `${n(f['volvieron'] ?? 0)} de ${n(f['antiguas'] ?? 0)} (${Math.round(((f['volvieron'] ?? 0) / (f['antiguas'] ?? 1)) * 100)} %)`;
    const cuentas = f['cuentas'] ?? 0;
    const intencion =
      cuentas === 0
        ? 'sin cuentas todavía'
        : `${n(f['interesadas'] ?? 0)} fincas de ${n(cuentas)} cuentas (${Math.round(((f['interesadas'] ?? 0) / cuentas) * 100)} %) · Finca ${n(f['interes_finca'] ?? 0)}, Exportador ${n(f['interes_exportador'] ?? 0)}, Cadena ${n(f['interes_cadena'] ?? 0)}`;
    return {
      titulo,
      lineas: [
        `- Cuentas: ${n(f['cuentas'] ?? 0)} (nuevas esta semana: ${n(f['nuevas'] ?? 0)})`,
        `- Fincas en la nube: ${n(f['fincas'] ?? 0)} · personas invitadas a equipos: ${n(f['equipo'] ?? 0)}`,
        `- Retorno a 30 días (cuentas de más de 30 días que usaron la app en los últimos 30): ${retorno}`,
        `- Intención de pago (tocaron «Me interesa» en la lista de espera): ${intencion}`,
      ],
    };
  } catch (e) {
    return falla(titulo, (e as Error).message);
  }
}

/** Consumo de la semana en la cuenta, con las consultas del vigía. */
export async function consumoDeLaNube(
  fetchFn: Fetch,
  token: string,
  cuenta: string,
  ahora: number,
): Promise<Seccion> {
  const titulo = 'Nube (consumo de los últimos 7 días, toda la cuenta)';
  const lineas: string[] = [];
  for (const fuente of FUENTES.filter((x) => x.nombre === 'Workers' || x.nombre === 'D1')) {
    try {
      const r = await fetchFn('https://api.cloudflare.com/client/v4/graphql', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: fuente.consulta,
          variables: {
            cuenta,
            desde: new Date(ahora - 7 * DIA).toISOString(),
            hasta: new Date(ahora).toISOString(),
          },
        }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as {
        data?: { viewer?: { accounts?: Record<string, unknown>[] } };
        errors?: { message?: string }[] | null;
      };
      const datos = cuerpo.data?.viewer?.accounts?.[0];
      if (r.status !== 200 || (cuerpo.errors?.length ?? 0) > 0 || !datos) {
        lineas.push(
          `- ${fuente.nombre}: no se pudo leer (${cuerpo.errors?.[0]?.message ?? `HTTP ${r.status}`})`,
        );
        continue;
      }
      for (const [cuota, usado] of Object.entries(fuente.leer(datos))) {
        lineas.push(
          `- ${cuota.replaceAll('_', ' ')}: ${n(usado ?? 0)} en la semana (${n((usado ?? 0) / 7)} al día)`,
        );
      }
    } catch (e) {
      lineas.push(`- ${fuente.nombre}: no respondió (${(e as Error).message})`);
    }
  }
  return { titulo, lineas };
}

export function comoMarkdown(secciones: readonly Seccion[], fecha: string): string {
  return [
    `Reporte semanal de validación de Gestión Agro, semana que termina el ${fecha}.`,
    'Solo métricas agregadas: ningún dato de fincas ni de personas.',
    '',
    ...secciones.flatMap((s) => [`## ${s.titulo}`, '', ...s.lineas, '']),
    '## Lo que todavía no se mide',
    '',
    '- Impresiones y clics en Google (Search Console): decisión del dueño, para después.',
    '',
  ].join('\n');
}

async function principal() {
  const token = process.env['CF_METRICAS_TOKEN'] ?? '';
  const tokenD1 = process.env['CF_API_TOKEN'] ?? '';
  const cuenta = process.env['CF_ACCOUNT_ID'] ?? '';
  const ahora = Date.now();
  const config = cargarCeldas();
  const secciones: Seccion[] =
    !token || !cuenta
      ? [falla('Métricas', 'faltan los secretos CF_METRICAS_TOKEN o CF_ACCOUNT_ID')]
      : [
          await eventosDeHerramientas(fetch, token, cuenta, config.sitio.dataset_eventos),
          await eventosDeHerramientas(
            fetch,
            token,
            cuenta,
            `${config.sitio.dataset_eventos}_staging`,
          ),
          await cuentasDelCore(fetch, tokenD1, cuenta, config.core.d1, ahora),
          await cuentasDelCore(fetch, tokenD1, cuenta, `${config.core.d1}_staging`, ahora),
          await consumoDeLaNube(fetch, token, cuenta, ahora),
        ];
  const fecha = new Date(ahora).toISOString().slice(0, 10);
  const cuerpo = comoMarkdown(secciones, fecha);
  console.log(cuerpo);
  if (process.env['GH_TOKEN'] && process.env['GITHUB_REPOSITORY']) {
    execFileSync(
      'gh',
      ['issue', 'create', '--title', `Reporte semanal agro · ${fecha}`, '--body-file', '-'],
      { input: cuerpo, stdio: ['pipe', 'inherit', 'inherit'] },
    );
  }
}

if (process.argv[1]?.endsWith('reporte-semanal.ts')) await principal();
