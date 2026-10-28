/**
 * Los productos digitales (HU-P6.1 y HU-P6.2, sprint PF2; pedido del dueño del 26 oct 2026).
 *
 * - **El archivo vive en un bucket privado** (`DIGITALES`), aparte del de las fotos. Nunca tiene
 *   dirección pública, nunca pasa por el horno ni por «Descargar todo», y no se respalda: es del
 *   comercio (decisión del dueño del 27 oct 2026).
 * - **Subir no gasta CPU.** El cuerpo llega tal cual, con su `content-length`, y va directo a R2 sin
 *   pasar por la memoria del Worker. La huella SHA-256 la calcula el panel y R2 la verifica al
 *   guardar: un archivo que llegó distinto no se guarda.
 * - **Topes del dueño:** 50 MB por archivo y 1 GB por tienda, y solo los tipos de `TIPOS`.
 * - **Se entrega con el pago verificado.** Con el pedido pagado (aviso de Bold o conciliación) o
 *   confirmado por el comercio, el seguimiento pide sus enlaces: cada uno es un secreto que solo ve
 *   el comprador (en la base queda su huella), vale 7 días y 5 descargas. Pedir el seguimiento otra
 *   vez da enlaces nuevos, hasta 10 descargas por pedido y combinación.
 * - **Se descarga como archivo,** desde la dirección de la API, nunca se abre en la tienda.
 */
import type { BaseD1 } from '@ed1/d1';
import { type FuncionesPorPlan, funcionesDelPlan } from '@ed1/tienda-schema';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import type { Quien } from './catalogo.ts';
import { sha256 } from './pedidos.ts';
import { PLAN_GRATUITO, planDeLaTienda } from './plan.ts';
import { anotar } from './registro.ts';

export const TOPE_POR_ARCHIVO = 50_000_000;
export const TOPE_POR_TIENDA = 1_000_000_000;
export const DIAS_DEL_ENLACE = 7;
export const DESCARGAS_POR_ENLACE = 5;
export const DESCARGAS_POR_COMPRA = 10;

/** Los tipos que se venden, con su extensión. Nada que un navegador ejecute. */
export const TIPOS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'video/mp4': 'mp4',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Lo mínimo del bucket que usa este módulo (R2). */
export interface BucketDigital {
  put(
    clave: string,
    valor: ReadableStream | ArrayBuffer,
    opciones: { sha256: string; httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  get(clave: string): Promise<{ body: ReadableStream; size: number } | null>;
  delete(claves: string | string[]): Promise<void>;
}

/** Si el plan de la tienda vende productos digitales. */
export async function vendeDigitales(db: BaseD1, org: string): Promise<boolean> {
  const plan = (await planDeLaTienda(db, org)) ?? PLAN_GRATUITO;
  return (
    funcionesDelPlan(funciones as unknown as FuncionesPorPlan, plan)?.['productos_digitales'] ===
    true
  );
}

type Problema = { campo: string; mensaje: string };
export type ResultadoDeSubir =
  | { estado: 'guardado'; nombre: string; bytes: number }
  | { estado: 'problemas'; problemas: Problema[] }
  | { estado: 'plan' | 'no-existe' };

/** El nombre del archivo como lo verá el comprador: sin rutas ni caracteres raros, con su extensión. */
export function nombreDelArchivo(escrito: string, tipo: string): string {
  const ext = TIPOS[tipo] ?? 'bin';
  const base = escrito
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .normalize('NFD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return `${base || 'archivo'}.${ext}`;
}

/** `POST /api/panel/v1/digitales?variante=…`: el archivo de una combinación de un producto digital. */
export async function subirArchivo(
  q: Quien,
  bucket: BucketDigital,
  p: { variante: string; nombre: string; tipo: string; bytes: number; huella: string },
  cuerpo: ReadableStream,
): Promise<ResultadoDeSubir> {
  if (!(await vendeDigitales(q.db, q.org))) return { estado: 'plan' };
  const problemas: Problema[] = [];
  if (!Object.hasOwn(TIPOS, p.tipo))
    problemas.push({ campo: 'archivo', mensaje: 'sube un PDF, ZIP, MP3, MP4, JPG o PNG' });
  if (!Number.isSafeInteger(p.bytes) || p.bytes < 1 || p.bytes > TOPE_POR_ARCHIVO)
    problemas.push({ campo: 'archivo', mensaje: 'el archivo puede pesar hasta 50 MB' });
  if (!/^[0-9a-f]{64}$/.test(p.huella))
    problemas.push({
      campo: 'archivo',
      mensaje: 'no llegó la huella del archivo: súbelo otra vez',
    });
  if (problemas.length > 0) return { estado: 'problemas', problemas };

  const v = await q.db
    .prepare(
      `SELECT v.id, p.tipo FROM variante v JOIN producto p ON p.org_id = v.org_id AND p.id = v.producto_id
        WHERE v.org_id = ? AND v.id = ? AND v.activa = 1 AND p.borrado IS NULL`,
    )
    .bind(q.org, p.variante)
    .first<{ id: string; tipo: string }>();
  if (!v) return { estado: 'no-existe' };
  if (v.tipo !== 'digital') {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'tipo',
          mensaje: 'marca el producto como digital y guárdalo antes de subir su archivo',
        },
      ],
    };
  }
  const uso = await q.db
    .prepare(
      `SELECT coalesce(sum(bytes), 0) AS total,
              coalesce((SELECT bytes FROM archivo_digital WHERE org_id = ? AND variante_id = ?), 0) AS este,
              (SELECT clave FROM archivo_digital WHERE org_id = ? AND variante_id = ?) AS anterior
         FROM archivo_digital WHERE org_id = ?`,
    )
    .bind(q.org, p.variante, q.org, p.variante, q.org)
    .first<{ total: number; este: number; anterior: string | null }>();
  if ((uso?.total ?? 0) - (uso?.este ?? 0) + p.bytes > TOPE_POR_TIENDA) {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'archivo',
          mensaje: 'tu tienda llegó a 1 GB de archivos: quita alguno para subir este',
        },
      ],
    };
  }
  const clave = `${q.org}/${p.variante}/${crypto.randomUUID()}`;
  try {
    await bucket.put(clave, cuerpo, { sha256: p.huella, httpMetadata: { contentType: p.tipo } });
  } catch {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'archivo', mensaje: 'el archivo no llegó completo: súbelo otra vez' }],
    };
  }
  const nombre = nombreDelArchivo(p.nombre, p.tipo);
  await q.db.batch([
    q.db
      .prepare(
        `INSERT INTO archivo_digital (org_id, variante_id, clave, nombre, tipo, bytes, huella, creado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (org_id, variante_id) DO UPDATE SET clave = excluded.clave, nombre = excluded.nombre,
           tipo = excluded.tipo, bytes = excluded.bytes, huella = excluded.huella, creado = excluded.creado`,
      )
      .bind(q.org, p.variante, clave, nombre, p.tipo, p.bytes, p.huella, q.instante),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'digital.subir',
      entidad: 'variante',
      entidadId: p.variante,
      antes: null,
      despues: { nombre, bytes: p.bytes },
      instante: q.instante,
    }),
  ]);
  // El anterior se borra después: si algo falla antes, la combinación sigue con el suyo.
  if (uso?.anterior) await bucket.delete(uso.anterior).catch(() => undefined);
  return { estado: 'guardado', nombre, bytes: p.bytes };
}

/** Los archivos de las combinaciones de una tienda, para el panel (sin la clave del bucket). */
export async function archivosDeLaTienda(q: Quien) {
  const { results } = await q.db
    .prepare(
      `SELECT variante_id, nombre, tipo, bytes, creado FROM archivo_digital WHERE org_id = ?
        ORDER BY variante_id`,
    )
    .bind(q.org)
    .all<{ variante_id: string; nombre: string; tipo: string; bytes: number; creado: string }>();
  const total = results.reduce((n, r) => n + r.bytes, 0);
  return {
    archivos: results.map((r) => ({
      variante: r.variante_id,
      nombre: r.nombre,
      tipo: r.tipo,
      bytes: r.bytes,
      creado: r.creado,
    })),
    total,
    tope: TOPE_POR_TIENDA,
  };
}

const ENTREGABLES = ['pagado', 'confirmado', 'despachado', 'entregado'];

const secretoNuevo = () => {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Los enlaces de descarga de un pedido, si ya se puede entregar: uno nuevo por cada archivo, que
 * vale 7 días y 5 descargas. Sin archivos, o sin el pago verificado, ninguno.
 */
export async function enlacesDeDescarga(
  db: BaseD1,
  org: string,
  codigo: string,
  ahora: string,
): Promise<{ nombre: string; bytes: number; enlace: string | null }[]> {
  const p = await db
    .prepare('SELECT id, estado FROM pedido WHERE org_id = ? AND codigo = ?')
    .bind(org, codigo)
    .first<{ id: string; estado: string }>();
  if (!p || !ENTREGABLES.includes(p.estado)) return [];
  const { results } = await db
    .prepare(
      `SELECT DISTINCT l.variante_id, a.nombre, a.bytes,
              (SELECT coalesce(sum(d.usos), 0) FROM descarga d
                WHERE d.org_id = ? AND d.pedido_id = l.pedido_id AND d.variante_id = l.variante_id) AS usadas
         FROM pedido_linea l
         JOIN archivo_digital a ON a.org_id = l.org_id AND a.variante_id = l.variante_id
        WHERE l.org_id = ? AND l.pedido_id = ?`,
    )
    .bind(org, org, p.id)
    .all<{ variante_id: string; nombre: string; bytes: number; usadas: number }>();
  if (results.length === 0) return [];
  const vence = new Date(Date.parse(ahora) + DIAS_DEL_ENLACE * 86_400_000).toISOString();
  const salida: { nombre: string; bytes: number; enlace: string | null }[] = [];
  const lote = [];
  for (const r of results) {
    if (r.usadas >= DESCARGAS_POR_COMPRA) {
      salida.push({ nombre: r.nombre, bytes: r.bytes, enlace: null });
      continue;
    }
    const secreto = secretoNuevo();
    lote.push(
      db
        .prepare(
          `INSERT INTO descarga (org_id, huella, pedido_id, variante_id, vence, usos, creado)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
        )
        .bind(org, await sha256(secreto), p.id, r.variante_id, vence, ahora),
    );
    salida.push({ nombre: r.nombre, bytes: r.bytes, enlace: `/api/v1/descargas/${secreto}` });
  }
  // Los enlaces sin usar de antes de este, de esas mismas combinaciones, ya no hacen falta.
  lote.unshift(
    db
      .prepare('DELETE FROM descarga WHERE org_id = ? AND pedido_id = ? AND usos = 0')
      .bind(org, p.id),
  );
  await db.batch(lote);
  return salida;
}

export type ResultadoDeDescargar =
  | { estado: 'archivo'; nombre: string; tipo: string; cuerpo: ReadableStream; bytes: number }
  | { estado: 'no-sirve' };

/** `GET /api/v1/descargas/<secreto>`: el archivo, si el enlace sigue vigente y le quedan usos. */
export async function descargar(
  db: BaseD1,
  org: string,
  bucket: BucketDigital,
  secreto: string,
  ahora: string,
): Promise<ResultadoDeDescargar> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(secreto)) return { estado: 'no-sirve' };
  const huella = await sha256(secreto);
  // Cuenta el uso en la misma sentencia que lo revisa: dos descargas a la vez no pasan del tope.
  const usado = await db
    .prepare(
      `UPDATE descarga SET usos = usos + 1
        WHERE org_id = ? AND huella = ? AND vence > ? AND usos < ?
        RETURNING variante_id, pedido_id`,
    )
    .bind(org, huella, ahora, DESCARGAS_POR_ENLACE)
    .first<{ variante_id: string; pedido_id: string }>();
  if (!usado) return { estado: 'no-sirve' };
  const a = await db
    .prepare('SELECT clave, nombre, tipo FROM archivo_digital WHERE org_id = ? AND variante_id = ?')
    .bind(org, usado.variante_id)
    .first<{ clave: string; nombre: string; tipo: string }>();
  const objeto = a ? await bucket.get(a.clave) : null;
  if (!a || !objeto) return { estado: 'no-sirve' };
  return {
    estado: 'archivo',
    nombre: a.nombre,
    tipo: a.tipo,
    cuerpo: objeto.body,
    bytes: objeto.size,
  };
}

/** HU-T13.7: al borrar los datos de una tienda dada de baja, sus archivos también se van. */
export async function borrarArchivosDeLaTienda(
  db: BaseD1,
  org: string,
  bucket: BucketDigital | undefined,
): Promise<number> {
  const { results } = await db
    .prepare('SELECT clave FROM archivo_digital WHERE org_id = ?')
    .bind(org)
    .all<{ clave: string }>();
  if (bucket && results.length > 0) await bucket.delete(results.map((r) => r.clave));
  await db.batch([
    db.prepare('DELETE FROM descarga WHERE org_id = ?').bind(org),
    db.prepare('DELETE FROM archivo_digital WHERE org_id = ?').bind(org),
  ]);
  return results.length;
}
