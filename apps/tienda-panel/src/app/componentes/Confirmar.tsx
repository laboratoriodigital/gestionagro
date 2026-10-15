/**
 * Lo que no se puede deshacer pide un segundo paso (HU-T3.5 CA1): el primero abre qué va a pasar y
 * el segundo lo hace. Es la `Confirmacion` de `@ed1/ui` v2, con sus clases, para una acción del
 * panel que no es un formulario: un `<details>` que se cierra al confirmar.
 */
import { useRef, useState } from 'preact/hooks';

export function Confirmar({
  abrir,
  consecuencia,
  confirmar,
  alConfirmar,
}: {
  abrir: string;
  consecuencia: string;
  confirmar: string;
  alConfirmar: () => Promise<void> | void;
}) {
  const caja = useRef<HTMLDetailsElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const hacer = async () => {
    setOcupado(true);
    try {
      await alConfirmar();
      if (caja.current) caja.current.open = false;
    } finally {
      setOcupado(false);
    }
  };
  return (
    <details class="ed1-confirmacion" ref={caja}>
      <summary class="ed1-boton ed1-boton--secundario">{abrir}</summary>
      <div class="ed1-confirmacion__formulario">
        <p class="ed1-confirmacion__consecuencia">{consecuencia}</p>
        <button
          class="ed1-boton ed1-boton--peligro"
          type="button"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
          onClick={() => void hacer()}
        >
          {confirmar}
        </button>
      </div>
    </details>
  );
}
