/**
 * El tablero de Inicio sin la pantalla (HU-T14.2): la comparación con el mes anterior en palabras,
 * lo pendiente en orden de urgencia y el margen de la contraentrega. Puras, para probarlas sin
 * navegador; las cifras las calcula la API.
 */

export interface Cifras {
  pedidos: number;
  vendidos: number;
  ventasCop: number;
  ticketCop: number | null;
  tasaDeCierre: number | null;
}

export interface Tablero {
  periodos: { altura: string; anteriorCompleto: boolean };
  hoy: Cifras;
  mes: Cifras;
  anterior: Cifras;
  pendientes: {
    porConfirmar: number;
    porDespachar: number;
    recaudosAtrasados: number;
    solicitudesPorVencer: number;
    solicitudesVencidas: number;
    pagosSinExistencias: number;
    cobrosARevisar: number;
    agotados: number;
    /** HU-P2.2: en su mínimo o por debajo, sin estar agotadas. */
    porAgotarse?: number;
  };
  contraentrega: {
    cerrados: number;
    devueltos: number;
    cobradoCop: number;
    costosCop: number;
    netoCop: number;
    sinCostos: number;
    enCamino: number;
  };
  /** HU-T14.6: la última semana, los pedidos y pagos de la base frente a la medición. */
  cuadre?: {
    semana: string;
    pedidos: { base: number; eventos: number };
    pagos: { base: number; eventos: number };
  } | null;
}

/**
 * HU-T14.6 CA1: la diferencia, en los dos sentidos y en palabras. Las ventas no salen de aquí.
 * Más en la base: compradores que la medición no alcanza a contar; más en la medición: intentos
 * que no terminaron en pedido.
 */
export function cuadreEnPalabras(
  cosa: 'pedidos' | 'pagos',
  c: { base: number; eventos: number },
): string {
  const nombre = (n: number) =>
    cosa === 'pedidos'
      ? n === 1
        ? '1 pedido'
        : `${n} pedidos`
      : n === 1
        ? '1 pago'
        : `${n} pagos`;
  if (c.base === c.eventos) return `Cuadran: ${nombre(c.base)} en tu tienda y en tus métricas.`;
  if (c.base > c.eventos)
    return `${nombre(c.base)} en tu tienda y ${c.eventos} en tus métricas: ${nombre(c.base - c.eventos)} sin medir, de compradores que bloquean la medición o cierran la página muy rápido.`;
  return `${nombre(c.base)} en tu tienda y ${c.eventos} en tus métricas: ${c.eventos - c.base} de más en tus métricas, intentos que no terminaron.`;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «febrero hasta el 29» o, si hoy no existe en ese mes, «febrero entero» (CA3: dicho, no escondido). */
export function mesAnteriorEnPalabras(p: Tablero['periodos']): string {
  const [, mes, dia] = p.altura.split('-').map(Number) as [number, number, number];
  const nombre = MESES[mes - 1] ?? '';
  return p.anteriorCompleto ? `${nombre} entero` : `${nombre} hasta el ${dia}`;
}

/** «Sube 12 %», «Baja 5 %», «Igual»; sin nada antes, no hay contra qué comparar. */
export function comparacion(
  actual: number,
  anterior: number,
): { texto: string; tono: 'bien' | 'mal' | 'neutro' } {
  if (anterior === 0) return { texto: actual === 0 ? 'Igual' : 'Sin ventas antes', tono: 'neutro' };
  const cambio = Math.round(((actual - anterior) / anterior) * 100);
  if (cambio === 0) return { texto: 'Igual', tono: 'neutro' };
  return cambio > 0
    ? { texto: `Sube ${cambio} %`, tono: 'bien' }
    : { texto: `Baja ${-cambio} %`, tono: 'mal' };
}

export const enPorcentaje = (tasa: number | null) =>
  tasa === null ? 'Sin pedidos' : `${Math.round(tasa * 100)} %`;

const plural = (n: number, uno: string, varios: string) =>
  n === 1 ? `1 ${uno}` : `${n} ${varios}`;

export interface Pendiente {
  clave: keyof Tablero['pendientes'];
  texto: string;
  href: string;
  urgente: boolean;
}

/**
 * Lo que hay que hacer, lo urgente arriba (P15): lo que ya venció o pone en riesgo la plata del
 * comprador va primero y en rojo. Lo que está en cero no se dice.
 */
export function pendientesEnOrden(p: Tablero['pendientes']): Pendiente[] {
  const todos: (Pendiente & { n: number })[] = [
    {
      clave: 'solicitudesVencidas',
      n: p.solicitudesVencidas,
      texto: plural(
        p.solicitudesVencidas,
        'solicitud vencida sin respuesta',
        'solicitudes vencidas sin respuesta',
      ),
      href: '/pedidos/solicitudes/',
      urgente: true,
    },
    {
      clave: 'cobrosARevisar',
      n: p.cobrosARevisar,
      texto: plural(p.cobrosARevisar, 'cobro por revisar', 'cobros por revisar'),
      href: '/pedidos/',
      urgente: true,
    },
    {
      clave: 'pagosSinExistencias',
      n: p.pagosSinExistencias,
      texto: plural(
        p.pagosSinExistencias,
        'pago aprobado sin existencias',
        'pagos aprobados sin existencias',
      ),
      href: '/pedidos/solicitudes/',
      urgente: true,
    },
    {
      clave: 'recaudosAtrasados',
      n: p.recaudosAtrasados,
      texto: plural(
        p.recaudosAtrasados,
        'recaudo sin liquidar hace más de 3 días hábiles',
        'recaudos sin liquidar hace más de 3 días hábiles',
      ),
      href: '/pedidos/recaudos/',
      urgente: true,
    },
    {
      clave: 'solicitudesPorVencer',
      n: p.solicitudesPorVencer,
      texto: plural(p.solicitudesPorVencer, 'solicitud por vencer', 'solicitudes por vencer'),
      href: '/pedidos/solicitudes/',
      urgente: false,
    },
    {
      clave: 'porConfirmar',
      n: p.porConfirmar,
      texto: plural(p.porConfirmar, 'pedido por confirmar', 'pedidos por confirmar'),
      href: '/pedidos/',
      urgente: false,
    },
    {
      clave: 'porDespachar',
      n: p.porDespachar,
      texto: plural(p.porDespachar, 'pedido por despachar', 'pedidos por despachar'),
      href: '/pedidos/',
      urgente: false,
    },
    {
      clave: 'agotados',
      n: p.agotados,
      texto: plural(p.agotados, 'combinación agotada', 'combinaciones agotadas'),
      href: '/productos/inventario/',
      urgente: false,
    },
    {
      clave: 'porAgotarse',
      n: p.porAgotarse ?? 0,
      texto: plural(p.porAgotarse ?? 0, 'combinación por agotarse', 'combinaciones por agotarse'),
      href: '/productos/inventario/',
      urgente: false,
    },
  ];
  return todos.filter((x) => x.n > 0).map(({ n: _n, ...x }) => x);
}

/** El margen de lo cobrado: lo que queda después de la comisión y los fletes; `null` sin cobros. */
export const margen = (c: Tablero['contraentrega']) =>
  c.cobradoCop > 0 ? Math.round((c.netoCop / c.cobradoCop) * 100) : null;
