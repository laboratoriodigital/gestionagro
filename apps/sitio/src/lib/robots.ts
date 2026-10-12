/**
 * El `robots.txt` del sitio, de `content/agentes.json` (HU-C8.1, PLATAFORMA §5.3, P2). Nada de
 * agentes escrito en el código: agregar o mover uno es editar ese archivo. La prueba de humo del
 * despliegue compara lo publicado con esto, así que un `robots.txt` cambiado a mano no pasa.
 *
 * - Cada familia es un grupo: si su señal (`segun`) es `yes`, lee lo público y no lo cerrado; si
 *   es `no`, no lee nada.
 * - Al final, el grupo de todos, con lo cerrado y la `Content-Signal` (contentsignals.org).
 */
export type Senal = 'search' | 'ai-input' | 'ai-train';

export interface Agentes {
  content_signal: Record<Senal, 'yes' | 'no'>;
  cerrado_para_todos: readonly string[];
  familias: readonly {
    id: string;
    descripcion: string;
    agentes: readonly string[];
    segun: Senal;
  }[];
}

export function robotsTxt(a: Agentes, sitio: string): string {
  const cerrado = a.cerrado_para_todos.map((ruta) => `Disallow: ${ruta}`);
  const grupos = a.familias.map((f) => {
    const permitido = a.content_signal[f.segun] === 'yes';
    return [
      `# ${f.descripcion} (${f.segun}=${a.content_signal[f.segun]})`,
      ...f.agentes.map((agente) => `User-agent: ${agente}`),
      ...(permitido ? ['Allow: /', ...cerrado] : ['Disallow: /']),
    ].join('\n');
  });
  const senal = (Object.keys(a.content_signal) as Senal[])
    .map((s) => `${s}=${a.content_signal[s]}`)
    .join(', ');
  return `${[
    ...grupos,
    ['# Todos los demás', 'User-agent: *', ...cerrado, `Content-Signal: ${senal}`].join('\n'),
    `Sitemap: ${sitio}/sitemap.xml`,
  ].join('\n\n')}\n`;
}
