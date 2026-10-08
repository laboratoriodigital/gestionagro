/**
 * Roles y permisos (HU-E4.5, ARQUITECTURA §9): la matriz como datos, una sola para la celda y el
 * teléfono (P2). La celda decide con ella; el teléfono solo esconde lo que la celda negaría.
 *
 * - Lo que no está en la matriz está negado: un rol desconocido no lee ni escribe nada.
 * - Cada producto trae sus roles, su matriz y sus palabras (`crearPermisos`); el agro, en
 *   `@ed1/agro-schema/sync`.
 */

export type Accion = 'leer' | 'escribir';

export type MatrizDe<Clave extends string, Rol extends string> = Readonly<
  Record<Clave, Readonly<Record<Accion, readonly Rol[]>>>
>;

export interface DefinicionDePermisos<Rol extends string, E extends string> {
  /** Qué rol puede leer y escribir cada entidad (los registros son la entidad `registro`). */
  readonly matriz: MatrizDe<'registro' | E, Rol>;
  /** Tipos de registro con permisos propios; los demás tipos siguen la fila `registro`. */
  readonly matrizDeRegistros: Readonly<Record<string, Readonly<Record<Accion, readonly Rol[]>>>>;
  readonly nombreDeRol: Readonly<Record<Rol, string>>;
  /** Cómo se nombra cada entidad en el motivo («los datos de la finca», «las tarifas»). */
  readonly nombreDeEntidad: Readonly<Record<'registro' | E, string>>;
  /** Cómo se nombra cada tipo de registro con permisos propios («las ventas»). */
  readonly nombreDeTipo: Readonly<Record<string, string>>;
  /** El final del motivo: a quién pedírselo («Pídeselo a quien administra la finca.»). */
  readonly aQuienPedir: string;
}

export function crearPermisos<Rol extends string, E extends string>(
  d: DefinicionDePermisos<Rol, E>,
) {
  type Entidad = 'registro' | E;
  const puede = (rol: string, accion: Accion, entidad: Entidad): boolean =>
    (d.matriz[entidad]?.[accion] as readonly string[] | undefined)?.includes(rol) ?? false;

  /** Si el rol puede leer o escribir registros de ese tipo. */
  const puedeRegistro = (rol: string, accion: Accion, tipo: string): boolean =>
    (
      (d.matrizDeRegistros[tipo]?.[accion] ?? d.matriz.registro[accion]) as readonly string[]
    ).includes(rol);

  /** Tipos de registro con permisos propios que ese rol no puede hacer con esa acción. */
  const tiposNegados = (rol: string, accion: Accion): string[] =>
    Object.keys(d.matrizDeRegistros).filter((t) => !puedeRegistro(rol, accion, t));

  /** Las entidades que ese rol puede hacer con esa acción. */
  const entidadesQuePuede = (rol: string, accion: Accion): Entidad[] =>
    (Object.keys(d.matriz) as Entidad[]).filter((e) => puede(rol, accion, e));

  /** El motivo, en palabras, de una escritura negada; `tipo` para un registro con permisos propios. */
  const motivoSinPermiso = (rol: string, entidad: Entidad, tipo?: string) =>
    `Con el rol de ${d.nombreDeRol[rol as Rol] ?? rol} no se pueden cambiar ${(tipo && d.nombreDeTipo[tipo]) || d.nombreDeEntidad[entidad]}. ${d.aQuienPedir}`;

  return { puede, puedeRegistro, tiposNegados, entidadesQuePuede, motivoSinPermiso };
}
