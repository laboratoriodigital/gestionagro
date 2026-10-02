/**
 * Personas de la finca (HU-E3.5).
 *
 * - Nombre y rol. Nada de cédula ni teléfono: minimización de datos, Ley 1581 (CA2). El esquema
 *   es estricto, así que un campo de más no se guarda.
 * - El valor del jornal va aparte, en `valor_jornal`, con la fecha desde la que rige (CA1).
 * - Una persona inactiva sale de los formularios pero conserva su historial (CA3): nunca se borra.
 */
import {
  ErrorDeValidacion,
  persona as esquemaPersona,
  valorJornal as esquemaValorJornal,
  type Persona,
  uuidv7,
  type ValorJornal,
  validarCatalogo,
} from '@gestionagro/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb } from './db.ts';
import { actualizarVersionado, operacion } from './versionado.ts';

interface Opciones {
  ahora?: () => Date;
}

export interface DatosPersona {
  nombre: string;
  rol: Persona['rol'];
}

export async function crearPersona(
  db: CuadernoDb,
  fincaId: string,
  datos: DatosPersona,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Persona> {
  const instante = ahora().toISOString();
  const nueva = validarCatalogo('Persona', esquemaPersona, {
    id: uuidv7(),
    org_id: null,
    version: 1,
    actualizado: instante,
    finca_id: fincaId,
    usuario_id: null,
    activa: true,
    ...datos,
  });
  await conEscritura(() =>
    db.transaction('rw', db.persona, db.outbox, async () => {
      await db.persona.add(nueva);
      await db.outbox.add(operacion('persona', nueva.id, 1, 'crear', instante));
    }),
  );
  return nueva;
}

export async function editarPersona(
  db: CuadernoDb,
  id: string,
  cambios: Partial<Pick<Persona, 'nombre' | 'rol' | 'activa'>>,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Persona> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.persona, db.historial, db.outbox, () =>
      actualizarVersionado<Persona>(
        db,
        db.persona,
        'persona',
        'Persona',
        esquemaPersona,
        id,
        () => cambios,
        instante,
      ),
    ),
  );
}

/** Personas de la finca. Por defecto solo las activas: las que aparecen en los formularios (CA3). */
export async function leerPersonas(
  db: CuadernoDb,
  fincaId: string,
  { incluirInactivas = false } = {},
): Promise<Persona[]> {
  const todas = await db.persona.where('finca_id').equals(fincaId).toArray();
  return todas
    .filter((p) => incluirInactivas || p.activa)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Registra un valor de jornal que rige desde `vigenteDesde`. Los anteriores se conservan. */
export async function definirJornal(
  db: CuadernoDb,
  personaId: string,
  valorCop: number,
  vigenteDesde: string,
  { ahora = () => new Date() }: Opciones = {},
): Promise<ValorJornal> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.persona, db.valor_jornal, db.outbox, async () => {
      const persona = await db.persona.get(personaId);
      if (!persona)
        throw new ErrorDeValidacion('Jornal', [
          { campo: 'persona_id', motivo: 'la persona no existe' },
        ]);
      const valor = validarCatalogo('Jornal', esquemaValorJornal, {
        id: uuidv7(),
        org_id: persona.org_id,
        version: 1,
        actualizado: instante,
        finca_id: persona.finca_id,
        persona_id: personaId,
        valor_cop: valorCop,
        vigente_desde: vigenteDesde,
      });
      await db.valor_jornal.add(valor);
      await db.outbox.add(operacion('valor_jornal', valor.id, 1, 'crear', instante));
      return valor;
    }),
  );
}

/** El valor que rige en una fecha agronómica: el de vigencia más reciente sin pasarse. */
export async function jornalVigente(
  db: CuadernoDb,
  personaId: string,
  fecha: string,
): Promise<ValorJornal | undefined> {
  const valores = await db.valor_jornal.where('persona_id').equals(personaId).toArray();
  return valores
    .filter((v) => v.vigente_desde <= fecha)
    .sort(
      (a, b) =>
        b.vigente_desde.localeCompare(a.vigente_desde) ||
        b.actualizado.localeCompare(a.actualizado),
    )[0];
}

/**
 * El valor general del jornal de la finca, para quien no tiene uno propio (HU-E7.2, CA1): un
 * `valor_jornal` sin persona, con la fecha desde la que rige.
 */
export async function definirJornalGeneral(
  db: CuadernoDb,
  fincaId: string,
  valorCop: number,
  vigenteDesde: string,
  { ahora = () => new Date() }: Opciones = {},
): Promise<ValorJornal> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.finca, db.valor_jornal, db.outbox, async () => {
      const finca = await db.finca.get(fincaId);
      if (!finca)
        throw new ErrorDeValidacion('Jornal', [
          { campo: 'finca_id', motivo: 'la finca no existe' },
        ]);
      const valor = validarCatalogo('Jornal', esquemaValorJornal, {
        id: uuidv7(),
        org_id: finca.org_id,
        version: 1,
        actualizado: instante,
        finca_id: fincaId,
        persona_id: null,
        valor_cop: valorCop,
        vigente_desde: vigenteDesde,
      });
      await db.valor_jornal.add(valor);
      await db.outbox.add(operacion('valor_jornal', valor.id, 1, 'crear', instante));
      return valor;
    }),
  );
}
