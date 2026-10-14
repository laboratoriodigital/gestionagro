/**
 * La isla de la vitrina (HU-T3.4, HU-T5.3 y HU-T5.4): el único JavaScript de una tienda, servido
 * desde `/_t/<release>/vitrina.js` (CSP `script-src 'self'`). Mejora lo que ya se lee sin él:
 *
 * - en la ficha, la elección de la variante (`seleccion.ts`): el precio, lo agotado tachado y el
 *   botón que dice qué falta y, al tocarlo, lleva al campo; la edad, si el producto la pide;
 * - el carrito (`carrito.ts`) en el `localStorage` de la tienda, con su código y sus topes, y la
 *   barra del pedido, que aparece cuando hay algo en él;
 * - en `/pedido/`, las líneas del carrito con sus cantidades;
 * - en `/buscar/`, la búsqueda sobre `catalogo.json`, sin red al escribir.
 *
 * Todo texto que llega del catálogo se pone con `textContent`, nunca como HTML.
 * `scripts/armar-vitrina.ts` le quita los tipos al armarla; no lleva dependencias.
 */
import { buscar, type ProductoDelCatalogo } from './buscar.ts';
import {
  type AvisoAlLeer,
  agregar,
  type Carrito,
  CLAVE_ANTERIOR,
  CLAVE_DEL_CARRITO,
  cambiarCantidad,
  leerCarrito,
  sanear,
  TOPES,
  type Tope,
  unidades,
} from './carrito.ts';
import {
  estadoDeLaEleccion,
  type OpcionDeLaFicha,
  type VarianteDeLaFicha,
  valorAgotado,
} from './seleccion.ts';

const azar = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** El almacenamiento puede no existir (modo privado): entonces el pedido se arma por WhatsApp. */
const almacen = {
  leer(clave: string): string | null {
    try {
      return localStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  escribir(clave: string, valor: string): boolean {
    try {
      localStorage.setItem(clave, valor);
      return true;
    } catch {
      return false;
    }
  },
  borrar(clave: string): void {
    try {
      localStorage.removeItem(clave);
    } catch {
      // Nada que borrar.
    }
  },
};

let avisoAlLeer: AvisoAlLeer | undefined;
function cargar(): Carrito {
  const { carrito, aviso } = leerCarrito(
    almacen.leer(CLAVE_DEL_CARRITO),
    almacen.leer(CLAVE_ANTERIOR),
    azar,
  );
  if (aviso) {
    avisoAlLeer = aviso;
    guardar(carrito);
    almacen.borrar(CLAVE_ANTERIOR);
  }
  return carrito;
}
function guardar(c: Carrito): void {
  almacen.escribir(CLAVE_DEL_CARRITO, JSON.stringify(c));
}

const AVISOS_AL_LEER: Record<AvisoAlLeer, string> = {
  'formato-anterior':
    'Actualizamos tu pedido a la nueva versión de la tienda. Revisa que esté completo.',
  ilegible: 'No pudimos leer tu pedido anterior y empezamos uno nuevo. Perdona la molestia.',
  recortado: `Tu pedido pasaba del máximo (${TOPES.lineas} productos y ${TOPES.unidadesPorLinea} unidades de cada uno) y lo ajustamos.`,
};
const AVISOS_DE_TOPE: Record<Tope, string> = {
  lineas: `Tu pedido ya tiene ${TOPES.lineas} productos distintos, el máximo. Envía este y haz otro.`,
  unidades: `Puedes pedir hasta ${TOPES.unidadesPorLinea} unidades de cada producto.`,
};

function pintarBarra(c: Carrito): void {
  const barra = document.querySelector<HTMLElement>('[data-pedido]');
  if (!barra) return;
  const cantidad = unidades(c);
  const contador = barra.querySelector('[data-cantidad]');
  if (contador) contador.textContent = String(cantidad);
  barra.hidden = cantidad === 0 || location.pathname === '/pedido/';
}

const formato = (pesos: number) => `$${String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

function decir(elemento: HTMLElement | null, texto: string | undefined): void {
  if (!elemento) return;
  elemento.textContent = texto ?? '';
  elemento.hidden = !texto;
}

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
  const aviso = form.querySelector<HTMLElement>('[data-aviso]');
  // Ley 1480 art. 52: un producto solo para mayores pide confirmar la edad antes de agregarlo.
  const mayoria = form.querySelector<HTMLInputElement>('[data-mayoria]');
  const faltaLaEdad = () => Boolean(mayoria && !mayoria.checked);
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
      const edad = estado.tipo === 'lista' && faltaLaEdad();
      boton.textContent = edad ? 'Confirma que eres mayor de edad' : estado.texto;
      boton.setAttribute('aria-disabled', String(estado.tipo !== 'lista' || edad));
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
  form.addEventListener('change', () => {
    decir(aviso, undefined);
    pintar();
  });
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const estado = estadoDeLaEleccion(opciones, variantes, elegidas());
    if (estado.tipo === 'falta') {
      form.querySelector<HTMLInputElement>(`input[name="${CSS.escape(estado.opcion)}"]`)?.focus();
      return;
    }
    if (estado.tipo !== 'lista') return;
    if (faltaLaEdad()) {
      mayoria?.focus();
      return;
    }
    const r = agregar(cargar(), estado.variante.id, 1, { mayorDeEdad: Boolean(mayoria) });
    guardar(r.carrito);
    decir(aviso, r.tope ? AVISOS_DE_TOPE[r.tope] : 'Agregado a tu pedido.');
    pintarBarra(r.carrito);
  });
  pintar();
}

interface VarianteDelCatalogo {
  id: string;
  opciones: string;
  precioCop: number;
  disponible: boolean;
}
interface ProductoConVariantes extends ProductoDelCatalogo {
  variantes: VarianteDelCatalogo[];
}
let catalogo: Promise<{ productos: ProductoConVariantes[] }> | undefined;
const leerCatalogo = () => {
  catalogo ??= fetch('/catalogo.json').then((r) => r.json());
  return catalogo;
};

/** `/pedido/`: las líneas del carrito, sus cantidades y el subtotal que se ve en la tienda. */
async function pedido(): Promise<void> {
  const pagina = document.querySelector<HTMLElement>('[data-pedido-pagina]');
  if (!pagina) return;
  const lista = pagina.querySelector<HTMLElement>('[data-lineas]');
  const vacio = pagina.querySelector<HTMLElement>('[data-vacio]');
  const resumen = pagina.querySelector<HTMLElement>('[data-resumen]');
  const aviso = pagina.querySelector<HTMLElement>('[data-aviso-carrito]');
  const codigo = pagina.querySelector<HTMLElement>('[data-codigo]');
  if (!lista || !vacio || !resumen) return;
  const { productos } = await leerCatalogo();
  const porVariante = new Map(
    productos.flatMap((p) => p.variantes.map((v) => [v.id, { producto: p, variante: v }] as const)),
  );
  let carrito = cargar();
  // Lo que ya no se vende sale del pedido, diciéndolo; con un cobro en pantalla, nada cambia.
  const saneado = sanear(
    carrito,
    new Map([...porVariante].map(([id, x]) => [id, x.variante.disponible ? null : 0])),
  );
  carrito = saneado.carrito;
  guardar(carrito);
  const avisos = [
    ...(avisoAlLeer ? [AVISOS_AL_LEER[avisoAlLeer]] : []),
    ...(saneado.cambios.length > 0
      ? [
          `${saneado.cambios.length === 1 ? 'Un producto ya no está disponible y salió' : `${saneado.cambios.length} productos ya no están disponibles y salieron`} de tu pedido.`,
        ]
      : []),
  ];
  decir(aviso ?? null, avisos.join(' ') || undefined);

  const pintar = () => {
    lista.replaceChildren(
      ...carrito.lineas.map((l) => {
        const x = porVariante.get(l.variante);
        const li = document.createElement('li');
        li.className = 'linea';
        const nombre = document.createElement('a');
        nombre.className = 'linea__nombre';
        nombre.href = x ? new URL(x.producto.url).pathname : '/';
        nombre.textContent = x ? x.producto.nombre : 'Producto';
        const detalle = document.createElement('span');
        detalle.className = 'linea__detalle';
        detalle.textContent = x
          ? [x.variante.opciones.replaceAll('|', ' · '), formato(x.variante.precioCop)]
              .filter(Boolean)
              .join(' — ')
          : '';
        const cantidad = document.createElement('span');
        cantidad.className = 'linea__cantidad';
        const menos = document.createElement('button');
        menos.type = 'button';
        menos.textContent = '−';
        menos.setAttribute('aria-label', 'Una unidad menos');
        const n = document.createElement('output');
        n.textContent = String(l.cantidad);
        const mas = document.createElement('button');
        mas.type = 'button';
        mas.textContent = '+';
        mas.setAttribute('aria-label', 'Una unidad más');
        mas.disabled = l.cantidad >= TOPES.unidadesPorLinea;
        menos.addEventListener('click', () => {
          carrito = cambiarCantidad(carrito, l.variante, l.cantidad - 1);
          guardar(carrito);
          pintar();
        });
        mas.addEventListener('click', () => {
          carrito = cambiarCantidad(carrito, l.variante, l.cantidad + 1);
          guardar(carrito);
          pintar();
        });
        cantidad.append(menos, n, mas);
        li.append(nombre, detalle, cantidad);
        return li;
      }),
    );
    const vacioAhora = carrito.lineas.length === 0;
    vacio.hidden = !vacioAhora;
    resumen.hidden = vacioAhora;
    if (codigo) {
      codigo.textContent = carrito.codigo;
      codigo.closest<HTMLElement>('[data-codigo-bloque]')?.removeAttribute('hidden');
    }
    // Lo que la tienda dice mientras el servidor confirma: el mismo cálculo, con sus precios.
    const subtotal = carrito.lineas.reduce(
      (s, l) => s + (porVariante.get(l.variante)?.variante.precioCop ?? 0) * l.cantidad,
      0,
    );
    poner('[data-subtotal]', formato(subtotal));
    poner('[data-total]', formato(subtotal));
    totalVisto = subtotal;
    pintarBarra(carrito);
    if (!vacioAhora) programarCotizacion();
  };
  const poner = (selector: string, texto: string) => {
    const campo = resumen.querySelector<HTMLElement>(selector);
    if (campo) campo.textContent = texto;
  };

  /**
   * HU-T5.5: el servidor recalcula con los precios y las existencias de la base. Lo que corrige se
   * aplica diciéndolo (nunca con un cobro en pantalla), y un total distinto del que se vio pide
   * revisarlo: nunca sigue en silencio (CA2 y CA3).
   */
  let totalVisto = 0;
  let espera: ReturnType<typeof setTimeout> | undefined;
  const programarCotizacion = () => {
    clearTimeout(espera);
    espera = setTimeout(() => void confirmar(), 300);
  };
  const confirmar = async () => {
    const r = await cotizarEnLaTienda(carrito, totalVisto);
    const nota = resumen.querySelector<HTMLElement>('[data-nota]');
    const alerta = resumen.querySelector<HTMLElement>('[data-aviso-total]');
    if (!r) {
      decir(nota, 'No pudimos confirmar el total ahora. Lo confirmamos antes de enviar tu pedido.');
      return;
    }
    decir(nota, 'El envío se confirma antes de enviar el pedido.');
    const corregido = r.carrito.map((x) => ({
      ...x,
      ...(carrito.lineas.find((l) => l.variante === x.variante)?.mayorDeEdad
        ? { mayorDeEdad: true as const }
        : {}),
    }));
    const cambiaron =
      JSON.stringify(corregido.map((l) => [l.variante, l.cantidad])) !==
      JSON.stringify(carrito.lineas.map((l) => [l.variante, l.cantidad]));
    if (cambiaron && !carrito.cobro) {
      carrito = { ...carrito, lineas: corregido };
      guardar(carrito);
      decir(aviso ?? null, 'Ajustamos tu pedido con lo que la tienda tiene disponible.');
      pintar();
      // Lo corregido ya es lo que dijo el servidor: no hace falta preguntar otra vez.
      clearTimeout(espera);
    }
    poner('[data-subtotal]', formato(r.subtotal));
    poner('[data-total]', formato(r.total));
    decir(
      alerta,
      r.cambio
        ? `El total cambió: ahora es ${formato(r.total)}. Revísalo antes de enviar tu pedido.`
        : undefined,
    );
    totalVisto = r.total;
  };
  pintar();
}

interface Cotizacion {
  subtotal: number;
  total: number;
  carrito: { variante: string; cantidad: number }[];
  cambio: boolean;
}

/** `POST /api/v1/cotizar`; `null` si no responde o no se pudo (la página sigue con lo que sabe). */
async function cotizarEnLaTienda(c: Carrito, totalVisto: number): Promise<Cotizacion | null> {
  try {
    const r = await fetch('/api/v1/cotizar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lineas: c.lineas.map((l) => ({ variante: l.variante, cantidad: l.cantidad })),
        totalVisto,
      }),
    });
    return r.ok ? ((await r.json()) as Cotizacion) : null;
  } catch {
    return null;
  }
}

async function busqueda(): Promise<void> {
  const form = document.querySelector<HTMLFormElement>('[data-buscar]');
  const lista = document.querySelector<HTMLElement>('[data-resultados]');
  const vacio = document.querySelector<HTMLElement>('[data-sin-resultados]');
  if (!form || !lista || !vacio) return;
  // El catálogo se carga una vez al abrir la página; escribir no pide nada al servidor (CA3).
  const { productos } = await leerCatalogo();
  const campo = form.querySelector<HTMLInputElement>('input[type="search"]');
  const pintar = () => {
    const q = campo?.value ?? '';
    const hallados = buscar(productos, q);
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
pintarBarra(cargar());
void pedido();
void busqueda();
