/**
 * Los avisos firmados de Bold (HU-T11.5, TIENDA-3.0 §9.4 y §7.3): `POST /api/v1/avisos/bold`, en el
 * subdominio de la plataforma de cada tienda. Son el camino principal para saber que un pago se
 * aprobó; la consulta a Bold es el respaldo (HU-T11.6).
 *
 * **La firma, antes de leer el JSON** (CA1): `x-bold-signature` es el HMAC-SHA256, en hexadecimal,
 * de la base64 del cuerpo crudo. En producción la llave es la secreta de producción del comercio;
 * en pruebas Bold firma con una llave vacía, que WebCrypto no importa, y se usan 64 bytes en cero,
 * que por la definición de HMAC dan lo mismo (CA2; la prueba lo fija con un vector calculado
 * aparte). La firma dice de qué ambiente es el aviso, y un aviso solo mueve un cobro de su mismo
 * ambiente: cualquiera puede firmar uno «de pruebas» (CA4). La comparación la hace
 * `crypto.subtle.verify`, en tiempo constante.
 *
 * **Sin escribir de más.** Un aviso de pruebas lo puede mandar cualquiera, así que lo que no es de
 * un cobro de esta tienda en ese ambiente no deja ni una fila: responde 200 y se registra el porqué.
 *
 * **Idempotente** (CA3): `aviso_proveedor` guarda cada aviso por `tipo:subject`, en el mismo lote
 * que lo aplica; el repetido responde 200 sin tocar nada. Cada sentencia del lote además se escribe
 * para que aplicarla dos veces dé lo mismo (el inventario sale una vez por línea, por `descontado`).
 * Una anulación que llega antes que su venta queda `ignorado`, y se aplica al llegar la venta.
 *
 * Qué hace cada respuesta (TIENDA §7.3): aprobado por el monto, a tiempo o tarde con unidades,
 * descuenta el inventario y deja el pedido `pagado`; aprobado tarde sin unidades queda
 * `aprobado_sin_existencias` con el pedido pagado y su atención; por otro monto, `revisar`; el
 * rechazo libera lo apartado y devuelve el pedido a `pendiente`; la anulación, `reembolsado`.
 */
import type { BaseD1, SentenciaD1 } from '@ed1/d1';
import { z } from 'zod';
import { type Ambiente, llavesDeBold } from './credenciales.ts';
import { kekDelEntorno } from './llaves.ts';

export type ResultadoDelAviso =
  | 'aplicado'
  | 'repetido'
  | 'ignorado'
  | 'firma-invalida'
  | 'ilegible'
  | 'sin-cobro';

export interface ContextoDelAviso {
  db: BaseD1;
  org: string;
  ahora: string;
  kekTexto: string | undefined;
  /**
   * Un cobro de pruebas que Bold resolvió, y por dónde se supo (HU-T14.3): el correo al comercio.
   * Nunca demora ni tumba la respuesta: quien lo da lo manda en segundo plano.
   */
  alResolverPrueba?: (cobroId: string, via: 'aviso' | 'consulta') => void;
}

const AvisoDeBold = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(40),
  subject: z.string().min(1).max(100),
  data: z.object({
    payment_id: z.string().max(100).optional(),
    payment_method: z.string().max(40).optional(),
    amount: z.object({ total: z.number() }).optional(),
    metadata: z.object({ reference: z.string().max(80) }).optional(),
  }),
});
type AvisoDeBold = z.infer<typeof AvisoDeBold>;

const REFERENCIA = /^[0-9A-HJKMNP-TV-Z]{6}-[1-9][0-9]{0,2}$/;
const HEX = /^[0-9a-f]{64}$/;

/** La base64 del cuerpo tal como llegó, que es lo que Bold firma. */
function base64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

const deHex = (h: string) => Uint8Array.from(h.match(/../g) ?? [], (x) => Number.parseInt(x, 16));

/** ¿La firma es de esta llave? En pruebas, la llave vacía son 64 bytes en cero (CA2). */
export async function firmaValida(
  llave: string | null,
  cuerpo: Uint8Array,
  firma: string,
): Promise<boolean> {
  if (!HEX.test(firma)) return false;
  const bytes = llave ? new TextEncoder().encode(llave) : new Uint8Array(64);
  const k = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);
  return crypto.subtle.verify('HMAC', k, deHex(firma), new TextEncoder().encode(base64(cuerpo)));
}

export interface CobroDelAviso {
  id: string;
  pedido_id: string;
  ambiente: Ambiente;
  estado: string;
  monto_cop: number;
}

/**
 * Lo que Bold dijo de un cobro, venga por un aviso o por una consulta (HU-T11.6): las dos llegan
 * aquí y hacen lo mismo con el cobro, en un solo sitio.
 */
export interface RespuestaDeBold {
  tipo: 'aprobado' | 'rechazado' | 'anulado';
  /** Lo que Bold dice que se pagó; `null` si no lo dijo, y entonces no se aprueba por el monto. */
  total: number | null;
  transaccion: string | null;
  medio: string | null;
}

/** El primer paso del historial del pago, solo si el pedido todavía espera (no se repite). */
const eventoDelPago = (
  c: ContextoDelAviso,
  k: CobroDelAviso,
  detalle: Record<string, unknown>,
  estadoDelPedido = 'por_pagar',
) =>
  c.db
    .prepare(
      `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
       SELECT ?, ?, ?, 'pago', 'sistema', ? WHERE EXISTS
         (SELECT 1 FROM pedido WHERE org_id = ? AND id = ? AND estado = ?)`,
    )
    .bind(
      c.org,
      k.pedido_id,
      c.ahora,
      JSON.stringify({ cobro: k.id, ambiente: k.ambiente, ...detalle }),
      c.org,
      k.pedido_id,
      estadoDelPedido,
    );

/** Aprobado por el monto: el inventario sale una vez por línea y el pedido queda pagado. */
async function aprobar(
  c: ContextoDelAviso,
  r: RespuestaDeBold,
  k: CobroDelAviso,
): Promise<SentenciaD1[]> {
  const { results: lineas } = await c.db
    .prepare(
      'SELECT linea, variante_id, cantidad FROM pedido_linea WHERE org_id = ? AND pedido_id = ?',
    )
    .bind(c.org, k.pedido_id)
    .all<{ linea: number; variante_id: string; cantidad: number }>();
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'aprobado', estado_proveedor = 'APPROVED', transaccion = ?, medio = ?,
           actualizado = ? WHERE org_id = ? AND id = ?`,
      )
      .bind(r.transaccion, r.medio, c.ahora, c.org, k.id),
    // Lo apartado se consume antes de descontar, para que `reservado <= stock` se cumpla.
    c.db
      .prepare(
        `UPDATE apartado SET estado = 'consumido', cerrado = ?
          WHERE org_id = ? AND cobro_id = ? AND estado = 'activo'`,
      )
      .bind(c.ahora, c.org, k.id),
    ...lineas.map((l) =>
      c.db
        .prepare(
          `UPDATE variante SET stock = stock - ?, cambio_motivo = 'venta', cambio_ref = ?, actualizado = ?
            WHERE org_id = ? AND id = ? AND stock IS NOT NULL AND EXISTS
              (SELECT 1 FROM pedido_linea WHERE org_id = ? AND pedido_id = ? AND linea = ? AND descontado = 0)`,
        )
        .bind(l.cantidad, k.pedido_id, c.ahora, c.org, l.variante_id, c.org, k.pedido_id, l.linea),
    ),
    c.db
      .prepare('UPDATE pedido_linea SET descontado = 1 WHERE org_id = ? AND pedido_id = ?')
      .bind(c.org, k.pedido_id),
    eventoDelPago(c, k, { resultado: 'aprobado', transaccion: r.transaccion, medio: r.medio }),
    c.db
      .prepare(
        `UPDATE pedido SET estado = 'pagado', cambiado_por = 'sistema', actualizado = ?
          WHERE org_id = ? AND id = ? AND estado = 'por_pagar'`,
      )
      .bind(c.ahora, c.org, k.pedido_id),
  ];
}

/** Aprobado tarde, sin unidades: pagado, sin tocar el inventario, y el comercio decide (§7.3). */
function aprobarSinExistencias(c: ContextoDelAviso, r: RespuestaDeBold, k: CobroDelAviso) {
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'aprobado_sin_existencias', estado_proveedor = 'APPROVED', transaccion = ?,
           medio = ?, actualizado = ? WHERE org_id = ? AND id = ?`,
      )
      .bind(r.transaccion, r.medio, c.ahora, c.org, k.id),
    c.db
      .prepare(
        `UPDATE apartado SET estado = 'liberado', cerrado = ?
          WHERE org_id = ? AND cobro_id = ? AND estado = 'activo'`,
      )
      .bind(c.ahora, c.org, k.id),
    eventoDelPago(c, k, { resultado: 'aprobado_sin_existencias', transaccion: r.transaccion }),
    c.db
      .prepare(
        `UPDATE pedido SET estado = 'pagado', atencion = 'sin_existencias', cambiado_por = 'sistema',
           actualizado = ? WHERE org_id = ? AND id = ? AND estado = 'por_pagar'`,
      )
      .bind(c.ahora, c.org, k.pedido_id),
  ];
}

/** Aprobado por otro monto: a revisar. Lo apartado sigue hasta que el comercio decida (§7.3). */
function revisar(c: ContextoDelAviso, r: RespuestaDeBold, k: CobroDelAviso) {
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'revisar', estado_proveedor = 'APPROVED', transaccion = ?, medio = ?,
           actualizado = ? WHERE org_id = ? AND id = ?`,
      )
      .bind(r.transaccion, r.medio, c.ahora, c.org, k.id),
    eventoDelPago(c, k, { resultado: 'revisar', monto: k.monto_cop, pagado: r.total }),
    c.db
      .prepare(
        "UPDATE pedido SET atencion = 'monto', actualizado = ? WHERE org_id = ? AND id = ? AND estado = 'por_pagar'",
      )
      .bind(c.ahora, c.org, k.pedido_id),
  ];
}

function rechazar(c: ContextoDelAviso, k: CobroDelAviso) {
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'rechazado', estado_proveedor = 'REJECTED', actualizado = ?
          WHERE org_id = ? AND id = ?`,
      )
      .bind(c.ahora, c.org, k.id),
    c.db
      .prepare(
        `UPDATE apartado SET estado = 'liberado', cerrado = ?
          WHERE org_id = ? AND cobro_id = ? AND estado = 'activo'`,
      )
      .bind(c.ahora, c.org, k.id),
    eventoDelPago(c, k, { resultado: 'rechazado' }),
    c.db
      .prepare(
        `UPDATE pedido SET estado = 'pendiente', cambiado_por = 'sistema', actualizado = ?
          WHERE org_id = ? AND id = ? AND estado = 'por_pagar'`,
      )
      .bind(c.ahora, c.org, k.pedido_id),
  ];
}

function anular(c: ContextoDelAviso, k: CobroDelAviso) {
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'reembolsado', estado_proveedor = 'VOIDED', actualizado = ?
          WHERE org_id = ? AND id = ?`,
      )
      .bind(c.ahora, c.org, k.id),
    c.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
         VALUES (?, ?, ?, 'pago', 'sistema', ?)`,
      )
      .bind(c.org, k.pedido_id, c.ahora, JSON.stringify({ cobro: k.id, resultado: 'reembolsado' })),
  ];
}

const APROBADOS = new Set(['aprobado', 'aprobado_sin_existencias', 'revisar']);

/** Lo que la respuesta hace con el cobro: las sentencias, o `null` si no le toca hacer nada. */
async function sentenciasDe(
  c: ContextoDelAviso,
  r: RespuestaDeBold,
  k: CobroDelAviso,
): Promise<{ lote: SentenciaD1[]; respaldo?: SentenciaD1[] } | null> {
  const abierto = k.estado === 'esperando' || k.estado === 'vencido';
  switch (r.tipo) {
    case 'aprobado':
      if (!abierto) return null;
      if (r.total !== k.monto_cop) return { lote: revisar(c, r, k) };
      return { lote: await aprobar(c, r, k), respaldo: aprobarSinExistencias(c, r, k) };
    case 'rechazado':
      return k.estado === 'esperando' ? { lote: rechazar(c, k) } : null;
    case 'anulado':
      return APROBADOS.has(k.estado) ? { lote: anular(c, k) } : null;
  }
}

/**
 * Aplica lo que Bold dijo, con `antes` al principio del mismo lote (el registro del aviso, o la
 * consulta anotada). Devuelve si movió el cobro; si no le tocaba, no escribe nada.
 */
export async function aplicarRespuesta(
  c: ContextoDelAviso,
  r: RespuestaDeBold,
  k: CobroDelAviso,
  antes: SentenciaD1[] = [],
): Promise<boolean> {
  const hacer = await sentenciasDe(c, r, k);
  if (!hacer) return false;
  try {
    await c.db.batch([...antes, ...hacer.lote]);
  } catch (e) {
    // Aprobado tarde y ya no hay unidades: el lote de respaldo (TIENDA §7.3).
    if (!hacer.respaldo || !/CHECK/i.test(String(e))) throw e;
    await c.db.batch([...antes, ...hacer.respaldo]);
  }
  if (r.tipo === 'aprobado') await reaplicarAnulaciones(c, k.id);
  return true;
}

export const leerCobro = (c: ContextoDelAviso, id: string) =>
  c.db
    .prepare(
      'SELECT id, pedido_id, ambiente, estado, monto_cop FROM cobro WHERE org_id = ? AND id = ?',
    )
    .bind(c.org, id)
    .first<CobroDelAviso>();

const registrar = (
  c: ContextoDelAviso,
  aviso: AvisoDeBold,
  cobro: string,
  resultado: 'aplicado' | 'ignorado',
) =>
  c.db
    .prepare(
      `INSERT INTO aviso_proveedor (org_id, proveedor, aviso_id, recibido, cobro_id, tipo, resultado)
       VALUES (?, 'bold', ?, ?, ?, ?, ?)`,
    )
    .bind(c.org, `${aviso.type}:${aviso.subject}`, c.ahora, cobro, aviso.type, resultado);

const TIPOS: Record<string, RespuestaDeBold['tipo']> = {
  SALE_APPROVED: 'aprobado',
  SALE_REJECTED: 'rechazado',
  VOID_APPROVED: 'anulado',
};

/** Aplica un aviso ya verificado sobre su cobro. */
async function aplicar(
  c: ContextoDelAviso,
  aviso: AvisoDeBold,
  k: CobroDelAviso,
): Promise<'aplicado' | 'repetido' | 'ignorado'> {
  const ya = await c.db
    .prepare(
      "SELECT resultado FROM aviso_proveedor WHERE org_id = ? AND proveedor = 'bold' AND aviso_id = ?",
    )
    .bind(c.org, `${aviso.type}:${aviso.subject}`)
    .first<{ resultado: string }>();
  if (ya) return 'repetido';
  const tipo = Object.hasOwn(TIPOS, aviso.type) ? TIPOS[aviso.type] : undefined;
  try {
    const movio =
      tipo !== undefined &&
      (await aplicarRespuesta(
        c,
        {
          tipo,
          total: aviso.data.amount?.total ?? null,
          transaccion: aviso.data.payment_id ?? aviso.subject,
          medio: aviso.data.payment_method ?? null,
        },
        k,
        [registrar(c, aviso, k.id, 'aplicado')],
      ));
    if (movio) {
      if (k.ambiente === 'pruebas') avisarPrueba(c, k.id, 'aviso');
      return 'aplicado';
    }
    // Una anulación antes que su venta, u otro aviso que no mueve nada: queda dicho (CA3).
    await registrar(c, aviso, k.id, 'ignorado').run();
    return 'ignorado';
  } catch (e) {
    if (/UNIQUE|PRIMARY KEY/i.test(String(e))) return 'repetido';
    throw e;
  }
}

/** El correo del cobro de prueba nunca cambia lo que se le responde a Bold ni a la página. */
export function avisarPrueba(c: ContextoDelAviso, cobro: string, via: 'aviso' | 'consulta'): void {
  try {
    c.alResolverPrueba?.(cobro, via);
  } catch (e) {
    console.error(`tienda-api: el correo de la prueba ${cobro} no se pudo pedir (${String(e)})`);
  }
}

/** La anulación que llegó antes que la venta se aplica cuando la venta ya está (CA3). */
async function reaplicarAnulaciones(c: ContextoDelAviso, cobroId: string): Promise<void> {
  const pendiente = await c.db
    .prepare(
      `SELECT aviso_id FROM aviso_proveedor
        WHERE org_id = ? AND proveedor = 'bold' AND cobro_id = ? AND tipo = 'VOID_APPROVED'
          AND resultado = 'ignorado'`,
    )
    .bind(c.org, cobroId)
    .first<{ aviso_id: string }>();
  const k = pendiente ? await leerCobro(c, cobroId) : null;
  if (!pendiente || !k || !APROBADOS.has(k.estado)) return;
  await c.db.batch([
    c.db
      .prepare(
        `UPDATE aviso_proveedor SET resultado = 'aplicado'
          WHERE org_id = ? AND proveedor = 'bold' AND aviso_id = ?`,
      )
      .bind(c.org, pendiente.aviso_id),
    ...anular(c, k),
  ]);
}

/**
 * Recibe un aviso de Bold: verifica la firma con el cuerpo crudo, y solo entonces lo lee y lo
 * aplica. La respuesta para Bold es 200 en todo lo que no hay que reintentar.
 */
export async function recibirAvisoDeBold(
  c: ContextoDelAviso,
  cuerpo: Uint8Array,
  firma: string | null,
): Promise<ResultadoDelAviso> {
  if (!firma) return 'firma-invalida';
  const kek = await kekDelEntorno(c.kekTexto);
  const produccion = kek ? await llavesDeBold(c.db, c.org, 'produccion', kek) : null;
  let ambiente: Ambiente | null = null;
  if (produccion && (await firmaValida(produccion.secreta, cuerpo, firma))) ambiente = 'produccion';
  else if (await firmaValida(null, cuerpo, firma)) ambiente = 'pruebas';
  if (!ambiente) return 'firma-invalida';

  let aviso: AvisoDeBold;
  try {
    const p = AvisoDeBold.safeParse(JSON.parse(new TextDecoder().decode(cuerpo)));
    if (!p.success) return 'ilegible';
    aviso = p.data;
  } catch {
    return 'ilegible';
  }
  const referencia = aviso.data.metadata?.reference ?? '';
  const k = REFERENCIA.test(referencia) ? await leerCobro(c, referencia) : null;
  // CA4: un aviso de pruebas nunca mueve un cobro de producción, ni al revés. Nada se escribe.
  if (!k || k.ambiente !== ambiente) return 'sin-cobro';
  return aplicar(c, aviso, k);
}
