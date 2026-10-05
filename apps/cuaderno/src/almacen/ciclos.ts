/**
 * Ciclos de cultivo y catálogo de cultivos (HU-E3.4).
 *
 * - Un área principal tiene a lo sumo un ciclo activo; los registros nuevos de esa área se
 *   asocian a él por defecto (CA1, `cicloActivoDe`).
 * - Cultivo y variedad salen del catálogo de la finca, editable desde la app (CA2).
 * - Cerrar un ciclo pide fecha de fin y confirmación explícita; después, `guardarRegistro`
 *   rechaza registros sobre él salvo confirmación (CA3).
 * - Las fechas son agronómicas (`AAAA-MM-DD`, día local de la finca) (CA4, P8).
 */
import {
  type Ciclo,
  type Cultivo,
  diasEntre,
  ErrorDeValidacion,
  ciclo as esquemaCiclo,
  cultivo as esquemaCultivo,
  fechaAgronomica,
  uuidv7,
  validarCatalogo,
} from '@ed1/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb } from './db.ts';
import { actualizarVersionado, operacion } from './versionado.ts';

interface Opciones {
  ahora?: () => Date;
}

const normal = (s: string) => s.trim().toLocaleLowerCase('es');

/** Agrega un cultivo al catálogo, o devuelve el que ya existe con ese nombre. */
export async function agregarCultivo(
  db: CuadernoDb,
  fincaId: string,
  nombre: string,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Cultivo> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.cultivo, db.outbox, async () => {
      const existentes = await db.cultivo.where('finca_id').equals(fincaId).toArray();
      const igual = existentes.find((c) => normal(c.nombre) === normal(nombre));
      if (igual) return igual;
      const nuevo = validarCatalogo('Cultivo', esquemaCultivo, {
        id: uuidv7(),
        org_id: null,
        version: 1,
        actualizado: instante,
        finca_id: fincaId,
        nombre: nombre.trim(),
        variedades: [],
      });
      await db.cultivo.add(nuevo);
      await db.outbox.add(operacion('cultivo', nuevo.id, 1, 'crear', instante));
      return nuevo;
    }),
  );
}

/** Agrega una variedad a un cultivo (sin código, CA2). Una variedad repetida no se duplica. */
export async function agregarVariedad(
  db: CuadernoDb,
  cultivoId: string,
  variedad: string,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Cultivo> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.cultivo, db.historial, db.outbox, async () => {
      const actual = await db.cultivo.get(cultivoId);
      if (actual?.variedades.some((v) => normal(v) === normal(variedad))) return actual;
      return actualizarVersionado<Cultivo>(
        db,
        db.cultivo,
        'cultivo',
        'Cultivo',
        esquemaCultivo,
        cultivoId,
        (c) => ({ variedades: [...c.variedades, variedad.trim()] }),
        instante,
      );
    }),
  );
}

export interface DatosCiclo {
  fincaId: string;
  areaId: string;
  cultivo: string;
  variedad: string;
  fechaTrasplante: string;
  plantas: number | null;
}

/** Inicia un ciclo en un área principal sin ciclo activo (CA1). */
export async function iniciarCiclo(
  db: CuadernoDb,
  datos: DatosCiclo,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Ciclo> {
  const momento = ahora();
  const instante = momento.toISOString();
  const hoy = fechaAgronomica(momento.getTime());
  return conEscritura(() =>
    db.transaction('rw', db.ciclo, db.area, db.cultivo, db.outbox, async () => {
      const area = await db.area.get(datos.areaId);
      if (!area || area.padre_id !== null) {
        throw new ErrorDeValidacion('Ciclo', [
          { campo: 'area_ids', motivo: 'el ciclo va en una nave, un bloque o un lote' },
        ]);
      }
      if (await cicloActivoDeEnTx(db, datos.areaId)) {
        throw new ErrorDeValidacion('Ciclo', [
          {
            campo: 'area_ids',
            motivo: `${area.nombre} ya tiene un ciclo activo; ciérralo primero`,
          },
        ]);
      }
      const catalogo = await db.cultivo.where('finca_id').equals(datos.fincaId).toArray();
      const cultivo = catalogo.find((c) => normal(c.nombre) === normal(datos.cultivo));
      if (!cultivo) {
        throw new ErrorDeValidacion('Ciclo', [
          { campo: 'cultivo', motivo: 'el cultivo no está en el catálogo' },
        ]);
      }
      if (!cultivo.variedades.some((v) => normal(v) === normal(datos.variedad))) {
        throw new ErrorDeValidacion('Ciclo', [
          { campo: 'variedad', motivo: `la variedad no está en el catálogo de ${cultivo.nombre}` },
        ]);
      }
      if (datos.fechaTrasplante > hoy) {
        throw new ErrorDeValidacion('Ciclo', [
          {
            campo: 'fecha_trasplante',
            motivo: 'la fecha de trasplante no puede ser después de hoy',
          },
        ]);
      }
      const nuevo = validarCatalogo('Ciclo', esquemaCiclo, {
        id: uuidv7(),
        org_id: area.org_id,
        version: 1,
        actualizado: instante,
        finca_id: datos.fincaId,
        area_ids: [datos.areaId],
        cultivo: cultivo.nombre,
        variedad:
          cultivo.variedades.find((v) => normal(v) === normal(datos.variedad)) ?? datos.variedad,
        fecha_trasplante: datos.fechaTrasplante,
        plantas: datos.plantas,
        estado: 'activo',
        fecha_fin: null,
      });
      await db.ciclo.add(nuevo);
      await db.outbox.add(operacion('ciclo', nuevo.id, 1, 'crear', instante));
      return nuevo;
    }),
  );
}

/**
 * Cierra un ciclo (CA3). Exige `confirmado: true`: después no se podrán agregar registros sin
 * una confirmación explícita.
 */
export async function cerrarCiclo(
  db: CuadernoDb,
  cicloId: string,
  fechaFin: string,
  confirmado: boolean,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Ciclo> {
  if (!confirmado) {
    throw new ErrorDeValidacion('Ciclo', [
      {
        campo: 'confirmado',
        motivo: 'confirma que el ciclo terminó: después no se podrán agregar registros',
      },
    ]);
  }
  const momento = ahora();
  const instante = momento.toISOString();
  const hoy = fechaAgronomica(momento.getTime());
  if (fechaFin > hoy) {
    throw new ErrorDeValidacion('Ciclo', [
      { campo: 'fecha_fin', motivo: 'la fecha de fin no puede ser después de hoy' },
    ]);
  }
  return conEscritura(() =>
    db.transaction('rw', db.ciclo, db.historial, db.outbox, async () => {
      const actual = await db.ciclo.get(cicloId);
      if (actual?.estado === 'cerrado') {
        throw new ErrorDeValidacion('Ciclo', [
          { campo: 'estado', motivo: 'el ciclo ya está cerrado' },
        ]);
      }
      return actualizarVersionado<Ciclo>(
        db,
        db.ciclo,
        'ciclo',
        'Ciclo',
        esquemaCiclo,
        cicloId,
        () => ({ estado: 'cerrado', fecha_fin: fechaFin }),
        instante,
      );
    }),
  );
}

async function cicloActivoDeEnTx(db: CuadernoDb, areaId: string): Promise<Ciclo | undefined> {
  return db.ciclo
    .where('area_ids')
    .equals(areaId)
    .filter((c) => c.estado === 'activo')
    .first();
}

/** El ciclo activo de un área: al que se asocian por defecto los registros nuevos (CA1). */
export function cicloActivoDe(db: CuadernoDb, areaId: string): Promise<Ciclo | undefined> {
  return cicloActivoDeEnTx(db, areaId);
}

/** Días desde el trasplante, contados en días agronómicos de la finca (CA4, P8). */
export function diasDesdeTrasplante(c: Ciclo, ahora: Date = new Date()): number {
  return diasEntre(c.fecha_trasplante, c.fecha_fin ?? fechaAgronomica(ahora.getTime()));
}

export async function leerCultivos(db: CuadernoDb, fincaId: string): Promise<Cultivo[]> {
  const cultivos = await db.cultivo.where('finca_id').equals(fincaId).toArray();
  return cultivos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function leerCiclos(db: CuadernoDb, fincaId: string): Promise<Ciclo[]> {
  return db.ciclo.where('finca_id').equals(fincaId).toArray();
}
