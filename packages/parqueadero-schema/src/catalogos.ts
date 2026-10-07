/**
 * Catálogos del parqueadero (anexo A, `ref_entidad`): mutables, la última escritura gana y la
 * versión anterior va al historial (ADR-4). Ningún campo trae un valor de fábrica (§6.1): lo que
 * el parqueadero no llenó no existe, y la caja no deja registrar sin los datos legales (HU-Q3.2).
 */
import { z } from 'zod';
import {
  fechaLocal,
  horaLocal,
  instante,
  metaDeCatalogo,
  notaCorta,
  pesos,
  placa,
  texto,
} from './comunes.ts';
import { NOMBRES_DE_VEHICULO } from './tipos.ts';

const vehiculo = z.enum(NOMBRES_DE_VEHICULO);

/**
 * NIT colombiano con su dígito de verificación, con o sin puntos: `900.000.000-0`, `800123456-7`.
 * El dígito no se recalcula aquí: lo escribe el parqueadero como sale en su RUT.
 */
export const nit = z
  .string()
  .trim()
  .regex(/^\d{1,3}(?:\.?\d{3}){1,3}-\d$/, 'debe tener la forma 900.000.000-0, con el dígito');

/** Cuándo sale el recibo en papel (HU-Q4.3). Sin «nunca», a propósito (CA3). */
export const PAPEL = ['siempre', 'salvo_digital'] as const;
export type Papel = (typeof PAPEL)[number];

/** Lo que dice la sede, también la de antes de HU-Q4.3. Sin nada, `siempre`: nadie sin recibo. */
export function papelDeLaSede(s: {
  papel?: Papel | undefined;
  imprimir_siempre?: boolean | undefined;
}): Papel {
  if (s.papel) return s.papel;
  return s.imprimir_siempre === false ? 'salvo_digital' : 'siempre';
}

/** Datos legales del prestador (Circular Única de la SIC; §6.1). */
export const sede = z.strictObject({
  ...metaDeCatalogo,
  entidad: z.literal('sede'),
  nombre: texto.max(40, 'es de máximo 40 letras: va en una línea del papel'),
  nit,
  direccion: texto.max(60, 'es de máximo 60 letras'),
  ciudad: texto.max(30, 'es de máximo 30 letras'),
  telefono: z
    .string()
    .trim()
    .regex(/^\+?\d[\d ]{6,14}$/, 'debe ser un teléfono de 7 a 15 dígitos'),
  /** Bogotá: el recibo lleva la póliza (Decreto 461 de 2019). Nula = la sede dijo que no tiene. */
  poliza: z
    .strictObject({
      aseguradora: texto.max(30, 'es de máximo 30 letras'),
      numero: texto.max(30, 'es de máximo 30 letras'),
    })
    .nullable(),
  /** Registro distrital u otro de la ciudad; nulo si la sede no lo tiene. */
  registro: notaCorta(30).nullable(),
  /**
   * Cuándo sale el papel (HU-Q4.3, §8.4): `siempre`, o `salvo_digital` si el conductor recibió el
   * recibo por WhatsApp o en la pantalla. No hay «nunca»: nadie se queda sin recibo (Ley 1480).
   * Opcional: las sedes de Q2 y Q3 traen `imprimir_siempre`; `papelDeLaSede` lee las dos.
   */
  papel: z.enum(PAPEL).optional(),
  /** Antes de HU-Q4.3. Se lee en los respaldos viejos; la caja ya no lo escribe. */
  imprimir_siempre: z.boolean().optional(),
  /**
   * El aviso de privacidad que la sede aceptó, con su versión (HU-Q4.4 CA2). Sin él, la caja no
   * guarda números de WhatsApp. Opcional: las sedes de Q2 no lo traen.
   */
  aviso_privacidad: z
    .strictObject({ version: z.string().regex(/^\d{1,3}$/), aceptado: instante })
    .nullable()
    .optional(),
});

export const MODOS = ['minuto', 'fraccion', 'hora'] as const;
export type Modo = (typeof MODOS)[number];

/** Solo hacia abajo: redondear hacia arriba puede cobrar más que el tope (§9.2, regla 2). */
export const REDONDEOS = ['ninguno', 'abajo_50', 'abajo_100'] as const;
export type Redondeo = (typeof REDONDEOS)[number];

/**
 * Tarifa de un tipo de vehículo (§9.1). Que no pase el tope lo revisa `validarTarifa` de
 * `@ed1/parqueadero-tarifas`, que la caja llama antes de guardar.
 */
export const tarifa = z
  .strictObject({
    ...metaDeCatalogo,
    entidad: z.literal('tarifa'),
    vehiculo,
    modo: z.enum(MODOS),
    /** Por minuto, por fracción o por hora, según el modo. */
    valor: pesos.min(1, 'debe ser mayor que 0'),
    /** Minutos de la fracción; solo en el modo `fraccion`. */
    fraccion_min: z.int().min(2).max(240).nullable(),
    gracia_min: z.int('debe ser un número entero de minutos').min(0).max(60),
    /** Lo máximo que cobra un bloque de 24 h; nulo = sin tope diario. */
    tope_dia: pesos.min(1, 'debe ser mayor que 0').nullable(),
    /**
     * Tarifa plena: pasados `desde_min` minutos de un bloque, el bloque vale `valor` (el «día
     * completo» que cobra el parqueadero después de las primeras horas). Nula = no hay.
     */
    plena: z
      .strictObject({
        desde_min: z.int().min(1).max(1439),
        valor: pesos.min(1, 'debe ser mayor que 0'),
      })
      .nullable(),
    /** Franja nocturna de hora local con valor fijo: la noche entera dentro de la estadía. */
    nocturna: z
      .strictObject({ desde: horaLocal, hasta: horaLocal, valor: pesos.min(1) })
      .refine((n) => n.desde !== n.hasta, 'la franja no puede empezar y terminar a la misma hora')
      .nullable(),
    /** Cobro del tiquete perdido; nulo = no está configurado y la caja no lo ofrece. */
    perdido: pesos.min(1, 'debe ser mayor que 0').nullable(),
    redondeo: z.enum(REDONDEOS),
    /** El tope por minuto que declara la sede, de la norma de su ciudad; nulo = sin tope. */
    tope_minuto: pesos.min(1, 'debe ser mayor que 0').nullable(),
    vigente_desde: instante,
  })
  .superRefine((t, ctx) => {
    if ((t.modo === 'fraccion') !== (t.fraccion_min !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['fraccion_min'],
        message: 'los minutos de la fracción van solo en el modo por fracción',
      });
    }
  });

/** Mensualidad por placa. M0 la registra; el cobro recurrente es de M2 (HU-Q8.4). */
export const abonado = z
  .strictObject({
    ...metaDeCatalogo,
    entidad: z.literal('abonado'),
    placa,
    vehiculo,
    /** Cómo lo reconoce la caja (un nombre de pila, un apartamento); nulo si no se anotó. */
    referencia: notaCorta(40).nullable(),
    desde: fechaLocal,
    hasta: fechaLocal,
    valor: pesos.min(1, 'debe ser mayor que 0'),
    activo: z.boolean(),
  })
  .refine((a) => a.hasta >= a.desde, { path: ['hasta'], message: 'no puede ser antes de «desde»' });

/** Lo que el parqueadero decide del recibo. El texto legal no se edita: es de la ley. */
export const ajusteRecibo = z.strictObject({
  ...metaDeCatalogo,
  entidad: z.literal('ajuste_recibo'),
  /** Una línea propia al pie (horario, «gracias»); nula si no hay. */
  pie: notaCorta(64).nullable(),
});

/** Puesto de trabajo (M1): entrada, salida o ambos. */
export const punto = z.strictObject({
  ...metaDeCatalogo,
  entidad: z.literal('punto'),
  nombre: texto.max(20),
  funcion: z.enum(['entrada', 'salida', 'ambos']),
});

export const catalogo = z.discriminatedUnion('entidad', [
  sede,
  tarifa,
  abonado,
  ajusteRecibo,
  punto,
]);

export type Sede = z.infer<typeof sede>;
export type Tarifa = z.infer<typeof tarifa>;
export type Abonado = z.infer<typeof abonado>;
export type AjusteRecibo = z.infer<typeof ajusteRecibo>;
export type Punto = z.infer<typeof punto>;
export type Catalogo = z.infer<typeof catalogo>;

/** Versión anterior de un catálogo (anexo A, `entidad_historial`). */
export const versionAnterior = z.strictObject({
  id: metaDeCatalogo.id,
  entidad: z.string().min(1),
  entidad_id: metaDeCatalogo.id,
  version: z.int().min(1),
  datos: z.unknown(),
  reemplazada: instante,
  motivo: z.enum(['edicion', 'conflicto']),
});
