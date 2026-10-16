/**
 * La bandeja de pedidos sin la pantalla (HU-T9.1): los filtros, que trabajan sobre lo que ya llegó
 * sin pedir nada a la red (CA1), y el turno de las lecturas, para que una respuesta vieja nunca
 * pise a la nueva (CA3). Puras, para probarlas sin navegador.
 *
 * Despachar (HU-T9.4) y anotar un pedido (HU-T9.6): lo que cada formulario revisa antes de
 * mandar, con todos sus errores juntos.
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
  /** Desde cuándo está pagado sin existencias; el plazo de 15 días cuenta desde aquí (HU-T11.7). */
  atencionDesde: string | null;
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
  sin_existencias: 'Pagado sin existencias',
  monto: 'Cobro a revisar: el monto no cuadra',
  datos: 'Faltan datos para despachar',
};

/** Días calendario para reponer o devolver el dinero de un pedido pagado sin existencias. */
export const DIAS_PARA_RESOLVER = 15;
const DIA_MS = 86_400_000;
/** El día del calendario de Bogotá (UTC−5, sin horario de verano) de un instante. */
const diaDeBogota = (t: number) => Math.floor((t - 5 * 3_600_000) / DIA_MS);

/**
 * HU-T11.7 CA2: el reloj de un pedido pagado sin existencias, en días calendario de Bogotá desde
 * el pago. Cuando el plazo pasa, lo sigue diciendo: un pago sin entregar no se olvida.
 */
export function plazoSinExistencias(desde: string, ahora: number): string {
  const quedan = DIAS_PARA_RESOLVER - (diaDeBogota(ahora) - diaDeBogota(Date.parse(desde)));
  if (quedan > 1) return `quedan ${quedan} días para reponer o devolver el dinero`;
  if (quedan === 1) return 'queda 1 día para reponer o devolver el dinero';
  if (quedan === 0) return 'hoy es el último día para reponer o devolver el dinero';
  return `el plazo para reponer o devolver el dinero venció hace ${quedan === -1 ? '1 día' : `${-quedan} días`}`;
}

/** Lo que necesita atención, en palabras, con el reloj si está pagado sin existencias. */
export function textoDeAtencion(
  p: Pick<FilaDePedido, 'atencion' | 'atencionDesde'>,
  ahora: number,
): string {
  const texto = ATENCION[p.atencion ?? ''] ?? p.atencion ?? '';
  return p.atencion === 'sin_existencias' && p.atencionDesde
    ? `${texto}: ${plazoSinExistencias(p.atencionDesde, ahora)}`
    : texto;
}

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

/** HU-T9.6: las formas de pago de un pedido anotado; en línea pide el link de pago. */
export const FORMAS_ANOTADAS = [
  'a_convenir',
  'contraentrega',
  'transferencia',
  'efectivo',
] as const;

export interface FormularioDeAnotado {
  /** Cuántas de cada combinación, como texto del campo; vacío es ninguna. */
  cantidades: Record<string, string>;
  formaPago: string;
  envio: string;
  nombre: string;
  celular: string;
  direccion: string;
  ciudad: string;
  notas: string;
}

/**
 * HU-T9.6 CA1: lo que revisa «Anotar el pedido». Al menos una combinación, cantidades enteras,
 * la forma de pago y el envío en pesos; los datos del comprador son opcionales y van solo si hay.
 */
export function revisarAnotado(f: FormularioDeAnotado): {
  errores: { campo: string; mensaje: string }[];
  cuerpo: {
    lineas: { variante: string; cantidad: number }[];
    formaPago: string;
    envioCop: number;
    ciudad?: string;
    contacto?: Record<string, string>;
  };
} {
  const errores: { campo: string; mensaje: string }[] = [];
  const lineas: { variante: string; cantidad: number }[] = [];
  for (const [variante, texto] of Object.entries(f.cantidades)) {
    if (texto.trim() === '') continue;
    const n = Number(texto.trim());
    if (!Number.isInteger(n) || n < 0 || n > 999)
      errores.push({ campo: `cantidad-${variante}`, mensaje: 'Escribe cuántas, de 1 a 999.' });
    else if (n > 0) lineas.push({ variante, cantidad: n });
  }
  if (lineas.length === 0 && errores.length === 0)
    errores.push({ campo: 'productos', mensaje: 'Escribe cuántas lleva de al menos un producto.' });
  if (!(FORMAS_ANOTADAS as readonly string[]).includes(f.formaPago))
    errores.push({ campo: 'formaPago', mensaje: 'Elige cómo paga.' });
  const envio = f.envio.trim() === '' ? 0 : pesos(f.envio);
  if (envio === null || !Number.isInteger(envio) || envio < 0)
    errores.push({
      campo: 'envio',
      mensaje: 'Escribe el envío en pesos, como 8.000, o déjalo vacío.',
    });
  const contacto = Object.fromEntries(
    (['nombre', 'celular', 'direccion', 'ciudad', 'notas'] as const)
      .map((k) => [k, f[k].trim()] as const)
      .filter(([, v]) => v !== ''),
  );
  return {
    errores,
    cuerpo: {
      lineas,
      formaPago: f.formaPago,
      envioCop: envio ?? 0,
      ...(contacto['ciudad'] ? { ciudad: contacto['ciudad'] } : {}),
      ...(Object.keys(contacto).length ? { contacto } : {}),
    },
  };
}
