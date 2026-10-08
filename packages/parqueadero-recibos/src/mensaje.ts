/**
 * El recibo en WhatsApp y en pantalla (PARQUEADERO §6.4 y §6.5). El texto sigue las reglas de
 * `@ed1/whatsapp`: el nombre del negocio sale de la sede, nada de emoji al principio y el enlace
 * solo en su línea. La pantalla muestra lo mismo que el papel, con tildes.
 *
 * Los dos se leen como el papel (HU-Q6.6): el parqueadero arriba, la placa, las horas, la tarifa
 * o la liquidación en grupos y el total. En WhatsApp las filas van en un bloque de ancho fijo
 * (```…```) de `COLUMNAS_WHATSAPP`, alineadas como en la PT-210.
 */
import { formatearPesos } from '@ed1/dinero';
import { lineaPar } from '@ed1/impresion';
import type { LineaDeLiquidacion } from '@ed1/parqueadero-schema';
import { armarTexto } from '@ed1/whatsapp';
import { partir } from './papel.ts';
import {
  conceptoDeLinea,
  fechaHora,
  lineaDelAbono,
  NOMBRE_DEL_MEDIO,
  nombreDelVehiculo,
  type Recibo,
  type SalidaDelRecibo,
  type TarifaDelRecibo,
  TEXTO_LEGAL,
  textoDeResponsabilidad,
} from './recibo.ts';

export type Fila = readonly [string, string];

/**
 * El ancho del bloque de WhatsApp: 26 letras de ancho fijo caben en la burbuja de un teléfono de
 * 360 px con la letra del sistema en grande; 32, como el papel, se partían.
 */
export const COLUMNAS_WHATSAPP = 26;

/** «45 min», «3 h 12 min (192 min)», «2 h (120 min)»: como se dice, y los minutos que se cobran. */
export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${m === 0 ? `${h} h` : `${h} h ${m} min`} (${minutos} min)`;
}

/** La tarifa en filas cortas, que caben en el bloque de WhatsApp. */
export function filasDeTarifa(t: TarifaDelRecibo): Fila[] {
  const $ = formatearPesos;
  const filas: Fila[] = [
    [
      'Tarifa',
      t.modo === 'minuto'
        ? `${$(t.valor)} por minuto`
        : t.modo === 'hora'
          ? `${$(t.valor)} por hora`
          : `${$(t.valor)} cada ${t.fraccion_min} min`,
    ],
  ];
  if (t.gracia_min > 0) filas.push(['Gracia', `${t.gracia_min} min`]);
  if (t.plena) filas.push([`Desde ${t.plena.desde_min + 1} min`, $(t.plena.valor)]);
  if (t.tope_dia !== null) filas.push(['Tope por día', $(t.tope_dia)]);
  if (t.nocturna)
    filas.push([`Noche ${t.nocturna.desde}-${t.nocturna.hasta}`, $(t.nocturna.valor)]);
  if (t.tope_minuto !== null) filas.push(['Tope legal', `${$(t.tope_minuto)}/min`]);
  return filas;
}

/** Cada línea de la liquidación en pocas letras, para el bloque de WhatsApp. */
function conceptoCorto(l: LineaDeLiquidacion): string {
  switch (l.concepto) {
    case 'tiempo':
      return `Por ${l.minutos} min`;
    case 'plena':
      return 'Tarifa plena';
    case 'tope_dia':
      return 'Tope del día';
    case 'nocturna':
      return 'Noche';
    case 'perdido':
      return 'Tiquete perdido';
    case 'gracia':
      return `Gracia (${l.minutos} min)`;
    case 'abonado':
      return `Abonado (${l.minutos} min)`;
  }
}

/** La liquidación como en el papel: antes del tope o la plena, lo que daba el tiempo. */
function filasDeLiquidacion(sa: SalidaDelRecibo, t: TarifaDelRecibo, corto: boolean): Fila[] {
  const $ = formatearPesos;
  const concepto = (l: LineaDeLiquidacion) => (corto ? conceptoCorto(l) : conceptoDeLinea(l, t));
  const filas: Fila[] = [];
  for (const l of sa.lineas) {
    if (l.concepto === 'plena' || l.concepto === 'tope_dia') {
      filas.push([concepto({ ...l, concepto: 'tiempo' }), $(l.base)]);
    }
    filas.push([concepto(l), $(l.valor)]);
  }
  if (sa.redondeo > 0) filas.push(['Redondeo', $(-sa.redondeo)]);
  return filas;
}

/** «Pago en efectivo», «Pago con datáfono»…: la línea bajo el total. */
const PAGO: Readonly<Record<SalidaDelRecibo['medio'], string>> = {
  efectivo: 'Pago en efectivo',
  transferencia: 'Pago por QR o transferencia',
  datafono: 'Pago con datáfono',
  abonado: 'Pago: abonado',
  cortesia: 'Cortesía',
};

/**
 * Lo que escribe la sede no abre ni cierra negrillas, cursivas ni bloques de WhatsApp, y no deja
 * un espacio junto a la marca, que apagaría la negrilla.
 */
const sinMarcas = (t: string): string =>
  t
    .replace(/[*_~`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();

/**
 * Una fila del bloque, como en el papel: la etiqueta a la izquierda y el valor a la derecha, con
 * dos espacios por lo menos. Si no cabe, la etiqueta arriba y el valor debajo, también a la derecha.
 */
function filaDeBloque([etiqueta, valor]: Fila, col: number): string[] {
  const [e, v] = [sinMarcas(etiqueta), sinMarcas(valor)];
  if (e.length + 2 + v.length <= col) return lineaPar(e, v, col);
  return [...partir(e, col), ...partir(v, col).map((l) => l.padStart(col))];
}

/** El mensaje para el conductor, con el enlace completo del recibo (§6.4). */
export function textoWhatsApp(recibo: Recibo, enlace: string, desfaseMin = -300): string {
  const f = (ms: number) => fechaHora(ms, desfaseMin);
  const col = COLUMNAS_WHATSAPP;
  const s = recibo.sede;
  const regla = '-'.repeat(col);
  const bloque: string[] = [];
  const filas = (fs: readonly Fila[]) => {
    for (const x of fs) bloque.push(...filaDeBloque(x, col));
  };

  filas([
    ['Placa', recibo.placa],
    ['Vehículo', nombreDelVehiculo(recibo.vehiculo)],
    ['Entró', f(recibo.entrada)],
  ]);
  let legal: string;
  if (recibo.clase === 'entrada' || !recibo.salida) {
    filas([['Estado', recibo.estado.length ? recibo.estado.join('; ') : 'sin novedad']]);
    bloque.push(regla);
    filas(filasDeTarifa(recibo.tarifa));
    legal = textoDeResponsabilidad(recibo);
  } else {
    const sa = recibo.salida;
    filas([
      ['Salió', f(sa.instante)],
      // «3 h 12 min (192 min)» no cabe en el bloque: los minutos, que son lo que se cobra.
      ['Tiempo', `${sa.minutos} min`],
    ]);
    bloque.push(regla);
    filas(filasDeLiquidacion(sa, recibo.tarifa, true));
    bloque.push(regla);
    filas([
      ['TOTAL', formatearPesos(sa.total)],
      ['Pago', NOMBRE_DEL_MEDIO[sa.medio]],
    ]);
    if (sa.recibido !== null && sa.cambio !== null) {
      filas([
        ['Recibido', formatearPesos(sa.recibido)],
        ['Cambio', formatearPesos(sa.cambio)],
      ]);
    }
    const abono = lineaDelAbono(sa);
    if (abono) bloque.push(...partir(abono, col));
    legal = TEXTO_LEGAL.noFactura;
  }
  if (s.poliza) {
    bloque.push(regla);
    filas([['Póliza', `${s.poliza.aseguradora} ${s.poliza.numero}`]]);
  }

  const clase = recibo.clase === 'entrada' || !recibo.salida ? 'entrada' : 'salida';
  const lineas: string[] = [];
  if (recibo.prueba) lineas.push('*PRUEBA: NO VALE*');
  lineas.push(
    `*${sinMarcas(s.nombre)}*`,
    `NIT ${sinMarcas(s.nit)}`,
    sinMarcas(`${s.direccion}, ${s.ciudad}`),
    `Tel ${sinMarcas(s.telefono)}`,
    '',
    `*Recibo de ${clase} ${recibo.numero}*`,
    // Un solo elemento: `armarTexto` recorta cada línea, y el bloque vive de sus espacios.
    `\`\`\`${bloque.join('\n')}\`\`\``,
    `_${sinMarcas(legal)}_`,
  );
  if (recibo.pie) lineas.push(sinMarcas(recibo.pie));
  lineas.push('', 'Su recibo:', enlace, '', TEXTO_LEGAL.whatsapp);
  return armarTexto(lineas);
}

export interface VistaDeRecibo {
  /** «Recibo de entrada A-000123»: el h1 y el título de la página. */
  readonly titulo: string;
  /** «Recibo de entrada», arriba del número. */
  readonly clase: string;
  readonly numero: string;
  readonly prueba: boolean;
  readonly sede: { readonly nombre: string; readonly datos: readonly string[] };
  readonly placa: string;
  readonly vehiculo: string;
  /** Las filas antes del total, en grupos que la hoja separa con una línea. */
  readonly grupos: readonly (readonly Fila[])[];
  /** El total y cómo se pagó; nulo en la entrada. */
  readonly total: { readonly valor: string; readonly pago: string } | null;
  /** Lo que va después del total: lo recibido y el cambio, el abono, la póliza. */
  readonly cierre: readonly (readonly Fila[])[];
  /** Todas las filas, en el orden de la hoja. */
  readonly filas: readonly Fila[];
  readonly legal: readonly string[];
}

/** Lo que muestra la pantalla del recibo y la página `/r/`, como una hoja (§6.5, HU-Q6.6). */
export function pantalla(recibo: Recibo, desfaseMin = -300): VistaDeRecibo {
  const f = (ms: number) => fechaHora(ms, desfaseMin);
  const $ = formatearPesos;
  const s = recibo.sede;
  const grupos: Fila[][] = [];
  const cierre: Fila[][] = [];
  let total: VistaDeRecibo['total'] = null;
  if (recibo.clase === 'entrada' || !recibo.salida) {
    grupos.push(
      [
        ['Entró', f(recibo.entrada)],
        ['Estado', recibo.estado.length ? recibo.estado.join('; ') : 'sin novedad'],
      ],
      filasDeTarifa(recibo.tarifa),
    );
  } else {
    const sa = recibo.salida;
    grupos.push(
      [
        ['Entró', f(recibo.entrada)],
        ['Salió', f(sa.instante)],
        ['Tiempo', duracion(sa.minutos)],
        ['Recibo de entrada', sa.entradaNumero],
      ],
      filasDeLiquidacion(sa, recibo.tarifa, false),
    );
    total = { valor: $(sa.total), pago: PAGO[sa.medio] };
    const vuelto: Fila[] = [];
    if (sa.recibido !== null && sa.cambio !== null) {
      vuelto.push(['Recibido', $(sa.recibido)], ['Cambio', $(sa.cambio)]);
    }
    const abono = lineaDelAbono(sa);
    if (abono) vuelto.push(['Abono', abono]);
    if (vuelto.length > 0) cierre.push(vuelto);
  }
  if (s.poliza) cierre.push([['Póliza', `${s.poliza.aseguradora} ${s.poliza.numero}`]]);
  const clase = `Recibo de ${recibo.clase}`;
  return {
    titulo: `${clase} ${recibo.numero}`,
    clase,
    numero: recibo.numero,
    prueba: recibo.prueba,
    sede: {
      nombre: s.nombre,
      datos: [`NIT ${s.nit}`, `${s.direccion}, ${s.ciudad}`, `Tel ${s.telefono}`],
    },
    placa: recibo.placa,
    vehiculo: nombreDelVehiculo(recibo.vehiculo),
    grupos,
    total,
    cierre,
    filas: [...grupos, ...cierre].flat(),
    legal: [
      recibo.clase === 'entrada' ? textoDeResponsabilidad(recibo) : TEXTO_LEGAL.noFactura,
      ...(recibo.pie ? [recibo.pie] : []),
    ],
  };
}
