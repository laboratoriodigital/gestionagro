/**
 * Registros inmutables del parqueadero (ADR-4, PARQUEADERO §5.2, anexo A). Columnas comunes más
 * `datos` validado por tipo y versión. Corregir es escribir una `anulacion`; nadie borra.
 *
 * Las reglas de `registro_reglas` del anexo A se cumplen aquí también, en la caja y sin red: un
 * recibo lleva serie y consecutivo, una entrada abre su propia estadía y una anulación nombra lo
 * que anula. Así lo que la caja guarda hoy sube mañana sin traducirse (HU-Q1.3).
 */
import { z } from 'zod';
import { fechaLocal, id, instante, notaCorta, pesos, placa, serie, texto } from './comunes.ts';
import {
  CAMINOS_DE_PAPEL,
  CANALES,
  MEDIOS_DE_PAGO,
  NOMBRES_DE_TIPO,
  NOMBRES_DE_VEHICULO,
  NOVEDADES,
  ORIGENES,
  RESULTADOS_DE_ENTREGA,
  TIPOS_DE_REGISTRO,
} from './tipos.ts';

export const registroBase = z
  .strictObject({
    id,
    org_id: id.nullable(),
    tipo: z.enum(NOMBRES_DE_TIPO),
    v: z.int().min(1),
    fecha_local: fechaLocal,
    instante_evento: instante,
    autor_usuario_id: id.nullable(),
    dispositivo_id: z.string().min(1),
    origen: z.enum(ORIGENES),
    anula_id: id.nullable(),
    estadia_id: id.nullable(),
    serie: serie.nullable(),
    consecutivo: z.int('debe ser un número entero').min(1).nullable(),
    datos: z.unknown(),
  })
  .superRefine((r, ctx) => {
    const banderas = TIPOS_DE_REGISTRO[r.tipo];
    if (banderas.lleva_numero && (r.serie === null || r.consecutivo === null)) {
      ctx.addIssue({
        code: 'custom',
        path: [r.serie === null ? 'serie' : 'consecutivo'],
        message: 'este tipo de registro es un recibo y necesita serie y consecutivo',
      });
    }
    if (!banderas.lleva_numero && (r.serie !== null || r.consecutivo !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['consecutivo'],
        message: 'este tipo de registro no lleva número de recibo',
      });
    }
    if (banderas.abre_estadia && r.estadia_id !== r.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['estadia_id'],
        message: 'una entrada abre su propia estadía: estadia_id = id',
      });
    }
    if (banderas.pide_anula && r.anula_id === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['anula_id'],
        message: 'una anulación necesita el registro que anula',
      });
    }
    if (r.tipo === 'salida' && r.estadia_id === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['estadia_id'],
        message: 'una salida cierra una estadía: necesita su estadia_id',
      });
    }
  });

const vehiculo = z.enum(NOMBRES_DE_VEHICULO);

/** `entrada` v1 (HU-Q3.3): la placa, el estado del vehículo y la tarifa vigente al entrar. */
const entradaV1 = z.strictObject({
  placa,
  vehiculo,
  /** La placa no sigue el patrón de su tipo y el cajero lo confirmó (§5.1, P1). */
  placa_confirmada: z.boolean(),
  /** Vacía = «sin novedad». */
  novedades: z
    .array(
      z.strictObject({
        tipo: z.enum(NOVEDADES),
        parte: notaCorta(30).nullable(),
        nota: notaCorta(80).nullable(),
      }),
    )
    .max(6, 'son máximo 6 novedades'),
  /** Fotos en la tabla `fotos` de la caja; el registro nunca lleva la imagen. */
  foto_ids: z.array(id).max(4, 'son máximo 4 fotos'),
  tarifa_id: id,
  tarifa_version: z.int().min(1),
  /** El abonado vigente de la placa al entrar, si lo hay (HU-Q3.11). */
  abonado_id: id.nullable(),
});

/** Los conceptos de una liquidación (`@ed1/parqueadero-tarifas`). */
export const CONCEPTOS = [
  'tiempo',
  'plena',
  'tope_dia',
  'nocturna',
  'perdido',
  'gracia',
  'abonado',
] as const;
export type Concepto = (typeof CONCEPTOS)[number];

export const lineaDeLiquidacion = z.strictObject({
  concepto: z.enum(CONCEPTOS),
  /** Minutos que cubre la línea. */
  minutos: z.int().min(0),
  /** Lo que valía por tiempo antes de la plena o del tope; igual a `valor` en las demás. */
  base: pesos,
  valor: pesos,
});

const numeroDeRecibo = z.string().regex(/^[A-Z0-9]{1,3}-\d{6,}$/, 'debe tener la forma A-000123');

/** `salida` v1 (HU-Q3.5): la liquidación, el pago y la entrada que cierra. */
const salidaV1 = z
  .strictObject({
    entrada_numero: numeroDeRecibo,
    placa,
    vehiculo,
    instante_entrada: instante,
    minutos: z.int().min(0),
    lineas: z.array(lineaDeLiquidacion).min(1),
    subtotal: pesos,
    redondeo: pesos,
    total: pesos,
    medio_pago: z.enum(MEDIOS_DE_PAGO),
    /** Solo en efectivo: lo que entregó el conductor y el cambio. */
    recibido: pesos.nullable(),
    cambio: pesos.nullable(),
    motivo_cortesia: notaCorta(80).nullable(),
    perdido: z.boolean(),
    tarifa_id: id,
    tarifa_version: z.int().min(1),
  })
  .superRefine((s, ctx) => {
    const suma = s.lineas.reduce((a, l) => a + l.valor, 0);
    if (suma !== s.subtotal) {
      ctx.addIssue({
        code: 'custom',
        path: ['subtotal'],
        message: `no es la suma de las líneas (${suma})`,
      });
    }
    if (s.subtotal - s.redondeo !== s.total) {
      ctx.addIssue({ code: 'custom', path: ['total'], message: 'no es subtotal menos redondeo' });
    }
    const efectivo = s.medio_pago === 'efectivo';
    if (efectivo !== (s.recibido !== null) || efectivo !== (s.cambio !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['recibido'],
        message: 'lo recibido y el cambio van solo en efectivo',
      });
    }
    if (s.recibido !== null && s.cambio !== null && s.recibido - s.total !== s.cambio) {
      ctx.addIssue({ code: 'custom', path: ['cambio'], message: 'no es recibido menos total' });
    }
    if ((s.medio_pago === 'cortesia') !== (s.motivo_cortesia !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['motivo_cortesia'],
        message: 'una cortesía lleva su motivo, y solo ella',
      });
    }
  });

/** `pago_abonado` v1: el recibo de una mensualidad. */
const pagoAbonadoV1 = z
  .strictObject({
    abonado_id: id,
    placa,
    vehiculo,
    desde: fechaLocal,
    hasta: fechaLocal,
    valor: pesos.min(1),
    medio_pago: z.enum(['efectivo', 'transferencia', 'datafono']),
  })
  .refine((p) => p.hasta >= p.desde, { path: ['hasta'], message: 'no puede ser antes de «desde»' });

/**
 * `anulacion` v1 (HU-Q3.7): el motivo y quién anuló. En M0 el operador es el del turno abierto; el
 * cierre las cuenta por operador (CA2). Ninguna caja publicada escribió una sin operador.
 */
const anulacionV1 = z.strictObject({
  motivo: texto.max(140, 'es de máximo 140 letras'),
  operador: texto.max(30),
});

/** `entrega_recibo` v1: cómo salió un recibo. Una copia reimpresa dice «COPIA» (§7.6). */
const entregaReciboV1 = z.strictObject({
  recibo_id: id,
  canal: z.enum(CANALES),
  copia: z.boolean(),
  // Desde Q3 (HU-Q3.6 CA2). Opcionales: las entregas de staging de Q2 no los traen.
  camino: z.enum(CAMINOS_DE_PAPEL).nullable().optional(),
  resultado: z.enum(RESULTADOS_DE_ENTREGA).optional(),
  /** WhatsApp al número del conductor con su autorización (§8.3). El número no va aquí: ADR-38. */
  autorizado: z.boolean().optional(),
});

const turnoAperturaV1 = z.strictObject({ base: pesos, operador: texto.max(30) });

const turnoCierreV1 = z
  .strictObject({
    apertura_id: id,
    esperado: pesos,
    contado: pesos,
    diferencia: z.int(),
    motivo: notaCorta(80).nullable(),
  })
  .superRefine((t, ctx) => {
    if (t.contado - t.esperado !== t.diferencia) {
      ctx.addIssue({
        code: 'custom',
        path: ['diferencia'],
        message: 'no es contado menos esperado',
      });
    }
    if (t.diferencia !== 0 && t.motivo === null) {
      ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'una diferencia lleva su motivo' });
    }
  });

const movimientoCajaV1 = z.strictObject({
  clase: z.enum(['ingreso', 'gasto']),
  valor: pesos.min(1, 'debe ser mayor que 0'),
  concepto: texto.max(60),
  turno_id: id.nullable(),
});

const notaV1 = z.strictObject({ texto: texto.max(500, 'es de máximo 500 letras') });

/**
 * Esquemas de `datos` por tipo y versión. Se acepta toda versión que una caja publicada escribió
 * (ADR-13): aquí no se borra una versión, se agrega la siguiente.
 */
export const ESQUEMAS_DE_DATOS = {
  entrada: { 1: entradaV1 },
  salida: { 1: salidaV1 },
  pago_abonado: { 1: pagoAbonadoV1 },
  anulacion: { 1: anulacionV1 },
  entrega_recibo: { 1: entregaReciboV1 },
  turno_apertura: { 1: turnoAperturaV1 },
  turno_cierre: { 1: turnoCierreV1 },
  movimiento_caja: { 1: movimientoCajaV1 },
  nota: { 1: notaV1 },
} as const satisfies Record<keyof typeof TIPOS_DE_REGISTRO, Record<number, z.ZodType>>;

export type DatosDeEntrada = z.infer<typeof entradaV1>;
export type DatosDeSalida = z.infer<typeof salidaV1>;
export type DatosDeEntrega = z.infer<typeof entregaReciboV1>;
export type DatosDeAnulacion = z.infer<typeof anulacionV1>;
export type DatosDeApertura = z.infer<typeof turnoAperturaV1>;
export type DatosDeCierre = z.infer<typeof turnoCierreV1>;
export type DatosDeMovimiento = z.infer<typeof movimientoCajaV1>;
export type LineaDeLiquidacion = z.infer<typeof lineaDeLiquidacion>;
export type Registro = z.infer<typeof registroBase>;

/** Datos que no cumplen su esquema. Nombra cada campo con su motivo (P1). */
export class ErrorDeValidacion extends Error {
  override readonly name: string = 'ErrorDeValidacion';
  readonly campos: ReadonlyArray<{ campo: string; motivo: string }>;

  constructor(entidad: string, campos: ReadonlyArray<{ campo: string; motivo: string }>) {
    super(`${entidad} inválido: ${campos.map((c) => `«${c.campo}» ${c.motivo}`).join('; ')}`);
    this.campos = campos;
  }
}

const aCampos = (error: z.ZodError, prefijo: string) =>
  error.issues.map((i) => ({
    campo: [prefijo, ...i.path.map(String)].filter(Boolean).join('.') || '(registro)',
    motivo: i.message,
  }));

/** Valida las columnas comunes y `datos` según su tipo y versión. Lanza ErrorDeValidacion. */
export function validarRegistro(entrada: unknown): Registro {
  const base = registroBase.safeParse(entrada);
  if (!base.success) throw new ErrorDeValidacion('Registro', aCampos(base.error, ''));
  const versiones: Readonly<Record<number, z.ZodType>> = ESQUEMAS_DE_DATOS[base.data.tipo];
  const esquema = versiones[base.data.v];
  if (!esquema) {
    throw new ErrorDeValidacion('Registro', [
      { campo: 'v', motivo: `no hay esquema para «${base.data.tipo}» versión ${base.data.v}` },
    ]);
  }
  const datos = esquema.safeParse(base.data.datos);
  if (!datos.success) throw new ErrorDeValidacion('Registro', aCampos(datos.error, 'datos'));
  return { ...base.data, datos: datos.data };
}

/** Valida un catálogo contra su esquema. Lanza ErrorDeValidacion con los campos. */
export function validarCatalogo<T>(entidad: string, esquema: z.ZodType<T>, entrada: unknown): T {
  const r = esquema.safeParse(entrada);
  if (!r.success) throw new ErrorDeValidacion(entidad, aCampos(r.error, ''));
  return r.data;
}
