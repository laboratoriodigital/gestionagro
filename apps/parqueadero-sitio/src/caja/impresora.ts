/**
 * La impresora de la caja: el adaptador, la cola y lo que se guarda en `impresora` (§5.2). La
 * caja tiene una sola impresora y una sola cola (PARQUEADERO §7.3).
 */
import {
  type AjustesDeImpresion,
  type Bloque,
  type BluetoothBle,
  type Cola,
  codificar,
  crearCola,
  crearImpresoraBluetooth,
  type EstadoImpresora,
  FalloDeImpresora,
  type ImpresoraBluetooth,
  type Resultado,
  type Vinculo,
} from '@ed1/impresion';
import { conImpresion } from './actividad.ts';
import type { BaseDeLaCaja, RegistroImpresora } from './datos.ts';
import { conMarcaDeEntorno } from './entorno.ts';

export interface OpcionesDeControl {
  readonly bluetooth: BluetoothBle | undefined;
  readonly hostname: string;
  readonly reloj: () => number;
  readonly nuevoId: () => string;
}

export interface ControlDeImpresora {
  /** Solo desde un toque del cajero: el navegador abre su selector. */
  conectar(verTodos: boolean): Promise<Vinculo>;
  /** Codifica con los ajustes guardados (o los que se pasen) y encola. Nunca lanza. */
  imprimir(bloques: readonly Bloque[], ajustes?: AjustesDeImpresion): Promise<Resultado>;
  estado(): EstadoImpresora;
  escuchar(oyente: (estado: EstadoImpresora) => void): () => void;
  diagnostico(): string;
}

export function ajustesDelRegistro(r: RegistroImpresora): AjustesDeImpresion {
  return { paginaDeCodigos: r.paginaDeCodigos, qr: r.qr, columnas: r.columnas, avanceFinal: 3 };
}

export function crearControl(db: BaseDeLaCaja, opciones: OpcionesDeControl): ControlDeImpresora {
  let impresora: ImpresoraBluetooth | undefined;
  let cola: Cola | undefined;
  let estado: EstadoImpresora = 'sin_vincular';
  const oyentes = new Set<(e: EstadoImpresora) => void>();
  const cambiar = (e: EstadoImpresora) => {
    estado = e;
    for (const o of oyentes) o(e);
  };

  return {
    async conectar(verTodos) {
      if (!opciones.bluetooth) {
        throw new FalloDeImpresora('no_soportado', 'Este navegador no tiene Bluetooth web');
      }
      const anterior = await db.impresora.get('actual');
      const nueva = crearImpresoraBluetooth({
        bluetooth: opciones.bluetooth,
        verTodos,
        ...(anterior?.trozo ? { trozo: anterior.trozo } : {}),
        alCambiarEstado: cambiar,
        alCambiarTrozo: (trozo) => void db.impresora.update('actual', { trozo }),
      });
      // El diagnóstico tiene que contar lo que vio también cuando vincular falla.
      impresora = nueva;
      const vinculo = await nueva.vincular();
      cola = crearCola(nueva, {
        alFallar: (trabajo, r) =>
          db.entregas_pendientes.add({
            trabajoId: trabajo.id,
            canal: 'papel',
            motivo: r.motivo,
            detalle: r.detalle,
            creadaEn: opciones.reloj(),
          }),
      });
      // Otra impresora pierde la prueba: sus tildes y su QR pueden ser otros.
      const misma = anterior?.dispositivoId === vinculo.id;
      await db.impresora.put({
        id: 'actual',
        camino: vinculo.camino,
        nombre: vinculo.nombre,
        dispositivoId: vinculo.id,
        ...(vinculo.servicio ? { servicio: vinculo.servicio } : {}),
        ...(vinculo.caracteristica ? { caracteristica: vinculo.caracteristica } : {}),
        ...(misma && anterior?.trozo ? { trozo: anterior.trozo } : {}),
        paginaDeCodigos: misma && anterior ? anterior.paginaDeCodigos : 'cp850',
        qr: misma && anterior ? anterior.qr : 'nativo',
        columnas: misma && anterior ? anterior.columnas : 32,
        probada: misma && anterior ? anterior.probada : false,
        ...(misma && anterior?.probadaEn ? { probadaEn: anterior.probadaEn } : {}),
      });
      return vinculo;
    },

    async imprimir(bloques, ajustes) {
      const registro = await db.impresora.get('actual');
      if (!cola || !registro) {
        return { ok: false, motivo: 'sin_permiso', detalle: 'Falta conectar la impresora' };
      }
      let bytes: Uint8Array;
      try {
        bytes = await codificar(
          conMarcaDeEntorno(bloques, opciones.hostname),
          ajustes ?? ajustesDelRegistro(registro),
        );
      } catch (e) {
        // Un recibo que no se pudo codificar se dice, nunca deja la pantalla esperando (P15).
        return { ok: false, motivo: 'no_soportado', detalle: `No se pudo armar: ${String(e)}` };
      }
      const enCola = cola;
      return conImpresion(() =>
        enCola.imprimir({ id: opciones.nuevoId(), formato: 'escpos', bytes }),
      );
    },

    estado: () => estado,

    escuchar(oyente) {
      oyentes.add(oyente);
      return () => oyentes.delete(oyente);
    },

    diagnostico: () => impresora?.diagnostico() ?? 'Impresora: sin vincular en esta sesión',
  };
}
