/**
 * Fechas de Bogotá con UTC−5 fijo y sin `Intl` (PARQUEADERO §5.6, HU-Q3.8 CA2): Colombia no tiene
 * horario de verano, y `Intl` cambia entre navegadores (P17).
 */
const BOGOTA_MS = -5 * 60 * 60 * 1000;

const dos = (n: number) => String(n).padStart(2, '0');

export function fechaBogota(ms: number): string {
  const d = new Date(ms + BOGOTA_MS);
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function horaBogota(ms: number): string {
  const d = new Date(ms + BOGOTA_MS);
  return `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}
