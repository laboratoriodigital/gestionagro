/**
 * Formulario de cosecha (HU-E6.1). Área, cantidad y unidad, calidad, descarte y quién cosechó.
 *
 * - Al elegir el área se ve si está en carencia: en rojo, con el motivo y la fecha. Guardar exige
 *   marcar «Cosechar de todas formas», y eso queda en el registro (CA2). El almacén vuelve a
 *   revisarlo al guardar: la pantalla no es la que decide.
 * - Unidad y calidad sin valor de fábrica (HU-E3.3, CA2). «Otra…» agrega al catálogo al guardar.
 */
import { leerNumero } from '@gestionagro/agro-calc';
import {
  type Area,
  ErrorDeRegistro,
  ErrorDeValidacion,
  type Persona,
  type Registro,
} from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import {
  type BloqueoPorCarencia,
  bloqueoPorCarencia,
  type DatosCosechaGuardada,
  guardarCosecha,
  leerCategorias,
  motivoDelBloqueo,
  SUGERENCIAS_CALIDAD,
  UNIDADES_COSECHA,
} from '../almacen/cosecha.ts';
import { leerPersonas } from '../almacen/personas.ts';
import { Campo, CampoSeleccion, Opciones } from '../componentes/Campo.tsx';
import { AccionesDeFormulario, aTexto, EventoQueSeCorrige } from '../componentes/Correccion.tsx';

const OTRA = '__otra';

interface Valores {
  areaId: string;
  cantidad: string;
  unidad: string;
  otraUnidad: string;
  categoria: string;
  otraCategoria: string;
  descarte: string;
  personas: string[];
}

type Errores = Partial<Record<keyof Valores | 'general' | 'carencia', string>>;

export function FormularioCosecha(props: {
  fincaId: string;
  areas: Area[];
  alGuardar: () => void;
  /** Cosecha vigente que se corrige (HU-E3.12). */
  corrige?: Registro | undefined;
  alCancelar?: () => void;
}) {
  const antes = props.corrige?.datos as DatosCosechaGuardada | undefined;
  const unidadConocida = (u: string) => (UNIDADES_COSECHA as readonly string[]).includes(u);
  const [v, setV] = useState<Valores>({
    areaId:
      props.corrige?.area_ids[0] ?? (props.areas.length === 1 ? (props.areas[0]?.id ?? '') : ''),
    cantidad: aTexto(antes?.cantidad),
    unidad: antes ? (unidadConocida(antes.unidad) ? antes.unidad : OTRA) : '',
    otraUnidad: antes && !unidadConocida(antes.unidad) ? antes.unidad : '',
    categoria: antes?.categoria ?? '',
    otraCategoria: '',
    descarte: aTexto(antes?.descarte),
    personas: props.corrige ? [...props.corrige.persona_ids] : [],
  });
  // null = cargando: mientras tanto no se dice «no hay».
  const [categorias, setCategorias] = useState<string[] | null>(null);
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [bloqueo, setBloqueo] = useState<BloqueoPorCarencia | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [errores, setErrores] = useState<Errores>({});
  const [guardado, setGuardado] = useState<string | null>(null);

  const cargar = () => {
    const db = cuaderno();
    void (async () => {
      const catalogo = (await leerCategorias(db, props.fincaId)).map((c) => c.nombre);
      setCategorias(catalogo.length > 0 ? catalogo : [...SUGERENCIAS_CALIDAD]);
      setPersonas(await leerPersonas(db, props.fincaId));
    })();
  };
  useEffect(cargar, [props.fincaId]);

  // CA2: el bloqueo se ve al elegir el área, antes de escribir nada más.
  useEffect(() => {
    setConfirmado(false);
    if (!v.areaId) {
      setBloqueo(null);
      return;
    }
    const momento = props.corrige ? new Date(props.corrige.instante_evento) : new Date();
    void bloqueoPorCarencia(cuaderno(), props.fincaId, v.areaId, momento).then(setBloqueo);
  }, [v.areaId, props.fincaId]);

  const tieneAlgo = Boolean(v.cantidad || v.descarte || v.otraUnidad || v.otraCategoria);
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  const alternarPersona = (id: string) =>
    setV({
      ...v,
      personas: v.personas.includes(id) ? v.personas.filter((x) => x !== id) : [...v.personas, id],
    });

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Errores = {};
    if (!v.areaId) err.areaId = 'Elige el área.';
    const cantidad = leerNumero(v.cantidad);
    if (!cantidad.ok) err.cantidad = v.cantidad ? cantidad.motivo : 'Escribe cuánto se cosechó.';
    else if (cantidad.valor <= 0) err.cantidad = 'Debe ser mayor que 0.';
    const unidad = v.unidad === OTRA ? v.otraUnidad.trim() : v.unidad;
    if (!v.unidad) err.unidad = 'Elige la unidad.';
    else if (!unidad) err.otraUnidad = 'Escribe la unidad.';
    const categoria = v.categoria === OTRA ? v.otraCategoria.trim() : v.categoria;
    if (!v.categoria) err.categoria = 'Elige la calidad.';
    else if (!categoria) err.otraCategoria = 'Escribe la calidad.';
    let descarte: number | null = null;
    if (v.descarte.trim()) {
      const d = leerNumero(v.descarte);
      if (!d.ok) err.descarte = d.motivo;
      else if (cantidad.ok && d.valor > cantidad.valor) {
        err.descarte = 'No puede ser mayor que lo cosechado.';
      } else descarte = d.valor;
    }
    if (bloqueo && !confirmado) err.carencia = motivoDelBloqueo(bloqueo);
    setErrores(err);
    setGuardado(null);
    if (Object.keys(err).length > 0 || !cantidad.ok) return;
    try {
      await guardarCosecha(
        cuaderno(),
        props.fincaId,
        {
          areaId: v.areaId,
          cantidad: cantidad.valor,
          unidad,
          categoria,
          descarte,
          personaIds: v.personas,
          confirmarCarencia: confirmado,
        },
        { corrige: props.corrige },
      );
      setV({ ...v, cantidad: '', descarte: '', otraCategoria: '', personas: [] });
      setConfirmado(false);
      setGuardado(
        bloqueo
          ? 'Cosecha guardada en este teléfono, con la carencia anotada.'
          : 'Cosecha guardada en este teléfono.',
      );
      cargar();
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeRegistro) {
        setErrores({ general: error.message });
      } else if (error instanceof ErrorDeValidacion) {
        const nuevos: Errores = {};
        for (const c of error.campos) {
          if (c.campo === 'carencia' || c.campo === 'descarte' || c.campo === 'categoria') {
            nuevos[c.campo] = c.motivo;
          }
        }
        setErrores(Object.keys(nuevos).length > 0 ? nuevos : { general: error.message });
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
      data-prueba="formulario-cosecha"
    >
      <h2>{props.corrige ? 'Corregir cosecha' : 'Cosecha'}</h2>
      {props.corrige ? (
        <EventoQueSeCorrige registro={props.corrige} areas={props.areas} />
      ) : (
        <CampoSeleccion
          id="cosecha-area"
          etiqueta="Área"
          indicacion="Elige el área"
          opciones={props.areas.map((a) => ({ valor: a.id, texto: a.nombre }))}
          valor={v.areaId}
          error={errores.areaId}
          alCambiar={(x) => setV({ ...v, areaId: x })}
        />
      )}
      {bloqueo && (
        <div class="aviso bloqueo-carencia" role="alert" data-prueba="cosecha-bloqueo">
          <p>
            <strong>{motivoDelBloqueo(bloqueo)}.</strong>
          </p>
          <label class="opcion">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado((e.currentTarget as HTMLInputElement).checked)}
            />
            Cosechar de todas formas: quedará anotado en el registro
          </label>
          {errores.carencia && !confirmado && (
            <p class="error">Marca la casilla para guardar, o no coseches esta área todavía.</p>
          )}
        </div>
      )}
      <Campo
        id="cosecha-cantidad"
        etiqueta="Cantidad cosechada"
        decimal
        valor={v.cantidad}
        error={errores.cantidad}
        alCambiar={(x) => setV({ ...v, cantidad: x })}
      />
      <Opciones
        nombre="cosecha-unidad"
        leyenda="Unidad"
        opciones={[
          ...UNIDADES_COSECHA.map((u) => ({ valor: u, texto: u })),
          { valor: OTRA, texto: 'Otra unidad…' },
        ]}
        valor={v.unidad}
        error={errores.unidad}
        alCambiar={(x) => setV({ ...v, unidad: x })}
      />
      {v.unidad === OTRA && (
        <Campo
          id="cosecha-otra-unidad"
          etiqueta="Nombre de la unidad"
          valor={v.otraUnidad}
          error={errores.otraUnidad}
          alCambiar={(x) => setV({ ...v, otraUnidad: x })}
        />
      )}
      {categorias === null ? (
        <p class="ayuda">Cargando calidades…</p>
      ) : (
        <Opciones
          nombre="cosecha-calidad"
          leyenda="Calidad"
          opciones={[
            ...categorias.map((c) => ({ valor: c, texto: c })),
            { valor: OTRA, texto: 'Otra calidad…' },
          ]}
          valor={v.categoria}
          error={errores.categoria}
          alCambiar={(x) => setV({ ...v, categoria: x })}
        />
      )}
      {v.categoria === OTRA && (
        <Campo
          id="cosecha-otra-calidad"
          etiqueta="Nombre de la calidad"
          valor={v.otraCategoria}
          error={errores.otraCategoria}
          alCambiar={(x) => setV({ ...v, otraCategoria: x })}
        />
      )}
      <Campo
        id="cosecha-descarte"
        etiqueta="Descarte, en la misma unidad (opcional)"
        decimal
        valor={v.descarte}
        error={errores.descarte}
        alCambiar={(x) => setV({ ...v, descarte: x })}
      />
      <fieldset class="opciones">
        <legend>Quién cosechó (opcional)</legend>
        {personas === null && <p class="ayuda">Cargando personas…</p>}
        {personas?.length === 0 && (
          <p class="ayuda">
            Puedes agregar las personas en <a href="/agro/app/personas/">Personas</a>.
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
      </fieldset>
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
        texto="Guardar cosecha"
        alCancelar={props.alCancelar}
      />
    </form>
  );
}
