/**
 * Las rutas del panel, sin dependencias: la ruta es `location.pathname`, un enlace del panel cambia
 * la ruta sin recargar (así no se pierde lo escrito) y «atrás» funciona. Los enlaces a otro origen,
 * con modificadores o con `target` siguen siendo enlaces normales.
 */
import { useEffect, useState } from 'preact/hooks';

const EVENTO = 'panel:ruta';

export function irA(ruta: string): void {
  if (ruta === location.pathname) return;
  history.pushState(null, '', ruta);
  window.dispatchEvent(new Event(EVENTO));
  window.scrollTo(0, 0);
}

export function usarRuta(): string {
  const [ruta, setRuta] = useState(location.pathname);
  useEffect(() => {
    const cambio = () => setRuta(location.pathname);
    const alTocar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
      e.preventDefault();
      irA(url.pathname);
    };
    window.addEventListener('popstate', cambio);
    window.addEventListener(EVENTO, cambio);
    document.addEventListener('click', alTocar);
    return () => {
      window.removeEventListener('popstate', cambio);
      window.removeEventListener(EVENTO, cambio);
      document.removeEventListener('click', alTocar);
    };
  }, []);
  return ruta;
}
