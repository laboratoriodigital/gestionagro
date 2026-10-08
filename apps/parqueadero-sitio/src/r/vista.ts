/**
 * Lo que muestra la página del recibo `/r/` (HU-Q4.2, PARQUEADERO §6.3): se lee del fragmento,
 * que nunca llega a un servidor. Sin llamadas a una API. Un fragmento alterado o de otra versión
 * dice «No pudimos leer este recibo», nunca muestra un recibo a medias (CA3).
 *
 * Un recibo firmado (HU-Q8.2) se verifica con las llaves de las celdas que la página lleva dentro
 * (`#claves-recibo`, las pone el despliegue). Los casos de §6.3: verificado, en verde; sin firma,
 * «Copia digital del recibo», sin alarma; modificado, en rojo; emitido con el certificado vencido,
 * en ámbar.
 */
import type { LlavePublica, VerificarEd25519 } from '@ed1/firma';
import {
  EnlaceInvalido,
  fechaHora,
  leerEnlace,
  pantalla,
  type VistaDeRecibo,
  verificarRecibo,
} from '@ed1/parqueadero-recibos';
import { VEHICULOS } from '@ed1/parqueadero-schema';

export type VistaDeLaPagina =
  | {
      readonly es: 'completa';
      readonly titulo: string;
      /** La hoja, igual a la de la caja (HU-Q6.6). */
      readonly hoja: VistaDeRecibo;
      readonly filas: readonly (readonly [string, string])[];
      /** El resultado de la firma, arriba de la hoja; nulo para la copia digital sin firma. */
      readonly sello: Sello | null;
      readonly notas: readonly string[];
      readonly prueba: boolean;
    }
  | {
      readonly es: 'corta';
      readonly titulo: string;
      readonly filas: readonly (readonly [string, string])[];
      readonly notas: readonly string[];
    }
  | { readonly es: 'ilegible'; readonly titulo: string; readonly notas: readonly string[] };

export interface Sello {
  readonly tono: 'verificado' | 'vencido' | 'modificado';
  readonly texto: string;
}

const COPIA_DIGITAL = 'Copia digital del recibo.';

const ILEGIBLE: VistaDeLaPagina = {
  es: 'ilegible',
  titulo: 'No pudimos leer este recibo',
  notas: [
    'El enlace llegó cortado o cambió. Ábralo otra vez desde el mensaje de WhatsApp o escanee de nuevo el QR del papel.',
  ],
};

/** Sin llaves no hay con qué verificar: un recibo firmado se ve como copia digital. */
const sinVerificar: VerificarEd25519 = async () => false;

export async function vistaDelEnlace(
  fragmento: string,
  llaves: readonly LlavePublica[] = [],
  verificar: VerificarEd25519 = sinVerificar,
): Promise<VistaDeLaPagina> {
  const limpio = fragmento.replace(/^#/, '');
  if (!limpio) return ILEGIBLE;
  let lectura: Awaited<ReturnType<typeof leerEnlace>>;
  try {
    lectura = await leerEnlace(decodeURIComponent(limpio));
  } catch (e) {
    if (e instanceof EnlaceInvalido || e instanceof URIError) return ILEGIBLE;
    throw e;
  }
  if (lectura.forma === 'corta') {
    return {
      es: 'corta',
      titulo: `Recibo ${lectura.numero}`,
      filas: [
        ['Placa', `${lectura.placa} · ${VEHICULOS[lectura.vehiculo].nombre}`],
        ['Entrada', fechaHora(lectura.entrada)],
      ],
      notas: [
        'Este es el QR del papel: sirve para encontrar su vehículo a la salida.',
        'El recibo completo, con el parqueadero y la tarifa, se lo pueden mandar por WhatsApp: pídalo en la caja.',
      ],
    };
  }
  const v = pantalla(lectura.recibo);
  const firma = await verificarRecibo(lectura, llaves, verificar);
  let sello: Sello | null = null;
  // El texto legal va en la hoja; afuera, solo lo que dice qué es esta página.
  let notas = [COPIA_DIGITAL];
  if (firma.estado === 'verificado') {
    sello = {
      tono: 'verificado',
      texto: `Verificado: emitido por ${lectura.recibo.sede.nombre} desde la caja ${firma.serie}`,
    };
    notas = [];
  } else if (firma.estado === 'vencido') {
    sello = { tono: 'vencido', texto: 'Emitido con un certificado vencido' };
    notas = [
      `La caja ${firma.serie} llevaba más de 30 días sin conectarse a la nube cuando lo emitió. Si tiene dudas, confírmelo con el parqueadero.`,
    ];
  } else if (firma.estado === 'modificado') {
    sello = { tono: 'modificado', texto: 'Este recibo fue modificado' };
    notas = [
      'Lo que muestra no es lo que emitió la caja. Pida el recibo otra vez en el parqueadero.',
    ];
  }
  return {
    es: 'completa',
    titulo: v.titulo,
    hoja: v,
    filas: v.filas,
    sello,
    notas,
    prueba: lectura.recibo.prueba,
  };
}
