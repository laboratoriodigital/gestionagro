/**
 * Isla de la calculadora de DPV (HU-E2.2). Calcula mientras se escribe, sin botón (CA1).
 * Campos de texto con teclado decimal: `type="number"` rechaza la coma en muchos teléfonos.
 */
import { CULTIVOS_DPV } from '@gestionagro/agro-calc';
import { useEffect, useState } from 'preact/hooks';
import { type CampoDpv, calcular, type Entradas } from './dpv-logica.ts';

interface ColectorDeEventos {
  registrar: (nombre: 'tool.completed') => void;
}

const OPCIONES = CULTIVOS_DPV.flatMap((c) =>
  c.etapas.map((e) => ({ valor: `${c.id}:${e.id}`, texto: `${c.nombre} — ${e.nombre}` })),
);

function CampoNumero(props: {
  id: CampoDpv;
  etiqueta: string;
  unidad: string;
  valor: string;
  error: string | undefined;
  alCambiar: (texto: string) => void;
}) {
  const idError = `${props.id}-error`;
  return (
    <div class="campo">
      <label for={props.id}>
        {props.etiqueta} <span class="unidad">({props.unidad})</span>
      </label>
      <input
        id={props.id}
        name={props.id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={props.valor}
        aria-invalid={props.error ? 'true' : 'false'}
        aria-describedby={props.error ? idError : undefined}
        onInput={(e) => props.alCambiar((e.currentTarget as HTMLInputElement).value)}
      />
      {props.error && (
        <p id={idError} class="error">
          {props.error}
        </p>
      )}
    </div>
  );
}

export default function CalculadoraDpv() {
  const [entradas, setEntradas] = useState<Entradas>({
    temperatura: '',
    humedad: '',
    temperaturaHoja: '',
    cultivoEtapa: '',
  });
  const [completado, setCompletado] = useState(false);
  const r = calcular(entradas);
  const cambiar = (campo: keyof Entradas) => (valor: string) =>
    setEntradas({ ...entradas, [campo]: valor });

  // CA6: tool.completed la primera vez que hay un resultado válido.
  useEffect(() => {
    if (r.aire && !completado) {
      setCompletado(true);
      (window as { agroEventos?: ColectorDeEventos }).agroEventos?.registrar('tool.completed');
    }
  }, [r.aire, completado]);

  return (
    <form class="calculadora-dpv" onSubmit={(e) => e.preventDefault()} noValidate>
      <CampoNumero
        id="temperatura"
        etiqueta="Temperatura del aire"
        unidad="°C"
        valor={entradas.temperatura}
        error={r.errores.temperatura}
        alCambiar={cambiar('temperatura')}
      />
      <CampoNumero
        id="humedad"
        etiqueta="Humedad relativa"
        unidad="%"
        valor={entradas.humedad}
        error={r.errores.humedad}
        alCambiar={cambiar('humedad')}
      />
      <div class="campo">
        <label for="cultivo">Cultivo y etapa</label>
        <select
          id="cultivo"
          value={entradas.cultivoEtapa}
          onChange={(e) => cambiar('cultivoEtapa')((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">Sin cultivo: solo el valor</option>
          {OPCIONES.map((o) => (
            <option value={o.valor}>{o.texto}</option>
          ))}
        </select>
      </div>
      <details class="avanzado">
        <summary>Opción avanzada: temperatura de la hoja</summary>
        <CampoNumero
          id="temperaturaHoja"
          etiqueta="Temperatura de la hoja"
          unidad="°C"
          valor={entradas.temperaturaHoja}
          error={r.errores.temperaturaHoja}
          alCambiar={cambiar('temperaturaHoja')}
        />
      </details>

      <output
        class="resultado"
        aria-live="polite"
        for="temperatura humedad temperaturaHoja cultivo"
      >
        {r.aire ? (
          <>
            <span class="etiqueta">DPV del aire</span>
            <strong class="valor" data-prueba="dpv-aire">
              {r.aire.texto}
            </strong>
            {r.hoja && (
              <span class="hoja" data-prueba="dpv-hoja">
                DPV de la hoja: {r.hoja.texto}
              </span>
            )}
            {r.indicacion && (
              <span class={`indicacion nivel-${r.indicacion.nivel}`} data-prueba="indicacion">
                <strong>{r.indicacion.titulo}.</strong> {r.indicacion.accion}
                <small class="fuente">Rango de referencia: {r.indicacion.fuente}</small>
              </span>
            )}
          </>
        ) : (
          <span class="espera">Escribe la temperatura y la humedad para ver el DPV.</span>
        )}
      </output>
    </form>
  );
}
