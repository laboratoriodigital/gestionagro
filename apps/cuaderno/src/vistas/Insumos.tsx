/**
 * Insumos con los datos de su etiqueta (HU-E3.6). La app no recomienda productos ni dosis.
 * Carencia o reentrada vacía se muestra «desconocida» en rojo, nunca como 0 (CA4, P1).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import { ErrorDeValidacion, type Finca, type Insumo } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import {
  avisoEcologico,
  crearInsumo,
  editarInsumo,
  leerInsumos,
  plazo,
  TEXTO_ETIQUETA,
} from '../almacen/insumos.ts';
import { Campo, Opciones } from '../componentes/Campo.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';
import { SoloConsulta, usarPermisos } from './usarPermisos.tsx';

const TIPOS = [
  { valor: 'bioinsumo', texto: 'Bioinsumo' },
  { valor: 'fertilizante', texto: 'Fertilizante' },
  { valor: 'fitosanitario', texto: 'Fitosanitario (plaguicida)' },
  { valor: 'sustrato', texto: 'Sustrato' },
  { valor: 'otro', texto: 'Otro' },
] as const;
const NOMBRE_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto])) as Record<
  Insumo['tipo'],
  string
>;
const UNIDADES = ['L', 'mL', 'kg', 'g', 'cc', 'unidad'] as const;
/** «Otra unidad…»: el productor escribe la suya (bulto, galón, caneca…). */
const OTRA = '__otra__';
const ECOLOGICO = [
  { valor: 'si', texto: 'Sí, la etiqueta o la certificadora lo permiten' },
  { valor: 'no', texto: 'No' },
  { valor: 'no-se', texto: 'No sé' },
] as const;

/** Entero ≥ 0, o null si está vacío (desconocido). Devuelve un error si es ilegible. */
function leerPlazo(texto: string, unidad: string): { valor: number | null; error?: string } {
  if (!texto.trim()) return { valor: null };
  const leido = leerNumero(texto);
  if (!leido.ok || !Number.isInteger(leido.valor) || leido.valor < 0) {
    return {
      valor: null,
      error: `Escribe un número entero de ${unidad}, o déjalo vacío si la etiqueta no lo dice.`,
    };
  }
  return { valor: leido.valor };
}

const textoPlazo = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v);
const ecologicoDe = (v: boolean | null | undefined): 'si' | 'no' | 'no-se' | '' =>
  v === true ? 'si' : v === false ? 'no' : v === null ? 'no-se' : '';

/** Crear (sin `inicial`) o editar (con `inicial`; guarda la versión anterior en el historial). */
function FormularioInsumo(props: {
  fincaId: string;
  inicial?: Insumo;
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const i = props.inicial;
  const unidadConocida = i ? (UNIDADES as readonly string[]).includes(i.unidad) : true;
  const [nombre, setNombre] = useState(i?.nombre_comercial ?? '');
  const [tipo, setTipo] = useState<Insumo['tipo'] | ''>(i?.tipo ?? '');
  const [ica, setIca] = useState(i?.registro_ica ?? '');
  const [ingrediente, setIngrediente] = useState(i?.ingrediente_activo ?? '');
  const [unidad, setUnidad] = useState(i ? (unidadConocida ? i.unidad : OTRA) : '');
  const [unidadOtra, setUnidadOtra] = useState(i && !unidadConocida ? i.unidad : '');
  const [carencia, setCarencia] = useState(textoPlazo(i?.carencia_dias));
  const [reentrada, setReentrada] = useState(textoPlazo(i?.reentrada_horas));
  const [ecologico, setEcologico] = useState<'si' | 'no' | 'no-se' | ''>(
    ecologicoDe(i?.permitido_ecologico),
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!nombre.trim()) err['nombre'] = 'Escribe el nombre comercial.';
    if (!tipo) err['tipo'] = 'Elige el tipo de insumo.';
    const unidadFinal = unidad === OTRA ? unidadOtra.trim() : unidad;
    if (!unidad) err['unidad'] = 'Elige la unidad.';
    else if (!unidadFinal) err['unidadOtra'] = 'Escribe la unidad, por ejemplo «bulto 25 kg».';
    const c = leerPlazo(carencia, 'días');
    const r = leerPlazo(reentrada, 'horas');
    if (c.error) err['carencia'] = c.error;
    if (r.error) err['reentrada'] = r.error;
    if (!ecologico) err['ecologico'] = 'Elige una opción; «No sé» también vale.';
    setErrores(err);
    if (Object.keys(err).length > 0 || !tipo) return;
    try {
      const datos = {
        nombre_comercial: nombre.trim(),
        tipo,
        registro_ica: ica.trim() || null,
        ingrediente_activo: ingrediente.trim() || null,
        unidad: unidadFinal,
        carencia_dias: c.valor,
        reentrada_horas: r.valor,
        permitido_ecologico: ecologico === 'si' ? true : ecologico === 'no' ? false : null,
      };
      if (i) await editarInsumo(cuaderno(), i.id, datos);
      else await crearInsumo(cuaderno(), props.fincaId, datos);
      props.alTerminar();
    } catch (error) {
      setErrores({
        general:
          error instanceof ErrorDeValidacion
            ? `No se guardó: ${error.campos.map((x) => x.motivo).join('; ')}.`
            : 'No se pudo guardar en el teléfono. Inténtalo otra vez.',
      });
    }
  };

  return (
    <form class="formulario-area" onSubmit={(e) => void guardar(e)} noValidate>
      <h2>{i ? `Editar ${i.nombre_comercial}` : 'Nuevo insumo'}</h2>
      <p class="aviso-legal" data-prueba="texto-etiqueta">
        {TEXTO_ETIQUETA}
      </p>
      <Campo
        id="insumo-nombre"
        etiqueta="Nombre comercial"
        valor={nombre}
        error={errores['nombre']}
        alCambiar={setNombre}
      />
      <Opciones
        nombre="insumo-tipo"
        leyenda="Tipo"
        opciones={TIPOS}
        valor={tipo}
        error={errores['tipo']}
        alCambiar={setTipo}
      />
      <Campo id="insumo-ica" etiqueta="Registro ICA (opcional)" valor={ica} alCambiar={setIca} />
      <Campo
        id="insumo-ingrediente"
        etiqueta="Ingrediente activo (opcional)"
        valor={ingrediente}
        alCambiar={setIngrediente}
      />
      <div class="campo">
        <label for="insumo-unidad">Unidad</label>
        <select
          id="insumo-unidad"
          value={unidad}
          aria-invalid={errores['unidad'] ? 'true' : 'false'}
          onChange={(e) => setUnidad((e.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">Elige la unidad</option>
          {UNIDADES.map((u) => (
            <option value={u} key={u}>
              {u}
            </option>
          ))}
          <option value={OTRA}>Otra unidad…</option>
        </select>
        {errores['unidad'] && <p class="error">{errores['unidad']}</p>}
      </div>
      {unidad === OTRA && (
        <Campo
          id="insumo-unidad-otra"
          etiqueta="Nombre de la unidad"
          ayuda="Como aparece en la etiqueta o como lo compras: bulto 25 kg, galón, caneca…"
          valor={unidadOtra}
          error={errores['unidadOtra']}
          alCambiar={setUnidadOtra}
        />
      )}
      <Campo
        id="insumo-carencia"
        etiqueta="Periodo de carencia (días)"
        ayuda="Días entre la aplicación y la cosecha. Si la etiqueta no lo dice, déjalo vacío: quedará como desconocido, no como 0."
        decimal
        valor={carencia}
        error={errores['carencia']}
        alCambiar={setCarencia}
      />
      <Campo
        id="insumo-reentrada"
        etiqueta="Periodo de reentrada (horas)"
        ayuda="Horas antes de volver a entrar a la nave aplicada. Vacío es desconocido."
        decimal
        valor={reentrada}
        error={errores['reentrada']}
        alCambiar={setReentrada}
      />
      <Opciones
        nombre="insumo-ecologico"
        leyenda="¿Permitido en producción ecológica?"
        opciones={ECOLOGICO}
        valor={ecologico}
        error={errores['ecologico']}
        alCambiar={setEcologico}
      />
      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      <div class="acciones">
        <button type="button" class="secundario" onClick={props.alCancelar}>
          Cancelar
        </button>
        <button type="submit">{i ? 'Guardar cambios' : 'Guardar insumo'}</button>
      </div>
    </form>
  );
}

function Plazo(props: { etiqueta: string; valor: number | null; unidad: 'días' | 'horas' }) {
  const p = plazo(props.valor, props.unidad);
  return (
    <span class={p.conocido ? '' : 'desconocida'}>
      {props.etiqueta}: {p.texto}
    </span>
  );
}

function ListaInsumos(props: {
  finca: Finca;
  insumos: Insumo[];
  editando: string | null;
  cambia: boolean;
  alEditar: (id: string | null) => void;
  alGuardar: () => void;
}) {
  if (props.insumos.length === 0) return <p class="ayuda">Todavía no hay insumos.</p>;
  return (
    <ul class="areas" data-prueba="insumos">
      {props.insumos.map((i) => {
        const aviso = avisoEcologico(props.finca, i);
        return (
          <li class="area" key={i.id} data-prueba="insumo">
            <p class="area-titulo">
              <strong>{i.nombre_comercial}</strong> · {NOMBRE_TIPO[i.tipo]} · {i.unidad}
            </p>
            <p class="detalle-insumo">
              {i.registro_ica ? `Registro ICA ${i.registro_ica}` : 'Sin registro ICA anotado'}
              {i.ingrediente_activo && ` · ${i.ingrediente_activo}`}
            </p>
            <p class="detalle-insumo">
              <Plazo etiqueta="Carencia" valor={i.carencia_dias} unidad="días" /> ·{' '}
              <Plazo etiqueta="Reentrada" valor={i.reentrada_horas} unidad="horas" />
            </p>
            {aviso && (
              <p class="aviso-ecologico" data-prueba="aviso-ecologico">
                {aviso}
              </p>
            )}
            {props.editando === i.id ? (
              <FormularioInsumo
                fincaId={props.finca.id}
                inicial={i}
                alTerminar={props.alGuardar}
                alCancelar={() => props.alEditar(null)}
              />
            ) : (
              props.cambia && (
                <div class="acciones-area">
                  <button
                    type="button"
                    class="secundario"
                    onClick={() => props.alEditar(i.id)}
                    aria-label={`Editar ${i.nombre_comercial}`}
                  >
                    Editar
                  </button>
                </div>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Insumos() {
  const estado = usarFinca();
  const permisos = usarPermisos();
  const cambia = permisos.puede('escribir', 'insumo');
  // null = cargando: mientras tanto no se dice «no hay».
  const [insumos, setInsumos] = useState<Insumo[] | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const finca = !estado.cargando ? estado.finca : null;

  const cargar = () => {
    if (finca) void leerInsumos(cuaderno(), finca.id).then(setInsumos);
  };
  useEffect(cargar, [finca?.id]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!finca) return <SinFinca />;

  return (
    <section aria-labelledby="titulo-insumos">
      <h1 id="titulo-insumos">Insumos</h1>
      <p>
        Los productos que usas, con los datos de su etiqueta. Con ellos la app te avisará cuándo
        puedes cosechar y entrar a una nave aplicada.
      </p>
      {!cambia && <SoloConsulta rol={permisos.rol} que="los insumos" />}
      {insumos === null ? (
        <p class="ayuda">Cargando insumos…</p>
      ) : (
        <ListaInsumos
          finca={finca}
          insumos={insumos}
          editando={editando}
          cambia={cambia}
          alEditar={setEditando}
          alGuardar={() => {
            setEditando(null);
            cargar();
          }}
        />
      )}
      {nuevo ? (
        <FormularioInsumo
          fincaId={finca.id}
          alTerminar={() => {
            setNuevo(false);
            cargar();
          }}
          alCancelar={() => setNuevo(false)}
        />
      ) : (
        cambia && (
          <div class="acciones">
            <button type="button" onClick={() => setNuevo(true)}>
              Agregar insumo
            </button>
          </div>
        )
      )}
    </section>
  );
}
