/**
 * Roles y permisos (HU-E4.5, ARQUITECTURA §9): la matriz como datos, una sola para la celda y el
 * teléfono (P2). La celda decide con ella; el teléfono solo esconde lo que la celda negaría.
 *
 * - Lo que no está en la matriz está negado: un rol desconocido no lee ni escribe nada.
 * - Costos: hoy son el valor del jornal. Solo propietario y supervisor lo ven (HU-E3.5).
 * - Operario: registra el trabajo del día. Los tipos de labor y las categorías de calidad se crean
 *   al registrar (al escribir uno nuevo en el formulario), por eso también puede escribirlos.
 * - Supervisor: todo lo operativo. Propietario: todo. Asesor y auditor: solo consultan, sin costos.
 */
import type { Entidad } from './index.ts';

export const ROLES = ['propietario', 'supervisor', 'operario', 'asesor', 'auditor'] as const;
export type Rol = (typeof ROLES)[number];
export type Accion = 'leer' | 'escribir';

const TODOS: readonly Rol[] = ROLES;
const REGISTRAN: readonly Rol[] = ['propietario', 'supervisor', 'operario'];
const ADMINISTRAN: readonly Rol[] = ['propietario', 'supervisor'];

export const MATRIZ: Readonly<Record<Entidad, Readonly<Record<Accion, readonly Rol[]>>>> = {
  registro: { leer: TODOS, escribir: REGISTRAN },
  tipo_labor: { leer: TODOS, escribir: REGISTRAN },
  categoria_calidad: { leer: TODOS, escribir: REGISTRAN },
  area: { leer: TODOS, escribir: ADMINISTRAN },
  ciclo: { leer: TODOS, escribir: ADMINISTRAN },
  cultivo: { leer: TODOS, escribir: ADMINISTRAN },
  insumo: { leer: TODOS, escribir: ADMINISTRAN },
  persona: { leer: TODOS, escribir: ADMINISTRAN },
  finca: { leer: TODOS, escribir: ['propietario'] },
  valor_jornal: { leer: ADMINISTRAN, escribir: ADMINISTRAN },
};

/**
 * Tipos de registro con permisos propios (HU-E6.3). Los demás tipos siguen la fila `registro`.
 * Un despacho y un movimiento de bodega llevan precios: solo propietario y supervisor los ven y
 * los anotan.
 */
export const MATRIZ_DE_REGISTROS: Readonly<
  Record<string, Readonly<Record<Accion, readonly Rol[]>>>
> = {
  despacho: { leer: ADMINISTRAN, escribir: ADMINISTRAN },
  // Compras y ajustes de bodega, con precios (HU-E7.1).
  movimiento_insumo: { leer: ADMINISTRAN, escribir: ADMINISTRAN },
};

export const puede = (rol: string, accion: Accion, entidad: Entidad): boolean =>
  (MATRIZ[entidad]?.[accion] as readonly string[] | undefined)?.includes(rol) ?? false;

/** Si el rol puede leer o escribir registros de ese tipo. */
export const puedeRegistro = (rol: string, accion: Accion, tipo: string): boolean =>
  ((MATRIZ_DE_REGISTROS[tipo]?.[accion] ?? MATRIZ.registro[accion]) as readonly string[]).includes(
    rol,
  );

/** Tipos de registro con permisos propios que ese rol no puede hacer con esa acción. */
export const tiposNegados = (rol: string, accion: Accion): string[] =>
  Object.keys(MATRIZ_DE_REGISTROS).filter((t) => !puedeRegistro(rol, accion, t));

/** Las entidades que ese rol puede hacer con esa acción. */
export const entidadesQuePuede = (rol: string, accion: Accion): Entidad[] =>
  (Object.keys(MATRIZ) as Entidad[]).filter((e) => puede(rol, accion, e));

export const NOMBRE_DE_ROL: Readonly<Record<Rol, string>> = {
  propietario: 'propietario',
  supervisor: 'supervisor',
  operario: 'operario',
  asesor: 'asesor',
  auditor: 'auditor',
};

const NOMBRE_DE_ENTIDAD: Readonly<Record<Entidad, string>> = {
  registro: 'registros',
  tipo_labor: 'tipos de labor',
  categoria_calidad: 'categorías de calidad',
  area: 'áreas',
  ciclo: 'ciclos',
  cultivo: 'cultivos',
  insumo: 'insumos',
  persona: 'personas',
  finca: 'los datos de la finca',
  valor_jornal: 'el valor del jornal',
};

const NOMBRE_DE_TIPO: Readonly<Record<string, string>> = {
  despacho: 'las ventas',
  movimiento_insumo: 'la bodega',
};

/** El motivo, en palabras, de una escritura negada; `tipo` para un registro con permisos propios. */
export const motivoSinPermiso = (rol: string, entidad: Entidad, tipo?: string) =>
  `Con el rol de ${NOMBRE_DE_ROL[rol as Rol] ?? rol} no se pueden cambiar ${(tipo && NOMBRE_DE_TIPO[tipo]) || NOMBRE_DE_ENTIDAD[entidad]}. Pídeselo a quien administra la finca.`;
