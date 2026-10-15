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
 * - `POST /api/v1/solicitudes` y `/api/v1/solicitudes/seguimiento` (HU-T6.4): radicar una
 *   solicitud y seguirla, con el contacto cifrado con la llave de la tienda (`solicitudes.ts`).
 * - Kill switch `ks:tienda` (HU-T2.7, TIENDA §15.2): apagado, la API queda en solo lectura. Lo que
 *   escribe responde 503 con `Retry-After`; lo que lee sigue. Caché de 60 s (`@ed1/kill-switch`, P7).
 *
 * Ningún identificador de cuenta, base o dominio en el código (ADR-6): llega por la configuración
 * que arma el despliegue desde `celdas.json`.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { crearLectorKillSwitch, type LectorKillSwitch, type LectorKv } from '@ed1/kill-switch';
import { type Accion, decidir, type FuncionesPorPlan, funcionesDelPlan } from '@ed1/tienda-schema';
import { ENSAYOS } from '@ed1/tienda-schema/ensayos';
import {
  aceptarEnProducto,
  type ClavePublica,
  TokenInvalido,
  verificarConClaves,
} from '@ed1/tokens';
import { type Context, Hono } from 'hono';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import { avisame, PeticionDeAvisame } from './avisame.ts';
import {
  borrarLaColeccion,
  guardarLaColeccion,
  guardarProducto,
  leerProducto,
  listarColecciones,
  listarProductos,
  ordenarLasColecciones,
  ordenarProductos,
  type Quien,
  type Resultado as ResultadoDelCatalogo,
  tocarElProducto,
} from './catalogo.ts';
import { cotizar, PeticionDeCotizar } from './cotizar.ts';
import { aplicarParte, revisarLaCarga } from './importar.ts';
import {
  ajustarInventario,
  atenderAvisame,
  cruzo,
  disponibilidad,
  libroDe,
  listarInventario,
} from './inventario.ts';
import { kekDelEntorno } from './llaves.ts';
import { type BucketDeFotos, quitarFoto, subirFoto } from './medios.ts';
import {
  PeticionDePedido,
  PeticionDeSeguimiento,
  registrar,
  seguimiento,
  sha256,
} from './pedidos.ts';
import {
  type Almacen,
  type EscritorKv,
  publicar,
  type Resultado,
  rehornearExistencias,
} from './publicar.ts';
import { enFrase, leerRegistro } from './registro.ts';
import {
  PeticionDeSeguimientoDeSolicitud,
  PeticionDeSolicitud,
  radicar,
  seguirSolicitud,
} from './solicitudes.ts';
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
  /**
   * HU-T8.3: el bucket de las fotos, donde la API escribe las derivadas. Solo existe donde el dueño
   * ya lo creó (`medios_creados` en `celdas.json`); sin él, subir responde 503 y lo dice.
   */
  FOTOS?: BucketDeFotos;
  /** El aviso al dueño (HU-T17.1): lo usa la tarea que reconstruye los hostnames. */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** `produccion` o `staging`: la prueba de humo lo compara con el destino (HU-T2.9 CA3). */
  AMBIENTE?: string;
  /** Los limitadores por IP de lo público (HU-T5.5 y HU-T6.5): Workers Rate Limiting. */
  LIMITE_COTIZAR?: Limitador;
  LIMITE_AVISAME?: Limitador;
  LIMITE_PEDIDOS?: Limitador;
  LIMITE_SEGUIMIENTO?: Limitador;
  LIMITE_SOLICITUDES?: Limitador;
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
const SOLO_LEEN = new Set([
  '/api/v1/cotizar',
  '/api/v1/seguimiento',
  '/api/v1/solicitudes/seguimiento',
  '/api/panel/v1/importar/revisar',
]);

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

/** Cuántos de los comercios de prueba (HU-T2.6) hay en los shards de esta celda. */
async function comerciosDePrueba(shards: [string, BaseD1][]): Promise<number> {
  let n = 0;
  for (const [, db] of shards) {
    const fila = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM tienda WHERE ${ENSAYOS.map(() => 'org_id = ?').join(' OR ')}`,
      )
      .bind(...ENSAYOS.map((e) => e.org))
      .first<{ n: number }>();
    n += fila?.n ?? 0;
  }
  return n;
}

/**
 * La huella de un texto de la versión publicada: un pedido solo cita los términos que la tienda
 * mostró (HU-T6.1), y una solicitud, la política (HU-T6.4). `null` si la tienda no ha publicado o
 * el manifiesto no se puede leer.
 */
async function huellaPublicada(
  db: BaseD1,
  org: string,
  sitios: Almacen | undefined,
  ruta = '/legal/terminos/index.md',
): Promise<string | null> {
  if (!sitios) return null;
  const t = await db
    .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
    .bind(org)
    .first<{ version_publicada: number | null }>();
  if (!t?.version_publicada) return null;
  const objeto = await sitios.get(`sitios/${org}/${t.version_publicada}/manifiesto.json`);
  if (!objeto) return null;
  const m = JSON.parse(await objeto.text()) as { archivos: Record<string, { huella: string }> };
  return m.archivos[ruta]?.huella ?? null;
}

/** Lee el cuerpo JSON y lo valida; `null` si no se puede leer o no cumple el esquema. */
async function cuerpoValido<T>(
  c: ContextoTienda,
  esquema: { safeParse(x: unknown): { success: true; data: T } | { success: false } },
): Promise<T | null> {
  try {
    const r = esquema.safeParse(await c.req.json());
    return r.success ? r.data : null;
  } catch {
    return null;
  }
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

export function crearApp(
  opciones: {
    ahora?: () => number;
    /** Lo que sigue después de responder (`waitUntil`); las pruebas lo esperan. */
    enSegundoPlano?: (trabajo: Promise<unknown>) => void;
  } = {},
) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const enSegundoPlano = (c: ContextoTienda, trabajo: Promise<unknown>) =>
    opciones.enSegundoPlano ? opciones.enSegundoPlano(trabajo) : c.executionCtx.waitUntil(trabajo);
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
      // HU-T2.9 CA3: el ambiente que dice su configuración y los comercios de prueba que hay en sus
      // shards. En producción, la prueba de humo exige 0.
      ambiente: c.env.AMBIENTE ?? null,
      comerciosDePrueba: await comerciosDePrueba(shards),
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

  /**
   * HU-T6.1: registrar el pedido antes de abrir WhatsApp. Público, por el despacho; 10 por minuto
   * por IP (`LIMITE_PEDIDOS`; la hora no la cuenta el limitador, bitácora tienda3 11).
   */
  app.post('/api/v1/pedidos', async (c) => {
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    if (!(await dentroDelLimite(c, c.env.LIMITE_PEDIDOS, 'LIMITE_PEDIDOS'))) {
      c.header('retry-after', '60');
      return c.json(
        { estado: 'limite', motivo: 'Son muchos pedidos seguidos. Espera un minuto.' },
        429,
      );
    }
    const p = await cuerpoValido(c, PeticionDePedido);
    if (!p) {
      return c.json(
        { estado: 'invalido', motivo: 'Al pedido le falta algo. Revísalo y vuelve a enviarlo.' },
        422,
      );
    }
    const r = await registrar(
      {
        db: destino.db,
        org: destino.org,
        host: new URL(c.req.url).host,
        ahora: new Date(ahora()).toISOString(),
        terminosPublicados: await huellaPublicada(destino.db, destino.org, c.env.SITIOS),
        id: crypto.randomUUID(),
      },
      p,
    );
    if (r.estado === 'registrado' || r.estado === 'duplicado') return c.json(r);
    if (r.estado === 'forma' || r.estado === 'edad') return c.json(r, 422);
    return c.json(r, 409);
  });

  /**
   * HU-T6.3: el seguimiento. El secreto llega en el cuerpo, nunca en la URL; todo fallo responde lo
   * mismo; 20 por minuto por IP (`LIMITE_SEGUIMIENTO`).
   */
  app.post('/api/v1/seguimiento', async (c) => {
    const NO_ENCONTRADO = {
      estado: 'no-encontrado',
      motivo: 'No encontramos un pedido con ese enlace.',
    };
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    if (!(await dentroDelLimite(c, c.env.LIMITE_SEGUIMIENTO, 'LIMITE_SEGUIMIENTO'))) {
      c.header('retry-after', '60');
      return c.json(
        { estado: 'limite', motivo: 'Son muchas consultas seguidas. Espera un minuto.' },
        429,
      );
    }
    const p = await cuerpoValido(c, PeticionDeSeguimiento);
    if (!p) return c.json(NO_ENCONTRADO, 404);
    const r = await seguimiento(destino.db, destino.org, p.codigo, p.secreto);
    return r ? c.json(r) : c.json(NO_ENCONTRADO, 404);
  });

  /**
   * HU-T6.4: radicar una solicitud. Público, por el despacho; 5 por minuto por IP
   * (`LIMITE_SOLICITUDES`: el limitador solo cuenta de a 10 o 60 s, bitácora tienda3 11). Sin la
   * KEK no hay dónde guardar el contacto: responde 503 y lo dice, y la página ofrece los canales de
   * la tienda.
   */
  app.post('/api/v1/solicitudes', async (c) => {
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    if (!(await dentroDelLimite(c, c.env.LIMITE_SOLICITUDES, 'LIMITE_SOLICITUDES'))) {
      c.header('retry-after', '60');
      return c.json(
        { estado: 'limite', motivo: 'Son muchas solicitudes seguidas. Espera un minuto.' },
        429,
      );
    }
    const p = await cuerpoValido(c, PeticionDeSolicitud);
    if (!p) {
      return c.json(
        {
          estado: 'invalido',
          motivo: 'A la solicitud le falta algo. Revisa el formulario y vuelve a enviarla.',
        },
        422,
      );
    }
    const kek = await kekDelEntorno(c.env.TIENDA_KEK_V1);
    if (!kek) {
      console.error('tienda-api: sin la KEK no se pueden guardar solicitudes');
      return c.json(
        {
          estado: 'sin-configurar',
          motivo:
            'No pudimos recibir tu solicitud ahora. Usa el correo o el WhatsApp de la tienda.',
        },
        503,
      );
    }
    const r = await radicar(
      {
        db: destino.db,
        org: destino.org,
        ahora: ahora(),
        kek,
        politicaPublicada: await huellaPublicada(
          destino.db,
          destino.org,
          c.env.SITIOS,
          '/legal/privacidad/index.md',
        ),
        id: crypto.randomUUID(),
      },
      p,
    );
    return r.estado === 'no-existe' ? c.json(NO_EXISTE, 404) : c.json(r);
  });

  /** HU-T6.4: seguir una solicitud; como el pedido, todo fallo responde lo mismo. */
  app.post('/api/v1/solicitudes/seguimiento', async (c) => {
    const NO_ENCONTRADA = {
      estado: 'no-encontrada',
      motivo: 'No encontramos una solicitud con ese enlace.',
    };
    const destino = tiendaDelDespacho(c);
    if (!destino) return c.json(NO_EXISTE, 404);
    if (!(await dentroDelLimite(c, c.env.LIMITE_SEGUIMIENTO, 'LIMITE_SEGUIMIENTO'))) {
      c.header('retry-after', '60');
      return c.json(
        { estado: 'limite', motivo: 'Son muchas consultas seguidas. Espera un minuto.' },
        429,
      );
    }
    const p = await cuerpoValido(c, PeticionDeSeguimientoDeSolicitud);
    if (!p) return c.json(NO_ENCONTRADA, 404);
    const r = await seguirSolicitud(destino.db, destino.org, p.radicado, p.secreto);
    return r ? c.json(r) : c.json(NO_ENCONTRADA, 404);
  });

  app.get('/api/panel/v1/yo', async (c) => {
    const s = c.get('sesion');
    const tienda = await s.db
      .prepare('SELECT slug, nombre, estado FROM tienda WHERE org_id = ?')
      .bind(s.org)
      .first<{ slug: string; nombre: string; estado: string }>();
    // HU-T8.1 CA1: lo que permite el plan, para que el panel esconda lo que no hay. Lo decide la API.
    return c.json({
      org: s.org,
      rol: s.rol,
      plan: s.plan,
      funciones: s.plan ? funcionesDelPlan(funciones as unknown as FuncionesPorPlan, s.plan) : null,
      tienda: tienda ?? null,
    });
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

  /**
   * HU-T12.2: cargar una tienda desde un `tienda-import/1`, con el permiso `importar` (HU-T1.4).
   * «Revisar» no escribe; «aplicar» escribe una parte por solicitud y dice cuál sigue. Cada parte
   * vuelve a revisar el archivo entero: una parte nunca se aplica sobre un archivo con problemas.
   */
  const puedeImportar = (c: ContextoTienda) => {
    const s = c.get('sesion');
    return decidir(s.rol, 'importar', s.authTime ?? 0, Math.floor(ahora() / 1000));
  };
  app.post('/api/panel/v1/importar/revisar', async (c) => {
    const decision = puedeImportar(c);
    if (decision !== 'permitido') {
      return c.json({ estado: decision, motivo: 'Tu rol no puede cargar una tienda.' }, 403);
    }
    const s = c.get('sesion');
    let cuerpo: { carga?: unknown };
    try {
      cuerpo = (await c.req.json()) as { carga?: unknown };
    } catch {
      return c.json(
        { ok: false, problemas: [{ campo: '', mensaje: 'el archivo no es JSON' }] },
        422,
      );
    }
    const r = await revisarLaCarga(s.db, s.org, cuerpo.carga, new Date(ahora()).toISOString());
    return r.ok ? c.json({ ok: true, resumen: r.plan.resumen }) : c.json(r, 422);
  });
  app.post('/api/panel/v1/importar/aplicar', async (c) => {
    const decision = puedeImportar(c);
    if (decision !== 'permitido') {
      return c.json({ estado: decision, motivo: 'Tu rol no puede cargar una tienda.' }, 403);
    }
    const s = c.get('sesion');
    let cuerpo: { carga?: unknown; parte?: unknown };
    try {
      cuerpo = (await c.req.json()) as typeof cuerpo;
    } catch {
      return c.json(
        { ok: false, problemas: [{ campo: '', mensaje: 'el archivo no es JSON' }] },
        422,
      );
    }
    const instante = new Date(ahora()).toISOString();
    const r = await revisarLaCarga(s.db, s.org, cuerpo.carga, instante);
    if (!r.ok) return c.json(r, 422);
    const parte = cuerpo.parte;
    const partes = r.plan.partes;
    if (
      typeof parte !== 'number' ||
      !Number.isInteger(parte) ||
      parte < 0 ||
      parte >= partes.length
    ) {
      return c.json(
        { ok: false, problemas: [{ campo: 'parte', mensaje: `va de 0 a ${partes.length - 1}` }] },
        422,
      );
    }
    // El registro de la carga: una fila por archivo (su huella), que dice en qué va.
    const id = (await sha256(JSON.stringify(cuerpo.carga))).slice(0, 32);
    const anotar = (estado: string, detalle: object) =>
      s.db
        .prepare(
          `INSERT INTO importacion (org_id, id, formato, estado, resumen, pedida_por, creada, terminada)
           VALUES (?, ?, 'tienda-import/1', ?, ?, ?, ?, ?)
           ON CONFLICT (org_id, id) DO UPDATE SET estado = excluded.estado, resumen = excluded.resumen,
             terminada = excluded.terminada`,
        )
        .bind(
          s.org,
          id,
          estado,
          JSON.stringify({ ...r.plan.resumen, ...detalle }),
          `usuario:${s.usuario}`,
          instante,
          estado === 'aplicada' || estado === 'fallida' ? instante : null,
        )
        .run();
    try {
      await aplicarParte(s.db, partes[parte] ?? []);
    } catch (e) {
      await anotar('fallida', { parte });
      console.error(`tienda-api: la parte ${parte} de una carga falló (${(e as Error).message})`);
      return c.json(
        {
          ok: false,
          estado: 'fallida',
          parte,
          motivo: 'Esta parte no se aplicó y nada de ella quedó escrito. Vuelve a aplicarla.',
        },
        500,
      );
    }
    const ultima = parte === partes.length - 1;
    await anotar(ultima ? 'aplicada' : 'aplicando', { parte });
    return c.json({
      ok: true,
      parte,
      partes: partes.length,
      siguiente: ultima ? null : parte + 1,
      resumen: r.plan.resumen,
    });
  });

  /**
   * HU-T8.2 y HU-T8.4: el catálogo desde el panel, con el permiso `catalogo.editar` (HU-T1.4).
   * Leer también lo pide: el colaborador y el propietario lo tienen, y nadie más entra al panel.
   * 422 con los problemas por campo, 409 si alguien más guardó antes (con la versión actual), 404
   * si ya no está.
   */
  const quienPuede = (c: ContextoTienda, accion: Accion, motivo: string): Quien | Response => {
    const s = c.get('sesion');
    const decision = decidir(s.rol, accion, s.authTime ?? 0, Math.floor(ahora() / 1000));
    if (decision !== 'permitido') return c.json({ estado: decision, motivo }, 403);
    return {
      db: s.db,
      org: s.org,
      actor: `usuario:${s.usuario}`,
      instante: new Date(ahora()).toISOString(),
    };
  };
  const delCatalogo = (c: ContextoTienda) =>
    quienPuede(c, 'catalogo.editar', 'Tu rol no puede editar el catálogo.');
  const responderCatalogo = (c: ContextoTienda, r: ResultadoDelCatalogo) => {
    if (r.estado === 'guardado') return c.json(r);
    if (r.estado === 'problemas') return c.json(r, 422);
    if (r.estado === 'cambiado') return c.json(r, 409);
    return c.json(r, 404);
  };
  const escrituraDelCatalogo =
    (hacer: (q: Quien, cuerpo: unknown) => Promise<ResultadoDelCatalogo>) =>
    async (c: ContextoTienda) => {
      const q = delCatalogo(c);
      if (q instanceof Response) return q;
      let cuerpo: unknown;
      try {
        cuerpo = await c.req.json();
      } catch {
        return c.json(
          { estado: 'problemas', problemas: [{ campo: '', mensaje: 'no es JSON' }] },
          422,
        );
      }
      return responderCatalogo(c, await hacer(q, cuerpo));
    };
  app.get('/api/panel/v1/productos', async (c) => {
    const q = delCatalogo(c);
    if (q instanceof Response) return q;
    return c.json({
      productos: await listarProductos(q, {
        papelera: c.req.query('papelera') === '1',
        buscar: (c.req.query('q') ?? '').slice(0, 80),
      }),
    });
  });
  app.get('/api/panel/v1/productos/:id', async (c) => {
    const q = delCatalogo(c);
    if (q instanceof Response) return q;
    const p = await leerProducto(q, c.req.param('id'));
    if (!p) return c.json({ estado: 'no-existe', motivo: 'Ese producto no está.' }, 404);
    // HU-T8.3: la miniatura de cada foto, en el host público de las fotos.
    const host = c.env.MEDIOS;
    return c.json({
      ...p,
      medios: p.medios.map((m) => ({
        ...m,
        src: host ? `https://${host}/${q.org}/${m.id}/${m.anchos[0] ?? 400}.${m.formato}` : null,
      })),
    });
  });
  app.post('/api/panel/v1/productos/guardar', escrituraDelCatalogo(guardarProducto));
  app.post(
    '/api/panel/v1/productos/estado',
    escrituraDelCatalogo((q, b) => tocarElProducto(q, b, 'estado')),
  );
  app.post(
    '/api/panel/v1/productos/borrar',
    escrituraDelCatalogo((q, b) => tocarElProducto(q, b, 'borrar')),
  );
  app.post(
    '/api/panel/v1/productos/restaurar',
    escrituraDelCatalogo((q, b) => tocarElProducto(q, b, 'restaurar')),
  );
  app.post('/api/panel/v1/productos/ordenar', escrituraDelCatalogo(ordenarProductos));
  app.get('/api/panel/v1/colecciones', async (c) => {
    const q = delCatalogo(c);
    if (q instanceof Response) return q;
    return c.json({ colecciones: await listarColecciones(q) });
  });
  app.post('/api/panel/v1/colecciones/guardar', escrituraDelCatalogo(guardarLaColeccion));
  app.post('/api/panel/v1/colecciones/ordenar', escrituraDelCatalogo(ordenarLasColecciones));
  app.post('/api/panel/v1/colecciones/borrar', escrituraDelCatalogo(borrarLaColeccion));

  // HU-T8.3: las fotos. El teléfono manda solo las derivadas; el original no sale de él.
  app.post('/api/panel/v1/medios/subir', async (c) => {
    const q = delCatalogo(c);
    if (q instanceof Response) return q;
    if (!c.env.FOTOS) {
      return c.json(
        {
          estado: 'sin-fotos',
          motivo:
            'Las fotos todavía no están listas en esta tienda. El resto del producto sí se guarda.',
        },
        503,
      );
    }
    let datos: FormData;
    try {
      datos = await c.req.formData();
    } catch {
      return c.json(
        { estado: 'problemas', problemas: [{ campo: '', mensaje: 'no llegaron las fotos' }] },
        422,
      );
    }
    const r = await subirFoto(q, c.env.FOTOS, datos);
    if (r.estado === 'problemas') return c.json(r, 422);
    if (r.estado === 'no-existe') return c.json(r, 404);
    return c.json(r);
  });
  app.post('/api/panel/v1/medios/quitar', async (c) => {
    const q = delCatalogo(c);
    if (q instanceof Response) return q;
    const r = await quitarFoto(q, await c.req.json().catch(() => null));
    if (r.estado === 'problemas') return c.json(r, 422);
    if (r.estado === 'no-existe') return c.json(r, 404);
    return c.json(r);
  });

  /**
   * HU-T4.5: si una escritura cambia qué se puede comprar, se vuelve a hornear lo publicado después
   * de responder. Con `ks:tienda-horno` apagado no se hornea, y la cotización sigue impidiendo
   * vender lo que no hay (CA2).
   */
  const vigilarExistencias = async (c: ContextoTienda, variantes: readonly string[]) => {
    const s = c.get('sesion');
    const antes = await disponibilidad(s, variantes);
    return async () => {
      if (!cruzo(antes, await disponibilidad(s, variantes))) return;
      if (await hornoApagado(c)) {
        console.error('tienda-api: ks:tienda-horno apagado; las existencias no se re-hornean');
        return;
      }
      const ctx = contextoDePublicacion(c, s.org, s.shard, 'sistema:existencias');
      if (!ctx) return;
      enSegundoPlano(
        c,
        rehornearExistencias(ctx).then(
          (r) => {
            if (r.estado === 'fallida' || r.estado === 'en-curso')
              console.error(`tienda-api: el re-horneado de existencias quedó ${r.estado}`);
          },
          (e: unknown) => console.error(`tienda-api: el re-horneado de existencias falló (${e})`),
        ),
      );
    };
  };

  // HU-T8.5: el inventario y su libro, con los permisos `inventario.ajustar` y `avisame.atender`.
  const delInventario = (c: ContextoTienda) =>
    quienPuede(c, 'inventario.ajustar', 'Tu rol no puede ajustar el inventario.');
  app.get('/api/panel/v1/inventario', async (c) => {
    const q = delInventario(c);
    if (q instanceof Response) return q;
    return c.json({ filas: await listarInventario(q) });
  });
  app.get('/api/panel/v1/inventario/:variante', async (c) => {
    const q = delInventario(c);
    if (q instanceof Response) return q;
    const cursor = Number(c.req.query('cursor'));
    const r = await libroDe(
      q,
      c.req.param('variante'),
      Number.isSafeInteger(cursor) && cursor > 0 ? cursor : null,
    );
    return r ? c.json(r) : c.json({ estado: 'no-existe', motivo: 'Esa combinación no está.' }, 404);
  });
  app.post('/api/panel/v1/inventario/ajustar', async (c) => {
    const q = delInventario(c);
    if (q instanceof Response) return q;
    const cuerpo = (await c.req.json().catch(() => null)) as { variante?: unknown } | null;
    const variante = typeof cuerpo?.variante === 'string' ? cuerpo.variante : null;
    const despues = variante ? await vigilarExistencias(c, [variante]) : null;
    const r = await ajustarInventario(q, cuerpo);
    if (r.estado === 'guardado') await despues?.();
    return responderCatalogo(c, r);
  });
  app.post('/api/panel/v1/avisame/atender', async (c) => {
    const q = quienPuede(c, 'avisame.atender', 'Tu rol no puede atender los avisos.');
    if (q instanceof Response) return q;
    return responderCatalogo(c, await atenderAvisame(q, await c.req.json().catch(() => null)));
  });

  // HU-T10.6: el registro, en frases, de a 50, con el permiso `registro.ver`.
  app.get('/api/panel/v1/registro', async (c) => {
    const s = c.get('sesion');
    const decision = decidir(s.rol, 'registro.ver', s.authTime ?? 0, Math.floor(ahora() / 1000));
    if (decision !== 'permitido') {
      return c.json({ estado: decision, motivo: 'Tu rol no puede ver el registro.' }, 403);
    }
    const cursor = Number(c.req.query('cursor'));
    const quien = `usuario:${s.usuario}`;
    const r = await leerRegistro(
      s.db,
      s.org,
      Number.isSafeInteger(cursor) && cursor > 0 ? cursor : null,
    );
    return c.json({
      filas: r.filas.map((f) => ({ id: f.id, instante: f.instante, frase: enFrase(f, quien) })),
      siguiente: r.siguiente,
    });
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
