/**
 * Formulario rápido de riego (HU-E3.7). A la vista solo lo de todos los días: áreas, volumen
 * aplicado, duración, volumen drenado y unidad, con teclado numérico (CA5). CE y pH van plegados.
 * La unidad elegida se recuerda en el teléfono para la próxima vez.
 */
import {
  drenajePct,
  ErrorDeMedida,
  formatearPct,
  leerNumero,
  RANGO_CE_DS_M,
  RANGO_PH,
} from '@ed1/agro-calc';
import { type Area, ErrorDeRegistro, type Registro } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { type DatosRiegoGuardado, guardarRiego, type UnidadRiego } from '../almacen/riego.ts';
import { Campo, Opciones } from '../componentes/Campo.tsx';
import { AccionesDeFormulario, aTexto, EventoQueSeCorrige } from '../componentes/Correccion.tsx';

const CLAVE_UNIDAD = 'gestionagro.unidad-riego';
/** Igual que el esquema `riego` v2. */
const RANGO_DURACION_MIN = [0.1, 1440] as const;
const UNIDADES = [
  { valor: 'mL_gotero', texto: 'mL por gotero' },
  { valor: 'L_area', texto: 'L por área' },
] as const;

function unidadRecordada(): UnidadRiego | '' {
  try {
    const u = localStorage.getItem(CLAVE_UNIDAD);
    return u === 'mL_gotero' || u === 'L_area' ? u : '';
  } catch {
    return ''; // navegador sin almacenamiento local: se elige cada vez
  }
}

interface Valores {
  areas: string[];
  unidad: UnidadRiego | '';
  aplicado: string;
  duracion: string;
  drenado: string;
  ceEntrada: string;
  phEntrada: string;
  ceDrenaje: string;
  phDrenaje: string;
}

const VACIO: Omit<Valores, 'areas' | 'unidad'> = {
  aplicado: '',
  duracion: '',
  drenado: '',
  ceEntrada: '',
  phEntrada: '',
  ceDrenaje: '',
  phDrenaje: '',
};

const CAMPO_DE_ERROR: Record<string, keyof Valores> = {
  volumenAplicado: 'aplicado',
  volumenDrenado: 'drenado',
  'datos.volumenAplicado': 'aplicado',
  'datos.volumenDrenado': 'drenado',
  'datos.duracionMin': 'duracion',
  'datos.ceEntradaDsM': 'ceEntrada',
  'datos.phEntrada': 'phEntrada',
  'datos.ceDrenajeDsM': 'ceDrenaje',
  'datos.phDrenaje': 'phDrenaje',
};

const coma = (n: number) => String(n).replace('.', ',');

/** Medición opcional: vacío es «no medido» (null), nunca 0 (CA2, P1). */
function opcional(
  texto: string,
  rango: readonly [number, number],
  unidad: string,
): { valor: number | null; error?: string } {
  if (!texto.trim()) return { valor: null };
  const leido = leerNumero(texto);
  if (!leido.ok) return { valor: null, error: leido.motivo };
  if (leido.valor < rango[0] || leido.valor > rango[1]) {
    return {
      valor: null,
      error: `Fuera de rango: debe estar entre ${coma(rango[0])} y ${coma(rango[1])}${unidad}.`,
    };
  }
  return { valor: leido.valor };
}

export function FormularioRiego(props: {
  fincaId: string;
  areas: Area[];
  alGuardar: () => void;
  /** Riego vigente que se corrige (HU-E3.12). */
  corrige?: Registro | undefined;
  alCancelar?: () => void;
}) {
  const antes = props.corrige?.datos as DatosRiegoGuardado | undefined;
  const [v, setV] = useState<Valores>(
    props.corrige && antes
      ? {
          areas: props.corrige.area_ids.slice(0, 1),
          unidad: antes.unidad,
          aplicado: aTexto(antes.volumenAplicado),
          // Los riegos v1 no tienen duración.
          duracion: aTexto(props.corrige.v >= 2 ? antes.duracionMin : null),
          drenado: aTexto(antes.volumenDrenado),
          ceEntrada: aTexto(antes.ceEntradaDsM),
          phEntrada: aTexto(antes.phEntrada),
          ceDrenaje: aTexto(antes.ceDrenajeDsM),
          phDrenaje: aTexto(antes.phDrenaje),
        }
      : {
          areas: props.areas.length === 1 ? [props.areas[0]?.id ?? ''] : [],
          unidad: unidadRecordada(),
          ...VACIO,
        },
  );
  const [errores, setErrores] = useState<Partial<Record<keyof Valores | 'general', string>>>({});
  const [guardado, setGuardado] = useState<string | null>(null);

  const tieneAlgo = Boolean(
    v.aplicado ||
      v.duracion ||
      v.drenado ||
      v.ceEntrada ||
      v.phEntrada ||
      v.ceDrenaje ||
      v.phDrenaje,
  );
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  const aplicado = leerNumero(v.aplicado);
  const drenado = leerNumero(v.drenado);
  let vistaPrevia: string | null = null;
  if (aplicado.ok && drenado.ok) {
    try {
      vistaPrevia = formatearPct(drenajePct(aplicado.valor, drenado.valor));
    } catch {
      vistaPrevia = null; // el motivo se muestra al guardar, junto al campo
    }
  }

  const alternarArea = (id: string) =>
    setV({
      ...v,
      areas: v.areas.includes(id) ? v.areas.filter((x) => x !== id) : [...v.areas, id],
    });

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Partial<Record<keyof Valores | 'general', string>> = {};
    if (v.areas.length === 0) err.areas = 'Elige al menos un área.';
    if (!v.unidad) err.unidad = 'Elige la unidad.';
    if (!aplicado.ok) err.aplicado = v.aplicado ? aplicado.motivo : 'Escribe el volumen aplicado.';
    let volumenDrenado: number | null = null;
    if (v.drenado.trim()) {
      if (!drenado.ok) err.drenado = drenado.motivo;
      else volumenDrenado = drenado.valor;
    }
    // Todo se revisa a la vez: un error en CE o pH no esconde el del drenaje (revisión del dueño).
    if (aplicado.ok && volumenDrenado !== null) {
      try {
        drenajePct(aplicado.valor, volumenDrenado);
      } catch (error) {
        if (!(error instanceof ErrorDeMedida)) throw error;
        const campo = CAMPO_DE_ERROR[error.campo] ?? 'drenado';
        err[campo] = error.message.replace(/^«[^»]+»\s*/, '');
      }
    }
    const duracion = opcional(v.duracion, RANGO_DURACION_MIN, ' minutos');
    if (duracion.error) err.duracion = duracion.error;
    const ceEntrada = opcional(v.ceEntrada, RANGO_CE_DS_M, ' dS/m');
    const phEntrada = opcional(v.phEntrada, RANGO_PH, '');
    const ceDrenaje = opcional(v.ceDrenaje, RANGO_CE_DS_M, ' dS/m');
    const phDrenaje = opcional(v.phDrenaje, RANGO_PH, '');
    if (ceEntrada.error) err.ceEntrada = ceEntrada.error;
    if (phEntrada.error) err.phEntrada = phEntrada.error;
    if (ceDrenaje.error) err.ceDrenaje = ceDrenaje.error;
    if (phDrenaje.error) err.phDrenaje = phDrenaje.error;
    setErrores(err);
    setGuardado(null);
    if (Object.keys(err).length > 0 || !aplicado.ok || !v.unidad) return;
    try {
      const guardados = await guardarRiego(
        cuaderno(),
        props.fincaId,
        v.areas,
        {
          unidad: v.unidad,
          volumenAplicado: aplicado.valor,
          duracionMin: duracion.valor,
          volumenDrenado,
          ceEntradaDsM: ceEntrada.valor,
          phEntrada: phEntrada.valor,
          ceDrenajeDsM: ceDrenaje.valor,
          phDrenaje: phDrenaje.valor,
        },
        { corrige: props.corrige },
      );
      try {
        localStorage.setItem(CLAVE_UNIDAD, v.unidad);
      } catch {
        // sin almacenamiento local, la unidad se elige cada vez; el riego ya quedó guardado
      }
      setV({ ...v, ...VACIO });
      setGuardado(
        guardados.length === 1
          ? 'Riego guardado en este teléfono.'
          : `${guardados.length} riegos guardados en este teléfono.`,
      );
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeMedida || error instanceof ErrorDeRegistro) {
        const campos =
          error instanceof ErrorDeMedida
            ? [{ campo: error.campo, motivo: error.message }]
            : error.campos;
        const nuevos: typeof err = {};
        for (const c of campos) {
          const campo = CAMPO_DE_ERROR[c.campo];
          if (campo) nuevos[campo] = c.motivo.replace(/^«[^»]+»\s*/, '');
        }
        setErrores(Object.keys(nuevos).length > 0 ? nuevos : { general: error.message });
      } else {
        setErrores({
          general: 'No se pudo guardar en el teléfono. Nada quedó a medias: inténtalo otra vez.',
        });
      }
    }
  };

  return (
    <form
      class="formulario-area"
      onSubmit={(e) => void guardar(e)}
      noValidate
      data-prueba="formulario-riego"
    >
      <h2>{props.corrige ? 'Corregir riego' : 'Riego'}</h2>
      {props.corrige ? (
        <EventoQueSeCorrige registro={props.corrige} areas={props.areas} />
      ) : (
        <fieldset
          class="opciones"
          aria-describedby={errores.areas ? 'riego-areas-error' : undefined}
        >
          <legend>Áreas regadas</legend>
          {props.areas.map((a) => (
            <label class="opcion" key={a.id}>
              <input
                type="checkbox"
                checked={v.areas.includes(a.id)}
                onChange={() => alternarArea(a.id)}
              />
              {a.nombre}
            </label>
          ))}
          {errores.areas && (
            <p id="riego-areas-error" class="error">
              {errores.areas}
            </p>
          )}
        </fieldset>
      )}
      <Opciones
        nombre="riego-unidad"
        leyenda="Unidad"
        opciones={UNIDADES}
        valor={v.unidad}
        error={errores.unidad}
        alCambiar={(u) => setV({ ...v, unidad: u })}
      />
      <Campo
        id="riego-aplicado"
        etiqueta="Volumen aplicado"
        decimal
        valor={v.aplicado}
        error={errores.aplicado}
        alCambiar={(x) => setV({ ...v, aplicado: x })}
      />
      <Campo
        id="riego-duracion"
        etiqueta="Duración del riego en minutos (opcional)"
        decimal
        valor={v.duracion}
        error={errores.duracion}
        alCambiar={(x) => setV({ ...v, duracion: x })}
      />
      <Campo
        id="riego-drenado"
        etiqueta="Volumen drenado (opcional)"
        decimal
        valor={v.drenado}
        error={errores.drenado}
        alCambiar={(x) => setV({ ...v, drenado: x })}
      />
      <p class="estado" aria-live="polite" data-prueba="riego-drenaje">
        {vistaPrevia ? (
          <>
            Drenaje: <strong>{vistaPrevia}</strong>
          </>
        ) : (
          'Escribe lo aplicado y lo drenado para ver el % de drenaje.'
        )}
      </p>
      <details
        class="avanzado"
        open={Boolean(
          errores.ceEntrada || errores.phEntrada || errores.ceDrenaje || errores.phDrenaje,
        )}
      >
        <summary>CE y pH (opcional)</summary>
        <Campo
          id="riego-ce-entrada"
          etiqueta="CE de entrada (dS/m)"
          decimal
          valor={v.ceEntrada}
          error={errores.ceEntrada}
          alCambiar={(x) => setV({ ...v, ceEntrada: x })}
        />
        <Campo
          id="riego-ph-entrada"
          etiqueta="pH de entrada"
          decimal
          valor={v.phEntrada}
          error={errores.phEntrada}
          alCambiar={(x) => setV({ ...v, phEntrada: x })}
        />
        <Campo
          id="riego-ce-drenaje"
          etiqueta="CE de drenaje (dS/m)"
          decimal
          valor={v.ceDrenaje}
          error={errores.ceDrenaje}
          alCambiar={(x) => setV({ ...v, ceDrenaje: x })}
        />
        <Campo
          id="riego-ph-drenaje"
          etiqueta="pH de drenaje"
          decimal
          valor={v.phDrenaje}
          error={errores.phDrenaje}
          alCambiar={(x) => setV({ ...v, phDrenaje: x })}
        />
      </details>
      {errores.general && (
        <p class="error" role="alert">
          {errores.general}
        </p>
      )}
      {guardado && (
        <p class="exito" role="status">
          {guardado}
        </p>
      )}
      <AccionesDeFormulario
        corrigiendo={Boolean(props.corrige)}
        texto="Guardar riego"
        alCancelar={props.alCancelar}
      />
    </form>
  );
}
