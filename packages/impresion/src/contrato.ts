/**
 * El contrato de una impresora (PARQUEADERO §7.3, ADR-34). Un adaptador por camino; la caja solo
 * conoce esta interfaz. El paquete no sabe qué es un parqueadero: la Tienda y el agro lo usan igual.
 */

/** Por dónde salen los bytes. `prueba` los guarda en memoria. */
export type Camino = 'bluetooth' | 'serial' | 'sistema' | 'rawbt' | 'prueba';

export type EstadoImpresora = 'sin_vincular' | 'conectada' | 'desconectada' | 'ocupada';

/** Lo que el adaptador recuerda del equipo elegido, para mostrarlo y guardarlo en `impresora`. */
export interface Vinculo {
  readonly camino: Camino;
  readonly nombre: string;
  /** El id que da el navegador; no sirve en otro navegador ni en otro equipo. */
  readonly id: string;
  /** Bluetooth: el servicio y la característica que funcionaron (§7.4 paso 2). */
  readonly servicio?: string;
  readonly caracteristica?: string;
}

/** Un trabajo de impresión: bytes ESC/POS, o HTML para el diálogo del sistema (§7.5). */
export type Trabajo =
  | { readonly id: string; readonly formato: 'escpos'; readonly bytes: Uint8Array }
  | { readonly id: string; readonly formato: 'html'; readonly html: string };

export type MotivoDeFallo =
  | 'cancelado'
  | 'sin_permiso'
  | 'fuera_de_alcance'
  | 'sin_caracteristica'
  | 'tiempo'
  | 'sin_papel'
  | 'no_soportado';

/**
 * `papel: 'desconocido'` es lo normal: una escritura sin respuesta por BLE dice que los bytes
 * salieron del teléfono, no que salió papel (P17). La pantalla dice «Enviado a la impresora».
 */
export type Resultado =
  | {
      readonly ok: true;
      readonly bytes: number;
      readonly ms: number;
      readonly papel: 'desconocido' | 'ok';
    }
  | { readonly ok: false; readonly motivo: MotivoDeFallo; readonly detalle: string };

export interface Impresora {
  readonly camino: Camino;
  /** Pide permiso y elige el equipo. Solo dentro de un toque del operador. */
  vincular(): Promise<Vinculo>;
  /** Vuelve a conectar sin selector, cuando el navegador lo permite. */
  reconectar(): Promise<boolean>;
  imprimir(trabajo: Trabajo): Promise<Resultado>;
  estado(): EstadoImpresora;
}

/** Un fallo que un adaptador lanza al vincular; la caja muestra `detalle` (§7.4 paso 5). */
export class FalloDeImpresora extends Error {
  readonly motivo: MotivoDeFallo;
  constructor(motivo: MotivoDeFallo, detalle: string) {
    super(detalle);
    this.name = 'FalloDeImpresora';
    this.motivo = motivo;
  }
}

/** Los textos que ve el operador por motivo (PARQUEADERO §7.4, tabla de errores). */
export const TEXTO_DEL_MOTIVO: Readonly<Record<MotivoDeFallo, string>> = {
  cancelado: 'No eligió impresora',
  sin_permiso: 'El navegador no dio permiso para usar la impresora',
  fuera_de_alcance: 'La impresora está apagada o lejos',
  sin_caracteristica: 'Esta impresora no se reconoce',
  tiempo: 'La impresora no respondió a tiempo',
  sin_papel: 'La impresora no tiene papel',
  no_soportado: 'Este navegador no puede usar esta impresora',
};
