/**
 * Lo que dice la landing de TiendaPro (HU-T18.5). Los planes y sus precios salen de
 * `content/tienda/planes.json`, y lo que permite cada uno de `funciones.json`: la misma fuente del
 * panel, del CORE y del cobro (P2). Las tiendas del teléfono son de ejemplo y lo dicen.
 */

import {
  CORREO_DE_REPORTES,
  DOMINIO_DE_LA_MARCA,
  MARCA,
  PANEL_DE_PRODUCCION,
  ZONA_DE_LAS_TIENDAS,
} from '@ed1/tienda-schema/marca';
import funciones from '../../../content/tienda/funciones.json' with { type: 'json' };
import planes from '../../../content/tienda/planes.json' with { type: 'json' };

export { CORREO_DE_REPORTES, DOMINIO_DE_LA_MARCA, MARCA, ZONA_DE_LAS_TIENDAS };

export const ORIGEN = `https://${DOMINIO_DE_LA_MARCA}`;
/**
 * A dónde lleva «Crear tienda»: el panel de producción, que abre el alta a quien entra sin tienda
 * (HU-T13.4). En staging, `scripts/armar-tiendapro.ts` lo cambia por el panel de staging.
 */
export const PANEL = PANEL_DE_PRODUCCION;

export const TITULO = 'TiendaPro · Tu tienda en línea, con los pedidos a tu WhatsApp';
export const DESCRIPCION =
  'Crea tu tienda en línea desde el teléfono, gratis. Tus clientes eligen, arman su pedido y te llega por WhatsApp. Cobra en línea con tu Bold, usa tu propio dominio y deja que los asistentes de tus clientes les preparen el pedido.';

/** Un producto de una tienda de ejemplo: su dibujo es un SVG de `Telefono.astro`. */
export interface ProductoDeEjemplo {
  nombre: string;
  precio: number;
  dibujo:
    | 'pan'
    | 'almojabana'
    | 'torta'
    | 'pandeyuca'
    | 'camisa'
    | 'pantalon'
    | 'vestido'
    | 'bolso'
    | 'jabon'
    | 'aceite'
    | 'crema'
    | 'vela';
  detalle?: string;
}

export interface TiendaDeEjemplo {
  id: 'panaderia' | 'ropa' | 'belleza';
  etiqueta: string;
  nombre: string;
  direccion: string;
  frase: string;
  productos: ProductoDeEjemplo[];
}

/** Tres negocios inventados, para mostrar el producto. Ningún nombre real (P4). */
export const TIENDAS_DE_EJEMPLO: TiendaDeEjemplo[] = [
  {
    id: 'panaderia',
    etiqueta: 'Panadería',
    nombre: 'Panadería La Espiga',
    direccion: `la-espiga.${ZONA_DE_LAS_TIENDAS}`,
    frase: 'Pan de la casa, todas las mañanas.',
    productos: [
      { nombre: 'Pan de bono', precio: 1500, dibujo: 'pan' },
      { nombre: 'Almojábana', precio: 1800, dibujo: 'almojabana' },
      { nombre: 'Pandeyuca', precio: 1500, dibujo: 'pandeyuca' },
      { nombre: 'Torta de naranja', precio: 28000, dibujo: 'torta', detalle: 'Por encargo' },
    ],
  },
  {
    id: 'ropa',
    etiqueta: 'Ropa',
    nombre: 'Lino Taller',
    direccion: `lino-taller.${ZONA_DE_LAS_TIENDAS}`,
    frase: 'Ropa de lino, hecha despacio.',
    productos: [
      { nombre: 'Camisa de lino', precio: 129000, dibujo: 'camisa', detalle: 'S · M · L' },
      { nombre: 'Pantalón amplio', precio: 149000, dibujo: 'pantalon', detalle: 'Quedan 2' },
      { nombre: 'Vestido largo', precio: 189000, dibujo: 'vestido' },
      { nombre: 'Bolso tejido', precio: 98000, dibujo: 'bolso', detalle: 'Agotado' },
    ],
  },
  {
    id: 'belleza',
    etiqueta: 'Belleza',
    nombre: 'Raíz Natural',
    direccion: `raiz-natural.${ZONA_DE_LAS_TIENDAS}`,
    frase: 'Cuidado de la piel, hecho a mano.',
    productos: [
      { nombre: 'Jabón de avena', precio: 18000, dibujo: 'jabon' },
      { nombre: 'Aceite capilar', precio: 42000, dibujo: 'aceite' },
      { nombre: 'Crema de manos', precio: 24000, dibujo: 'crema' },
      { nombre: 'Vela de lavanda', precio: 32000, dibujo: 'vela' },
    ],
  },
];

/** «$1.500», con el punto de miles de Colombia y sin `Intl`: el HTML sale igual en todas partes. */
export function pesos(n: number): string {
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Los pasos del pedido que el teléfono muestra al bajar. */
export const PASOS_DEL_PEDIDO = [
  {
    id: 'elige',
    titulo: 'Tu cliente entra y elige',
    texto:
      'Comparte tu dirección por WhatsApp, Instagram o un código QR. Tu catálogo abre rápido hasta en un teléfono sencillo, con fotos, precios y lo que te queda.',
  },
  {
    id: 'arma',
    titulo: 'Arma su pedido sin escribirte',
    texto:
      'Elige cantidades, tallas o colores, ve el costo del envío y cómo puede pagar: a convenir, transferencia, contraentrega o en línea.',
  },
  {
    id: 'llega',
    titulo: 'Te llega por WhatsApp, completo',
    texto:
      'El pedido llega a tu WhatsApp con todo lo que pidió, el total y un número para seguirlo. Nada de preguntar «¿cuánto vale?» diez veces.',
  },
  {
    id: 'confirma',
    titulo: 'Lo confirmas y lo despachas',
    texto:
      'Desde tu panel confirmas y marcas el despacho, y tu cliente sigue cada paso con su enlace.',
  },
] as const;

/** Lo que trae TiendaPro: cada punto con lo que cubre, sin promesas que el producto no cumple. */
export const LO_QUE_INCLUYE = [
  {
    titulo: 'Cobra en línea con tu cuenta de Bold',
    texto:
      'Tus clientes pagan con los medios de Bold, en tu propia cuenta. El dinero llega directo a ti: TiendaPro no lo recibe ni cobra comisión por tus ventas.',
  },
  {
    titulo: 'Contraentrega y transferencia',
    texto:
      'Ofrece las formas de pago que ya usan tus clientes, y lleva la cuenta de lo que la transportadora te debe consignar.',
  },
  {
    titulo: 'Tu propio dominio',
    texto: `Empieza en ${ZONA_DE_LAS_TIENDAS} y, cuando quieras, conecta tutienda.co con el candado listo.`,
  },
  {
    titulo: 'Listo para Google y Meta',
    texto: 'Tu catálogo sale listo para Google y Meta, y se pone al día cada vez que publicas.',
  },
  {
    titulo: 'Tus existencias, a la vista',
    texto:
      'Llevas lo que te queda desde el panel, y lo agotado se muestra así, con «Avísame cuando haya».',
  },
  {
    titulo: 'Lo que pide la ley, listo',
    texto:
      'Términos, privacidad, retracto, garantía y un formulario de solicitudes con su número de radicado, armados con tus datos.',
  },
] as const;

export interface PlanDeLaLanding {
  id: string;
  nombre: string;
  gratuito: boolean;
  precioMes: number;
  paraQuien: string;
  incluye: string[];
  /** Lo que cuesta pagar 12 meses, y cuánto se ahorra frente a 12 pagos de un mes. */
  anual: { total: number; ahorro: number } | null;
  productos: number | null;
}

/** Los planes de `planes.json`, con lo de `funciones.json` que la página dice en palabras. */
export function planesDeLaLanding(): PlanDeLaLanding[] {
  const limite = (f: Record<string, unknown>, id: string) => {
    const v = f[id];
    return typeof v === 'number' ? v : null;
  };
  return planes.planes.map((p) => {
    const cobro = ('cobro' in p ? p.cobro : {}) as Record<string, number>;
    const mes = cobro['1'] ?? 0;
    const anual = cobro['12'];
    return {
      id: p.id,
      nombre: p.nombre,
      gratuito: 'gratuito' in p && p.gratuito === true,
      precioMes: mes,
      paraQuien: p.para_quien,
      incluye: p.incluye,
      anual: anual ? { total: anual, ahorro: mes * 12 - anual } : null,
      productos: limite(funciones.productos, p.id),
    };
  });
}

export const PREGUNTAS = [
  {
    pregunta: '¿Necesito saber de tecnología?',
    respuesta:
      'No. Todo se hace desde el teléfono: escribes el nombre de tu tienda, eliges tu dirección, subes tus productos con foto y publicas. Si algo falta, el panel te dice qué y dónde.',
  },
  {
    pregunta: '¿Cuánto cuesta empezar?',
    respuesta:
      'Nada. El plan Gratis no vence: hasta 10 productos y los pedidos a tu WhatsApp. Cuando quieras cobrar en línea o tener tu dominio, pasas a Pro.',
  },
  {
    pregunta: '¿Cómo me pagan mis clientes?',
    respuesta:
      'Como prefieras: a convenir, transferencia, contraentrega o en línea con tu cuenta de Bold. Lo que se paga en línea llega directo a tu cuenta; TiendaPro no recibe ese dinero.',
  },
  {
    pregunta: '¿Puedo usar mi propio dominio?',
    respuesta: `Sí, desde el plan Pro. Mientras tanto, tu tienda vive en tunombre.${ZONA_DE_LAS_TIENDAS}, con su candado.`,
  },
  {
    pregunta: '¿Qué pasa si dejo de pagar?',
    respuesta:
      'Tienes 7 días de gracia. Después tu tienda sigue vendiendo por WhatsApp con lo del plan Gratis; lo que pasa del límite se oculta, nunca se borra, y vuelve al pagar.',
  },
  {
    pregunta: '¿Y si quiero irme?',
    respuesta:
      'Descargas todo lo tuyo desde el panel y das de baja la tienda tú mismo, sin llamar a nadie.',
  },
  {
    pregunta: '¿Qué pasa con los datos de mis clientes?',
    respuesta:
      'Son tuyos. Se guardan cifrados, nadie de TiendaPro los ve sin que quede registrado, y tus clientes pueden pedirte por la tienda que los corrijas o los borres.',
  },
] as const;

/** `llms.txt` (ADR-24): qué es TiendaPro y dónde leer, para los asistentes y los buscadores. */
export function llmsTxt(): string {
  const lineas = planesDeLaLanding().map(
    (p) =>
      `- ${p.nombre}: ${p.gratuito ? 'gratis' : `${pesos(p.precioMes)} al mes`}. ${p.incluye.join('; ')}.`,
  );
  return [
    `# ${MARCA}`,
    '',
    `> Plataforma colombiana para crear una tienda en línea desde el teléfono. Los pedidos llegan al WhatsApp del comercio; también cobra en línea con la cuenta de Bold del comercio. Las tiendas viven en <nombre>.${ZONA_DE_LAS_TIENDAS} o en el dominio propio del comercio.`,
    '',
    '## Planes',
    '',
    ...lineas,
    '',
    '## Enlaces',
    '',
    `- [Crear una tienda](${PANEL})`,
    `- [Política de tratamiento de datos](${ORIGEN}/legal/datos/)`,
    `- [Términos del servicio](${ORIGEN}/legal/terminos/)`,
    '',
  ].join('\n');
}
