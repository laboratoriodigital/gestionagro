/**
 * La compuerta de publicación (HU-T4.3, TIENDA-3.0 §10.2): mira lo que se va a publicar **de esa
 * tienda**, no la suite (P11), y devuelve todas las fallas a la vez, cada una con qué hacer y
 * dónde (P15). Pura: la API la corre antes de guardar nada.
 *
 * Las comprobaciones de §10.2, y en qué estado está cada una:
 * 1. ficha legal completa, y 4. WhatsApp verificado: `faltantes()` de `@ed1/tienda-schema`; el
 *    pago en línea pide las llaves de Bold del ambiente en que cobra y, para cobrar de verdad, el
 *    cobro de prueba aprobado (HU-T11.3);
 * 2. ningún texto visible con `[`, `{{`, `undefined` o `NaN`;
 * 3. al menos un producto activo con precio, y cada activo con su foto;
 * 5. un envío de más de 30 días lo dice en su texto (Ley 2439);
 * 6. todo producto sin retracto tiene su motivo;
 * 7. el pie enlaza a la SIC, a los textos legales y a las solicitudes (HU-T7.1): un texto que falta
 *    es un enlace roto, y un dato de la ficha que falta deja su `{{campo}}` a la vista;
 * 8. cada página pesa lo que permite el presupuesto (la portada, menos: TIENDA §1.3), y nada va en
 *    línea ni viene de un tercero: ni `<style>`, ni `style=`, ni un script que no sea un archivo propio
 *    o datos (HU-T3.6 CA3), porque la CSP lo bloquearía en silencio;
 * 9. los enlaces internos existen, también los de `llms.txt` (HU-T15.1). Las huellas del manifiesto las verifica la publicación al
 *    releerlo (HU-T4.4);
 * 10. cada habilidad para agentes es la que se hornea, con su huella (HU-T15.3 CA2,
 *    `revisarHabilidades`, aparte porque la huella es asíncrona).
 */
import { faltantes, type Seccion } from '@ed1/tienda-schema';
import { enlacesDeLlms, RUTA_DE_LAS_HABILIDADES } from './agentes.ts';
import { type ArchivoHorneado, huella } from './horno.ts';

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
  | 'enlace-roto'
  | 'en-linea'
  | 'habilidad';

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
   * HU-T11.3: el cobro en línea de la tienda, si lo ofrece. Sin las llaves del ambiente en que cobra
   * no se publica así; en producción, tampoco sin el cobro de prueba aprobado.
   */
  cobro?: { ambiente: 'pruebas' | 'produccion'; llaves: boolean; pruebaAprobada: boolean };
  /**
   * Comprobaciones que se saltan, con nombre. Solo para los comercios de prueba de staging, que
   * no tienen fotos hasta HU-T8.3. Nunca en producción.
   */
  omitir?: readonly CodigoDeFalla[];
}

/** El peso máximo de una página horneada (TIENDA §1.3: que abra en un teléfono barato). */
export const PESO_MAXIMO_HTML = 60 * 1024;
/** La portada, la que más se abre: «HTML de la portada < 50 KB» (TIENDA §1.3). */
export const PESO_MAXIMO_PORTADA = 50 * 1024;

/** Lo que la CSP de la vitrina bloquearía, o lo que viene de un tercero (HU-T3.6 CA3). */
export function enLinea(html: string): string | null {
  if (/<style\b/i.test(html)) return 'un <style>';
  if (/\sstyle\s*=/i.test(html)) return 'un atributo style';
  if (/\son[a-z]+\s*=/i.test(html)) return 'un manejador en línea (on…=)';
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
    const atributos = m[1] ?? '';
    const src = /\ssrc="([^"]*)"/i.exec(atributos)?.[1];
    if (src !== undefined) {
      if (!src.startsWith('/') || src.startsWith('//')) return `un script de afuera (${src})`;
      continue;
    }
    if (!/type="application\/(ld\+)?json"/i.test(atributos)) return 'un script en línea';
  }
  for (const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)) {
    const href = /href="([^"]*)"/i.exec(m[0])?.[1] ?? '';
    if (!href.startsWith('/') || href.startsWith('//')) return `una hoja de afuera (${href})`;
  }
  return null;
}
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
    const c = e.cobro;
    if (!c?.llaves) {
      fallar({
        codigo: 'pago-en-linea',
        mensaje: `Pega tus llaves de Bold de ${c?.ambiente === 'produccion' ? 'producción' : 'pruebas'} para cobrar en línea, o recibe los pedidos solo por WhatsApp`,
        donde: 'Más › Cobro en línea',
      });
    } else if (c.ambiente === 'produccion' && !c.pruebaAprobada) {
      fallar({
        codigo: 'pago-en-linea',
        mensaje: 'Haz el cobro de prueba antes de cobrar de verdad',
        donde: 'Más › Cobro en línea',
      });
    }
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
    const bytes = new TextEncoder().encode(a.contenido).length;
    const tope = ruta === '/index.html' ? PESO_MAXIMO_PORTADA : PESO_MAXIMO_HTML;
    if (bytes > tope) {
      fallar({
        codigo: 'peso',
        mensaje: `La página ${ruta} pesa ${Math.ceil(bytes / 1024)} KB y el tope es ${tope / 1024} KB: acorta su texto para que abra rápido en un teléfono`,
        donde: 'Productos',
      });
    }
    const prohibido = enLinea(a.contenido);
    if (prohibido) {
      fallar({
        codigo: 'en-linea',
        mensaje: `La página ${ruta} trae ${prohibido}, y la tienda solo carga lo suyo: escríbenos a soporte`,
        donde: 'Soporte',
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

/**
 * HU-T15.3 CA2: cada habilidad del índice existe en lo horneado y su `sha256` es la de su archivo.
 * Una huella que no coincide le daría a un agente instrucciones que no son las publicadas, y el
 * agente que la verifica la descartaría: la tienda dejaría de explicar cómo se compra en ella.
 */
export async function revisarHabilidades(
  archivos: ReadonlyMap<string, ArchivoHorneado>,
): Promise<Falla[]> {
  const donde = 'Soporte';
  const indice = archivos.get(`${RUTA_DE_LAS_HABILIDADES}index.json`);
  if (!indice) {
    return [
      { codigo: 'habilidad', mensaje: 'Falta el índice de habilidades para asistentes', donde },
    ];
  }
  let skills: { name?: unknown; url?: unknown; sha256?: unknown }[] = [];
  try {
    skills = (JSON.parse(indice.contenido) as { skills?: typeof skills }).skills ?? [];
  } catch {
    return [{ codigo: 'habilidad', mensaje: 'El índice de habilidades no se puede leer', donde }];
  }
  const fallas: Falla[] = [];
  for (const s of skills) {
    let ruta = '';
    try {
      ruta = new URL(String(s.url)).pathname;
    } catch {
      // Sin una dirección que se lea, la habilidad no existe.
    }
    const archivo = archivos.get(ruta);
    if (!archivo) {
      fallas.push({
        codigo: 'habilidad',
        mensaje: `La habilidad «${String(s.name)}» no está en la tienda`,
        donde,
      });
    } else if ((await huella(archivo.contenido)) !== s.sha256) {
      fallas.push({
        codigo: 'habilidad',
        mensaje: `La huella de la habilidad «${String(s.name)}» no es la de su archivo`,
        donde,
      });
    }
  }
  return fallas;
}
