/**
 * Worker del CORE v0 (ADR-9, ARQUITECTURA §5.4), con Hono (ADR-12).
 *
 * - `GET /api/core/salud`: la usa la prueba de humo del despliegue. Dice cuántas celdas activas
 *   tiene el directorio; con 0 responde 503, porque un CORE que no puede crear organizaciones no
 *   debe parecer sano (P1).
 * - `GET /api/core/claves`: la clave pública con la que las celdas verifican los tokens (CA5).
 * - `/api/core/auth/*`: entrar con Google y renovar la sesión (HU-E4.2, `entrar.ts`).
 * - `POST /api/core/organizaciones`: crear la organización de la finca del teléfono (HU-E4.3).
 * - `POST /api/core/invitaciones[/ver|/aceptar]`: invitar al equipo por WhatsApp (HU-E4.4).
 * - `POST /api/core/equipo/{ver,rol,quitar}` y `/api/core/telefonos/{ver,retirar}`: el equipo de
 *   la finca y los teléfonos de la cuenta (HU-E4.6, `equipo.ts`).
 * - `POST /api/core/interes[/ver]`: la lista de espera de planes con precio visible (HU-E0.6,
 *   `interes.ts`).
 * - `POST /api/core/pago/{crear,confirmar}`: pagar el plan en línea con Bold (HU-E0.7, `pagos.ts`).
 *   Sin las llaves de Bold responde 503 «no disponible»; entrar y lo demás siguen igual.
 *
 * Kill switch `ks:agro-core` (HU-E8.1): apagado, `/api/core/auth/*` responde 503 y nadie entra ni
 * renueva. Quien ya tiene un access token sigue sincronizando hasta que venza (12 h); el cuaderno
 * sigue registrando en el teléfono (ARQUITECTURA §5.3).
 *
 * Una configuración que falta (secreto, orígenes) responde 503 y lo dice en el log: nunca entra
 * con valores de fábrica (P1).
 */

import type { BaseD1 } from '@ed1/d1';
import { crearLectorKillSwitch, type LectorKillSwitch, type LectorKv } from '@ed1/kill-switch';
import { type Firmante, firmanteDesde } from '@ed1/tokens';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { KS_CORE, KS_PAGOS, ksDelProducto, PRODUCTO_CORE } from './constantes.ts';
import {
  callbackDrive,
  canjeDrive,
  type EntornoDrive,
  inicioDrive,
  type ProveedorDrive,
  proveedorDrive,
} from './drive.ts';
import {
  callback,
  canje,
  type Entorno,
  inicio,
  type ProveedorGoogle,
  proveedorGoogle,
  renovar,
} from './entrar.ts';
import {
  cambiarRol,
  quitarDelEquipo,
  retirarTelefono,
  verAuditoria,
  verEquipo,
  verTelefonos,
} from './equipo.ts';
import { marcarInteres, verInteres } from './interes.ts';
import { aceptarInvitacion, crearInvitacion, verInvitacion } from './invitaciones.ts';
import { crearOrganizacionDeLaFinca } from './organizaciones.ts';
import { conciliarPagos, confirmarPago, crearPago, type EntornoDePago } from './pagos.ts';
import { type ProveedorDePago, proveedorBold } from './proveedor-de-pago.ts';

export { PRODUCTO_CORE };

export interface Env {
  /** Base D1 del CORE (`agro_core`); el despliegue agrega su id (ADR-6). */
  DB: BaseD1;
  /** KV de flags de la celda (kill switch). */
  FLAGS?: LectorKv;
  /** Secretos del Worker, cargados por el despliegue (ARQUITECTURA §7.5). */
  CORE_JWT_PRIVATE_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Orígenes del cuaderno separados por coma; los pone el despliegue. */
  ORIGENES_APP?: string;
  /** Llaves del Botón de pagos de Bold y su ambiente (HU-E0.7); opcionales. */
  BOLD_IDENTIDAD?: string;
  BOLD_SECRETA?: string;
  BOLD_AMBIENTE?: string;
}

export interface Dependencias {
  google?: (env: Env) => ProveedorGoogle;
  /** Permiso de Drive del productor (HU-E8.4); las pruebas pasan uno falso. */
  drive?: (env: Env) => ProveedorDrive;
  ahora?: () => number;
  /** Para hablar con Bold; las pruebas pasan uno falso. */
  fetch?: typeof fetch;
}

// Por isolate: importar la clave y la caché de 60 s del kill switch viven mientras viva el isolate.
let firmante: { secreto: string; promesa: Promise<Firmante> } | null = null;
const firmanteDe = (secreto: string) => {
  if (firmante?.secreto !== secreto) firmante = { secreto, promesa: firmanteDesde(secreto) };
  return firmante.promesa;
};
let lector: { kv: LectorKv; lector: LectorKillSwitch } | null = null;
const lectorDe = (kv: LectorKv) => {
  if (lector?.kv !== kv) lector = { kv, lector: crearLectorKillSwitch({ kv }) };
  return lector.lector;
};

const origenesDe = (env: Env) =>
  (env.ORIGENES_APP ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

const faltaConfiguracion = (c: Context, que: string) => {
  console.error(`agro-core: falta ${que}`);
  return c.json({ estado: 'sin-configurar', motivo: 'Entrar no está disponible todavía' }, 503);
};

/**
 * El proveedor de pagos del CORE (ED1 §5.3), hoy Bold. Sus llaves completas o ninguna: media
 * configuración no cobra (P1).
 */
export function proveedorDePagoDe(env: Env, fetchFn: typeof fetch): ProveedorDePago | null {
  const ambiente = env.BOLD_AMBIENTE;
  if (!env.BOLD_IDENTIDAD || !env.BOLD_SECRETA) return null;
  if (ambiente !== 'pruebas' && ambiente !== 'produccion') return null;
  return proveedorBold(
    { identidad: env.BOLD_IDENTIDAD, secreta: env.BOLD_SECRETA, ambiente },
    fetchFn,
  );
}

export function crearApp(dependencias: Dependencias = {}) {
  const ahora = dependencias.ahora ?? (() => Date.now());
  const google =
    dependencias.google ??
    ((env: Env) => proveedorGoogle(env.GOOGLE_CLIENT_ID ?? '', env.GOOGLE_CLIENT_SECRET ?? ''));
  const drive =
    dependencias.drive ??
    ((env: Env) => proveedorDrive(env.GOOGLE_CLIENT_ID ?? '', env.GOOGLE_CLIENT_SECRET ?? ''));
  const app = new Hono<{ Bindings: Env; Variables: { entorno: Entorno } }>();

  app.get('/api/core/salud', async (c) => {
    try {
      const fila = await c.env.DB.prepare(
        "SELECT count(*) AS n FROM celda WHERE estado = 'activa'",
      ).first<{ n: number }>();
      const celdas = fila?.n ?? 0;
      if (celdas === 0) {
        return c.json(
          {
            estado: 'sin-celdas',
            motivo: 'El directorio no tiene celdas activas: falta sincronizar celdas.json',
          },
          503,
        );
      }
      return c.json({ estado: 'ok', celdas });
    } catch (e) {
      console.error('agro-core: la base no respondió', e);
      return c.json({ estado: 'sin-base', motivo: 'La base del CORE no respondió' }, 503);
    }
  });

  app.get('/api/core/claves', async (c) => {
    if (!c.env.CORE_JWT_PRIVATE_KEY)
      return faltaConfiguracion(c, 'el secreto CORE_JWT_PRIVATE_KEY');
    const { publica } = await firmanteDe(c.env.CORE_JWT_PRIVATE_KEY);
    return c.json({ claves: [publica] });
  });

  // Solo el cuaderno puede leer estas respuestas desde el navegador. Entrar, renovar y crear la
  // organización comparten CORS, kill switch y configuración.
  const corsDelCuaderno = cors({
    origin: (origen, c) => (origenesDe(c.env as Env).includes(origen) ? origen : null),
    allowMethods: ['POST'],
    allowHeaders: ['authorization', 'content-type'],
    maxAge: 600,
  });
  const conEntorno: MiddlewareHandler<{ Bindings: Env; Variables: { entorno: Entorno } }> = async (
    c,
    siguiente,
  ) => {
    if (c.env.FLAGS) {
      const flags = lectorDe(c.env.FLAGS);
      // Hasta HU-C3.1 toda solicitud es del agro: la sesión todavía no dice su producto.
      const producto = 'agro';
      const esPago = c.req.path.startsWith('/api/core/pago/');
      const todo =
        (await flags.apagado(KS_CORE)) ||
        (await flags.apagado(PRODUCTO_CORE)) ||
        (await flags.apagado(ksDelProducto(producto)));
      if (todo || (esPago && (await flags.apagado(KS_PAGOS)))) {
        c.header('retry-after', '120');
        return c.json(
          {
            estado: 'apagado',
            motivo: todo
              ? 'Entrar está en pausa. Tus registros siguen guardados en el teléfono.'
              : 'Pagar está en pausa por un momento. Tu plan sigue igual: intenta más tarde.',
          },
          503,
        );
      }
    }
    const faltan = (
      ['CORE_JWT_PRIVATE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ORIGENES_APP'] as const
    ).filter((clave) => !c.env[clave]);
    if (faltan.length > 0) return faltaConfiguracion(c, faltan.join(', '));
    c.set('entorno', {
      db: c.env.DB,
      firmante: await firmanteDe(c.env.CORE_JWT_PRIVATE_KEY ?? ''),
      google: google(c.env),
      origenes: origenesDe(c.env),
      ahora,
    });
    await siguiente();
    return undefined;
  };
  for (const ruta of [
    '/api/core/auth/*',
    '/api/core/organizaciones',
    '/api/core/invitaciones',
    '/api/core/invitaciones/*',
    '/api/core/equipo/*',
    '/api/core/telefonos/*',
    '/api/core/interes',
    '/api/core/interes/*',
    '/api/core/pago/*',
    '/api/core/drive/*',
    '/api/core/auditoria/*',
  ]) {
    app.use(ruta, corsDelCuaderno);
    app.use(ruta, conEntorno);
  }

  app.post('/api/core/organizaciones', (c) => crearOrganizacionDeLaFinca(c, c.get('entorno')));
  app.post('/api/core/invitaciones', (c) => crearInvitacion(c, c.get('entorno')));
  app.post('/api/core/invitaciones/ver', (c) => verInvitacion(c, c.get('entorno')));
  app.post('/api/core/invitaciones/aceptar', (c) => aceptarInvitacion(c, c.get('entorno')));
  app.post('/api/core/equipo/ver', (c) => verEquipo(c, c.get('entorno')));
  app.post('/api/core/equipo/rol', (c) => cambiarRol(c, c.get('entorno')));
  app.post('/api/core/equipo/quitar', (c) => quitarDelEquipo(c, c.get('entorno')));
  app.post('/api/core/telefonos/ver', (c) => verTelefonos(c, c.get('entorno')));
  app.post('/api/core/telefonos/retirar', (c) => retirarTelefono(c, c.get('entorno')));
  app.post('/api/core/auditoria/ver', (c) => verAuditoria(c, c.get('entorno')));
  app.post('/api/core/interes', (c) => marcarInteres(c, c.get('entorno')));
  app.post('/api/core/interes/ver', (c) => verInteres(c, c.get('entorno')));
  const conPago = (
    c: Context<{ Bindings: Env; Variables: { entorno: Entorno } }>,
  ): EntornoDePago => ({
    ...c.get('entorno'),
    proveedor: proveedorDePagoDe(c.env, dependencias.fetch ?? ((...a) => fetch(...a))),
  });
  app.post('/api/core/pago/crear', (c) => crearPago(c, conPago(c)));
  app.post('/api/core/pago/confirmar', (c) => confirmarPago(c, conPago(c)));
  app.get('/api/core/auth/google/inicio', (c) => inicio(c, c.get('entorno')));
  app.get('/api/core/auth/google/callback', (c) => callback(c, c.get('entorno')));
  app.post('/api/core/auth/canje', (c) => canje(c, c.get('entorno')));
  app.post('/api/core/auth/refrescar', (c) => renovar(c, c.get('entorno')));
  // Copia en el Drive del productor (HU-E8.4, etapa 1): mismo CORS, kill switch y configuración.
  const conDrive = (
    c: Context<{ Bindings: Env; Variables: { entorno: Entorno } }>,
  ): EntornoDrive => ({
    drive: drive(c.env),
    secreto: c.env.CORE_JWT_PRIVATE_KEY ?? '',
    origenes: c.get('entorno').origenes,
    ahora,
  });
  app.get('/api/core/drive/inicio', (c) => inicioDrive(c, conDrive(c)));
  app.get('/api/core/drive/callback', (c) => callbackDrive(c, conDrive(c)));
  app.post('/api/core/drive/canje', (c) => canjeDrive(c, conDrive(c)));

  app.notFound((c) =>
    c.json({ estado: 'no-encontrado', motivo: 'Ruta del CORE desconocida' }, 404),
  );
  return app;
}

const app = crearApp();

/** Lo mínimo del contexto de un evento programado: esperar a que termine la vuelta. */
interface ContextoProgramado {
  waitUntil(promesa: Promise<unknown>): void;
}

export default {
  fetch: app.fetch,
  /**
   * Cron Trigger cada 15 min (HU-E0.7): concilia los pagos que siguen esperando, por si alguien
   * pagó y no volvió a la pantalla. Sin llaves del proveedor no hace nada.
   */
  scheduled(_evento: unknown, env: Env, ctx: ContextoProgramado) {
    ctx.waitUntil(
      conciliarPagos(
        env.DB,
        proveedorDePagoDe(env, (...a) => fetch(...a)),
        Date.now(),
      ).then((r) => {
        if (r.revisados > 0)
          console.log(`agro-core: conciliados ${r.cerrados} de ${r.revisados} pagos`);
      }),
    );
  },
};
