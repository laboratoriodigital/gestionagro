/**
 * Lo que la cabecera dice de la impresora y qué camino propone el asistente (PARQUEADERO §7.7,
 * plan §5.1 y §5.3). Funciones puras: la cabecera y las pruebas las usan igual.
 */
import type { EstadoImpresora } from '@ed1/impresion';
import type { RegistroImpresora } from './datos.ts';

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

export function senalDePendientes(cuantas: number): Senal {
  if (cuantas === 0) return { texto: 'Sin entregas pendientes', tono: 'bien' };
  return {
    texto: cuantas === 1 ? '1 entrega pendiente' : `${cuantas} entregas pendientes`,
    tono: 'error',
  };
}

export interface Capacidades {
  readonly bluetooth: boolean;
  readonly ios: boolean;
}

export interface Propuesta {
  readonly camino: 'bluetooth' | null;
  readonly mensaje: string;
}

/** El paso 1 del asistente: qué tiene este navegador (§7.2 y §7.8). En iPhone, desde el principio. */
export function proponerCamino(c: Capacidades): Propuesta {
  if (c.ios) {
    return {
      camino: null,
      mensaje:
        'En iPhone ningún navegador puede imprimir en la impresora. Use la caja en un Android o en un PC con Chrome; mientras tanto, el recibo sale por WhatsApp y en la pantalla.',
    };
  }
  if (c.bluetooth) {
    return { camino: 'bluetooth', mensaje: 'Este equipo puede imprimir por Bluetooth.' };
  }
  return {
    camino: null,
    mensaje:
      'Este navegador no puede usar Bluetooth. Abra la caja en Chrome, en Android o en Windows.',
  };
}

export function capacidadesDelNavegador(n: Navigator): Capacidades {
  const ios =
    /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
  return { bluetooth: 'bluetooth' in n, ios };
}
