/**
 * Antiabuso (HU-T13.6, TIENDA-3.0 §4.4): suspender una tienda con un clic y vigilar los hostnames
 * que una tienda dejó.
 *
 * - **Suspender** pone la tienda en `suspendida` y reescribe sus direcciones en `TIENDA_HOSTS` con
 *   ese estado: el despacho responde 451 con una página neutra en todas, también en su API, y las
 *   demás tiendas siguen vendiendo (CA3). Nada se borra. **Levantar** la deja como estaba: `abierta`
 *   si tenía versión publicada, `borrador` si no. Queda en el registro de la tienda, con su motivo.
 *   Lo pide el operador con el flujo `suspender-tienda` (un clic en Actions), por la ruta del
 *   despliegue, con el secreto del despacho.
 * - **Los hostnames colgantes (CA2):** un dominio propio retirado que todavía apunta su CNAME aquí
 *   es una invitación a tomarlo. La tarea diaria pregunta el DNS público de los retirados y avisa por
 *   Telegram; reclamarlo igual exige el TXT nuevo (HU-T13.1 CA3).
 */
import type { BaseD1 } from '@ed1/d1';
import { DESTINO_DEL_CNAME } from '@ed1/tienda-schema/dominios';
import { apuntarLaTienda, type KvDeHosts } from './dominios.ts';
import { anotar } from './registro.ts';

export type AccionDeSuspension = 'suspender' | 'levantar';

export type ResultadoDeSuspension =
  | { estado: 'ok'; tienda: string; antes: string; ahora: string }
  | { estado: 'no-existe' }
  | { estado: 'sin-cambio'; tienda: string; ahora: string };

/** Suspende o levanta una tienda, en el shard donde viva. */
export async function cambiarSuspension(e: {
  shards: [string, BaseD1][];
  control: BaseD1;
  celda: string;
  hosts: Pick<KvDeHosts, 'put'>;
  org: string;
  accion: AccionDeSuspension;
  motivo: string;
  instante: string;
}): Promise<ResultadoDeSuspension> {
  for (const [nombre, db] of e.shards) {
    const t = await db
      .prepare('SELECT estado, version_publicada FROM tienda WHERE org_id = ?')
      .bind(e.org)
      .first<{ estado: string; version_publicada: number | null }>();
    if (!t) continue;
    const ahora =
      e.accion === 'suspender' ? 'suspendida' : t.version_publicada ? 'abierta' : 'borrador';
    // Una tienda dada de baja no se suspende ni se levanta: ya no existe para nadie.
    if (t.estado === 'baja' || (e.accion === 'levantar' && t.estado !== 'suspendida'))
      return { estado: 'sin-cambio', tienda: nombre, ahora: t.estado };
    if (t.estado === ahora) return { estado: 'sin-cambio', tienda: nombre, ahora };
    await db.batch([
      db
        .prepare('UPDATE tienda SET estado = ?, actualizado = ? WHERE org_id = ? AND estado = ?')
        .bind(ahora, e.instante, e.org, t.estado),
      await anotar(db, {
        org: e.org,
        actor: 'sistema:operador',
        accion: e.accion === 'suspender' ? 'tienda.suspender' : 'tienda.levantar',
        entidad: 'tienda',
        entidadId: e.org,
        antes: { estado: t.estado },
        despues: { estado: ahora, motivo: e.motivo.slice(0, 300) },
        instante: e.instante,
      }),
    ]);
    await apuntarLaTienda({
      db,
      org: e.org,
      actor: 'sistema:operador',
      instante: e.instante,
      control: e.control,
      celda: e.celda,
      shardNombre: nombre,
      hosts: e.hosts,
    });
    return { estado: 'ok', tienda: nombre, antes: t.estado, ahora };
  }
  return { estado: 'no-existe' };
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Cuántos retirados se preguntan por corrida: unas pocas solicitudes, una vez al día. */
export const COLGANTES_POR_VUELTA = 30;

/**
 * CA2: los dominios propios retirados cuyo nombre todavía apunta aquí, preguntando el DNS público
 * (DNS sobre HTTPS de Cloudflare, en JSON). Uno que no responde no se da por colgante.
 */
export async function hostnamesColgantes(
  control: BaseD1,
  f: Fetch,
): Promise<{ revisados: number; colgantes: string[] }> {
  const { results } = await control
    .prepare(
      "SELECT hostname FROM dominio WHERE tipo = 'propio' AND estado = 'retirado' ORDER BY retirado DESC LIMIT ?",
    )
    .bind(COLGANTES_POR_VUELTA)
    .all<{ hostname: string }>();
  const colgantes: string[] = [];
  for (const { hostname } of results) {
    try {
      const r = await f(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`,
        { headers: { accept: 'application/dns-json' } },
      );
      const cuerpo = (await r.json()) as { Answer?: { data?: string }[] };
      const apunta = (cuerpo.Answer ?? []).some(
        (a) => a.data?.replace(/\.$/, '').toLowerCase() === DESTINO_DEL_CNAME,
      );
      if (apunta) colgantes.push(hostname);
    } catch {
      // Sin respuesta, se pregunta mañana.
    }
  }
  return { revisados: results.length, colgantes };
}
