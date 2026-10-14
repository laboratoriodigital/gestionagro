/**
 * La pantalla de las entregas pendientes (bitácora parqueadero 42): se abre tocando la señal de la
 * cabecera. Cada recibo que no salió se abre para imprimirlo otra vez, o se quita de la lista.
 */
import { TEXTO_DEL_MOTIVO } from '@ed1/impresion';
import { numeroDeRecibo, type Registro } from '@ed1/parqueadero-schema';
import type { BaseDeLaCaja } from './datos.ts';
import { diaLocalBogota, fechaBogota, horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import { leerPendientes, type Pendiente, quitarPendientes } from './pendientes.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly reloj: () => number;
  readonly alAbrir: (registro: Registro) => void;
  readonly alVolver: () => void;
}

const NOMBRE_DEL_RECIBO: Readonly<Partial<Record<Registro['tipo'], string>>> = {
  entrada: 'Entrada',
  salida: 'Salida',
  pago_abonado: 'Mensualidad',
};

function titulo(p: Pendiente): string {
  const r = p.registro;
  if (!r) return p.reciboId ? 'Un recibo que ya no está en esta caja' : 'Otras impresiones';
  const numero =
    r.serie && r.consecutivo !== null ? ` ${numeroDeRecibo(r.serie, r.consecutivo)}` : '';
  const placa = (r.datos as { placa?: string }).placa;
  return `${NOMBRE_DEL_RECIBO[r.tipo] ?? 'Recibo'}${numero}${placa ? ` · ${placa}` : ''}`;
}

function cuando(p: Pendiente, hoy: string): string {
  const t = p.ultima.creadaEn;
  const dia = diaLocalBogota(t) === hoy ? '' : ` del ${fechaBogota(t)}`;
  const veces = p.veces === 1 ? 'No salió' : `No salió ${p.veces} veces; la última,`;
  return `${veces} a las ${horaBogota(t)}${dia}: ${TEXTO_DEL_MOTIVO[p.ultima.motivo]}`;
}

export function Pendientes({ db, reloj, alAbrir, alVolver }: Props) {
  const lista = useConsulta<Pendiente[] | null>(() => leerPendientes(db), null);
  if (!lista) return <section class="tarjeta" aria-busy="true" />;
  const hoy = diaLocalBogota(reloj());
  return (
    <section class="tarjeta" data-prueba="pendientes">
      <h1>Entregas pendientes</h1>
      <p class="ayuda">
        Recibos que no salieron por la impresora. El registro está guardado: solo faltó el papel.
        Ábralo para imprimirlo otra vez, o quítelo si ya lo entregó de otra forma.
      </p>
      {lista.length === 0 ? (
        <p class="ayuda" data-prueba="sin-pendientes">
          No hay entregas pendientes.
        </p>
      ) : (
        <ul class="lista-estadias">
          {lista.map((p) => (
            <li key={p.reciboId ?? 'otras'} class="pendiente" data-prueba="pendiente">
              <strong class="exacto">{titulo(p)}</strong>
              <span class="ayuda">{cuando(p, hoy)}</span>
              <div class="pendiente-acciones">
                {p.registro && (
                  <button
                    type="button"
                    class="boton boton-principal"
                    onClick={() => p.registro && alAbrir(p.registro)}
                  >
                    Abrir para imprimir
                  </button>
                )}
                <button
                  type="button"
                  class="boton"
                  onClick={() => void quitarPendientes(db, p.ids)}
                >
                  Quitar de la lista
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
