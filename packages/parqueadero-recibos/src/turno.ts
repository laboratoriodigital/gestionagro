/**
 * El cierre de turno (HU-Q3.9, PARQUEADERO §5.1 Turno y anexo B): lo que se cuenta y el papel a 32
 * columnas. Funciones puras sobre los registros del turno: la caja, el respaldo y M1 cuentan igual.
 * Lo anulado no cuenta como entrada, salida ni dinero; cuenta como anulación (HU-Q3.7 CA2).
 */
import { formatearPesos } from '@ed1/dinero';
import { type Bloque, lineaPar, type PaginaDeCodigos, prepararTexto } from '@ed1/impresion';
import type {
  DatosDeAnulacion,
  DatosDeApertura,
  DatosDeMovimiento,
  DatosDeSalida,
  MedioDePago,
  Registro,
} from '@ed1/parqueadero-schema';
import { entregasDeLosRecibos } from './entregas.ts';
import { partir } from './papel.ts';
import { fechaHora, NOMBRE_DEL_MEDIO } from './recibo.ts';

export interface ResumenDeTurno {
  /** `T-012`. */
  readonly numero: string;
  readonly operador: string;
  readonly abrio: number;
  readonly entradas: number;
  readonly salidas: number;
  readonly anulaciones: number;
  readonly anulacionesPorOperador: Readonly<Record<string, number>>;
  readonly copias: number;
  /** Lo cobrado por medio, sin lo anulado. */
  readonly porMedio: Readonly<Partial<Record<MedioDePago, number>>>;
  readonly base: number;
  readonly ingresos: number;
  readonly gastos: number;
  /** Base + efectivo + ingresos − gastos: lo que debería haber en la caja. */
  readonly esperado: number;
  /** Cada recibo una vez, por el mejor camino que llegó: papel, WhatsApp o pantalla. */
  readonly entregas: {
    readonly recibos: number;
    readonly papel: number;
    readonly whatsapp: number;
    readonly pantalla: number;
    readonly sinEntrega: number;
  };
}

export const numeroDeTurno = (n: number): string => `T-${String(n).padStart(3, '0')}`;

/**
 * Resume un turno a partir de su apertura y de los registros escritos desde entonces. `numero` es
 * el orden de la apertura en esta caja.
 */
export function resumirTurno(
  apertura: Registro,
  registros: readonly Registro[],
  numero: number,
): ResumenDeTurno {
  const ap = apertura.datos as DatosDeApertura;
  const anulaciones = registros.filter((r) => r.tipo === 'anulacion');
  const anulado = new Set(anulaciones.map((a) => a.anula_id));
  const vigentes = (tipo: 'entrada' | 'salida') =>
    registros.filter((r) => r.tipo === tipo && !anulado.has(r.id));
  const entradas = vigentes('entrada');
  const salidas = vigentes('salida');

  const porOperador: Record<string, number> = {};
  for (const a of anulaciones) {
    const op = (a.datos as DatosDeAnulacion).operador;
    porOperador[op] = (porOperador[op] ?? 0) + 1;
  }

  const porMedio: Partial<Record<MedioDePago, number>> = {};
  for (const s of salidas) {
    const d = s.datos as DatosDeSalida;
    porMedio[d.medio_pago] = (porMedio[d.medio_pago] ?? 0) + d.total;
  }

  let ingresos = 0;
  let gastos = 0;
  for (const m of registros) {
    if (m.tipo !== 'movimiento_caja') continue;
    const d = m.datos as DatosDeMovimiento;
    if (d.clase === 'ingreso') ingresos += d.valor;
    else gastos += d.valor;
  }

  // Cada recibo una vez, por el mejor camino que llegó (`entregas.ts`).
  const deLasEntregas = entregasDeLosRecibos(registros);
  const recibos = [...entradas, ...salidas];
  const entregas = { recibos: recibos.length, papel: 0, whatsapp: 0, pantalla: 0, sinEntrega: 0 };
  for (const r of recibos) {
    const canal = deLasEntregas.canalDe(r.id);
    if (canal === 'sin_entrega') entregas.sinEntrega++;
    else entregas[canal]++;
  }
  const copias = deLasEntregas.copias;

  return {
    numero: numeroDeTurno(numero),
    operador: ap.operador,
    abrio: Date.parse(apertura.instante_evento),
    entradas: entradas.length,
    salidas: salidas.length,
    anulaciones: anulaciones.length,
    anulacionesPorOperador: porOperador,
    copias,
    porMedio,
    base: ap.base,
    ingresos,
    gastos,
    esperado: ap.base + (porMedio.efectivo ?? 0) + ingresos - gastos,
    entregas,
  };
}

export interface DatosDelCierre {
  readonly nombreDeLaSede: string;
  readonly serie: string;
  readonly cerro: number;
  readonly abiertas: number;
  readonly contado: number;
  readonly motivo: string | null;
  /** Versión de la caja que imprimió (HU-Q3.9 CA2). */
  readonly version: string;
}

const MEDIOS_DEL_CIERRE: readonly MedioDePago[] = [
  'efectivo',
  'transferencia',
  'datafono',
  'abonado',
  'cortesia',
];

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** El cierre impreso, como la maqueta del anexo B. Ninguna línea pasa de `columnas`. */
export function papelDelCierre(
  r: ResumenDeTurno,
  c: DatosDelCierre,
  o: {
    readonly columnas: number;
    readonly paginaDeCodigos: PaginaDeCodigos;
    readonly desfaseMin?: number;
  },
): Bloque[] {
  const col = o.columnas;
  const $ = formatearPesos;
  const preparar = (t: string) => prepararTexto(t, o.paginaDeCodigos);
  const bloques: Bloque[] = [];
  const texto = (t: string, extra: { alinear?: 'centro'; negrita?: boolean } = {}) => {
    for (const linea of partir(preparar(t), col))
      bloques.push({ tipo: 'texto', texto: linea, ...extra });
  };
  const par = (izquierda: string, derecha: string | number, negrita = false) => {
    for (const linea of lineaPar(preparar(izquierda), preparar(String(derecha)), col)) {
      for (const corta of linea.length <= col ? [linea] : partir(linea, col)) {
        bloques.push({ tipo: 'texto', texto: corta, negrita });
      }
    }
  };
  const regla = () => bloques.push({ tipo: 'regla' });
  const f = (ms: number) => fechaHora(ms, o.desfaseMin);
  const diferencia = c.contado - r.esperado;

  texto(c.nombreDeLaSede.toUpperCase(), { alinear: 'centro', negrita: true });
  par('CIERRE DE TURNO', r.numero, true);
  par(`Caja ${c.serie}`, `Operador: ${r.operador}`);
  par('Abrió', f(r.abrio));
  par('Cerró', f(c.cerro));
  regla();
  par('Entradas', r.entradas);
  par('Salidas', r.salidas);
  par('Abiertas al cierre', c.abiertas);
  par('Anulaciones', r.anulaciones);
  const operadores = Object.entries(r.anulacionesPorOperador);
  // Con un solo operador, el total ya lo dice; con varios, cada uno (HU-Q3.7 CA2).
  if (operadores.length > 1) for (const [op, n] of operadores) par(`  ${op}`, n);
  par('Copias impresas', r.copias);
  regla();
  texto('Por medio de pago');
  const medios = MEDIOS_DEL_CIERRE.filter((m) => r.porMedio[m] !== undefined);
  if (medios.length === 0) texto('Sin cobros');
  for (const m of medios) par(mayuscula(NOMBRE_DEL_MEDIO[m]), $(r.porMedio[m] ?? 0));
  regla();
  par('Base', $(r.base));
  if (r.ingresos > 0) par('Ingresos de caja', $(r.ingresos));
  if (r.gastos > 0) par('Gastos de caja', $(-r.gastos));
  par('Efectivo esperado', $(r.esperado));
  par('Contado', $(c.contado));
  par('Diferencia', $(diferencia), true);
  if (c.motivo) texto(`Motivo: ${c.motivo}`);
  regla();
  const e = r.entregas;
  par('Recibos entregados', e.recibos - e.sinEntrega);
  par('  Papel', e.papel);
  par('  WhatsApp', e.whatsapp);
  par('  Pantalla', e.pantalla);
  if (e.sinEntrega > 0) par('Sin entrega anotada', e.sinEntrega);
  texto(`Papel ahorrado: ${e.recibos - e.papel} recibos`);
  texto(`Caja ${c.version}`, { alinear: 'centro' });
  return bloques;
}
