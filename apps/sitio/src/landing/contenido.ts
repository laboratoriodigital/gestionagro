/**
 * Lo que dice la landing de CultivoPro (HU-E0.10). Los planes y sus precios salen de
 * `content/agro/cuaderno/planes.json`, la misma fuente de la pantalla de Planes y del cobro (P2).
 * Las fincas del teléfono son de ejemplo y lo dicen (P4): ningún nombre real.
 */

import planes from '../../../../content/agro/cuaderno/planes.json' with { type: 'json' };
import marca from '../../../../content/marca.json' with { type: 'json' };
import { SITIO } from '../lib/seo.ts';

export const MARCA = marca.nombre;
export const HOJA = marca.hoja.d;
export const ORIGEN = SITIO;

/** A dónde lleva «Empezar» y «Entrar»: el cuaderno, que abre con su bienvenida. */
export const CUADERNO = '/agro/app/';
export const CALCULADORAS = '/herramientas/agro/';
export const PLANES_DEL_CUADERNO = '/agro/app/planes/';

export const TITULO = `${MARCA} · Tu cuaderno de campo, aunque no haya señal`;
export const DESCRIPCION =
  'Anota labores, aplicaciones y cosechas desde el teléfono, aunque no haya señal. Tu equipo anota contigo, sabes qué nave puedes cosechar hoy y tus datos son tuyos. Gratis para empezar.';

/** El estado de una nave en el teléfono de la portada. */
export interface NaveDeEjemplo {
  nombre: string;
  estado: 'lista' | 'carencia';
  /** Lo que dice la fila: «Se puede cosechar» o «Carencia: 2 días». */
  texto: string;
}

export interface CultivoDeEjemplo {
  id: 'tomate' | 'pepino' | 'flores';
  etiqueta: string;
  naves: NaveDeEjemplo[];
  /** Lo que se anotó hoy, con su hora: «Riego · Nave 1» y «7:40». */
  anotado: [string, string][];
}

/** Tres cultivos de una finca inventada, para mostrar el cuaderno (P4). */
export const FINCA_DE_EJEMPLO = 'Finca Ensayo Uno';

export const CULTIVOS_DE_EJEMPLO: CultivoDeEjemplo[] = [
  {
    id: 'tomate',
    etiqueta: 'Tomate',
    naves: [
      { nombre: 'Nave 1', estado: 'lista', texto: 'Se puede cosechar' },
      { nombre: 'Nave 2', estado: 'carencia', texto: 'Carencia: 2 días' },
      { nombre: 'Nave 3', estado: 'lista', texto: 'Se puede cosechar' },
    ],
    anotado: [
      ['Riego · Nave 1', '7:40'],
      ['Aplicación · Nave 2', '7:52'],
    ],
  },
  {
    id: 'pepino',
    etiqueta: 'Pepino',
    naves: [
      { nombre: 'Nave 4', estado: 'lista', texto: 'Se puede cosechar' },
      { nombre: 'Nave 5', estado: 'lista', texto: 'Se puede cosechar' },
      { nombre: 'Nave 6', estado: 'carencia', texto: 'Carencia: 5 días' },
    ],
    anotado: [
      ['Cosecha · Nave 4', '9:15'],
      ['Aplicación · Nave 6', '10:02'],
    ],
  },
  {
    id: 'flores',
    etiqueta: 'Flores',
    naves: [
      { nombre: 'Bloque 1', estado: 'carencia', texto: 'Reentrada: 6 horas' },
      { nombre: 'Bloque 2', estado: 'lista', texto: 'Se puede cortar' },
      { nombre: 'Bloque 3', estado: 'lista', texto: 'Se puede cortar' },
    ],
    anotado: [
      ['Aplicación · Bloque 1', '6:30'],
      ['Monitoreo · Bloque 2', '8:05'],
    ],
  },
];

/** Los pasos que el teléfono muestra al bajar, en «Así trabaja contigo». */
export const PASOS = [
  {
    id: 'anota',
    titulo: 'Anotas en el momento, desde la nave',
    texto:
      'Una aplicación, una labor, el riego o la cosecha, con pocos toques y con las manos ocupadas. El cuaderno ya sabe tus naves, tus insumos y tu gente.',
  },
  {
    id: 'guarda',
    titulo: 'Se guarda en tu teléfono, sin señal',
    texto:
      'Si en el invernadero no entra la señal, no pasa nada: lo que anotas queda guardado en tu teléfono y puedes seguir trabajando.',
  },
  {
    id: 'sube',
    titulo: 'Se sube solo cuando vuelve la señal',
    texto:
      'Al salir de la nave, tus registros se suben solos y tu equipo ve lo mismo que tú. Nadie tiene que pasar nada a limpio en la noche.',
  },
  {
    id: 'cosecha',
    titulo: 'Sabes qué puedes cosechar hoy',
    texto:
      'Con cada aplicación, el cuaderno cuenta la carencia y la reentrada. Abres el teléfono y ves qué nave está lista y cuál todavía no.',
  },
] as const;

/** Lo que trae el cuaderno: cada punto es algo que ya hace, sin promesas que no cumple. */
export const LO_QUE_INCLUYE = [
  {
    titulo: 'Todo lo del día, en un solo lugar',
    texto: 'Aplicaciones, labores, riego, clima, monitoreo de plagas y cosecha, nave por nave.',
  },
  {
    titulo: 'Carencias y reentrada a la vista',
    texto:
      'El calendario te dice qué nave puedes cosechar y cuándo puede volver a entrar tu gente.',
  },
  {
    titulo: 'Lotes con su etiqueta QR',
    texto: 'Tu comprador escanea la etiqueta y ve de dónde viene lo que compra.',
  },
  {
    titulo: 'Tu equipo, cada uno en su teléfono',
    texto:
      'Invitas a tu gente con un enlace y cada quien anota con su papel: operario, supervisor o asesor.',
  },
  {
    titulo: 'Cuánto te cuesta cada kilo',
    texto:
      'Con el plan Finca: bodega de insumos, mano de obra, costo por kilo y margen de cada ciclo.',
  },
  {
    titulo: 'Tus datos son tuyos',
    texto:
      'Descargas una copia cuando quieras o la guardas en tu propio Google Drive. Nadie la mira sin tu permiso.',
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
}

/**
 * Los planes que se pueden tomar hoy: el gratuito y los que tienen cobro en línea. Los demás
 * todavía no se cobran (lo dice `aviso_precio`) y la página los nombra como «pronto».
 */
export function planesDeLaLanding(): {
  disponibles: PlanDeLaLanding[];
  pronto: { nombre: string; paraQuien: string }[];
} {
  const disponibles: PlanDeLaLanding[] = [];
  const pronto: { nombre: string; paraQuien: string }[] = [];
  for (const p of planes.planes) {
    const gratuito = 'gratuito' in p && p.gratuito === true;
    const cobro = ('cobro' in p ? p.cobro : null) as Record<string, number> | null;
    if (!gratuito && !cobro) {
      pronto.push({ nombre: p.nombre, paraQuien: p.para_quien });
      continue;
    }
    const mes = cobro?.['1'] ?? 0;
    const anual = cobro?.['12'];
    disponibles.push({
      id: p.id,
      nombre: p.nombre,
      gratuito,
      precioMes: mes,
      paraQuien: p.para_quien,
      // Lo que todavía no existe dice «(pronto)» en planes.json; aquí solo va lo que ya está.
      incluye: p.incluye.filter((i) => !i.includes('(pronto)')),
      anual: anual ? { total: anual, ahorro: mes * 12 - anual } : null,
    });
  }
  return { disponibles, pronto };
}

/** «$39.000», con el punto de miles de Colombia y sin `Intl`: el HTML sale igual en todas partes. */
export function pesos(n: number): string {
  return `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** «Exportador y Cadena»: los nombres en una frase. */
export function enFrase(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres.join('');
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

export const PREGUNTAS = [
  {
    pregunta: '¿Funciona sin internet?',
    respuesta:
      'Sí. Lo que anotas se guarda primero en tu teléfono y se sube solo cuando vuelve la señal. Puedes trabajar todo el día dentro de la nave sin preocuparte.',
  },
  {
    pregunta: '¿Necesito saber de tecnología?',
    respuesta:
      'No. Se abre desde el navegador de tu teléfono y lo puedes dejar en la pantalla de inicio como cualquier aplicación. El cuaderno te guía para crear tu finca y tus naves.',
  },
  {
    pregunta: '¿Cuánto cuesta?',
    respuesta:
      'Empezar no cuesta nada y el plan Gratis no vence. Cuando quieras saber cuánto te cuesta producir, pasas al plan Finca y lo pagas por 1, 3, 6 o 12 meses, sin permanencia.',
  },
  {
    pregunta: '¿Mi equipo puede anotar desde su teléfono?',
    respuesta:
      'Sí. Entras con tu cuenta, invitas a tu gente con un enlace y cada uno anota desde su teléfono. Todos ven el mismo cuaderno.',
  },
  {
    pregunta: '¿Me sirve para las auditorías?',
    respuesta:
      'Con el plan Finca armas la carpeta de cumplimiento en PDF, con tus aplicaciones, carencias y cosechas, lista para mostrar.',
  },
  {
    pregunta: '¿Qué pasa con mis datos?',
    respuesta:
      'Son tuyos. Los descargas cuando quieras, puedes guardar una copia en tu propio Google Drive y nadie de CultivoPro los mira sin tu permiso.',
  },
] as const;
