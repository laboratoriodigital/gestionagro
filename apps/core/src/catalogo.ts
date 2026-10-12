/**
 * El catálogo de productos del CORE en la base (HU-C2.3, PLATAFORMA §4.2, ADR-20).
 *
 * `infrastructure/productos.json` y el `planes.json` de cada producto son la fuente (P2). El
 * despliegue escribe estas sentencias antes que las de las celdas (una celda apunta a su producto)
 * y después lee la base y la compara con el archivo (`diferenciasDelCatalogo`), en vez de creer
 * que se aplicó (P16).
 *
 * - Productos, roles y planes se insertan o se ponen al día. Uno que sale del archivo queda
 *   `retirado`, nunca se borra: hay filas que lo nombran (P21). Un tipo o un rol que sale del
 *   archivo se queda en la base por la misma razón.
 * - Un precio no se edita: si el monto de un periodo cambió, entra una fila nueva con su
 *   `vigente_desde` y la anterior queda como historia. Si no cambió, no se escribe nada.
 * - Los periodos (`PERIODOS`) se aseguran con `INSERT OR IGNORE`: uno nuevo es una fila (PC1).
 */
import { NOMBRE_DE_PERIODO, PERIODOS } from '@ed1/productos';

export interface PlanDelArchivo {
  id: string;
  nombre: string;
  gratuito?: boolean;
  cobro?: Record<string, number>;
}

/** Lo que el catálogo dice de un producto, ya con sus planes leídos. */
export interface ProductoDelCatalogo {
  id: string;
  nombre: string;
  estado: 'activo' | 'pausado' | 'retirado';
  tipos: string[];
  roles: { id: string; administra: boolean; invitable: boolean }[];
  planes: PlanDelArchivo[];
  /** Los alcances de OAuth del producto (HU-C9.2); ninguno si no declara. */
  alcances?: { id: string; descripcion: string }[];
}

/** Literal de texto SQL. Los ids vienen validados por el esquema; esto es la segunda red. */
const t = (valor: string) => `'${valor.replaceAll("'", "''")}'`;
const b = (valor: boolean | undefined) => (valor ? 1 : 0);

export function sentenciasDelCatalogo(
  productos: readonly ProductoDelCatalogo[],
  ahora: string,
): string[] {
  if (productos.length === 0)
    throw new Error('productos.json no trae productos: no se toca el catálogo');
  const s: string[] = PERIODOS.map(
    (n) =>
      `INSERT OR IGNORE INTO periodo (meses, nombre) VALUES (${n}, ${t(NOMBRE_DE_PERIODO[n])});`,
  );
  for (const p of productos) {
    s.push(
      `INSERT INTO producto (id, nombre, estado, actualizado) VALUES (${t(p.id)}, ${t(p.nombre)}, ${t(p.estado)}, ${t(ahora)}) ` +
        'ON CONFLICT (id) DO UPDATE SET nombre = excluded.nombre, estado = excluded.estado, actualizado = excluded.actualizado ' +
        'WHERE producto.nombre IS NOT excluded.nombre OR producto.estado IS NOT excluded.estado;',
    );
    for (const tipo of p.tipos) {
      s.push(
        `INSERT OR IGNORE INTO producto_tipo (producto, tipo) VALUES (${t(p.id)}, ${t(tipo)});`,
      );
    }
    for (const r of p.roles) {
      s.push(
        `INSERT INTO producto_rol (producto, rol, administra, invitable) VALUES (${t(p.id)}, ${t(r.id)}, ${b(r.administra)}, ${b(r.invitable)}) ` +
          'ON CONFLICT (producto, rol) DO UPDATE SET administra = excluded.administra, invitable = excluded.invitable;',
      );
    }
    for (const plan of p.planes) {
      s.push(
        `INSERT INTO plan (producto, id, nombre, gratuito, estado) VALUES (${t(p.id)}, ${t(plan.id)}, ${t(plan.nombre)}, ${b(plan.gratuito)}, 'activo') ` +
          "ON CONFLICT (producto, id) DO UPDATE SET nombre = excluded.nombre, gratuito = excluded.gratuito, estado = 'activo';",
      );
      for (const [meses, monto] of Object.entries(plan.cobro ?? {})) {
        // Entra solo si el precio vigente de ese periodo es otro, o no hay ninguno.
        s.push(
          `INSERT INTO plan_precio (producto, plan, meses, monto_cop, vigente_desde) SELECT ${t(p.id)}, ${t(plan.id)}, ${Number(meses)}, ${monto}, ${t(ahora)} ` +
            `WHERE ${monto} IS NOT (SELECT monto_cop FROM plan_precio WHERE producto = ${t(p.id)} AND plan = ${t(plan.id)} AND meses = ${Number(meses)} ORDER BY vigente_desde DESC LIMIT 1);`,
        );
      }
    }
    // HU-C9.2: los alcances, como los planes. Uno que sale del archivo queda retirado (P21).
    for (const a of p.alcances ?? []) {
      s.push(
        `INSERT INTO alcance (producto, id, descripcion, estado) VALUES (${t(p.id)}, ${t(a.id)}, ${t(a.descripcion)}, 'activo') ` +
          "ON CONFLICT (producto, id) DO UPDATE SET descripcion = excluded.descripcion, estado = 'activo';",
      );
    }
    const alcances = (p.alcances ?? []).map((x) => t(x.id)).join(', ');
    s.push(
      `UPDATE alcance SET estado = 'retirado' WHERE producto = ${t(p.id)} AND estado <> 'retirado'${alcances ? ` AND id NOT IN (${alcances})` : ''};`,
    );
    const planes = p.planes.map((x) => t(x.id)).join(', ');
    s.push(
      `UPDATE plan SET estado = 'retirado' WHERE producto = ${t(p.id)} AND estado <> 'retirado'${planes ? ` AND id NOT IN (${planes})` : ''};`,
    );
  }
  const ids = productos.map((p) => t(p.id)).join(', ');
  s.push(
    `UPDATE producto SET estado = 'retirado', actualizado = ${t(ahora)} WHERE estado <> 'retirado' AND id NOT IN (${ids});`,
  );
  return s;
}

/**
 * Lo que el despliegue le pregunta a la base para comparar. Sin comillas en el SQL, para que el
 * comando sirva igual en cualquier shell; el filtro se hace aquí.
 */
export const CONSULTAS_DEL_CATALOGO = [
  'SELECT id, nombre, estado FROM producto',
  'SELECT producto, tipo FROM producto_tipo',
  'SELECT producto, rol, administra, invitable FROM producto_rol',
  'SELECT producto, id, nombre, gratuito, estado FROM plan',
  'SELECT producto, plan, meses, monto_cop, vigente_desde FROM plan_precio',
  'SELECT producto, id, descripcion, estado FROM alcance',
].join('; ');

type Fila = Record<string, unknown>;

/**
 * Compara el catálogo del archivo con las filas de la base (los resultados de
 * `CONSULTAS_DEL_CATALOGO`, en ese orden). Devuelve cada diferencia en una frase (P15). Lo que la
 * base tiene de más y está retirado no es una diferencia.
 */
export function diferenciasDelCatalogo(
  productos: readonly ProductoDelCatalogo[],
  [enBase, tipos, roles, planes, precios, alcances]: readonly Fila[][],
): string[] {
  const d: string[] = [];
  if (!enBase || !tipos || !roles || !planes || !precios || !alcances) {
    return ['la base no devolvió las seis consultas del catálogo'];
  }
  for (const p of productos) {
    const fila = enBase.find((x) => x['id'] === p.id);
    if (!fila) {
      d.push(`el producto «${p.id}» no está en la base`);
      continue;
    }
    if (fila['nombre'] !== p.nombre || fila['estado'] !== p.estado) {
      d.push(
        `producto «${p.id}»: la base dice «${String(fila['nombre'])}», ${String(fila['estado'])}; el archivo, «${p.nombre}», ${p.estado}`,
      );
    }
    for (const tipo of p.tipos) {
      if (!tipos.some((x) => x['producto'] === p.id && x['tipo'] === tipo)) {
        d.push(`falta el tipo «${tipo}» de «${p.id}»`);
      }
    }
    for (const r of p.roles) {
      const f = roles.find((x) => x['producto'] === p.id && x['rol'] === r.id);
      if (!f || f['administra'] !== b(r.administra) || f['invitable'] !== b(r.invitable)) {
        d.push(`el rol «${r.id}» de «${p.id}» no es el del archivo`);
      }
    }
    for (const plan of p.planes) {
      const f = planes.find((x) => x['producto'] === p.id && x['id'] === plan.id);
      if (
        !f ||
        f['nombre'] !== plan.nombre ||
        f['gratuito'] !== b(plan.gratuito) ||
        f['estado'] !== 'activo'
      ) {
        d.push(`el plan «${p.id}/${plan.id}» no es el del archivo`);
        continue;
      }
      for (const [meses, monto] of Object.entries(plan.cobro ?? {})) {
        const vigente = precios
          .filter(
            (x) => x['producto'] === p.id && x['plan'] === plan.id && x['meses'] === Number(meses),
          )
          .sort((x, y) => String(y['vigente_desde']).localeCompare(String(x['vigente_desde'])))[0];
        if (vigente?.['monto_cop'] !== monto) {
          d.push(
            `el precio de «${p.id}/${plan.id}» por ${meses} meses es ${String(vigente?.['monto_cop'] ?? 'ninguno')} en la base y ${monto} en el archivo`,
          );
        }
      }
    }
    for (const a of p.alcances ?? []) {
      const f = alcances.find((x) => x['producto'] === p.id && x['id'] === a.id);
      if (!f || f['descripcion'] !== a.descripcion || f['estado'] !== 'activo') {
        d.push(`el alcance «${a.id}» no es el del archivo`);
      }
    }
    for (const f of alcances.filter((x) => x['producto'] === p.id && x['estado'] !== 'retirado')) {
      if (!(p.alcances ?? []).some((x) => x.id === f['id'])) {
        d.push(
          `el alcance «${String(f['id'])}» sigue activo en la base y ya no está en el archivo`,
        );
      }
    }
    for (const f of planes.filter((x) => x['producto'] === p.id && x['estado'] !== 'retirado')) {
      if (!p.planes.some((x) => x.id === f['id'])) {
        d.push(
          `el plan «${p.id}/${String(f['id'])}» sigue activo en la base y ya no está en el archivo`,
        );
      }
    }
  }
  for (const f of enBase.filter((x) => x['estado'] !== 'retirado')) {
    if (!productos.some((p) => p.id === f['id'])) {
      d.push(`el producto «${String(f['id'])}» sigue en la base y ya no está en el archivo`);
    }
  }
  return d;
}
