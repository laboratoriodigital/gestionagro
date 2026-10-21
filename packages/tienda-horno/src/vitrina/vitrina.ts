/**
 * La isla de la vitrina (HU-T3.4, HU-T5.3 y HU-T5.4): el único JavaScript de una tienda, servido
 * desde `/_t/<release>/vitrina.js` (CSP `script-src 'self'`). Mejora lo que ya se lee sin él:
 *
 * - en la ficha, la elección de la variante (`seleccion.ts`): el precio, lo agotado tachado y el
 *   botón que dice qué falta y, al tocarlo, lleva al campo; la edad, si el producto la pide;
 * - el carrito (`carrito.ts`) en el `localStorage` de la tienda, con su código y sus topes, y la
 *   barra del pedido, que aparece cuando hay algo en él;
 * - en `/carrito/`, las líneas, el total que confirma el servidor y el envío por WhatsApp
 *   (`venta.ts`); en `/pedido/`, el acuse y el estado con el enlace de seguimiento;
 * - en `/solicitud/`, radicar una solicitud y seguirla con su enlace (HU-T6.4);
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
  carritoVacio,
  codigoNuevo,
  conSecreto,
  esSecreto,
  leerCarrito,
  sanear,
  secretoNuevo,
  TOPES,
  type Tope,
  unidades,
  vaciar,
} from './carrito.ts';
import { iniciarConsentimiento, medirCompra } from './consentimiento.ts';
import { contar } from './medicion.ts';
import {
  estadoDeLaEleccion,
  type OpcionDeLaFicha,
  type VarianteDeLaFicha,
  valorAgotado,
} from './seleccion.ts';
import {
  estadoDeLaSolicitud,
  estadoDeLaVenta,
  faltaDeLaEntrega,
  leerFragmento,
  leerRadicado,
  vueltaDelPago,
} from './venta.ts';

const azar = (n: number) => crypto.getRandomValues(new Uint8Array(n));
/** Las variantes por las que este teléfono ya pidió «Avísame» (HU-T6.5). */
const CLAVE_AVISAME = 'tienda:avisame';

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
  barra.hidden = cantidad === 0 || location.pathname === '/carrito/';
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
  const leidos = JSON.parse(datos.textContent ?? '{}') as {
    opciones: OpcionDeLaFicha[];
    variantes: VarianteDeLaFicha[];
  };
  const opciones = leidos.opciones;
  // La única combinación de un producto sin opciones llega sin `clave`: es `''` (ver leerCatalogo).
  const variantes = leidos.variantes.map((v) => ({ ...v, clave: v.clave ?? '' }));
  contar('ver_producto');
  const boton = form.querySelector<HTMLButtonElement>('[data-boton]');
  const precio = document.querySelector<HTMLElement>('[data-precio]');
  const antes = document.querySelector<HTMLElement>('[data-antes]');
  const quedan = document.querySelector<HTMLElement>('[data-quedan]');
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
      // El precio de antes, de la combinación elegida, si bajó.
      const a = estado.variante.precioAntesCop;
      if (antes) {
        antes.hidden = !a;
        const tachado = antes.querySelector('s');
        if (tachado) tachado.textContent = a ? formato(a) : '';
      }
    }
    // HU-T5.9: la combinación con su foto la muestra; sin foto propia, la galería queda como está.
    if (
      (estado.tipo === 'lista' || estado.tipo === 'agotada') &&
      typeof estado.variante.foto === 'number'
    )
      mostrarFoto(estado.variante.foto);
    // «Quedan 2»: solo de la combinación elegida y si se puede pedir.
    if (quedan) {
      const q = estado.tipo === 'lista' ? estado.variante.quedan : undefined;
      quedan.hidden = !q;
      quedan.textContent = q ? (q === 1 ? 'Queda 1' : `Quedan ${q}`) : '';
    }
    if (avisame) avisame.hidden = estado.tipo !== 'agotada';
    if (estado.tipo === 'agotada') pintarAvisame(estado.variante.id);
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
  // HU-T6.5: «Avísame cuando haya». El teléfono recuerda por cuáles ya se preguntó, así nadie suma
  // dos veces la misma (bitácora tienda3 11); a la tienda no le llega ningún dato de la persona.
  const botonAvisame = form.querySelector<HTMLButtonElement>('[data-avisame-boton]');
  const estadoAvisame = form.querySelector<HTMLElement>('[data-avisame-estado]');
  const pedidas = (): string[] => {
    try {
      const x = JSON.parse(almacen.leer(CLAVE_AVISAME) ?? '[]') as unknown;
      return Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  };
  let agotadaActual = '';
  const pintarAvisame = (variante: string) => {
    agotadaActual = variante;
    const ya = pedidas().includes(variante);
    if (botonAvisame) botonAvisame.hidden = ya;
    decir(
      estadoAvisame,
      ya ? 'Ya le dijiste a la tienda que esperas esta combinación.' : undefined,
    );
  };
  botonAvisame?.addEventListener('click', async () => {
    const variante = agotadaActual;
    botonAvisame.disabled = true;
    try {
      const r = await fetch('/api/v1/avisame', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variante }),
      });
      if (r.ok || r.status === 409) {
        almacen.escribir(CLAVE_AVISAME, JSON.stringify([...pedidas(), variante].slice(-50)));
        pintarAvisame(variante);
        if (r.ok) decir(estadoAvisame, 'Listo: la tienda sabe que esperas esta combinación.');
        else decir(estadoAvisame, 'Esta combinación ya está disponible: recarga la página.');
      } else {
        decir(estadoAvisame, 'No pudimos avisarle a la tienda. Intenta de nuevo en un minuto.');
      }
    } catch {
      decir(estadoAvisame, 'No pudimos avisarle a la tienda. Revisa tu conexión.');
    } finally {
      botonAvisame.disabled = false;
    }
  });

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
    if (!r.tope) contar('agregar_al_carrito');
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
/**
 * El horno no escribe los textos vacíos (`jsonEstable`): la única combinación de un producto sin
 * opciones llega sin `opciones` (validación del 20 oct 2026). Aquí vuelve a ser `''`.
 */
const leerCatalogo = () => {
  catalogo ??= fetch('/catalogo.json')
    .then((r) => r.json() as Promise<{ productos: ProductoConVariantes[] }>)
    .then((c) => ({
      ...c,
      productos: c.productos.map((p) => ({
        ...p,
        variantes: p.variantes.map((v) => ({ ...v, opciones: v.opciones ?? '' })),
      })),
    }));
  return catalogo;
};

/**
 * `/carrito/` (HU-T5.4, HU-T5.5 y HU-T6.1): las líneas del carrito, sus cantidades, el total que
 * confirma el servidor y el envío del pedido por WhatsApp.
 */
async function carritoPagina(): Promise<void> {
  const pagina = document.querySelector<HTMLElement>('[data-pedido-pagina]');
  if (!pagina) return;
  const lista = pagina.querySelector<HTMLElement>('[data-lineas]');
  const vacio = pagina.querySelector<HTMLElement>('[data-vacio]');
  const resumen = pagina.querySelector<HTMLElement>('[data-resumen]');
  const aviso = pagina.querySelector<HTMLElement>('[data-aviso-carrito]');
  const codigo = pagina.querySelector<HTMLElement>('[data-codigo]');
  const vaciarBoton = pagina.querySelector<HTMLButtonElement>('[data-vaciar]');
  const venta = pagina.querySelector<HTMLFormElement>('[data-venta]');
  const datosDeVenta = JSON.parse(document.getElementById('venta')?.textContent ?? '{}') as {
    envios?: { id: string }[];
    terminos?: string;
    enLinea?: boolean;
  };
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

  const poner = (selector: string, texto: string) => {
    const campo = resumen.querySelector<HTMLElement>(selector);
    if (campo) campo.textContent = texto;
  };
  const elegido = (nombre: string) =>
    venta?.querySelector<HTMLInputElement>(`input[name="${nombre}"]:checked`)?.value ?? null;
  const hayEnvios = (datosDeVenta.envios ?? []).length > 0;

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
    if (vaciarBoton) vaciarBoton.hidden = vacioAhora;
    resumen.hidden = vacioAhora;
    if (venta) venta.hidden = vacioAhora;
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
    pintarBoton();
    if (!vacioAhora) programarCotizacion();
  };

  /**
   * HU-T5.5: el servidor recalcula con los precios y las existencias de la base, y con el envío
   * elegido. Lo que corrige se aplica diciéndolo (nunca con un cobro en pantalla), y un total
   * distinto del que se vio pide revisarlo: nunca sigue en silencio (CA2 y CA3).
   */
  let totalVisto = 0;
  let espera: ReturnType<typeof setTimeout> | undefined;
  const programarCotizacion = () => {
    clearTimeout(espera);
    espera = setTimeout(() => void confirmar(), 300);
  };
  const aplicar = (r: Cotizacion) => {
    const alerta = resumen.querySelector<HTMLElement>('[data-aviso-total]');
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
    poner('[data-envio]', formato(r.envio));
    poner('[data-descuento]', `-${formato(r.descuento)}`);
    resumen
      .querySelector<HTMLElement>('[data-fila-envio]')
      ?.toggleAttribute('hidden', !elegido('envio'));
    resumen
      .querySelector<HTMLElement>('[data-fila-descuento]')
      ?.toggleAttribute('hidden', r.descuento === 0);
    poner('[data-total]', formato(r.total));
    decir(
      alerta,
      r.cambio
        ? `El total cambió: ahora es ${formato(r.total)}. Revísalo antes de enviar tu pedido.`
        : undefined,
    );
    totalVisto = r.total;
  };
  const confirmar = async () => {
    const pedido = carrito;
    const r = await cotizarEnLaTienda(carrito, totalVisto, elegido('envio'));
    // Bitácora tienda3 44: una respuesta que llega después de vaciar o cambiar el pedido es de otro
    // pedido; aplicarla devolvería lo que el comprador ya quitó.
    if (
      carrito.codigo !== pedido.codigo ||
      JSON.stringify(carrito.lineas) !== JSON.stringify(pedido.lineas)
    )
      return;
    const nota = resumen.querySelector<HTMLElement>('[data-nota]');
    if (!r) {
      decir(nota, 'No pudimos confirmar el total ahora. Lo confirmamos antes de enviar tu pedido.');
      return;
    }
    decir(nota, elegido('envio') ? undefined : 'El envío se confirma antes de enviar el pedido.');
    aplicar(r);
  };

  // HU-T6.1: enviar el pedido. El botón dice lo primero que falta; al tocarlo, lleva a ese campo.
  const boton = venta?.querySelector<HTMLButtonElement>('[data-enviar]');
  const avisoVenta = venta?.querySelector<HTMLElement>('[data-aviso-venta]') ?? null;
  const acepta = venta?.querySelector<HTMLInputElement>('[data-acepta]');
  const valorDe = (nombre: string) =>
    venta?.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)?.value.trim() ?? '';
  const entrega = () => ({ nombre: valorDe('nombre'), celular: valorDe('celular') });
  const estado = () =>
    estadoDeLaVenta({
      lineas: carrito.lineas.length,
      forma: elegido('forma'),
      hayEnvios,
      envio: elegido('envio'),
      acepta: Boolean(acepta?.checked),
      entrega: faltaDeLaEntrega(entrega()) === null,
    });
  // HU-T11.4: pagando en línea se piden los datos de entrega y la nota dice dónde se paga.
  const pintarForma = () => {
    const enLinea = elegido('forma') === 'en_linea';
    venta?.querySelector<HTMLElement>('[data-entrega]')?.toggleAttribute('hidden', !enLinea);
    venta?.querySelector<HTMLElement>('[data-nota-venta]')?.toggleAttribute('hidden', enLinea);
    venta?.querySelector<HTMLElement>('[data-nota-en-linea]')?.toggleAttribute('hidden', !enLinea);
  };
  const pintarBoton = () => {
    if (!boton) return;
    const e = estado();
    boton.textContent = e.texto;
    boton.setAttribute('aria-disabled', String(!e.listo));
  };
  venta?.addEventListener('change', (evento) => {
    decir(avisoVenta, undefined);
    pintarForma();
    pintarBoton();
    if ((evento.target as HTMLInputElement | null)?.name === 'envio') programarCotizacion();
  });
  venta?.addEventListener('input', pintarBoton);

  /**
   * HU-T11.4: pagar en línea. El servidor escribe el pedido, el cobro y los apartados en un lote y
   * devuelve el botón de Bold firmado. Aquí queda solo el token del cobro, en `sessionStorage`
   * (CA2): ni el nombre, ni el celular, ni la dirección. Antes de abrir Bold, la página deja el
   * enlace de seguimiento a la vista y en el `localStorage` de la tienda (HU-T11.9 CA1).
   */
  const pagarEnLinea = async () => {
    contar('iniciar_pedido');
    carrito = conSecreto(carrito, azar);
    guardar(carrito);
    let token = sesion.leer(CLAVE_DEL_COBRO);
    if (!token || !/^[A-Za-z0-9_-]{22}$/.test(token)) {
      token = secretoNuevo(azar);
      sesion.escribir(CLAVE_DEL_COBRO, token);
    }
    const opcional = (nombre: string) => (valorDe(nombre) ? { [nombre]: valorDe(nombre) } : {});
    const pedir = async () => {
      const respuesta = await fetch('/api/v1/cobros', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          codigo: carrito.codigo,
          lineas: carrito.lineas,
          ...(elegido('envio') ? { envio: elegido('envio') } : {}),
          ...(ciudad() ? { ciudad: ciudad() } : {}),
          acepta: true,
          terminos: datosDeVenta.terminos,
          seguimiento: carrito.seguimiento,
          totalVisto,
          token,
          entrega: { ...entrega(), ...opcional('direccion'), ...opcional('correo') },
        }),
      });
      return {
        r: respuesta,
        cuerpo: (await respuesta.json().catch(() => ({}))) as RespuestaDeCobro,
      };
    };
    let r: Response;
    let cuerpo: RespuestaDeCobro;
    try {
      ({ r, cuerpo } = await pedir());
      // El pago de este código ya se cerró sin pagarse, u otro pedido tiene el código: el carrito
      // toma otro código y otro token, y lo intenta una vez más (el pedido viejo queda por pagar).
      if (r.status === 409 && (cuerpo.estado === 'renovar' || cuerpo.estado === 'codigo-en-uso')) {
        carrito = { v: 1, codigo: codigoNuevo(azar), lineas: carrito.lineas };
        carrito = conSecreto(carrito, azar);
        guardar(carrito);
        token = secretoNuevo(azar);
        sesion.escribir(CLAVE_DEL_COBRO, token);
        if (codigo) codigo.textContent = carrito.codigo;
        ({ r, cuerpo } = await pedir());
      }
    } catch {
      decir(avisoVenta, 'No pudimos iniciar el pago. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    if (!r.ok || !cuerpo.boton || !cuerpo.codigo || !carrito.seguimiento) {
      if (cuerpo.estado === 'cambio' && cuerpo.cotizacion) {
        aplicar({ ...cuerpo.cotizacion, cambio: true });
        decir(avisoVenta, 'Tu pedido cambió. Revisa el total antes de pagar.');
        return;
      }
      if (cuerpo.estado === 'sin-existencias') programarCotizacion();
      decir(
        avisoVenta,
        MOTIVOS_DEL_PEDIDO[cuerpo.estado ?? ''] ??
          cuerpo.motivo ??
          'No pudimos iniciar el pago. Intenta de nuevo.',
      );
      return;
    }
    // Desde aquí hay un cobro en pantalla: el carrito no se sanea (bitácora ecommerce 47).
    const enlace = `/pedido/#c=${cuerpo.codigo}&s=${carrito.seguimiento}`;
    carrito = { ...carrito, cobro: carrito.cobro ?? new Date().toISOString() };
    guardar(carrito);
    almacen.escribir(CLAVE_ULTIMO, JSON.stringify({ codigo: cuerpo.codigo, enlace }));
    const bloque = venta?.querySelector<HTMLElement>('[data-enlace-del-pago]');
    const a = bloque?.querySelector<HTMLAnchorElement>('[data-enlace-del-pedido]');
    if (bloque && a) {
      const completo = new URL(enlace, location.href).href;
      a.href = enlace;
      a.textContent = completo;
      // HU-T11.9 CA1: guardarlo, copiándolo o mandándoselo por WhatsApp a sí mismo.
      const whatsapp = bloque.querySelector<HTMLAnchorElement>('[data-enlace-whatsapp]');
      if (whatsapp) {
        whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`Mi pedido ${cuerpo.codigo}: ${completo}`)}`;
      }
      const copiar = bloque.querySelector<HTMLButtonElement>('[data-copiar-enlace]');
      if (copiar) {
        copiar.onclick = () => {
          navigator.clipboard?.writeText(completo).then(
            () => {
              copiar.textContent = 'Copiado';
            },
            () => {
              copiar.textContent = 'Mantén presionado el enlace para copiarlo';
            },
          );
        };
      }
      bloque.hidden = false;
    }
    try {
      await abrirBold(cuerpo.boton);
      contar('pagar_en_linea');
    } catch {
      decir(
        avisoVenta,
        'No pudimos abrir la página de pago de Bold. Toca «Pagar en línea» otra vez.',
      );
    }
  };
  const ciudad = () => valorDe('ciudad');
  let enviando = false;
  venta?.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const e = estado();
    if (!e.listo) {
      const campo =
        e.falta === 'acepta'
          ? acepta
          : venta.querySelector<HTMLInputElement>(
              `input[name="${e.falta === 'entrega' ? faltaDeLaEntrega(entrega()) : e.falta}"]`,
            );
      campo?.focus();
      decir(avisoVenta, e.texto);
      return;
    }
    if (enviando) return;
    enviando = true;
    boton?.setAttribute('aria-busy', 'true');
    if (elegido('forma') === 'en_linea') {
      try {
        await pagarEnLinea();
      } finally {
        enviando = false;
        boton?.removeAttribute('aria-busy');
      }
      return;
    }
    try {
      carrito = conSecreto(carrito, azar);
      guardar(carrito);
      const enviar = () =>
        fetch('/api/v1/pedidos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            codigo: carrito.codigo,
            lineas: carrito.lineas,
            forma: elegido('forma'),
            ...(elegido('envio') ? { envio: elegido('envio') } : {}),
            ...(ciudad() ? { ciudad: ciudad() } : {}),
            acepta: true,
            terminos: datosDeVenta.terminos,
            seguimiento: carrito.seguimiento,
            totalVisto,
          }),
        });
      let r = await enviar();
      let cuerpo = (await r.json().catch(() => ({}))) as RespuestaDePedido;
      if (r.status === 409 && cuerpo.estado === 'codigo-en-uso') {
        // Otro pedido de la tienda ya tiene este código: uno nuevo, una sola vez.
        carrito = { ...carrito, codigo: carritoVacio(azar).codigo };
        guardar(carrito);
        r = await enviar();
        cuerpo = (await r.json().catch(() => ({}))) as RespuestaDePedido;
      }
      if (r.ok && cuerpo.codigo && carrito.seguimiento) {
        const secreto = carrito.seguimiento;
        almacen.escribir(
          CLAVE_ULTIMO,
          JSON.stringify({
            codigo: cuerpo.codigo,
            texto: cuerpo.texto,
            whatsapp: cuerpo.whatsapp,
          }),
        );
        carrito = vaciar(azar);
        guardar(carrito);
        contar('iniciar_pedido');
        // HU-T14.4: la compra, con su código, solo si el comprador aceptó medir.
        medirCompra(cuerpo.codigo, totalVisto);
        location.assign(`/pedido/#c=${cuerpo.codigo}&s=${secreto}`);
        return;
      }
      if (cuerpo.estado === 'cambio' && cuerpo.cotizacion) {
        aplicar({ ...cuerpo.cotizacion, cambio: true });
        decir(avisoVenta, 'Tu pedido cambió. Revisa el total y vuelve a enviarlo.');
      } else {
        decir(
          avisoVenta,
          MOTIVOS_DEL_PEDIDO[cuerpo.estado ?? ''] ??
            cuerpo.motivo ??
            'No pudimos enviar tu pedido. Intenta de nuevo.',
        );
      }
    } catch {
      decir(avisoVenta, 'No pudimos enviar tu pedido. Revisa tu conexión e intenta de nuevo.');
    } finally {
      enviando = false;
      boton?.removeAttribute('aria-busy');
    }
  });
  // Vaciar el pedido: otro código y otro token. Un pedido ya registrado con el código anterior
  // queda en la tienda, por pagar, y se sigue con su enlace.
  vaciarBoton?.addEventListener('click', () => {
    if (!window.confirm('¿Vaciar tu pedido? Se quitan todos los productos.')) return;
    carrito = vaciar(azar);
    guardar(carrito);
    sesion.escribir(CLAVE_DEL_COBRO, '');
    decir(avisoVenta, undefined);
    const enlaceDelPago = venta?.querySelector<HTMLElement>('[data-enlace-del-pago]');
    if (enlaceDelPago) enlaceDelPago.hidden = true;
    pintar();
  });
  pintarForma();
  pintar();
}

interface RespuestaDePedido {
  estado?: string;
  motivo?: string;
  codigo?: string;
  texto?: string;
  whatsapp?: string | null;
  cotizacion?: Cotizacion;
}
const MOTIVOS_DEL_PEDIDO: Record<string, string> = {
  terminos: 'La tienda cambió sus términos. Recarga la página para verlos antes de enviar.',
  cerrada: 'La tienda no está recibiendo pedidos en este momento.',
  limite: 'Son muchos pedidos seguidos. Espera un minuto e intenta de nuevo.',
};
/** El último pedido enviado desde este teléfono: el texto para WhatsApp del acuse (HU-T6.2). */
const CLAVE_ULTIMO = 'tienda:ultimo';
/** El token opaco del cobro en curso (HU-T11.4 CA2): lo único que guarda la página al pagar. */
const CLAVE_DEL_COBRO = 'tienda:cobro';

/** `sessionStorage`, que puede no existir: entonces cada intento lleva un token nuevo. */
const sesion = {
  leer(clave: string): string | null {
    try {
      return sessionStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  escribir(clave: string, valor: string): void {
    try {
      sessionStorage.setItem(clave, valor);
    } catch {
      // Sin almacenamiento, el reintento crea otro cobro: el servidor lo dice.
    }
  },
  borrar(clave: string): void {
    try {
      sessionStorage.removeItem(clave);
    } catch {
      // Nada que borrar.
    }
  },
};

interface RespuestaDeCobro {
  estado?: string;
  motivo?: string;
  codigo?: string;
  cotizacion?: Cotizacion;
  boton?: { libreria: string; checkout: Record<string, string> };
}

declare global {
  interface Window {
    BoldCheckout?: new (datos: Record<string, string>) => { open: () => void };
  }
}

/**
 * Carga el programa de Bold solo al pagar (la CSP de `/carrito/` lo permite, y solo de
 * `checkout.bold.co`) y abre el pago embebido con los datos que firmó el servidor, tal cual.
 */
async function abrirBold(boton: { libreria: string; checkout: Record<string, string> }) {
  if (!/^https:\/\/checkout\.bold\.co\//.test(boton.libreria)) throw new Error('No es Bold');
  if (!window.BoldCheckout) {
    await new Promise<void>((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = boton.libreria;
      s.async = true;
      s.onload = () => resolver();
      s.onerror = () => rechazar(new Error('No cargó Bold'));
      document.head.append(s);
    });
  }
  const Checkout = window.BoldCheckout;
  if (!Checkout) throw new Error('No cargó Bold');
  new Checkout(boton.checkout).open();
}

/**
 * La vuelta de Bold (HU-T11.4 y HU-T11.9). Lo que Bold pone en la dirección no se lee: la página
 * pregunta por su cobro con el token de esta sesión (`POST /api/v1/cobros/estado`), y la respuesta
 * decide qué pasa con el carrito y si va al pedido con el enlace que guardó antes de pagar. Sin
 * token (volvió en otro navegador) explica cómo encontrar el pedido, sin mostrar un error.
 */
async function alVolverDelPago(): Promise<void> {
  const raiz = document.querySelector<HTMLElement>('[data-vuelta-del-pago]');
  if (!raiz) return;
  let ultimo: { codigo?: string; enlace?: string } = {};
  try {
    ultimo = JSON.parse(almacen.leer(CLAVE_ULTIMO) ?? '{}') as typeof ultimo;
  } catch {
    ultimo = {};
  }
  const token = sesion.leer(CLAVE_DEL_COBRO);
  let estado: string | null = null;
  let pedido: string | null = null;
  if (token && esSecreto(token)) {
    try {
      const r = await fetch('/api/v1/cobros/estado', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as { estado?: string; pedido?: string };
      if (r.ok && cuerpo.estado) {
        estado = cuerpo.estado;
        pedido = cuerpo.pedido ?? null;
      }
    } catch {
      estado = null;
    }
  }
  const enlace =
    ultimo.enlace &&
    leerFragmento(ultimo.enlace.replace(/^[^#]*/, '')) &&
    (pedido === null || ultimo.codigo === pedido)
      ? ultimo.enlace
      : null;
  const v = vueltaDelPago(estado, enlace !== null);
  if (v.carrito === 'vaciar') {
    contar('pago_confirmado');
    const codigo = pedido ?? ultimo.codigo;
    if (codigo) medirCompra(codigo);
    guardar(vaciar(azar));
    sesion.borrar(CLAVE_DEL_COBRO);
  } else if (v.carrito === 'renovar') {
    // El pedido de ese pago queda como estaba; el próximo intento es otro pedido, con otro token.
    const c = cargar();
    guardar({ v: 1, codigo: codigoNuevo(azar), lineas: c.lineas });
    sesion.borrar(CLAVE_DEL_COBRO);
  }
  const a = raiz.querySelector<HTMLAnchorElement>('[data-vuelta-enlace]');
  if (a && enlace) {
    a.href = enlace;
    a.hidden = false;
  }
  const aviso = raiz.querySelector<HTMLElement>('[data-vuelta-aviso]');
  if (aviso && v.texto) {
    aviso.textContent = v.texto;
    aviso.hidden = false;
  }
  const alCarrito = raiz.querySelector<HTMLElement>('[data-vuelta-carrito]');
  if (alCarrito) alCarrito.hidden = v.carrito !== 'renovar';
  if (v.irAlPedido && enlace) location.replace(enlace);
}

interface Cotizacion {
  subtotal: number;
  descuento: number;
  envio: number;
  total: number;
  carrito: { variante: string; cantidad: number }[];
  cambio: boolean;
}

/** `POST /api/v1/cotizar`; `null` si no responde o no se pudo (la página sigue con lo que sabe). */
async function cotizarEnLaTienda(
  c: Carrito,
  totalVisto: number,
  envio: string | null,
): Promise<Cotizacion | null> {
  try {
    const r = await fetch('/api/v1/cotizar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        lineas: c.lineas.map((l) => ({ variante: l.variante, cantidad: l.cantidad })),
        totalVisto,
        ...(envio ? { envio } : {}),
      }),
    });
    return r.ok ? ((await r.json()) as Cotizacion) : null;
  } catch {
    return null;
  }
}

interface Seguimiento {
  codigo: string;
  numero: number;
  enPalabras: string;
  pasos: { enPalabras: string; instante: string }[];
  lineas: { nombre: string; opciones: string; cantidad: number; total: number }[];
  total: number;
  envioNombre: string | null;
  plazo: string | null;
  forma: string;
  transportadora: string | null;
  guia: string | null;
}

/**
 * `/pedido/#c=…&s=…` (HU-T6.2 y HU-T6.3): el acuse y el estado. El secreto viene en el fragmento,
 * que no llega a ningún servidor, y se pregunta por POST. Desde el teléfono que hizo el pedido,
 * además, el botón para mandarlo por WhatsApp.
 */
async function pedidoEnviado(): Promise<void> {
  const raiz = document.querySelector<HTMLElement>('[data-seguimiento]');
  if (!raiz) return;
  const enlace = leerFragmento(location.hash);
  const acuse = raiz.querySelector<HTMLElement>('[data-acuse]');
  const vacio = raiz.querySelector<HTMLElement>('[data-seguimiento-vacio]');
  const aviso = raiz.querySelector<HTMLElement>('[data-seguimiento-aviso]');
  if (!enlace || !acuse) return;
  const poner = (selector: string, texto: string) => {
    const campo = raiz.querySelector<HTMLElement>(selector);
    if (campo) campo.textContent = texto;
  };
  if (vacio) vacio.hidden = true;
  let ultimo: { codigo?: string; texto?: string; whatsapp?: string | null } = {};
  try {
    ultimo = JSON.parse(almacen.leer(CLAVE_ULTIMO) ?? '{}') as typeof ultimo;
  } catch {
    ultimo = {};
  }
  const whatsapp = raiz.querySelector<HTMLAnchorElement>('[data-acuse-whatsapp]');
  if (whatsapp && ultimo.codigo === enlace.codigo && ultimo.texto && ultimo.whatsapp) {
    whatsapp.href = `https://wa.me/${ultimo.whatsapp}?text=${encodeURIComponent(ultimo.texto)}`;
    whatsapp.hidden = false;
  }
  const propio = raiz.querySelector<HTMLAnchorElement>('[data-acuse-enlace]');
  if (propio) {
    propio.href = location.href;
    propio.textContent = location.href;
  }
  raiz.querySelector('[data-imprimir]')?.addEventListener('click', () => window.print());
  let s: Seguimiento | null = null;
  try {
    const r = await fetch('/api/v1/seguimiento', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(enlace),
    });
    s = r.ok ? ((await r.json()) as Seguimiento) : null;
  } catch {
    s = null;
  }
  if (!s) {
    decir(
      aviso,
      'No encontramos un pedido con ese enlace, o no pudimos consultarlo ahora. Revisa el enlace e intenta de nuevo.',
    );
    if (ultimo.codigo === enlace.codigo) {
      acuse.hidden = false;
      poner('[data-acuse-codigo]', enlace.codigo);
      poner('[data-acuse-estado]', 'no lo pudimos consultar ahora');
    }
    return;
  }
  acuse.hidden = false;
  poner('[data-acuse-codigo]', s.codigo);
  poner('[data-acuse-numero]', `#${s.numero}`);
  poner('[data-acuse-estado]', s.enPalabras);
  poner('[data-acuse-total]', formato(s.total));
  poner('[data-acuse-forma]', s.forma);
  poner(
    '[data-acuse-plazo]',
    [s.envioNombre, s.plazo].filter(Boolean).join(': ') ||
      'La tienda te confirma el envío y su plazo.',
  );
  if (s.guia) poner('[data-acuse-guia]', [s.transportadora, s.guia].filter(Boolean).join(' · '));
  raiz.querySelector('[data-acuse-lineas]')?.replaceChildren(
    ...s.lineas.map((l) => {
      const li = document.createElement('li');
      li.className = 'linea';
      li.textContent = `${l.cantidad} × ${l.nombre}${l.opciones ? ` (${l.opciones})` : ''} — ${formato(l.total)}`;
      return li;
    }),
  );
  raiz.querySelector('[data-acuse-pasos]')?.replaceChildren(
    ...s.pasos.map((p) => {
      const li = document.createElement('li');
      li.textContent = `${p.enPalabras} · ${new Date(p.instante).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}`;
      return li;
    }),
  );
}

interface Radicado {
  radicado: string;
  numero?: number;
  tipo: string;
  creada: string;
  vence: string;
  enPalabras?: string;
}

const MOTIVOS_DE_LA_SOLICITUD: Record<string, string> = {
  limite: 'Son muchas solicitudes seguidas. Espera un minuto e intenta de nuevo.',
  'sin-configurar':
    'La tienda no puede recibir solicitudes aquí en este momento. Escríbele por el correo o el WhatsApp de arriba.',
};
/** El secreto de la solicitud que se está enviando: si se reenvía, es la misma (`duplicada`). */
const CLAVE_SOLICITUD = 'tienda:solicitud';

/** `AAAA-MM-DD` dicho en palabras, sin pasar por la zona horaria del teléfono. */
const fechaEnPalabras = (dia: string) =>
  new Date(`${dia}T12:00:00Z`).toLocaleDateString('es-CO', {
    dateStyle: 'long',
    timeZone: 'UTC',
  });

/**
 * `/solicitud/` (HU-T6.4): radicar y seguir. El secreto del enlace nace aquí y solo viaja en el
 * cuerpo del POST y en el fragmento, que no llega a ningún servidor; la API guarda su huella.
 */
async function solicitudPagina(): Promise<void> {
  const raiz = document.querySelector<HTMLElement>('[data-solicitud]');
  if (!raiz) return;
  const form = raiz.querySelector<HTMLFormElement>('[data-solicitud-form]');
  const acuse = raiz.querySelector<HTMLElement>('[data-radicado]');
  const aviso = raiz.querySelector<HTMLElement>('[data-solicitud-aviso]');
  const boton = raiz.querySelector<HTMLButtonElement>('[data-solicitud-enviar]');
  if (!form || !acuse) return;
  const poner = (selector: string, texto: string) => {
    const campo = raiz.querySelector<HTMLElement>(selector);
    if (campo) campo.textContent = texto;
  };
  raiz.querySelector('[data-imprimir]')?.addEventListener('click', () => window.print());
  const mostrar = (r: Radicado, suEnlace: string) => {
    form.hidden = true;
    acuse.hidden = false;
    poner('[data-radicado-numero]', r.radicado);
    poner('[data-radicado-estado]', r.enPalabras ?? 'Recibida: la tienda la va a revisar');
    poner('[data-radicado-tipo]', r.tipo);
    poner(
      '[data-radicado-creada]',
      new Date(r.creada).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }),
    );
    poner('[data-radicado-vence]', fechaEnPalabras(r.vence));
    const a = raiz.querySelector<HTMLAnchorElement>('[data-radicado-enlace]');
    if (a) {
      a.href = suEnlace;
      a.textContent = suEnlace;
    }
  };

  // Con el enlace: en qué va.
  const enlace = leerRadicado(location.hash);
  if (enlace) {
    try {
      const r = await fetch('/api/v1/solicitudes/seguimiento', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(enlace),
      });
      if (r.ok) {
        mostrar((await r.json()) as Radicado, location.href);
        return;
      }
    } catch {
      // Abajo: el formulario, con el aviso.
    }
    decir(
      aviso,
      'No encontramos una solicitud con ese enlace, o no pudimos consultarla ahora. Revisa el enlace e intenta de nuevo.',
    );
  }

  // Sin enlace: el formulario.
  form.hidden = false;
  const valor = (nombre: string) =>
    form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      `[name="${nombre}"]`,
    )?.value ?? '';
  const acepta = form.querySelector<HTMLInputElement>('[data-acepta]');
  const estado = () =>
    estadoDeLaSolicitud({
      tipo: valor('tipo'),
      texto: valor('texto'),
      contacto: valor('contacto'),
      acepta: Boolean(acepta?.checked),
    });
  const pintarBoton = () => {
    if (!boton) return;
    const e = estado();
    boton.textContent = e.texto;
    boton.setAttribute('aria-disabled', String(!e.listo));
  };
  form.addEventListener('input', () => {
    decir(aviso, undefined);
    pintarBoton();
  });
  form.addEventListener('change', pintarBoton);
  let enviando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const e = estado();
    if (!e.listo) {
      form
        .querySelector<HTMLElement>(e.falta === 'acepta' ? '[data-acepta]' : `[name="${e.falta}"]`)
        ?.focus();
      decir(aviso, e.texto);
      return;
    }
    if (enviando) return;
    enviando = true;
    boton?.setAttribute('aria-busy', 'true');
    // El mismo secreto mientras no se radique: tocar dos veces o recargar no abre otra.
    const secreto = almacen.leer(CLAVE_SOLICITUD) ?? secretoNuevo(azar);
    almacen.escribir(CLAVE_SOLICITUD, secreto);
    try {
      const pedido = valor('pedido').trim();
      const r = await fetch('/api/v1/solicitudes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tipo: valor('tipo'),
          ...(pedido ? { pedido } : {}),
          texto: valor('texto'),
          contacto: valor('contacto'),
          acepta: true,
          seguimiento: secreto,
        }),
      });
      const cuerpo = (await r.json().catch(() => ({}))) as Partial<Radicado> & {
        estado?: string;
      };
      if (r.ok && cuerpo.radicado && cuerpo.numero) {
        almacen.borrar(CLAVE_SOLICITUD);
        const propio = `${location.origin}${location.pathname}#r=${cuerpo.numero}&s=${secreto}`;
        history.replaceState(null, '', propio);
        mostrar(cuerpo as Radicado, propio);
        acuse.querySelector<HTMLElement>('[data-radicado-numero]')?.focus();
        return;
      }
      decir(
        aviso,
        MOTIVOS_DE_LA_SOLICITUD[cuerpo.estado ?? ''] ??
          (r.status === 422
            ? 'Revisa los datos: el código de pedido tiene 6 letras y números, y el texto, al menos 10 letras.'
            : 'No pudimos enviar tu solicitud. Intenta de nuevo.'),
      );
    } catch {
      decir(aviso, 'No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.');
    } finally {
      enviando = false;
      boton?.removeAttribute('aria-busy');
    }
  });
  pintarBoton();
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
/**
 * Las fotos de la ficha (validación del 20 oct 2026): tocar una miniatura muestra esa foto, y pasar
 * con el dedo marca la miniatura de la que se ve. Sin JavaScript, las miniaturas son enlaces.
 */
const marcarMiniatura = (i: number) => {
  for (const [j, m] of document.querySelectorAll<HTMLAnchorElement>('[data-miniatura]').entries()) {
    if (j === i) m.setAttribute('aria-current', 'true');
    else m.removeAttribute('aria-current');
  }
};
/** Muestra la foto `i` de la galería de la ficha: la tocada o la de la combinación elegida (HU-T5.9). */
function mostrarFoto(i: number): void {
  const fotos = document.querySelector<HTMLElement>('[data-fotos]');
  if (!fotos) return;
  fotos.scrollTo({ left: i * fotos.clientWidth, behavior: 'smooth' });
  marcarMiniatura(i);
}
function galeria(): void {
  const fotos = document.querySelector<HTMLElement>('[data-fotos]');
  const minis = [...document.querySelectorAll<HTMLAnchorElement>('[data-miniatura]')];
  if (!fotos || minis.length === 0) return;
  const marcar = marcarMiniatura;
  for (const m of minis) {
    m.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarFoto(Number(m.dataset['miniatura'] ?? 0));
    });
  }
  fotos.addEventListener(
    'scroll',
    () => marcar(Math.round(fotos.scrollLeft / Math.max(1, fotos.clientWidth))),
    { passive: true },
  );
}

/** HU-T5.8 CA3: «Compartir» abre el menú del teléfono si lo tiene; si no, sigue su enlace de WhatsApp. */
function compartir(): void {
  const a = document.querySelector<HTMLAnchorElement>('[data-compartir]');
  if (!a || typeof navigator.share !== 'function') return;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    navigator
      .share({
        title: a.dataset['compartirTitulo'] ?? document.title,
        url: a.dataset['compartir'] ?? location.href,
      })
      .catch(() => undefined);
  });
}

/**
 * HU-T5.12 CA2: «Ordenar por» ordena las tarjetas que muestra la página. Recomendado es el orden en
 * que vienen (lo destacado primero, después el del comercio).
 */
function ordenarListas(): void {
  for (const control of document.querySelectorAll<HTMLElement>('[data-ordenar]')) {
    const lista = control.nextElementSibling;
    const select = control.querySelector('select');
    if (!(lista instanceof HTMLElement) || !select) continue;
    control.hidden = false;
    select.addEventListener('change', () => {
      const tarjetas = [...lista.querySelectorAll<HTMLElement>(':scope > .tarjeta')];
      const n = (t: HTMLElement, k: string) => Number(t.dataset[k] ?? 0);
      const comparar: Record<string, (a: HTMLElement, b: HTMLElement) => number> = {
        recomendado: (a, b) => n(a, 'orden') - n(b, 'orden'),
        nombre: (a, b) =>
          (a.dataset['nombre'] ?? '').localeCompare(b.dataset['nombre'] ?? '', 'es'),
        menor: (a, b) => n(a, 'precio') - n(b, 'precio') || n(a, 'orden') - n(b, 'orden'),
        mayor: (a, b) => n(b, 'precio') - n(a, 'precio') || n(a, 'orden') - n(b, 'orden'),
        // Lo marcado como nuevo primero, y después lo cambiado más recién.
        nuevo: (a, b) =>
          Number('nuevo' in b.dataset) - Number('nuevo' in a.dataset) ||
          (b.dataset['fecha'] ?? '').localeCompare(a.dataset['fecha'] ?? ''),
      };
      const orden = comparar[select.value] ?? comparar['recomendado'];
      for (const t of tarjetas.sort(orden)) lista.append(t);
    });
  }
}

galeria();
compartir();
ordenarListas();
iniciarConsentimiento();
void carritoPagina();
void pedidoEnviado();
void alVolverDelPago();
void solicitudPagina();
void busqueda();
