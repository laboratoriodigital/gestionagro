/**
 * API de la celda (HU-E5.1, ARQUITECTURA §5.5 y §5.6), con Hono (ADR-12).
 *
 * - `GET /api/salud`: sin token. La usa la prueba de humo: cada shard responde y tiene las tablas
 *   de la migración. Sin configuración o con un shard caído responde 503 y dice cuál (P1).
 * - `/api/v1/*`: exige un access token del CORE (ADR-10) verificado con su clave **pública**, sin
 *   llamar al CORE. La organización, el rol y el shard salen del token, nunca del cuerpo ni de la
 *   URL (CA1): cada ruta recibe `org` y la base de su shard, y toda consulta filtra por `org_id`.
 * - Kill switch `ks:agro-cuaderno` (CA3): apagado, `/api/v1/*` responde 503 con `Retry-After`; el
 *   cuaderno sigue registrando en el teléfono. Se revisa antes del token, que cuesta más.
 *
 * Ningún identificador de cuenta, base o dominio en el código (CA4, ADR-6): la celda, los
 * shards, los orígenes del cuaderno y las claves del CORE llegan por la configuración que arma el
 * despliegue desde `celdas.json`.
 *
 * Rutas con token: `/api/v1/yo` (a qué organización y shard llegó la sesión) y
 * `/api/v1/sync/push` (subir, HU-E5.2, `push.ts`) y `/api/v1/sync/pull` (bajar, HU-E5.3, `pull.ts`).
 */
import type { BaseD1 } from '@gestionagro/d1';
import {
  crearLectorKillSwitch,
  type LectorKillSwitch,
  type LectorKv,
} from '@gestionagro/kill-switch';
import { type ClavePublica, TokenInvalido, verificarConClaves } from '@gestionagro/tokens';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { avisarSiCambio } from './avisos.ts';
import { pull } from './pull.ts';
import { push } from './push.ts';
import { clavesQr, firmarLote } from './qr.ts';
import { type KvDeFlags, resumen, vigilar } from './vigia.ts';

/** Producto cuyo kill switch apaga la sincronización (`content/agro/cuaderno/product.yaml`). */
export const PRODUCTO_SYNC = 'agro-cuaderno';
/** Tablas de la migración de un shard (infrastructure/migraciones/celda). */
export const TABLAS_DEL_SHARD = [
  'registro',
  'catalogo',
  'entidad_historial',
  'cuarentena',
] as const;
const SHARD = /^agro_c[0-9]+_s[0-9]+$/;

export interface Env {
  /** Id de esta celda (`c0`); el token debe nombrarla. */
  CELDA?: string;
  /** Claves públicas del CORE (JSON), las lee el despliegue de `/api/core/claves`. */
  CORE_CLAVES?: string;
  /** Orígenes del cuaderno, separados por coma. */
  ORIGENES_APP?: string;
  FLAGS?: LectorKv;
  /** Token de solo lectura de métricas de la cuenta (HU-E8.2), por secreto del despliegue. */
  CF_METRICAS_TOKEN?: string;
  /** Cuenta de Cloudflare cuyas cuotas se miden; la pone el despliegue. */
  CF_CUENTA?: string;
  /** Clave Ed25519 con que la celda firma los QR de trazabilidad (HU-E6.4); la genera el despliegue. */
  CELDA_QR_PRIVATE_KEY?: string;
  /** Bot y chat de Telegram del dueño (HU-E8.3), por secreto del despliegue. */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** produccion o staging: las alertas de staging llevan [staging]. */
  DESTINO?: string;
  /** Plan de la cuenta de la celda (celdas.json): el vigía conoce las cuotas del gratuito. */
  PLAN?: string;
  /** Un binding D1 por shard, con el nombre del shard. */
  [shard: string]: unknown;
}

export interface Sesion {
  org: string;
  rol: string;
  usuario: string;
  shard: string;
  db: BaseD1;
}

type Variables = { sesion: Sesion };
export type ContextoCelda = Context<{ Bindings: Env; Variables: Variables }>;

const shardsDe = (env: Env): [string, BaseD1][] =>
  Object.entries(env).filter(([nombre]) => SHARD.test(nombre)) as [string, BaseD1][];

const origenesDe = (env: Env) =>
  (env.ORIGENES_APP ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
const lectorDe = (kv: LectorKv) => {
  if (lector?.kv !== kv) lector = { kv, lector: crearLectorKillSwitch({ kv }) };
  return lector.lector;
};

function clavesDe(env: Env): ClavePublica[] {
  try {
    const claves = JSON.parse(env.CORE_CLAVES ?? '[]') as ClavePublica[];
    return Array.isArray(claves) ? claves : [];
  } catch {
    return [];
  }
}

export function crearApp(opciones: { ahora?: () => number } = {}) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.get('/api/salud', async (c) => {
    const faltan = [
      ...(c.env.CELDA ? [] : ['CELDA']),
      ...(clavesDe(c.env).length > 0 ? [] : ['CORE_CLAVES']),
      ...(origenesDe(c.env).length > 0 ? [] : ['ORIGENES_APP']),
    ];
    if (faltan.length > 0) {
      console.error(`agro-api: falta configuración: ${faltan.join(', ')}`);
      return c.json({ estado: 'sin-configurar', motivo: `Falta ${faltan.join(', ')}` }, 503);
    }
    const shards = shardsDe(c.env);
    if (shards.length === 0) {
      return c.json({ estado: 'sin-shards', motivo: 'La celda no tiene bases de shard' }, 503);
    }
    const fallas: string[] = [];
    for (const [nombre, db] of shards) {
      try {
        const fila = await db
          .prepare(
            `SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (${TABLAS_DEL_SHARD.map(() => '?').join(', ')})`,
          )
          .bind(...TABLAS_DEL_SHARD)
          .first<{ n: number }>();
        if (fila?.n !== TABLAS_DEL_SHARD.length)
          fallas.push(`${nombre}: faltan tablas de la migración`);
      } catch {
        fallas.push(`${nombre}: la base no respondió`);
      }
    }
    if (fallas.length > 0)
      return c.json({ estado: 'shard-con-falla', motivo: fallas.join('; ') }, 503);
    return c.json({ estado: 'ok', celda: c.env.CELDA, shards: shards.length });
  });

  app.get('/api/claves-qr', (c) => clavesQr(c));

  app.use(
    '/api/v1/*',
    cors({
      origin: (origen, c) => (origenesDe(c.env as Env).includes(origen) ? origen : null),
      allowMethods: ['GET', 'POST'],
      allowHeaders: ['authorization', 'content-type'],
      maxAge: 600,
    }),
  );

  app.use('/api/v1/*', async (c, siguiente) => {
    if (c.env.FLAGS && (await lectorDe(c.env.FLAGS).apagado(PRODUCTO_SYNC))) {
      c.header('retry-after', '120');
      return c.json(
        {
          estado: 'apagado',
          motivo:
            'La sincronización está en pausa. Tus registros siguen guardados en este teléfono y subirán cuando vuelva.',
        },
        503,
      );
    }
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token)
      return c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta para sincronizar.' }, 401);
    let reclamos: Awaited<ReturnType<typeof verificarConClaves>>;
    try {
      reclamos = await verificarConClaves(clavesDe(c.env), token, ahora());
    } catch (e) {
      if (!(e instanceof TokenInvalido)) throw e;
      return c.json(
        { estado: 'sin-sesion', motivo: 'La sesión venció. Se renovará sola cuando haya señal.' },
        401,
      );
    }
    if (!reclamos.org || !reclamos.shard || !reclamos.rol) {
      return c.json(
        { estado: 'sin-organizacion', motivo: 'Tu cuenta todavía no tiene una finca en la nube.' },
        403,
      );
    }
    if (reclamos.celda !== c.env.CELDA) {
      return c.json(
        {
          estado: 'otra-celda',
          motivo: 'Tu finca vive en otra celda. Vuelve a entrar para actualizar la sesión.',
        },
        409,
      );
    }
    const db = c.env[reclamos.shard] as BaseD1 | undefined;
    if (!SHARD.test(reclamos.shard) || !db) {
      console.error(
        `agro-api: el token nombra el shard ${reclamos.shard}, que esta celda no tiene`,
      );
      return c.json(
        {
          estado: 'sin-shard',
          motivo: 'La base de tu finca no está disponible. Tus registros siguen en el teléfono.',
        },
        503,
      );
    }
    c.set('sesion', {
      org: reclamos.org,
      rol: reclamos.rol,
      usuario: reclamos.sub,
      shard: reclamos.shard,
      db,
    });
    await siguiente();
    return undefined;
  });

  app.get('/api/v1/yo', async (c) => {
    const { org, rol, shard, db } = c.get('sesion');
    const fila = await db
      .prepare('SELECT count(*) AS n FROM registro WHERE org_id = ?')
      .bind(org)
      .first<{ n: number }>();
    return c.json({ org, rol, celda: c.env.CELDA, shard, registros: fila?.n ?? 0 });
  });

  app.post('/api/v1/sync/push', (c) => push(c, ahora));
  app.post('/api/v1/lotes/firmar', (c) => firmarLote(c));
  app.get('/api/v1/sync/pull', (c) => pull(c, ahora));

  // Una falla inesperada (D1 que rechaza, un error del código) se responde en JSON con su causa:
  // el teléfono la dice como es y reintenta; nunca la confunde con falta de señal (bitácora agro 23).
  app.onError((error, c) => {
    console.error('agro-api: falla inesperada:', error.message);
    c.header('retry-after', '60');
    return c.json(
      {
        estado: 'falla-celda',
        motivo: 'La nube tuvo un problema y no guardó este envío; se reintenta sola.',
      },
      503,
    );
  });

  app.notFound((c) =>
    c.json({ estado: 'no-encontrado', motivo: 'Ruta de la celda desconocida' }, 404),
  );
  return app;
}

/** Lo mínimo del contexto de un evento programado: esperar a que termine la vuelta. */
interface ContextoProgramado {
  waitUntil(promesa: Promise<unknown>): void;
}

const app = crearApp();

export default {
  fetch: app.fetch,
  /** Cron Trigger de la celda, cada hora: el vigía de cuota (HU-E8.2). */
  scheduled(_evento: unknown, env: Env, ctx: ContextoProgramado) {
    ctx.waitUntil(vueltaDelVigia(env, Date.now()));
  },
};

export async function vueltaDelVigia(env: Env, ahora: number, fetchFn: typeof fetch = fetch) {
  if (!env.FLAGS) {
    console.error('vigía: la celda no tiene el KV de flags; no puede escribir el nivel');
    return null;
  }
  const v = await vigilar(
    env.FLAGS as KvDeFlags,
    env.CF_METRICAS_TOKEN,
    env.CF_CUENTA,
    ahora,
    fetchFn,
    env.PLAN,
  );
  (v.fallas.length > 0 || v.nivel !== 'normal' ? console.error : console.log)(resumen(v));
  // Alerta al dueño por Telegram, solo si cambió lo que hay que decir (HU-E8.3).
  const aviso = await avisarSiCambio(
    env.FLAGS as KvDeFlags,
    v,
    {
      celda: env.CELDA ?? '?',
      destino: env.DESTINO ?? 'produccion',
      telegram: { token: env.TELEGRAM_BOT_TOKEN, chat: env.TELEGRAM_CHAT_ID },
    },
    fetchFn,
  );
  if (aviso.startsWith('fallo'))
    console.error(`vigía: la alerta no salió; se reintenta en la próxima vuelta. ${aviso}`);
  return { ...v, aviso };
}
