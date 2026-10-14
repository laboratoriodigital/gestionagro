/**
 * La isla de la vitrina (HU-T3.4 y HU-T5.3): el único JavaScript de una tienda, servido desde
 * `/_t/<release>/vitrina.js` (CSP `script-src 'self'`). Mejora lo que ya se lee sin él:
 *
 * - en la ficha, la elección de la variante (`seleccion.ts`): el precio, lo agotado tachado y el
 *   botón que dice qué falta y, al tocarlo, lleva al campo (CA2);
 * - la barra del pedido, que aparece cuando hay algo en él;
 * - en `/buscar/`, la búsqueda sobre `catalogo.json`, sin red al escribir.
 *
 * `scripts/armar-vitrina.ts` le quita los tipos al armarla; no lleva dependencias.
 */
import { buscar, type ProductoDelCatalogo } from './buscar.ts';
import {
  estadoDeLaEleccion,
  type OpcionDeLaFicha,
  type VarianteDeLaFicha,
  valorAgotado,
} from './seleccion.ts';

const PEDIDO = 'tienda:pedido';

interface LineaDelPedido {
  variante: string;
  cantidad: number;
}

function leerPedido(): LineaDelPedido[] {
  try {
    const guardado = JSON.parse(localStorage.getItem(PEDIDO) ?? '[]') as unknown;
    return Array.isArray(guardado) ? (guardado as LineaDelPedido[]) : [];
  } catch {
    return [];
  }
}

function pintarBarra(): void {
  const barra = document.querySelector<HTMLElement>('[data-pedido]');
  if (!barra) return;
  const cantidad = leerPedido().reduce((s, l) => s + l.cantidad, 0);
  const contador = barra.querySelector('[data-cantidad]');
  if (contador) contador.textContent = String(cantidad);
  barra.hidden = cantidad === 0;
}

const formato = (pesos: number) => `$${String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

function ficha(): void {
  const form = document.querySelector<HTMLFormElement>('[data-eleccion]');
  const datos = document.getElementById('variantes');
  if (!form || !datos) return;
  const { opciones, variantes } = JSON.parse(datos.textContent ?? '{}') as {
    opciones: OpcionDeLaFicha[];
    variantes: VarianteDeLaFicha[];
  };
  const boton = form.querySelector<HTMLButtonElement>('[data-boton]');
  const precio = document.querySelector<HTMLElement>('[data-precio]');
  const avisame = form.querySelector<HTMLElement>('[data-avisame]');
  const elegidas = (): Record<string, string> =>
    Object.fromEntries(
      opciones.flatMap((o) => {
        const marcado = form.querySelector<HTMLInputElement>(
          `input[name="${CSS.escape(o.nombre)}"]:checked`,
        );
        return marcado ? [[o.nombre, marcado.value]] : [];
      }),
    );
  const pintar = () => {
    const e = elegidas();
    const estado = estadoDeLaEleccion(opciones, variantes, e);
    if (boton) {
      boton.textContent = estado.texto;
      boton.setAttribute('aria-disabled', String(estado.tipo !== 'lista'));
    }
    if (precio && (estado.tipo === 'lista' || estado.tipo === 'agotada')) {
      precio.textContent = formato(estado.variante.precioCop);
    }
    if (avisame) avisame.hidden = estado.tipo !== 'agotada';
    for (const o of opciones) {
      for (const input of form.querySelectorAll<HTMLInputElement>(
        `input[name="${CSS.escape(o.nombre)}"]`,
      )) {
        input
          .closest('label')
          ?.classList.toggle(
            'agotado',
            valorAgotado(opciones, variantes, e, o.nombre, input.value),
          );
      }
    }
  };
  form.addEventListener('change', pintar);
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const estado = estadoDeLaEleccion(opciones, variantes, elegidas());
    if (estado.tipo === 'falta') {
      form.querySelector<HTMLInputElement>(`input[name="${CSS.escape(estado.opcion)}"]`)?.focus();
      return;
    }
    if (estado.tipo !== 'lista') return;
    const pedido = leerPedido();
    const linea = pedido.find((l) => l.variante === estado.variante.id);
    if (linea) linea.cantidad += 1;
    else pedido.push({ variante: estado.variante.id, cantidad: 1 });
    try {
      localStorage.setItem(PEDIDO, JSON.stringify(pedido));
    } catch {
      // Sin almacenamiento (modo privado): la barra no cambia, y el pedido se arma por WhatsApp.
    }
    pintarBarra();
  });
  pintar();
}

async function busqueda(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('[data-buscar]');
  const lista = document.querySelector<HTMLElement>('[data-resultados]');
  const vacio = document.querySelector<HTMLElement>('[data-sin-resultados]');
  if (!form || !lista || !vacio) return;
  // El catálogo se carga una vez al abrir la página; escribir no pide nada al servidor (CA3).
  const catalogo = (await (await fetch('/catalogo.json')).json()) as {
    productos: ProductoDelCatalogo[];
  };
  const campo = form.querySelector<HTMLInputElement>('input[type="search"]');
  const pintar = () => {
    const q = campo?.value ?? '';
    const hallados = buscar(catalogo.productos, q);
    lista.replaceChildren(
      ...hallados.map((p) => {
        const li = document.createElement('li');
        li.className = 'tarjeta';
        const a = document.createElement('a');
        a.href = new URL(p.url).pathname;
        a.textContent = p.nombre;
        li.append(a);
        return li;
      }),
    );
    vacio.hidden = q.trim() === '' || hallados.length > 0;
  };
  form.addEventListener('submit', (e) => e.preventDefault());
  campo?.addEventListener('input', pintar);
  if (campo) campo.value = new URLSearchParams(location.search).get('q') ?? '';
  pintar();
}

ficha();
pintarBarra();
void busqueda();
