/**
 * Los textos legales de cada tienda (HU-T7.1, TIENDA-3.0 §8.5, §14.3 y §14.4), llenos desde las
 * plantillas de `content/tienda/legal/` (importadas ya generadas: el Worker no lee archivos).
 *
 * - Las plantillas son nuestras; los datos son del comercio. Por eso primero se arma el HTML de la
 *   plantilla y **después** se ponen los datos, escapados: nada que escriba el comercio se vuelve
 *   HTML, salvo sus textos de garantía y retracto, que pasan por `markdownSeguro` (HU-T4.2).
 * - Un dato que falta deja su `{{campo}}` a la vista: la compuerta lo ve y no publica (CA3).
 * - Los subencargados se nombran con su país (Ley 1581, Decreto 1377 art. 25), sin contar cómo está
 *   hecha la tienda.
 */
import { formatearPesos } from '@ed1/dinero';
import { escaparHtml, markdownPlano, markdownSeguro } from './escapar.ts';
import plantillas from './legal.generado.json' with { type: 'json' };

export type FormaDePago =
  | 'a_convenir'
  | 'en_linea'
  | 'contraentrega'
  | 'transferencia'
  | 'efectivo';

export interface DatosLegales {
  nombreTienda: string;
  razonSocial?: string;
  documento?: { tipo: 'NIT' | 'CC' | 'CE'; numero: string };
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  correo?: string;
  whatsapp?: string;
  formas: readonly { forma: FormaDePago; ciudades?: readonly string[] | null }[];
  envios: readonly {
    nombre: string;
    precioCop: number;
    gratisDesdeCop: number | null;
    diasMin: number | null;
    diasMax: number | null;
  }[];
  sinRetracto: readonly { nombre: string; motivo: string }[];
  /** Lo que el comercio agrega a la garantía y al retracto de la ley (Markdown del comercio). */
  garantia?: string;
  retracto?: string;
  medicion: { ga4: boolean; pixelMeta: boolean };
  /** Si el comercio es responsable de IVA: la ficha dice «con IVA incluido» solo entonces. */
  responsableIva?: boolean;
}

export interface TextoLegal {
  id: string;
  titulo: string;
  /** La ruta de la página: `/legal/terminos/`. */
  ruta: string;
  markdown: string;
  html: string;
}

export const VERSION_DE_LAS_PLANTILLAS: string = plantillas.version;
export const TEXTOS_LEGALES: readonly { id: string; titulo: string; ruta: string }[] =
  plantillas.textos.map(({ id, titulo, ruta }) => ({ id, titulo, ruta }));

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
/** `2026-10-14` → `14 de octubre de 2026`, con los meses escritos aquí: los mismos bytes en todo runtime (P17). */
export const fechaEnPalabras = (iso: string): string => {
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${a}`;
};

/** `+573001234567` → `+57 300 123 4567`; otro número, como viene. */
export const telefonoLegible = (e164: string): string => {
  const m = /^\+57(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : e164;
};

const DOCUMENTO = { NIT: 'NIT', CC: 'cédula de ciudadanía', CE: 'cédula de extranjería' } as const;

const FORMAS: Record<FormaDePago, string> = {
  a_convenir: 'La que acuerdes con la tienda al confirmar tu pedido.',
  en_linea: 'En línea, en la página de pago segura, con los medios que allí aparecen.',
  contraentrega: 'Contra entrega: pagas cuando recibes tu pedido',
  transferencia: 'Transferencia a la cuenta que la tienda te indica al confirmar tu pedido.',
  efectivo: 'En efectivo, al recibir o recoger tu pedido.',
};

/** Un bloque: su Markdown para el gemelo y su HTML, ya seguro. Vacío: el párrafo desaparece. */
interface Bloque {
  md: string;
  html: string;
}

const lista = (items: readonly string[]): Bloque => ({
  md: items.map((i) => `- ${markdownPlano(i)}`).join('\n'),
  html: `<ul>${items.map((i) => `<li>${escaparHtml(i)}</li>`).join('')}</ul>`,
});
const parrafo = (texto: string): Bloque => ({
  md: markdownPlano(texto),
  html: `<p>${escaparHtml(texto)}</p>`,
});
const VACIO: Bloque = { md: '', html: '' };

const dias = (min: number | null, max: number | null) => {
  if (max === null && min === null) return 'el plazo que te confirma la tienda';
  if (min !== null && max !== null && min !== max) return `de ${min} a ${max} días`;
  const n = max ?? min ?? 0;
  return `${n} ${n === 1 ? 'día' : 'días'}`;
};

function bloques(d: DatosLegales): Record<string, Bloque> {
  const formas = d.formas.map((f) =>
    f.forma === 'contraentrega'
      ? `${FORMAS.contraentrega}${f.ciudades && f.ciudades.length > 0 ? `, en ${f.ciudades.join(', ')}` : ''}.`
      : FORMAS[f.forma],
  );
  const subencargados = [
    'Cloudflare, Inc. (Estados Unidos): guarda la tienda y sus datos, y la mantiene abierta.',
    'WhatsApp LLC (Estados Unidos): si envías tu pedido por WhatsApp, el mensaje viaja por su servicio hasta la tienda.',
    ...(d.medicion.ga4
      ? ['Google LLC (Estados Unidos): cuenta las visitas a la tienda, si lo aceptas.']
      : []),
    ...(d.medicion.pixelMeta
      ? ['Meta Platforms, Inc. (Estados Unidos): mide los anuncios de la tienda, si lo aceptas.']
      : []),
  ];
  const agregado = (titulo: string, texto: string | undefined): Bloque =>
    texto?.trim()
      ? {
          md: `## ${titulo}\n\n${markdownPlano(texto)}`,
          html: `<h2>${escaparHtml(titulo)}</h2>\n${markdownSeguro(texto)}`,
        }
      : VACIO;
  return {
    formas_de_pago:
      formas.length > 0
        ? lista(formas)
        : { md: '{{formas_de_pago}}', html: '<p>{{formas_de_pago}}</p>' },
    opciones_de_envio:
      d.envios.length > 0
        ? lista(
            d.envios.map(
              (e) =>
                `${e.nombre}: ${e.precioCop === 0 ? 'gratis' : formatearPesos(e.precioCop)}${
                  e.gratisDesdeCop !== null && e.precioCop > 0
                    ? `, gratis desde ${formatearPesos(e.gratisDesdeCop)}`
                    : ''
                }; llega en ${dias(e.diasMin, e.diasMax)}.`,
            ),
          )
        : parrafo(
            'La tienda acuerda contigo el envío al confirmar tu pedido, con su costo y su plazo.',
          ),
    productos_sin_retracto:
      d.sinRetracto.length > 0
        ? lista(d.sinRetracto.map((p) => `${p.nombre}: ${p.motivo}`))
        : parrafo('Todos los productos de esta tienda admiten retracto.'),
    subencargados: lista(subencargados),
    medicion: d.medicion.ga4
      ? parrafo(
          'Si lo aceptas, la tienda cuenta sus visitas para saber qué productos interesan más. Esa medición no usa tu nombre ni tu número, y puedes rechazarla sin que cambie nada de tu compra.',
        )
      : parrafo('Esta tienda no usa cookies de medición ni de publicidad.'),
    garantia_del_comercio: agregado('Lo que agrega la tienda', d.garantia),
    retracto_del_comercio: agregado('Lo que agrega la tienda', d.retracto),
  };
}

function campos(d: DatosLegales): Record<string, string | undefined> {
  return {
    nombre_tienda: d.nombreTienda,
    razon_social: d.razonSocial,
    documento: d.documento ? `${DOCUMENTO[d.documento.tipo]} ${d.documento.numero}` : undefined,
    direccion: d.direccion,
    ciudad: d.ciudad,
    telefono: d.telefono ? telefonoLegible(d.telefono) : undefined,
    correo: d.correo,
    whatsapp: d.whatsapp ? telefonoLegible(d.whatsapp) : undefined,
    version: plantillas.version,
    fecha_plantilla: fechaEnPalabras(plantillas.fecha),
  };
}

/** Lo de una línea de la plantilla: escapado, con negrita y enlaces internos o `https`. */
function enLinea(texto: string): string {
  return escaparHtml(texto)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** El HTML de una plantilla (nuestra): títulos, párrafos y listas, con los `{{campo}}` intactos. */
export function htmlDePlantilla(md: string): string {
  return md
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((bloque) => {
      if (bloque.startsWith('## ')) return `<h2>${enLinea(bloque.slice(3))}</h2>`;
      const lineas = bloque.split('\n');
      if (lineas.every((l) => /^- /.test(l))) {
        return `<ul>${lineas.map((l) => `<li>${enLinea(l.slice(2))}</li>`).join('')}</ul>`;
      }
      if (lineas.every((l) => /^\d+\. /.test(l))) {
        return `<ol>${lineas.map((l) => `<li>${enLinea(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
      }
      return `<p>${lineas.map(enLinea).join('<br>')}</p>`;
    })
    .join('\n');
}

export function textosLegales(d: DatosLegales): TextoLegal[] {
  const b = bloques(d);
  const c = campos(d);
  return plantillas.textos.map((t) => {
    let markdown = t.plantilla;
    let html = htmlDePlantilla(t.plantilla);
    for (const [clave, bloque] of Object.entries(b)) {
      markdown = markdown.replace(`{{${clave}}}`, bloque.md);
      html = html.replace(`<p>{{${clave}}}</p>`, bloque.html);
    }
    for (const [clave, valor] of Object.entries(c)) {
      if (valor === undefined || valor.trim() === '') continue;
      markdown = markdown.replaceAll(`{{${clave}}}`, markdownPlano(valor));
      html = html.replaceAll(`{{${clave}}}`, escaparHtml(valor));
    }
    return {
      id: t.id,
      titulo: t.titulo,
      ruta: t.ruta,
      markdown: `# ${t.titulo}\n\n${markdown.replace(/\n{3,}/g, '\n\n').trim()}\n`,
      html: `<h1>${escaparHtml(t.titulo)}</h1>\n<div class="legal">\n${html.replace(/\n{2,}/g, '\n')}\n</div>`,
    };
  });
}
