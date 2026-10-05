/**
 * Formulario de labores (HU-E3.9). Qué labor, en qué área, quiénes y cuántas horas cada uno.
 *
 * - Las 3 labores usadas más recientemente van primero (CA4); luego el resto del catálogo y las
 *   sugerencias que aún no se han usado. «Otra labor…» la agrega al catálogo al guardar (CA1).
 * - Personas activas de la finca, tengan o no cuenta (CA2).
 * - Horas por persona en medias horas; más de 12 h de alguien en el día pide confirmar (CA3).
 */
import { leerNumero } from '@ed1/agro-calc';
import {
  type Area,
  ErrorDeRegistro,
  ErrorDeValidacion,
  type Persona,
  type Registro,
} from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import {
  guardarLabor,
  laboresRecientes,
  leerTiposLabor,
  SUGERENCIAS_LABOR,
} from '../almacen/labores.ts';
import { leerPersonas } from '../almacen/personas.ts';
import { Campo, CampoSeleccion, Opciones } from '../componentes/Campo.tsx';
import { AccionesDeFormulario, aTexto, EventoQueSeCorrige } from '../componentes/Correccion.tsx';

const OTRA = '__otra';

interface Valores {
  areaId: string;
  labor: string;
  otra: string;
  personas: string[];
  horas: string;
}

type Errores = Partial<Record<keyof Valores | 'general', string>>;

const normal = (s: string) => s.trim().toLocaleLowerCase('es');

/** Recientes primero, luego el catálogo y las sugerencias, sin repetir (CA4). */
export function ordenDeLabores(
  recientes: readonly string[],
  catalogo: readonly string[],
  sugerencias: readonly string[],
): string[] {
  const lista: string[] = [];
  for (const nombre of [...recientes, ...catalogo, ...sugerencias]) {
    if (!lista.some((x) => normal(x) === normal(nombre))) lista.push(nombre);
  }
  return lista;
}

export function FormularioLabor(props: {
  fincaId: string;
  areas: Area[];
  alGuardar: () => void;
  /** Labor vigente que se corrige (HU-E3.12). */
  corrige?: Registro | undefined;
  alCancelar?: () => void;
}) {
  const antes = props.corrige?.datos as { labor: string; horasPorPersona: number } | undefined;
  const [v, setV] = useState<Valores>({
    areaId:
      props.corrige?.area_ids[0] ?? (props.areas.length === 1 ? (props.areas[0]?.id ?? '') : ''),
    labor: antes?.labor ?? '',
    otra: '',
    personas: props.corrige ? [...props.corrige.persona_ids] : [],
    horas: aTexto(antes?.horasPorPersona),
  });
  const [labores, setLabores] = useState<string[]>([]);
  // null = cargando: mientras tanto no se dice «no hay».
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [aviso, setAviso] = useState<string[]>([]);
  const [confirmado, setConfirmado] = useState(false);
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = () => {
    const db = cuaderno();
    void (async () => {
      const recientes = await laboresRecientes(db, props.fincaId);
      const catalogo = (await leerTiposLabor(db, props.fincaId)).map((t) => t.nombre);
      setLabores(ordenDeLabores(recientes, catalogo, SUGERENCIAS_LABOR));
      setPersonas(await leerPersonas(db, props.fincaId));
    })();
  };
  useEffect(cargar, [props.fincaId]);

  const tieneAlgo = Boolean(v.labor || v.otra || v.horas || v.personas.length > 0);
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  // Cambiar personas u horas invalida una confirmación dada para otros valores.
  const cambiar = (cambios: Partial<Valores>) => {
    setV({ ...v, ...cambios });
    if ('personas' in cambios || 'horas' in cambios) {
      setAviso([]);
      setConfirmado(false);
    }
  };

  const alternarPersona = (id: string) =>
    cambiar({
      personas: v.personas.includes(id) ? v.personas.filter((x) => x !== id) : [...v.personas, id],
    });

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Errores = {};
    const nombreLabor = v.labor === OTRA ? v.otra.trim() : v.labor;
    if (!v.areaId) err.areaId = 'Elige el área.';
    if (!v.labor) err.labor = 'Elige la labor.';
    else if (!nombreLabor) err.otra = 'Escribe el nombre de la labor.';
    if (v.personas.length === 0) err.personas = 'Elige al menos una persona.';
    const horas = leerNumero(v.horas);
    if (!horas.ok) err.horas = v.horas ? horas.motivo : 'Escribe las horas por persona.';
    else if (horas.valor < 0.5 || horas.valor > 24 || !Number.isInteger(horas.valor * 2)) {
      err.horas = 'Van en medias horas, entre 0,5 y 24 (por ejemplo 1,5).';
    }
    setErrores(err);
    setGuardado(null);
    if (Object.keys(err).length > 0 || !horas.ok) return;
    try {
      await guardarLabor(
        cuaderno(),
        props.fincaId,
        {
          areaId: v.areaId,
          labor: nombreLabor,
          personaIds: v.personas,
          horasPorPersona: horas.valor,
          confirmarMasDe12: confirmado,
        },
        { corrige: props.corrige },
      );
      const cuantas = v.personas.length;
      setV({ ...v, labor: '', otra: '', personas: [], horas: '' });
      setAviso([]);
      setConfirmado(false);
      setGuardado(
        cuantas === 1
          ? 'Labor guardada en este teléfono.'
          : `Labor de ${cuantas} personas guardada en este teléfono.`,
      );
      cargar();
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeRegistro) {
        setErrores({ general: error.message });
      } else if (error instanceof ErrorDeValidacion) {
        const deHoras = error.campos.filter((c) => c.campo === 'horasPorPersona');
        if (deHoras.length > 0) setAviso(deHoras.map((c) => c.motivo));
        else setErrores({ general: error.message });
      } else {
        setErrores({ general: 'No se pudo guardar en el teléfono. Inténtalo otra vez.' });
      }
    }
  };

  return (
    <form
      class="formulario-area"
      onSubmit={(e) => void guardar(e)}
      noValidate
      data-prueba="formulario-labor"
    >
      <h2>{props.corrige ? 'Corregir labor' : 'Labores'}</h2>
      {props.corrige ? (
        <EventoQueSeCorrige registro={props.corrige} areas={props.areas} />
      ) : (
        <CampoSeleccion
          id="labor-area"
          etiqueta="Área"
          indicacion="Elige el área"
          opciones={props.areas.map((a) => ({ valor: a.id, texto: a.nombre }))}
          valor={v.areaId}
          error={errores.areaId}
          alCambiar={(x) => cambiar({ areaId: x })}
        />
      )}
      <Opciones
        nombre="labor-tipo"
        leyenda="Labor"
        opciones={[
          ...labores.map((l) => ({ valor: l, texto: l })),
          { valor: OTRA, texto: 'Otra labor…' },
        ]}
        valor={v.labor}
        error={errores.labor}
        alCambiar={(x) => cambiar({ labor: x })}
      />
      {v.labor === OTRA && (
        <Campo
          id="labor-otra"
          etiqueta="Nombre de la labor"
          valor={v.otra}
          error={errores.otra}
          alCambiar={(x) => cambiar({ otra: x })}
        />
      )}
      <fieldset
        class="opciones"
        aria-describedby={errores.personas ? 'labor-personas-error' : undefined}
      >
        <legend>Quiénes la hicieron</legend>
        {personas === null && <p class="ayuda">Cargando personas…</p>}
        {personas?.length === 0 && (
          <p class="ayuda">
            Primero agrega las personas en <a href="/agro/app/personas">Personas</a>.
          </p>
        )}
        {personas?.map((p) => (
          <label class="opcion" key={p.id}>
            <input
              type="checkbox"
              checked={v.personas.includes(p.id)}
              onChange={() => alternarPersona(p.id)}
            />
            {p.nombre}
          </label>
        ))}
        {errores.personas && (
          <p id="labor-personas-error" class="error">
            {errores.personas}
          </p>
        )}
      </fieldset>
      <Campo
        id="labor-horas"
        etiqueta="Horas por persona"
        ayuda="En medias horas: 1,5 sí; 1,3 no."
        decimal
        valor={v.horas}
        error={errores.horas}
        alCambiar={(x) => cambiar({ horas: x })}
      />
      {aviso.length > 0 && (
        <div class="aviso" role="alert" data-prueba="labor-aviso-horas">
          {aviso.map((a) => (
            <p key={a}>{a}</p>
          ))}
          <label class="opcion">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado((e.currentTarget as HTMLInputElement).checked)}
            />
            Sí, es correcto: guardar de todas formas
          </label>
        </div>
      )}
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
        texto="Guardar labor"
        alCancelar={props.alCancelar}
      />
    </form>
  );
}
