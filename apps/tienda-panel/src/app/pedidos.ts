/**
 * La bandeja de pedidos sin la pantalla (HU-T9.1): los filtros, que trabajan sobre lo que ya llegó
 * sin pedir nada a la red (CA1), y el turno de las lecturas, para que una respuesta vieja nunca
 * pise a la nueva (CA3). Puras, para probarlas sin navegador.
 *
 * Despachar (HU-T9.4): lo que el formulario revisa antes de mandar, con todos sus errores juntos.
 */
import { pesos } from './catalogo.ts';

export interface FilaDePedido {
  id: string;
  numero: number;
  estado: string;
  formaPago: string;
  totalCop: number;
  creado: string;
  ciudad: string | null;
  articulos: number;
  atencion: string | null;
  /** Ya viene tapado de la API: «María F.», «300 ••• 4567». */
  comprador: { nombre: string | null; celular: string | null } | null;
  version: number;
}

export interface PaginaDePedidos {
  atencion: FilaDePedido[];
  pedidos: FilaDePedido[];
  siguiente: string | null;
}

export const FORMAS_DE_PAGO: Readonly<Record<string, string>> = {
  a_convenir: 'A convenir',
  en_linea: 'En línea',
  contraentrega: 'Contra entrega',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
};

/** Lo que necesita atención, en palabras (`pedido.atencion`). */
export const ATENCION: Readonly<Record<string, string>> = {
  sin_existencias: 'Se pagó, pero ya no hay existencias',
  monto: 'Cobro a revisar: el monto no cuadra',
  datos: 'Faltan datos para despachar',
};

export interface Filtros {
  estado: string;
  forma: string;
  texto: string;
}

const sinTildes = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Los pedidos que pasan los filtros. El texto busca en el número («1045» o «#1045») y en lo que
 * se ve del comprador, sin importar tildes ni mayúsculas.
 */
export function filtrar(pedidos: readonly FilaDePedido[], f: Filtros): FilaDePedido[] {
  const texto = sinTildes(f.texto.trim().replace(/^#/, ''));
  return pedidos.filter((p) => {
    if (f.estado && p.estado !== f.estado) return false;
    if (f.forma && p.formaPago !== f.forma) return false;
    if (!texto) return true;
    const donde = sinTildes(
      [
        String(p.numero),
        p.comprador?.nombre ?? '',
        p.comprador?.celular ?? '',
        p.ciudad ?? '',
      ].join(' '),
    );
    return donde.includes(texto);
  });
}

/**
 * El turno de las lecturas (CA2 y CA3): cada lectura toma uno, y solo la del último turno se
 * pinta. Mientras llega, la pantalla sigue mostrando la lista de antes.
 */
export function crearTurno() {
  let actual = 0;
  return {
    tomar: () => ++actual,
    vigente: (t: number) => t === actual,
  };
}

/** Une una página nueva a lo que ya estaba, sin repetir un pedido si llegó dos veces. */
export function unir(antes: readonly FilaDePedido[], nuevos: readonly FilaDePedido[]) {
  const vistos = new Set(antes.map((p) => p.id));
  return [...antes, ...nuevos.filter((p) => !vistos.has(p.id))];
}

export interface FormularioDeDespacho {
  transportadora: string;
  guia: string;
  comision: string;
  fleteIda: string;
}

export const FALTA_TRANSPORTADORA = 'Falta la transportadora que lleva el paquete.';
export const FALTA_GUIA =
  'Falta la guía: sin ella no se puede seguir la plata de la contraentrega ni el comprador puede rastrear su paquete.';
const EN_PESOS = 'Escribe el valor en pesos, como 12.000, o déjalo vacío.';

/** Pesos opcionales: vacío es «no lo sé todavía» (`null`), nunca 0. */
const pesosOpcionales = (texto: string): number | null | undefined => {
  if (texto.trim() === '') return null;
  const n = pesos(texto);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : undefined;
};

/**
 * HU-T9.4 CA2: contra entrega, la transportadora y la guía son obligatorias, y el panel dice cuál
 * falta. La comisión y el flete, si se escriben, en pesos.
 */
export function revisarDespacho(
  f: FormularioDeDespacho,
  contraentrega: boolean,
): {
  errores: { campo: string; mensaje: string }[];
  cuerpo: {
    transportadora: string;
    guia: string;
    comisionCop?: number | null;
    fleteIdaCop?: number | null;
  };
} {
  const errores: { campo: string; mensaje: string }[] = [];
  if (contraentrega && !f.transportadora.trim())
    errores.push({ campo: 'transportadora', mensaje: FALTA_TRANSPORTADORA });
  if (contraentrega && !f.guia.trim()) errores.push({ campo: 'guia', mensaje: FALTA_GUIA });
  const comision = contraentrega ? pesosOpcionales(f.comision) : null;
  const flete = contraentrega ? pesosOpcionales(f.fleteIda) : null;
  if (comision === undefined) errores.push({ campo: 'comisionCop', mensaje: EN_PESOS });
  if (flete === undefined) errores.push({ campo: 'fleteIdaCop', mensaje: EN_PESOS });
  return {
    errores,
    cuerpo: {
      transportadora: f.transportadora.trim(),
      guia: f.guia.trim(),
      ...(contraentrega ? { comisionCop: comision ?? null, fleteIdaCop: flete ?? null } : {}),
    },
  };
}
