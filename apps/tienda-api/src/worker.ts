/**
 * API de una celda de la Tienda 3.0 (HU-T2.4, TIENDA-3.0 §3.1, §13 y §14.1).
 *
 * No tiene rutas ni workers.dev (`wrangler.c1.jsonc`, generado): solo se llega a ella por los
 * bindings de servicio del despacho (`tienda-sitio`) y del panel (`tienda-panel`). Además, cada
 * solicitud trae en `x-despacho` el secreto que comparten esos Workers (`SECRETO_DESPACHO`): sin él,
 * o con otro, la API responde 404, como si no existiera. Así la cabecera `x-tienda`, con la tienda
 * que resolvió el despacho por el `Host`, es confiable: nadie de afuera puede escribirla, porque el
 * despacho y el panel borran la que llega de afuera antes de pasar la solicitud.
 *
 * - `GET /api/salud`: la prueba de humo del despliegue, por el panel. Cada shard y la base de
 *   control responden con las tablas de su migración; dice si la llave maestra (KEK) está y se
 *   puede leer, nunca su valor. Sin configuración o con una base caída responde 503 y dice cuál (P1).
 * - `/api/panel/v1/*` (HU-T2.8, TIENDA §12.1 y §13.3): exige un token del CORE con `aud = tienda`,
 *   verificado con sus claves públicas sin llamarlo (ADR-10). La organización, el rol, el plan, la
 *   entrada reciente (`auth_time`) y el shard salen del token, nunca del cuerpo ni de la URL. Un token
 *   de otro producto, vencido o de otra celda responde 401 o 403 con un motivo que el panel muestra.
 *   `GET /api/panel/v1/yo`: a qué tienda llegó la sesión.
 * - Kill switch `ks:tienda` (HU-T2.7, TIENDA §15.2): apagado, la API queda en solo lectura. Lo que
 *   escribe responde 503 con `Retry-After`; lo que lee sigue. Caché de 60 s (`@ed1/kill-switch`, P7).
 *
 * Ningún identificador de cuenta, base o dominio en el código (ADR-6): llega por la configuración
 * que arma el despliegue desde `celdas.json`.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { crearLectorKillSwitch, type LectorKillSwitch, type LectorKv } from '@ed1/kill-switch';
import {
  aceptarEnProducto,
  type ClavePublica,
  TokenInvalido,
  verificarConClaves,
} from '@ed1/tokens';
import { type Context, Hono } from 'hono';

export const CABECERA_DESPACHO = 'x-despacho';
export const CABECERA_TIENDA = 'x-tienda';
/** El secreto de la KEK vigente (TIENDA §14.2). La versión sube cuando se rota. */
export const SECRETO_KEK = 'TIENDA_KEK_V1';

/** Tablas que prueban que cada base tiene su migración 0001 (`infrastructure/migraciones/tienda*`). */
export const TABLAS_DEL_SHARD = ['tienda', 'producto', 'variante', 'pedido', 'cobro'] as const;
export const TABLAS_DE_CONTROL = ['slug', 'slug_reservado', 'dominio'] as const;
const SHARD = /^tienda_c[0-9]+_s[0-9]+$/;
const CONTROL = 'tienda_control';

export interface Env {
  CELDA?: string;
  PRODUCTO?: string;
  PLAN?: string;
  SECRETO_DESPACHO?: string;
  TIENDA_KEK_V1?: string;
  /** El KV de flags de la celda, con los kill switches del producto. */
  FLAGS?: LectorKv;
  /** Claves públicas del CORE (JSON): las lee el despliegue de `/api/core/claves`. */
  CORE_CLAVES?: string;
  /** Un binding D1 por shard, con el nombre del shard, y `tienda_control`. */
  [base: string]: unknown;
}

/** Compara sin cortar en la primera diferencia: el tiempo no dice cuánto del secreto acertó. */
export function mismoSecreto(a: string, b: string): boolean {
  const ca = new TextEncoder().encode(a);
  const cb = new TextEncoder().encode(b);
  let diferencia = ca.length ^ cb.length;
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
    diferencia |= (ca[i] ?? 0) ^ (cb[i] ?? 0);
  }
  return diferencia === 0;
}

/** La KEK: 32 bytes en base64. `ilegible` si no lo son; el valor nunca sale de aquí. */
export async function estadoDeLaKek(
  texto: string | undefined,
): Promise<'ok' | 'falta' | 'ilegible'> {
  if (!texto) return 'falta';
  try {
    const binario = atob(texto.trim());
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    await importarKek('v1', bytes);
    return 'ok';
  } catch {
    return 'ilegible';
  }
}

async function faltanTablas(db: BaseD1, tablas: readonly string[]): Promise<boolean> {
  const fila = await db
    .prepare(
      `SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN (${tablas.map(() => '?').join(', ')})`,
    )
    .bind(...tablas)
    .first<{ n: number }>();
  return fila?.n !== tablas.length;
}

const NO_EXISTE = { estado: 'no-existe' } as const;

/** La sesión del panel: todo sale del token del CORE (TIENDA §12.1). */
export interface Sesion {
  usuario: string;
  org: string;
  rol: string;
  plan: string;
  /** Instante (s) de la última entrada con Google: lo que mueve dinero pide una reciente. */
  authTime: number | null;
  shard: string;
  db: BaseD1;
}
type Variables = { sesion: Sesion };
export type ContextoTienda = Context<{ Bindings: Env; Variables: Variables }>;

function clavesDe(env: Env): ClavePublica[] {
  try {
    const claves = JSON.parse(env.CORE_CLAVES ?? '[]') as ClavePublica[];
    return Array.isArray(claves) ? claves : [];
  } catch {
    return [];
  }
}

const VUELVE_A_ENTRAR = 'Tu sesión venció o no es de la tienda. Vuelve a entrar.';
const LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
const lectorDe = (kv: LectorKv) => {
  if (lector?.kv !== kv) lector = { kv, lector: crearLectorKillSwitch({ kv }) };
  return lector.lector;
};

export function crearApp(opciones: { ahora?: () => number } = {}) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();

  // Solo el despacho y el panel: sin el secreto, la API no existe (TIENDA §14.1).
  app.use('*', async (c, siguiente) => {
    const secreto = c.env.SECRETO_DESPACHO;
    const dado = c.req.header(CABECERA_DESPACHO);
    if (!secreto || !dado || !mismoSecreto(secreto, dado)) return c.json(NO_EXISTE, 404);
    return siguiente();
  });

  // ks:tienda apagado: solo lectura. Se revisa después del secreto, que es más barato.
  app.use('*', async (c, siguiente) => {
    if (
      !LECTURA.has(c.req.method) &&
      c.env.FLAGS &&
      (await lectorDe(c.env.FLAGS).apagado('tienda'))
    ) {
      c.header('retry-after', '120');
      return c.json(
        {
          estado: 'apagado',
          motivo:
            'La tienda está en pausa por unos minutos: puedes ver todo, pero no cambiar nada.',
        },
        503,
      );
    }
    return siguiente();
  });

  app.get('/api/salud', async (c) => {
    const faltan = [...(c.env.CELDA ? [] : ['CELDA']), ...(c.env.PRODUCTO ? [] : ['PRODUCTO'])];
    if (faltan.length > 0) {
      return c.json({ estado: 'sin-configurar', motivo: `Falta ${faltan.join(', ')}` }, 503);
    }
    const shards = Object.entries(c.env).filter(([nombre, base]) => SHARD.test(nombre) && base) as [
      string,
      BaseD1,
    ][];
    const control = c.env[CONTROL] as BaseD1 | undefined;
    const fallas: string[] = [];
    if (shards.length === 0) fallas.push('la celda no tiene bases de shard');
    if (!control) fallas.push(`falta la base ${CONTROL}`);
    for (const [nombre, db, tablas] of [
      ...shards.map(([n, base]) => [n, base, TABLAS_DEL_SHARD] as const),
      ...(control ? [[CONTROL, control, TABLAS_DE_CONTROL] as const] : []),
    ]) {
      try {
        if (await faltanTablas(db, tablas)) fallas.push(`${nombre}: faltan tablas de la migración`);
      } catch {
        fallas.push(`${nombre}: la base no respondió`);
      }
    }
    if (fallas.length > 0)
      return c.json({ estado: 'base-con-falla', motivo: fallas.join('; ') }, 503);
    return c.json({
      estado: 'ok',
      celda: c.env.CELDA,
      shards: shards.length,
      control: true,
      kek: await estadoDeLaKek(c.env.TIENDA_KEK_V1),
    });
  });

  // HU-T2.8: el panel, con el token del CORE. Nada del cuerpo ni de la URL dice de qué tienda es.
  app.use('/api/panel/v1/*', async (c, siguiente) => {
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta.' }, 401);
    const producto = c.env.PRODUCTO;
    if (!producto || !c.env.CELDA) {
      console.error('tienda-api: falta PRODUCTO o CELDA');
      return c.json({ estado: 'sin-configurar' }, 503);
    }
    let acceso: ReturnType<typeof aceptarEnProducto>;
    try {
      acceso = aceptarEnProducto(
        await verificarConClaves(clavesDe(c.env), token, ahora()),
        producto,
      );
    } catch (e) {
      if (!(e instanceof TokenInvalido)) throw e;
      return c.json({ estado: 'sin-sesion', motivo: VUELVE_A_ENTRAR }, 401);
    }
    if (!acceso.org || !acceso.rol || !acceso.shard) {
      return c.json(
        { estado: 'sin-tienda', motivo: 'Tu cuenta todavía no tiene una tienda.' },
        403,
      );
    }
    const db = c.env[acceso.shard] as BaseD1 | undefined;
    if (acceso.celda !== c.env.CELDA || !SHARD.test(acceso.shard) || !db) {
      return c.json({ estado: 'otra-celda', motivo: VUELVE_A_ENTRAR }, 403);
    }
    c.set('sesion', {
      usuario: acceso.sub,
      org: acceso.org,
      rol: acceso.rol,
      plan: acceso.plan,
      authTime: acceso.auth_time ?? null,
      shard: acceso.shard,
      db,
    });
    return siguiente();
  });

  app.get('/api/panel/v1/yo', async (c) => {
    const s = c.get('sesion');
    const tienda = await s.db
      .prepare('SELECT slug, nombre, estado FROM tienda WHERE org_id = ?')
      .bind(s.org)
      .first<{ slug: string; nombre: string; estado: string }>();
    return c.json({ org: s.org, rol: s.rol, plan: s.plan, tienda: tienda ?? null });
  });

  app.all('*', (c) => c.json(NO_EXISTE, 404));
  return app;
}

const app = crearApp();
export default { fetch: app.fetch };
