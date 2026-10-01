/**
 * Worker del CORE v0 (ADR-9, ARQUITECTURA §5.4), con Hono (ADR-12).
 *
 * - `GET /api/core/salud`: la usa la prueba de humo del despliegue. Dice cuántas celdas activas
 *   tiene el directorio; con 0 responde 503, porque un CORE que no puede crear organizaciones no
 *   debe parecer sano (P1).
 * - `GET /api/core/claves`: la clave pública con la que las celdas verifican los tokens (CA5).
 * - `/api/core/auth/*`: entrar con Google y renovar la sesión (HU-E4.2, `entrar.ts`).
 *
 * Kill switch `ks:agro-core` (HU-E8.1): apagado, `/api/core/auth/*` responde 503 y nadie entra ni
 * renueva. Quien ya tiene un access token sigue sincronizando hasta que venza (12 h); el cuaderno
 * sigue registrando en el teléfono (ARQUITECTURA §5.3).
 *
 * Una configuración que falta (secreto, orígenes) responde 503 y lo dice en el log: nunca entra
 * con valores de fábrica (P1).
 */
import {
  crearLectorKillSwitch,
  type LectorKillSwitch,
  type LectorKv,
} from '@gestionagro/kill-switch';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { PRODUCTO_CORE } from './constantes.ts';
import type { BaseD1 } from './d1.ts';
import {
  callback,
  canje,
  type Entorno,
  inicio,
  type ProveedorGoogle,
  proveedorGoogle,
  renovar,
} from './entrar.ts';
import { type Firmante, firmanteDesde } from './tokens.ts';

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
}

export interface Dependencias {
  google?: (env: Env) => ProveedorGoogle;
  ahora?: () => number;
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

export function crearApp(dependencias: Dependencias = {}) {
  const ahora = dependencias.ahora ?? (() => Date.now());
  const google =
    dependencias.google ??
    ((env: Env) => proveedorGoogle(env.GOOGLE_CLIENT_ID ?? '', env.GOOGLE_CLIENT_SECRET ?? ''));
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

  // Solo el cuaderno puede leer las respuestas de canje y renovación desde el navegador.
  app.use(
    '/api/core/auth/*',
    cors({
      origin: (origen, c) => (origenesDe(c.env as Env).includes(origen) ? origen : null),
      allowMethods: ['POST'],
      allowHeaders: ['content-type'],
      maxAge: 600,
    }),
  );

  app.use('/api/core/auth/*', async (c, siguiente) => {
    if (c.env.FLAGS && (await lectorDe(c.env.FLAGS).apagado(PRODUCTO_CORE))) {
      c.header('retry-after', '120');
      return c.json(
        {
          estado: 'apagado',
          motivo: 'Entrar está en pausa. Tus registros siguen guardados en el teléfono.',
        },
        503,
      );
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
  });

  app.get('/api/core/auth/google/inicio', (c) => inicio(c, c.get('entorno')));
  app.get('/api/core/auth/google/callback', (c) => callback(c, c.get('entorno')));
  app.post('/api/core/auth/canje', (c) => canje(c, c.get('entorno')));
  app.post('/api/core/auth/refrescar', (c) => renovar(c, c.get('entorno')));

  app.notFound((c) =>
    c.json({ estado: 'no-encontrado', motivo: 'Ruta del CORE desconocida' }, 404),
  );
  return app;
}

export default crearApp();
