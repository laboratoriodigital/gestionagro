/**
 * Pinta la vista de `/r/` con `textContent`, nunca con HTML: el fragmento lo puede escribir
 * cualquiera, y un nombre de parqueadero con `<script>` tiene que salir como texto. La forma
 * completa es la hoja de la caja (`src/caja/HojaRecibo.tsx`), con las clases de `hoja-recibo.css`,
 * y arriba el sello de la firma (HU-Q8.2).
 */
import type { LlavePublica, VerificarEd25519 } from '@ed1/firma';
import { verifyAsync } from '@noble/ed25519';
import { el, grupo, hoja } from '../hoja.ts';
import { vistaDelEnlace } from './vista.ts';

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
