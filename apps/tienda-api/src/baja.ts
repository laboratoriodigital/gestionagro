/**
 * Dar de baja una tienda y el borrado criptográfico (HU-T13.7, TIENDA-3.0 §14.2; bitácora tienda3 39).
 *
 * 1. **La baja (CA1):** el propietario, recién entrado, escribe el nombre de su tienda para
 *    confirmar. Antes, el panel le ofrece «Descargar todo» (HU-T10.7). La tienda queda en `baja`;
 *    sus direcciones se retiran, nunca se borran (TIENDA §4.4), y salen de `TIENDA_HOSTS`. Los
 *    dominios propios se borran de Cloudflare for SaaS.
 * 2. **A los 30 días:** la tarea diaria borra sus DEK de datos personales y de índices, y sus
 *    respaldos de R2, que guardan esas mismas llaves envueltas. Desde ahí ningún contacto de esa
 *    tienda se puede descifrar (CA2). Lo único que queda es el historial de D1 (Time Travel), que se
 *    borra solo: por eso la política dice 60 días como máximo, no 35.
 */
import type { BaseD1 } from '@ed1/d1';
import { z } from 'zod';
import { guardarOperacion, type Problema, yaAplicada } from './catalogo.ts';
import type { KvDeHosts, QuienDelDominio } from './dominios.ts';
import { claveDelHost } from './hosts.ts';
import { anotar } from './registro.ts';
import type { AlmacenDeRespaldos } from './respaldos.ts';
import { borrarHostname, type Saas } from './saas.ts';

/** Los días entre la baja y el borrado de las llaves: el tiempo para descargar lo suyo. */
export const DIAS_PARA_BORRAR = 30;
/** Lo que el historial de D1 (Time Travel) puede volver atrás, con Workers Paid. */
export const DIAS_DE_HISTORIA_DE_D1 = 30;
/** El plazo que dice la política: el borrado y el historial que lo podría deshacer. */
export const DIAS_DEL_BORRADO_EFECTIVO = DIAS_PARA_BORRAR + DIAS_DE_HISTORIA_DE_D1;

const DIA_MS = 86_400_000;

const Baja = z.object({ op: z.string().min(8).max(64), nombre: z.string().max(200) });

export type ResultadoDeLaBaja =
  | { estado: 'guardado'; id: string; version: number; borrado: string }
  | { estado: 'problemas'; problemas: Problema[] }
  | { estado: 'no-existe'; motivo: string };

/** CA1: la baja que pide el propietario. */
export async function darDeBaja(
  q: QuienDelDominio & { hosts: KvDeHosts },
  saas: Saas | null,
  cuerpo: unknown,
): Promise<ResultadoDeLaBaja> {
  const r0 = Baja.safeParse(cuerpo);
  if (!r0.success)
    return {
      estado: 'problemas',
      problemas: [{ campo: 'nombre', mensaje: 'Escribe el nombre de tu tienda.' }],
    };
  const previa = await yaAplicada<ResultadoDeLaBaja>(q, r0.data.op);
  if (previa) return previa;
  const tienda = await q.db
    .prepare('SELECT nombre, estado FROM tienda WHERE org_id = ?')
    .bind(q.org)
    .first<{ nombre: string; estado: string }>();
  if (!tienda || tienda.estado === 'baja')
    return { estado: 'no-existe', motivo: 'Esta tienda ya está dada de baja.' };
  if (r0.data.nombre.trim().toLowerCase() !== tienda.nombre.trim().toLowerCase()) {
    return {
      estado: 'problemas',
      problemas: [
        { campo: 'nombre', mensaje: `Escribe el nombre exacto de tu tienda: ${tienda.nombre}.` },
      ],
    };
  }
  const borrado = new Date(Date.parse(q.instante) + DIAS_PARA_BORRAR * DIA_MS).toISOString();
  const r: ResultadoDeLaBaja = { estado: 'guardado', id: q.org, version: 1, borrado };
  // Las direcciones: los dominios propios salen de Cloudflare; todas quedan retiradas y fuera del KV.
  const { results: dominios } = await q.control
    .prepare(
      "SELECT hostname, tipo, cf_hostname_id FROM dominio INDEXED BY dominio_por_tienda WHERE org_id = ? AND estado <> 'retirado'",
    )
    .bind(q.org)
    .all<{ hostname: string; tipo: string; cf_hostname_id: string | null }>();
  for (const d of dominios) {
    if (d.tipo === 'propio' && d.cf_hostname_id && saas) {
      await borrarHostname(saas, d.cf_hostname_id).catch((e) =>
        console.error(`tienda-api: Cloudflare no borró un dominio de la baja (${String(e)})`),
      );
    }
  }
  await q.control
    .prepare(
      "UPDATE dominio SET estado = 'retirado', rol = 'alias', retirado = ?, cf_hostname_id = NULL WHERE org_id = ? AND estado <> 'retirado'",
    )
    .bind(q.instante, q.org)
    .run();
  for (const d of dominios) await q.hosts.delete(claveDelHost(d.hostname));
  await q.db.batch([
    q.db
      .prepare(
        "UPDATE tienda SET estado = 'baja', baja_pedida = ?, actualizado = ? WHERE org_id = ? AND estado <> 'baja'",
      )
      .bind(q.instante, q.instante, q.org),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'tienda.baja',
      entidad: 'tienda',
      entidadId: q.org,
      antes: { estado: tienda.estado },
      despues: { estado: 'baja', borrado },
      instante: q.instante,
    }),
    guardarOperacion(q, r0.data.op, 'baja', r),
  ]);
  return r;
}

/**
 * La tarea diaria: a las tiendas dadas de baja hace 30 días o más les borra sus DEK de datos
 * personales y de índices, y sus respaldos. Devuelve cuántas borró.
 */
export async function borrarLasBajas(e: {
  shards: [string, BaseD1][];
  almacen?: AlmacenDeRespaldos;
  instante: string;
}): Promise<{ borradas: string[] }> {
  const limite = new Date(Date.parse(e.instante) - DIAS_PARA_BORRAR * DIA_MS).toISOString();
  const borradas: string[] = [];
  for (const [, db] of e.shards) {
    const { results } = await db
      .prepare(
        `SELECT org_id FROM tienda INDEXED BY tienda_baja_por_borrar
          WHERE estado = 'baja' AND datos_borrados IS NULL AND baja_pedida <= ? LIMIT 20`,
      )
      .bind(limite)
      .all<{ org_id: string }>();
    for (const { org_id } of results) {
      // Primero los respaldos: si R2 falla, la llave sigue y mañana se intenta de nuevo (P1).
      if (e.almacen) {
        let cursor: string | undefined;
        do {
          const l = await e.almacen.list({
            prefix: `respaldos/${org_id}/`,
            ...(cursor ? { cursor } : {}),
          });
          if (l.objects.length > 0) await e.almacen.delete(l.objects.map((o) => o.key));
          cursor = l.truncated ? l.cursor : undefined;
        } while (cursor);
      }
      await db.batch([
        db
          .prepare(
            "DELETE FROM llave WHERE org_id = ? AND proposito IN ('datos_personales', 'indices')",
          )
          .bind(org_id),
        db
          .prepare('UPDATE tienda SET datos_borrados = ? WHERE org_id = ?')
          .bind(e.instante, org_id),
        await anotar(db, {
          org: org_id,
          actor: 'sistema:baja',
          accion: 'tienda.datos_borrados',
          entidad: 'tienda',
          entidadId: org_id,
          antes: null,
          despues: { borrado: e.instante },
          instante: e.instante,
        }),
      ]);
      borradas.push(org_id);
    }
  }
  return { borradas };
}
