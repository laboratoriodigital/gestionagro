/**
 * Lo que una app llama para pedir el enlace de entrar por correo (HU-C10.2). Lo comparten la cuenta,
 * el cuaderno, la caja del parqueadero y el panel de la Tienda: cada una pinta su formulario a su
 * manera, pero piden y entienden la respuesta igual (P2). Corre en el navegador, sin nada del
 * servidor: `fetch` llega como parámetro para probarlo sin red.
 *
 * El enlace vuelve a la pantalla `vuelta` con `#entrar=<código>`, igual que «Entrar con Google»:
 * la app lo canjea con lo que ya tiene.
 */

export interface PedidoDeEnlace {
  correo: string;
  /** Sin él, el CORE entiende el agro, como con Google (P10). */
  producto?: string;
  vuelta: string;
  politica: string;
}

export type RespuestaDelEnlace = { enviado: boolean; mensaje: string };

export const SIN_CONEXION =
  'Sin conexión: no pudimos pedir el enlace. Revisa la señal e intenta de nuevo.';

/** Lo mínimo para no pedir en vano: algo, una arroba y un punto después. */
export const pareceCorreo = (correo: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());

export async function pedirEnlaceDeEntrada(
  core: string,
  pedido: PedidoDeEnlace,
  fetchFn: typeof fetch = (...a) => fetch(...a),
): Promise<RespuestaDelEnlace> {
  if (!pareceCorreo(pedido.correo)) {
    return {
      enviado: false,
      mensaje: 'Escribe tu correo completo, por ejemplo nombre@correo.com.',
    };
  }
  let r: Response;
  try {
    r = await fetchFn(`${core}/api/core/auth/correo/pedir`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...pedido, correo: pedido.correo.trim() }),
    });
  } catch {
    return { enviado: false, mensaje: SIN_CONEXION };
  }
  const datos = (await r.json().catch(() => ({}))) as { motivo?: unknown };
  const motivo = typeof datos.motivo === 'string' ? datos.motivo : null;
  if (r.ok) {
    return { enviado: true, mensaje: motivo ?? 'Te enviamos un enlace. Revisa tu correo.' };
  }
  return { enviado: false, mensaje: motivo ?? 'No pudimos enviar el enlace. Intenta de nuevo.' };
}
