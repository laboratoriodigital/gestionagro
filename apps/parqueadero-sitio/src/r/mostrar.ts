/**
 * Pinta la vista de `/r/` con `textContent`, nunca con HTML: el fragmento lo puede escribir
 * cualquiera, y un nombre de parqueadero con `<script>` tiene que salir como texto.
 */
import { vistaDelEnlace } from './vista.ts';

function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  texto?: string,
  clase?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

export async function mostrarRecibo(raiz: HTMLElement, fragmento: string): Promise<void> {
  const v = await vistaDelEnlace(fragmento);
  const hijos: HTMLElement[] = [];
  if (v.es === 'completa' && v.prueba) hijos.push(el('p', 'PRUEBA: NO VALE.', 'prueba'));
  hijos.push(el('h1', v.titulo));
  if (v.es !== 'ilegible') {
    const dl = el('dl', undefined, 'filas');
    dl.dataset['prueba'] = 'filas';
    for (const [etiqueta, valor] of v.filas) {
      const fila = el('div');
      fila.append(el('dt', etiqueta), el('dd', valor));
      dl.append(fila);
    }
    hijos.push(dl);
  }
  for (const n of v.notas) hijos.push(el('p', n, 'nota'));
  raiz.dataset['estado'] = v.es;
  raiz.replaceChildren(...hijos);
  document.title = v.es === 'ilegible' ? 'Recibo de parqueadero' : v.titulo;
}
