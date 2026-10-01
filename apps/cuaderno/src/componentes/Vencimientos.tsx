/**
 * Carencia y reentrada vigentes de un área (HU-E3.10, WI-E3.10.3). Desconocida va en rojo: no se
 * sabe cuándo cosechar ni cuándo entrar (CA4, P1). Sin nada vigente, no se muestra nada.
 */
import { type EstadoDeArea, textoCarencia, textoReentrada } from '../almacen/aplicaciones.ts';

export function Vencimientos(props: { estado: EstadoDeArea | undefined }) {
  if (!props.estado) return null;
  const carencia = textoCarencia(props.estado.carencia);
  const reentrada = textoReentrada(props.estado.reentrada);
  if (!carencia && !reentrada) return null;
  return (
    <ul class="vencimientos" data-prueba="vencimientos">
      {carencia && (
        <li
          class={props.estado.carencia.tipo === 'desconocida' ? 'bloqueo' : ''}
          data-prueba="carencia"
        >
          {carencia}
        </li>
      )}
      {reentrada && (
        <li
          class={props.estado.reentrada.tipo === 'desconocida' ? 'bloqueo' : ''}
          data-prueba="reentrada"
        >
          {reentrada}
        </li>
      )}
    </ul>
  );
}
