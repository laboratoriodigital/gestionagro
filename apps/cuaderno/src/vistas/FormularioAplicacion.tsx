/**
 * Formulario de aplicaciones (HU-E3.10). Áreas, insumo, dosis según etiqueta y quién aplicó.
 * Mezcla y equipo van plegados.
 *
 * - La dosis es la de la etiqueta: número y unidad como los escribe la etiqueta. La app no sugiere
 *   ninguna (CA2, instrucciones §7).
 * - Al elegir el insumo se ven su carencia y su reentrada; desconocidas, en rojo (CA4).
 * - En una finca ecológica aparece el mismo aviso de Insumos; no bloquea (CA5, HU-E3.6).
 * - Al guardar se ve, por área, hasta cuándo no se cosecha y desde cuándo se puede entrar (CA1).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import {
  type Area,
  ErrorDeRegistro,
  ErrorDeValidacion,
  type Finca,
  type Insumo,
  type Persona,
  type Registro,
} from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import {
  type DatosAplicacionGuardada,
  type EstadoDeArea,
  estadosPorArea,
  guardarAplicacion,
} from '../almacen/aplicaciones.ts';
import { avisoEcologico, leerInsumos, plazo } from '../almacen/insumos.ts';
import { leerPersonas } from '../almacen/personas.ts';
import { Campo, CampoSeleccion } from '../componentes/Campo.tsx';
import { AccionesDeFormulario, aTexto, EventoQueSeCorrige } from '../componentes/Correccion.tsx';
import { Vencimientos } from '../componentes/Vencimientos.tsx';

export const TEXTO_DOSIS =
  'Escribe la dosis tal como dice la etiqueta del producto registrado ante el ICA. Esta app no sugiere dosis.';

interface Valores {
  areas: string[];
  insumoId: string;
  dosis: string;
  dosisUnidad: string;
  personas: string[];
  mezcla: string;
  equipo: string;
}

type Errores = Partial<Record<keyof Valores | 'general', string>>;

const CAMPO_DE_ERROR: Record<string, keyof Valores> = {
  area_ids: 'areas',
  persona_ids: 'personas',
  insumo_id: 'insumoId',
  'datos.dosis': 'dosis',
  'datos.dosisUnidad': 'dosisUnidad',
  'datos.volumenMezclaL': 'mezcla',
};

function Plazo(props: { etiqueta: string; valor: number | null; unidad: 'días' | 'horas' }) {
  const p = plazo(props.valor, props.unidad);
  return (
    <span class={p.conocido ? '' : 'desconocida'}>
      {props.etiqueta}: {p.texto}
    </span>
  );
}

export function FormularioAplicacion(props: {
  finca: Finca;
  areas: Area[];
  alGuardar: () => void;
  /** Aplicación vigente que se corrige (HU-E3.12). */
  corrige?: Registro | undefined;
  alCancelar?: () => void;
}) {
  const antes = props.corrige?.datos as DatosAplicacionGuardada | undefined;
  const vacio = (): Valores => ({
    areas: props.areas.length === 1 ? [props.areas[0]?.id ?? ''] : [],
    insumoId: '',
    dosis: '',
    dosisUnidad: '',
    personas: [],
    mezcla: '',
    equipo: '',
  });
  const inicial = (): Valores =>
    props.corrige && antes
      ? {
          areas: props.corrige.area_ids.slice(0, 1),
          insumoId: antes.insumo_id,
          dosis: aTexto(antes.dosis),
          dosisUnidad: antes.dosisUnidad,
          personas: [...props.corrige.persona_ids],
          mezcla: aTexto(antes.volumenMezclaL),
          equipo: antes.equipo ?? '',
        }
      : vacio();
  const [v, setV] = useState<Valores>(inicial);
  // null = cargando: mientras tanto no se dice «no hay» (revisión del dueño, 1 oct 2026).
  const [insumos, setInsumos] = useState<Insumo[] | null>(null);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [guardadas, setGuardadas] = useState<{ area: Area; estado: EstadoDeArea | undefined }[]>(
    [],
  );

  useEffect(() => {
    const db = cuaderno();
    void (async () => {
      setInsumos(await leerInsumos(db, props.finca.id));
      setPersonas(await leerPersonas(db, props.finca.id));
    })();
  }, [props.finca.id]);

  const tieneAlgo = Boolean(v.insumoId || v.dosis || v.dosisUnidad || v.mezcla || v.equipo);
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  const insumo = insumos?.find((i) => i.id === v.insumoId);
  const aviso = insumo ? avisoEcologico(props.finca, insumo) : null;
  const alternar = (lista: 'areas' | 'personas', id: string) =>
    setV({
      ...v,
      [lista]: v[lista].includes(id) ? v[lista].filter((x) => x !== id) : [...v[lista], id],
    });

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Errores = {};
    if (v.areas.length === 0) err.areas = 'Elige al menos un área.';
    if (!v.insumoId) err.insumoId = 'Elige el insumo.';
    const dosis = leerNumero(v.dosis);
    if (!dosis.ok) err.dosis = v.dosis ? dosis.motivo : 'Escribe la dosis de la etiqueta.';
    else if (dosis.valor <= 0) err.dosis = 'La dosis debe ser mayor que 0.';
    if (!v.dosisUnidad.trim()) err.dosisUnidad = 'Escribe la unidad como dice la etiqueta.';
    if (v.personas.length === 0) err.personas = 'Elige quién aplicó.';
    let mezcla: number | null = null;
    if (v.mezcla.trim()) {
      const m = leerNumero(v.mezcla);
      if (!m.ok) err.mezcla = m.motivo;
      else if (m.valor <= 0) err.mezcla = 'Debe ser mayor que 0.';
      else mezcla = m.valor;
    }
    setErrores(err);
    setGuardadas([]);
    if (Object.keys(err).length > 0 || !dosis.ok) return;
    try {
      const db = cuaderno();
      await guardarAplicacion(
        db,
        props.finca.id,
        v.areas,
        {
          insumoId: v.insumoId,
          dosis: dosis.valor,
          dosisUnidad: v.dosisUnidad,
          volumenMezclaL: mezcla,
          equipo: v.equipo.trim() || null,
          personaIds: v.personas,
        },
        { corrige: props.corrige },
      );
      const estados = await estadosPorArea(db, props.finca.id);
      setGuardadas(
        props.areas
          .filter((a) => v.areas.includes(a.id))
          .map((a) => ({ area: a, estado: estados.get(a.id) })),
      );
      setV(vacio());
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeValidacion || error instanceof ErrorDeRegistro) {
        const nuevos: Errores = {};
        for (const c of error.campos) {
          const campo = CAMPO_DE_ERROR[c.campo];
          if (campo) nuevos[campo] = c.motivo;
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
      data-prueba="formulario-aplicacion"
    >
      <h2>{props.corrige ? 'Corregir aplicación' : 'Aplicaciones'}</h2>
      {props.corrige ? (
        <EventoQueSeCorrige registro={props.corrige} areas={props.areas} />
      ) : (
        <fieldset
          class="opciones"
          aria-describedby={errores.areas ? 'aplicacion-areas-error' : undefined}
        >
          <legend>Áreas aplicadas</legend>
          {props.areas.map((a) => (
            <label class="opcion" key={a.id}>
              <input
                type="checkbox"
                checked={v.areas.includes(a.id)}
                onChange={() => alternar('areas', a.id)}
              />
              {a.nombre}
            </label>
          ))}
          {errores.areas && (
            <p id="aplicacion-areas-error" class="error">
              {errores.areas}
            </p>
          )}
        </fieldset>
      )}
      {insumos === null ? (
        <p class="ayuda">Cargando insumos…</p>
      ) : insumos.length === 0 ? (
        <p class="ayuda">
          Primero agrega los insumos en <a href="/agro/app/insumos/">Insumos</a>.
        </p>
      ) : (
        <CampoSeleccion
          id="aplicacion-insumo"
          etiqueta="Insumo"
          indicacion="Elige el insumo"
          opciones={insumos.map((i) => ({ valor: i.id, texto: i.nombre_comercial }))}
          valor={v.insumoId}
          error={errores.insumoId}
          alCambiar={(x) => setV({ ...v, insumoId: x })}
        />
      )}
      {insumo && (
        <p class="detalle-insumo" data-prueba="aplicacion-plazos">
          <Plazo etiqueta="Carencia" valor={insumo.carencia_dias} unidad="días" /> ·{' '}
          <Plazo etiqueta="Reentrada" valor={insumo.reentrada_horas} unidad="horas" />
        </p>
      )}
      {aviso && (
        <p class="aviso-ecologico" data-prueba="aviso-ecologico">
          {aviso}
        </p>
      )}
      <fieldset class="opciones">
        <legend>Dosis según etiqueta del producto</legend>
        <p class="ayuda">{TEXTO_DOSIS}</p>
        <Campo
          id="aplicacion-dosis"
          etiqueta="Cantidad"
          decimal
          valor={v.dosis}
          error={errores.dosis}
          alCambiar={(x) => setV({ ...v, dosis: x })}
        />
        <Campo
          id="aplicacion-dosis-unidad"
          etiqueta="Unidad, como en la etiqueta (por ejemplo, cm³ por litro)"
          valor={v.dosisUnidad}
          error={errores.dosisUnidad}
          alCambiar={(x) => setV({ ...v, dosisUnidad: x })}
        />
      </fieldset>
      <fieldset
        class="opciones"
        aria-describedby={errores.personas ? 'aplicacion-personas-error' : undefined}
      >
        <legend>Quién aplicó</legend>
        {personas === null && <p class="ayuda">Cargando personas…</p>}
        {personas?.length === 0 && (
          <p class="ayuda">
            Primero agrega las personas en <a href="/agro/app/personas/">Personas</a>.
          </p>
        )}
        {personas?.map((p) => (
          <label class="opcion" key={p.id}>
            <input
              type="checkbox"
              checked={v.personas.includes(p.id)}
              onChange={() => alternar('personas', p.id)}
            />
            {p.nombre}
          </label>
        ))}
        {errores.personas && (
          <p id="aplicacion-personas-error" class="error">
            {errores.personas}
          </p>
        )}
      </fieldset>
      <details class="avanzado" open={Boolean(errores.mezcla)}>
        <summary>Mezcla y equipo (opcional)</summary>
        <Campo
          id="aplicacion-mezcla"
          etiqueta="Litros de mezcla preparados"
          decimal
          valor={v.mezcla}
          error={errores.mezcla}
          alCambiar={(x) => setV({ ...v, mezcla: x })}
        />
        <Campo
          id="aplicacion-equipo"
          etiqueta="Equipo (bomba de espalda, estacionaria…)"
          valor={v.equipo}
          alCambiar={(x) => setV({ ...v, equipo: x })}
        />
      </details>
      {errores.general && (
        <p class="error" role="alert">
          {errores.general}
        </p>
      )}
      {guardadas.length > 0 && (
        <div class="exito" role="status" data-prueba="aplicacion-guardada">
          <p>
            {guardadas.length === 1
              ? 'Aplicación guardada en este teléfono.'
              : `${guardadas.length} aplicaciones guardadas en este teléfono.`}
          </p>
          {guardadas.map((g) => (
            <div key={g.area.id} data-prueba="aplicacion-guardada-area">
              <strong>{g.area.nombre}</strong>
              <Vencimientos estado={g.estado} />
            </div>
          ))}
        </div>
      )}
      <AccionesDeFormulario
        corrigiendo={Boolean(props.corrige)}
        texto="Guardar aplicación"
        alCancelar={props.alCancelar}
      />
    </form>
  );
}
