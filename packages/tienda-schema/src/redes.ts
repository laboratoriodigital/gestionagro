/**
 * HU-P4.3 (sprint PF1): las redes sociales de la tienda. El comercio escribe su usuario («@tutienda»
 * o «tutienda») o pega el enlace de su perfil, y se guarda siempre el enlace completo de esa red.
 * Solo esas tres redes, con su dominio: el pie de la tienda nunca enlaza a otro lado ni carga nada
 * de ellas.
 */

export const REDES = ['instagram', 'tiktok', 'facebook'] as const;
export type Red = (typeof REDES)[number];

export const NOMBRE_DE_LA_RED: Record<Red, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
};

const DOMINIO: Record<Red, string> = {
  instagram: 'instagram.com',
  tiktok: 'tiktok.com',
  facebook: 'facebook.com',
};

/** Un usuario de esas redes: letras, números, punto, guion y guion bajo. */
const USUARIO = /^[A-Za-z0-9._-]{1,60}$/;
/** El perfil de Facebook sin usuario propio. */
const PERFIL_DE_FACEBOOK = /^profile\.php\?id=\d{1,20}$/;

const armar = (red: Red, usuario: string) =>
  red === 'tiktok'
    ? `https://www.tiktok.com/@${usuario}`
    : `https://www.${DOMINIO[red]}/${usuario}`;

/**
 * El enlace del perfil, o `null` si lo escrito no es un usuario ni un perfil de esa red. Nunca
 * acepta otro dominio, otro esquema ni un camino más largo que el del perfil.
 */
export function enlaceDeRed(red: Red, escrito: string): string | null {
  const t = escrito.trim();
  if (t === '') return null;
  let usuario = t;
  if (/[/:]/.test(t) && !PERFIL_DE_FACEBOOK.test(t)) {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    } catch {
      return null;
    }
    const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (host !== DOMINIO[red] || u.username || u.password || u.port) return null;
    const camino = u.pathname.replace(/^\/+|\/+$/g, '');
    if (red === 'facebook' && camino === 'profile.php') {
      const id = u.searchParams.get('id') ?? '';
      return /^\d{1,20}$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
    }
    if (camino.includes('/')) return null;
    usuario = camino;
  } else if (red === 'facebook' && PERFIL_DE_FACEBOOK.test(t)) {
    return `https://www.facebook.com/${t}`;
  }
  usuario = usuario.replace(/^@/, '');
  return USUARIO.test(usuario) ? armar(red, usuario) : null;
}
