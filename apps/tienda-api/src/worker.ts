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
 * - `GET /api/v1/tienda` (HU-T2.6): la tienda que resolvió el despacho por el `Host`, de la cabecera
 *   `x-tienda`; solo su nombre y su estado. Es la prueba de humo de las direcciones de staging.
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
import { decidir } from '@ed1/tienda-schema';
import { ENSAYOS } from '@ed1/tienda-schema/ensayos';
import {
  aceptarEnProducto,
  type ClavePublica,
  TokenInvalido,
  verificarConClaves,
} from '@ed1/tokens';
import { type Context, Hono } from 'hono';
import { avisame, PeticionDeAvisame } from './avisame.ts';
import { cotizar, PeticionDeCotizar } from './cotizar.ts';
import { type Almacen, type EscritorKv, publicar, type Resultado } from './publicar.ts';
import { despachar, estadoDeLasTareas, type KvDeTareas, TAREAS } from './tareas.ts';

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
  /** El almacén de la celda (R2): sitios horneados y sus objetos (HU-T4.4). */
  SITIOS?: Almacen;
  /** Los punteros de cada hostname a su versión publicada. */
  TIENDA_HOSTS?: EscritorKv;
  /** La versión de los archivos comunes de la vitrina (`/_t/<release>/`, HU-T3.3). */
  VITRINA_RELEASE?: string;
  /** Solo en staging: «1» deja publicar a los comercios de prueba (HU-T2.6). */
  ENSAYOS?: string;
  /** El host público de las fotos (HU-T5.6): `img.` en producción, `img--staging.` en staging. */
  MEDIOS?: string;
  /** El aviso al dueño (HU-T17.1): lo usa la tarea que reconstruye los hostnames. */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** Los limitadores por IP de lo público (HU-T5.5 y HU-T6.5): Workers Rate Limiting. */
  LIMITE_COTIZAR?: Limitador;
  LIMITE_AVISAME?: Limitador;
  /** Un binding D1 por shard, con el nombre del shard, y `tienda_control`. */
  [base: string]: unknown;
}

/** Lo que se usa de un binding de Workers Rate Limiting. */
export interface Limitador {
  limit(opciones: { key: string }): Promise<{ success: boolean }>;
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
/** Rutas que van por POST pero solo leen: siguen con `ks:tienda` apagado. */
const SOLO_LEEN = new Set(['/api/v1/cotizar']);

let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
const lectorDe = (kv: LectorKv) => {
  if (lector?.kv !== kv) lector = { kv, lector: crearLectorKillSwitch({ kv }) };
  return lector.lector;
};

/**
 * La tienda que resolvió el despacho (`x-tienda`), con su shard de esta celda; `null` si no la hay.
 * Es confiable: solo el despacho y el panel llegan aquí, y borran la que llega de afuera (§14.1).
 */
function tiendaDelDespacho(c: ContextoTienda): { org: string; db: BaseD1 } | null {
  let destino: { org?: unknown; shard?: unknown };
  try {
    destino = JSON.parse(c.req.header(CABECERA_TIENDA) ?? 'null') ?? {};
  } catch {
    destino = {};
  }
  const { org, shard } = destino;
  const db =
    typeof shard === 'string' && SHARD.test(shard)
      ? (c.env[shard] as BaseD1 | undefined)
      : undefined;
  return typeof org === 'string' && db ? { org, db } : null;
}

/** Si la IP sigue dentro del límite. Sin limitador, lo registra y deja pasar (P1: se dice). */
async function dentroDelLimite(
  c: ContextoTienda,
  limitador: Limitador | undefined,
  nombre: string,
): Promise<boolean> {
  if (!limitador) {
    console.error(`tienda-api: falta el limitador ${nombre}`);
    return true;
  }
  const ip = c.req.header('cf-connecting-ip') ?? 'sin-ip';
  return (await limitador.limit({ key: ip })).success;
}

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
      !SOLO_LEEN.has(c.req.path) &&
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
      // HU-T17.1: si las tareas periódicas corren a tiempo. Staging no tiene cron: dice «nunca».
      ...(c.env.FLAGS
        ? { tareas: await estadoDeLasTareas(c.env.FLAGS as unknown as KvDeTareas, TAREAS, ahora()) }
        : {}),
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

  // HU-T2.6: lo público llega por el despacho, con la tienda que resolvió en `x-tienda`. Sin ella,
  // o con un shard que no es de esta celda, no existe.
  app.get('/api/v1/tienda', async (c) => {
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    const { db, org } = destino;
    const tienda = await db
      .prepare('SELECT nombre, estado FROM tienda WHERE org_id = ?')
      .bind(org)
      .first<{ nombre: string; estado: string }>();
    return tienda ? c.json(tienda) : c.json(NO_EXISTE, 404);
  });

  /**
   * HU-T5.5: cotizar. Público, por el despacho, para la tienda de `x-tienda`; 30 por minuto por IP
   * (`LIMITE_COTIZAR`). Sin el limitador configurado lo dice en el registro y responde igual: el
   * límite protege la base, no es lo que hace correcta la cotización.
   */
  app.post('/api/v1/cotizar', async (c) => {
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    if (!(await dentroDelLimite(c, c.env.LIMITE_COTIZAR, 'LIMITE_COTIZAR'))) {
      c.header('retry-after', '60');
      return c.json(
        {
          estado: 'limite',
          motivo: 'Son muchas consultas seguidas. Espera un minuto y vuelve a intentar.',
        },
        429,
      );
    }
    let cuerpo: unknown;
    try {
      cuerpo = await c.req.json();
    } catch {
      return c.json({ estado: 'invalido', motivo: 'El pedido no se pudo leer.' }, 400);
    }
    const p = PeticionDeCotizar.safeParse(cuerpo);
    if (!p.success) {
      return c.json(
        { estado: 'invalido', motivo: 'El pedido tiene algo que no se puede cotizar.' },
        422,
      );
    }
    return c.json(await cotizar(destino.db, destino.org, p.data, new Date(ahora()).toISOString()));
  });

  /**
   * HU-T6.5: «Avísame cuando haya». Público, por el despacho; 10 por minuto por IP
   * (`LIMITE_AVISAME`, bitácora tienda3 11). No guarda ningún dato de la persona.
   */
  app.post('/api/v1/avisame', async (c) => {
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    if (!(await dentroDelLimite(c, c.env.LIMITE_AVISAME, 'LIMITE_AVISAME'))) {
      c.header('retry-after', '60');
      return c.json(
        { estado: 'limite', motivo: 'Son muchas solicitudes seguidas. Espera un minuto.' },
        429,
      );
    }
    let cuerpo: unknown;
    try {
      cuerpo = await c.req.json();
    } catch {
      return c.json({ estado: 'invalido' }, 400);
    }
    const p = PeticionDeAvisame.safeParse(cuerpo);
    if (!p.success) return c.json({ estado: 'invalido' }, 422);
    const r = await avisame(
      destino.db,
      destino.org,
      p.data.variante,
      new Date(ahora()).toISOString(),
    );
    if (r === 'no-existe') return c.json(NO_EXISTE, 404);
    if (r === 'disponible') {
      return c.json({ estado: r, motivo: 'Esta combinación ya está disponible.' }, 409);
    }
    return c.json({ estado: r });
  });

  app.get('/api/panel/v1/yo', async (c) => {
    const s = c.get('sesion');
    const tienda = await s.db
      .prepare('SELECT slug, nombre, estado FROM tienda WHERE org_id = ?')
      .bind(s.org)
      .first<{ slug: string; nombre: string; estado: string }>();
    return c.json({ org: s.org, rol: s.rol, plan: s.plan, tienda: tienda ?? null });
  });

  // HU-T4.4: publicar. Lo decide la matriz de permisos (HU-T1.4), y `ks:tienda-horno` lo pausa
  // sin tocar lo publicado.
  const contextoDePublicacion = (
    c: ContextoTienda,
    org: string,
    shard: string,
    pedidaPor: string,
  ) => {
    const db = c.env[shard] as BaseD1 | undefined;
    const control = c.env[CONTROL] as BaseD1 | undefined;
    const { SITIOS: sitios, TIENDA_HOSTS: hosts, VITRINA_RELEASE: release, CELDA: celda } = c.env;
    if (!db || !control || !sitios || !hosts || !release || !celda) return null;
    return {
      shard: db,
      shardNombre: shard,
      control,
      sitios,
      hosts,
      celda,
      release,
      ...(c.env.MEDIOS ? { medios: c.env.MEDIOS } : {}),
      org,
      pedidaPor,
      ahora: new Date(ahora()).toISOString(),
    };
  };
  const responder = (c: ContextoTienda, r: Resultado) => {
    if (r.estado === 'publicada' || r.estado === 'nada-cambio') return c.json(r);
    if (r.estado === 'compuerta') return c.json(r, 422);
    if (r.estado === 'en-curso')
      return c.json({ ...r, motivo: 'Ya hay una publicación en curso.' }, 409);
    console.error(`tienda-api: la publicación falló (${r.motivo})`);
    return c.json(r, 500);
  };
  const hornoApagado = async (c: ContextoTienda) =>
    Boolean(c.env.FLAGS && (await lectorDe(c.env.FLAGS).apagado('tienda-horno')));

  app.post('/api/panel/v1/publicar', async (c) => {
    const s = c.get('sesion');
    const decision = decidir(s.rol, 'publicar', s.authTime ?? 0, Math.floor(ahora() / 1000));
    if (decision !== 'permitido') {
      return c.json({ estado: decision, motivo: 'Tu rol no puede publicar la tienda.' }, 403);
    }
    if (await hornoApagado(c)) {
      return c.json(
        {
          estado: 'apagado',
          motivo: 'Publicar está en pausa unos minutos; tu tienda sigue igual.',
        },
        503,
      );
    }
    const ctx = contextoDePublicacion(c, s.org, s.shard, `usuario:${s.usuario}`);
    if (!ctx) return c.json({ estado: 'sin-configurar' }, 503);
    return responder(c, await publicar(ctx));
  });

  // HU-T2.6 y HU-T4.4: en staging, el despliegue publica a los comercios de prueba con el secreto
  // del despacho en `x-ensayo`. En producción la ruta no existe: `ENSAYOS` no está.
  app.post('/api/ensayo/publicar', async (c) => {
    const dado = c.req.header('x-ensayo');
    if (c.env.ENSAYOS !== '1' || !dado || !mismoSecreto(c.env.SECRETO_DESPACHO ?? '', dado)) {
      return c.json(NO_EXISTE, 404);
    }
    const resultados: Record<string, Resultado> = {};
    for (const e of ENSAYOS) {
      const shard = Object.keys(c.env).find((k) => SHARD.test(k));
      const ctx = shard
        ? contextoDePublicacion(c as ContextoTienda, e.org, shard, 'sistema:ensayo')
        : null;
      if (!ctx) return c.json({ estado: 'sin-configurar' }, 503);
      // Los comercios de prueba no tienen fotos hasta HU-T8.3: es lo único que se omite.
      resultados[e.slug] = await publicar({ ...ctx, omitir: ['sin-foto'] });
    }
    const ok = Object.values(resultados).every(
      (r) => r.estado === 'publicada' || r.estado === 'nada-cambio',
    );
    return c.json(resultados, ok ? 200 : 500);
  });

  app.all('*', (c) => c.json(NO_EXISTE, 404));
  return app;
}

const app = crearApp();
/**
 * El cron por hora (HU-T17.1), solo en producción: reparte las tareas por frecuencia. Sin las bases
 * o los KV configurados, lo dice y no corre nada (P1).
 */
export async function alCron(env: Env, instante: number): Promise<void> {
  const control = env[CONTROL] as BaseD1 | undefined;
  const shards = Object.entries(env).filter(([n, b]) => SHARD.test(n) && b) as [string, BaseD1][];
  const hosts = env.TIENDA_HOSTS as (EscritorKv & KvDeTareas) | undefined;
  const flags = env.FLAGS as KvDeTareas | undefined;
  if (!control || shards.length === 0 || !hosts || !flags || !env.CELDA) {
    console.error('tienda-api: el cron no tiene sus bases o sus KV');
    return;
  }
  await despachar(
    {
      celda: env.CELDA,
      shards,
      control,
      hosts,
      flags,
      telegram: { token: env.TELEGRAM_BOT_TOKEN, chat: env.TELEGRAM_CHAT_ID },
    },
    instante,
    TAREAS,
  );
}

export default {
  fetch: app.fetch,
  scheduled(
    evento: { scheduledTime: number },
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    ctx.waitUntil(alCron(env, evento.scheduledTime));
  },
};
