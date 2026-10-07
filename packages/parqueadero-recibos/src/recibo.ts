/**
 * El modelo `Recibo` (PARQUEADERO §6.1): lo arma `armarRecibo` del registro y de los catálogos
 * vigentes en ese instante, y las cuatro salidas salen de él y de nada más (ADR-33). Así el papel,
 * el enlace, el WhatsApp y la pantalla no pueden decir cosas distintas (§6.6).
 *
 * Lo que el parqueadero no llenó no se imprime vacío: sin los datos legales de la sede no hay
 * recibo (HU-Q3.2), y ningún campo tiene un valor de fábrica (bitácora ecommerce, «el celular de
 * la primera tienda»).
 */
import { formatearPesos } from '@ed1/dinero';
import {
  type AjusteRecibo,
  type DatosDeEntrada,
  type DatosDeSalida,
  type LineaDeLiquidacion,
  type MedioDePago,
  numeroDeRecibo,
  type Registro,
  type Sede,
  type Tarifa,
  VEHICULOS,
  type Vehiculo,
} from '@ed1/parqueadero-schema';

export interface SedeDelRecibo {
  readonly nombre: string;
  readonly nit: string;
  readonly direccion: string;
  readonly ciudad: string;
  readonly telefono: string;
  readonly poliza: { readonly aseguradora: string; readonly numero: string } | null;
}

export type TarifaDelRecibo = Pick<
  Tarifa,
  | 'modo'
  | 'valor'
  | 'fraccion_min'
  | 'gracia_min'
  | 'tope_dia'
  | 'plena'
  | 'nocturna'
  | 'tope_minuto'
>;

export interface SalidaDelRecibo {
  readonly instante: number;
  readonly entradaNumero: string;
  readonly minutos: number;
  readonly lineas: readonly LineaDeLiquidacion[];
  readonly subtotal: number;
  readonly redondeo: number;
  readonly total: number;
  readonly medio: MedioDePago;
  readonly recibido: number | null;
  readonly cambio: number | null;
}

export interface Recibo {
  readonly clase: 'entrada' | 'salida';
  readonly numero: string;
  readonly sede: SedeDelRecibo;
  readonly placa: string;
  readonly vehiculo: Vehiculo;
  /** Milisegundos Unix, en segundos enteros: el enlace lleva segundos (§6.3). */
  readonly entrada: number;
  /** Lo que se vio al entrar; vacío = sin novedad. Solo en la entrada. */
  readonly estado: readonly string[];
  readonly tarifa: TarifaDelRecibo;
  readonly salida: SalidaDelRecibo | null;
  /** La línea propia del pie, de los ajustes del recibo; nula si no hay. */
  readonly pie: string | null;
  /** Hecho fuera de producción: no vale (HU-Q5.1 CA2). */
  readonly prueba: boolean;
}

/** Falta un dato legal: no se arma el recibo. Nombra cada uno como lo lee el cajero (HU-Q3.2). */
export class ReciboIncompleto extends Error {
  readonly faltan: readonly string[];
  constructor(faltan: readonly string[]) {
    super(`Antes del primer recibo falta: ${juntar(faltan)}`);
    this.name = 'ReciboIncompleto';
    this.faltan = faltan;
  }
}

/** «el NIT», «el NIT y la póliza», «el nombre, el NIT y la póliza». */
export function juntar(cosas: readonly string[]): string {
  if (cosas.length <= 1) return cosas.join('');
  return `${cosas.slice(0, -1).join(', ')} y ${cosas.at(-1)}`;
}

/** Campos legales de la sede, en el orden del formulario, con su nombre para el cajero. */
export const CAMPOS_LEGALES = [
  ['nombre', 'el nombre'],
  ['nit', 'el NIT'],
  ['direccion', 'la dirección'],
  ['ciudad', 'la ciudad'],
  ['telefono', 'el teléfono'],
  ['poliza', 'la póliza'],
] as const;

export type CampoLegal = (typeof CAMPOS_LEGALES)[number][0];

/**
 * Lo que le falta a una sede, aún a medio llenar, para hacer un recibo. La póliza falta mientras no
 * se haya dicho si hay o no (`undefined`); `null` es «no tiene», una respuesta (§6.1).
 */
export function faltantesDeSede(
  sede: Partial<Record<CampoLegal, unknown>> | null | undefined,
): CampoLegal[] {
  return CAMPOS_LEGALES.map(([campo]) => campo).filter((campo) => {
    const v = sede?.[campo];
    if (campo === 'poliza') return v === undefined;
    return typeof v !== 'string' || v.trim() === '';
  });
}

export const nombresDeCampos = (campos: readonly CampoLegal[]): string[] =>
  campos.map((c) => CAMPOS_LEGALES.find(([k]) => k === c)?.[1] ?? c);

const NOVEDAD: Readonly<Record<string, string>> = {
  rayon: 'rayón',
  golpe: 'golpe',
  vidrio: 'vidrio',
  espejo: 'espejo',
  llanta: 'llanta',
  otro: 'otro',
};

export const NOMBRE_DEL_MEDIO: Readonly<Record<MedioDePago, string>> = {
  efectivo: 'efectivo',
  transferencia: 'QR o transferencia',
  datafono: 'datáfono',
  abonado: 'abonado',
  cortesia: 'cortesía',
};

export interface Catalogos {
  readonly sede: Sede | null;
  /** La tarifa que dice el registro (`tarifa_id` y `tarifa_version`). */
  readonly tarifa: Tarifa | null;
  readonly ajuste: AjusteRecibo | null;
}

/**
 * Arma el recibo de una entrada o una salida ya validadas (`validarRegistro`). Lanza
 * `ReciboIncompleto` si falta un dato legal o la tarifa.
 */
export function armarRecibo(
  registro: Registro,
  catalogos: Catalogos,
  opciones: { readonly prueba: boolean },
): Recibo {
  if (registro.tipo !== 'entrada' && registro.tipo !== 'salida') {
    throw new TypeError(`Un registro «${registro.tipo}» no tiene recibo de entrada o salida`);
  }
  const faltan = nombresDeCampos(faltantesDeSede(catalogos.sede));
  if (!catalogos.tarifa) faltan.push(`la tarifa`);
  const { sede, tarifa } = catalogos;
  if (faltan.length > 0 || !sede || !tarifa) throw new ReciboIncompleto(faltan);
  if (registro.serie === null || registro.consecutivo === null) {
    throw new TypeError('Un recibo sin serie ni consecutivo no existe (anexo A)');
  }

  const segundos = (iso: string) => Math.floor(Date.parse(iso) / 1000) * 1000;
  const comun = {
    numero: numeroDeRecibo(registro.serie, registro.consecutivo),
    sede: {
      nombre: sede.nombre,
      nit: sede.nit,
      direccion: sede.direccion,
      ciudad: sede.ciudad,
      telefono: sede.telefono,
      poliza: sede.poliza ? { ...sede.poliza } : null,
    },
    tarifa: {
      modo: tarifa.modo,
      valor: tarifa.valor,
      fraccion_min: tarifa.fraccion_min,
      gracia_min: tarifa.gracia_min,
      tope_dia: tarifa.tope_dia,
      plena: tarifa.plena ? { ...tarifa.plena } : null,
      nocturna: tarifa.nocturna ? { ...tarifa.nocturna } : null,
      tope_minuto: tarifa.tope_minuto,
    },
    pie: catalogos.ajuste?.pie ?? null,
    prueba: opciones.prueba,
  };

  if (registro.tipo === 'entrada') {
    const d = registro.datos as DatosDeEntrada;
    return {
      ...comun,
      clase: 'entrada',
      placa: d.placa,
      vehiculo: d.vehiculo,
      entrada: segundos(registro.instante_evento),
      estado: d.novedades.map((n) =>
        [NOVEDAD[n.tipo] ?? n.tipo, n.parte, n.nota].filter((x) => x !== null).join(' '),
      ),
      salida: null,
    };
  }
  const d = registro.datos as DatosDeSalida;
  return {
    ...comun,
    clase: 'salida',
    placa: d.placa,
    vehiculo: d.vehiculo,
    entrada: segundos(d.instante_entrada),
    estado: [],
    salida: {
      instante: segundos(registro.instante_evento),
      entradaNumero: d.entrada_numero,
      minutos: d.minutos,
      lineas: d.lineas.map((l) => ({ ...l })),
      subtotal: d.subtotal,
      redondeo: d.redondeo,
      total: d.total,
      medio: d.medio_pago,
      recibido: d.recibido,
      cambio: d.cambio,
    },
  };
}

const dos = (n: number) => String(n).padStart(2, '0');

/** `06/10/2026 18:05` con un desfase fijo y sin la API de formatos (§5.6, P17). */
export function fechaHora(ms: number, desfaseMin = -300): string {
  const d = new Date(ms + desfaseMin * 60_000);
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`;
}

export const nombreDelVehiculo = (v: Vehiculo): string => VEHICULOS[v].nombre;

/** Las líneas de la tarifa, cortas, iguales en el papel y en la pantalla. */
export function lineasDeTarifa(t: TarifaDelRecibo): string[] {
  const $ = formatearPesos;
  const lineas = [
    t.modo === 'minuto'
      ? `Tarifa: ${$(t.valor)} por minuto`
      : t.modo === 'hora'
        ? `Tarifa: ${$(t.valor)} por hora`
        : `Tarifa: ${$(t.valor)} cada ${t.fraccion_min} min`,
  ];
  if (t.gracia_min > 0) lineas.push(`Gracia: ${t.gracia_min} min`);
  if (t.plena) lineas.push(`Desde ${t.plena.desde_min + 1} min: ${$(t.plena.valor)}`);
  if (t.tope_dia !== null) lineas.push(`Tope por día: ${$(t.tope_dia)}`);
  if (t.nocturna) {
    lineas.push(`Noche ${t.nocturna.desde} a ${t.nocturna.hasta}: ${$(t.nocturna.valor)}`);
  }
  if (t.tope_minuto !== null) lineas.push(`Tope legal: ${$(t.tope_minuto)} por minuto`);
  return lineas;
}

/** Cómo se lee cada línea de la liquidación: «Tope por día aplicado», «Noche 20:00 a 05:30»… */
export function conceptoDeLinea(l: LineaDeLiquidacion, t: TarifaDelRecibo): string {
  switch (l.concepto) {
    case 'tiempo':
      return `Por ${l.minutos} min`;
    case 'plena':
      return 'Tarifa plena aplicada';
    case 'tope_dia':
      return 'Tope por día aplicado';
    case 'nocturna':
      return t.nocturna ? `Noche ${t.nocturna.desde} a ${t.nocturna.hasta}` : 'Noche';
    case 'perdido':
      return 'Tiquete perdido';
    case 'gracia':
      return `Gracia (${l.minutos} min)`;
    case 'abonado':
      return `Abonado (${l.minutos} min)`;
  }
}

/** Los textos legales cortos del papel y del mensaje (§6.1; estudio §13.1). */
export const TEXTO_LEGAL = {
  entrada: 'Conserve este recibo. El parqueadero responde por el vehículo (Ley 1480, art. 18).',
  noFactura: 'Este recibo no es factura.',
  pedirWhatsApp: 'Pida su recibo por WhatsApp.',
  whatsapp: 'Usamos este número solo para enviarle sus recibos.',
} as const;
