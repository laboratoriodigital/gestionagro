/**
 * Un pago del plan en efectivo (HU-C5.8): el cliente le paga al dueño en mano y el dueño lo
 * registra desde GitHub (flujo `registrar-pago-en-efectivo`, `docs/runbooks/pago-en-efectivo.md`).
 * Queda como un pago de Bold: una fila en `pago` con su periodo, el plan activado con la misma regla
 * y una fila de auditoría, con `proveedor = 'efectivo'` y quién lo registró. La celda se entera en
 * la vuelta de cada hora, como de cualquier pago aprobado (HU-C5.6).
 *
 * No hay ruta del CORE para esto: lo corre un script con el token de Cloudflare del ambiente, que
 * ya existe. Por la API de D1 las sentencias van una tras otra, sin transacción, así que se escriben
 * en un orden que nunca deja un plan activado sin su pago:
 * 1. el pago entra en `revisar`, con su periodo;
 * 2. la organización cambia solo si sigue como se leyó y el pago existe;
 * 3. el pago pasa a `aprobado` solo si la organización quedó con el vencimiento calculado;
 * 4. la auditoría entra solo si el pago quedó aprobado.
 * Si algo cambió entre leer y escribir, el pago queda `rechazado` con el motivo, y nada más cambia.
 */
import type { BaseD1 } from '@ed1/d1';
import { filaDeAuditoria } from './auditoria.ts';
import { creditoAlCambiar, nuevoVencimiento, precioVigente } from './pagos.ts';

const DIA_MS = 24 * 60 * 60 * 1000;

export interface PedidoEnEfectivo {
  /** El id de la organización, o el correo de quien la administra. */
  readonly cliente: string;
  readonly producto: string;
  readonly plan: string;
  readonly meses: number;
  /** Lo que pagó, en pesos; sin él, el precio vigente del plan por esos meses. */
  readonly monto_cop: number | null;
  /** Por qué y cómo: queda en el pago y en la auditoría («Recibo 001, pagó en la oficina»). */
  readonly nota: string;
  /** Quién lo registró: el usuario de GitHub que corrió el flujo. */
  readonly registra: string;
  readonly ambiente: 'pruebas' | 'produccion';
}

export interface Plan {
  readonly organizacion: { readonly id: string; readonly nombre: string };
  readonly plan: string;
  readonly meses: number;
  readonly monto_cop: number;
  /** El precio vigente del periodo, para decir si se cobró distinto. */
  readonly precio_cop: number | null;
  readonly antes: { readonly plan: string; readonly vence: string | null };
  readonly desde: string;
  readonly vence: string;
  /** Días que pasan del plan anterior al nuevo (HU-C5.4). */
  readonly credito_dias: number;
}

export type Planeado = { readonly ok: true; readonly plan: Plan } | NoSe;
export type Registrado =
  | { readonly ok: true; readonly plan: Plan; readonly pago_id: string }
  | NoSe;
interface NoSe {
  readonly ok: false;
  readonly motivo: string;
}

const no = (motivo: string): NoSe => ({ ok: false, motivo });

interface Organizacion {
  id: string;
  nombre: string;
  producto: string;
  plan: string;
  plan_vence: string | null;
  estado: string;
  usuario_id: string | null;
}

/** La organización por su id, o la única del producto que administra ese correo. */
async function organizacionDe(
  db: BaseD1,
  cliente: string,
  producto: string,
): Promise<Organizacion | NoSe> {
  const columnas = `o.id, o.nombre, o.producto, o.plan, o.plan_vence, o.estado,
    (SELECT m.usuario_id FROM membresia m JOIN producto_rol r ON r.producto = m.producto AND r.rol = m.rol
      WHERE m.org_id = o.id AND r.administra = 1 ORDER BY m.creado LIMIT 1) AS usuario_id`;
  if (!cliente.includes('@')) {
    const o = await db
      .prepare(`SELECT ${columnas} FROM organizacion o WHERE o.id = ? AND o.producto = ?`)
      .bind(cliente, producto)
      .first<Organizacion>();
    return o ?? no(`No hay una organización ${cliente} del producto ${producto}.`);
  }
  const { results } = await db
    .prepare(
      `SELECT ${columnas} FROM organizacion o
         JOIN membresia m ON m.org_id = o.id
         JOIN producto_rol r ON r.producto = m.producto AND r.rol = m.rol AND r.administra = 1
         JOIN usuario u ON u.id = m.usuario_id
        WHERE lower(u.email) = lower(?) AND o.producto = ?
        ORDER BY o.creado`,
    )
    .bind(cliente.trim(), producto)
    .all<Organizacion>();
  if (results.length === 0)
    return no(`${cliente} no administra ninguna organización del producto ${producto}.`);
  if (results.length > 1)
    return no(
      `${cliente} administra ${results.length}: escriba el id de la que pagó (${results
        .map((o) => `${o.nombre} = ${o.id}`)
        .join('; ')}).`,
    );
  return results[0] as Organizacion;
}

/** Lo que haría el pago, sin escribir nada: la vista previa del flujo y el primer paso de registrar. */
export async function planearPagoEnEfectivo(
  db: BaseD1,
  p: PedidoEnEfectivo,
  ahora: number,
): Promise<Planeado & { usuario_id?: string }> {
  const nota = p.nota.trim();
  if (nota.length < 3 || nota.length > 200)
    return no('Escriba una nota de 3 a 200 letras: cómo y dónde pagó.');
  if (!Number.isSafeInteger(p.meses)) return no('Los meses son un número entero.');
  const periodo = await db
    .prepare('SELECT 1 AS si FROM periodo WHERE meses = ?')
    .bind(p.meses)
    .first();
  if (!periodo) return no(`No hay un periodo de ${p.meses} meses.`);
  const o = await organizacionDe(db, p.cliente, p.producto);
  if ('ok' in o) return o;
  if (o.estado !== 'activa') return no(`${o.nombre} está «${o.estado}»: no se le activa un plan.`);
  if (!o.usuario_id)
    return no(`${o.nombre} no tiene quién la administre: no hay a nombre de quién.`);
  const plan = await db
    .prepare('SELECT gratuito, estado FROM plan WHERE producto = ? AND id = ?')
    .bind(p.producto, p.plan)
    .first<{ gratuito: number; estado: string }>();
  if (!plan) return no(`El producto ${p.producto} no tiene un plan ${p.plan}.`);
  if (plan.gratuito === 1 || plan.estado !== 'activo')
    return no(`El plan ${p.plan} no se paga: es gratuito o está retirado.`);
  const precio = await precioVigente(db, p.producto, p.plan, p.meses);
  const monto = p.monto_cop ?? precio;
  if (monto === null)
    return no(`El plan ${p.plan} no tiene precio por ${p.meses} meses: escriba el monto que pagó.`);
  if (!Number.isSafeInteger(monto) || monto <= 0)
    return no('El monto es un número entero de pesos.');

  // La misma regla que un pago de Bold (HU-C5.3 CA2 y HU-C5.4): desde el vencimiento si es del
  // mismo plan y no ha llegado; y los días que quedan de otro plan pasan al nuevo.
  const delMismoPlan = o.plan === p.plan ? o.plan_vence : null;
  const desde = new Date(
    Math.max(ahora, delMismoPlan ? Date.parse(delMismoPlan) : 0),
  ).toISOString();
  const restante =
    o.plan !== p.plan && o.plan_vence ? Math.floor((Date.parse(o.plan_vence) - ahora) / DIA_MS) : 0;
  const credito =
    restante > 0
      ? creditoAlCambiar(
          restante,
          await precioVigente(db, p.producto, o.plan, 1),
          await precioVigente(db, p.producto, p.plan, 1),
        )
      : 0;
  const vence = new Date(
    Date.parse(nuevoVencimiento(delMismoPlan, ahora, p.meses)) + credito * DIA_MS,
  ).toISOString();
  return {
    ok: true,
    usuario_id: o.usuario_id,
    plan: {
      organizacion: { id: o.id, nombre: o.nombre },
      plan: p.plan,
      meses: p.meses,
      monto_cop: monto,
      precio_cop: precio,
      antes: { plan: o.plan, vence: o.plan_vence },
      desde,
      vence,
      credito_dias: credito,
    },
  };
}

/** Registra el pago y activa el plan. Ver el orden de las escrituras arriba. */
export async function registrarPagoEnEfectivo(
  db: BaseD1,
  p: PedidoEnEfectivo,
  ahora: number,
  nuevoId: () => string,
): Promise<Registrado> {
  const planeado = await planearPagoEnEfectivo(db, p, ahora);
  if (!planeado.ok) return planeado;
  const { plan } = planeado;
  const usuario = planeado.usuario_id as string;
  const id = nuevoId();
  const iso = new Date(ahora).toISOString();
  const nota = p.nota.trim();
  const org = plan.organizacion.id;
  await db.batch([
    db
      .prepare(
        `INSERT INTO pago (id, producto, proveedor, org_id, usuario_id, plan, meses, monto_cop, ambiente,
           estado, transaccion, motivo, periodo_desde, periodo_hasta, creado, actualizado)
         VALUES (?, ?, 'efectivo', ?, ?, ?, ?, ?, ?, 'revisar', ?, 'Registrando el pago en efectivo', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        p.producto,
        org,
        usuario,
        plan.plan,
        plan.meses,
        plan.monto_cop,
        p.ambiente,
        `efectivo:${p.registra}`,
        plan.desde,
        plan.vence,
        iso,
        iso,
      ),
    db
      .prepare(
        `UPDATE organizacion SET plan = ?, plan_vence = ?
          WHERE id = ? AND plan = ? AND plan_vence IS ?
            AND EXISTS (SELECT 1 FROM pago WHERE id = ? AND estado = 'revisar')`,
      )
      .bind(plan.plan, plan.vence, org, plan.antes.plan, plan.antes.vence, id),
    db
      .prepare(
        `UPDATE pago SET estado = 'aprobado', motivo = ?, actualizado = ?
          WHERE id = ? AND estado = 'revisar'
            AND EXISTS (SELECT 1 FROM organizacion WHERE id = ? AND plan = ? AND plan_vence = ?)`,
      )
      .bind(nota, iso, id, org, plan.plan, plan.vence),
    filaDeAuditoria(
      db,
      {
        instante: iso,
        producto: p.producto,
        org_id: org,
        usuario_id: usuario,
        accion: 'pago_cerrado',
        detalle: {
          pago: id,
          estado: 'aprobado',
          proveedor: 'efectivo',
          plan: plan.plan,
          meses: plan.meses,
          monto_cop: plan.monto_cop,
          registra: p.registra,
          nota,
        },
      },
      { sql: "SELECT 1 FROM pago WHERE id = ? AND estado = 'aprobado'", valores: [id] },
    ),
  ]);
  const quedo = await db
    .prepare('SELECT estado FROM pago WHERE id = ?')
    .bind(id)
    .first<{ estado: string }>();
  if (quedo?.estado === 'aprobado') return { ok: true, plan, pago_id: id };
  const motivo =
    'La organización cambió mientras se registraba el pago: no se aplicó. Vuelva a correr el flujo.';
  await db
    .prepare(
      "UPDATE pago SET estado = 'rechazado', motivo = ?, actualizado = ? WHERE id = ? AND estado = 'revisar'",
    )
    .bind(motivo, iso, id)
    .run();
  return no(motivo);
}
