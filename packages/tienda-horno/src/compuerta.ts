/**
 * La compuerta de publicación (HU-T4.3, TIENDA-3.0 §10.2): mira lo que se va a publicar **de esa
 * tienda**, no la suite (P11), y devuelve todas las fallas a la vez, cada una con qué hacer y
 * dónde (P15). Pura: la API la corre antes de guardar nada.
 *
 * Las comprobaciones de §10.2, y en qué estado está cada una:
 * 1. ficha legal completa, y 4. WhatsApp verificado: `faltantes()` de `@ed1/tienda-schema`; el
 *    pago en línea se ofrece cuando exista el cobro (M3), y mientras tanto detiene;
 * 2. ningún texto visible con `[`, `{{`, `undefined` o `NaN`;
 * 3. al menos un producto activo con precio, y cada activo con su foto;
 * 5. un envío de más de 30 días lo dice en su texto (Ley 2439);
 * 6. todo producto sin retracto tiene su motivo;
 * 7. el pie enlaza a la SIC, a los textos legales y a las solicitudes (HU-T7.1): un texto que falta
 *    es un enlace roto, y un dato de la ficha que falta deja su `{{campo}}` a la vista;
 * 8. cada página pesa lo que permite el presupuesto; el validador de HTML llega con HU-T3.6;
 * 9. los enlaces internos existen, también los de `llms.txt` (HU-T15.1). Las huellas del manifiesto las verifica la publicación al
 *    releerlo (HU-T4.4).
 */
import { faltantes, type Seccion } from '@ed1/tienda-schema';
import { enlacesDeLlms } from './agentes.ts';
import type { ArchivoHorneado } from './horno.ts';

export type CodigoDeFalla =
  | 'dato-faltante'
  | 'pago-en-linea'
  | 'texto-de-fabrica'
  | 'sin-producto'
  | 'sin-foto'
  | 'envio'
  | 'retracto'
  | 'pie-legal'
  | 'peso'
  | 'enlace-roto';

export interface Falla {
  codigo: CodigoDeFalla;
  /** Qué hacer, en palabras. */
  mensaje: string;
  /** Dónde se arregla, en el panel. */
  donde: string;
}

export interface ProductoParaLaCompuerta {
  slug: string;
  nombre: string;
  estado: 'activo' | 'borrador' | 'archivado';
  precioCop: number | null;
  fotos: number;
  retracto: 'aplica' | 'no_aplica';
  retractoMotivo?: string | null;
}

export interface EntradaDeLaCompuerta {
  ajustes: Partial<Record<Seccion, Record<string, unknown>>>;
  productos: readonly ProductoParaLaCompuerta[];
  archivos: ReadonlyMap<string, ArchivoHorneado>;
  envios?: readonly { nombre: string; plazoDias: number; texto?: string }[];
  /**
   * Comprobaciones que se saltan, con nombre. Solo para los comercios de prueba de staging, que
   * no tienen fotos hasta HU-T8.3. Nunca en producción.
   */
  omitir?: readonly CodigoDeFalla[];
}

/** El peso máximo de una página horneada (TIENDA §1.3: que abra en un teléfono barato). */
export const PESO_MAXIMO_HTML = 60 * 1024;
/** Rutas que existen sin hornearse: los assets, el tema, la API y `security.txt`. */
const SIN_HORNEAR = [
  /^\/_t\//,
  /^\/tema-[0-9a-f]+\.css$/,
  /^\/api\//,
  /^\/_m$/,
  /^\/mcp/,
  /^\/\.well-known\//,
];
const SIC = 'https://www.sic.gov.co';

const CAMPOS: Record<string, [string, string]> = {
  'identidad.nombre': ['Escribe el nombre de tu tienda', 'Ajustes › Identidad'],
  'venta.modo': ['Elige cómo recibes los pedidos', 'Ajustes › Venta'],
  'venta.formas': ['Elige al menos una forma de pago', 'Ajustes › Venta'],
  'legal.razonSocial': ['Escribe tu razón social o tu nombre completo', 'Ajustes › Datos legales'],
  'legal.tipoPersona': [
    'Di si vendes como persona natural o como empresa',
    'Ajustes › Datos legales',
  ],
  'legal.documento': ['Escribe tu NIT o tu cédula', 'Ajustes › Datos legales'],
  'legal.direccionNotificacion': [
    'Escribe la dirección donde recibes notificaciones',
    'Ajustes › Datos legales',
  ],
  'legal.ciudad': ['Escribe tu ciudad', 'Ajustes › Datos legales'],
  'legal.telefono': ['Escribe un teléfono de contacto', 'Ajustes › Datos legales'],
  'legal.correo': ['Escribe un correo de contacto', 'Ajustes › Datos legales'],
  'contacto.whatsapp': ['Escribe el WhatsApp donde recibes los pedidos', 'Ajustes › Contacto'],
  'contacto.whatsappVerificado': [
    'Confirma tu WhatsApp con el mensaje de prueba',
    'Ajustes › Contacto',
  ],
};

/** El texto que ve la persona: sin etiquetas, sin scripts ni estilos. */
const textoVisible = (html: string) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

/** El archivo horneado al que lleva un enlace interno: `/p/x/` es `/p/x/index.html`. */
const archivoDelEnlace = (ruta: string) => (ruta.endsWith('/') ? `${ruta}index.html` : ruta);

export function compuerta(e: EntradaDeLaCompuerta): { ok: boolean; fallas: Falla[] } {
  const fallas: Falla[] = [];
  const omitir = new Set(e.omitir ?? []);
  const fallar = (f: Falla) => {
    if (!omitir.has(f.codigo)) fallas.push(f);
  };

  for (const campo of faltantes(e.ajustes)) {
    const [mensaje, donde] = CAMPOS[campo] ?? [`Completa ${campo}`, 'Ajustes'];
    fallar({ codigo: 'dato-faltante', mensaje, donde });
  }
  const modo = e.ajustes.venta?.['modo'];
  if (modo === 'en_linea' || modo === 'ambos') {
    fallar({
      codigo: 'pago-en-linea',
      mensaje: 'El cobro en línea todavía no está listo: por ahora recibe los pedidos por WhatsApp',
      donde: 'Ajustes › Venta',
    });
  }

  const html = [...e.archivos].filter(([r]) => r.endsWith('.html'));
  for (const [ruta, a] of html) {
    const raro = /\[|\{\{|\bundefined\b|\bNaN\b/.exec(textoVisible(a.contenido));
    if (raro) {
      fallar({
        codigo: 'texto-de-fabrica',
        mensaje: `La página ${ruta} muestra «${raro[0]}»: revisa los textos de la tienda`,
        donde: 'Productos y Ajustes',
      });
    }
    if (new TextEncoder().encode(a.contenido).length > PESO_MAXIMO_HTML) {
      fallar({
        codigo: 'peso',
        mensaje: `La página ${ruta} pesa demasiado para abrir rápido en un teléfono: acorta su texto`,
        donde: 'Productos',
      });
    }
    for (const m of a.contenido.matchAll(/href="(\/[^"#?]*)/g)) {
      const destino = m[1] ?? '';
      if (destino.startsWith('//') || SIN_HORNEAR.some((r) => r.test(destino))) continue;
      if (!e.archivos.has(archivoDelEnlace(destino))) {
        fallar({
          codigo: 'enlace-roto',
          mensaje: `La página ${ruta} enlaza a ${destino}, que no existe`,
          donde: 'Productos y Colecciones',
        });
      }
    }
  }
  for (const destino of enlacesDeLlms(e.archivos.get('/llms.txt')?.contenido ?? '')) {
    if (!e.archivos.has(archivoDelEnlace(destino))) {
      fallar({
        codigo: 'enlace-roto',
        mensaje: `El índice para asistentes (llms.txt) enlaza a ${destino}, que no existe`,
        donde: 'Productos y Colecciones',
      });
    }
  }
  const portada = e.archivos.get('/index.html')?.contenido ?? '';
  if (!portada.includes(`href="${SIC}`)) {
    fallar({
      codigo: 'pie-legal',
      mensaje:
        'El pie de la tienda tiene que enlazar a la Superintendencia de Industria y Comercio',
      donde: 'Soporte',
    });
  }

  const activos = e.productos.filter((p) => p.estado === 'activo');
  if (!activos.some((p) => p.precioCop !== null && p.precioCop > 0)) {
    fallar({
      codigo: 'sin-producto',
      mensaje: 'Activa al menos un producto con su precio',
      donde: 'Productos',
    });
  }
  for (const p of activos.filter((x) => x.fotos === 0)) {
    fallar({ codigo: 'sin-foto', mensaje: `Sube una foto de «${p.nombre}»`, donde: 'Productos' });
  }
  for (const p of e.productos.filter(
    (x) => x.retracto === 'no_aplica' && !x.retractoMotivo?.trim(),
  )) {
    fallar({
      codigo: 'retracto',
      mensaje: `Di por qué «${p.nombre}» no admite retracto (por ejemplo, porque es perecedero)`,
      donde: 'Productos',
    });
  }
  for (const envio of e.envios ?? []) {
    if (envio.plazoDias > 30 && !/\d+\s*d[ií]as/i.test(envio.texto ?? '')) {
      fallar({
        codigo: 'envio',
        mensaje: `El envío «${envio.nombre}» tarda más de 30 días: dilo en su texto, con el plazo`,
        donde: 'Envíos',
      });
    }
  }
  return { ok: fallas.length === 0, fallas };
}
