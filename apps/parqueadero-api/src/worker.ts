/**
 * API de una celda del parqueadero (HU-Q7.4, PARQUEADERO §12), con las convenciones de la celda
 * agro (`apps/api-celda`): Hono, solo `/api/*`, el token del CORE verificado con su clave pública
 * sin llamar al CORE, y el `org_id` del token en cada consulta.
 *
 * - `GET /api/salud`: sin token. La prueba de humo del despliegue: cada shard responde y tiene las
 *   tablas de la migración. Sin configuración o con un shard caído responde 503 y dice cuál (P1).
 * - `/api/v1/*`: exige un token con `aud = parqueadero`. La organización, el rol, el usuario y el
 *   shard salen del token, nunca del cuerpo ni de la URL.
 * - Kill switch `ks:parqueadero` (CA3): apagado, `/api/v1/*` responde 503 con `Retry-After`; la
 *   caja sigue registrando y cobrando sin red (HU-Q7.5). Se revisa antes del token, que cuesta más.
 *
 * Rutas con token: `/api/v1/yo` (a qué parqueadero y shard llegó la sesión), `/api/v1/sync/push`
 * (`push.ts`) y `/api/v1/sync/pull` (`pull.ts`). Ningún identificador de cuenta, base o dominio en
 * el código (ADR-6): todo llega por la configuración que arma el despliegue desde `celdas.json` y
 * `productos.json`.
 */
import type { BaseD1 } from '@ed1/d1';
import { crearLectorKillSwitch, type LectorKillSwitch, type LectorKv } from '@ed1/kill-switch';
import {
  aceptarEnProducto,
  type ClavePublica,
  TokenInvalido,
  verificarConClaves,
} from '@ed1/tokens';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { pull } from './pull.ts';
import { push } from './push.ts';

/** El producto de esta API: su kill switch es `ks:parqueadero` (`infrastructure/productos.json`). */
export const PRODUCTO = 'parqueadero';
/** Tablas de la migración 0001 del shard (`infrastructure/migraciones/parqueadero`). */
export const TABLAS_DEL_SHARD = [
  'registro',
  'catalogo',
  'entidad_historial',
  'cuarentena',
  'dispositivo',
  'purga',
] as const;
const SHARD = /^parqueadero_c[0-9]+_s[0-9]+$/;

export interface Env {
  /** Id de esta celda (`c2`); el token debe nombrarla. */
  CELDA?: string;
  /** Producto de esta celda (celdas.json): solo acepta tokens de ese producto (HU-C4.1). */
  PRODUCTO?: string;
  /** Claves públicas del CORE (JSON), las lee el despliegue de `/api/core/claves`. */
  CORE_CLAVES?: string;
  /** Orígenes de la caja, separados por coma (`productos.json`, `app.origenes`). */
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

/** Lo que la caja muestra cuando la nube no la atiende: sus recibos siguen guardados en ella. */
const EN_LA_CAJA = 'Sus recibos siguen guardados en esta caja.';

export function crearApp(opciones: { ahora?: () => number } = {}) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  app.get('/api/salud', async (c) => {
    const faltan = [
      ...(c.env.CELDA ? [] : ['CELDA']),
      ...(c.env.PRODUCTO ? [] : ['PRODUCTO']),
      ...(clavesDe(c.env).length > 0 ? [] : ['CORE_CLAVES']),
      ...(origenesDe(c.env).length > 0 ? [] : ['ORIGENES_APP']),
    ];
    if (faltan.length > 0) {
      console.error(`parqueadero-api: falta configuración: ${faltan.join(', ')}`);
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
    if (c.env.FLAGS && (await lectorDe(c.env.FLAGS).apagado(PRODUCTO))) {
      c.header('retry-after', '120');
      return c.json(
        { estado: 'apagado', motivo: `La sincronización está en pausa. ${EN_LA_CAJA}` },
        503,
      );
    }
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token)
      return c.json({ estado: 'sin-sesion', motivo: 'Entre con su cuenta para sincronizar.' }, 401);
    const producto = c.env.PRODUCTO;
    if (!producto) {
      console.error('parqueadero-api: la celda no sabe de qué producto es (falta PRODUCTO)');
      return c.json({ estado: 'falla-celda', motivo: `La nube no está lista. ${EN_LA_CAJA}` }, 503);
    }
    let reclamos: ReturnType<typeof aceptarEnProducto>;
    try {
      reclamos = aceptarEnProducto(
        await verificarConClaves(clavesDe(c.env), token, ahora()),
        producto,
      );
    } catch (e) {
      if (!(e instanceof TokenInvalido)) throw e;
      return c.json(
        { estado: 'sin-sesion', motivo: 'La sesión venció. Se renovará sola cuando haya señal.' },
        401,
      );
    }
    if (!reclamos.org || !reclamos.shard || !reclamos.rol) {
      return c.json(
        {
          estado: 'sin-organizacion',
          motivo: 'Su cuenta todavía no tiene un parqueadero en la nube.',
        },
        403,
      );
    }
    if (reclamos.celda !== c.env.CELDA) {
      return c.json(
        {
          estado: 'otra-celda',
          motivo: 'Su parqueadero vive en otra celda. Vuelva a entrar para actualizar la sesión.',
        },
        409,
      );
    }
    const db = c.env[reclamos.shard] as BaseD1 | undefined;
    if (!SHARD.test(reclamos.shard) || !db) {
      console.error(
        `parqueadero-api: el token nombra el shard ${reclamos.shard}, que esta celda no tiene`,
      );
      return c.json(
        {
          estado: 'sin-shard',
          motivo: `La base de su parqueadero no está disponible. ${EN_LA_CAJA}`,
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
  app.get('/api/v1/sync/pull', (c) => pull(c));

  // Una falla inesperada se responde en JSON con su causa: la caja la dice como es y reintenta, y
  // nunca la confunde con falta de señal (bitácora agro 23).
  app.onError((error, c) => {
    console.error('parqueadero-api: falla inesperada:', error.message);
    c.header('retry-after', '60');
    return c.json(
      {
        estado: 'falla-celda',
        motivo: `La nube tuvo un problema y no guardó este envío; se reintenta sola. ${EN_LA_CAJA}`,
      },
      503,
    );
  });

  app.notFound((c) =>
    c.json({ estado: 'no-encontrado', motivo: 'Ruta de la celda desconocida' }, 404),
  );
  return app;
}

export default { fetch: crearApp().fetch };
