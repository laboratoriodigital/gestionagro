/**
 * La calculadora de precios de tiendapro.co (HU-P5.2, sprint PF3): a cuánto vender para que te
 * quede lo que esperas, con la comisión de Bold y el envío. Corre en el navegador y no guarda nada
 * (CA2): ni una cookie ni el `localStorage`. La cuenta es la de `@ed1/dinero`. Sin este script, la
 * página dice cómo se calcula.
 */
import { formatearPesos, precioParaGanar } from '@ed1/dinero';
import { COMISIONES_DE_BOLD, IVA_DE_LA_COMISION } from '@ed1/tienda-schema/comisiones';

const form = document.querySelector<HTMLFormElement>('[data-calculadora]');
const salida = document.querySelector<HTMLElement>('[data-resultado]');

/** «45.000», «45000» o «$ 45.000», en pesos enteros; lo demás no se lee. */
const pesosDe = (texto: string): number | null => {
  const limpio = texto.replace(/[$\s.]/g, '');
  return /^\d{1,9}$/.test(limpio) ? Number(limpio) : null;
};

const poner = (selector: string, texto: string) => {
  const nodo = salida?.querySelector<HTMLElement>(selector);
  if (nodo) nodo.textContent = texto;
};

function calcular() {
  if (!form || !salida) return;
  const valor = (nombre: string) =>
    (form.elements.namedItem(nombre) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '';
  const aviso = form.querySelector<HTMLElement>('[data-aviso]');
  const costo = pesosDe(valor('costo'));
  const envio = valor('envio').trim() === '' ? 0 : pesosDe(valor('envio'));
  const ganancia = Number(valor('ganancia'));
  if (costo === null || costo === 0 || envio === null || !Number.isSafeInteger(ganancia)) {
    salida.hidden = true;
    if (aviso) {
      // Con el costo vacío todavía no hay nada que decir.
      aviso.hidden = valor('costo').trim() === '';
      aviso.textContent = 'Escribe el costo y el envío en pesos, sin centavos.';
    }
    return;
  }
  if (aviso) aviso.hidden = true;
  const medio = COMISIONES_DE_BOLD.find((c) => c.id === valor('medio'));
  const r = precioParaGanar({
    costoCop: costo,
    gananciaPct: Math.min(1000, Math.max(0, ganancia)),
    envioCop: envio,
    comision: medio ?? { centesimas: 0, fijoCop: null },
    ivaPct: IVA_DE_LA_COMISION,
  });
  poner('[data-precio]', formatearPesos(r.precioCop));
  poner('[data-comision]', medio ? formatearPesos(r.comisionCop) : 'Nada: no pasa por Bold');
  poner('[data-envio]', formatearPesos(envio));
  poner('[data-ganancia]', formatearPesos(r.gananciaCop));
  poner('[data-margen]', `${r.margenPct} % del precio`);
  salida.hidden = false;
}

form?.addEventListener('input', calcular);
form?.addEventListener('change', calcular);
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  calcular();
});
calcular();
