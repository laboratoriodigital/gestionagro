/**
 * Los correos de la tienda (HU-T14.3, TIENDA-3.0 §15.5), por `@ed1/correo` (HU-C10.1, D-T11):
 *
 * - **El resumen diario** al correo de Ajustes › Avisos, a la hora que el comercio eligió (las 7 de
 *   Bogotá si no dijo). Lleva lo que hay que hacer hoy, del mismo tablero de Inicio (HU-T14.2):
 *   recaudos atrasados, solicitudes por vencer con su radicado, pagos sin existencias y lo vendido
 *   ayer. Las solicitudes por vencer van aquí, como dice TIENDA §8.6: el panel avisa a 3 días y el
 *   día del vencimiento, y lo incluye en el resumen. Si no hay nada que decir, no sale.
 * - **El acuse al comprador** que dejó su correo al pagar en línea, con el enlace de seguimiento:
 *   el mismo resumen del pedido que va por WhatsApp (TIENDA §8.5). Sale en el momento, porque el
 *   secreto del enlace solo existe en esa solicitud (HU-T6.3); si falla, no se reintenta.
 * - **El resultado del cobro de prueba** al comercio: un cobro del ambiente de pruebas que Bold
 *   resolvió, y si se supo por el aviso o por la consulta. Por la consulta quiere decir que el aviso
 *   no llegó, y eso es lo que el comercio tiene que revisar (HU-T11.5).
 *
 * El remitente es la marca con el nombre de la tienda delante («Panadería Rosa vía TiendaPro»), y la
 * respuesta va al correo del comercio (PLATAFORMA §4.11). Producción manda con Resend desde
 * tiendapro.co; staging, con la cuenta de Gmail (D-T11, HU-T18.4).
 *
 * Cada correo tiene una clave (`correo` en la 0006): dos corridas no mandan dos. Solo `enviado` es
 * enviado (CA3, P1): lo que no salió queda `fallido` con su motivo y no gasta el tope del día. El
 * tope es por tienda y por la celda entera, que comparte los 400 diarios de la cuenta con el CORE.
 * Un `enviando` que no llegó a cerrarse (el Worker se cayó a mitad) se queda así y no se reenvía:
 * mejor un correo de menos que uno repetido.
 */
import { fechaEnBogota } from '@ed1/calendario';
import type { Correo, CorreoTransaccional, MotivoSinEnviar, ResultadoDelEnvio } from '@ed1/correo';
import type { BaseD1 } from '@ed1/d1';
import { formatearPesos } from '@ed1/dinero';
import { PANEL_DE_PRODUCCION } from '@ed1/tienda-schema/marca';
import { type FilaDeSolicitud, listarSolicitudes } from './panel-solicitudes.ts';
import { type Cifras, cifras, type Tablero, tablero } from './panel-tablero.ts';
import { type DatosDelTexto, datosDelPedidoEscrito, resumenDelPedido } from './pedidos.ts';
import type { Tarea } from './tareas.ts';

/** Propuesta (TIENDA §15.5): ningún comercio de hoy pasa de una decena de correos al día. */
export const TOPE_POR_TIENDA = 40;
/** De los 400 diarios de la cuenta de Gmail (PLATAFORMA §4.11), 100 quedan para el CORE. */
export const TOPE_DE_LA_CELDA = 300;
export const HORA_DEL_RESUMEN = '07:00';
/** Los intentos de un correo en su día: lo que no salió por la red o el cupo se reintenta. */
export const INTENTOS = 3;
const REINTENTABLES: ReadonlySet<MotivoSinEnviar> = new Set(['falla', 'tope', 'no-disponible']);
/** El cron corre solo en producción (HU-T17.1), y el panel de producción vive aquí (HU-T18.2). */
export const PANEL = PANEL_DE_PRODUCCION;

export type TipoDeCorreo = 'resumen' | 'acuse' | 'prueba';

export interface ContextoDeCorreo {
  db: BaseD1;
  org: string;
  ahora: string;
  correo: CorreoTransaccional;
  /** Cuántos correos lleva hoy la celda, sumados sus shards. Sin él, solo cuenta la tienda. */
  enLaCelda?: (dia: string) => Promise<number>;
}

export type ResultadoDelCorreo = 'enviado' | 'repetido' | 'fallido';

const ESTADOS_QUE_CUENTAN = "('enviando', 'enviado')";

/** Lo que llevan hoy los shards de la celda: la suma no puede ir en una sola sentencia. */
export async function correosDeLaCelda(shards: readonly BaseD1[], dia: string): Promise<number> {
  let n = 0;
  for (const db of shards) {
    const f = await db
      .prepare(
        `SELECT count(*) AS n FROM correo WHERE dia = ? AND estado IN ${ESTADOS_QUE_CUENTAN}`,
      )
      .bind(dia)
      .first<{ n: number }>();
    n += f?.n ?? 0;
  }
  return n;
}

/** Anota un correo que no salió. Nunca pisa uno `enviado`. */
const anotarFalla = (
  c: ContextoDeCorreo,
  clave: string,
  tipo: TipoDeCorreo,
  dia: string,
  motivo: MotivoSinEnviar,
  detalle: string,
) =>
  c.db
    .prepare(
      `INSERT INTO correo (org_id, clave, tipo, dia, estado, intentos, motivo, detalle, creado, actualizado)
       VALUES (?, ?, ?, ?, 'fallido', 1, ?, ?, ?, ?)
       ON CONFLICT (org_id, clave) DO UPDATE SET estado = 'fallido', motivo = excluded.motivo,
         detalle = excluded.detalle, actualizado = excluded.actualizado,
         intentos = CASE WHEN correo.estado = 'enviando' THEN correo.intentos
                         ELSE min(correo.intentos + 1, ${INTENTOS}) END
       WHERE correo.estado <> 'enviado'`,
    )
    .bind(c.org, clave, tipo, dia, motivo, detalle.slice(0, 300), c.ahora, c.ahora)
    .run();

/** Si esta clave ya no se manda: salió, está saliendo o se le acabaron los intentos. */
export async function yaNoSeManda(c: Pick<ContextoDeCorreo, 'db' | 'org'>, clave: string) {
  const f = await c.db
    .prepare('SELECT estado, intentos, motivo FROM correo WHERE org_id = ? AND clave = ?')
    .bind(c.org, clave)
    .first<{ estado: string; intentos: number; motivo: MotivoSinEnviar | null }>();
  if (!f) return false;
  if (f.estado !== 'fallido') return true;
  return f.intentos >= INTENTOS || !f.motivo || !REINTENTABLES.has(f.motivo);
}

/**
 * Manda un correo una sola vez por clave, dentro del tope de la tienda y de la celda, y anota lo
 * que pasó. `armar` solo corre si hay con qué enviar y cupo.
 */
export async function mandarUnaVez(
  c: ContextoDeCorreo,
  clave: string,
  tipo: TipoDeCorreo,
  armar: () => Correo | Promise<Correo>,
): Promise<ResultadoDelCorreo> {
  const dia = fechaEnBogota(Date.parse(c.ahora));
  if (await yaNoSeManda(c, clave)) return 'repetido';
  if (!c.correo.disponible) {
    await anotarFalla(c, clave, tipo, dia, 'no-disponible', 'el correo no está configurado');
    return 'fallido';
  }
  if (c.enLaCelda && (await c.enLaCelda(dia)) >= TOPE_DE_LA_CELDA) {
    await anotarFalla(c, clave, tipo, dia, 'tope', `la celda llegó a ${TOPE_DE_LA_CELDA} hoy`);
    return 'fallido';
  }
  // La reserva y el tope de la tienda en una sola sentencia: dos envíos a la vez no lo pasan.
  const cupo = `(SELECT count(*) FROM correo WHERE org_id = ? AND dia = ? AND estado IN ${ESTADOS_QUE_CUENTAN}) < ${TOPE_POR_TIENDA}`;
  const reservado = await c.db
    .prepare(
      `INSERT INTO correo (org_id, clave, tipo, dia, estado, intentos, creado, actualizado)
       SELECT ?, ?, ?, ?, 'enviando', 1, ?, ? WHERE ${cupo}
       ON CONFLICT (org_id, clave) DO UPDATE SET estado = 'enviando', intentos = correo.intentos + 1,
         motivo = NULL, detalle = NULL, actualizado = excluded.actualizado
       WHERE correo.estado = 'fallido' AND correo.intentos < ${INTENTOS}`,
    )
    .bind(c.org, clave, tipo, dia, c.ahora, c.ahora, c.org, dia)
    .run();
  if ((reservado.meta.changes ?? 0) === 0) {
    // O alguien la reservó entre tanto, o la tienda llegó a su tope.
    if (await yaNoSeManda(c, clave)) return 'repetido';
    await anotarFalla(c, clave, tipo, dia, 'tope', `la tienda llegó a ${TOPE_POR_TIENDA} hoy`);
    return 'fallido';
  }
  let r: ResultadoDelEnvio;
  try {
    r = await c.correo.enviar(await armar());
  } catch (e) {
    r = { enviado: false, motivo: 'falla', detalle: String(e) };
  }
  if (r.enviado) {
    await c.db
      .prepare(
        `UPDATE correo SET estado = 'enviado', proveedor_id = ?, actualizado = ?
          WHERE org_id = ? AND clave = ? AND estado = 'enviando'`,
      )
      .bind(r.id.slice(0, 100), c.ahora, c.org, clave)
      .run();
    return 'enviado';
  }
  await anotarFalla(c, clave, tipo, dia, r.motivo, r.detalle);
  console.error(`tienda-api: el correo ${clave} de ${c.org} no salió (${r.motivo}: ${r.detalle})`);
  return 'fallido';
}

/** A dónde van los correos del comercio y a dónde responde el comprador. */
export async function correosDeLaTienda(db: BaseD1, org: string) {
  const { results } = await db
    .prepare(
      "SELECT seccion, datos FROM ajuste WHERE org_id = ? AND seccion IN ('identidad', 'contacto', 'legal', 'avisos')",
    )
    .bind(org)
    .all<{ seccion: string; datos: string }>();
  const tienda = await db
    .prepare('SELECT nombre, estado FROM tienda WHERE org_id = ?')
    .bind(org)
    .first<{ nombre: string; estado: string }>();
  const de = (s: string) =>
    JSON.parse(results.find((r) => r.seccion === s)?.datos ?? '{}') as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  const contacto = texto(de('contacto')['correo']);
  const legal = texto(de('legal')['correo']);
  const avisos = de('avisos');
  return {
    nombre: texto(de('identidad')['nombre']) ?? tienda?.nombre ?? '',
    estado: tienda?.estado ?? null,
    /** El resumen y el cobro de prueba: el de Avisos; si no hay, el de la ficha legal. */
    comercio: texto(avisos['correo']) ?? legal ?? contacto,
    /** Lo que el comprador responde: el de contacto, que es el público. */
    responderA: contacto ?? legal,
    /** Solo con un correo en Avisos sale el resumen: es la forma de pedirlo. */
    resumen: texto(avisos['correo']),
    hora: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(avisos['hora'] ?? ''))
      ? String(avisos['hora'])
      : HORA_DEL_RESUMEN,
  };
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «viernes 16 de octubre», de una fecha `AAAA-MM-DD`: con el calendario, sin `Intl`. */
export function fechaEnPalabras(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return `${DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d} de ${MESES[m - 1]}`;
}

const cuantos = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function cuandoVence(s: FilaDeSolicitud): string {
  if (s.dias < 0) return `venció hace ${cuantos(-s.dias, 'día', 'días')}`;
  if (s.dias === 0) return 'vence hoy';
  return `vence en ${cuantos(s.dias, 'día', 'días')} (el ${fechaEnPalabras(s.vence).replace(/^\S+ /, '')})`;
}

export interface DatosDelResumen {
  tienda: string;
  /** `AAAA-MM-DD` de Bogotá. */
  dia: string;
  tablero: Tablero;
  ayer: Cifras;
  solicitudes: FilaDeSolicitud[];
}

/** El resumen de la mañana. `null` si no hay nada que hacer ni nada vendido ayer: no se manda. */
export function resumenDiario(d: DatosDelResumen): { asunto: string; texto: string } | null {
  const p = d.tablero.pendientes;
  const tareas = [
    p.porConfirmar && `${cuantos(p.porConfirmar, 'pedido', 'pedidos')} por confirmar.`,
    p.porDespachar && `${cuantos(p.porDespachar, 'pedido', 'pedidos')} por despachar.`,
    p.pagosSinExistencias &&
      `${cuantos(p.pagosSinExistencias, 'pago', 'pagos')} sin existencias: repón las unidades o devuelve el dinero.`,
    p.cobrosARevisar &&
      `${cuantos(p.cobrosARevisar, 'cobro', 'cobros')} a revisar: Bold dijo otro monto.`,
    p.recaudosAtrasados &&
      `${cuantos(p.recaudosAtrasados, 'recaudo atrasado', 'recaudos atrasados')}: la transportadora lleva más de 3 días hábiles sin liquidar${p.recaudosAtrasados === 1 ? 'lo' : 'los'}.`,
    p.agotados && `${cuantos(p.agotados, 'variante agotada', 'variantes agotadas')}.`,
  ].filter((t): t is string => Boolean(t));
  const porVencer = d.solicitudes.filter((s) => s.alerta !== null);
  if (tareas.length === 0 && porVencer.length === 0 && d.ayer.vendidos === 0) return null;

  const urgentes = porVencer.filter((s) => s.alerta === 'hoy' || s.alerta === 'vencida').length;
  const fecha = fechaEnPalabras(d.dia);
  const asunto = urgentes
    ? `${d.tienda} · ${urgentes === 1 ? 'una solicitud vence' : `${urgentes} solicitudes vencen`} hoy o ya venció`
    : `${d.tienda} · lo de hoy, ${fecha}`;
  const mes = d.tablero.mes;
  const anterior = d.tablero.anterior;
  const texto = [
    `Buenos días. Esto es lo que tiene ${d.tienda} para hoy, ${fecha}:`,
    ...(tareas.length ? ['', 'Para hacer hoy', ...tareas.map((t) => `- ${t}`)] : []),
    ...(porVencer.length
      ? [
          '',
          'Solicitudes por vencer',
          ...porVencer.map((s) => `- ${s.radicado} · ${s.tipo} · ${cuandoVence(s)}.`),
        ]
      : []),
    '',
    d.ayer.vendidos
      ? `Ayer vendiste ${formatearPesos(d.ayer.ventasCop)} en ${cuantos(d.ayer.vendidos, 'pedido', 'pedidos')}.`
      : 'Ayer no hubo ventas.',
    `En el mes van ${formatearPesos(mes.ventasCop)}, frente a ${formatearPesos(anterior.ventasCop)} del mes anterior ${d.tablero.periodos.anteriorCompleto ? 'entero' : 'a la misma altura'}.`,
    '',
    `Entra al panel: ${PANEL}`,
    '',
    'Este correo te llega porque lo pediste en Ajustes, Avisos. Para dejar de recibirlo, borra el correo de esa sección.',
  ].join('\n');
  return { asunto, texto };
}

/** El acuse al comprador: lo mismo que el WhatsApp, dicho desde la tienda. */
export function acuseDelPedido(
  d: DatosDelTexto,
  nombre: string,
  responderA: boolean,
): { asunto: string; texto: string } {
  return {
    asunto: `Tu pedido ${d.codigo} en ${d.tienda}`,
    texto: [
      `Hola, ${nombre}:`,
      '',
      `Recibimos tu pedido en ${d.tienda}. Guarda este correo: el enlace del final es la forma de seguirlo desde cualquier teléfono o computador.`,
      '',
      ...resumenDelPedido(d),
      '',
      'Si ya pagaste, la tienda lo ve en cuanto Bold le avise. Si no alcanzaste a pagar, el pedido no queda pagado y la tienda no lo despacha.',
      ...(responderA ? ['', `¿Preguntas? Responde este correo: le llega a ${d.tienda}.`] : []),
    ].join('\n'),
  };
}

/** HU-T14.3 CA2: el resumen de una tienda, si ya es su hora y no salió hoy. */
export async function resumenDeLaTienda(
  c: ContextoDeCorreo,
): Promise<ResultadoDelCorreo | 'no-toca' | 'sin-novedad'> {
  const t = await correosDeLaTienda(c.db, c.org);
  if (!t.resumen || t.estado === 'baja' || t.estado === 'borrador') return 'no-toca';
  const ahoraMs = Date.parse(c.ahora);
  const dia = fechaEnBogota(ahoraMs);
  // La hora de Bogotá (UTC−5, sin horario de verano). Si la corrida de su hora falló, sale después.
  const hora = new Date(ahoraMs - 5 * 3_600_000).getUTCHours();
  if (hora < Number(t.hora.slice(0, 2))) return 'no-toca';
  const clave = `resumen:${dia}`;
  if (await yaNoSeManda(c, clave)) return 'repetido';
  const q = { db: c.db, org: c.org, actor: 'sistema', instante: c.ahora };
  const inicioDeHoy = Date.parse(`${dia}T00:00:00-05:00`);
  const [deTablero, ayer, { solicitudes }] = await Promise.all([
    tablero(q, ahoraMs),
    cifras(q, {
      desde: new Date(inicioDeHoy - 86_400_000).toISOString(),
      hasta: new Date(inicioDeHoy).toISOString(),
    }),
    listarSolicitudes(q, ahoraMs),
  ]);
  const r = resumenDiario({ tienda: t.nombre, dia, tablero: deTablero, ayer, solicitudes });
  if (!r) return 'sin-novedad';
  const para = t.resumen;
  return mandarUnaVez(c, clave, 'resumen', () => ({ para, ...r, nombre: t.nombre }));
}

/**
 * HU-T14.3 CA2 y HU-T11.9 CA1: el acuse del pedido que se va a pagar en línea, con su enlace. Va
 * cuando el pedido nace, antes de pagar: es lo que deja volver a él desde otro navegador.
 */
export async function mandarAcuse(
  c: ContextoDeCorreo & { host: string },
  pedidoId: string,
  comprador: { nombre: string; correo: string },
  secreto: string,
): Promise<ResultadoDelCorreo> {
  return mandarUnaVez(c, `acuse:${pedidoId}`, 'acuse', async () => {
    const t = await correosDeLaTienda(c.db, c.org);
    const d = await datosDelPedidoEscrito(c, pedidoId, t.nombre, secreto);
    return {
      para: comprador.correo,
      ...acuseDelPedido(d, comprador.nombre, t.responderA !== null),
      nombre: t.nombre,
      ...(t.responderA ? { responderA: t.responderA } : {}),
    };
  });
}

const RESULTADO_DE_LA_PRUEBA: Record<string, string> = {
  aprobado: 'salió aprobado',
  aprobado_sin_existencias: 'salió aprobado, pero ya no había unidades',
  rechazado: 'salió rechazado',
  revisar: 'llegó con otro monto y quedó por revisar',
  reembolsado: 'quedó anulado',
};

/**
 * HU-T14.3 CA2: el resultado de un cobro del ambiente de pruebas, al comercio. Uno por cobro; si
 * se supo por la consulta y no por el aviso, lo dice, porque eso es lo que hay que arreglar.
 */
export async function mandarResultadoDePrueba(
  c: ContextoDeCorreo,
  cobroId: string,
  via: 'aviso' | 'consulta',
): Promise<ResultadoDelCorreo | 'no-toca'> {
  const k = await c.db
    .prepare(
      `SELECT k.ambiente, k.estado, k.monto_cop, p.codigo FROM cobro k
         JOIN pedido p ON p.org_id = ? AND p.id = k.pedido_id
        WHERE k.org_id = ? AND k.id = ?`,
    )
    .bind(c.org, c.org, cobroId)
    .first<{ ambiente: string; estado: string; monto_cop: number; codigo: string }>();
  const resultado = k ? RESULTADO_DE_LA_PRUEBA[k.estado] : undefined;
  if (k?.ambiente !== 'pruebas' || !resultado) return 'no-toca';
  const t = await correosDeLaTienda(c.db, c.org);
  if (!t.comercio) return 'no-toca';
  const para = t.comercio;
  return mandarUnaVez(c, `prueba:${cobroId}`, 'prueba', () => ({
    para,
    nombre: t.nombre,
    asunto: `${t.nombre} · el cobro de prueba ${resultado.split(',')[0]}`,
    texto: [
      `El cobro de prueba del pedido ${k.codigo}, por ${formatearPesos(k.monto_cop)}, ${resultado}.`,
      '',
      via === 'aviso'
        ? 'Lo supimos por el aviso de Bold: la dirección de los avisos está bien registrada.'
        : 'Lo supimos preguntándole a Bold, porque su aviso no llegó. Revisa en tu cuenta de Bold que la dirección de los avisos sea la de tu tienda en pruebas.',
      '',
      'Es del ambiente de pruebas de Bold: no movió dinero ni inventario de verdad.',
      '',
      `Entra al panel: ${PANEL}`,
    ].join('\n'),
  }));
}

/**
 * La tarea de cada hora: el resumen de cada tienda a la que ya le toca. Con `ks:tienda-correos`
 * apagado no sale ninguno. Si el permiso de Gmail dejó de servir, falla, para que `/api/salud` lo
 * diga: un resumen que no sale no se nota de otra forma.
 */
export const CORREOS: Tarea = {
  nombre: 'correos-del-dia',
  frecuencia: 'hora',
  async correr(e, instante) {
    if ((await e.flags.get('ks:tienda-correos'))?.trim().toLowerCase() === 'apagado') {
      return 'ks:tienda-correos apagado: no sale ningún correo';
    }
    const correo = e.correo;
    if (!correo?.disponible) return 'el correo no está configurado: no sale ningún resumen';
    const ahora = new Date(instante).toISOString();
    const bases = e.shards.map(([, db]) => db);
    const cuenta = { enviados: 0, fallidos: 0 };
    const fallas: string[] = [];
    for (const [nombre, db] of e.shards) {
      const { results } = await db.prepare('SELECT org_id FROM tienda').all<{ org_id: string }>();
      for (const { org_id } of results) {
        try {
          const r = await resumenDeLaTienda({
            db,
            org: org_id,
            ahora,
            correo,
            enLaCelda: (d) => correosDeLaCelda(bases, d),
          });
          if (r === 'enviado') cuenta.enviados++;
          if (r === 'fallido') cuenta.fallidos++;
        } catch (error) {
          fallas.push(
            `${nombre}/${org_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    if (fallas.length > 0)
      throw new Error(`resúmenes con fallas: ${fallas.slice(0, 5).join('; ')}`);
    const dia = fechaEnBogota(instante);
    if (cuenta.fallidos > 0) {
      const sinPermiso = await Promise.all(
        bases.map((db) =>
          db
            .prepare(
              "SELECT count(*) AS n FROM correo WHERE dia = ? AND estado = 'fallido' AND motivo = 'no-disponible'",
            )
            .bind(dia)
            .first<{ n: number }>(),
        ),
      );
      if (sinPermiso.some((f) => (f?.n ?? 0) > 0)) {
        throw new Error(
          `${cuenta.fallidos} resumen(es) sin enviar: el permiso de Gmail no sirve (volver a darlo, PLATAFORMA §4.11)`,
        );
      }
    }
    return `${cuenta.enviados} resúmenes enviados${cuenta.fallidos > 0 ? `; ${cuenta.fallidos} sin enviar` : ''}`;
  },
};
