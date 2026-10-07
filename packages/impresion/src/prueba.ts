/**
 * El adaptador `prueba` (PARQUEADERO §7.3): guarda los bytes en memoria. Lo usan las pruebas de
 * bytes de referencia (§15.1) y las de punta a punta (§15.2). El reloj se recibe (P8).
 */
import type { EstadoImpresora, Impresora, Resultado, Trabajo, Vinculo } from './contrato.ts';

export interface ImpresoraDePrueba extends Impresora {
  /** Los trabajos que llegaron, en orden. */
  readonly recibidos: Trabajo[];
}

export interface OpcionesDePrueba {
  readonly reloj?: () => number;
  /** Para probar fallos: si devuelve un resultado, ese trabajo falla con él. */
  readonly fallar?: (trabajo: Trabajo) => Extract<Resultado, { ok: false }> | undefined;
}

export function crearImpresoraDePrueba(opciones: OpcionesDePrueba = {}): ImpresoraDePrueba {
  const reloj = opciones.reloj ?? (() => 0);
  const recibidos: Trabajo[] = [];
  let estado: EstadoImpresora = 'sin_vincular';
  const vinculo: Vinculo = { camino: 'prueba', nombre: 'Impresora de prueba', id: 'prueba' };
  return {
    camino: 'prueba',
    recibidos,
    async vincular() {
      estado = 'conectada';
      return vinculo;
    },
    async reconectar() {
      if (estado === 'sin_vincular') return false;
      estado = 'conectada';
      return true;
    },
    async imprimir(trabajo) {
      const inicio = reloj();
      const fallo = opciones.fallar?.(trabajo);
      if (fallo) return fallo;
      recibidos.push(trabajo);
      const bytes = trabajo.formato === 'escpos' ? trabajo.bytes.length : trabajo.html.length;
      return { ok: true, bytes, ms: reloj() - inicio, papel: 'desconocido' };
    },
    estado: () => estado,
  };
}
