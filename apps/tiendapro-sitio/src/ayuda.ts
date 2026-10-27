/**
 * La ayuda de TiendaPro (HU-P5.1, sprint PF1): una guía corta para cada cosa que el comerciante
 * hace por primera vez. Salen de los runbooks, sin lo técnico; los nombres de las pantallas son los
 * del panel. Los nombres de las guías son los de `GUIAS_DE_AYUDA`: el panel enlaza a ellas.
 */
import { CHAT_DE_SOPORTE, type GuiaDeAyuda, ZONA_DE_LAS_TIENDAS } from '@ed1/tienda-schema/marca';

export { CHAT_DE_SOPORTE };

export interface Guia {
  slug: GuiaDeAyuda;
  titulo: string;
  /** Una frase: para qué sirve y cuánto toma. */
  resumen: string;
  /** El plan desde el que se puede, si no es en todos. */
  plan?: 'Pro';
  /** Dónde empieza en el panel, como lo lee el comerciante. */
  donde: string;
  pasos: string[];
  /** Lo que conviene saber, o lo que suele fallar. */
  notas?: string[];
}

export const GUIAS: Guia[] = [
  {
    slug: 'primer-producto',
    titulo: 'Tu primer producto',
    resumen: 'Sube un producto con su foto, su precio y sus tallas o colores. Toma unos minutos.',
    donde: 'Productos › Nuevo producto',
    pasos: [
      'En tu panel, toca «Productos» abajo y luego «Nuevo producto».',
      'Escribe el nombre y una descripción corta, como se la dirías a un cliente.',
      'Sube las fotos desde tu teléfono. Se achican solas para que tu tienda abra rápido.',
      'Si tiene tallas, colores o tamaños, agrégalos como opciones. Cada combinación lleva su precio y cuántas te quedan.',
      'Guarda. El producto queda listo, pero tus clientes lo ven cuando publiques.',
    ],
    notas: [
      'Si una combinación se agota, la tienda la muestra agotada y tu cliente puede pedirte que le avises por WhatsApp.',
      'En el plan Gratis tu tienda muestra hasta 10 productos.',
    ],
  },
  {
    slug: 'publicar',
    titulo: 'Publicar tu tienda',
    resumen: 'Lleva lo que cambiaste a tu tienda en línea, y vuelve atrás si algo no te gusta.',
    donde: 'Más › Publicar y versiones',
    pasos: [
      'Toca «Más» y luego «Publicar y versiones».',
      'Toca «Publicar». Si falta algo, como tus datos legales o tu WhatsApp, el panel te dice qué falta y dónde.',
      'En un momento tu tienda queda en línea, en tunombre.' +
        ZONA_DE_LAS_TIENDAS +
        '. Puedes abrirla y copiarla desde el Inicio del panel.',
      'Cada publicación queda guardada como una versión. Si algo no te gustó, en «Versiones» vuelves a la anterior en segundos.',
    ],
    notas: [
      'Antes de publicar puedes ver cómo quedará con la vista previa, que solo ve quien tenga el enlace.',
    ],
  },
  {
    slug: 'cobro-en-linea',
    titulo: 'Cobrar en línea con tu Bold',
    resumen:
      'Conecta tu cuenta de Bold para que tus clientes paguen en tu tienda y el dinero llegue directo a ti.',
    plan: 'Pro',
    donde: 'Más › Cobro en línea',
    pasos: [
      'Toca «Más» y luego «Cobro en línea». La primera vez te pide aceptar los términos y autorizar el cuidado de tus llaves.',
      'En tu cuenta de Bold, busca las llaves de tu botón de pagos: la llave de identidad y la llave secreta, primero las de pruebas.',
      'Pégalas en el panel y toca «Guardar». El panel te dice si Bold las reconoció.',
      'Haz el cobro de prueba que te guía el panel: nadie paga de verdad y sirve para comprobar que todo funciona.',
      'Con la prueba aprobada, pega las llaves de producción y pasa a cobrar de verdad.',
      'En «Ajustes › Venta» elige cómo vendes: por WhatsApp, en línea o las dos.',
    ],
    notas: [
      'TiendaPro no recibe tu dinero ni cobra comisión por tus ventas. Bold cobra su tarifa en tu cuenta.',
      'Tus llaves se guardan cifradas. Si cambias de cuenta de Bold, pega las nuevas y repite el cobro de prueba.',
    ],
  },
  {
    slug: 'dominio',
    titulo: 'Conectar tu dominio',
    resumen:
      'Usa tu propia dirección, como www.tutienda.co, con el candado listo. Suele tomar de minutos a una hora.',
    plan: 'Pro',
    donde: 'Más › Tu dominio',
    pasos: [
      'Toca «Más» y luego «Tu dominio». Escribe tu dominio con «www», por ejemplo www.tutienda.co, y toca «Conectar».',
      'El panel te muestra tres registros, cada uno con su botón «Copiar». Créalos en el lugar donde compraste tu dominio, en este orden: los dos de tipo TXT primero y el CNAME de último.',
      'Vuelve al panel y espera: el estado pasa solo de «Esperando tus registros» a «Registros encontrados: preparando el candado» y luego a «Conectado».',
      'Ya conectado, toca «Usar como dirección principal». Tu dirección de ' +
        ZONA_DE_LAS_TIENDAS +
        ' llevará a tu dominio.',
    ],
    notas: [
      'Algunos proveedores agregan solos el final del nombre: si el tuyo lo hace, escribe solo la primera parte (por ejemplo «_acme-challenge.www»).',
      'Si tu proveedor dice que el CNAME choca con otro registro, como en Hostinger, borra primero el registro que ya tiene ese mismo nombre (casi siempre uno de tipo A que puso el proveedor) y vuelve a crear el CNAME.',
      'Para que tu dominio funcione también sin «www», conéctalo como segunda dirección, o configura en tu proveedor que lleve a la versión con «www».',
      'Si tu dominio está en Cloudflare, crea el CNAME con la nube gris (sin proxy).',
    ],
  },
  {
    slug: 'cargar-productos',
    titulo: 'Cargar tus productos desde una hoja',
    resumen: 'Sube muchos productos de una vez desde Excel o Google Sheets.',
    plan: 'Pro',
    donde: 'Más › Cargar productos y respaldos',
    pasos: [
      'Toca «Más» y luego «Cargar productos y respaldos». Baja la plantilla.',
      'Escribe una fila por cada talla o color de cada producto, con su precio y lo que te queda. Las filas del mismo producto llevan el mismo nombre.',
      'Sube la hoja. Antes de cargar, el panel te dice qué está mal y en qué fila, y cuántos productos van a entrar.',
      'Corrige lo que haga falta y toca «Cargar». Los nuevos se crean; los que ya tenías solo cambian en lo que trae la hoja.',
      'Publica para que tus clientes vean los cambios.',
    ],
    notas: [
      'La hoja que bajas en «Descargar todo» también sirve para subirla: así guardas un respaldo de tu tienda.',
    ],
  },
  {
    slug: 'contraentrega',
    titulo: 'Atender un pedido contra entrega',
    resumen: 'Del pedido que llega por WhatsApp hasta que la transportadora te consigna la plata.',
    donde: 'Pedidos',
    pasos: [
      'El pedido te llega por WhatsApp y aparece en «Pedidos». Ábrelo.',
      'Toca «Confirmar por WhatsApp» para escribirle a tu cliente y confirmar dirección y total. Luego confírmalo en el panel.',
      'Cuando lo entregues a la transportadora, toca «Despachar» y escribe la transportadora y el número de guía. Tu cliente lo sigue con su enlace.',
      'Cuando llegue, márcalo entregado. En «Pedidos › Recaudos» ves lo que la transportadora ya cobró y te falta que te consigne.',
      'Cuando te consigne, en «Recaudos» elige esos pedidos, escribe el número de la liquidación y toca «Liquidar».',
    ],
    notas: [
      'El Inicio del panel te avisa si un recaudo lleva más de 3 días hábiles sin liquidarse.',
    ],
  },
  {
    slug: 'google',
    titulo: 'Tu tienda en Google',
    resumen: 'Verifica tu tienda en Google Search Console para ver cómo te encuentran.',
    donde: 'Más › Ajustes de la tienda › Medición',
    pasos: [
      'En Google Search Console, agrega una propiedad de tipo «Prefijo de URL» con la dirección completa de tu tienda.',
      'Elige el método «Etiqueta HTML» y copia la etiqueta o el código.',
      'En tu panel, entra a «Más › Ajustes de la tienda › Medición», pégalo en «Código de Google Search Console» y guarda.',
      'Publica tu tienda y vuelve a Google a tocar «Verificar».',
      'Ya verificada, en «Sitemaps» envía la dirección de tu tienda seguida de sitemap.xml.',
    ],
    notas: [
      'La propiedad de tipo «Dominio» no sirve para una dirección de ' +
        ZONA_DE_LAS_TIENDAS +
        ': pide un registro que solo nosotros podemos crear.',
    ],
  },
];
