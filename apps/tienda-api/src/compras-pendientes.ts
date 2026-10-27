/**
 * HU-P1.1 (sprint PF1): las compras sin terminar, con el permiso del comprador.
 *
 * - **Solo con la casilla.** En el carrito de una tienda de un plan con `compras_sin_terminar`, el
 *   comprador deja su WhatsApp o su correo y marca «Recordarme mi compra si no la termino», que
 *   nunca viene marcada. Sin la casilla no se guarda nada; desmarcarla borra lo guardado.
 * - **Lo mínimo.** El contacto va cifrado con la llave de datos personales de la tienda; con él, el
 *   código del carrito, sus líneas (variante y cantidad) y el total que calcula el servidor.
 * - **Se borra solo.** A los 30 días, o en cuanto hay un pedido con ese código, la purga diaria la
 *   borra (`purgarComprasPendientes`).
 * - **El comercio escribe desde su teléfono.** El panel muestra las que pasaron 2 horas sin pedido,
 *   con un enlace a su WhatsApp con el mensaje listo; ninguna API de mensajería (BACKLOG §9).
 * - El registro se hace en un `POST` de la isla del carrito: ninguna visita a una página toca la base.
 */
import { cifrarSobre, descifrarSobre, type Kek } from '@ed1/cifrado';
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { type FuncionesPorPlan, funcionesDelPlan } from '@ed1/tienda-schema';
import { z } from 'zod';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import type { Quien } from './catalogo.ts';
import { cotizar } from './cotizar.ts';
import { deksDeLaTienda, dekVigente, paraAbrir } from './llaves.ts';
import { PLAN_GRATUITO, planDeLaTienda } from './plan.ts';
import { anotar } from './registro.ts';

/** Cuánto vive una compra sin terminar, y cuánto espera antes de salir en el panel. */
export const DIAS_DE_UNA_COMPRA_PENDIENTE = 30;
export const HORAS_ANTES_DE_MOSTRARLA = 2;

const CODIGO = /^[0-9A-HJKMNP-TV-Z]{6}$/;
const CELULAR = /^(\+?57)?3\d{9}$/;

export const PeticionDeRecordar = z.object({
  codigo: z.string().regex(CODIGO),
  lineas: z
    .array(
      z.object({ variante: z.string().min(1).max(64), cantidad: z.number().int().min(1).max(200) }),
    )
    .min(1)
    .max(30),
  contacto: z.string().trim().max(120),
  acepta: z.boolean(),
});

/** El contacto escrito, como WhatsApp (+57 y 10 dígitos) o como correo; `null` si no es ninguno. */
export function contactoDeRecordar(
  escrito: string,
): { tipo: 'whatsapp'; valor: string } | { tipo: 'correo'; valor: string } | null {
  const sinEspacios = escrito.replace(/[\s()-]/g, '');
  if (CELULAR.test(sinEspacios)) return { tipo: 'whatsapp', valor: `+57${sinEspacios.slice(-10)}` };
  const correo = z.email().safeParse(escrito.trim().toLowerCase());
  return correo.success ? { tipo: 'correo', valor: correo.data } : null;
}

const contexto = (org: string, codigo: string) => ({
  org,
  tabla: 'compra_pendiente',
  campo: 'sobre',
  id: codigo,
});

/** Si el plan de la tienda incluye las compras sin terminar. */
export async function tieneComprasSinTerminar(db: BaseD1, org: string): Promise<boolean> {
  const plan = (await planDeLaTienda(db, org)) ?? PLAN_GRATUITO;
  return (
    funcionesDelPlan(funciones as unknown as FuncionesPorPlan, plan)?.['compras_sin_terminar'] ===
    true
  );
}

export type ResultadoDeRecordar =
  | { estado: 'guardado' | 'olvidado' }
  | { estado: 'plan' | 'contacto' | 'vacio' | 'sin-llave' };

/** `POST /api/v1/carrito/recordar`: guarda (o, sin la casilla, borra) la compra de este carrito. */
export async function recordarCompra(
  db: BaseD1,
  org: string,
  kek: Kek | null,
  p: z.infer<typeof PeticionDeRecordar>,
  ahora: string,
): Promise<ResultadoDeRecordar> {
  if (!p.acepta) {
    await db
      .prepare('DELETE FROM compra_pendiente WHERE org_id = ? AND codigo = ?')
      .bind(org, p.codigo)
      .run();
    return { estado: 'olvidado' };
  }
  if (!(await tieneComprasSinTerminar(db, org))) return { estado: 'plan' };
  const contacto = contactoDeRecordar(p.contacto);
  if (!contacto) return { estado: 'contacto' };
  if (!kek) return { estado: 'sin-llave' };
  const cot = await cotizar(db, org, { lineas: p.lineas }, ahora);
  if (cot.carrito.length === 0) return { estado: 'vacio' };
  const dek = await dekVigente(db, org, 'datos_personales', kek, ahora);
  const s = await cifrarSobre(dek, contexto(org, p.codigo), JSON.stringify(contacto));
  const vence = new Date(
    Date.parse(ahora) + DIAS_DE_UNA_COMPRA_PENDIENTE * 86_400_000,
  ).toISOString();
  await db
    .prepare(
      `INSERT INTO compra_pendiente (org_id, codigo, lineas, total_cop, sobre, iv, llave_version, creado, actualizado, vence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (org_id, codigo) DO UPDATE SET lineas = excluded.lineas, total_cop = excluded.total_cop,
         sobre = excluded.sobre, iv = excluded.iv, llave_version = excluded.llave_version,
         actualizado = excluded.actualizado, vence = excluded.vence, escrito = NULL`,
    )
    .bind(
      org,
      p.codigo,
      JSON.stringify(cot.carrito),
      cot.total,
      s.sobre,
      s.iv,
      s.version,
      ahora,
      ahora,
      vence,
    )
    .run();
  return { estado: 'guardado' };
}

export interface CompraPendiente {
  codigo: string;
  actualizado: string;
  totalCop: number;
  productos: string[];
  contacto: { tipo: 'whatsapp' | 'correo'; valor: string } | null;
}

const bytes = (v: ArrayBuffer | Uint8Array) => (v instanceof Uint8Array ? v : new Uint8Array(v));

/** Las que pasaron 2 horas sin pedido y sin «Ya le escribí», las más recientes primero. */
export async function listarComprasPendientes(
  q: Quien,
  kek: Kek | null,
): Promise<CompraPendiente[]> {
  const desde = new Date(
    Date.parse(q.instante) - HORAS_ANTES_DE_MOSTRARLA * 3_600_000,
  ).toISOString();
  const { results } = await q.db
    .prepare(
      `SELECT cp.codigo, cp.lineas, cp.total_cop, cp.sobre, cp.iv, cp.llave_version, cp.actualizado
         FROM compra_pendiente cp
        WHERE cp.org_id = ? AND cp.escrito IS NULL AND cp.actualizado <= ? AND cp.vence > ?
          AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.org_id = ? AND p.codigo = cp.codigo)
        ORDER BY cp.actualizado DESC LIMIT 50`,
    )
    .bind(q.org, desde, q.instante, q.org)
    .all<{
      codigo: string;
      lineas: string;
      total_cop: number;
      sobre: ArrayBuffer | Uint8Array;
      iv: ArrayBuffer | Uint8Array;
      llave_version: number;
      actualizado: string;
    }>();
  if (results.length === 0) return [];
  const variantes = [
    ...new Set(
      results.flatMap((r) =>
        (JSON.parse(r.lineas) as { variante: string }[]).map((l) => l.variante),
      ),
    ),
  ];
  const { results: nombres } = await q.db
    .prepare(
      `SELECT v.id, p.nombre, v.clave FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.id IN (SELECT value FROM json_each(?))`,
    )
    .bind(q.org, JSON.stringify(variantes))
    .all<{ id: string; nombre: string; clave: string }>();
  const nombreDe = new Map(
    nombres.map((n) => [
      n.id,
      n.clave ? `${n.nombre} (${n.clave.split('|').join(', ')})` : n.nombre,
    ]),
  );
  const deks = kek ? await deksDeLaTienda(q.db, q.org, 'datos_personales', paraAbrir(kek)) : null;
  return Promise.all(
    results.map(async (r) => {
      let contacto: CompraPendiente['contacto'] = null;
      if (deks) {
        try {
          contacto = JSON.parse(
            await descifrarSobre(deks, contexto(q.org, r.codigo), {
              sobre: bytes(r.sobre),
              iv: bytes(r.iv),
              version: r.llave_version,
            }),
          ) as CompraPendiente['contacto'];
        } catch {
          contacto = null;
        }
      }
      return {
        codigo: r.codigo,
        actualizado: r.actualizado,
        totalCop: r.total_cop,
        productos: (JSON.parse(r.lineas) as { variante: string; cantidad: number }[]).map(
          (l) => `${l.cantidad} × ${nombreDe.get(l.variante) ?? 'Producto'}`,
        ),
        contacto,
      };
    }),
  );
}

/** «Ya le escribí»: sale de la lista y queda en el registro (sin el contacto). */
export async function marcarEscrita(q: Quien, codigo: string): Promise<boolean> {
  if (!CODIGO.test(codigo)) return false;
  const [r] = await q.db.batch([
    q.db
      .prepare(
        'UPDATE compra_pendiente SET escrito = ? WHERE org_id = ? AND codigo = ? AND escrito IS NULL',
      )
      .bind(q.instante, q.org, codigo),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'compra.escrita',
      entidad: 'compra_pendiente',
      entidadId: codigo,
      antes: null,
      despues: { codigo },
      instante: q.instante,
    }),
  ]);
  return (r?.meta?.changes ?? 0) > 0;
}

/** La purga diaria: las vencidas y las que ya terminaron en un pedido. */
export const purgarComprasPendientes = (db: BaseD1, org: string, ahora: string): SentenciaD1 =>
  db
    .prepare(
      `DELETE FROM compra_pendiente WHERE org_id = ?1 AND (vence <= ?2
         OR codigo IN (SELECT codigo FROM pedido WHERE org_id = ?1 AND codigo IN (SELECT codigo FROM compra_pendiente WHERE org_id = ?1)))`,
    )
    .bind(org, ahora);
