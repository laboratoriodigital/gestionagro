/**
 * Insumos con los datos de su etiqueta (HU-E3.6).
 *
 * - Registro ICA, ingrediente activo, carencia y reentrada se copian de la etiqueta del producto
 *   registrado ante el ICA. La app no recomienda productos ni dosis (CA2, instrucciones §7).
 * - En una finca ecológica, un insumo no marcado como permitido genera un aviso; no se bloquea:
 *   la decisión es del productor (CA3).
 * - Carencia o reentrada vacía es «desconocida», que NO es cero (CA4, P1).
 */
import {
  insumo as esquemaInsumo,
  type Finca,
  type Insumo,
  uuidv7,
  validarCatalogo,
} from '@ed1/agro-schema';
import { conEscritura } from '../actividad.ts';
import type { CuadernoDb } from './db.ts';
import { actualizarVersionado, operacion } from './versionado.ts';

interface Opciones {
  ahora?: () => Date;
}

export type DatosInsumo = Pick<
  Insumo,
  | 'nombre_comercial'
  | 'tipo'
  | 'registro_ica'
  | 'ingrediente_activo'
  | 'unidad'
  | 'carencia_dias'
  | 'reentrada_horas'
  | 'permitido_ecologico'
>;

export const TEXTO_ETIQUETA =
  'Copia estos datos de la etiqueta del producto registrado ante el ICA. Esta app no recomienda productos ni dosis.';

export async function crearInsumo(
  db: CuadernoDb,
  fincaId: string,
  datos: DatosInsumo,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Insumo> {
  const instante = ahora().toISOString();
  const nuevo = validarCatalogo('Insumo', esquemaInsumo, {
    id: uuidv7(),
    org_id: null,
    version: 1,
    actualizado: instante,
    finca_id: fincaId,
    ...datos,
  });
  await conEscritura(() =>
    db.transaction('rw', db.insumo, db.outbox, async () => {
      await db.insumo.add(nuevo);
      await db.outbox.add(operacion('insumo', nuevo.id, 1, 'crear', instante));
    }),
  );
  return nuevo;
}

export async function editarInsumo(
  db: CuadernoDb,
  id: string,
  cambios: Partial<DatosInsumo>,
  { ahora = () => new Date() }: Opciones = {},
): Promise<Insumo> {
  const instante = ahora().toISOString();
  return conEscritura(() =>
    db.transaction('rw', db.insumo, db.historial, db.outbox, () =>
      actualizarVersionado<Insumo>(
        db,
        db.insumo,
        'insumo',
        'Insumo',
        esquemaInsumo,
        id,
        () => cambios,
        instante,
      ),
    ),
  );
}

export async function leerInsumos(db: CuadernoDb, fincaId: string): Promise<Insumo[]> {
  const insumos = await db.insumo.where('finca_id').equals(fincaId).toArray();
  return insumos.sort((a, b) => a.nombre_comercial.localeCompare(b.nombre_comercial, 'es'));
}

/** Cómo mostrar un plazo de la etiqueta. Vacío es «desconocida» y se marca en rojo (CA4, P1). */
export function plazo(
  valor: number | null,
  unidad: 'días' | 'horas',
): { conocido: boolean; texto: string } {
  if (valor === null) return { conocido: false, texto: 'desconocida' };
  const singular = unidad === 'días' ? 'día' : 'hora';
  return { conocido: true, texto: `${valor} ${valor === 1 ? singular : unidad}` };
}

/** Aviso, sin bloqueo, para un insumo no marcado como permitido en una finca ecológica (CA3). */
export function avisoEcologico(
  finca: Pick<Finca, 'regimen'>,
  insumo: Pick<Insumo, 'permitido_ecologico'>,
): string | null {
  if (finca.regimen !== 'ecologico' || insumo.permitido_ecologico === true) return null;
  return insumo.permitido_ecologico === false
    ? 'Marcado como NO permitido en producción ecológica. La app no lo bloquea: la decisión es tuya.'
    : 'No está marcado como permitido en producción ecológica. Revisa la etiqueta o tu certificadora. La app no lo bloquea: la decisión es tuya.';
}
