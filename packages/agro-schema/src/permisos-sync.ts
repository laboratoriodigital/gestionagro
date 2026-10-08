/**
 * Roles y permisos del agro (HU-E4.5, ARQUITECTURA §9) sobre la matriz común de `@ed1/sync`.
 *
 * - Costos: hoy son el valor del jornal. Solo propietario y supervisor lo ven (HU-E3.5).
 * - Operario: registra el trabajo del día. Los tipos de labor y las categorías de calidad se crean
 *   al registrar (al escribir uno nuevo en el formulario), por eso también puede escribirlos.
 * - Supervisor: todo lo operativo. Propietario: todo. Asesor y auditor: solo consultan, sin costos.
 */
import { type Accion, crearPermisos, type MatrizDe } from '@ed1/sync';
import type { Entidad, EntidadDeCatalogo } from './sync.ts';

export const ROLES = ['propietario', 'supervisor', 'operario', 'asesor', 'auditor'] as const;
export type Rol = (typeof ROLES)[number];

const TODOS: readonly Rol[] = ROLES;
const REGISTRAN: readonly Rol[] = ['propietario', 'supervisor', 'operario'];
const ADMINISTRAN: readonly Rol[] = ['propietario', 'supervisor'];

export const MATRIZ: MatrizDe<Entidad, Rol> = {
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

export const NOMBRE_DE_ROL: Readonly<Record<Rol, string>> = {
  propietario: 'propietario',
  supervisor: 'supervisor',
  operario: 'operario',
  asesor: 'asesor',
  auditor: 'auditor',
};

export const { puede, puedeRegistro, tiposNegados, entidadesQuePuede, motivoSinPermiso } =
  crearPermisos<Rol, EntidadDeCatalogo>({
    matriz: MATRIZ,
    matrizDeRegistros: MATRIZ_DE_REGISTROS,
    nombreDeRol: NOMBRE_DE_ROL,
    nombreDeEntidad: {
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
    },
    nombreDeTipo: {
      despacho: 'las ventas',
      movimiento_insumo: 'la bodega',
    },
    aQuienPedir: 'Pídeselo a quien administra la finca.',
  });
