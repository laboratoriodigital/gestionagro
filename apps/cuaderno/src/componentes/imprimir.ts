/**
 * Imprimir solo una parte de la pantalla, en el papel que le toca: la etiqueta QR en 5 × 5 cm
 * (HU-E6.4) o el calendario de carencias en una hoja horizontal (HU-E9.1).
 *
 * El elemento se copia a #impresion, en la raíz de la página, y la hoja de estilo de impresión
 * quita todo lo demás (`estilos.css`). El tamaño del papel va en un `@page` que se pone solo
 * mientras se imprime: así cada impresión tiene el suyo. Va en una hoja de estilo construida
 * (`adoptedStyleSheets`): un `<style>` en línea lo bloquea la CSP (`style-src 'self'`) y el papel
 * saldría del tamaño por defecto. `visibility: hidden` no sirve, porque
 * conserva el espacio y saca hojas en blanco (bitácora agro 28).
 */
export interface Papel {
  /** Valor de `size` de `@page`: «5cm 5cm», «letter landscape». */
  tamano: string;
  margen: string;
  /** Clase de #impresion, para el estilo propio de cada impresión. */
  clase: string;
}

export const PAPEL_ETIQUETA: Papel = { tamano: '5cm 5cm', margen: '0', clase: 'etiqueta' };
export const PAPEL_HOJA: Papel = { tamano: 'letter landscape', margen: '1cm', clase: 'hoja' };

const hojasDePapel = new WeakSet<CSSStyleSheet>();

export function imprimirSolo(elemento: HTMLElement | null, papel: Papel): void {
  if (!elemento) return;
  document.getElementById('impresion')?.remove();
  const contenedor = document.createElement('div');
  contenedor.id = 'impresion';
  contenedor.className = papel.clase;
  contenedor.append(elemento.cloneNode(true));
  const estilo = new CSSStyleSheet();
  estilo.replaceSync(`@page { size: ${papel.tamano}; margin: ${papel.margen}; }`);
  // Sin la hoja de otra impresión que no terminó de limpiarse.
  const otras = document.adoptedStyleSheets.filter((h) => !hojasDePapel.has(h));
  hojasDePapel.add(estilo);
  document.adoptedStyleSheets = [...otras, estilo];
  document.body.append(contenedor);
  document.documentElement.classList.add('imprimiendo');
  const limpiar = () => {
    document.documentElement.classList.remove('imprimiendo');
    contenedor.remove();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((h) => h !== estilo);
  };
  // En el teléfono el diálogo es asíncrono: se limpia cuando termina.
  window.addEventListener('afterprint', limpiar, { once: true });
  window.print();
}
