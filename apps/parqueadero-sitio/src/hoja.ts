/**
 * La hoja del recibo pintada con `textContent`, nunca con HTML (HU-Q6.6): la usan `/r/`, donde el
 * fragmento lo puede escribir cualquiera, y el generador de recibos del sitio (HU-Q11.4). Es la
 * misma hoja de la caja (`src/caja/HojaRecibo.tsx`), con las clases de `hoja-recibo.css`.
 */
import type { VistaDeRecibo } from '@ed1/parqueadero-recibos';

export function el<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  texto?: string,
  clase?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(etiqueta);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

export function grupo(
  filas: readonly (readonly [string, string])[],
  clase: string,
): HTMLDListElement {
  const dl = el('dl', undefined, clase);
  for (const [etiqueta, valor] of filas) {
    const fila = el('div');
    fila.append(el('dt', etiqueta), el('dd', valor));
    dl.append(fila);
  }
  return dl;
}

export function hoja(v: VistaDeRecibo): HTMLElement {
  const a = el('article', undefined, 'hoja-recibo');
  a.dataset['prueba'] = 'filas';
  if (v.prueba) a.append(el('p', 'PRUEBA: NO VALE', 'hoja-prueba'));
  const sede = el('header', undefined, 'hoja-sede');
  sede.append(el('p', v.sede.nombre, 'hoja-sede-nombre'));
  for (const d of v.sede.datos) sede.append(el('p', d, 'hoja-sede-dato'));
  const h1 = el('h1', undefined, 'hoja-titulo');
  h1.append(el('span', v.clase, 'hoja-clase'), ' ', el('span', v.numero, 'hoja-numero'));
  const placa = el('p', undefined, 'hoja-placa');
  placa.append(el('span', v.placa, 'hoja-placa-numero'), ' ', el('span', v.vehiculo));
  a.append(sede, h1, placa, ...v.grupos.map((g) => grupo(g, 'hoja-grupo')));
  if (v.total) {
    const total = el('p', undefined, 'hoja-total');
    total.append(
      el('span', 'Total', 'hoja-total-etiqueta'),
      ' ',
      el('span', v.total.valor, 'hoja-total-valor'),
      ' ',
      el('span', v.total.pago, 'hoja-pago'),
    );
    a.append(total);
  }
  a.append(...v.cierre.map((g) => grupo(g, 'hoja-grupo')));
  const legal = el('footer', undefined, 'hoja-legal');
  for (const l of v.legal) legal.append(el('p', l));
  a.append(legal);
  return a;
}
