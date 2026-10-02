/**
 * Cosecha por área (HU-E6.1).
 *
 * - Cantidad en la unidad del cultivo, categoría de calidad del catálogo de la finca (editable;
 *   una nueva entra al guardarla) y descarte (CA1).
 * - Dentro del periodo de carencia, o con carencia desconocida, **no se guarda** sin una
 *   confirmación explícita; la confirmación queda en el registro con lo que la app mostró (CA2).
 *   La carencia la calcula el almacén, no la pantalla: no depende de lo que el formulario mostró.
 * - Sin señal y en modo tablero: quién cosechó puede no tener cuenta (CA3).
 */
import {
  type CategoriaCalidad,
  ErrorDeValidacion,
  categoriaCalidad as esquemaCategoria,
  type Registro,
  uuidv7,
  validarCatalogo,
} from '@gestionagro/agro-schema';
import { conEscritura } from '../actividad.ts';
import { estadosPorArea } from './aplicaciones.ts';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';
import { operacion } from './versionado.ts';

/** Sugerencias para empezar; no se guardan hasta usarlas. */
export const SUGERENCIAS_CALIDAD = ['Primera', 'Segunda', 'Tercera'] as const;
export const UNIDADES_COSECHA = ['kg', 'tallos', 'cajas'] as const;

const normal = (s: string) => s.trim().toLocaleLowerCase('es');

export interface DatosCosechaGuardada {
  cantidad: number;
  unidad: string;
  categoria_id: string;
  categoria: string;
  descarte: number | null;
  /** v2 (HU-E7.4). Undefined en una cosecha v1: se lee como nulo. */
  horasPorPersona?: number | null;
  carenciaConfirmada: {
    tipo: 'hasta' | 'desconocida';
    hasta: string | null;
    insumos: string[];
  } | null;
}

export async function leerCategorias(db: CuadernoDb, fincaId: string): Promise<CategoriaCalidad[]> {
  const todas = await db.categoria_calidad.where('finca_id').equals(fincaId).toArray();
  return todas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** La categoría con ese nombre, o una nueva en el catálogo (sin duplicar por mayúsculas). */
export async function asegurarCategoria(
  db: CuadernoDb,
  fincaId: string,
  nombre: string,
  { ahora = () => new Date() }: { ahora?: () => Date } = {},
): Promise<CategoriaCalidad> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.categoria_calidad, db.outbox, async () => {
      const existentes = await db.categoria_calidad.where('finca_id').equals(fincaId).toArray();
      const igual = existentes.find((c) => normal(c.nombre) === normal(nombre));
      if (igual) return igual;
      const nueva = validarCatalogo('Categoría de calidad', esquemaCategoria, {
        id: uuidv7(),
        org_id: null,
        version: 1,
        actualizado: instante,
        finca_id: fincaId,
        nombre: nombre.trim(),
      });
      await db.categoria_calidad.add(nueva);
      await db.outbox.add(operacion('categoria_calidad', nueva.id, 1, 'crear', instante));
      return nueva;
    }),
  );
}

export type BloqueoPorCarencia = NonNullable<DatosCosechaGuardada['carenciaConfirmada']>;

/** ¿El área está en carencia en ese momento? Null si se puede cosechar. */
export async function bloqueoPorCarencia(
  db: CuadernoDb,
  fincaId: string,
  areaId: string,
  momento: Date,
): Promise<BloqueoPorCarencia | null> {
  const carencia = (await estadosPorArea(db, fincaId, momento)).get(areaId)?.carencia;
  if (!carencia || carencia.tipo === 'libre') return null;
  return carencia.tipo === 'hasta'
    ? { tipo: 'hasta', hasta: carencia.fecha, insumos: [carencia.insumo] }
    : { tipo: 'desconocida', hasta: null, insumos: [...carencia.insumos] };
}

/** Texto del bloqueo, el mismo en la pantalla y en el error (CA2). */
export function motivoDelBloqueo(b: BloqueoPorCarencia): string {
  return b.tipo === 'hasta'
    ? `En carencia hasta el ${b.hasta?.slice(8, 10)}/${b.hasta?.slice(5, 7)} por ${b.insumos.join(', ')}: no se debe cosechar`
    : `Carencia desconocida de ${b.insumos.join(', ')}: no se sabe cuándo se puede cosechar`;
}

export interface DatosCosecha {
  areaId: string;
  cantidad: number;
  unidad: string;
  categoria: string;
  descarte: number | null;
  personaIds: string[];
  /** Horas que cosechó cada persona (HU-E7.4); nulo u omitido = no se anotaron. */
  horasPorPersona?: number | null;
  /** Cosechar dentro del periodo de carencia, sabiéndolo (CA2). */
  confirmarCarencia?: boolean;
}

export async function guardarCosecha(
  db: CuadernoDb,
  fincaId: string,
  datos: DatosCosecha,
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro> {
  if (!datos.categoria.trim()) {
    throw new ErrorDeValidacion('Cosecha', [{ campo: 'categoria', motivo: 'elige la calidad' }]);
  }
  const horas = datos.horasPorPersona ?? null;
  if (horas !== null && datos.personaIds.length === 0) {
    throw new ErrorDeValidacion('Cosecha', [
      { campo: 'persona_ids', motivo: 'elige quién cosechó para anotar sus horas' },
    ]);
  }
  if (datos.descarte !== null && datos.descarte > datos.cantidad) {
    throw new ErrorDeValidacion('Cosecha', [
      { campo: 'descarte', motivo: 'no puede ser mayor que lo cosechado' },
    ]);
  }
  const area = corrige?.area_ids[0] ?? datos.areaId;
  // Una corrección se evalúa en el momento de la cosecha que corrige, no en el de hoy.
  const momento = corrige ? new Date(corrige.instante_evento) : ahora();
  const bloqueo = await bloqueoPorCarencia(db, fincaId, area, momento);
  if (bloqueo && !datos.confirmarCarencia) {
    throw new ErrorDeValidacion('Cosecha', [
      { campo: 'carencia', motivo: motivoDelBloqueo(bloqueo) },
    ]);
  }
  const categoria = await asegurarCategoria(db, fincaId, datos.categoria, { ahora });
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: area,
    tipo: 'cosecha',
    v: 2,
    personaIds: datos.personaIds,
    // Con personas elegidas, se anota a nombre de ellas aunque no tengan cuenta (modo tablero).
    origen: datos.personaIds.length > 0 ? 'tablero' : 'manual',
    ahora,
    corrige,
  });
  return guardarRegistro(
    db,
    {
      ...cabecera,
      datos: {
        cantidad: datos.cantidad,
        unidad: datos.unidad.trim(),
        categoria_id: categoria.id,
        categoria: categoria.nombre,
        descarte: datos.descarte,
        horasPorPersona: horas,
        carenciaConfirmada: bloqueo,
      } satisfies DatosCosechaGuardada,
    },
    { ahora },
  );
}
