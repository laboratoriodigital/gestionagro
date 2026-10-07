/**
 * La medición de la caja (HU-Q5.3, PARQUEADERO §14.4): cuenta los eventos de `@ed1/eventos` en
 * `meta`, sin red, y los manda en lote a `/_m` del sitio cuando hay. Sin datos personales (P13):
 * solo nombres de una lista cerrada, y el adaptador y la causa de una impresión fallida.
 *
 * Medir nunca rompe la caja (P15): un conteo que no se pudo guardar se pierde en silencio, y un
 * lote que no salió se queda para la próxima. Un lote se descuenta solo cuando el sitio dijo que
 * lo recibió; lo contado mientras viajaba se manda en el siguiente.
 */
import {
  adaptadorDe,
  armarLoteDeLaCaja,
  type Conteos,
  contar,
  descontar,
  type EventoDeLaCaja,
} from '@ed1/eventos';
import type { DatosDeEntrega } from '@ed1/parqueadero-schema';
import type { BaseDeLaCaja } from './datos.ts';

/** Adónde van los lotes: el Worker del sitio del parqueadero. */
export const RUTA_DE_EVENTOS = '/_m';

/** Cada cuánto se intenta mandar con la caja abierta y con red. */
export const MS_ENTRE_ENVIOS = 15 * 60_000;

const leerConteos = async (db: BaseDeLaCaja): Promise<Conteos> => {
  const m = await db.meta.get('eventos');
  return m?.clave === 'eventos' ? m.conteos : {};
};

/** Suma un evento. Nunca lanza. */
export async function medir(db: BaseDeLaCaja, e: EventoDeLaCaja): Promise<void> {
  try {
    await db.transaction('rw', db.meta, async () => {
      await db.meta.put({ clave: 'eventos', conteos: contar(await leerConteos(db), e) });
    });
  } catch {
    // Un conteo menos; la entrada, la salida o el recibo siguen intactos.
  }
}

/**
 * El evento de una entrega del recibo (HU-Q3.6): papel enviado (original o copia), WhatsApp
 * abierto o QR confirmado. «No salió» es una impresión fallida. Lo demás no se cuenta.
 */
export function eventoDeLaEntrega(
  d: Pick<DatosDeEntrega, 'canal' | 'copia' | 'camino' | 'resultado'>,
): EventoDeLaCaja | null {
  if (d.canal === 'papel') {
    if (d.resultado === 'fallido') {
      return { evento: 'impresion.fallida', adaptador: adaptadorDe(d.camino), causa: 'no_salio' };
    }
    return d.resultado === 'enviado' ? { evento: d.copia ? 'recibo.copia' : 'recibo.papel' } : null;
  }
  if (d.canal === 'whatsapp')
    return d.resultado === 'abierto' ? { evento: 'recibo.whatsapp' } : null;
  return d.resultado === 'confirmado' ? { evento: 'recibo.pantalla' } : null;
}

/**
 * Manda lo contado en un lote, si hay. `enviar` dice si el sitio lo recibió. Devuelve cuántos
 * eventos salieron; nunca lanza.
 */
export async function enviarEventos(
  db: BaseDeLaCaja,
  enviar: (cuerpo: string) => Promise<boolean>,
): Promise<number> {
  try {
    const lote = armarLoteDeLaCaja(await leerConteos(db));
    if (!lote) return 0;
    if (!(await enviar(JSON.stringify(lote)))) return 0;
    await db.transaction('rw', db.meta, async () => {
      await db.meta.put({
        clave: 'eventos',
        conteos: descontar(await leerConteos(db), lote.conteos),
      });
    });
    return Object.values(lote.conteos).reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

/** Un POST de texto plano al sitio: sin verificación previa de CORS, y `keepalive` al cerrar. */
export const enviarAlSitio =
  (f: typeof fetch) =>
  async (cuerpo: string): Promise<boolean> => {
    const r = await f(RUTA_DE_EVENTOS, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: cuerpo,
      keepalive: true,
    });
    return r.ok;
  };

/**
 * En el navegador: manda al abrir, al volver la red y cada `MS_ENTRE_ENVIOS`. Sin red, ni lo
 * intenta: los conteos esperan en el teléfono (CA2).
 */
export function programarEnvios(
  db: BaseDeLaCaja,
  v: Pick<Window, 'addEventListener' | 'setInterval' | 'fetch'> & { navigator: Navigator },
): void {
  const intentar = () => {
    if (v.navigator.onLine) void enviarEventos(db, enviarAlSitio(v.fetch.bind(v)));
  };
  intentar();
  v.addEventListener('online', intentar);
  v.setInterval(intentar, MS_ENTRE_ENVIOS);
}
