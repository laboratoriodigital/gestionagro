/**
 * Lo que la cuenta (HU-C7.2) promete y se revisa en su build: páginas estáticas sin código ni
 * estilos en línea (su único script, la sesión, va en archivo), que no se indexan, con una CSP que solo deja lo propio. Lo usan
 * `scripts/verificar-cuenta.ts` (al compilar) y las pruebas.
 */

/** Las rutas en las que el Worker del CORE corre antes que los assets. Nada más (CA3). */
export const RUTAS_DEL_WORKER = ['/api/core/*', '/oauth/*', '/.well-known/*'] as const;

/** Lo que una página de la cuenta no puede traer, con el porqué. */
export function fallasDeUnaPagina(ruta: string, html: string): string[] {
  const fallas: string[] = [];
  // Un script propio en archivo sí (la sesión, HU-C7.3); uno en línea, no: la CSP lo bloquea.
  if (/<script\b(?![^>]*\bsrc=)/i.test(html))
    fallas.push(`${ruta}: trae un <script> en línea; la CSP lo bloquea`);
  if (/<style\b/i.test(html)) fallas.push(`${ruta}: trae un <style> en línea; la CSP lo bloquea`);
  if (/\sstyle=/i.test(html)) fallas.push(`${ruta}: trae un atributo style=; la CSP lo bloquea`);
  if (/\son[a-z]+=/i.test(html)) fallas.push(`${ruta}: trae un manejador en línea (on…=)`);
  if (!/<meta name="robots" content="noindex/i.test(html)) {
    fallas.push(`${ruta}: no dice noindex; la cuenta es personal`);
  }
  return fallas;
}

/** La CSP de `_headers`: solo lo propio, sin excepciones en línea. */
export function fallasDeLasCabeceras(texto: string): string[] {
  const csp = /Content-Security-Policy:\s*(.+)/.exec(texto)?.[1] ?? '';
  const fallas: string[] = [];
  if (!csp) return ['_headers no trae Content-Security-Policy'];
  for (const exigida of [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    // Entrar es un formulario que el CORE redirige a Google: el navegador aplica form-action
    // también a esa redirección. Sin Google aquí, «Entrar con Google» no sale de la página.
    "form-action 'self' https://accounts.google.com",
  ]) {
    if (!csp.includes(exigida)) fallas.push(`la CSP no dice «${exigida}»`);
  }
  if (/unsafe-(inline|eval)/.test(csp)) fallas.push('la CSP permite código o estilos en línea');
  if (!/X-Robots-Tag:\s*noindex/.test(texto)) fallas.push('_headers no trae X-Robots-Tag: noindex');
  return fallas;
}
