/**
 * El aviso de tarifas, medios de pago y derechos para la entrada (HU-Q11.3; estudio §12.2 y §13.1).
 * El texto fijo vive en `content/parqueadero/aviso-tarifas.json` (P2). Las tarifas salen de
 * `lineasDeTarifa`, las mismas líneas del recibo: el letrero y el recibo no pueden decir cosas
 * distintas (ADR-33). Sin los datos legales no hay letrero: la compuerta de HU-Q3.2 (CA3).
 */
import { formatearPesos } from '@ed1/dinero';
import {
  lineasDeTarifa,
  NOMBRE_DEL_MEDIO,
  nombreDelVehiculo,
  TEXTO_LEGAL,
  textoDeResponsabilidad,
} from '@ed1/parqueadero-recibos';
import { type MedioDePago, NOMBRES_DE_VEHICULO } from '@ed1/parqueadero-schema';
import plantilla from '../../../../content/parqueadero/aviso-tarifas.json' with { type: 'json' };
import { type Ajustes, faltaParaRegistrar } from './almacen.ts';

/** Los medios que se cobran en la caja; «abonado» y «cortesía» no son formas de pagar. */
export const MEDIOS_DEL_LETRERO = [
  'efectivo',
  'transferencia',
  'datafono',
] as const satisfies readonly MedioDePago[];
export type MedioDelLetrero = (typeof MEDIOS_DEL_LETRERO)[number];

/**
 * Carta y oficio colombiano (21,6 × 33 cm; el `legal` de CSS mide 35,6 cm). `alto` es lo que
 * queda para el aviso, en mm, sin los márgenes; `letra`, la base en puntos de `estilos.css`.
 */
export const MARGEN_MM = 14;
export const PAPELES = {
  carta: { nombre: 'Carta', tamano: 'letter', alto: 279.4 - 2 * MARGEN_MM, letra: 14 },
  oficio: { nombre: 'Oficio', tamano: '216mm 330mm', alto: 330 - 2 * MARGEN_MM, letra: 16 },
} as const;
export type PapelDelLetrero = keyof typeof PAPELES;

export interface Letrero {
  readonly titulo: string;
  readonly sede: { readonly nombre: string; readonly lineas: readonly string[] };
  /** La línea propia del recibo (el horario, casi siempre); nula si no hay. */
  readonly pie: string | null;
  readonly tarifas: {
    readonly titulo: string;
    readonly vehiculos: readonly { readonly nombre: string; readonly lineas: readonly string[] }[];
  };
  readonly medios: { readonly titulo: string; readonly lista: readonly string[] };
  readonly poliza: string | null;
  readonly responsabilidad: string;
  readonly derechos: { readonly titulo: string; readonly lista: readonly string[] };
  readonly whatsapp: string;
  readonly version: string;
}

export type ResultadoDelLetrero =
  | { readonly ok: true; readonly letrero: Letrero }
  | { readonly ok: false; readonly faltan: readonly string[] };

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * El letrero de la sede con los medios que el parqueadero marcó. Falta algo legal o la tarifa: no
 * hay letrero, y dice qué falta como lo dice «Nueva entrada» (CA3).
 */
export function letreroDeLaSede(
  a: Ajustes,
  medios: readonly MedioDelLetrero[],
): ResultadoDelLetrero {
  const conTarifa = NOMBRES_DE_VEHICULO.filter((v) => a.tarifas.some((t) => t.vehiculo === v));
  const faltan = faltaParaRegistrar(a, conTarifa.length ? conTarifa : ['carro']);
  if (!a.sede || faltan.length > 0) return { ok: false, faltan };
  const s = a.sede;
  return {
    ok: true,
    letrero: {
      titulo: plantilla.titulo,
      sede: {
        nombre: s.nombre,
        lineas: [`NIT ${s.nit}`, `${s.direccion}, ${s.ciudad}`, `Teléfono ${s.telefono}`],
      },
      pie: a.ajuste?.pie ?? null,
      tarifas: {
        titulo: plantilla.tarifas,
        vehiculos: conTarifa.flatMap((v) => {
          const t = a.tarifas.find((x) => x.vehiculo === v);
          if (!t) return [];
          const lineas = lineasDeTarifa(t);
          if (t.perdido !== null) lineas.push(`${plantilla.perdido}: ${formatearPesos(t.perdido)}`);
          return [{ nombre: nombreDelVehiculo(v), lineas }];
        }),
      },
      medios: {
        titulo: plantilla.medios,
        lista: MEDIOS_DEL_LETRERO.filter((m) => medios.includes(m)).map((m) =>
          mayuscula(NOMBRE_DEL_MEDIO[m]),
        ),
      },
      poliza: s.poliza ? `${plantilla.poliza}: ${s.poliza.aseguradora} ${s.poliza.numero}` : null,
      responsabilidad: textoDeResponsabilidad({
        responsabilidad: a.ajuste?.responsabilidad ?? null,
      }),
      derechos: { titulo: plantilla.derechos_titulo, lista: plantilla.derechos },
      whatsapp: TEXTO_LEGAL.pedirWhatsApp,
      version: plantilla.version,
    },
  };
}

/** La letra más chica que se lee en la entrada; con menos, el aviso sale en dos hojas. */
export const LETRA_MINIMA = 9;

/**
 * La letra de la base para que el aviso quepa en una hoja: la de siempre si cabe; si no, la baja en
 * proporción, en medios puntos y sin bajar de `LETRA_MINIMA`.
 */
export function letraQueCabe(base: number, altoMedido: number, altoDisponible: number): number {
  if (altoMedido <= altoDisponible) return base;
  const proporcional = Math.floor(((base * altoDisponible) / altoMedido) * 2) / 2;
  return Math.max(LETRA_MINIMA, Math.min(base - 0.5, proporcional));
}
