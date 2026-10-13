/** Formatos de Colombia (ARQUITECTURA §5.3, regla 7): dd/mm/aaaa, coma decimal, hora local de la finca. */
// El mismo formato que el calendario de carencias compartido con el MCP del cuaderno (P2).
export { fechaHoraDeBogota as fechaHora } from '@ed1/agro-schema';

const FECHA = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/** dd/mm/aaaa de un instante, en el día de la finca. */
export const fechaCorta = (iso: string): string => FECHA.format(new Date(iso));

export const metros = (m2: number): string =>
  `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(m2)} m²`;

export const NOMBRE_TIPO: Record<string, string> = {
  nave: 'Nave',
  bloque: 'Bloque',
  lote: 'Lote',
  cama: 'Cama',
  surco: 'Surco',
};

export const NOMBRE_REGIMEN: Record<string, string> = {
  ecologico: 'Ecológico',
  convencional: 'Convencional',
};

/** «Nave 1» o, para una cama o un surco, «Nave 1 · Cama 2». Una sola regla para las listas (P2). */
export function nombreDeArea(
  areas: readonly { id: string; nombre: string; padre_id: string | null }[],
  id: string | undefined,
): string {
  const area = areas.find((a) => a.id === id);
  if (!area) return 'Área';
  const padre = area.padre_id ? areas.find((a) => a.id === area.padre_id) : undefined;
  return padre ? `${padre.nombre} · ${area.nombre}` : area.nombre;
}
