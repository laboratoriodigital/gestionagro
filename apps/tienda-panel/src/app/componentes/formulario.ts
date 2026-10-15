/**
 * Validar un formulario entero de una vez (HU-T3.5 CA1, bitácora agro 16): cada regla se mira,
 * aunque otra ya haya fallado, y salen todos los errores en la misma vuelta. Con
 * `ResumenDeErrores` y `Campo` de `@ed1/ui` v2 se ven arriba y junto a su campo.
 */
export interface Regla<T> {
  campo: keyof T & string;
  /** El mensaje si falla, en palabras del comercio; `null` si está bien. */
  mirar: (valores: T) => string | null;
}

export function validarTodo<T>(
  valores: T,
  reglas: readonly Regla<T>[],
): { campo: string; mensaje: string }[] {
  return reglas.flatMap((r) => {
    const mensaje = r.mirar(valores);
    return mensaje ? [{ campo: r.campo, mensaje }] : [];
  });
}
