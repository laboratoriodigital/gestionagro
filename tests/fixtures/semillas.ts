/**
 * Filas de catálogo y registros de las dos fincas de prueba, listas para sembrar el almacén
 * local o una celda. Deterministas: mismos ids en cada corrida.
 */
import {
  type Area,
  type Finca,
  fechaAgronomica,
  type Persona,
  type Registro,
  uuidv7,
} from '@ed1/agro-schema';
import { FINCAS_DE_PRUEBA, type FincaDePrueba } from './fincas.ts';

const ACTUALIZADO = '2026-10-15T12:00:00.000Z';

/** Azar determinista para ids reproducibles. */
function azarContado(semilla: number) {
  let n = semilla;
  return (bytes: number) =>
    Uint8Array.from({ length: bytes }, () => (n = (n * 1103515245 + 12345) % 256));
}

export interface Semilla {
  finca: Finca;
  areas: Area[];
  personas: Persona[];
  registros: Registro[];
}

export function semillaDe(f: FincaDePrueba, indice: number): Semilla {
  const meta = { org_id: null, version: 1, actualizado: ACTUALIZADO };
  const finca: Finca = { ...meta, ...f.finca };
  const areas: Area[] = f.areas.map((a) => ({
    ...meta,
    id: a.id,
    finca_id: f.finca.id,
    padre_id: null,
    tipo: a.tipo,
    nombre: a.nombre,
    area_m2: a.area_m2,
    capacidad_plantas: a.plantas,
    activa: true,
  }));
  const personas: Persona[] = f.personas.map((p) => ({
    ...meta,
    id: p.id,
    finca_id: f.finca.id,
    nombre: p.nombre,
    rol: p.rol,
    usuario_id: null,
    activa: true,
  }));
  const azar = azarContado(indice + 1);
  const registros: Registro[] = f.areas.map((a, i) => {
    const ms = Date.parse('2026-10-15T14:00:00Z') + i * 60_000;
    return {
      id: uuidv7(() => ms, azar),
      org_id: null,
      finca_id: f.finca.id,
      area_ids: [a.id],
      ciclo_id: null,
      tipo: 'clima',
      v: 1,
      fecha_agronomica: fechaAgronomica(ms),
      instante_evento: new Date(ms).toISOString(),
      autor_usuario_id: null,
      persona_ids: [f.personas[0]?.id ?? f.finca.id],
      dispositivo_id: `telefono-ensayo-${indice + 1}`,
      origen: 'tablero',
      anula_id: null,
      datos: { temperaturaC: 24, humedadRelativaPct: 70, temperaturaHojaC: null, dpvKPa: 0.895 },
    };
  });
  return { finca, areas, personas, registros };
}

export const SEMILLAS: readonly Semilla[] = FINCAS_DE_PRUEBA.map(semillaDe);
