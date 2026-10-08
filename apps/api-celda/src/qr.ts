/**
 * Firma del QR de trazabilidad (HU-E6.4, ARQUITECTURA §5.9).
 *
 * - `GET /api/claves-qr` (sin token): la clave pública con que la página `/agro/t/` verifica. El
 *   despliegue la lee y la pone dentro de la página al publicarla: escanear no pide nada.
 * - `POST /api/v1/lotes/firmar` (con token): la celda arma los datos del QR **con lo que ella
 *   tiene guardado** (el lote, sus cosechas, la finca, las áreas y el ciclo) y los firma con su
 *   clave Ed25519 (`CELDA_QR_PRIVATE_KEY`). No firma lo que mande el teléfono: lo que certifica
 *   es lo que está en la nube. Una solicitud por lote (presupuesto de la historia).
 *
 * Solo campos de `@ed1/trazabilidad` (CA3): ningún dato personal.
 */
import { puedeRegistro } from '@ed1/agro-schema/sync';
import { firmanteDesde } from '@ed1/tokens';
import {
  type ClavePublicaQr,
  codificar,
  type DatosQr,
  fragmento,
  mensajeAFirmar,
} from '@ed1/trazabilidad';
import type { ContextoCelda, Env } from './worker.ts';

const marcadores = (n: number) => Array.from({ length: n }, () => '?').join(', ');

async function firmanteDeLaCelda(env: Env) {
  if (!env.CELDA_QR_PRIVATE_KEY) return null;
  return firmanteDesde(env.CELDA_QR_PRIVATE_KEY);
}

export async function clavesQr(c: ContextoCelda): Promise<Response> {
  const f = await firmanteDeLaCelda(c.env);
  if (!f) {
    return c.json({ estado: 'sin-configurar', motivo: 'Falta CELDA_QR_PRIVATE_KEY' }, 503);
  }
  const clave: ClavePublicaQr = { kid: f.publica.kid, x: f.publica.x };
  return c.json({ claves: [clave] });
}

interface FilaRegistro {
  id: string;
  tipo: string;
  finca_id: string;
  area_ids: string;
  ciclo_id: string | null;
  fecha_agronomica: string;
  datos: string;
}

export async function firmarLote(c: ContextoCelda): Promise<Response> {
  const { org, rol, db } = c.get('sesion');
  if (!puedeRegistro(rol, 'escribir', 'lote_venta')) {
    return c.json({ estado: 'sin-permiso', motivo: 'Tu rol no arma lotes.' }, 403);
  }
  const firmante = await firmanteDeLaCelda(c.env);
  if (!firmante) {
    return c.json(
      { estado: 'sin-configurar', motivo: 'La nube todavía no puede firmar etiquetas.' },
      503,
    );
  }
  const { lote_id } = (await c.req.json().catch(() => ({}))) as { lote_id?: unknown };
  if (typeof lote_id !== 'string' || !lote_id) {
    return c.json({ estado: 'invalido', motivo: 'Falta el lote.' }, 400);
  }
  const lote = await db
    .prepare(
      `SELECT id, tipo, finca_id, area_ids, ciclo_id, fecha_agronomica, datos FROM registro
        WHERE org_id = ? AND id = ? AND tipo = 'lote_venta'`,
    )
    .bind(org, lote_id)
    .first<FilaRegistro>();
  if (!lote) {
    return c.json(
      {
        estado: 'no-encontrado',
        motivo: 'El lote todavía no está en la nube: sincroniza y vuelve a intentarlo.',
      },
      404,
    );
  }
  const corregido = await db
    .prepare('SELECT id FROM registro WHERE org_id = ? AND anula_id = ? LIMIT 1')
    .bind(org, lote_id)
    .first<{ id: string }>();
  if (corregido) {
    return c.json(
      { estado: 'corregido', motivo: 'Ese lote se corrigió: genera la etiqueta del lote vigente.' },
      409,
    );
  }
  const datosLote = JSON.parse(lote.datos) as { codigo: string; cosecha_ids: string[] };
  const ids = datosLote.cosecha_ids;
  const cosechas = await db
    .prepare(
      `SELECT id, tipo, finca_id, area_ids, ciclo_id, fecha_agronomica, datos FROM registro
        WHERE org_id = ? AND id IN (${marcadores(ids.length)})`,
    )
    .bind(org, ...ids)
    .all<FilaRegistro>();
  if (cosechas.results.length !== ids.length) {
    return c.json(
      {
        estado: 'incompleto',
        motivo: 'Faltan cosechas del lote en la nube: sincroniza y vuelve a intentarlo.',
      },
      409,
    );
  }
  const areaIds = [...new Set(cosechas.results.flatMap((r) => JSON.parse(r.area_ids) as string[]))];
  const cicloIds = [...new Set(cosechas.results.flatMap((r) => (r.ciclo_id ? [r.ciclo_id] : [])))];
  const catalogoIds = [lote.finca_id, ...areaIds, ...cicloIds];
  const catalogos = await db
    .prepare(
      `SELECT id, entidad, datos FROM catalogo WHERE org_id = ? AND id IN (${marcadores(catalogoIds.length)})`,
    )
    .bind(org, ...catalogoIds)
    .all<{ id: string; entidad: string; datos: string }>();
  const de = new Map(
    catalogos.results.map((f) => [f.id, JSON.parse(f.datos) as Record<string, unknown>]),
  );
  const finca = de.get(lote.finca_id);
  if (!finca) {
    return c.json({ estado: 'incompleto', motivo: 'La finca no está en la nube.' }, 409);
  }
  const ciclos = cicloIds
    .map((id) => de.get(id))
    .filter((x): x is Record<string, unknown> => x !== undefined);
  const unico = <T>(valores: T[]) => (new Set(valores).size === 1 ? (valores[0] ?? null) : null);
  const fechas = cosechas.results.map((r) => r.fecha_agronomica).sort();
  const datos: DatosQr = {
    v: 1,
    l: datosLote.codigo,
    f: String(finca['nombre']),
    m: String(finca['municipio']),
    r: finca['regimen'] === 'ecologico' ? 'ecologico' : 'convencional',
    c: unico(ciclos.map((x) => String(x['cultivo']))),
    va: unico(ciclos.map((x) => String(x['variedad']))),
    a: areaIds.map((id) => String(de.get(id)?.['nombre'] ?? 'Área')),
    d: [fechas[0] ?? lote.fecha_agronomica, fechas.at(-1) ?? lote.fecha_agronomica],
    k: firmante.publica.kid,
  };
  const codificado = codificar(datos);
  const firma = new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, firmante.privada, mensajeAFirmar(codificado)),
  );
  return c.json({ fragmento: fragmento(codificado, firma), datos });
}
