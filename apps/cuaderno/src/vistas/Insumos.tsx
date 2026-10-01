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
  leerInsumos,
  plazo,
  TEXTO_ETIQUETA,
} from '../almacen/insumos.ts';
import { Campo, Opciones } from '../componentes/Campo.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';

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

function FormularioInsumo(props: {
  fincaId: string;
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<Insumo['tipo'] | ''>('');
  const [ica, setIca] = useState('');
  const [ingrediente, setIngrediente] = useState('');
  const [unidad, setUnidad] = useState('');
  const [carencia, setCarencia] = useState('');
  const [reentrada, setReentrada] = useState('');
  const [ecologico, setEcologico] = useState<'si' | 'no' | 'no-se' | ''>('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!nombre.trim()) err['nombre'] = 'Escribe el nombre comercial.';
    if (!tipo) err['tipo'] = 'Elige el tipo de insumo.';
    if (!unidad) err['unidad'] = 'Elige la unidad.';
    const c = leerPlazo(carencia, 'días');
    const r = leerPlazo(reentrada, 'horas');
    if (c.error) err['carencia'] = c.error;
    if (r.error) err['reentrada'] = r.error;
    if (!ecologico) err['ecologico'] = 'Elige una opción; «No sé» también vale.';
    setErrores(err);
    if (Object.keys(err).length > 0 || !tipo) return;
    try {
      await crearInsumo(cuaderno(), props.fincaId, {
        nombre_comercial: nombre.trim(),
        tipo,
        registro_ica: ica.trim() || null,
        ingrediente_activo: ingrediente.trim() || null,
        unidad,
        carencia_dias: c.valor,
        reentrada_horas: r.valor,
        permitido_ecologico: ecologico === 'si' ? true : ecologico === 'no' ? false : null,
      });
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
      <h2>Nuevo insumo</h2>
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
        </select>
        {errores['unidad'] && <p class="error">{errores['unidad']}</p>}
      </div>
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
        <button type="submit">Guardar insumo</button>
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

function ListaInsumos(props: { finca: Finca; insumos: Insumo[] }) {
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
          </li>
        );
      })}
    </ul>
  );
}

export function Insumos() {
  const estado = usarFinca();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nuevo, setNuevo] = useState(false);
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
      <ListaInsumos finca={finca} insumos={insumos} />
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
        <div class="acciones">
          <button type="button" onClick={() => setNuevo(true)}>
            Agregar insumo
          </button>
        </div>
      )}
    </section>
  );
}
