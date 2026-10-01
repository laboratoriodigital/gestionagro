/**
 * Números como los escribe un productor en Colombia (ARQUITECTURA §5.3, regla 7).
 * Se acepta coma o punto decimal; lo ambiguo se rechaza con un motivo, nunca se adivina ni
 * se convierte en 0 (P1).
 */

export type Lectura = { ok: true; valor: number } | { ok: false; motivo: string };

const NUMERO = /^[+-]?\d+(?:[.,]\d+)?$/;

/** Lee «24,5», «24.5», «-3», « 18 ». Rechaza «24,,5», «1.234,5», «24,», «», «abc». */
export function leerNumero(texto: string): Lectura {
  const limpio = texto.trim();
  if (limpio === '') return { ok: false, motivo: 'Escribe un número.' };
  if (!NUMERO.test(limpio)) {
    return {
      ok: false,
      motivo: 'No es un número válido. Usa coma o punto una sola vez, por ejemplo 24,5.',
    };
  }
  const valor = Number(limpio.replace(',', '.'));
  if (!Number.isFinite(valor)) return { ok: false, motivo: 'No es un número válido.' };
  return { ok: true, valor };
}

/** «0,90 kPa»: dos decimales y coma decimal, sin depender del idioma del navegador. */
export function formatearKPa(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')} kPa`;
}
