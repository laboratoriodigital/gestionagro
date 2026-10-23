/**
 * «Así te llega un pedido» (HU-T18.5): el paso que el visitante está leyendo cambia la pantalla
 * del teléfono. Solo pone `data-paso` en la sección; la hoja hace el cambio. Sin este script, la
 * sección se lee igual con la primera pantalla.
 */
const seccion = document.querySelector<HTMLElement>('[data-pedido]');
const pasos = [...document.querySelectorAll<HTMLElement>('.paso[data-paso]')];

if (seccion && pasos.length > 0 && 'IntersectionObserver' in window) {
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const paso = (e.target as HTMLElement).dataset['paso'];
        if (!paso) continue;
        seccion.dataset['paso'] = paso;
        for (const p of pasos) p.toggleAttribute('data-actual', p === e.target);
      }
    },
    // El paso cuenta cuando cruza la franja del medio de la pantalla.
    { rootMargin: '-45% 0px -45% 0px' },
  );
  for (const p of pasos) observador.observe(p);
  pasos[0]?.setAttribute('data-actual', '');
  // Solo con la guía andando se atenúan los pasos que no se están leyendo.
  seccion.classList.add('con-guia');
}
