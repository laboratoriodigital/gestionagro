/**
 * Los nombres que lista `wrangler secret list --format json`. La salida junta stdout y stderr, y
 * wrangler puede escribir una advertencia antes o después de la lista: el 22 oct 2026 una variable
 * de producción que staging no tenía agregó «▲ [WARNING] …» al final, y leer desde el primer `[`
 * hasta el final dejó a la Tienda de staging sin desplegar (bitácora tienda3 52). Se lee solo el
 * arreglo: desde la primera línea que empieza con `[` hasta el primer `]` que lo cierra.
 */
export function nombresDeSecretos(salida: string): string[] {
  const inicio = salida.search(/^\[/m);
  if (inicio < 0) throw new Error('la salida no trae la lista de secretos');
  for (let fin = salida.indexOf(']', inicio); fin >= 0; fin = salida.indexOf(']', fin + 1)) {
    try {
      const lista = JSON.parse(salida.slice(inicio, fin + 1)) as unknown;
      if (Array.isArray(lista)) {
        return lista.map((s) => {
          const nombre = (s as { name?: unknown }).name;
          if (typeof nombre !== 'string') throw new Error('un secreto sin nombre');
          return nombre;
        });
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'un secreto sin nombre') throw e;
      // Todavía no cierra el arreglo: el `]` era de adentro.
    }
  }
  throw new Error('la lista de secretos no es JSON');
}
