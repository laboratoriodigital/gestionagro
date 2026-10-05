/**
 * Sesiones del CORE en la tabla `sesion` (HU-E4.2, ARQUITECTURA §5.4). Sin tablas nuevas.
 *
 * 1. Al volver de Google se crea la sesión con un **código de entrada**: un secreto de un solo uso
 *    que vence en 2 minutos y viaja a la app en el fragmento `#` (P13: el fragmento no llega a
 *    ningún servidor). En `refresh_hash` va el hash del código.
 * 2. La app lo **canjea** con un POST: el mismo UPDATE cambia el hash por el de un refresh token
 *    nuevo y alarga la sesión a 60 días. Si el código ya se usó o venció, no cambia ninguna fila:
 *    por eso sirve una sola vez.
 * 3. **Refrescar** da un access token nuevo. El refresh se rota a lo sumo una vez al día (CA3):
 *    cada rotación es una escritura en D1. El último giro se deduce de `expira` (= giro + 60 días),
 *    sin columnas nuevas.
 *
 * Escrituras por persona y día: 1 sesión al entrar (2 filas con el índice de `refresh_hash`),
 * 1 canje y como máximo 1 rotación por teléfono.
 */
import type { BaseD1 } from '@ed1/d1';
import { hashDe, secretoAlAzar } from '@ed1/tokens';

export const VIDA_CODIGO_MS = 2 * 60 * 1000;
export const VIDA_REFRESH_MS = 60 * 24 * 60 * 60 * 1000;
export const ROTAR_CADA_MS = 24 * 60 * 60 * 1000;
/** `dispositivo` mientras el código no se canjea; la app manda el suyo al canjear. */
const SIN_CANJEAR = 'sin-canjear';

const iso = (ms: number) => new Date(ms).toISOString();

export class SesionInvalida extends Error {
  override name = 'SesionInvalida';
}

/** Crea la sesión y devuelve el código de entrada (en claro, solo esta vez). */
export async function crearSesion(db: BaseD1, usuarioId: string, ahora: number): Promise<string> {
  const codigo = secretoAlAzar();
  await db
    .prepare(
      'INSERT INTO sesion (id, usuario_id, refresh_hash, dispositivo, creado, expira) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .bind(
      secretoAlAzar(),
      usuarioId,
      await hashDe(codigo),
      SIN_CANJEAR,
      iso(ahora),
      iso(ahora + VIDA_CODIGO_MS),
    )
    .run();
  return codigo;
}

export interface SesionActiva {
  usuarioId: string;
  /** Refresh nuevo cuando se emitió o rotó; null si sigue valiendo el que la app ya tiene. */
  refresh: string | null;
  refreshVence: number;
}

export async function canjearCodigo(
  db: BaseD1,
  codigo: string,
  dispositivo: string,
  ahora: number,
): Promise<SesionActiva> {
  const refresh = secretoAlAzar();
  const vence = ahora + VIDA_REFRESH_MS;
  const fila = await db
    .prepare(
      `UPDATE sesion SET refresh_hash = ?, dispositivo = ?, expira = ?
        WHERE refresh_hash = ? AND dispositivo = ? AND revocado IS NULL AND expira > ?
        RETURNING usuario_id`,
    )
    .bind(
      await hashDe(refresh),
      dispositivo,
      iso(vence),
      await hashDe(codigo),
      SIN_CANJEAR,
      iso(ahora),
    )
    .first<{ usuario_id: string }>();
  if (!fila) {
    throw new SesionInvalida(
      'Este enlace de entrada ya se usó o venció. Vuelve a tocar «Entrar con Google».',
    );
  }
  return { usuarioId: fila.usuario_id, refresh, refreshVence: vence };
}

export async function refrescar(db: BaseD1, refresh: string, ahora: number): Promise<SesionActiva> {
  const hash = await hashDe(refresh);
  const sesion = await db
    .prepare(
      'SELECT id, usuario_id, expira, revocado, dispositivo FROM sesion WHERE refresh_hash = ?',
    )
    .bind(hash)
    .first<{
      id: string;
      usuario_id: string;
      expira: string;
      revocado: string | null;
      dispositivo: string;
    }>();
  const expira = sesion ? Date.parse(sesion.expira) : 0;
  if (!sesion || sesion.dispositivo === SIN_CANJEAR || expira <= ahora) {
    throw new SesionInvalida('La sesión venció. Vuelve a entrar con Google.');
  }
  if (sesion.revocado) {
    throw new SesionInvalida(
      'El acceso de este teléfono fue retirado. Pídele a quien administra la finca que te invite de nuevo.',
    );
  }
  const ultimoGiro = expira - VIDA_REFRESH_MS;
  if (ahora - ultimoGiro < ROTAR_CADA_MS) {
    return { usuarioId: sesion.usuario_id, refresh: null, refreshVence: expira };
  }
  const nuevo = secretoAlAzar();
  const vence = ahora + VIDA_REFRESH_MS;
  const r = await db
    .prepare('UPDATE sesion SET refresh_hash = ?, expira = ? WHERE id = ? AND refresh_hash = ?')
    .bind(await hashDe(nuevo), iso(vence), sesion.id, hash)
    .run();
  // Dos refrescos simultáneos del mismo teléfono: el segundo ya no encuentra el hash viejo.
  if (!r.meta.changes)
    throw new SesionInvalida('La sesión cambió mientras se renovaba. Intenta de nuevo.');
  return { usuarioId: sesion.usuario_id, refresh: nuevo, refreshVence: vence };
}
