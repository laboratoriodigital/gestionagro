/**
 * El recibo del generador gratuito (HU-Q11.4; estudio §12.2, herramienta 2): un parqueadero que
 * todavía no usa la caja llena una vez sus datos y hace el recibo de entrada de un vehículo, con
 * el mismo modelo y las mismas salidas que la caja (ADR-33): la hoja, el papel y el WhatsApp.
 *
 * CA3: no se confunde con un recibo de caja. Su número es el del talonario del parqueadero, sin la
 * serie de ninguna caja (`A-000123`), así que tampoco tiene enlace a `/r/`, y su pie dice de dónde
 * salió. No pide cuenta ni guarda nada fuera del navegador.
 */
import { type Modo, VEHICULOS, type Vehiculo } from '@ed1/parqueadero-schema';
import {
  faltantesDeSede,
  nombresDeCampos,
  type Recibo,
  ReciboIncompleto,
  type SedeDelRecibo,
} from './recibo.ts';

export const PIE_DEL_GENERADOR =
  'Hecho con el generador gratuito de Parqueadero ED1. No es un recibo de caja.';

/** El número del talonario: solo cifras, como lo escribe el parqueadero en su papel. */
const NUMERO = /^\d{1,8}$/;
const PLACA = /^[A-Z0-9]{1,10}$/;

export interface DatosDelGenerador {
  readonly sede: Partial<Omit<SedeDelRecibo, 'poliza'>> & {
    readonly poliza?: SedeDelRecibo['poliza'];
  };
  readonly numero: string;
  readonly placa: string;
  readonly vehiculo: Vehiculo;
  /** Milisegundos Unix; el recibo los lleva en segundos enteros. */
  readonly entrada: number;
  readonly estado: readonly string[];
  readonly tarifa: {
    readonly modo: Modo;
    readonly valor: number;
    /** Solo en modo `fraccion`: los minutos de cada fracción. */
    readonly fraccion_min: number | null;
  };
}

/** La placa como la escribe la caja: mayúsculas, sin espacios ni guiones. */
export const placaDelGenerador = (texto: string): string =>
  texto.toUpperCase().replace(/[\s-]/g, '');

/**
 * El recibo de entrada del generador. Lanza `ReciboIncompleto` con todo lo que falta, como la
 * caja antes del primer recibo (HU-Q3.2): nunca sale un recibo con un dato legal vacío.
 */
export function reciboDelGenerador(d: DatosDelGenerador): Recibo {
  const sede = { ...d.sede, poliza: d.sede.poliza === undefined ? null : d.sede.poliza };
  const faltan = nombresDeCampos(faltantesDeSede(sede));
  if (!NUMERO.test(d.numero.trim())) faltan.push('el número del recibo');
  const placa = placaDelGenerador(d.placa);
  if (!PLACA.test(placa)) faltan.push('la placa');
  if (!(d.vehiculo in VEHICULOS)) faltan.push('el tipo de vehículo');
  const { modo, valor } = d.tarifa;
  const fraccion = modo === 'fraccion' ? d.tarifa.fraccion_min : null;
  if (
    !Number.isInteger(valor) ||
    valor <= 0 ||
    (modo === 'fraccion' && (!Number.isInteger(fraccion) || (fraccion ?? 0) <= 0))
  ) {
    faltan.push('la tarifa');
  }
  if (!Number.isFinite(d.entrada)) faltan.push('la hora de entrada');
  if (faltan.length > 0) throw new ReciboIncompleto(faltan);
  return {
    clase: 'entrada',
    numero: d.numero.trim(),
    sede: {
      nombre: sede.nombre?.trim() ?? '',
      nit: sede.nit?.trim() ?? '',
      direccion: sede.direccion?.trim() ?? '',
      ciudad: sede.ciudad?.trim() ?? '',
      telefono: sede.telefono?.trim() ?? '',
      poliza: sede.poliza ? { ...sede.poliza } : null,
    },
    placa,
    vehiculo: d.vehiculo,
    entrada: Math.floor(d.entrada / 1000) * 1000,
    estado: d.estado.map((e) => e.trim()).filter(Boolean),
    tarifa: {
      modo,
      valor,
      fraccion_min: fraccion,
      gracia_min: 0,
      tope_dia: null,
      plena: null,
      nocturna: null,
      tope_minuto: null,
    },
    salida: null,
    pie: PIE_DEL_GENERADOR,
    responsabilidad: null,
    prueba: false,
  };
}
