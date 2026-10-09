/**
 * El liquidador de mensualidades (HU-Q11.6) en el navegador: lee el formulario y liquida con
 * `liquidarMensualidad` de `@ed1/parqueadero-tarifas`, la misma cuenta con que la caja cobra una
 * mensualidad (HU-Q8.4, P2). Sin cuenta y sin guardar nada.
 *
 * Eventos (HU-Q11.5 CA2, `@ed1/eventos`): `tool.opened` al abrir, `tool.completed` con el primer
 * cálculo y `tool.next_step` al ir a la caja, en un lote a `/_m`.
 */
import { formatearPesos as $ } from '@ed1/dinero';
import { type Colector, crearColector, entornoDelNavegador } from '@ed1/eventos';
import { juntar } from '@ed1/parqueadero-recibos';
import { NOMBRES_DE_VEHICULO, VEHICULOS, type Vehiculo } from '@ed1/parqueadero-schema';
import {
  type LiquidacionDeMensualidad,
  liquidarMensualidad,
  MensualidadIncompleta,
  type PeriodoLiquidado,
} from '@ed1/parqueadero-tarifas';

/** Bogotá no cambia de hora: UTC−5 todo el año. */
const DESFASE_MS = 5 * 60 * 60 * 1000;

/** El día de hoy en Bogotá, `2026-10-20`, para el campo `date`. */
export const hoyEnBogota = (ms: number): string =>
  new Date(ms - DESFASE_MS).toISOString().slice(0, 10);

/** `20/10/2026`, como se lee en Colombia. */
export const fechaLegible = (f: string): string => f.split('-').reverse().join('/');

/** Pesos enteros escritos con o sin puntos de miles (`300.000`); `NaN` si no lo son. */
export function leerPesos(texto: string): number {
  const limpio = texto.trim().replace(/^\$\s*/, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) return Number(limpio.replaceAll('.', ''));
  return /^\d+$/.test(limpio) ? Number(limpio) : Number.NaN;
}

export interface Pedido {
  readonly vehiculo: Vehiculo;
  readonly valor: number;
  readonly desde: string;
  readonly meses: number;
  readonly hastaFinDeMes: boolean;
}

/** Lo que dice el formulario. */
export function pedidoDelFormulario(campos: (nombre: string) => string): Pedido {
  const vehiculo = (NOMBRES_DE_VEHICULO as readonly string[]).includes(campos('vehiculo'))
    ? (campos('vehiculo') as Vehiculo)
    : 'carro';
  const meses = campos('meses').trim();
  return {
    vehiculo,
    valor: leerPesos(campos('valor')),
    desde: campos('desde'),
    meses: /^\d{1,2}$/.test(meses) ? Number(meses) : meses === '' ? 0 : Number.NaN,
    hastaFinDeMes: campos('cobrar') !== 'meses',
  };
}

/** La línea que explica un periodo: el mes entero, o la cuenta de sus días (CA1). */
export function detalleDelPeriodo(p: PeriodoLiquidado, valorDelMes: number): string {
  if (p.dias >= p.diasDelMes) return `Mes completo: ${p.dias} días.`;
  const cuenta = `${$(valorDelMes)} × ${p.dias} ÷ ${p.diasDelMes} = ${$(p.exacto)}`;
  return p.exacto === p.valor
    ? `${p.dias} de ${p.diasDelMes} días: ${cuenta}.`
    : `${p.dias} de ${p.diasDelMes} días: ${cuenta}, hacia abajo a la centena.`;
}

/** Lo que vale un día de ese mes, para leerlo de un vistazo. */
export const valorPorDia = (p: PeriodoLiquidado, valorDelMes: number): number =>
  Math.floor(valorDelMes / p.diasDelMes);

function pintar(documento: Document, pedido: Pedido, l: LiquidacionDeMensualidad): void {
  const $id = (id: string) => documento.getElementById(id) as HTMLElement;
  $id('total-mensualidad').textContent = $(l.total);
  $id('de-que').textContent =
    `${VEHICULOS[pedido.vehiculo].nombre}, mensualidad de ${$(pedido.valor)}, desde el ${fechaLegible(pedido.desde)}.`;
  const lista = $id('periodos');
  lista.replaceChildren(
    ...l.periodos.map((p) => {
      const li = documento.createElement('li');
      const fila = documento.createElement('div');
      fila.className = 'periodo-fila';
      const fechas = documento.createElement('span');
      fechas.textContent = `${fechaLegible(p.desde)} a ${fechaLegible(p.hasta)}`;
      const valor = documento.createElement('strong');
      valor.textContent = $(p.valor);
      fila.append(fechas, valor);
      const detalle = documento.createElement('p');
      detalle.className = 'periodo-detalle';
      detalle.textContent =
        p.dias >= p.diasDelMes
          ? detalleDelPeriodo(p, pedido.valor)
          : `${detalleDelPeriodo(p, pedido.valor)} Cada día de ese mes vale ${$(valorPorDia(p, pedido.valor))}.`;
      li.append(fila, detalle);
      return li;
    }),
  );
}

export function iniciarLiquidador(documento: Document, ahora: () => number = Date.now): Colector {
  const $id = <T extends HTMLElement>(id: string) => documento.getElementById(id) as T;
  const form = $id<HTMLFormElement>('liquidador');
  // La página dice su producto (`contenido.ts`): el código no carga el texto del sitio.
  const colector = crearColector({
    producto: form.dataset['producto'] ?? '',
    endpoint: '/_m',
    entorno: entornoDelNavegador(),
  });
  colector.registrar('tool.opened');
  const campo = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement;
  const valor = (n: string) => campo(n)?.value ?? '';
  const resultado = $id<HTMLElement>('resultado');
  const faltan = $id<HTMLElement>('faltan');
  const ayudaMeses = $id<HTMLElement>('ayuda-meses');
  let calculos = 0;

  if (!valor('desde')) campo('desde').value = hoyEnBogota(ahora());
  const decirMeses = () => {
    ayudaMeses.textContent =
      valor('cobrar') === 'meses'
        ? 'Cuántos meses desde la fecha de inicio: 1 o más.'
        : 'Los meses completos que se pagan después de fin de mes: 0 si solo se cobra este mes.';
  };
  campo('cobrar').addEventListener('change', decirMeses);
  decirMeses();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pedido = pedidoDelFormulario(valor);
    let l: LiquidacionDeMensualidad;
    try {
      l = liquidarMensualidad(pedido.valor, pedido.desde, pedido);
    } catch (error) {
      if (!(error instanceof MensualidadIncompleta)) throw error;
      faltan.textContent = `Para calcular falta ${juntar(error.faltan)}.`;
      faltan.hidden = false;
      resultado.hidden = true;
      return;
    }
    faltan.hidden = true;
    pintar(documento, pedido, l);
    resultado.hidden = false;
    if (calculos++ === 0) colector.registrar('tool.completed');
    // El foco va al resultado: quien usa lector de pantalla oye el total.
    $id<HTMLElement>('titulo-resultado').focus();
  });

  $id<HTMLAnchorElement>('ir-a-la-caja').addEventListener('click', () =>
    colector.registrar('tool.next_step'),
  );
  return colector;
}
