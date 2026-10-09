/**
 * El texto del sitio del parqueadero en un solo lugar (HU-Q11.5, P2): de aquí salen la portada,
 * la página del generador, sus gemelos en Markdown y `llms.txt` (ADR-24, la capa estática para
 * agentes). Lo que dice una página y lo que lee un agente no pueden separarse.
 */
import productos from '../../../../infrastructure/productos.json' with { type: 'json' };

const parqueadero = productos.productos.find((p) => p.id === 'parqueadero');
const origenes = parqueadero?.app.origenes;
if (!origenes || typeof origenes === 'string') {
  throw new Error('infrastructure/productos.json no dice los orígenes del parqueadero');
}

/** El dominio de producción: los enlaces de `llms.txt` y los gemelos son absolutos. */
export const ORIGEN = origenes.produccion;

export interface Pagina {
  readonly ruta: string;
  readonly titulo: string;
  /** Una línea: la descripción de la página y su entrada en `llms.txt`. */
  readonly resumen: string;
}

export const PORTADA = {
  ruta: '/',
  titulo: 'Parqueadero ED1: la caja del parqueadero en su teléfono',
  resumen:
    'Entradas, salidas y recibos en papel y por WhatsApp, desde el teléfono o el computador, aunque no haya internet. Se prueba sin registrarse.',
  titular: 'La caja del parqueadero, en su teléfono',
  entrada:
    'Registre entradas y salidas, cobre con su tarifa y entregue el recibo en papel o por WhatsApp. Funciona sin internet y se prueba sin registrarse.',
  accion: 'Abrir la caja',
  queHace: [
    [
      'El recibo que pide la ley',
      'Con su NIT, su dirección, la placa, la hora y el estado del vehículo, en papel o por WhatsApp.',
    ],
    [
      'Su tarifa, bien cobrada',
      'Por minuto, por fracción o por hora, con gracia, tope por día y tarifa de noche. Dice cada línea del cobro.',
    ],
    [
      'En la impresora que ya tiene',
      'Térmicas de 58 mm por Bluetooth desde el teléfono, o cualquier impresora desde el computador.',
    ],
    [
      'Sin señal no se detiene',
      'Todo queda guardado en el teléfono, y el respaldo se descarga con un toque.',
    ],
  ] as const,
  herramientasTitulo: 'Herramientas gratuitas',
  pie: 'Parqueadero ED1 es de Laboratorio Digital, en Colombia.',
} as const;

export const GENERADOR = {
  ruta: '/herramientas/recibo-de-entrada/',
  producto: 'parqueadero-recibo-de-entrada',
  titulo: 'Generador de recibo de entrada para parqueaderos',
  resumen:
    'Haga el recibo de entrada de un vehículo con los datos de su parqueadero, su tarifa y el estado del vehículo, e imprímalo o mándelo por WhatsApp. Gratis y sin registrarse.',
  titular: 'Recibo de entrada para su parqueadero',
  entrada:
    'Escriba los datos de su parqueadero una vez y haga el recibo de cada vehículo. Imprímalo o mándelo por WhatsApp. Gratis, sin registrarse: lo que escribe se queda en este navegador.',
  siguiente: {
    titulo: 'Lleve la caja en su teléfono',
    texto:
      'La caja numera sola, cobra la salida con su tarifa y guarda cada recibo, también sin internet.',
    accion: 'Abrir la caja',
  },
} as const;

export const LIQUIDADOR = {
  ruta: '/herramientas/mensualidad-de-parqueadero/',
  producto: 'parqueadero-mensualidad',
  titulo: 'Liquidador de mensualidades de parqueadero, con prorrateo por días',
  resumen:
    'Calcule cuánto cobrar por una mensualidad de parqueadero que empieza a mitad de mes, o por varios meses, con la cuenta de cada día. Gratis y sin registrarse.',
  titular: 'Cuánto cobrar por una mensualidad',
  entrada:
    'Escriba el valor del mes y el día en que empieza: le decimos cuánto cobrar hasta fin de mes, o por varios meses, con la cuenta de cada periodo. Gratis y sin registrarse.',
  siguiente: {
    titulo: 'Lleve los abonados en su teléfono',
    texto:
      'La caja cobra cada mensualidad con esta misma cuenta, imprime su recibo y le avisa cuáles vencen esta semana.',
    accion: 'Abrir la caja',
  },
} as const;

/** Las herramientas gratuitas, en el orden de la portada: el de la demanda medida (HU-Q11.1). */
export const HERRAMIENTAS = [LIQUIDADOR, GENERADOR] as const;

export const PAGINAS: readonly Pagina[] = [PORTADA, ...HERRAMIENTAS];

/** El gemelo en Markdown de una página (`index.md` junto a su `index.html`). */
export function gemelo(p: Pagina): string {
  if (p.ruta === PORTADA.ruta) {
    return [
      `# ${PORTADA.titular}`,
      '',
      PORTADA.entrada,
      '',
      `[${PORTADA.accion}](${ORIGEN}/caja/)`,
      '',
      '## Qué hace',
      '',
      ...PORTADA.queHace.map(([t, d]) => `- **${t}.** ${d}`),
      '',
      `## ${PORTADA.herramientasTitulo}`,
      '',
      ...HERRAMIENTAS.map((h) => `- [${h.titular}](${ORIGEN}${h.ruta}): ${h.resumen}`),
      '',
      PORTADA.pie,
      '',
    ].join('\n');
  }
  if (p.ruta === LIQUIDADOR.ruta) {
    return [
      `# ${LIQUIDADOR.titular}`,
      '',
      LIQUIDADOR.entrada,
      '',
      'Pide el tipo de vehículo, el valor del mes, la fecha de inicio y cuántos meses completos se pagan. Con «hasta fin de mes», los días que quedan del mes se cobran en proporción: el valor del mes por los días que cubre, dividido por los días del mes que empieza ese día, hacia abajo a la centena. Un mes va del día de inicio al día anterior del mes siguiente (del 31 de enero, al 28 de febrero). Es la misma cuenta con que la caja cobra una mensualidad.',
      '',
      'Ejemplo: $300.000 al mes desde el 20 de octubre de 2026, hasta fin de mes, son 12 de 31 días: $116.129, que se cobran $116.100.',
      '',
      `## ${LIQUIDADOR.siguiente.titulo}`,
      '',
      `${LIQUIDADOR.siguiente.texto} [${LIQUIDADOR.siguiente.accion}](${ORIGEN}/caja/)`,
      '',
    ].join('\n');
  }
  return [
    `# ${GENERADOR.titular}`,
    '',
    GENERADOR.entrada,
    '',
    'Pide los datos del parqueadero (nombre, NIT, dirección, ciudad, teléfono y póliza si la tiene), la tarifa, el número del talonario, la placa, el tipo de vehículo, la hora de entrada y el estado del vehículo. El recibo dice que salió del generador y no lleva la serie de una caja.',
    '',
    `## ${GENERADOR.siguiente.titulo}`,
    '',
    `${GENERADOR.siguiente.texto} [${GENERADOR.siguiente.accion}](${ORIGEN}/caja/)`,
    '',
  ].join('\n');
}

/** `llms.txt`: qué es el sitio y adónde leer, en Markdown (llmstxt.org). */
export function llmsTxt(): string {
  return [
    '# Parqueadero ED1',
    '',
    `> ${PORTADA.resumen}`,
    '',
    'La caja es una aplicación web instalable de Laboratorio Digital para parqueaderos de Colombia: recibos de entrada y salida con los datos que pide la Ley 1480, cobro con la tarifa del parqueadero e impresión en térmicas de 58 mm. Los recibos de los conductores y la caja no se indexan.',
    '',
    '## Páginas',
    '',
    ...PAGINAS.map((p) => `- [${p.titulo}](${ORIGEN}${p.ruta}index.md): ${p.resumen}`),
    '',
    '## Aplicación',
    '',
    `- [La caja](${ORIGEN}/caja/): se abre en el navegador y funciona sin internet.`,
    '',
  ].join('\n');
}
