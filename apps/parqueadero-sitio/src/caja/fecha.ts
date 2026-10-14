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

/**
 * Hora militar o de reloj en las pantallas de la caja (HU-Q13.1): la que eligió la sede en
 * Ajustes. La caja la pone al leer la sede (`App`); los recibos la llevan en su modelo.
 */
let conHora12 = false;
export const ponerHora12 = (si: boolean): void => {
  conHora12 = si;
};

export function horaBogota(ms: number): string {
  const d = new Date(ms + BOGOTA_MS);
  const h = d.getUTCHours();
  const m = dos(d.getUTCMinutes());
  if (!conHora12) return `${dos(h)}:${m}`;
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** `2026-10-06`: el día local de Bogotá, el de `fecha_local` de los registros. */
export function diaLocalBogota(ms: number): string {
  const d = new Date(ms + BOGOTA_MS);
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}
