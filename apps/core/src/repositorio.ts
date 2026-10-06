/**
 * Operaciones del CORE v0 sobre D1 (HU-E4.1): usuarios con su identidad de Google,
 * organizaciones con su ubicación, membresías y el directorio que se consulta al iniciar sesión
 * (ARQUITECTURA §5.4). Sin endpoints públicos todavía: los abre HU-E4.2 detrás del login.
 *
 * Presupuesto (≤ 1.000 filas escritas al día, §8.1): crear una organización escribe 2 filas
 * (organización y membresía del propietario); crear un usuario, 2 (usuario e identidad).
 */

import type { BaseD1 } from '@ed1/d1';
import { uuidv7 } from '@ed1/ids';
import {
  asignarUbicacion,
  type CeldaDelDirectorio,
  SinCeldaDisponible,
  type Ubicacion,
} from './asignacion.ts';

export const ROLES = ['propietario', 'supervisor', 'operario', 'asesor', 'auditor'] as const;
export type Rol = (typeof ROLES)[number];
export const TIPOS_DE_ORGANIZACION = ['finca', 'asesor', 'cadena'] as const;
export type TipoDeOrganizacion = (typeof TIPOS_DE_ORGANIZACION)[number];

/** Reloj inyectable (P8): milisegundos Unix. */
export type Reloj = () => number;
const relojDelSistema: Reloj = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export class ErrorDelCore extends Error {
  override name = 'ErrorDelCore';
}

const sinEspacios = (valor: string, campo: string) => {
  const limpio = valor.trim();
  if (!limpio) throw new ErrorDelCore(`Falta ${campo}`);
  return limpio;
};

export async function leerCeldas(db: BaseD1): Promise<CeldaDelDirectorio[]> {
  const { results } = await db
    .prepare('SELECT id, estado, anillo_despliegue, shards FROM celda ORDER BY id')
    .all<{ id: string; estado: 'activa' | 'fuera'; anillo_despliegue: number; shards: string }>();
  return results.map((c) => ({ ...c, shards: JSON.parse(c.shards) as string[] }));
}

/**
 * Ubicación para una organización nueva, según la regla de `asignacion.ts` (CA3), entre las celdas
 * **de su producto** y con sus pilotos contados por producto (HU-C3.3, PLATAFORMA §4.9): las cinco
 * primeras tiendas son pilotos de la tienda aunque ya haya fincas piloto. Las cargas usan el
 * índice `organizacion_por_celda (producto, celda_id, shard)` de la 0006.
 */
export async function ubicacionNueva(db: BaseD1, producto = 'agro'): Promise<Ubicacion> {
  const [celdas, cargas, pilotos] = await Promise.all([
    db
      .prepare(
        'SELECT id, estado, anillo_despliegue, shards FROM celda WHERE producto = ? ORDER BY id',
      )
      .bind(producto)
      .all<{ id: string; estado: 'activa' | 'fuera'; anillo_despliegue: number; shards: string }>(),
    db
      .prepare(
        'SELECT celda_id, shard, count(*) AS organizaciones FROM organizacion WHERE producto = ? GROUP BY celda_id, shard',
      )
      .bind(producto)
      .all<{ celda_id: string; shard: string; organizaciones: number }>(),
    db
      .prepare('SELECT count(*) AS n FROM organizacion WHERE producto = ? AND anillo = 1')
      .bind(producto)
      .first<{ n: number }>(),
  ]);
  const deLasCeldas = celdas.results.map((c) => ({
    ...c,
    shards: JSON.parse(c.shards) as string[],
  }));
  if (deLasCeldas.length === 0) {
    throw new SinCeldaDisponible(
      `El producto «${producto}» no tiene ninguna celda en el directorio. Revisa infrastructure/celdas.json y despliega.`,
    );
  }
  return asignarUbicacion(deLasCeldas, cargas.results, pilotos?.n ?? 0);
}

/**
 * Usuario de una identidad de Google. Si la identidad ya existe, devuelve su usuario sin
 * escribir nada; si no, crea usuario e identidad juntos.
 */
export async function usuarioDeIdentidad(
  db: BaseD1,
  datos: { sub: string; nombre: string; email: string },
  reloj: Reloj = relojDelSistema,
  /** Versión de la política que la persona aceptó al entrar (HU-E0.5, CA3). */
  politica: string | null = null,
): Promise<{ id: string; nuevo: boolean }> {
  const sub = sinEspacios(datos.sub, 'el identificador de Google');
  const existente = await db
    .prepare(
      `SELECT i.usuario_id, u.politica_version FROM identidad i
         JOIN usuario u ON u.id = i.usuario_id
        WHERE i.proveedor = ? AND i.sub = ?`,
    )
    .bind('google', sub)
    .first<{ usuario_id: string; politica_version: string | null }>();
  const ahora = reloj();
  if (existente) {
    // Aceptó una versión nueva: se guarda cuál y cuándo. La misma versión no escribe nada.
    if (politica && existente.politica_version !== politica) {
      await db
        .prepare('UPDATE usuario SET politica_version = ?, politica_aceptada = ? WHERE id = ?')
        .bind(politica, iso(ahora), existente.usuario_id)
        .run();
    }
    return { id: existente.usuario_id, nuevo: false };
  }
  const id = uuidv7(() => ahora);
  await db.batch([
    db
      .prepare(
        'INSERT INTO usuario (id, nombre, email, creado, politica_version, politica_aceptada) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        sinEspacios(datos.nombre, 'el nombre'),
        sinEspacios(datos.email, 'el email'),
        iso(ahora),
        politica,
        politica ? iso(ahora) : null,
      ),
    db
      .prepare('INSERT INTO identidad (proveedor, sub, usuario_id) VALUES (?, ?, ?)')
      .bind('google', sub, id),
  ]);
  return { id, nuevo: true };
}

export interface Organizacion extends Ubicacion {
  id: string;
  nombre: string;
  /** Un tipo del producto de la organización (en el agro, `TipoDeOrganizacion`). */
  tipo: string;
  /** El plan gratuito del producto, el que tiene `gratuito = 1` en la tabla `plan`. */
  plan: string;
}

/** Crea la organización en su ubicación y hace propietario a quien la crea, en una transacción. */
export async function crearOrganizacion(
  db: BaseD1,
  datos: {
    propietarioId: string;
    nombre: string;
    tipo: TipoDeOrganizacion | string;
    /** Id que trae el teléfono, para que reintentar no cree dos (HU-E4.3). */
    id?: string;
    /**
     * El producto de la organización y el rol con que queda quien la crea (HU-C3.3). Sin ellos, el
     * agro y su «propietario». Un tipo o un rol que no sean del producto los rechaza la base (R3).
     */
    producto?: string;
    rolQueAdministra?: string;
  },
  reloj: Reloj = relojDelSistema,
): Promise<Organizacion> {
  const nombre = sinEspacios(datos.nombre, 'el nombre de la organización');
  const producto = datos.producto ?? 'agro';
  if (producto === 'agro' && !TIPOS_DE_ORGANIZACION.includes(datos.tipo as TipoDeOrganizacion)) {
    throw new ErrorDelCore(`Tipo de organización desconocido: ${String(datos.tipo)}`);
  }
  const ubicacion = await ubicacionNueva(db, producto);
  // El plan con que nace es el gratuito de su producto, que el despliegue copió del catálogo (HU-C2.3).
  const gratuito = await db
    .prepare(
      "SELECT id FROM plan WHERE producto = ? AND gratuito = 1 AND estado = 'activo' ORDER BY id LIMIT 1",
    )
    .bind(producto)
    .first<{ id: string }>();
  if (!gratuito) {
    throw new ErrorDelCore(`El producto «${producto}» no tiene un plan gratuito en el catálogo`);
  }
  const ahora = reloj();
  const org: Organizacion = {
    id: datos.id ?? uuidv7(() => ahora),
    nombre,
    tipo: datos.tipo,
    plan: gratuito.id,
    ...ubicacion,
  };
  await db.batch([
    db
      .prepare(
        'INSERT INTO organizacion (id, producto, nombre, tipo, plan, celda_id, shard, anillo, creado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        org.id,
        producto,
        org.nombre,
        org.tipo,
        org.plan,
        org.celda_id,
        org.shard,
        org.anillo,
        iso(ahora),
      ),
    db
      .prepare(
        'INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        datos.propietarioId,
        org.id,
        producto,
        datos.rolQueAdministra ?? 'propietario',
        iso(ahora),
      ),
  ]);
  return org;
}

export async function agregarMembresia(
  db: BaseD1,
  datos: { usuarioId: string; orgId: string; rol: Rol },
  reloj: Reloj = relojDelSistema,
): Promise<void> {
  if (!ROLES.includes(datos.rol)) throw new ErrorDelCore(`Rol desconocido: ${String(datos.rol)}`);
  const ya = await db
    .prepare('SELECT rol FROM membresia WHERE usuario_id = ? AND org_id = ?')
    .bind(datos.usuarioId, datos.orgId)
    .first<{ rol: Rol }>();
  if (ya) throw new ErrorDelCore(`Esa persona ya es ${ya.rol} de esta organización`);
  await db
    .prepare('INSERT INTO membresia (usuario_id, org_id, rol, creado) VALUES (?, ?, ?, ?)')
    .bind(datos.usuarioId, datos.orgId, datos.rol, iso(reloj()))
    .run();
}

export interface EntradaDelDirectorio {
  org_id: string;
  nombre: string;
  tipo: TipoDeOrganizacion;
  /** Plan de la organización: el teléfono lo usa para lo que depende del plan (fotos, HU-E3.11). */
  plan: 'gratuito' | 'finca' | 'exportador' | 'cadena';
  /** Hasta cuándo vale un plan pagado (HU-E0.7); null si no vence. */
  plan_vence: string | null;
  rol: Rol;
  celda_id: string;
  shard: string;
  anillo: 1 | 2;
  /** API de la celda del destino, copiada de celdas.json en cada despliegue (HU-E5.1). */
  url_api: string | null;
}

/**
 * Directorio de un usuario: sus organizaciones con la celda y el shard de cada una. Se consulta
 * solo al iniciar sesión; después, celda y shard viajan en el token (§5.4).
 *
 * Un plan pagado que ya venció se entrega como «gratuito» (HU-E0.7): vence al leerlo, sin tarea
 * programada, y la finca no pierde nada, porque el plan solo decide qué funciones se ven.
 */
/**
 * Las organizaciones de la persona. Con `producto`, solo las de ese producto (HU-C4.4): una sesión
 * del agro no ve ni recibe tokens de las organizaciones de otro producto.
 */
export async function directorioDeUsuario(
  db: BaseD1,
  usuarioId: string,
  ahora: number = Date.now(),
  producto?: string,
): Promise<EntradaDelDirectorio[]> {
  const hoy = new Date(ahora).toISOString();
  const vencido = 'o.plan_vence IS NOT NULL AND o.plan_vence <= ?';
  const { results } = await db
    .prepare(
      `SELECT o.id AS org_id, o.nombre, o.tipo,
              CASE WHEN ${vencido} THEN 'gratuito' ELSE o.plan END AS plan,
              CASE WHEN ${vencido} THEN NULL ELSE o.plan_vence END AS plan_vence,
              m.rol, o.celda_id, o.shard, o.anillo, c.url_api
         FROM membresia m
         JOIN organizacion o ON o.id = m.org_id
         JOIN celda c ON c.id = o.celda_id
        WHERE m.usuario_id = ?${producto ? ' AND o.producto = ?' : ''}
        ORDER BY o.creado, o.id`,
    )
    .bind(hoy, hoy, usuarioId, ...(producto ? [producto] : []))
    .all<EntradaDelDirectorio>();
  return results;
}
