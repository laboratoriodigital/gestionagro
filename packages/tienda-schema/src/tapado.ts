/**
 * Los datos de una persona, tapados (TIENDA-3.0 §12.5, HU-T3.5): «María F.», «300 ••• 4567». El
 * panel los muestra así siempre; verlos completos es una acción aparte que queda registrada.
 * Las usa la API (HU-T9.1): lo que llega al panel ya viene tapado. Puras, para probarlas sin
 * navegador.
 */

/** La primera palabra y la inicial de la segunda: «María Fernanda Gómez» → «María F.». */
export function taparNombre(nombre: string): string {
  const [primero, segundo] = nombre.trim().split(/\s+/).filter(Boolean);
  if (!primero) return '';
  return segundo ? `${primero} ${segundo.charAt(0).toUpperCase()}.` : primero;
}

/** Los tres primeros y los cuatro últimos dígitos: «300 ••• 4567». Con menos de 8, solo los 2 últimos. */
export function taparCelular(celular: string): string {
  const d = celular.replace(/\D/g, '');
  const local = d.length > 10 && d.startsWith('57') ? d.slice(2) : d;
  if (local.length < 8) return local.length <= 2 ? '•••' : `••• ${local.slice(-2)}`;
  return `${local.slice(0, 3)} ••• ${local.slice(-4)}`;
}

/** La primera letra y el dominio: «m•••@ejemplo.co». */
export function taparCorreo(correo: string): string {
  const [usuario = '', dominio] = correo.trim().split('@');
  if (!dominio || !usuario) return '•••';
  return `${usuario.charAt(0)}•••@${dominio}`;
}
