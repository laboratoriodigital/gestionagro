/**
 * Pinta la vista de `/r/` con `textContent`, nunca con HTML: el fragmento lo puede escribir
 * cualquiera, y un nombre de parqueadero con `<script>` tiene que salir como texto. La forma
 * completa es la hoja de la caja (`src/caja/HojaRecibo.tsx`), con las clases de `hoja-recibo.css`,
 * y arriba el sello de la firma (HU-Q8.2).
 */
import type { LlavePublica, VerificarEd25519 } from '@ed1/firma';
import type { VistaDeRecibo } from '@ed1/parqueadero-recibos';
import { verifyAsync } from '@noble/ed25519';
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

function grupo(filas: readonly (readonly [string, string])[], clase: string): HTMLDListElement {
  const dl = el('dl', undefined, clase);
  for (const [etiqueta, valor] of filas) {
    const fila = el('div');
    fila.append(el('dt', etiqueta), el('dd', valor));
    dl.append(fila);
  }
  return dl;
}

function hoja(v: VistaDeRecibo): HTMLElement {
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

/** Las llaves de las celdas que el despliegue puso en la página (`#claves-recibo`). */
function llavesDeLaPagina(): LlavePublica[] {
  try {
    const claves: unknown = JSON.parse(
      document.getElementById('claves-recibo')?.textContent ?? '[]',
    );
    return Array.isArray(claves)
      ? claves.filter(
          (c): c is LlavePublica => typeof c?.kid === 'string' && typeof c?.x === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

/** Ed25519 con @noble/ed25519: también en teléfonos sin Ed25519 en WebCrypto. */
const verificar: VerificarEd25519 = async (publica, mensaje, firma) =>
  verifyAsync(firma, mensaje, publica);

export async function mostrarRecibo(raiz: HTMLElement, fragmento: string): Promise<void> {
  const v = await vistaDelEnlace(fragmento, llavesDeLaPagina(), verificar);
  const hijos: HTMLElement[] = [];
  if (v.es === 'completa') {
    if (v.sello) {
      const sello = el('p', v.sello.texto, `sello sello-${v.sello.tono}`);
      sello.dataset['prueba'] = 'sello';
      hijos.push(sello);
    }
    hijos.push(hoja(v.hoja));
  } else {
    hijos.push(el('h1', v.titulo));
    if (v.es === 'corta') {
      const dl = grupo(v.filas, 'filas');
      dl.dataset['prueba'] = 'filas';
      hijos.push(dl);
    }
  }
  for (const n of v.notas) hijos.push(el('p', n, 'nota'));
  raiz.dataset['estado'] = v.es;
  raiz.replaceChildren(...hijos);
  document.title = v.es === 'ilegible' ? 'Recibo de parqueadero' : v.titulo;
}
