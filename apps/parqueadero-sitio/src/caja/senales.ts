/**
 * Lo que la cabecera dice de la impresora y qué camino propone el asistente (PARQUEADERO §7.7,
 * plan §5.1 y §5.3). Funciones puras: la cabecera y las pruebas las usan igual.
 */
import type { EstadoImpresora } from '@ed1/impresion';
import type { RegistroImpresora } from './datos.ts';
import { fechaBogota, horaBogota } from './fecha.ts';
import type { EstadoDeLaNube } from './nube.ts';

export type Tono = 'bien' | 'aviso' | 'error' | 'neutro';

export interface Senal {
  readonly texto: string;
  readonly tono: Tono;
}

export function senalDeImpresora(
  registro: RegistroImpresora | undefined,
  estado: EstadoImpresora,
): Senal {
  if (!registro) return { texto: 'Impresora sin configurar', tono: 'aviso' };
  if (!registro.probada) return { texto: 'Impresora sin probar', tono: 'aviso' };
  switch (estado) {
    // La cabecera no es un botón: el texto no promete un toque que no hace nada.
    case 'sin_vincular':
      return { texto: 'Impresora sin conectar', tono: 'aviso' };
    case 'conectando':
      return { texto: 'Conectando la impresora…', tono: 'aviso' };
    case 'desconectada':
      return { texto: 'La impresora está apagada o lejos', tono: 'error' };
    case 'ocupada':
      return { texto: 'Imprimiendo', tono: 'bien' };
    case 'conectada':
      return { texto: 'Impresora conectada', tono: 'bien' };
  }
}

/** La fecha del último respaldo (HU-Q3.10 CA1). Más de un día sin respaldo se pide en amarillo. */
export function senalDeRespaldo(instante: number | undefined, ahora: number): Senal {
  if (instante === undefined) return { texto: 'Respaldo sin hacer', tono: 'aviso' };
  return {
    texto: `Respaldo: ${fechaBogota(instante).slice(0, 5)} ${horaBogota(instante)}`,
    tono: ahora - instante > 24 * 3_600_000 ? 'aviso' : 'bien',
  };
}

export function senalDePendientes(cuantas: number): Senal {
  if (cuantas === 0) return { texto: 'Sin entregas pendientes', tono: 'bien' };
  return {
    texto: cuantas === 1 ? '1 entrega pendiente' : `${cuantas} entregas pendientes`,
    tono: 'error',
  };
}

/**
 * Dónde está lo registrado (HU-Q7.5 CA2), con los tres estados del cuaderno: «en este
 * dispositivo», «enviando» y «en la nube». Sin cuenta no hay señal: la caja de `v0.2.x` sigue
 * con sus cuatro (P10).
 */
export function senalDeLaNube(
  vinculada: boolean,
  pendientes: number,
  estado: EstadoDeLaNube,
): Senal | null {
  if (!vinculada) return null;
  if (estado.tipo === 'enviando') return { texto: 'Enviando a la nube…', tono: 'neutro' };
  if (pendientes === 0) return { texto: 'Todo en la nube', tono: 'bien' };
  const aqui = `${pendientes} en este dispositivo`;
  const ultimo =
    estado.tipo === 'resultado'
      ? estado.envio.estado === 'al-dia'
        ? estado.recepcion?.estado
        : estado.envio.estado
      : undefined;
  switch (ultimo) {
    case 'sin-senal':
      return { texto: `${aqui}, sin señal`, tono: 'aviso' };
    case 'sin-sesion':
      return { texto: `${aqui}: entre de nuevo`, tono: 'error' };
    case 'esperar':
      return { texto: `${aqui}: la nube pidió esperar`, tono: 'aviso' };
    case 'error':
      return { texto: `${aqui}: la nube falló`, tono: 'error' };
    default:
      return { texto: aqui, tono: 'aviso' };
  }
}

export interface Capacidades {
  readonly bluetooth: boolean;
  /** Web Serial: la impresora emparejada en el teléfono o el PC (HU-Q2.4). */
  readonly serial?: boolean;
  readonly ios: boolean;
}

export interface Propuesta {
  readonly camino: 'bluetooth' | 'serial' | 'sistema' | null;
  readonly mensaje: string;
  /** Ofrecer también la impresora emparejada; sin Web Serial, el botón no aparece (CA3). */
  readonly serial: boolean;
  /**
   * Ofrecer también el diálogo de impresión del equipo (HU-Q2.5): la PT-210 por USB en Windows o
   * una impresora común. En iPhone no: AirPrint no llega a la térmica.
   */
  readonly sistema: boolean;
}

/** El paso 1 del asistente: qué tiene este navegador (§7.2 y §7.8). En iPhone, desde el principio. */
export function proponerCamino(c: Capacidades): Propuesta {
  if (c.ios) {
    return {
      camino: null,
      mensaje:
        'En iPhone ningún navegador puede imprimir en la impresora. Use la caja en un Android o en un PC con Chrome; mientras tanto, el recibo sale por WhatsApp y en la pantalla.',
      serial: false,
      sistema: false,
    };
  }
  const serial = c.serial === true;
  const sistema = true;
  if (c.bluetooth) {
    return {
      camino: 'bluetooth',
      mensaje: 'Este equipo puede imprimir por Bluetooth.',
      serial,
      sistema,
    };
  }
  if (serial) {
    return {
      camino: 'serial',
      mensaje: 'Este equipo puede imprimir con la impresora emparejada.',
      serial,
      sistema,
    };
  }
  return {
    camino: 'sistema',
    serial,
    sistema,
    mensaje:
      'Este navegador no tiene Bluetooth: puede imprimir con el diálogo de impresión del equipo, en la impresora instalada. Para la PT-210 por Bluetooth, abra la caja en Chrome.',
  };
}

export function capacidadesDelNavegador(n: Navigator): Capacidades {
  const ios =
    /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
  return { bluetooth: 'bluetooth' in n, serial: 'serial' in n, ios };
}
