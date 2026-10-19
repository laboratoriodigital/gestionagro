/**
 * Una cola por caja (PARQUEADERO §7.3): un trabajo a la vez, en el orden en que llegan. El que
 * falla no se pierde: `alFallar` lo recibe con su motivo, y la caja lo guarda en
 * `entregas_pendientes` (§5.2) para que la cabecera lo muestre (P15).
 */
import type { Impresora, Resultado, Trabajo } from './contrato.ts';

export interface OpcionesDeCola {
  /** Se llama con cada trabajo que no salió. Si lanza, la cola sigue: el error no tapa la impresión. */
  readonly alFallar?: (trabajo: Trabajo, resultado: Extract<Resultado, { ok: false }>) => unknown;
  /**
   * Cuánto esperar a la impresora antes de darlo por perdido. Más que lo que tarda el adaptador en
   * rendirse al reconectar (unos 30 s). Al vencer, la cola le pide al adaptador que lo corte
   * (`cancelar`): un recibo dado por perdido nunca sale después (bitácora parqueadero 43).
   */
  readonly msMaximo?: number;
}

export interface Cola {
  /** Encola el trabajo y devuelve su resultado cuando le toque y termine. Nunca lanza. */
  imprimir(trabajo: Trabajo): Promise<Resultado>;
  /** Trabajos en espera o en curso. */
  enEspera(): number;
}

function detalleDe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

export function crearCola(impresora: Impresora, opciones: OpcionesDeCola = {}): Cola {
  const msMaximo = opciones.msMaximo ?? 45_000;
  let ultimo: Promise<unknown> = Promise.resolve();
  let enEspera = 0;

  async function uno(trabajo: Trabajo): Promise<Resultado> {
    let reloj: ReturnType<typeof setTimeout> | undefined;
    const tiempo = new Promise<Resultado>((resolver) => {
      reloj = setTimeout(() => {
        impresora.cancelar?.();
        resolver({
          ok: false,
          motivo: 'tiempo',
          detalle: `Sin respuesta en ${Math.round(msMaximo / 1000)} s`,
        });
      }, msMaximo);
    });
    let resultado: Resultado;
    try {
      resultado = await Promise.race([impresora.imprimir(trabajo), tiempo]);
    } catch (error) {
      resultado = { ok: false, motivo: 'no_soportado', detalle: detalleDe(error) };
    } finally {
      clearTimeout(reloj);
    }
    if (!resultado.ok && opciones.alFallar) {
      try {
        await opciones.alFallar(trabajo, resultado);
      } catch {
        // Guardar el pendiente falló; el resultado igual llega a la pantalla.
      }
    }
    return resultado;
  }

  return {
    imprimir(trabajo) {
      enEspera++;
      const turno = ultimo.then(() => uno(trabajo));
      ultimo = turno.finally(() => {
        enEspera--;
      });
      return turno;
    },
    enEspera: () => enEspera,
  };
}
