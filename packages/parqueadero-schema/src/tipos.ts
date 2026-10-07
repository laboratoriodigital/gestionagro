/**
 * Los tipos de registro, de catálogo y de vehículo. Las banderas son las de `ref_tipo_registro`
 * del anexo A (`docs/parking/sql/parqueadero/0001_parqueadero_v1.sql`): una prueba lee el SQL y
 * exige que coincidan (HU-Q1.3 CA1).
 */

export interface BanderasDeTipo {
  /** Es un recibo con serie y consecutivo. */
  readonly lleva_numero: boolean;
  /** Su id es el de la estadía: `estadia_id = id`. */
  readonly abre_estadia: boolean;
  /** No existe sin el registro que anula. */
  readonly pide_anula: boolean;
}

export const TIPOS_DE_REGISTRO = {
  entrada: { lleva_numero: true, abre_estadia: true, pide_anula: false },
  salida: { lleva_numero: true, abre_estadia: false, pide_anula: false },
  pago_abonado: { lleva_numero: true, abre_estadia: false, pide_anula: false },
  anulacion: { lleva_numero: false, abre_estadia: false, pide_anula: true },
  entrega_recibo: { lleva_numero: false, abre_estadia: false, pide_anula: false },
  turno_apertura: { lleva_numero: false, abre_estadia: false, pide_anula: false },
  turno_cierre: { lleva_numero: false, abre_estadia: false, pide_anula: false },
  movimiento_caja: { lleva_numero: false, abre_estadia: false, pide_anula: false },
  nota: { lleva_numero: false, abre_estadia: false, pide_anula: false },
} as const satisfies Record<string, BanderasDeTipo>;

export type TipoDeRegistro = keyof typeof TIPOS_DE_REGISTRO;
export const NOMBRES_DE_TIPO = Object.keys(TIPOS_DE_REGISTRO) as [
  TipoDeRegistro,
  ...TipoDeRegistro[],
];

/** Las entidades de `ref_entidad` del anexo A. */
export const ENTIDADES = ['sede', 'tarifa', 'abonado', 'ajuste_recibo', 'punto'] as const;
export type Entidad = (typeof ENTIDADES)[number];

/** Los orígenes de `ref_origen` del anexo A. */
export const ORIGENES = ['manual', 'tablero', 'importacion', 'sistema'] as const;

/**
 * Tipos de vehículo y su letra en el enlace corto del recibo (§6.3). La letra es un contrato:
 * un enlace impreso hoy tiene que abrir siempre (HU-Q1.5 CA3).
 */
export const VEHICULOS = {
  carro: { letra: 'c', nombre: 'Carro' },
  moto: { letra: 'm', nombre: 'Moto' },
  bicicleta: { letra: 'b', nombre: 'Bicicleta' },
  patineta: { letra: 'p', nombre: 'Patineta eléctrica' },
} as const;

export type Vehiculo = keyof typeof VEHICULOS;
export const NOMBRES_DE_VEHICULO = Object.keys(VEHICULOS) as [Vehiculo, ...Vehiculo[]];

/** Lo que se le puede ver a un vehículo al entrar (PARQUEADERO §5.1, Entrada, paso 4). */
export const NOVEDADES = ['rayon', 'golpe', 'vidrio', 'espejo', 'llanta', 'otro'] as const;

/** Medios de pago de la salida (§5.1, Salida, paso 3). ED1 no toca el dinero. */
export const MEDIOS_DE_PAGO = [
  'efectivo',
  'transferencia',
  'datafono',
  'abonado',
  'cortesia',
] as const;
export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];

/** Por dónde se entregó un recibo (§5.2, `entrega_recibo`). */
export const CANALES = ['papel', 'whatsapp', 'pantalla'] as const;
export type Canal = (typeof CANALES)[number];

/** Por dónde salió el papel: los caminos de `@ed1/impresion` (§7.3). */
export const CAMINOS_DE_PAPEL = ['bluetooth', 'serial', 'sistema', 'rawbt', 'prueba'] as const;

/**
 * Qué pasó con una entrega (§7.6): el papel se **envió** a la impresora o **falló** («No salió»);
 * WhatsApp se **abrió** o el cajero dijo que **no se envió**; el QR en pantalla, **confirmado**
 * cuando el conductor lo escaneó. Nunca «impreso»: la caja no lo puede saber (HU-Q3.6 CA3).
 */
export const RESULTADOS_DE_ENTREGA = [
  'enviado',
  'fallido',
  'abierto',
  'no_enviado',
  'confirmado',
] as const;

/**
 * El vehículo que propone la placa (§5.1): `ABC123` carro, `ABC12D` moto. Cualquier otra
 * (extranjera, diplomática, remolque, una bicicleta marcada) da `null`: se acepta con una
 * confirmación, nunca se bloquea (P1).
 */
export function vehiculoPorPlaca(placa: string): 'carro' | 'moto' | null {
  if (/^[A-Z]{3}\d{3}$/.test(placa)) return 'carro';
  if (/^[A-Z]{3}\d{2}[A-Z]$/.test(placa)) return 'moto';
  return null;
}

/** `A-000123`: la serie y el consecutivo con seis cifras (§5.4). */
export function numeroDeRecibo(serie: string, consecutivo: number): string {
  if (!Number.isSafeInteger(consecutivo) || consecutivo < 1) {
    throw new RangeError(`Consecutivo inválido: ${consecutivo}`);
  }
  return `${serie}-${String(consecutivo).padStart(6, '0')}`;
}
