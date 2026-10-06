/**
 * Vigía de cuota de la celda (HU-E8.2, ARQUITECTURA §8.2). Corre cada hora con el Cron Trigger de
 * la celda.
 *
 * 1. Lee el consumo de **toda la cuenta** en la API de métricas de Cloudflare (GraphQL), no un
 *    contador propio (CA3, P7): Workers, D1, KV y R2. Una consulta por producto, para que una
 *    falla diga qué no se pudo leer.
 * 2. Calcula el % de cada cuota del plan (diarias desde las 00:00 UTC, que es cuando se reinician;
 *    las de R2 son mensuales) y el nivel con los umbrales de §8.2.
 * 3. Escribe la clave `nivel` del KV de flags **solo si cambió** (CA2): como mucho 24 escrituras al
 *    día de las 1.000 que da KV gratuito.
 *
 * Si no puede leer una fuente, no lo toma como «normal» (CA3, P1): el nivel es al menos «alerta»,
 * y nunca baja uno más alto que ya estaba, porque no sabe si el consumo bajó.
 *
 * Con Workers Paid (`plan: paid`, HU-C11.1) no hay niveles que bajar: mide el mes, proyecta el costo
 * y apaga lo que el producto declare al agotar su presupuesto (`vigia-pago.ts`).
 */
import { APAGADO, type LectorKv } from '@ed1/kill-switch';
import { type DecisionDePago, decidirConPago, type Presupuesto } from './vigia-pago.ts';

export const NIVELES = ['normal', 'alerta', 'ahorro', 'esencial', 'bloqueo'] as const;
export type NivelDeCelda = (typeof NIVELES)[number];
export const CLAVE_NIVEL = 'nivel';

/** Umbrales de ARQUITECTURA §8.2, sobre la cuota más usada. */
export function nivelPorUso(porcentaje: number): NivelDeCelda {
  if (porcentaje >= 100) return 'bloqueo';
  if (porcentaje >= 90) return 'esencial';
  if (porcentaje >= 75) return 'ahorro';
  if (porcentaje >= 60) return 'alerta';
  return 'normal';
}

const rango = (n: NivelDeCelda) => NIVELES.indexOf(n);
const elMayor = (a: NivelDeCelda, b: NivelDeCelda) => (rango(a) >= rango(b) ? a : b);

/**
 * Cuotas del plan gratuito de Workers (ED1 §41, verificadas el 30 sep 2026; ARQUITECTURA §6.2).
 * Analytics Engine (eventos de herramientas) no tiene métrica en GraphQL por cuenta: queda fuera,
 * y se dice aquí para que nadie crea que se mide.
 */
export const CUOTAS_GRATUITAS = {
  workers_solicitudes: { limite: 100_000, periodo: 'dia', nombre: 'solicitudes a Workers' },
  d1_filas_leidas: { limite: 5_000_000, periodo: 'dia', nombre: 'filas leídas de D1' },
  d1_filas_escritas: { limite: 100_000, periodo: 'dia', nombre: 'filas escritas en D1' },
  kv_lecturas: { limite: 100_000, periodo: 'dia', nombre: 'lecturas de KV' },
  kv_escrituras: { limite: 1_000, periodo: 'dia', nombre: 'escrituras de KV' },
  r2_clase_a: { limite: 1_000_000, periodo: 'mes', nombre: 'operaciones clase A de R2' },
  r2_clase_b: { limite: 10_000_000, periodo: 'mes', nombre: 'operaciones clase B de R2' },
} as const;
export type Cuota = keyof typeof CUOTAS_GRATUITAS;

/** Operaciones de R2 de clase A (escrituras y listados); las demás que cobran son de clase B. */
const R2_CLASE_A = new Set([
  'ListBuckets',
  'PutBucket',
  'ListObjects',
  'PutObject',
  'CopyObject',
  'CompleteMultipartUpload',
  'CreateMultipartUpload',
  'UploadPart',
  'UploadPartCopy',
  'ListMultipartUploads',
  'PutBucketEncryption',
  'PutBucketCors',
  'PutBucketLifecycleConfiguration',
]);
/** Operaciones de R2 que no cobran. */
const R2_GRATIS = new Set(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload']);

type Fetch = typeof fetch;
const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

interface Fuente {
  nombre: string;
  consulta: string;
  /** Del `accounts[0]` de la respuesta, el uso de cada cuota que cubre. */
  leer: (cuenta: Record<string, unknown>) => Partial<Record<Cuota, number>>;
  /** Desde cuándo cuenta: el día o el mes. */
  periodo: 'dia' | 'mes';
}

const suma = (filas: unknown, campo: string): number =>
  (Array.isArray(filas) ? filas : []).reduce(
    (s: number, f: { sum?: Record<string, number> }) => s + (f.sum?.[campo] ?? 0),
    0,
  );

const porAccion = (filas: unknown, incluir: (accion: string) => boolean): number =>
  (Array.isArray(filas) ? filas : []).reduce(
    (s: number, f: { sum?: { requests?: number }; dimensions?: { actionType?: string } }) =>
      incluir(f.dimensions?.actionType ?? '') ? s + (f.sum?.requests ?? 0) : s,
    0,
  );

const consulta = (campo: string, filtro: string, pedir: string) =>
  `query ($cuenta: string!, $desde: Time!, $hasta: Time!) {
  viewer { accounts(filter: { accountTag: $cuenta }) {
    ${campo}(limit: 10000, filter: { ${filtro} }) { ${pedir} }
  } }
}`;

const PORVENTANA = 'datetime_geq: $desde, datetime_lt: $hasta';

export const FUENTES: readonly Fuente[] = [
  {
    nombre: 'Workers',
    periodo: 'dia',
    consulta: consulta('workersInvocationsAdaptive', PORVENTANA, 'sum { requests }'),
    leer: (c) => ({ workers_solicitudes: suma(c['workersInvocationsAdaptive'], 'requests') }),
  },
  {
    nombre: 'D1',
    periodo: 'dia',
    consulta: consulta('d1AnalyticsAdaptiveGroups', PORVENTANA, 'sum { rowsRead rowsWritten }'),
    leer: (c) => ({
      d1_filas_leidas: suma(c['d1AnalyticsAdaptiveGroups'], 'rowsRead'),
      d1_filas_escritas: suma(c['d1AnalyticsAdaptiveGroups'], 'rowsWritten'),
    }),
  },
  {
    nombre: 'KV',
    periodo: 'dia',
    consulta: consulta(
      'kvOperationsAdaptiveGroups',
      PORVENTANA,
      'sum { requests } dimensions { actionType }',
    ),
    leer: (c) => {
      const filas = c['kvOperationsAdaptiveGroups'];
      // Escribir, borrar y listar tienen 1.000 al día cada uno: cuenta el que más se usó.
      const escrituras = Math.max(
        porAccion(filas, (a) => a === 'write'),
        porAccion(filas, (a) => a === 'delete'),
        porAccion(filas, (a) => a === 'list'),
      );
      return { kv_lecturas: porAccion(filas, (a) => a === 'read'), kv_escrituras: escrituras };
    },
  },
  {
    nombre: 'R2',
    periodo: 'mes',
    consulta: consulta(
      'r2OperationsAdaptiveGroups',
      PORVENTANA,
      'sum { requests } dimensions { actionType }',
    ),
    leer: (c) => {
      const filas = c['r2OperationsAdaptiveGroups'];
      return {
        r2_clase_a: porAccion(filas, (a) => R2_CLASE_A.has(a)),
        r2_clase_b: porAccion(filas, (a) => !R2_CLASE_A.has(a) && !R2_GRATIS.has(a)),
      };
    },
  },
];

/** Las 00:00 UTC de hoy y el día 1 del mes, en UTC: cuando se reinicia cada cuota. */
export function ventanas(ahora: number): { dia: string; mes: string; hasta: string } {
  const d = new Date(ahora);
  return {
    dia: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString(),
    mes: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(),
    hasta: d.toISOString(),
  };
}

export interface Medicion {
  /** % de cada cuota diaria del plan gratuito que se pudo leer; vacío con Workers Paid. */
  uso: Partial<Record<Cuota, number>>;
  /** Lo consumido de cada cuota en su ventana (con Workers Paid, todo en el mes). */
  consumo: Partial<Record<Cuota, number>>;
  /** Fuentes que no se pudieron leer, con el motivo. */
  fallas: string[];
}

export async function medir(
  fetchFn: Fetch,
  token: string | undefined,
  cuenta: string | undefined,
  ahora: number,
  plan = 'free',
): Promise<Medicion> {
  // Se conocen las cuotas del gratuito y de Workers Paid; con otro plan, medir mentiría (P1).
  if (plan !== 'free' && plan !== 'paid') {
    return {
      uso: {},
      consumo: {},
      fallas: [`las cuotas del plan «${plan}» no están definidas en el vigía`],
    };
  }
  if (!token || !cuenta) {
    return {
      uso: {},
      consumo: {},
      fallas: ['falta el token de métricas o la cuenta (CF_METRICAS_TOKEN, CF_CUENTA)'],
    };
  }
  const v = ventanas(ahora);
  const uso: Partial<Record<Cuota, number>> = {};
  const consumo: Partial<Record<Cuota, number>> = {};
  const fallas: string[] = [];
  for (const fuente of FUENTES) {
    try {
      const r = await fetchFn(GRAPHQL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: fuente.consulta,
          variables: {
            cuenta,
            // Con Workers Paid todo se factura por mes.
            desde: fuente.periodo === 'mes' || plan === 'paid' ? v.mes : v.dia,
            hasta: v.hasta,
          },
        }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as {
        data?: { viewer?: { accounts?: Record<string, unknown>[] } };
        errors?: { message?: string }[] | null;
      };
      const datos = cuerpo.data?.viewer?.accounts?.[0];
      if (r.status !== 200 || (cuerpo.errors?.length ?? 0) > 0 || !datos) {
        const motivo =
          cuerpo.errors?.map((e) => e.message).join('; ') ||
          (r.status === 200 ? 'la cuenta no aparece en la respuesta' : `HTTP ${r.status}`);
        fallas.push(`${fuente.nombre}: ${motivo}`);
        continue;
      }
      for (const [cuota, usado] of Object.entries(fuente.leer(datos)) as [Cuota, number][]) {
        consumo[cuota] = usado;
        if (plan === 'free') {
          uso[cuota] = Math.round((usado / CUOTAS_GRATUITAS[cuota].limite) * 1000) / 10;
        }
      }
    } catch (e) {
      fallas.push(`${fuente.nombre}: no respondió (${(e as Error).message})`);
    }
  }
  return { uso, consumo, fallas };
}

/** El nivel que corresponde: por la cuota más usada; con fallas, al menos «alerta» y sin bajar. */
export function decidirNivel(m: Medicion, actual: NivelDeCelda): NivelDeCelda {
  const maximo = Math.max(0, ...Object.values(m.uso));
  const medido = nivelPorUso(maximo);
  if (m.fallas.length === 0) return medido;
  return elMayor(elMayor(medido, 'alerta'), actual);
}

export interface KvDeFlags extends LectorKv {
  put(clave: string, valor: string): Promise<void>;
}

export interface Vigilancia extends Medicion {
  antes: NivelDeCelda;
  nivel: NivelDeCelda;
  escrito: boolean;
  /** Con Workers Paid: la proyección, el aviso y lo que se apagó en esta vuelta. */
  pago?: DecisionDePago & { apagadas: string[] };
}

/** Una vuelta del vigía: mide, decide y escribe el nivel solo si cambió. */
export async function vigilar(
  kv: KvDeFlags,
  token: string | undefined,
  cuenta: string | undefined,
  ahora: number,
  fetchFn: Fetch = fetch,
  plan = 'free',
  presupuesto: Presupuesto | null = null,
): Promise<Vigilancia> {
  const guardado = await kv.get(CLAVE_NIVEL);
  const antes = (NIVELES as readonly string[]).includes(guardado ?? '')
    ? (guardado as NivelDeCelda)
    : 'normal';
  const medicion = await medir(fetchFn, token, cuenta, ahora, plan);
  const nivel = decidirNivel(medicion, antes);
  const escrito = nivel !== antes;
  if (escrito) await kv.put(CLAVE_NIVEL, nivel);
  if (plan !== 'paid') return { ...medicion, antes, nivel, escrito };
  // Con fallas no se apaga nada: no se sabe cuánto se gastó (se avisa, P1).
  const decision = decidirConPago(
    medicion.consumo,
    ahora,
    medicion.fallas.length > 0 ? null : presupuesto,
  );
  const apagadas: string[] = [];
  for (const clave of decision.apagar) {
    if ((await kv.get(clave))?.trim().toLowerCase() === APAGADO) continue;
    await kv.put(clave, APAGADO);
    apagadas.push(clave);
  }
  return { ...medicion, antes, nivel, escrito, pago: { ...decision, apagadas } };
}

/** El resumen para el log de la celda: qué midió, qué decidió y qué no pudo leer. */
export function resumen(v: Vigilancia): string {
  const pago = v.pago
    ? `mes proyectado USD ${v.pago.usdProyectado}, ${v.pago.escalon} % de lo incluido${v.pago.apagadas.length > 0 ? `, apagado: ${v.pago.apagadas.join(', ')}` : ''}. `
    : '';
  const uso = Object.entries(v.uso)
    .map(([c, p]) => `${CUOTAS_GRATUITAS[c as Cuota].nombre} ${p} %`)
    .join(', ');
  const cambio = v.escrito ? `${v.antes} → ${v.nivel}` : `${v.nivel} (sin cambio)`;
  const fallas = v.fallas.length > 0 ? `. No se pudo leer: ${v.fallas.join(' | ')}` : '';
  return `vigía: nivel ${cambio}. ${pago}${uso || (pago ? '' : 'sin mediciones')}${fallas}`;
}
