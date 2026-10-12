/**
 * El WhatsApp del conductor con su autorización (HU-Q4.1 CA1; PARQUEADERO §8.3), igual en la
 * entrada y en la pantalla del recibo. La casilla empieza sin marcar y se desmarca si cambia el
 * número: se autoriza «este número», no otro.
 */
import { normalizarNumero } from '@ed1/whatsapp';

/** El texto que el operador le lee al conductor. */
export const PREGUNTA_DE_AUTORIZACION =
  '¿Autoriza que le enviemos sus recibos de hoy por WhatsApp a este número?';

const numeroValido = (escrito: string): boolean => {
  try {
    normalizarNumero(escrito);
    return true;
  } catch {
    return false;
  }
};

/** Lo que falta para enviar, como lo lee el cajero en el botón; vacío si nada. */
export function faltaDelWhatsApp(escrito: string, autoriza: boolean): string {
  if (!escrito.trim()) return 'Falta el WhatsApp del conductor';
  if (!numeroValido(escrito)) return 'El WhatsApp no es un celular válido';
  return autoriza ? '' : 'Falta la autorización';
}

/** «…4567»: lo que la pantalla muestra de un número ya guardado. */
export const terminaEn = (numero: string): string => `…${numero.slice(-4)}`;

interface Props {
  readonly pideNumero: boolean;
  readonly numero: string;
  readonly autoriza: boolean;
  readonly alEscribir: (numero: string) => void;
  readonly alAutorizar: (si: boolean) => void;
}

export function CampoWhatsApp({ pideNumero, numero, autoriza, alEscribir, alAutorizar }: Props) {
  if (!pideNumero) {
    return (
      <p class="ayuda" data-prueba="sin-aviso">
        Para pedir el WhatsApp del conductor, el parqueadero acepta primero el aviso de privacidad
        en Ajustes.
      </p>
    );
  }
  const valido = numeroValido(numero);
  return (
    <div class="grupo" data-prueba="whatsapp-conductor">
      <div class="campo">
        <label for="whatsapp-conductor">WhatsApp del conductor (opcional)</label>
        <input
          id="whatsapp-conductor"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={20}
          value={numero}
          onInput={(e) => {
            alEscribir(e.currentTarget.value);
            alAutorizar(false);
          }}
        />
      </div>
      <label class="casilla">
        <input
          id="autoriza-whatsapp"
          class="casilla-marca"
          type="checkbox"
          checked={autoriza}
          disabled={!valido}
          onChange={(e) => alAutorizar(e.currentTarget.checked)}
        />
        <span>{PREGUNTA_DE_AUTORIZACION}</span>
      </label>
      <span class="ayuda">Solo para sus recibos de hoy. Se borra 24 h después de la salida.</span>
    </div>
  );
}
