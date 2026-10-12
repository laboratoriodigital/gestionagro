/**
 * Los certificados de firma de las cajas (HU-Q8.1; PARQUEADERO §11.4, ADR-36).
 *
 * - `GET /api/claves-recibo` (sin token): la llave pública de recibos de la celda. El despliegue la
 *   lee y la pone dentro de `/r/`: abrir un recibo no pide nada a la nube.
 * - `POST /api/v1/dispositivos/certificado` (con token): la caja manda la llave pública que generó
 *   y la celda le devuelve un certificado firmado con `CELDA_RECIBO_PRIVATE_KEY` (`@ed1/firma`),
 *   con la serie que la caja tiene en la celda y su organización, que salen de la base y del
 *   token, nunca del cuerpo.
 *   - Vence a los 30 días. Con la misma llave y más de una semana por delante, devuelve el mismo
 *     vencimiento: Ed25519 es determinista, así que es el mismo certificado y la renovación solo
 *     ocurre en la última semana.
 *   - Una caja retirada no se certifica (CA3 de HU-Q7.7): lo que firmó antes sigue valiendo hasta
 *     su vencimiento, y lo que firme después sale «con un certificado vencido».
 *   - Lo pide cualquier rol: es la caja la que firma, no la persona.
 *   - Una consulta para leer la caja y una para anotar la llave y el vencimiento.
 */
import { desdeBase64url, esCanonico, firmarCertificado } from '@ed1/firma';
import { firmanteDesde } from '@ed1/tokens';
import { RETIRADA } from './dispositivos.ts';
import type { ContextoCelda, Env } from './worker.ts';

export const VIGENCIA_S = 30 * 24 * 60 * 60;
export const RENOVAR_ANTES_S = 7 * 24 * 60 * 60;

let firmante: { secreto: string; f: Awaited<ReturnType<typeof firmanteDesde>> } | null = null;
async function firmanteDeLaCelda(env: Env) {
  const secreto = env.CELDA_RECIBO_PRIVATE_KEY;
  if (!secreto) return null;
  if (firmante?.secreto !== secreto) firmante = { secreto, f: await firmanteDesde(secreto) };
  return firmante.f;
}

const SIN_LLAVE = {
  estado: 'sin-configurar',
  motivo: 'La nube todavía no certifica cajas. Los recibos salen sin firma.',
} as const;

export async function clavesRecibo(c: ContextoCelda): Promise<Response> {
  const f = await firmanteDeLaCelda(c.env);
  if (!f) {
    console.error('parqueadero-api: falta CELDA_RECIBO_PRIVATE_KEY');
    return c.json({ estado: 'sin-configurar', motivo: 'Falta CELDA_RECIBO_PRIVATE_KEY' }, 503);
  }
  return c.json({ claves: [{ kid: f.publica.kid, x: f.publica.x }] });
}

interface FilaCaja {
  serie: string;
  estado: 'activo' | 'retirado';
  llave_publica: string | null;
  certificado_hasta: string | null;
}

export async function certificar(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const { org, db } = c.get('sesion');
  const cuerpo = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const dispositivo = cuerpo?.['dispositivo'];
  const llave = cuerpo?.['llave'];
  if (typeof dispositivo !== 'string' || !dispositivo || dispositivo.length > 120) {
    return c.json({ estado: 'invalido', motivo: 'Falta la caja' }, 400);
  }
  if (typeof llave !== 'string' || !esCanonico(llave) || desdeBase64url(llave).length !== 32) {
    return c.json({ estado: 'invalido', motivo: 'La llave no es una llave pública Ed25519' }, 400);
  }
  const f = await firmanteDeLaCelda(c.env);
  if (!f) return c.json(SIN_LLAVE, 503);

  const caja = await db
    .prepare(
      'SELECT serie, estado, llave_publica, certificado_hasta FROM dispositivo WHERE org_id = ? AND id = ?',
    )
    .bind(org, dispositivo)
    .first<FilaCaja>();
  if (!caja) {
    return c.json(
      { estado: 'no-encontrado', motivo: 'Esta caja todavía no está en la nube.' },
      404,
    );
  }
  if (caja.estado === 'retirado') return c.json(RETIRADA, 403);

  const ahoraS = Math.floor(ahora() / 1000);
  const vigente = caja.certificado_hasta
    ? Math.floor(Date.parse(caja.certificado_hasta) / 1000)
    : 0;
  const hasta =
    caja.llave_publica === llave && vigente - ahoraS > RENOVAR_ANTES_S
      ? vigente
      : ahoraS + VIGENCIA_S;
  const certificado = await firmarCertificado(
    { kid: f.publica.kid, llave, org, serie: caja.serie, hasta },
    async (m) => new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, f.privada, m)),
  );
  if (hasta !== vigente || caja.llave_publica !== llave) {
    await db
      .prepare(
        'UPDATE dispositivo SET llave_publica = ?, certificado_hasta = ? WHERE org_id = ? AND id = ?',
      )
      .bind(llave, new Date(hasta * 1000).toISOString(), org, dispositivo)
      .run();
  }
  return c.json({ certificado, serie: caja.serie, hasta: hasta * 1000, kid: f.publica.kid });
}
