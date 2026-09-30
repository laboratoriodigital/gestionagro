/**
 * Validación de medidas de entrada. Un valor ilegible o fuera de rango **lanza**; nunca se
 * convierte en 0 ni en NaN (P1, bitácora ecommerce `Number(celda) || 0`).
 */

export class ErrorDeMedida extends Error {
  override readonly name = 'ErrorDeMedida';
  /** Nombre del parámetro con su unidad, p. ej. `humedadRelativaPct`. */
  readonly campo: string;

  constructor(campo: string, mensaje: string) {
    super(mensaje);
    this.campo = campo;
  }
}

/** Exige un número finito dentro de [minimo, maximo], ambos incluidos. */
export function exigirRango(campo: string, valor: unknown, minimo: number, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorDeMedida(campo, `«${campo}» no es un número: ${String(valor)}`);
  }
  if (valor < minimo || valor > maximo) {
    throw new ErrorDeMedida(
      campo,
      `«${campo}» fuera de rango: ${valor} (se acepta de ${minimo} a ${maximo})`,
    );
  }
  return valor;
}
