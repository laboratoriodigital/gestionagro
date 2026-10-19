/**
 * HU-T11.8: el pedido que llegó por el chat, cobrado con un link de pago de Bold (TIENDA-3.0 §9.6).
 *
 * - **CA1.** «Cobrar con link» en un pedido pendiente: primero se le pide el link a Bold, con la
 *   referencia del cobro (`<código>-<intento>`) y su vencimiento (60 minutos si no se dice; de 15
 *   minutos a 24 horas). Después, en un lote, el pedido pasa a en línea y por pagar, nace el cobro
 *   `esperando` y se aparta cada línea hasta el vencimiento. El panel arma el mensaje de WhatsApp
 *   con el link. Si Bold no responde, nada cambia; si no hay unidades para apartar, tampoco, y el
 *   link que Bold creó vence solo sin que nadie lo tenga.
 * - **CA2.** Un link vencido libera lo apartado y devuelve el pedido a pendiente, con la forma de
 *   pago a convenir: antes se le pregunta a Bold una última vez, por si se pagó justo antes. Lo
 *   hacen la vuelta del cron y el panel al abrir el pedido. Pagado dos veces no cuenta dos pagos:
 *   el aviso repetido es `repetido` y el cobro ya aprobado no se mueve (HU-T11.5).
 *
 * El aviso y la consulta son los del botón (HU-T11.5 y HU-T11.6): el aviso trae la referencia, y la
 * consulta de un cobro con link le pregunta a Bold por el link.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { formatearPesos } from '@ed1/dinero';
import { ErrorDeBold, proveedorBold } from '@ed1/pagos';
import { z } from 'zod';
import { type ContextoDelAviso, leerCobro } from './avisos.ts';
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  MOTIVO_CAMBIADO,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { consultarCobro } from './conciliar.ts';
import { type Ambiente, llavesDeBold } from './credenciales.ts';
import { kekDelEntorno } from './llaves.ts';
import { sha256 } from './pedidos.ts';
import { anotar } from './registro.ts';
import { aceptacionDe } from './terminos.ts';

export const MINUTOS_DEL_LINK = { porDefecto: 60, minimo: 15, maximo: 24 * 60 } as const;
const MONTO_MINIMO = 1_000;
const MONTO_MAXIMO = 5_000_000;

const Cobrar = z.object({
  op: z.string().min(8).max(64),
  pedido: z.string().min(1).max(64),
  version: z.number().int().min(1),
  minutos: z
    .number()
    .int()
    .min(MINUTOS_DEL_LINK.minimo, { error: 'el link dura al menos 15 minutos' })
    .max(MINUTOS_DEL_LINK.maximo, { error: 'el link dura como mucho 24 horas' })
    .default(MINUTOS_DEL_LINK.porDefecto),
});

export type ResultadoDelLink =
  | (Resultado & { estado: 'guardado' } & { link: string; vence: string; mensaje: string })
  | Exclude<Resultado, { estado: 'guardado' }>
  | {
      estado: 'sin-terminos' | 'sin-llaves' | 'sin-respuesta' | 'sin-existencias';
      motivo: string;
    };

/**
 * En qué ambiente cobra un link: el de la versión publicada si ofrece pagar en línea; si no (vende
 * solo por WhatsApp), el de los ajustes, que solo pasa a producción con el cobro de prueba
 * (HU-T11.3 CA3). Pruebas mientras nada diga producción.
 */
async function ambienteDelLink(
  db: BaseD1,
  org: string,
): Promise<{ ambiente: Ambiente; tope: number }> {
  const [ajuste, publicada] = await Promise.all([
    db
      .prepare("SELECT datos FROM ajuste WHERE org_id = ? AND seccion = 'cobro'")
      .bind(org)
      .first<{ datos: string }>(),
    db
      .prepare(
        `SELECT p.cobro_ambiente FROM tienda t JOIN publicacion p
           ON p.org_id = t.org_id AND p.version = t.version_publicada WHERE t.org_id = ?`,
      )
      .bind(org)
      .first<{ cobro_ambiente: string | null }>(),
  ]);
  const cobro = JSON.parse(ajuste?.datos ?? '{}') as { ambiente?: string; topeCop?: number };
  const deLaVersion = publicada?.cobro_ambiente;
  const ambiente =
    deLaVersion === 'pruebas' || deLaVersion === 'produccion'
      ? deLaVersion
      : cobro.ambiente === 'produccion'
        ? 'produccion'
        : 'pruebas';
  return { ambiente, tope: Math.min(MONTO_MAXIMO, cobro.topeCop ?? MONTO_MAXIMO) };
}

/** «5:40 p. m.» en Bogotá (UTC−5, sin horario de verano), sin depender del idioma del Worker. */
function horaEnBogota(iso: string): string {
  const d = new Date(Date.parse(iso) - 5 * 3_600_000);
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/**
 * El mensaje para mandar el link por WhatsApp. Solo lo arma la API: el panel muestra el mismo al
 * crearlo y al volver a abrir el pedido.
 */
export function mensajeDelLink(l: {
  numero: number;
  tienda: string;
  totalCop: number;
  url: string;
  vence: string;
}): string {
  return `Hola. Este es el link para pagar tu pedido #${l.numero} de ${l.tienda}, por ${formatearPesos(l.totalCop)}: ${l.url}\nSirve hasta las ${horaEnBogota(l.vence)}`;
}

/** Un token opaco que nadie usa: el cobro lo exige único, y con link no hay página que pregunte. */
const tokenDelLink = () => {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replaceAll('=', '');
};

/** CA1: cobrar con link un pedido pendiente. */
export async function cobrarConLink(
  q: Quien,
  kekTexto: string | undefined,
  cuerpo: unknown,
  fetchFn: typeof fetch,
): Promise<ResultadoDelLink> {
  const r0 = Cobrar.safeParse(cuerpo);
  if (!r0.success) {
    return {
      estado: 'problemas',
      problemas: r0.error.issues.map((i) => ({
        campo: i.path.map(String).join('.') || 'pedido',
        mensaje: i.message,
      })),
    };
  }
  const d = r0.data;
  const previa = await yaAplicada<ResultadoDelLink>(q, d.op);
  if (previa) return previa;
  if (!(await aceptacionDe(q)).terminos.aceptados) {
    return {
      estado: 'sin-terminos',
      motivo:
        'Antes de cobrar en línea, quien administra la tienda tiene que aceptar los términos del servicio.',
    };
  }
  const p = await q.db
    .prepare(
      `SELECT p.codigo, p.numero, p.estado, p.total_cop, p.version, t.nombre AS tienda
         FROM pedido p JOIN tienda t ON t.org_id = p.org_id WHERE p.org_id = ? AND p.id = ?`,
    )
    .bind(q.org, d.pedido)
    .first<{
      codigo: string;
      numero: number;
      estado: string;
      total_cop: number;
      version: number;
      tienda: string;
    }>();
  if (!p) return { estado: 'no-existe', motivo: 'Ese pedido no está.' };
  if (p.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: p.version };
  if (p.estado !== 'pendiente') {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'pedido', mensaje: 'Solo un pedido pendiente se cobra con un link.' }],
    };
  }
  const { ambiente, tope } = await ambienteDelLink(q.db, q.org);
  if (p.total_cop < MONTO_MINIMO || p.total_cop > tope) {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'pedido',
          mensaje:
            p.total_cop < MONTO_MINIMO
              ? 'Bold cobra en línea desde $1.000.'
              : `Este total pasa el tope del pago en línea de la tienda (${formatearPesos(tope)}).`,
        },
      ],
    };
  }
  const kek = await kekDelEntorno(kekTexto);
  const llaves = kek ? await llavesDeBold(q.db, q.org, ambiente, kek) : null;
  if (!llaves) {
    return {
      estado: 'sin-llaves',
      motivo: `Para cobrar con link, pega tus llaves de Bold de ${ambiente === 'produccion' ? 'producción' : 'pruebas'} en Más › Cobro en línea.`,
    };
  }
  const { results: lineas } = await q.db
    .prepare('SELECT variante_id, cantidad FROM pedido_linea WHERE org_id = ? AND pedido_id = ?')
    .bind(q.org, d.pedido)
    .all<{ variante_id: string; cantidad: number }>();
  const intentos = await q.db
    .prepare('SELECT count(*) AS n FROM cobro WHERE org_id = ? AND pedido_id = ?')
    .bind(q.org, d.pedido)
    .first<{ n: number }>();
  const id = `${p.codigo}-${(intentos?.n ?? 0) + 1}`;
  const vence = new Date(Date.parse(q.instante) + d.minutos * 60_000).toISOString();

  let link: { link: string; url: string };
  try {
    link = await proveedorBold(llaves, fetchFn).crearLink({
      referencia: id,
      monto: p.total_cop,
      descripcion: `Pedido ${p.codigo} · ${p.tienda}`,
      vence,
    });
  } catch (e) {
    console.error(
      `tienda-api: Bold no creó el link de ${id} (${e instanceof ErrorDeBold ? e.estado : String(e)})`,
    );
    return {
      estado: 'sin-respuesta',
      motivo:
        'Bold no creó el link ahora. El pedido sigue igual: vuelve a intentar en unos minutos.',
    };
  }

  const mensaje = mensajeDelLink({
    numero: p.numero,
    tienda: p.tienda,
    totalCop: p.total_cop,
    url: link.url,
    vence,
  });
  const r = {
    estado: 'guardado',
    id: d.pedido,
    version: p.version + 1,
    link: link.url,
    vence,
    mensaje,
  } as const;
  const variantes = [...new Set(lineas.map((l) => l.variante_id))];
  const lote: SentenciaD1[] = [
    // Lo vencido de esas combinaciones se libera antes de apartar (vencimiento perezoso).
    q.db
      .prepare(
        `UPDATE apartado SET estado = 'vencido', cerrado = ?
          WHERE org_id = ? AND estado = 'activo' AND vence <= ?
            AND variante_id IN (${variantes.map(() => '?').join(', ') || "''"})`,
      )
      .bind(q.instante, q.org, q.instante, ...variantes),
    q.db
      .prepare(
        `UPDATE pedido SET forma_pago = 'en_linea', estado = 'por_pagar', cambiado_por = ?,
           version = version + 1, actualizado = ?
          WHERE org_id = ? AND id = ? AND estado = 'pendiente' AND version = ?`,
      )
      .bind(q.actor, q.instante, q.org, d.pedido, d.version),
    q.db.prepare(SI_CAMBIO),
    q.db
      .prepare(
        `INSERT INTO cobro (org_id, id, pedido_id, proveedor, ambiente, monto_cop, estado, token_huella,
           vence, creado, actualizado, link, link_url)
         VALUES (?, ?, ?, 'bold', ?, ?, 'esperando', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        q.org,
        id,
        d.pedido,
        ambiente,
        p.total_cop,
        await sha256(tokenDelLink()),
        vence,
        q.instante,
        q.instante,
        link.link,
        link.url,
      ),
    ...lineas.map((l) =>
      q.db
        .prepare(
          `INSERT INTO apartado (org_id, cobro_id, variante_id, cantidad, estado, vence, creado)
           VALUES (?, ?, ?, ?, 'activo', ?, ?)`,
        )
        .bind(q.org, id, l.variante_id, l.cantidad, vence, q.instante),
    ),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'pedido.link',
      entidad: 'pedido',
      entidadId: d.pedido,
      antes: null,
      despues: { numero: p.numero, minutos: d.minutos, ambiente },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'pedidos/link', r),
  ];
  try {
    await q.db.batch(lote);
    return r;
  } catch (e) {
    if (esCambiado(e)) return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: null };
    if (esOperacionRepetida(e)) return (await yaAplicada<ResultadoDelLink>(q, d.op)) ?? r;
    // El CHECK de `variante.reservado <= stock`: no hay unidades para apartar.
    if (/CHECK/i.test(String(e))) {
      return {
        estado: 'sin-existencias',
        motivo:
          'No hay unidades para apartar todo el pedido. Revisa el inventario o cambia el pedido antes de cobrarlo.',
      };
    }
    throw e;
  }
}

/** CA2: el link vencido sin pago. Lo apartado se libera y el pedido vuelve a pendiente, a convenir. */
export function vencerLink(c: ContextoDelAviso, cobro: string, pedido: string): SentenciaD1[] {
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'vencido', actualizado = ?
          WHERE org_id = ? AND id = ? AND estado = 'esperando'`,
      )
      .bind(c.ahora, c.org, cobro),
    c.db
      .prepare(
        `UPDATE apartado SET estado = 'liberado', cerrado = ?
          WHERE org_id = ? AND cobro_id = ? AND estado = 'activo'`,
      )
      .bind(c.ahora, c.org, cobro),
    c.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
         SELECT ?, ?, ?, 'pago', 'sistema', ? WHERE EXISTS
           (SELECT 1 FROM pedido WHERE org_id = ? AND id = ? AND estado = 'por_pagar')`,
      )
      .bind(
        c.org,
        pedido,
        c.ahora,
        JSON.stringify({ cobro, resultado: 'vencido', link: true }),
        c.org,
        pedido,
      ),
    c.db
      .prepare(
        `UPDATE pedido SET estado = 'pendiente', cambiado_por = 'sistema', version = version + 1,
           actualizado = ? WHERE org_id = ? AND id = ? AND estado = 'por_pagar'`,
      )
      .bind(c.ahora, c.org, pedido),
    // La forma se cambia con el pedido ya pendiente (trigger `pedido_forma_fija`).
    c.db
      .prepare(
        `UPDATE pedido SET forma_pago = 'a_convenir' WHERE org_id = ? AND id = ?
            AND estado = 'pendiente' AND forma_pago = 'en_linea'`,
      )
      .bind(c.org, pedido),
  ];
}

/**
 * CA2: los links vencidos de la tienda (o de un pedido), cada uno con una última pregunta a Bold.
 * Si Bold dice que se pagó, se aplica como cualquier consulta; si no, vence. Devuelve cuántos
 * vencieron. Si Bold no responde, ese link espera a la próxima vuelta: vencer un pago no se arriesga.
 */
export async function cerrarLinksVencidos(
  c: ContextoDelAviso,
  fetchFn: typeof fetch,
  pedido?: string,
): Promise<number> {
  const { results } = await c.db
    .prepare(
      `SELECT id, pedido_id, ambiente FROM cobro INDEXED BY cobro_esperando
        WHERE org_id = ? AND estado = 'esperando' AND link IS NOT NULL AND vence <= ?
          ${pedido ? 'AND pedido_id = ?' : ''} ORDER BY vence LIMIT 20`,
    )
    .bind(c.org, c.ahora, ...(pedido ? [pedido] : []))
    .all<{ id: string; pedido_id: string; ambiente: Ambiente }>();
  if (results.length === 0) return 0;
  const kek = await kekDelEntorno(c.kekTexto);
  let vencidos = 0;
  for (const fila of results) {
    const k = await leerCobro(c, fila.id);
    if (k?.estado !== 'esperando') continue;
    const llaves = kek ? await llavesDeBold(c.db, c.org, fila.ambiente, kek) : null;
    if (llaves) {
      try {
        if ((await consultarCobro(c, k, llaves, fetchFn)) === 'movido') continue;
      } catch (e) {
        console.error(`tienda-api: Bold no respondió por el link ${fila.id} (${String(e)})`);
        continue;
      }
    }
    await c.db.batch(vencerLink(c, fila.id, fila.pedido_id));
    vencidos++;
  }
  return vencidos;
}
