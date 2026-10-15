/**
 * HU-T10.3: los ajustes por sección, del lado del panel. Cada sección es una lista de campos; el
 * formulario los guarda como texto (el borrador del teléfono solo guarda texto) y aquí se pasan a
 * los datos de la sección y de vuelta.
 *
 * - Un campo vacío se manda vacío y la API no lo guarda: vacío nunca es un valor de fábrica (CA4).
 * - Lo que el formulario no muestra (el logo, las ciudades de la contraentrega) sigue como estaba.
 * - `whatsappVerificado` no es un campo: lo pone la API cuando el comercio confirma su número.
 */
import { TITULOS_DE_SECCION } from '@ed1/tienda-schema/titulos';
import { FORMAS_DE_PAGO } from './pedidos.ts';

export type Seccion = keyof typeof TITULOS_DE_SECCION;

export type TipoDeCampo =
  | 'texto'
  | 'parrafo'
  | 'correo'
  | 'celular'
  | 'telefono'
  | 'pesos'
  | 'numero'
  | 'color'
  | 'opciones'
  | 'si-no'
  | 'formas';

export interface CampoDeAjuste {
  /** El camino dentro de la sección: `documento.numero`. */
  campo: string;
  etiqueta: string;
  tipo: TipoDeCampo;
  opciones?: readonly (readonly [string, string])[];
  ayuda?: string;
  /** Lo pide la compuerta para publicar (`REQUERIDOS_PARA_PUBLICAR`); una prueba los ata. */
  requerido?: true;
}

const SI_NO_SENAL = [
  ['yes', 'Sí'],
  ['no', 'No'],
] as const;

/** Los campos de cada sección, en el orden en que se leen. */
export const CAMPOS: Record<Seccion, readonly CampoDeAjuste[]> = {
  identidad: [
    { campo: 'nombre', etiqueta: 'Nombre de la tienda', tipo: 'texto', requerido: true },
    { campo: 'frase', etiqueta: 'Frase corta', tipo: 'texto', ayuda: 'Hasta 140 caracteres.' },
  ],
  contacto: [
    {
      campo: 'whatsapp',
      etiqueta: 'WhatsApp de la tienda',
      tipo: 'celular',
      ayuda: 'Los 10 dígitos del celular. Ahí llegan los pedidos.',
    },
    { campo: 'correo', etiqueta: 'Correo', tipo: 'correo' },
    { campo: 'horario', etiqueta: 'Horario de atención', tipo: 'texto' },
  ],
  apariencia: [
    { campo: 'acento', etiqueta: 'Color de acento', tipo: 'color' },
    {
      campo: 'tinta',
      etiqueta: 'Tinta',
      tipo: 'opciones',
      opciones: [
        ['negra', 'Negra'],
        ['azul', 'Azul'],
      ],
    },
    {
      campo: 'estilo',
      etiqueta: 'Estilo',
      tipo: 'opciones',
      opciones: [
        ['precision', 'Precisión'],
        ['editorial', 'Editorial'],
      ],
    },
    {
      campo: 'portada',
      etiqueta: 'Portada',
      tipo: 'opciones',
      opciones: [
        ['catalogo', 'Catálogo'],
        ['editorial', 'Editorial'],
        ['colecciones', 'Colecciones'],
      ],
    },
    {
      campo: 'proporcion',
      etiqueta: 'Forma de las fotos',
      tipo: 'opciones',
      opciones: [
        ['1:1', 'Cuadradas'],
        ['4:5', 'Verticales (4:5)'],
      ],
    },
    {
      campo: 'modo',
      etiqueta: 'Claro u oscuro',
      tipo: 'opciones',
      opciones: [
        ['claro', 'Claro'],
        ['oscuro', 'Oscuro'],
        ['telefono', 'Como esté el teléfono'],
      ],
    },
    {
      campo: 'orden',
      etiqueta: 'Orden de los productos',
      tipo: 'opciones',
      opciones: [
        ['manual', 'El que yo elija'],
        ['nuevos', 'Los más nuevos primero'],
        ['precio_asc', 'Precio de menor a mayor'],
        ['precio_desc', 'Precio de mayor a menor'],
      ],
    },
  ],
  venta: [
    {
      campo: 'modo',
      etiqueta: '¿Cómo llegan los pedidos?',
      tipo: 'opciones',
      requerido: true,
      ayuda: 'El pago en línea todavía no está listo: por ahora, los pedidos llegan por WhatsApp.',
      opciones: [
        ['whatsapp', 'Por WhatsApp'],
        ['en_linea', 'Con pago en línea'],
        ['ambos', 'Las dos'],
      ],
    },
    {
      campo: 'formas',
      etiqueta: 'Formas de pago que ofreces',
      tipo: 'formas',
      requerido: true,
      opciones: Object.entries(FORMAS_DE_PAGO),
    },
    { campo: 'abierta', etiqueta: '¿La tienda está recibiendo pedidos?', tipo: 'si-no' },
    { campo: 'mensajeCerrada', etiqueta: 'Mensaje cuando está cerrada', tipo: 'texto' },
    { campo: 'pedidoMinimoCop', etiqueta: 'Pedido mínimo', tipo: 'pesos' },
    { campo: 'comoComprar', etiqueta: 'Cómo comprar', tipo: 'parrafo' },
  ],
  cobro: [
    {
      campo: 'transferencia.banco',
      etiqueta: 'Banco',
      tipo: 'texto',
      ayuda: 'Los datos de la transferencia van en el mensaje que mandas al confirmar un pedido.',
    },
    {
      campo: 'transferencia.tipoCuenta',
      etiqueta: 'Tipo de cuenta',
      tipo: 'opciones',
      opciones: [
        ['ahorros', 'Ahorros'],
        ['corriente', 'Corriente'],
        ['deposito', 'Depósito electrónico'],
      ],
    },
    { campo: 'transferencia.numero', etiqueta: 'Número de cuenta', tipo: 'texto' },
    { campo: 'transferencia.titular', etiqueta: 'Titular', tipo: 'texto' },
    { campo: 'transferencia.documento', etiqueta: 'Documento del titular', tipo: 'texto' },
  ],
  legal: [
    {
      campo: 'razonSocial',
      etiqueta: 'Razón social o nombre completo',
      tipo: 'texto',
      requerido: true,
    },
    {
      campo: 'tipoPersona',
      etiqueta: 'Tipo de persona',
      tipo: 'opciones',
      requerido: true,
      opciones: [
        ['natural', 'Natural'],
        ['juridica', 'Jurídica'],
      ],
    },
    {
      campo: 'documento.tipo',
      etiqueta: 'Tipo de documento',
      tipo: 'opciones',
      requerido: true,
      opciones: [
        ['NIT', 'NIT'],
        ['CC', 'Cédula de ciudadanía'],
        ['CE', 'Cédula de extranjería'],
      ],
    },
    { campo: 'documento.numero', etiqueta: 'Número de documento', tipo: 'texto', requerido: true },
    {
      campo: 'direccionNotificacion',
      etiqueta: 'Dirección de notificación',
      tipo: 'texto',
      requerido: true,
    },
    { campo: 'ciudad', etiqueta: 'Ciudad', tipo: 'texto', requerido: true },
    { campo: 'telefono', etiqueta: 'Teléfono', tipo: 'telefono', requerido: true },
    { campo: 'correo', etiqueta: 'Correo', tipo: 'correo', requerido: true },
    { campo: 'responsableIva', etiqueta: '¿Eres responsable de IVA?', tipo: 'si-no' },
    { campo: 'garantia', etiqueta: 'Garantía', tipo: 'parrafo' },
    { campo: 'retracto', etiqueta: 'Derecho de retracto', tipo: 'parrafo' },
  ],
  medicion: [
    { campo: 'ga4', etiqueta: 'Google Analytics (G-…)', tipo: 'texto' },
    { campo: 'pixelMeta', etiqueta: 'Píxel de Meta', tipo: 'texto' },
    { campo: 'avisoConsentimiento', etiqueta: 'Aviso de cookies', tipo: 'parrafo' },
    { campo: 'googleVerificacion', etiqueta: 'Código de Google Search Console', tipo: 'texto' },
  ],
  agentes: [
    {
      campo: 'search',
      etiqueta: '¿Te pueden mostrar los buscadores?',
      tipo: 'opciones',
      opciones: SI_NO_SENAL,
    },
    {
      campo: 'aiInput',
      etiqueta: '¿Te pueden citar los asistentes?',
      tipo: 'opciones',
      opciones: SI_NO_SENAL,
    },
    {
      campo: 'aiTrain',
      etiqueta: '¿Pueden entrenar con tu tienda?',
      tipo: 'opciones',
      opciones: SI_NO_SENAL,
    },
  ],
  avisos: [
    { campo: 'correo', etiqueta: 'Correo para los avisos', tipo: 'correo' },
    { campo: 'hora', etiqueta: 'Hora del resumen (HH:MM)', tipo: 'texto' },
    { campo: 'stockBajo', etiqueta: 'Avisarme cuando queden', tipo: 'numero' },
  ],
};

export const SECCIONES_EN_ORDEN = Object.keys(TITULOS_DE_SECCION) as Seccion[];

export const esSeccion = (s: string): s is Seccion => s in TITULOS_DE_SECCION;

const leerCamino = (datos: Record<string, unknown>, camino: string): unknown =>
  camino
    .split('.')
    .reduce<unknown>(
      (v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined),
      datos,
    );

function ponerCamino(datos: Record<string, unknown>, camino: string, valor: unknown) {
  const partes = camino.split('.');
  let aqui = datos;
  for (const k of partes.slice(0, -1)) {
    const siguiente = aqui[k];
    aqui[k] =
      siguiente && typeof siguiente === 'object' && !Array.isArray(siguiente)
        ? { ...(siguiente as Record<string, unknown>) }
        : {};
    aqui = aqui[k] as Record<string, unknown>;
  }
  aqui[partes.at(-1) as string] = valor;
}

const digitos = (t: string) => t.replace(/\D/g, '');

/** Lo guardado, como texto para el formulario. */
export function aTexto(seccion: Seccion, datos: Record<string, unknown>): Record<string, string> {
  const texto: Record<string, string> = {};
  for (const c of CAMPOS[seccion]) {
    const v = leerCamino(datos, c.campo);
    if (v === undefined || v === null) texto[c.campo] = '';
    else if (c.tipo === 'si-no') texto[c.campo] = v === true ? 'si' : 'no';
    else if (c.tipo === 'formas')
      texto[c.campo] = Array.isArray(v)
        ? v.map((f) => String((f as { forma?: unknown }).forma)).join(',')
        : '';
    else if (c.tipo === 'celular') texto[c.campo] = String(v).replace(/^\+57/, '');
    else texto[c.campo] = String(v);
  }
  return texto;
}

/**
 * El texto del formulario, como datos de la sección. Parte de lo guardado para no perder lo que el
 * formulario no muestra; un campo vacío va vacío y la API lo quita.
 */
export function aDatos(
  seccion: Seccion,
  texto: Record<string, string>,
  guardado: Record<string, unknown>,
): Record<string, unknown> {
  const datos: Record<string, unknown> = structuredClone(guardado);
  delete datos['whatsappVerificado'];
  for (const c of CAMPOS[seccion]) {
    const t = (texto[c.campo] ?? '').trim();
    let v: unknown = t;
    if (t === '') v = '';
    else if (c.tipo === 'si-no') v = t === 'si';
    else if (c.tipo === 'pesos' || c.tipo === 'numero')
      v = /^[0-9.]+$/.test(t) ? Number(t.replace(/\./g, '')) : t;
    else if (c.tipo === 'celular') v = digitos(t).length === 10 ? `+57${digitos(t)}` : t;
    else if (c.tipo === 'telefono') {
      const d = digitos(t).replace(/^57(?=\d{7,10}$)/, '');
      v = /^\d{7,10}$/.test(d) ? `+57${d}` : t;
    } else if (c.tipo === 'formas') {
      const antes = Array.isArray(guardado[c.campo])
        ? (guardado[c.campo] as { forma: string }[])
        : [];
      v = t
        .split(',')
        .filter(Boolean)
        .map((forma) => antes.find((f) => f.forma === forma) ?? { forma });
    }
    ponerCamino(datos, c.campo, v);
  }
  return datos;
}

/** El nombre de un campo como lo lee el comercio: `legal.razonSocial` → «Datos legales: Razón…». */
export function nombreDelCampo(camino: string): string {
  const [s, ...resto] = camino.split('.');
  if (!s || !esSeccion(s)) return camino;
  const campo = resto.join('.');
  if (s === 'contacto' && campo === 'whatsappVerificado')
    return `${TITULOS_DE_SECCION.contacto}: verificar el WhatsApp`;
  const c = CAMPOS[s].find((x) => x.campo === campo || campo.startsWith(`${x.campo}.`));
  return `${TITULOS_DE_SECCION[s]}: ${c?.etiqueta ?? campo}`;
}

/** El campo del formulario al que apunta un problema de la API (`legal.documento.numero`). */
export function campoDelProblema(seccion: Seccion, campo: string): string {
  const sinSeccion = campo.startsWith(`${seccion}.`) ? campo.slice(seccion.length + 1) : campo;
  const c = CAMPOS[seccion].find(
    (x) => x.campo === sinSeccion || sinSeccion.startsWith(`${x.campo}.`),
  );
  // Un problema del objeto entero (`transferencia`) va al primer campo que lo forma.
  const d = c ?? CAMPOS[seccion].find((x) => x.campo.startsWith(`${sinSeccion}.`));
  return d?.campo ?? CAMPOS[seccion][0]?.campo ?? sinSeccion;
}

/** El chat de prueba: el comercio abre un chat con su propio número desde su teléfono (CA3). */
export const chatDePrueba = (whatsapp: string) =>
  `https://wa.me/${whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent('Prueba de mi tienda: este es mi WhatsApp.')}`;
