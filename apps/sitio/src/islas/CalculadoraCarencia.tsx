/**
 * Isla de la calculadora de carencia y reentrada (HU-E10.1). Calcula mientras se escribe, sin
 * botón. La fecha y la hora arrancan en «ahora» de Colombia al cargar en el teléfono, nunca en
 * la del momento en que se armó la página. Días y horas en campos de texto con teclado numérico.
 * «Guardar como aplicación en mi cuaderno» lleva la fecha y la hora al cuaderno, sin red (HU-E10.2).
 */
import { useEffect, useState } from 'preact/hooks';
import {
  ahoraEnColombia,
  type CampoCarencia,
  calcularCarencia,
  type EntradasCarencia,
  enlaceAplicacionAlCuaderno,
  entradasDeEnlaceCarencia,
  paraCompartirCarencia,
  type Salida,
} from './carencia-logica.ts';
import { cuadernoEnUso } from './cuaderno.ts';

interface ColectorDeEventos {
  registrar: (nombre: 'tool.completed' | 'tool.shared' | 'tool.next_step') => void;
}

/** Lo ya escrito en el HTML estático antes de que cargara la isla (bitácora agro 21). */
const yaEscrito = (id: string): string =>
  typeof document === 'undefined'
    ? ''
    : ((document.getElementById(id) as HTMLInputElement | null)?.value ?? '');

function Campo(props: {
  id: CampoCarencia;
  etiqueta: string;
  tipo: 'date' | 'time' | 'text';
  unidad?: string;
  valor: string;
  error: string | undefined;
  alCambiar: (texto: string) => void;
}) {
  const idError = `${props.id}-error`;
  return (
    <div class="campo">
      <label for={props.id}>
        {props.etiqueta} {props.unidad && <span class="unidad">({props.unidad})</span>}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.tipo}
        inputMode={props.tipo === 'text' ? 'numeric' : undefined}
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

function Linea(props: { salida: Salida; antes: string; desconocida: string; prueba: string }) {
  const s = props.salida;
  if (s.tipo === 'espera') return null;
  return (
    <span class={s.tipo === 'desconocida' ? 'indicacion nivel-alto' : 'indicacion'}>
      {s.tipo === 'fecha' ? (
        <>
          {props.antes} <strong data-prueba={props.prueba}>{s.texto}</strong>
        </>
      ) : (
        <strong data-prueba={props.prueba}>{props.desconocida}</strong>
      )}
    </span>
  );
}

export default function CalculadoraCarencia() {
  const [e, setE] = useState<EntradasCarencia>(() => ({
    fecha: yaEscrito('fecha'),
    hora: yaEscrito('hora'),
    carencia: yaEscrito('carencia'),
    reentrada: yaEscrito('reentrada'),
  }));
  const [completado, setCompletado] = useState(false);
  // null = todavía no se sabe; mientras tanto el botón dice lo general.
  const [conCuaderno, setConCuaderno] = useState<boolean | null>(null);
  useEffect(() => {
    void cuadernoEnUso().then(setConCuaderno);
  }, []);

  // CA1: por defecto, ahora en Colombia. Se pone al montar, si la persona no escribió otra cosa.
  // Un enlace compartido trae sus valores, y esos mandan (como en la DPV, HU-E2.4).
  useEffect(() => {
    const ahora = ahoraEnColombia(Date.now());
    const desdeEnlace = entradasDeEnlaceCarencia(window.location.search);
    setE((actual) => ({
      ...actual,
      ...desdeEnlace,
      fecha: desdeEnlace.fecha || actual.fecha || ahora.fecha,
      hora: desdeEnlace.hora || actual.hora || ahora.hora,
    }));
  }, []);

  const r = calcularCarencia(e);
  const cambiar = (campo: CampoCarencia) => (valor: string) => setE({ ...e, [campo]: valor });
  const escribioAlgo = e.carencia.trim() !== '' || e.reentrada.trim() !== '';
  const alCuaderno = escribioAlgo ? enlaceAplicacionAlCuaderno(e) : null;
  const compartir =
    typeof window === 'undefined' ? null : paraCompartirCarencia(e, r, window.location.href);

  useEffect(() => {
    const hayFecha = r.cosechar.tipo === 'fecha' || r.entrar.tipo === 'fecha';
    if (hayFecha && !completado) {
      setCompletado(true);
      (window as { agroEventos?: ColectorDeEventos }).agroEventos?.registrar('tool.completed');
    }
  }, [r.cosechar.tipo, r.entrar.tipo, completado]);

  return (
    <form class="calculadora-dpv" onSubmit={(ev) => ev.preventDefault()} noValidate>
      <Campo
        id="fecha"
        etiqueta="Fecha de la aplicación"
        tipo="date"
        valor={e.fecha}
        error={r.errores.fecha}
        alCambiar={cambiar('fecha')}
      />
      <Campo
        id="hora"
        etiqueta="Hora de la aplicación"
        tipo="time"
        valor={e.hora}
        error={r.errores.hora}
        alCambiar={cambiar('hora')}
      />
      <Campo
        id="carencia"
        etiqueta="Carencia de la etiqueta"
        tipo="text"
        unidad="días"
        valor={e.carencia}
        error={r.errores.carencia}
        alCambiar={cambiar('carencia')}
      />
      <Campo
        id="reentrada"
        etiqueta="Reentrada de la etiqueta"
        tipo="text"
        unidad="horas"
        valor={e.reentrada}
        error={r.errores.reentrada}
        alCambiar={cambiar('reentrada')}
      />
      <p class="aviso-etiqueta" data-prueba="aviso-etiqueta">
        Copia la carencia y la reentrada de la etiqueta del producto registrado ante el ICA. Esta
        herramienta solo cuenta los días.
      </p>

      <output class="resultado" aria-live="polite" for="fecha hora carencia reentrada">
        {escribioAlgo ? (
          <>
            <Linea
              salida={r.cosechar}
              antes="Cosechar desde el"
              desconocida="Carencia desconocida: mira la etiqueta. Sin ese dato no hay fecha para cosechar."
              prueba="cosechar"
            />
            <Linea
              salida={r.entrar}
              antes="Entrar desde el"
              desconocida="Reentrada desconocida: mira la etiqueta. Sin ese dato no hay hora para entrar."
              prueba="entrar"
            />
          </>
        ) : (
          <span class="espera">
            Escribe la carencia y la reentrada de la etiqueta para ver las fechas.
          </span>
        )}
      </output>
      {alCuaderno && (
        <div class="al-cuaderno">
          {conCuaderno === false && (
            <p class="ayuda" data-prueba="que-es-el-cuaderno">
              El cuaderno de campo guarda tus aplicaciones en este teléfono y te dice cada día qué
              nave puedes cosechar: gratis, sin cuenta y sin señal.
            </p>
          )}
          <a
            class="boton-cuaderno"
            href={alCuaderno}
            data-prueba="aplicacion-al-cuaderno"
            onClick={() =>
              (window as { agroEventos?: ColectorDeEventos }).agroEventos?.registrar(
                'tool.next_step',
              )
            }
          >
            {conCuaderno === false
              ? 'Abrir el cuaderno con esta aplicación'
              : 'Guardar como aplicación en mi cuaderno'}
          </a>
        </div>
      )}
      {compartir && (
        <a
          class="boton-compartir"
          href={compartir.enlaceWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          data-prueba="compartir-whatsapp"
          onClick={() =>
            (window as { agroEventos?: ColectorDeEventos }).agroEventos?.registrar('tool.shared')
          }
        >
          Compartir por WhatsApp
        </a>
      )}
    </form>
  );
}
