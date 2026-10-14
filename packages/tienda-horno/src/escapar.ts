/**
 * Lo que escribe el comercio no se ejecuta (HU-T4.2, TIENDA-3.0 §14.1): todo texto se escapa al
 * hornear, y las descripciones son Markdown **sin HTML**, con un subconjunto pequeño (párrafos,
 * negrita, cursiva, listas y enlaces) y solo los enlaces `https`, `mailto`, `tel` y `wa.me`.
 */

const HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapa texto para el cuerpo o para un atributo entre comillas dobles. */
export const escaparHtml = (texto: string): string =>
  texto.replace(/[&<>"']/g, (c) => HTML[c] ?? c);

/**
 * El enlace, si su esquema está permitido; si no, `null` (se muestra como texto, nunca se enlaza).
 * `wa.me` solo por `https`. Sin espacios ni caracteres de control: un `javascript:` disfrazado no
 * pasa.
 */
export function enlaceSeguro(url: string): string | null {
  const limpio = url.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: es justo lo que se rechaza
  if (/[\s\u0000-\u001f\u007f]/.test(limpio)) return null;
  if (/^mailto:[^@\s]+@[^@\s]+$/i.test(limpio)) return limpio;
  if (/^tel:\+?[0-9-]{7,20}$/i.test(limpio)) return limpio;
  let u: URL;
  try {
    u = new URL(limpio);
  } catch {
    return null;
  }
  return u.protocol === 'https:' ? u.href : null;
}

/** Negrita, cursiva y enlaces dentro de una línea ya escapada. */
function enLinea(escapado: string): string {
  return escapado
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_todo, texto: string, destino: string) => {
      // El destino ya está escapado: se desescapa solo para validarlo y se vuelve a escapar.
      const crudo = destino.replace(/&amp;/g, '&');
      const seguro = enlaceSeguro(crudo);
      return seguro ? `<a href="${escaparHtml(seguro)}" rel="nofollow">${texto}</a>` : texto;
    });
}

/**
 * Markdown del comercio a HTML seguro. Cualquier etiqueta que escriba sale como texto: primero se
 * escapa todo, y después se agrega solo el HTML que este subconjunto produce.
 */
export function markdownSeguro(markdown: string): string {
  const bloques = markdown
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return bloques
    .map((bloque) => {
      const lineas = bloque.split('\n');
      if (lineas.every((l) => /^[-*] /.test(l))) {
        const items = lineas.map((l) => `<li>${enLinea(escaparHtml(l.slice(2).trim()))}</li>`);
        return `<ul>${items.join('')}</ul>`;
      }
      return `<p>${lineas.map((l) => enLinea(escaparHtml(l.trim()))).join('<br>')}</p>`;
    })
    .join('\n');
}

/** El mismo Markdown, como texto plano para el gemelo `.md` y las descripciones: sin enlaces raros. */
export function markdownPlano(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_t, texto: string, destino: string) =>
      enlaceSeguro(destino) ? `[${texto}](${destino})` : texto,
    )
    .replace(/[<>]/g, '')
    .trim();
}
