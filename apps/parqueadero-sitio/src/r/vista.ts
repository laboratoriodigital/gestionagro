/**
 * Lo que muestra la página del recibo `/r/` (HU-Q4.2, PARQUEADERO §6.3): se lee del fragmento,
 * que nunca llega a un servidor. Sin llamadas a una API. Un fragmento alterado o de otra versión
 * dice «No pudimos leer este recibo», nunca muestra un recibo a medias (CA3).
 */
import { EnlaceInvalido, fechaHora, leerEnlace, pantalla } from '@ed1/parqueadero-recibos';
import { VEHICULOS } from '@ed1/parqueadero-schema';

export type VistaDeLaPagina =
  | {
      readonly es: 'completa';
      readonly titulo: string;
      readonly filas: readonly (readonly [string, string])[];
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

const ILEGIBLE: VistaDeLaPagina = {
  es: 'ilegible',
  titulo: 'No pudimos leer este recibo',
  notas: [
    'El enlace llegó cortado o cambió. Ábralo otra vez desde el mensaje de WhatsApp o escanee de nuevo el QR del papel.',
  ],
};

export async function vistaDelEnlace(fragmento: string): Promise<VistaDeLaPagina> {
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
  return {
    es: 'completa',
    titulo: v.titulo,
    filas: v.filas,
    notas: ['Copia digital del recibo.', ...v.legal],
    prueba: lectura.recibo.prueba,
  };
}
