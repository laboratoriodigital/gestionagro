/**
 * Cambios de este teléfono que perdieron un conflicto en la nube (HU-E5.4, CA2): otra persona
 * editó lo mismo sin señal y llegó después. Se dicen con lo que se reemplazó y por quién, y se
 * ofrece volver a poner el propio, que es una edición más (versión nueva, sube como cualquier otra).
 */
import { FILAS_EXPORTADAS, type ZodType } from '@ed1/agro-schema';
import type { AvisoDeReemplazo, CuadernoDb } from './db.ts';
import { actualizarVersionado } from './versionado.ts';

const QUE_ES: Record<AvisoDeReemplazo['entidad'], string> = {
  finca: 'los datos de la finca',
  area: 'el área',
  ciclo: 'el ciclo',
  persona: 'la persona',
  insumo: 'el insumo',
  cultivo: 'el cultivo',
  valor_jornal: 'el valor del jornal',
  tipo_labor: 'el tipo de labor',
  categoria_calidad: 'la categoría de calidad',
};

export interface AvisoParaMostrar {
  aviso: AvisoDeReemplazo;
  texto: string;
}

/** Los avisos sin resolver, con su texto: «Tu cambio en el área «Nave 1» fue reemplazado por…». */
export async function avisosDeReemplazo(db: CuadernoDb): Promise<AvisoParaMostrar[]> {
  const pendientes = (await db.reemplazo.toArray()).filter((a) => a.resuelto === null);
  if (pendientes.length === 0) return [];
  const personas = await db.persona.toArray();
  return pendientes.map((aviso) => {
    const d = aviso.datos as { nombre?: string; nombre_comercial?: string; cultivo?: string };
    const nombre = d.nombre ?? d.nombre_comercial ?? d.cultivo;
    const quien =
      personas.find((p) => aviso.por_usuario && p.usuario_id === aviso.por_usuario)?.nombre ??
      'otra persona del equipo';
    return {
      aviso,
      texto: `Tu cambio en ${QUE_ES[aviso.entidad]}${nombre ? ` «${nombre}»` : ''} fue reemplazado por el de ${quien}, que editó lo mismo sin señal.`,
    };
  });
}

/** Vuelve a poner la versión de este teléfono como una edición nueva, que sube a la nube. */
export async function reaplicar(
  db: CuadernoDb,
  id: string,
  { ahora = () => new Date() }: { ahora?: () => Date } = {},
): Promise<void> {
  const aviso = await db.reemplazo.get(id);
  if (!aviso || aviso.resuelto) return;
  const tabla = db.table(aviso.entidad);
  const instante = ahora().toISOString();
  await db.transaction('rw', [tabla, db.historial, db.outbox, db.reemplazo], async () => {
    const {
      id: _id,
      version: _v,
      actualizado: _a,
      org_id: _o,
      ...campos
    } = aviso.datos as Record<string, unknown>;
    await actualizarVersionado(
      db,
      tabla,
      aviso.entidad,
      QUE_ES[aviso.entidad],
      FILAS_EXPORTADAS[aviso.entidad] as ZodType<{
        id: string;
        version: number;
        actualizado: string;
      }>,
      aviso.entidad_id,
      () => campos,
      instante,
    );
    await db.reemplazo.update(id, { resuelto: 'reaplicado' });
  });
}

/** Deja la versión de la nube: el aviso se cierra; la versión perdida sigue en el historial. */
export async function dejarComoEsta(db: CuadernoDb, id: string): Promise<void> {
  await db.reemplazo.update(id, { resuelto: 'aceptado' });
}
