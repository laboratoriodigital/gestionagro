/**
 * El movimiento de la landing de CultivoPro (HU-E0.10). Solo pone atributos; la hoja hace el
 * cambio. Sin este script, o con el movimiento reducido, la página se lee completa y quieta:
 * la primera pantalla del teléfono, las secciones visibles y la cifra del DPV escrita.
 *
 * - «Así trabaja contigo»: el paso que se está leyendo cambia la pantalla del teléfono
 *   (`data-paso` en la sección), como «Así te llega un pedido» de TiendaPro.
 * - Las partes marcadas con `.aparece` suben un poco al llegar a ellas (`data-visto`).
 * - La cifra del DPV cuenta hasta su valor cuando entra en pantalla.
 */

const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hayObservador = 'IntersectionObserver' in window;

const seccion = document.querySelector<HTMLElement>('[data-trabajo]');
const pasos = [...document.querySelectorAll<HTMLElement>('.paso[data-paso]')];

if (seccion && pasos.length > 0 && hayObservador) {
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

if (!quieto && hayObservador) {
  // La hoja esconde `.aparece` solo con esta clase: sin script, todo se ve desde el principio.
  document.documentElement.classList.add('con-movimiento');
  const aparecer = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.setAttribute('data-visto', '');
        obs.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  for (const el of document.querySelectorAll('.aparece')) aparecer.observe(el);

  const contar = (el: HTMLElement) => {
    const meta = Number(el.dataset['cifra']);
    if (!Number.isFinite(meta)) return;
    const inicio = performance.now();
    const duracion = 900;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      // Sale rápido y frena al llegar, como la curva de salida del sistema de diseño.
      const valor = meta * (1 - (1 - t) ** 3);
      el.textContent = valor.toFixed(1).replace('.', ',');
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const contador = new IntersectionObserver(
    (entradas, obs) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const muestra = e.target as HTMLElement;
        muestra.setAttribute('data-visto', '');
        const cifra = muestra.querySelector<HTMLElement>('[data-cifra]');
        if (cifra) contar(cifra);
        obs.unobserve(muestra);
      }
    },
    { threshold: 0.6 },
  );
  for (const el of document.querySelectorAll('[data-contador]')) contador.observe(el);
}
