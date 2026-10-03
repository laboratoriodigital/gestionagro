/**
 * Finca y áreas en el teléfono (HU-E3.3, ARQUITECTURA §5.7).
 *
 * - Crear la finca con sus áreas es UNA transacción: o queda todo o no queda nada.
 * - Editar un área no la pisa: guarda la versión anterior en `historial`, sube la versión y
 *   encola la operación (ADR-4: última escritura gana, con historial).
 * - Áreas principales (nave, bloque, lote) no tienen padre; subáreas (cama, surco) sí.
 */
import {
  type Area,
  ErrorDeValidacion,
  area as esquemaArea,
  finca as esquemaFinca,
  type Finca,
  uuidv7,
  validarCatalogo,
} from '@gestionagro/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb, VersionAnterior } from './db.ts';
import { actualizarVersionado, operacion } from './versionado.ts';

export const TIPOS_PRINCIPALES = ['nave', 'bloque', 'lote'] as const;
export const TIPOS_SUBAREA = ['cama', 'surco'] as const;

export interface DatosFinca {
  nombre: string;
  municipio: string;
  regimen: Finca['regimen'];
}

export interface DatosArea {
  tipo: Area['tipo'];
  nombre: string;
  area_m2: number;
  capacidad_plantas: number | null;
}

export type CambiosArea = Partial<
  Pick<Area, 'nombre' | 'area_m2' | 'capacidad_plantas' | 'activa'>
>;

interface Opciones {
  ahora?: () => Date;
}

export async function crearFincaConAreas(
  db: CuadernoDb,
  datosFinca: DatosFinca,
  datosAreas: readonly DatosArea[],
  { ahora = () => new Date() }: Opciones = {},
): Promise<{ finca: Finca; areas: Area[] }> {
  const instante = ahora().toISOString();
  const meta = { org_id: null, version: 1, actualizado: instante };
  const finca = validarCatalogo('Finca', esquemaFinca, { id: uuidv7(), ...meta, ...datosFinca });
  if (datosAreas.length === 0) {
    throw new ErrorDeValidacion('Finca', [{ campo: 'areas', motivo: 'agrega al menos un área' }]);
  }
  const areas = datosAreas.map((a, i) => {
    if (!(TIPOS_PRINCIPALES as readonly string[]).includes(a.tipo)) {
      throw new ErrorDeValidacion('Área', [
        {
          campo: `areas.${i}.tipo`,
          motivo: 'una cama o un surco va dentro de una nave, un bloque o un lote',
        },
      ]);
    }
    return validarCatalogo('Área', esquemaArea, {
      id: uuidv7(),
      ...meta,
      finca_id: finca.id,
      padre_id: null,
      activa: true,
      ...a,
    });
  });

  await conEscritura(() =>
    db.transaction('rw', db.finca, db.area, db.outbox, async () => {
      await db.finca.add(finca);
      await db.outbox.add(operacion('finca', finca.id, 1, 'crear', instante));
      await db.area.bulkAdd(areas);
      await db.outbox.bulkAdd(areas.map((a) => operacion('area', a.id, 1, 'crear', instante)));
    }),
  );
  return { finca, areas };
}

/** Agrega una nave, un bloque o un lote a una finca ya configurada. */
export async function agregarArea(
  db: CuadernoDb,
  fincaId: string,
  datos: DatosArea,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Area> {
  if (!(TIPOS_PRINCIPALES as readonly string[]).includes(datos.tipo)) {
    throw new ErrorDeValidacion('Área', [
      { campo: 'tipo', motivo: 'una cama o un surco va dentro de una nave, un bloque o un lote' },
    ]);
  }
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.finca, db.area, db.outbox, async () => {
      const finca = await db.finca.get(fincaId);
      if (!finca)
        throw new ErrorDeValidacion('Área', [{ campo: 'finca_id', motivo: 'la finca no existe' }]);
      const area = validarCatalogo('Área', esquemaArea, {
        id: uuidv7(),
        org_id: finca.org_id,
        version: 1,
        actualizado: instante,
        finca_id: fincaId,
        padre_id: null,
        activa: true,
        ...datos,
      });
      await db.area.add(area);
      await db.outbox.add(operacion('area', area.id, 1, 'crear', instante));
      return area;
    }),
  );
}

export async function crearSubarea(
  db: CuadernoDb,
  padreId: string,
  datos: DatosArea,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Area> {
  if (!(TIPOS_SUBAREA as readonly string[]).includes(datos.tipo)) {
    throw new ErrorDeValidacion('Área', [
      { campo: 'tipo', motivo: 'una subárea es una cama o un surco' },
    ]);
  }
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.area, db.outbox, async () => {
      const padre = await db.area.get(padreId);
      if (!padre || padre.padre_id !== null) {
        throw new ErrorDeValidacion('Área', [
          { campo: 'padre_id', motivo: 'el área principal no existe' },
        ]);
      }
      const sub = validarCatalogo('Área', esquemaArea, {
        id: uuidv7(),
        org_id: padre.org_id,
        version: 1,
        actualizado: instante,
        finca_id: padre.finca_id,
        padre_id: padre.id,
        activa: true,
        ...datos,
      });
      await db.area.add(sub);
      await db.outbox.add(operacion('area', sub.id, 1, 'crear', instante));
      return sub;
    }),
  );
}

export async function editarArea(
  db: CuadernoDb,
  id: string,
  cambios: CambiosArea,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Area> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.area, db.historial, db.outbox, () =>
      actualizarVersionado<Area>(
        db,
        db.area,
        'area',
        'Área',
        esquemaArea,
        id,
        () => cambios,
        instante,
      ),
    ),
  );
}

/** La finca de este teléfono con sus áreas, o null si todavía no se configuró. */
export async function leerFinca(db: CuadernoDb): Promise<{ finca: Finca; areas: Area[] } | null> {
  const finca = await db.finca.toCollection().first();
  if (!finca) return null;
  const areas = await db.area.where('finca_id').equals(finca.id).toArray();
  return {
    finca,
    areas: areas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true })),
  };
}

/** Versiones anteriores de un área, de la más reciente a la más vieja. */
export async function historialDe(db: CuadernoDb, entidadId: string): Promise<VersionAnterior[]> {
  const versiones = await db.historial.where('entidad_id').equals(entidadId).toArray();
  return versiones.sort((a, b) => b.version - a.version);
}

/**
 * Si un área se puede eliminar (revisión del dueño, 3 oct 2026): solo si no tiene nada asociado,
 * ni registros, ni ciclos, ni camas o surcos activos. Si no, el motivo en palabras.
 */
export async function motivoParaNoEliminar(db: CuadernoDb, areaId: string): Promise<string | null> {
  const registros = await db.registro.filter((r) => r.area_ids.includes(areaId)).count();
  if (registros > 0) {
    return `tiene ${registros === 1 ? '1 registro' : `${registros} registros`}: su historia no se borra`;
  }
  const ciclos = await db.ciclo.filter((c) => c.area_ids.includes(areaId)).count();
  if (ciclos > 0) return 'tiene un ciclo de cultivo';
  const hijas = await db.area.filter((a) => a.padre_id === areaId && a.activa).count();
  if (hijas > 0) {
    return `tiene ${hijas === 1 ? '1 cama o surco' : `${hijas} camas o surcos`}: elimínalos primero`;
  }
  return null;
}

/**
 * Elimina un área sin nada asociado. Es una baja (`activa: false`), no un borrado: el cambio viaja
 * a los demás teléfonos como cualquier otro y su historial queda (P21).
 */
export async function eliminarArea(
  db: CuadernoDb,
  areaId: string,
  opciones: Opciones = {},
): Promise<Area> {
  const motivo = await motivoParaNoEliminar(db, areaId);
  if (motivo) throw new ErrorDeValidacion('Área', [{ campo: 'area', motivo }]);
  return editarArea(db, areaId, { activa: false }, opciones);
}
