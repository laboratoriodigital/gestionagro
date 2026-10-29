/**
 * HU-P4.4 (sprint PF3): el título y la descripción para buscadores de un producto o de una página.
 * Son opcionales: sin ellos, el horno usa el nombre y la descripción, como antes. Google muestra
 * unas 60 letras del título y unas 155 de la descripción; más se corta con «…», pero se guarda (el
 * panel avisa). El tope de lo que se guarda es el doble, para que nadie meta un texto entero.
 * Quien no lo manda (un asistente, la carga por lotes) no lo borra: queda lo que había.
 */
import { z } from 'zod';

/** Lo que Google suele mostrar antes de cortar con «…». El panel avisa al pasarse. */
export const LARGO_EN_GOOGLE = { titulo: 60, descripcion: 155 } as const;

export const buscadores = z
  .object({
    titulo: z
      .string()
      .trim()
      .max(120, { error: 'el título para buscadores va hasta 120 letras' })
      .optional(),
    descripcion: z
      .string()
      .trim()
      .max(320, { error: 'la descripción para buscadores va hasta 320 letras' })
      .optional(),
  })
  .optional();
export type Buscadores = { titulo?: string; descripcion?: string };

/** Lo guardado, sin vacíos ni lo que no es texto (lo que no se lee no existe, P1). */
export function buscadoresLeidos(guardado: Record<string, unknown>): Buscadores {
  const r: Buscadores = {};
  const titulo = guardado['titulo'];
  const descripcion = guardado['descripcion'];
  if (typeof titulo === 'string' && titulo.trim()) r.titulo = titulo.trim().slice(0, 120);
  if (typeof descripcion === 'string' && descripcion.trim())
    r.descripcion = descripcion.trim().slice(0, 320);
  return r;
}
