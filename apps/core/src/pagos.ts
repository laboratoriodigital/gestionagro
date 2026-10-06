/**
 * Pagar un plan en línea (HU-E0.7). Excepción del dueño a ARQUITECTURA §2.3 (3 oct 2026): el plan
 * Finca se cobra cuando un cliente lo pide.
 *
 * Aquí está lo que se cobra y lo que se activa; con quién se cobra está detrás del adaptador
 * (`proveedor-de-pago.ts`, ED1 §5.3). Del método de la Tienda con Bold se toma lo que vale para un
 * plan: el monto lo calcula el CORE, el cobro va firmado, la dirección de vuelta no se cree (la
 * verdad se le pregunta al proveedor), un monto distinto queda para revisar y un cobro sale de
 * «esperando» una sola vez.
 *
 * - `POST /api/core/pago/crear` (quien administra): anota el cobro de un plan del producto de la
 *   organización y devuelve lo que la página necesita para abrir el pago (HU-C3.4).
 * - `POST /api/core/pago/confirmar` (quien administra): al volver del pago, pregunta al proveedor.
 * - `conciliarPagos` (Cron Trigger cada 15 min): los que siguen esperando, por si la persona pagó
 *   y no volvió a la pantalla. Sin noticias en 24 h, el cobro queda «vencido».
 *
 * Cada pago suma un mes desde hoy, o desde el vencimiento si todavía no llegó. No hay débito
 * automático. Sin las llaves del proveedor, pagar responde que no está disponible y nada más
 * cambia (P1).
 */

import type { BaseD1 } from '@ed1/d1';
import { uuidv7 } from '@ed1/ids';
import { TokenInvalido, verificarAcceso } from '@ed1/tokens';
import type { Context } from 'hono';
import { filaDeAuditoria } from './auditoria.ts';
import type { Entorno } from './entrar.ts';
import {
  cobroMensual,
  planesDe,
  productoDe,
  productoDeOrganizacion,
  rolAdministra,
  vueltaDelProducto,
} from './productos.ts';
import type { EstadoEnElProveedor, ProveedorDePago } from './proveedor-de-pago.ts';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Un mes de plan: 30 días, igual para todos. */
export const DIAS_POR_MES = 30;
/** Pasado esto sin noticias, el cobro queda vencido (el proveedor deja de responder por él). */
const VIDA_DE_UN_COBRO_MS = DIA_MS;
/** Cobros que la conciliación revisa por vuelta: cada uno es una consulta al proveedor. */
const COBROS_POR_VUELTA = 20;

/** Lo que el pago necesita además del entorno del CORE. */
export interface EntornoDePago extends Entorno {
  proveedor: ProveedorDePago | null;
}

async function sesionDe(c: Context, e: Entorno) {
  const token = c.req.header('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  try {
    return await verificarAcceso(e.firmante.publica, token, e.ahora());
  } catch (error) {
    if (error instanceof TokenInvalido) return null;
    throw error;
  }
}

const noDisponible = (c: Context) =>
  c.json(
    {
      estado: 'no-disponible',
      motivo: 'El pago en línea todavía no está disponible. Escríbenos y lo activamos a mano.',
    },
    503,
  );

/** Solo quien administra la organización del token paga: es quien decide el plan. */
async function administradorDe(c: Context, e: Entorno) {
  const sesion = await sesionDe(c, e);
  if (!sesion) {
    return {
      error: c.json({ estado: 'sin-sesion', motivo: 'Entra con tu cuenta para continuar.' }, 401),
    };
  }
  if (!sesion.org) {
    return {
      error: c.json(
        { estado: 'sin-finca', motivo: 'Sube tu finca a la nube desde Cuenta para pagar su plan.' },
        403,
      ),
    };
  }
  // HU-C3.4: el producto es el de la organización en la base; el token v1 no lo trae.
  const producto = await productoDeOrganizacion(e.db, sesion.org);
  if (!producto || !rolAdministra(e.catalogo, producto, sesion.rol ?? '')) {
    return {
      error: c.json(
        { estado: 'prohibido', motivo: 'El plan lo paga quien administra la finca.' },
        403,
      ),
    };
  }
  return { sesion: { usuario: sesion.sub, org: sesion.org, producto } };
}

export async function crearPago(c: Context, e: EntornoDePago): Promise<Response> {
  if (!e.proveedor) return noDisponible(c);
  const quien = await administradorDe(c, e);
  if ('error' in quien) return quien.error;
  const leido = (await c.req.json().catch(() => ({}))) as { plan?: unknown; vuelta?: unknown };
  const plan = typeof leido.plan === 'string' ? leido.plan : '';
  const { producto } = quien.sesion;
  const monto = cobroMensual(e.catalogo, producto, plan);
  if (monto === null) {
    return c.json({ estado: 'invalido', motivo: 'Ese plan no se puede pagar en línea.' }, 400);
  }
  const delCatalogo = productoDe(e.catalogo, producto);
  if (!('producto' in delCatalogo)) {
    return c.json({ estado: 'no-disponible', motivo: 'Este producto no recibe pagos ahora.' }, 503);
  }
  // El proveedor devuelve a la persona a esta pantalla: solo una de la app del producto (como al
  // entrar). Se guarda lo que el proveedor devuelve, sin consulta ni fragmento de quien la pidió.
  const vuelta = vueltaDelProducto(
    typeof leido.vuelta === 'string' ? leido.vuelta : undefined,
    delCatalogo.producto,
    e.origenes,
  );
  if (!vuelta) {
    return c.json({ estado: 'invalido', motivo: 'Esa dirección de vuelta no es de la app.' }, 400);
  }
  const destino = new URL(vuelta);
  // Letras, números y guiones: lo que Bold acepta como código de orden. El prefijo dice de qué
  // producto es el cobro en el panel del proveedor.
  const orden = `${delCatalogo.producto.prefijo_de_cobro ?? delCatalogo.producto.id}-${uuidv7()}`;
  const ahora = new Date(e.ahora()).toISOString();
  await e.db
    .prepare(
      `INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, creado, actualizado)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 'esperando', ?, ?)`,
    )
    .bind(
      orden,
      producto,
      e.proveedor.nombre,
      quien.sesion.org,
      quien.sesion.usuario,
      plan,
      monto,
      e.proveedor.ambiente,
      ahora,
      ahora,
    )
    .run();
  const nombre = planesDe(e.catalogo, producto).find((p) => p.id === plan)?.nombre ?? plan;
  destino.searchParams.set('pago', orden);
  const preparado = await e.proveedor.prepararCobro({
    orden,
    monto,
    descripcion: `Plan ${nombre} de ${delCatalogo.producto.nombre}, un mes`,
    vuelta: destino.toString(),
  });
  return c.json({ orden, pruebas: e.proveedor.ambiente === 'pruebas', ...preparado });
}

/** Nuevo vencimiento: un mes más desde hoy, o desde el vencimiento si todavía no llegó. */
export function nuevoVencimiento(vigente: string | null, ahora: number, meses: number): string {
  const desde = Math.max(ahora, vigente ? Date.parse(vigente) : 0);
  return new Date(desde + meses * DIAS_POR_MES * DIA_MS).toISOString();
}

interface FilaDePago {
  id: string;
  org_id: string;
  /** Quien pagó: la auditoría lo nombra (HU-C2.4). */
  usuario_id: string;
  plan: string;
  meses: number;
  monto_cop: number;
  ambiente: 'pruebas' | 'produccion';
  estado: string;
  motivo: string | null;
  creado: string;
}

const COLUMNAS = 'id, org_id, usuario_id, plan, meses, monto_cop, ambiente, estado, motivo, creado';

export interface Desenlace {
  estado: 'esperando' | 'aprobado' | 'rechazado' | 'revisar' | 'vencido';
  motivo: string | null;
}

/**
 * Lo que dijo el proveedor, aplicado a un cobro que sigue esperando. Cerrar el cobro y activar el
 * plan van en un mismo lote; si otro camino (la pantalla o la conciliación) ya lo cerró, no se
 * extiende otra vez. Lo comparten confirmar y conciliar.
 */
async function aplicar(
  db: BaseD1,
  pago: FilaDePago,
  respuesta: EstadoEnElProveedor,
  ahora: number,
): Promise<Desenlace> {
  const iso = new Date(ahora).toISOString();
  const cerrar = (estado: Desenlace['estado'], motivo: string | null) =>
    db
      .prepare(
        "UPDATE pago SET estado = ?, motivo = ?, transaccion = ?, actualizado = ? WHERE id = ? AND estado = 'esperando'",
      )
      .bind(estado, motivo, respuesta.transaccion, iso, pago.id);
  // HU-C2.4: un pago cerrado deja su fila, solo si este camino fue el que lo cerró.
  const auditar = (estado: Desenlace['estado']) =>
    filaDeAuditoria(
      db,
      {
        instante: iso,
        producto: 'agro',
        org_id: pago.org_id,
        usuario_id: pago.usuario_id,
        accion: 'pago_cerrado',
        detalle: {
          pago: pago.id,
          estado,
          plan: pago.plan,
          meses: pago.meses,
          monto_cop: pago.monto_cop,
        },
      },
      {
        sql: 'SELECT 1 FROM pago WHERE id = ? AND estado = ? AND actualizado = ?',
        valores: [pago.id, estado, iso],
      },
    );
  const cerrarYAuditar = (estado: Desenlace['estado'], motivo: string | null) =>
    db.batch([cerrar(estado, motivo), auditar(estado)]);

  if (respuesta.estado === 'aprobado') {
    if (respuesta.total !== pago.monto_cop) {
      const motivo = `El pago se aprobó por ${respuesta.total ?? '?'} y el plan cuesta ${pago.monto_cop}: lo revisamos y te escribimos.`;
      await cerrarYAuditar('revisar', motivo);
      console.error(`agro-core: pago ${pago.id} aprobado por otro monto`);
      return { estado: 'revisar', motivo };
    }
    const vigente = await db
      .prepare('SELECT plan, plan_vence FROM organizacion WHERE id = ?')
      .bind(pago.org_id)
      .first<{ plan: string; plan_vence: string | null }>();
    const vence = nuevoVencimiento(
      vigente?.plan === pago.plan ? (vigente.plan_vence ?? null) : null,
      ahora,
      pago.meses,
    );
    const [cierre] = await db.batch([
      cerrar('aprobado', null),
      db
        .prepare(
          "UPDATE organizacion SET plan = ?, plan_vence = ? WHERE id = ? AND EXISTS (SELECT 1 FROM pago WHERE id = ? AND estado = 'aprobado' AND actualizado = ?)",
        )
        .bind(pago.plan, vence, pago.org_id, pago.id, iso),
      auditar('aprobado'),
    ]);
    if ((cierre?.meta.changes ?? 0) === 0) return releer(db, pago.id);
    return { estado: 'aprobado', motivo: null };
  }
  if (respuesta.estado === 'rechazado') {
    const motivo = 'El pago no se aprobó. No se cobró nada; puedes intentarlo otra vez.';
    await cerrarYAuditar('rechazado', motivo);
    return { estado: 'rechazado', motivo };
  }
  if (ahora - Date.parse(pago.creado) > VIDA_DE_UN_COBRO_MS) {
    const motivo = 'Pasó un día sin noticias de este pago. Si te cobraron, escríbenos.';
    await cerrarYAuditar('vencido', motivo);
    return { estado: 'vencido', motivo };
  }
  return {
    estado: 'esperando',
    motivo:
      respuesta.crudo === 'NO_TRANSACTION_FOUND'
        ? 'Todavía no hay noticias de este pago. Si ya pagaste, espera unos minutos.'
        : 'El pago sigue en proceso en tu banco.',
  };
}

async function releer(db: BaseD1, id: string): Promise<Desenlace> {
  const fila = await db
    .prepare('SELECT estado, motivo FROM pago WHERE id = ?')
    .bind(id)
    .first<{ estado: Desenlace['estado']; motivo: string | null }>();
  return { estado: fila?.estado ?? 'esperando', motivo: fila?.motivo ?? null };
}

export async function confirmarPago(c: Context, e: EntornoDePago): Promise<Response> {
  if (!e.proveedor) return noDisponible(c);
  const quien = await administradorDe(c, e);
  if ('error' in quien) return quien.error;
  const leido = (await c.req.json().catch(() => ({}))) as { orden?: unknown };
  const orden = typeof leido.orden === 'string' ? leido.orden : '';
  const pago = await e.db
    .prepare(`SELECT ${COLUMNAS} FROM pago WHERE id = ? AND org_id = ?`)
    .bind(orden, quien.sesion.org)
    .first<FilaDePago>();
  if (!pago) return c.json({ estado: 'invalido', motivo: 'No encontramos ese pago.' }, 404);
  const plan = async () =>
    (await e.db
      .prepare('SELECT plan, plan_vence FROM organizacion WHERE id = ?')
      .bind(pago.org_id)
      .first<{ plan: string; plan_vence: string | null }>()) ?? {
      plan: 'gratuito',
      plan_vence: null,
    };
  // Ya cerrado: se contesta lo mismo, sin volver a preguntar ni a escribir.
  if (pago.estado !== 'esperando') {
    return c.json({ estado: pago.estado, motivo: pago.motivo, ...(await plan()) });
  }
  if (pago.ambiente !== e.proveedor.ambiente) {
    return c.json({ estado: 'esperando', motivo: 'Ese pago es de otro ambiente de pagos.' });
  }
  let respuesta: EstadoEnElProveedor;
  try {
    respuesta = await e.proveedor.consultar(pago.id);
  } catch (error) {
    console.error('agro-core: el proveedor de pagos no respondió', (error as Error).message);
    return c.json({
      estado: 'esperando',
      motivo: 'No pudimos preguntar por tu pago. No se pierde: vuelve a verificar en unos minutos.',
    });
  }
  const desenlace = await aplicar(e.db, pago, respuesta, e.ahora());
  return c.json(desenlace.estado === 'esperando' ? desenlace : { ...desenlace, ...(await plan()) });
}

/**
 * Cron Trigger (cada 15 min): pregunta por los cobros que siguen esperando, por si la persona pagó
 * y cerró el navegador antes de volver. Una lectura de D1 por vuelta si no hay ninguno.
 */
export async function conciliarPagos(
  db: BaseD1,
  proveedor: ProveedorDePago | null,
  ahora: number,
): Promise<{ revisados: number; cerrados: number }> {
  if (!proveedor) return { revisados: 0, cerrados: 0 };
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNAS} FROM pago WHERE estado = 'esperando' AND ambiente = ? ORDER BY creado LIMIT ?`,
    )
    .bind(proveedor.ambiente, COBROS_POR_VUELTA)
    .all<FilaDePago>();
  let cerrados = 0;
  for (const pago of results) {
    try {
      const desenlace = await aplicar(db, pago, await proveedor.consultar(pago.id), ahora);
      if (desenlace.estado !== 'esperando') cerrados++;
    } catch (error) {
      console.error(`agro-core: no se pudo conciliar ${pago.id}`, (error as Error).message);
    }
  }
  return { revisados: results.length, cerrados };
}
