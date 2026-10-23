/**
 * Worker del CORE v0 (ADR-9, ARQUITECTURA §5.4), con Hono (ADR-12).
 *
 * - `GET /api/core/salud`: la usa la prueba de humo del despliegue. Dice cuántas celdas activas
 *   tiene el directorio; con 0 responde 503, porque un CORE que no puede crear organizaciones no
 *   debe parecer sano (P1).
 * - `GET /api/core/claves`: la clave pública con la que las celdas verifican los tokens (CA5).
 * - `GET /.well-known/jwks.json`: las mismas llaves en el formato estándar (HU-C4.2, `jwks.ts`).
 * - `GET /.well-known/security.txt`: a quién escribirle si se encuentra un fallo (HU-C8.4).
 * - `/api/core/auth/*`: entrar con Google, renovar la sesión y salir (HU-E4.2, HU-C7.3, `entrar.ts`).
 * - `POST /api/core/organizaciones`: crear la organización de la finca del teléfono (HU-E4.3).
 * - `POST /api/core/invitaciones[/ver|/aceptar]`: invitar al equipo por WhatsApp (HU-E4.4).
 * - `POST /api/core/equipo/{ver,rol,quitar}` y `/api/core/telefonos/{ver,retirar}`: el equipo de
 *   la finca y los teléfonos de la cuenta (HU-E4.6, `equipo.ts`).
 * - `POST /api/core/cuenta/espacios`: los espacios de la persona en todos los productos, solo con un
 *   token de la cuenta (HU-C7.4, `cuenta.ts`).
 * - `POST /api/core/cuenta/{sesiones,sesiones/cerrar,pagos,actividad}`: dónde ha entrado la
 *   persona y cerrar sesiones, sus pagos y la actividad de lo que administra (HU-C7.5, HU-C7.6,
 *   HU-C7.8, `mi-cuenta.ts`).
 * - `POST /api/core/interes[/ver]`: la lista de espera de planes con precio visible (HU-E0.6,
 *   `interes.ts`).
 * - `ServicioDelCore`: la entrada RPC de las celdas por su service binding, sin URL (HU-C5.6,
 *   `entrada-de-servicio.ts`).
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
import { type ProveedorDePago, proveedorBold } from '@ed1/pagos';
import { type ClavePublica, type Firmante, firmanteDesde, verificarAcceso } from '@ed1/tokens';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import politicaDeLaCuenta from '../../../content/cuenta/privacidad/politica.json' with {
  type: 'json',
};
import { decidirAutorizacion, inicioDeAutorizacion } from './autorizar.ts';
import { mandarAvisos } from './avisos-por-correo.ts';
import { registrarCliente } from './clientes-oauth.ts';
import { KS_CORE, KS_PAGOS, ksDelProducto, PRODUCTO_CORE } from './constantes.ts';
import { pasoDeLaCopia } from './copia.ts';
import { correoDelCore } from './correo.ts';
import { espaciosDeLaCuenta } from './cuenta.ts';
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
  salir,
} from './entrar.ts';
import { abrirEnlace, type Limitador, pedirEnlace, verEnlace } from './entrar-con-correo.ts';
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
import { claveAnteriorDe, clavesPublicadas } from './jwks.ts';
import {
  cerrarSesiones,
  quitarAsistente,
  verActividad,
  verAsistentes,
  verPagos,
  verSesiones,
} from './mi-cuenta.ts';
import { misDatos, radicar, reintentarAvisos, verRadicados } from './mis-datos.ts';
import { metadatosDelServidor, servidorOAuthActivo } from './oauth.ts';
import { crearOrganizacionDeLaFinca } from './organizaciones.ts';
import { conciliarPagos, confirmarPago, crearPago, type EntornoDePago } from './pagos.ts';
import {
  type CatalogoDelCore,
  catalogoDelDestino,
  origenesDelProducto,
  origenesDeTodos,
  productoDe,
  productoDeOrganizacion,
} from './productos.ts';
import { securityTxt } from './security-txt.ts';
import { canjearToken, revocarToken } from './token-oauth.ts';

export { ServicioDelCore } from './entrada-de-servicio.ts';
export { PRODUCTO_CORE };

export interface Env {
  /** Bot y chat del dueño (HU-C7.7): los radicados de la Ley 1581 le llegan por Telegram. */
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  /** Base D1 del CORE (`agro_core`); el despliegue agrega su id (ADR-6). */
  DB: BaseD1;
  /** KV de flags de la celda (kill switch). */
  FLAGS?: LectorKv;
  /** Secretos del Worker, cargados por el despliegue (ARQUITECTURA §7.5). */
  CORE_JWT_PRIVATE_KEY?: string;
  /** `staging` o `produccion`, del despliegue: staging atiende además los productos de prueba (HU-C3.7). */
  DESTINO?: string;
  /** JWK pública de la llave anterior mientras dura una rotación (HU-C4.2); no es secreta. */
  CORE_CLAVE_ANTERIOR?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  /** Orígenes del cuaderno separados por coma; los pone el despliegue. */
  ORIGENES_APP?: string;
  /** Llaves del Botón de pagos de Bold y su ambiente (HU-E0.7); opcionales. */
  BOLD_IDENTIDAD?: string;
  BOLD_SECRETA?: string;
  BOLD_AMBIENTE?: string;
  /**
   * HU-C10.1: los correos del CORE. Staging manda con la cuenta de Gmail; producción, con Resend
   * (`correo.ts`). Sin ellos, entrar con correo y los avisos dicen «no disponible».
   */
  CORREO_GMAIL_CLIENTE_ID?: string;
  CORREO_GMAIL_CLIENTE_SECRETO?: string;
  CORREO_GMAIL_REFRESH?: string;
  CORREO_GMAIL_REMITENTE?: string;
  RESEND_API_KEY?: string;
  /** HU-C10.2 CA3: el límite por IP de pedir un enlace (Workers Rate Limiting). */
  LIMITE_CORREO?: Limitador;
  /** HU-C11.4: la copia semanal en el Drive del dueño (`copia.ts`). Sin ellos, no se hace. */
  COPIA_LLAVE?: string;
  COPIA_DRIVE_CLIENTE_ID?: string;
  COPIA_DRIVE_CLIENTE_SECRETO?: string;
  COPIA_DRIVE_REFRESH?: string;
  COPIA_CF_TOKEN?: string;
  COPIA_CF_CUENTA?: string;
}

export interface Dependencias {
  /** Los productos que atiende el CORE (HU-C3.1); las pruebas pasan uno con un producto de ensayo. */
  catalogo?: CatalogoDelCore;
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
  // Para Bold y para leer los metadatos de un cliente de OAuth (HU-C9.3); las pruebas pasan uno falso.
  const fetchDeLaRed: typeof fetch = dependencias.fetch ?? ((...a) => fetch(...a));
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

  const publicadas = async (env: Env): Promise<ClavePublica[] | null> => {
    if (!env.CORE_JWT_PRIVATE_KEY) return null;
    const { publica } = await firmanteDe(env.CORE_JWT_PRIVATE_KEY);
    return clavesPublicadas(publica, claveAnteriorDe(env.CORE_CLAVE_ANTERIOR));
  };

  app.get('/api/core/claves', async (c) => {
    const claves = await publicadas(c.env);
    if (!claves) return faltaConfiguracion(c, 'el secreto CORE_JWT_PRIVATE_KEY');
    return c.json({ claves });
  });

  // Público por naturaleza: cualquiera puede leer las llaves públicas, desde cualquier origen.
  app.get('/.well-known/jwks.json', async (c) => {
    const claves = await publicadas(c.env);
    if (!claves) return faltaConfiguracion(c, 'el secreto CORE_JWT_PRIVATE_KEY');
    c.header('access-control-allow-origin', '*');
    c.header('cache-control', 'public, max-age=300');
    return c.json({ keys: claves });
  });

  // HU-C8.4: a quién escribirle si se encuentra un fallo (RFC 9116), con el correo de la política
  // de la cuenta. Sin API de catálogo: el CORE no tiene una API pública para terceros (CA2, P1).
  app.get('/.well-known/security.txt', (c) => {
    c.header('content-type', 'text/plain; charset=utf-8');
    c.header('cache-control', 'public, max-age=86400');
    return c.body(
      securityTxt({
        correo: politicaDeLaCuenta.responsable.correo,
        canonical: `${new URL(c.req.url).origin}/.well-known/security.txt`,
        ahora: ahora(),
      }),
    );
  });

  // HU-C9.2: los metadatos del servidor de autorización (RFC 8414). Solo donde ya se anuncia
  // (`oauth.ts`): en producción, 404 hasta que exista el canje de tokens (HU-C9.5).
  app.get('/.well-known/oauth-authorization-server', (c) => {
    if (!servidorOAuthActivo(c.env.DESTINO)) return c.notFound();
    c.header('access-control-allow-origin', '*');
    c.header('cache-control', 'public, max-age=3600');
    return c.json(metadatosDelServidor(new URL(c.req.url).origin, catalogoDe(c.env)));
  });

  // Solo las apps de los productos pueden leer estas respuestas desde el navegador: la unión de sus
  // orígenes (HU-C3.5). Entrar, renovar y crear la organización comparten CORS, kill switch y
  // configuración.
  const catalogoDe = (env: Env) => dependencias.catalogo ?? catalogoDelDestino(env.DESTINO);
  const corsDelCuaderno = cors({
    origin: (origen, c) =>
      origenesDeTodos(catalogoDe(c.env as Env), origenesDe(c.env as Env)).includes(origen)
        ? origen
        : null,
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
      catalogo: catalogoDe(c.env),
    });
    await siguiente();
    return undefined;
  };
  /**
   * HU-C3.5: una sesión solo se usa desde la app de su producto, aunque otra app esté en la unión
   * de CORS. El producto es el `aud` del token o, en v1, el de su organización en la base. Un v1
   * sin organización no dice su producto: pasa, como hasta hoy, hasta los tokens v2 (HU-C4.3).
   * Un token que no verifica sigue a la ruta, que responde 401 como siempre.
   */
  const desdeSuApp: MiddlewareHandler<{ Bindings: Env; Variables: { entorno: Entorno } }> = async (
    c,
    siguiente,
  ) => {
    const e = c.get('entorno');
    const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
    const reclamos = token
      ? await verificarAcceso(e.firmante.publica, token, e.ahora()).catch(() => null)
      : null;
    const producto =
      reclamos?.aud ?? (reclamos?.org ? await productoDeOrganizacion(e.db, reclamos.org) : null);
    if (producto) {
      const delCatalogo = productoDe(e.catalogo, producto);
      const origen = c.req.header('origin');
      if (
        !('producto' in delCatalogo) ||
        !origen ||
        !origenesDelProducto(delCatalogo.producto, e.origenes).includes(origen)
      ) {
        return c.json(
          { estado: 'otro-producto', motivo: 'Esta sesión es de otra aplicación.' },
          403,
        );
      }
    }
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
    '/api/core/cuenta/*',
  ]) {
    app.use(ruta, corsDelCuaderno);
    app.use(ruta, conEntorno);
    if (!ruta.startsWith('/api/core/auth/') && !ruta.startsWith('/api/core/drive/')) {
      app.use(ruta, desdeSuApp);
    }
  }

  // HU-C9.3: el servidor de autorización para agentes. Sin CORS de las apps: lo llama el agente,
  // no una página. Solo donde ya se anuncia (`oauth.ts`).
  app.use('/oauth/*', conEntorno);
  app.post('/oauth/register', (c) =>
    servidorOAuthActivo(c.env.DESTINO) ? registrarCliente(c, c.get('entorno')) : c.notFound(),
  );
  // HU-C9.5: el canje del código y del refresh. Lo llama el agente, desde cualquier origen.
  app.post('/oauth/token', (c) =>
    servidorOAuthActivo(c.env.DESTINO) ? canjearToken(c, c.get('entorno')) : c.notFound(),
  );
  // HU-C9.6: el agente devuelve su acceso (RFC 7009).
  app.post('/oauth/revoke', (c) =>
    servidorOAuthActivo(c.env.DESTINO) ? revocarToken(c, c.get('entorno')) : c.notFound(),
  );
  // HU-C9.4: autorizar con consentimiento. La pantalla es la página estática /autorizar/.
  app.get('/oauth/authorize', (c) =>
    servidorOAuthActivo(c.env.DESTINO)
      ? inicioDeAutorizacion(c, c.get('entorno'), fetchDeLaRed)
      : c.notFound(),
  );

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
  app.post('/api/core/cuenta/espacios', (c) =>
    espaciosDeLaCuenta(c, { ...c.get('entorno'), destino: c.env.DESTINO }),
  );
  app.post('/api/core/interes/ver', (c) => verInteres(c, c.get('entorno')));
  // HU-C7.5, HU-C7.6 y HU-C7.8: lo de la persona en su cuenta (`mi-cuenta.ts`).
  app.post('/api/core/cuenta/sesiones', (c) => verSesiones(c, c.get('entorno')));
  app.post('/api/core/cuenta/sesiones/cerrar', (c) => cerrarSesiones(c, c.get('entorno')));
  app.post('/api/core/cuenta/pagos', (c) => verPagos(c, c.get('entorno')));
  app.post('/api/core/cuenta/actividad', (c) => verActividad(c, c.get('entorno')));
  // HU-C9.6: los asistentes con acceso, y quitarlo.
  app.post('/api/core/cuenta/asistentes', (c) => verAsistentes(c, c.get('entorno')));
  app.post('/api/core/cuenta/asistentes/quitar', (c) => quitarAsistente(c, c.get('entorno')));
  // HU-C7.7: tus datos (Ley 1581).
  app.post('/api/core/cuenta/mis-datos', (c) => misDatos(c, c.get('entorno')));
  app.post('/api/core/cuenta/radicados', (c) => verRadicados(c, c.get('entorno')));
  app.post('/api/core/cuenta/radicar', (c) =>
    radicar(
      c,
      c.get('entorno'),
      { token: c.env.TELEGRAM_BOT_TOKEN, chat: c.env.TELEGRAM_CHAT_ID },
      fetchDeLaRed,
    ),
  );
  app.post('/api/core/cuenta/autorizar', (c) =>
    servidorOAuthActivo(c.env.DESTINO)
      ? decidirAutorizacion(c, c.get('entorno'), fetchDeLaRed)
      : c.notFound(),
  );
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
  app.post('/api/core/auth/salir', (c) => salir(c, c.get('entorno')));
  // HU-C10.2: entrar con un enlace al correo; termina en el mismo canje que Google.
  app.post('/api/core/auth/correo/pedir', (c) =>
    pedirEnlace(c, {
      ...c.get('entorno'),
      correoDe: (producto) => correoDelCore(c.env, producto, fetchDeLaRed),
      limitador: c.env.LIMITE_CORREO,
    }),
  );
  app.post('/api/core/auth/correo/ver', (c) => verEnlace(c, c.get('entorno')));
  app.post('/api/core/auth/correo/abrir', (c) => abrirEnlace(c, c.get('entorno')));
  // Copia en el Drive del productor (HU-E8.4, etapa 1): mismo CORS, kill switch y configuración.
  const conDrive = (
    c: Context<{ Bindings: Env; Variables: { entorno: Entorno } }>,
  ): EntornoDrive => ({
    drive: drive(c.env),
    secreto: c.env.CORE_JWT_PRIVATE_KEY ?? '',
    origenes: c.get('entorno').origenes,
    catalogo: c.get('entorno').catalogo,
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
    // HU-C7.7: los avisos de radicados que no salieron se reintentan en la misma vuelta.
    ctx.waitUntil(
      reintentarAvisos(
        env.DB,
        { token: env.TELEGRAM_BOT_TOKEN, chat: env.TELEGRAM_CHAT_ID },
        Date.now(),
      ).then((n) => {
        if (n > 0) console.log(`agro-core: ${n} aviso(s) de radicados enviados`);
      }),
    );
    // HU-C10.3: los avisos de vencimiento por correo, en la primera vuelta de cada hora del día.
    ctx.waitUntil(
      mandarAvisos(
        env.DB,
        catalogoDelDestino(env.DESTINO),
        (producto) => correoDelCore(env, producto, (...a) => fetch(...a)),
        { destino: env.DESTINO, origenes: origenesDe(env) },
        Date.now(),
      ).then((n) => {
        if (n > 0) console.log(`agro-core: ${n} aviso(s) de vencimiento por correo`);
      }),
    );
    // HU-C11.4: un paso de la copia semanal fuera de Cloudflare por vuelta.
    ctx.waitUntil(
      pasoDeLaCopia(
        env.DB,
        env,
        {
          fetch: (...a) => fetch(...a),
          telegram: { token: env.TELEGRAM_BOT_TOKEN, chat: env.TELEGRAM_CHAT_ID },
        },
        Date.now(),
      ).then((r) => {
        if (r.estado === 'hecha') console.log(`agro-core: copia de ${r.base} (${r.bytes} bytes)`);
        if (r.estado === 'cierre') console.log(`agro-core: copia cerrada, ${r.borradas} rotadas`);
      }),
    );
  },
};
