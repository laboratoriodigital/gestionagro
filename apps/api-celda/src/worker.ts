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
 * Hoy `/api/v1/yo` es la única ruta con token: dice a qué organización y shard llegó la sesión.
 * Subir (HU-E5.2) y bajar (HU-E5.3) se montan sobre este mismo middleware.
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

  app.notFound((c) =>
    c.json({ estado: 'no-encontrado', motivo: 'Ruta de la celda desconocida' }, 404),
  );
  return app;
}

export default crearApp();
