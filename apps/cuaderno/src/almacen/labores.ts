/**
 * Labores (HU-E3.9): qué labor, en qué área, con quién y cuántas horas.
 *
 * - Tipos de labor del catálogo de la finca, editable: una labor nueva entra al catálogo al
 *   guardarla (CA1). El catálogo arranca vacío; las sugerencias solo se ofrecen.
 * - Una o varias personas, tengan o no cuenta: modo tablero (CA2, ARQUITECTURA §5.3 regla 5).
 * - Horas por persona en medias horas. Si alguien suma más de 12 h en el día, se avisa y se pide
 *   confirmar; no se bloquea (CA3).
 * - Las 3 labores usadas más recientemente van primero (CA4).
 */
import {
  ErrorDeValidacion,
  tipoLabor as esquemaTipoLabor,
  fechaAgronomica,
  type Registro,
  type TipoLabor,
  uuidv7,
  validarCatalogo,
} from '@ed1/agro-schema';
import { conEscritura } from '../actividad.ts';
import { cabeceraDeRegistro, type OpcionesDeRegistro } from './cabecera.ts';
import { soloVigentes, ultimosRegistros } from './consultas.ts';
import type { CuadernoDb } from './db.ts';
import { guardarRegistro } from './guardar.ts';
import { operacion } from './versionado.ts';

/** Sugerencias para empezar (del backlog); no se guardan hasta usarlas. */
export const SUGERENCIAS_LABOR = [
  'Tutorado',
  'Deshoje',
  'Poda',
  'Polinización',
  'Limpieza',
] as const;

export const MAXIMO_HORAS_DIA = 12;

const normal = (s: string) => s.trim().toLocaleLowerCase('es');

interface Opciones {
  ahora?: () => Date;
}

export async function leerTiposLabor(db: CuadernoDb, fincaId: string): Promise<TipoLabor[]> {
  const tipos = await db.tipo_labor.where('finca_id').equals(fincaId).toArray();
  return tipos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Devuelve el tipo de labor con ese nombre, o lo agrega al catálogo (sin duplicar mayúsculas). */
export async function asegurarTipoLabor(
  db: CuadernoDb,
  fincaId: string,
  nombre: string,
  { ahora = () => new Date() }: Opciones = {},
): Promise<TipoLabor> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.tipo_labor, db.outbox, async () => {
      const existentes = await db.tipo_labor.where('finca_id').equals(fincaId).toArray();
      const igual = existentes.find((t) => normal(t.nombre) === normal(nombre));
      if (igual) return igual;
      const nuevo = validarCatalogo('Labor', esquemaTipoLabor, {
        id: uuidv7(),
        org_id: null,
        version: 1,
        actualizado: instante,
        finca_id: fincaId,
        nombre: nombre.trim(),
      });
      await db.tipo_labor.add(nuevo);
      await db.outbox.add(operacion('tipo_labor', nuevo.id, 1, 'crear', instante));
      return nuevo;
    }),
  );
}

/** Horas de labor que ya tiene una persona en una fecha agronómica. */
export async function horasDelDia(
  db: CuadernoDb,
  fincaId: string,
  personaId: string,
  fecha: string,
  /** Registro que se está corrigiendo: sus horas se reemplazan, no se suman (HU-E3.12). */
  sinContar?: string,
): Promise<number> {
  const delDia = await db.registro
    .where('fecha_agronomica')
    .equals(fecha)
    .filter(
      (r) =>
        r.tipo === 'labor' &&
        r.finca_id === fincaId &&
        r.id !== sinContar &&
        r.persona_ids.includes(personaId),
    )
    .toArray();
  const labores = await soloVigentes(db, delDia);
  return labores.reduce(
    (suma, r) => suma + (r.datos as { horasPorPersona: number }).horasPorPersona,
    0,
  );
}

export interface AvisoDeHoras {
  personaId: string;
  nombre: string;
  total: number;
}

/** Personas que con esta labor pasarían de 12 h en el día (CA3). */
export async function avisosDeHoras(
  db: CuadernoDb,
  fincaId: string,
  personaIds: readonly string[],
  horas: number,
  fecha: string,
  sinContar?: string,
): Promise<AvisoDeHoras[]> {
  const avisos: AvisoDeHoras[] = [];
  for (const personaId of personaIds) {
    const total = (await horasDelDia(db, fincaId, personaId, fecha, sinContar)) + horas;
    if (total > MAXIMO_HORAS_DIA) {
      const persona = await db.persona.get(personaId);
      avisos.push({ personaId, nombre: persona?.nombre ?? 'Una persona', total });
    }
  }
  return avisos;
}

export interface DatosLabor {
  areaId: string;
  labor: string;
  personaIds: string[];
  horasPorPersona: number;
  /** Confirmación explícita cuando alguien pasa de 12 h en el día (CA3). */
  confirmarMasDe12?: boolean;
}

export async function guardarLabor(
  db: CuadernoDb,
  fincaId: string,
  datos: DatosLabor,
  { ahora = () => new Date(), corrige }: OpcionesDeRegistro = {},
): Promise<Registro> {
  if (datos.personaIds.length === 0) {
    throw new ErrorDeValidacion('Labor', [
      { campo: 'persona_ids', motivo: 'elige al menos una persona' },
    ]);
  }
  if (!datos.labor.trim()) {
    throw new ErrorDeValidacion('Labor', [{ campo: 'labor', motivo: 'elige o escribe la labor' }]);
  }
  // Una corrección cuenta en el día del evento que corrige.
  const fecha = corrige?.fecha_agronomica ?? fechaAgronomica(ahora().getTime());
  if (!datos.confirmarMasDe12) {
    const avisos = await avisosDeHoras(
      db,
      fincaId,
      datos.personaIds,
      datos.horasPorPersona,
      fecha,
      corrige?.id,
    );
    if (avisos.length > 0) {
      throw new ErrorDeValidacion(
        'Labor',
        avisos.map((a) => ({
          campo: 'horasPorPersona',
          motivo: `${a.nombre} sumaría ${String(a.total).replace('.', ',')} horas hoy; confirma si es correcto`,
        })),
      );
    }
  }
  const tipo = await asegurarTipoLabor(db, fincaId, datos.labor, { ahora });
  const cabecera = await cabeceraDeRegistro(db, {
    fincaId,
    areaId: datos.areaId,
    tipo: 'labor',
    v: 1,
    personaIds: datos.personaIds,
    // Un teléfono que registra a nombre de personas sin cuenta (ARQUITECTURA §5.3, regla 5).
    origen: 'tablero',
    ahora,
    corrige,
  });
  return guardarRegistro(
    db,
    {
      ...cabecera,
      datos: { labor_id: tipo.id, labor: tipo.nombre, horasPorPersona: datos.horasPorPersona },
    },
    { ahora },
  );
}

/** Nombres de las últimas labores usadas, sin repetir, de la más reciente a la más vieja (CA4). */
export async function laboresRecientes(
  db: CuadernoDb,
  fincaId: string,
  cuantas = 3,
): Promise<string[]> {
  const recientes: string[] = [];
  for (const r of await ultimosRegistros(db, fincaId, ['labor'], 50)) {
    const nombre = (r.datos as { labor: string }).labor;
    if (!recientes.some((x) => normal(x) === normal(nombre))) recientes.push(nombre);
    if (recientes.length === cuantas) break;
  }
  return recientes;
}
