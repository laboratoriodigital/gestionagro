/**
 * Piezas comunes de los formularios cuando corrigen un registro (HU-E3.12). Al corregir, el área
 * y la fecha son las del evento: no se cambian, se muestran.
 */
import type { Area, Registro } from '@gestionagro/agro-schema';
import { fechaHora } from '../formato.ts';

/** Número guardado → texto del campo, con coma decimal. Nulo = campo vacío («no medido»). */
export const aTexto = (n: number | null | undefined): string =>
  n === null || n === undefined ? '' : String(n).replace('.', ',');

export function EventoQueSeCorrige(props: { registro: Registro; areas: Area[] }) {
  const area = props.areas.find((a) => a.id === props.registro.area_ids[0]);
  return (
    <p class="estado" data-prueba="evento-que-se-corrige">
      <strong>{area?.nombre ?? 'Área'}</strong> · {fechaHora(props.registro.instante_evento)}. El
      registro anterior no se borra: queda en el historial.
    </p>
  );
}

export function AccionesDeFormulario(props: {
  corrigiendo: boolean;
  texto: string;
  alCancelar?: (() => void) | undefined;
}) {
  return (
    <div class="acciones">
      <button type="submit">{props.corrigiendo ? 'Guardar corrección' : props.texto}</button>
      {props.corrigiendo && props.alCancelar && (
        <button type="button" class="secundario" onClick={props.alCancelar}>
          Cancelar
        </button>
      )}
    </div>
  );
}
