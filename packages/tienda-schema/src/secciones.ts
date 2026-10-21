/**
 * Las secciones de ajustes de una tienda (TIENDA-3.0 §5.7, HU-T1.4).
 *
 * Cada sección es un documento JSON con su número de `esquema`. La lista y si se hornea en el
 * sitio (`publica`) son las de `ref_seccion_ajuste` en la migración de la tienda; una prueba ata
 * las dos (P2).
 *
 * **Vacío nunca es un valor de fábrica (P1).** Los esquemas aceptan una sección a medio llenar,
 * para que el comercio guarde por partes; lo que falta para publicar lo dice `faltantes`, campo
 * por campo, y la compuerta (HU-T4.3) no publica. Solo tienen valor por defecto las preferencias
 * que no pueden mandar un pedido a otro lado: el aspecto y las señales para agentes (D-T6).
 * Nunca un teléfono, un nombre ni un dato legal (bitácora ecommerce: «el celular de la primera
 * tienda»).
 */
import { z } from 'zod';

export const SECCIONES = {
  identidad: { publica: true },
  contacto: { publica: true },
  apariencia: { publica: true },
  venta: { publica: true },
  cobro: { publica: false },
  legal: { publica: true },
  medicion: { publica: true },
  agentes: { publica: true },
  avisos: { publica: false },
} as const;

export type Seccion = keyof typeof SECCIONES;
export const NOMBRES_DE_SECCION = Object.keys(SECCIONES) as Seccion[];

const texto = (max: number) => z.string().trim().min(1, 'no puede quedar vacío').max(max);
const pesosEnteros = z.number().int('debe ser un número entero de pesos').min(0);

/** Celular colombiano en E.164: +57 y 10 dígitos que empiezan por 3. */
export const celularColombia = z
  .string()
  .regex(/^\+573\d{9}$/, 'debe ser un celular de Colombia: +57 y 10 dígitos que empiezan por 3');

const correo = z.email('debe ser un correo válido');

export const FORMAS_DE_PAGO = [
  'a_convenir',
  'en_linea',
  'contraentrega',
  'transferencia',
  'efectivo',
] as const;

/**
 * HU-T5.13 y HU-T5.14: una imagen de la tienda subida como las fotos (por huella, en el host de las
 * fotos), nunca una URL de afuera: lo que el horno necesita para armar sus direcciones.
 */
export const imagenDeLaTienda = z.object({
  huella: z.string().regex(/^[0-9a-f]{64}$/),
  formato: z.enum(['webp', 'jpeg']),
  ancho: z.number().int().positive(),
  alto: z.number().int().positive(),
  anchos: z.array(z.number().int().positive()).min(1).max(3),
});
export type ImagenDeLaTienda = z.infer<typeof imagenDeLaTienda>;

const identidadV1 = z.object({
  nombre: texto(80).optional(),
  frase: texto(140).optional(),
  /** HU-T5.13: el logo de la franja y el ícono de la pestaña y de la app. */
  logo: imagenDeLaTienda.optional(),
  icono: imagenDeLaTienda.optional(),
});

const contactoV1 = z.object({
  whatsapp: celularColombia.optional(),
  /** Lo pone el sistema cuando el comercio confirma el chat de prueba (HU-T10.3), no el formulario. */
  whatsappVerificado: z.boolean().default(false),
  correo: correo.optional(),
  horario: texto(120).optional(),
});

const apariencia = z.object({
  acento: z
    .string()
    .regex(/^#[0-9a-f]{6}$/, 'debe ser un color #rrggbb en minúsculas')
    .default('#1f1f1d'),
  tinta: z.enum(['negra', 'azul']).default('negra'),
  estilo: z.enum(['precision', 'editorial']).default('precision'),
  portada: z.enum(['editorial', 'catalogo', 'colecciones']).default('catalogo'),
  proporcion: z.enum(['4:5', '1:1']).default('1:1'),
  modo: z.enum(['claro', 'oscuro', 'telefono']).default('claro'),
  orden: z.enum(['manual', 'nuevos', 'precio_asc', 'precio_desc']).default('manual'),
  /** HU-T5.14: el hero de la portada: su título, su texto, su imagen y su botón. */
  hero: z
    .object({
      titulo: texto(80).optional(),
      texto: texto(240).optional(),
      imagen: imagenDeLaTienda.optional(),
      boton: texto(30).optional(),
    })
    .optional(),
});

const formaOfrecida = z.object({
  forma: z.enum(FORMAS_DE_PAGO),
  /** Solo contraentrega: las ciudades donde se ofrece. Nulo: todas. */
  ciudades: z.array(texto(60)).max(200).nullable().optional(),
});

const ventaV1 = z.object({
  modo: z.enum(['whatsapp', 'en_linea', 'ambos']).optional(),
  formas: z.array(formaOfrecida).max(FORMAS_DE_PAGO.length).optional(),
  abierta: z.boolean().optional(),
  mensajeCerrada: texto(200).optional(),
  pedidoMinimoCop: pesosEnteros.optional(),
  comoComprar: texto(2000).optional(),
});

const cobroV1 = z.object({
  ambiente: z.enum(['pruebas', 'produccion']).optional(),
  topeCop: pesosEnteros.max(5_000_000).optional(),
  /** Viajan en el mensaje que manda el comercio; nunca se hornean ni salen por la API pública. */
  transferencia: z
    .object({
      banco: texto(60),
      tipoCuenta: z.enum(['ahorros', 'corriente', 'deposito']),
      numero: z.string().regex(/^[0-9-]{4,30}$/),
      titular: texto(120),
      documento: texto(30),
    })
    .optional(),
});

const legalV1 = z.object({
  razonSocial: texto(160).optional(),
  tipoPersona: z.enum(['natural', 'juridica']).optional(),
  documento: z
    .object({ tipo: z.enum(['NIT', 'CC', 'CE']), numero: z.string().regex(/^[0-9-]{5,20}$/) })
    .optional(),
  direccionNotificacion: texto(200).optional(),
  ciudad: texto(80).optional(),
  telefono: z
    .string()
    .regex(/^\+57\d{7,10}$/, 'debe ser un teléfono de Colombia con +57')
    .optional(),
  correo: correo.optional(),
  responsableIva: z.boolean().optional(),
  garantia: texto(4000).optional(),
  retracto: texto(4000).optional(),
  /** Cuántos meses se guardan los contactos de los compradores (HU-T7.3, D-T5): 24 si no se dice. */
  conservacionMeses: z
    .number()
    .int({ error: 'escribe los meses en número entero' })
    .min(12, { error: 'mínimo 12 meses' })
    .max(60, { error: 'máximo 60 meses' })
    .optional(),
});

const medicionV1 = z.object({
  ga4: z
    .string()
    .regex(/^G-[A-Z0-9]{4,12}$/)
    .optional(),
  pixelMeta: z
    .string()
    .regex(/^\d{8,20}$/)
    .optional(),
  avisoConsentimiento: texto(600).optional(),
  /** El código de la etiqueta HTML de Google Search Console (HU-T14.8); `verificacion.ts` lo lee. */
  googleVerificacion: z
    .string()
    .regex(/^[A-Za-z0-9_-]{20,100}$/, 'debe ser el código que da Google, sin comillas ni espacios')
    .optional(),
});

const senal = z.enum(['yes', 'no']);
const agentes = z.object({
  search: senal.default('yes'),
  aiInput: senal.default('yes'),
  aiTrain: senal.default('no'),
  mcp: z.boolean().default(false),
  feeds: z
    .object({ google: z.boolean(), meta: z.boolean(), agentes: z.boolean() })
    .default({ google: false, meta: false, agentes: false }),
});

const avisosV1 = z.object({
  correo: correo.optional(),
  hora: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  stockBajo: z.number().int().min(0).max(1000).optional(),
});

/** `ESQUEMAS[seccion][version]`. La vigente es la más alta; las viejas se traducen al leer. */
export const ESQUEMAS = {
  identidad: { 1: identidadV1 },
  contacto: { 1: contactoV1 },
  apariencia: { 1: apariencia },
  venta: { 1: ventaV1 },
  cobro: { 1: cobroV1 },
  legal: { 1: legalV1 },
  medicion: { 1: medicionV1 },
  agentes: { 1: agentes },
  avisos: { 1: avisosV1 },
} as const satisfies Record<Seccion, Record<number, z.ZodType>>;

export type DatosDe<S extends Seccion> = z.infer<(typeof ESQUEMAS)[S][1]>;

export const VERSION_VIGENTE = Object.fromEntries(
  NOMBRES_DE_SECCION.map((s) => [s, Math.max(...Object.keys(ESQUEMAS[s]).map(Number))]),
) as Record<Seccion, number>;

type Paso = (datos: Record<string, unknown>) => Record<string, unknown>;
export type Traductores = Readonly<Partial<Record<Seccion, Readonly<Record<number, Paso>>>>>;

/** `TRADUCTORES[seccion][n]` lleva la versión n a la n + 1. Ninguno todavía: todo está en v1. */
export const TRADUCTORES: Traductores = {};

export class VersionSinTraductor extends Error {
  override name = 'VersionSinTraductor';
}

/**
 * Lleva una sección guardada con un esquema viejo a la versión vigente, paso a paso, y la valida.
 * Lo guardado no se reescribe al leerlo (P10): esto es solo la lectura.
 */
export function aVersionVigente(
  seccion: Seccion,
  esquema: number,
  datos: unknown,
  traductores: Traductores = TRADUCTORES,
  vigente: number = VERSION_VIGENTE[seccion],
): Record<string, unknown> {
  let actual = datos as Record<string, unknown>;
  for (let n = esquema; n < vigente; n++) {
    const paso = traductores[seccion]?.[n];
    if (!paso) throw new VersionSinTraductor(`Falta el traductor de ${seccion} v${n} a v${n + 1}`);
    actual = paso(actual);
  }
  return actual;
}

export type Problema = { campo: string; mensaje: string };

/** Valida una sección y devuelve todos sus problemas a la vez, con el campo de cada uno (P15). */
export function validarSeccion(
  seccion: Seccion,
  datos: unknown,
): { ok: true; datos: Record<string, unknown> } | { ok: false; problemas: Problema[] } {
  const r = ESQUEMAS[seccion][1].safeParse(datos);
  if (r.success) return { ok: true, datos: r.data as Record<string, unknown> };
  return {
    ok: false,
    problemas: r.error.issues.map((i) => ({
      campo: [seccion, ...i.path.map(String)].join('.'),
      mensaje: i.message,
    })),
  };
}

/**
 * Lo que la ley y la venta exigen antes de publicar (TIENDA-3.0 §10.2): la ficha legal de la
 * Ley 1480 art. 50 lit. a, un nombre, un WhatsApp verificado si el modo lo usa y un modo de venta.
 */
export const REQUERIDOS_PARA_PUBLICAR: Readonly<Partial<Record<Seccion, readonly string[]>>> = {
  identidad: ['nombre'],
  venta: ['modo', 'formas'],
  legal: [
    'razonSocial',
    'tipoPersona',
    'documento',
    'direccionNotificacion',
    'ciudad',
    'telefono',
    'correo',
  ],
};

/** Los campos que faltan para publicar, todos a la vez. Una sección que no existe falta entera. */
export function faltantes(ajustes: Partial<Record<Seccion, Record<string, unknown>>>): string[] {
  const falta: string[] = [];
  for (const [seccion, campos] of Object.entries(REQUERIDOS_PARA_PUBLICAR) as [
    Seccion,
    string[],
  ][]) {
    const datos = ajustes[seccion] ?? {};
    for (const c of campos) {
      const v = datos[c];
      if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
        falta.push(`${seccion}.${c}`);
      }
    }
  }
  const modo = ajustes.venta?.['modo'];
  if (modo === 'whatsapp' || modo === 'ambos') {
    if (!ajustes.contacto?.['whatsapp']) falta.push('contacto.whatsapp');
    else if (ajustes.contacto['whatsappVerificado'] !== true)
      falta.push('contacto.whatsappVerificado');
  }
  return falta;
}

/** Solo las secciones que se hornean. `cobro` y `avisos` nunca llegan al sitio (TIENDA-3.0 §5.7). */
export function seccionesParaHornear<A extends Partial<Record<Seccion, unknown>>>(
  ajustes: A,
): Partial<A> {
  return Object.fromEntries(
    Object.entries(ajustes).filter(([s]) => SECCIONES[s as Seccion]?.publica === true),
  ) as Partial<A>;
}
