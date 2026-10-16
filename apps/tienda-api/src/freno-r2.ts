/**
 * El freno de R2 (bitácora tienda3 27). En el plan gratuito, D1, KV y Workers se detienen al
 * agotarse; R2 no: pasado lo gratis cobra a la tarjeta del dueño. La cuenta es una sola para todos
 * los productos y R2 lo usa casi solo la Tienda (sitios horneados, fotos y respaldos), así que la
 * Tienda se frena a sí misma, cada hora, con el cron de producción:
 *
 * 1. Mide en la API GraphQL de métricas lo de **toda la cuenta**: el espacio guardado (el mayor de
 *    las últimas 24 horas, sumando los buckets) y las operaciones de clase A y B del mes.
 * 2. Desde el 75 % de cualquiera avisa por Telegram, una vez por escalón.
 * 3. Desde el 90 % del espacio o de la clase A apaga `ks:tienda-horno` (publicar escribe en R2) y
 *    `ks:tienda-fotos` (cada foto ocupa espacio), y anota cuáles apagó él. La venta, los cobros y
 *    la vitrina siguen: nunca se apagan solos.
 * 4. Por debajo del 80 % vuelve a encender solo las que apagó él y que siguen apagadas; si el dueño
 *    cambió una a mano, no la toca. Las operaciones se reinician el día 1 de cada mes.
 *
 * La clase B (leer) la gasta la vitrina al servir las páginas: apagar escrituras no la baja, así
 * que solo avisa. Si no puede medir, no lo toma como «todo bien» (P1): no apaga ni enciende nada y
 * la tarea queda en falla, que `/api/salud` muestra.
 */
import { APAGADO, ENCENDIDO } from '@ed1/kill-switch';
import { enviarTelegram } from '@ed1/telegram';
import type { KvDeTareas, Tarea } from './tareas.ts';

/** Lo gratis de R2 al mes (verificado el 16 oct 2026). Un GB de Cloudflare son 10⁹ bytes. */
export const LIMITES_R2 = {
  espacio: { limite: 10_000_000_000, nombre: 'espacio guardado' },
  clase_a: { limite: 1_000_000, nombre: 'escrituras (clase A)' },
  clase_b: { limite: 10_000_000, nombre: 'lecturas (clase B)' },
} as const;
export type CuotaR2 = keyof typeof LIMITES_R2;

export const AVISAR_DESDE = 75;
export const FRENAR_DESDE = 90;
export const SOLTAR_BAJO = 80;
/** Lo que el freno apaga: lo que escribe en R2, nunca lo que vende. */
export const LO_QUE_FRENA = ['ks:tienda-horno', 'ks:tienda-fotos'] as const;
export const CLAVE_DEL_FRENO = 'freno:r2';

/** Operaciones de R2 de clase A (las de `apps/api-celda/src/vigia.ts`; una prueba las compara). */
export const R2_CLASE_A = new Set([
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
export const R2_GRATIS = new Set(['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload']);

const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
const DIA_MS = 24 * 60 * 60 * 1000;

const consulta = (campo: string, pedir: string) =>
  `query ($cuenta: string!, $desde: Time!, $hasta: Time!) {
  viewer { accounts(filter: { accountTag: $cuenta }) {
    ${campo}(limit: 10000, filter: { datetime_geq: $desde, datetime_lt: $hasta }) { ${pedir} }
  } }
}`;

interface Fuente {
  nombre: string;
  consulta: string;
  /** Desde cuándo cuenta, a partir del instante de la corrida. */
  desde: (instante: number) => string;
  leer: (cuenta: Record<string, unknown>) => Partial<Record<CuotaR2, number>>;
}

type Fila = {
  sum?: { requests?: number };
  max?: { payloadSize?: number; metadataSize?: number };
  dimensions?: { actionType?: string; bucketName?: string };
};
const filas = (x: unknown): Fila[] => (Array.isArray(x) ? (x as Fila[]) : []);
const porAccion = (x: unknown, incluir: (accion: string) => boolean) =>
  filas(x).reduce(
    (s, f) => (incluir(f.dimensions?.actionType ?? '') ? s + (f.sum?.requests ?? 0) : s),
    0,
  );

/** El día 1 del mes en UTC: cuando se reinician las operaciones. */
const inicioDelMes = (instante: number) => {
  const d = new Date(instante);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
};

export const FUENTES_R2: readonly Fuente[] = [
  {
    nombre: 'operaciones',
    desde: inicioDelMes,
    consulta: consulta('r2OperationsAdaptiveGroups', 'sum { requests } dimensions { actionType }'),
    leer: (c) => {
      const f = c['r2OperationsAdaptiveGroups'];
      return {
        clase_a: porAccion(f, (a) => R2_CLASE_A.has(a)),
        clase_b: porAccion(f, (a) => !R2_CLASE_A.has(a) && !R2_GRATIS.has(a)),
      };
    },
  },
  {
    nombre: 'espacio',
    desde: (instante) => new Date(instante - DIA_MS).toISOString(),
    consulta: consulta(
      'r2StorageAdaptiveGroups',
      'max { payloadSize metadataSize } dimensions { bucketName }',
    ),
    leer: (c) => {
      // El mayor de cada bucket en la ventana, sumados.
      const deCada = new Map<string, number>();
      for (const f of filas(c['r2StorageAdaptiveGroups'])) {
        const b = f.dimensions?.bucketName ?? '?';
        const bytes = (f.max?.payloadSize ?? 0) + (f.max?.metadataSize ?? 0);
        deCada.set(b, Math.max(deCada.get(b) ?? 0, bytes));
      }
      return { espacio: [...deCada.values()].reduce((s, n) => s + n, 0) };
    },
  },
];

export interface MedicionR2 {
  /** % de lo gratis de cada cuota que se pudo leer, con un decimal. */
  uso: Partial<Record<CuotaR2, number>>;
  fallas: string[];
}

export async function medirR2(
  fetchFn: typeof fetch,
  token: string | undefined,
  cuenta: string | undefined,
  instante: number,
): Promise<MedicionR2> {
  if (!token || !cuenta) {
    return {
      uso: {},
      fallas: ['falta el token de métricas o la cuenta (CF_METRICAS_TOKEN, CF_CUENTA)'],
    };
  }
  const uso: Partial<Record<CuotaR2, number>> = {};
  const fallas: string[] = [];
  const hasta = new Date(instante).toISOString();
  for (const fuente of FUENTES_R2) {
    try {
      const r = await fetchFn(GRAPHQL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          query: fuente.consulta,
          variables: { cuenta, desde: fuente.desde(instante), hasta },
        }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as {
        data?: { viewer?: { accounts?: Record<string, unknown>[] } };
        errors?: { message?: string }[] | null;
      };
      const datos = cuerpo.data?.viewer?.accounts?.[0];
      if (r.status !== 200 || (cuerpo.errors?.length ?? 0) > 0 || !datos) {
        fallas.push(
          `${fuente.nombre}: ${
            cuerpo.errors?.map((e) => e.message).join('; ') ||
            (r.status === 200 ? 'la cuenta no aparece en la respuesta' : `HTTP ${r.status}`)
          }`,
        );
        continue;
      }
      for (const [cuota, usado] of Object.entries(fuente.leer(datos)) as [CuotaR2, number][]) {
        uso[cuota] = Math.round((usado / LIMITES_R2[cuota].limite) * 1000) / 10;
      }
    } catch (e) {
      fallas.push(`${fuente.nombre}: no respondió (${(e as Error).message})`);
    }
  }
  return { uso, fallas };
}

/** Lo que el freno recuerda entre corridas: el último escalón avisado y lo que apagó él. */
export interface EstadoDelFreno {
  escalon: 0 | typeof AVISAR_DESDE | typeof FRENAR_DESDE;
  apagadas: string[];
}

const escalonDe = (p: number): EstadoDelFreno['escalon'] =>
  p >= FRENAR_DESDE ? FRENAR_DESDE : p >= AVISAR_DESDE ? AVISAR_DESDE : 0;

const describir = (uso: MedicionR2['uso']) =>
  (Object.keys(LIMITES_R2) as CuotaR2[])
    .filter((c) => uso[c] !== undefined)
    .map((c) => `${LIMITES_R2[c].nombre} ${uso[c]} %`)
    .join(', ');

/** Una vuelta del freno con lo medido: apaga, enciende o avisa, y devuelve el resumen. */
export async function frenar(
  flags: KvDeTareas,
  m: MedicionR2,
  avisar: (texto: string) => Promise<void>,
): Promise<string> {
  const texto = await flags.get(CLAVE_DEL_FRENO);
  const antes: EstadoDelFreno = texto
    ? (JSON.parse(texto) as EstadoDelFreno)
    : { escalon: 0, apagadas: [] };
  const ahora: EstadoDelFreno = { escalon: antes.escalon, apagadas: [...antes.apagadas] };
  const frena = Math.max(0, m.uso.espacio ?? 0, m.uso.clase_a ?? 0);
  // Encender a ciegas es peor que dejar apagado: sin las dos cuotas que frenan, no se suelta.
  const midioLoQueFrena = m.uso.espacio !== undefined && m.uso.clase_a !== undefined;
  const apagadas: string[] = [];
  const encendidas: string[] = [];
  if (frena >= FRENAR_DESDE) {
    for (const clave of LO_QUE_FRENA) {
      if ((await flags.get(clave))?.trim().toLowerCase() === APAGADO) continue;
      await flags.put(clave, APAGADO);
      apagadas.push(clave);
    }
    ahora.apagadas = [...new Set([...ahora.apagadas, ...apagadas])];
  } else if (midioLoQueFrena && frena < SOLTAR_BAJO && ahora.apagadas.length > 0) {
    for (const clave of ahora.apagadas) {
      if ((await flags.get(clave))?.trim().toLowerCase() !== APAGADO) continue;
      await flags.put(clave, ENCENDIDO);
      encendidas.push(clave);
    }
    ahora.apagadas = [];
  }
  const maximo = Math.max(0, ...Object.values(m.uso));
  const escalon = escalonDe(maximo);
  const subio = escalon > antes.escalon;
  // Si bajó (otro mes, o se purgó), se anota para volver a avisar cuando suba.
  if (m.fallas.length === 0 || subio) ahora.escalon = escalon;

  const uso = describir(m.uso);
  if (subio || apagadas.length > 0 || encendidas.length > 0) {
    const lineas = [`Tienda · R2 de la cuenta: ${uso}.`];
    if (apagadas.length > 0)
      lineas.push(
        `Apagué ${apagadas.join(' y ')} para que R2 no empiece a cobrar a la tarjeta: no se publica ni se suben fotos. La venta y los cobros siguen. Se encienden solos por debajo del ${SOLTAR_BAJO} %.`,
      );
    else if (subio && escalon === AVISAR_DESDE)
      lineas.push(
        `Pasó el ${AVISAR_DESDE} % de lo gratis. Al ${FRENAR_DESDE} % del espacio o de las escrituras apago publicar y subir fotos.`,
      );
    if (subio && (m.uso.clase_b ?? 0) >= AVISAR_DESDE)
      lineas.push(
        'Las lecturas las hace la vitrina al servir las páginas: apagar no las baja. Lo que las baja es la caché de Cloudflare (bitácora tienda3 27).',
      );
    if (encendidas.length > 0) lineas.push(`Encendí otra vez ${encendidas.join(' y ')}.`);
    await avisar(lineas.join('\n'));
  }
  if (JSON.stringify(ahora) !== JSON.stringify(antes))
    await flags.put(CLAVE_DEL_FRENO, JSON.stringify(ahora));

  const hecho = [
    `R2: ${uso || 'sin medir'}`,
    ...(apagadas.length > 0 ? [`apagado: ${apagadas.join(', ')}`] : []),
    ...(encendidas.length > 0 ? [`encendido otra vez: ${encendidas.join(', ')}`] : []),
  ].join('; ');
  if (m.fallas.length > 0) throw new Error(`${hecho}. No se pudo leer: ${m.fallas.join(' | ')}`);
  return hecho;
}

/** Cada hora, en producción: el freno de R2 de toda la cuenta. */
export const FRENO_R2: Tarea = {
  nombre: 'freno-r2',
  frecuencia: 'hora',
  async correr(e, instante) {
    const m = await medirR2(e.fetch ?? fetch, e.metricas?.token, e.metricas?.cuenta, instante);
    return frenar(e.flags, m, async (texto) => {
      const aviso = await enviarTelegram(e.telegram, texto, e.fetch);
      if (aviso) console.error(`tienda-api: no se pudo avisar por Telegram (${aviso})`);
    });
  },
};
