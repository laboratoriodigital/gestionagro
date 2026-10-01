/**
 * Personas de la finca (HU-E3.5): quienes trabajan, tengan o no cuenta. Solo nombre y rol; el
 * valor del jornal es opcional y va aparte. Desactivar no borra: conserva el historial.
 */
import { leerNumero } from '@gestionagro/agro-calc';
import { ErrorDeValidacion, fechaAgronomica, type Persona } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { crearPersona, definirJornal, editarPersona, leerPersonas } from '../almacen/personas.ts';
import { Campo, Opciones } from '../componentes/Campo.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';
import { SoloConsulta, usarPermisos } from './usarPermisos.tsx';

const ROLES = [
  { valor: 'operario', texto: 'Operario' },
  { valor: 'supervisor', texto: 'Supervisor' },
  { valor: 'propietario', texto: 'Propietario' },
  { valor: 'asesor', texto: 'Asesor técnico' },
] as const;
const NOMBRE_ROL = Object.fromEntries(ROLES.map((r) => [r.valor, r.texto])) as Record<
  Persona['rol'],
  string
>;

function FormularioPersona(props: {
  fincaId: string;
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Persona['rol'] | ''>('');
  const [jornal, setJornal] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!nombre.trim()) err['nombre'] = 'Escribe el nombre.';
    if (!rol) err['rol'] = 'Elige el rol en la finca.';
    let valor: number | null = null;
    if (jornal.trim()) {
      const leido = leerNumero(jornal.replace(/\./g, ''));
      if (!leido.ok || !Number.isInteger(leido.valor) || leido.valor <= 0) {
        err['jornal'] = 'Escribe el valor en pesos, sin decimales, o déjalo vacío.';
      } else valor = leido.valor;
    }
    setErrores(err);
    if (Object.keys(err).length > 0 || !rol) return;
    try {
      const db = cuaderno();
      const persona = await crearPersona(db, props.fincaId, { nombre: nombre.trim(), rol });
      if (valor !== null) await definirJornal(db, persona.id, valor, fechaAgronomica(Date.now()));
      props.alTerminar();
    } catch (error) {
      setErrores({
        general:
          error instanceof ErrorDeValidacion
            ? `No se guardó: ${error.campos.map((c) => c.motivo).join('; ')}.`
            : 'No se pudo guardar en el teléfono. Inténtalo otra vez.',
      });
    }
  };

  return (
    <form class="formulario-area" onSubmit={(e) => void guardar(e)} noValidate>
      <h2>Nueva persona</h2>
      <Campo
        id="persona-nombre"
        etiqueta="Nombre"
        valor={nombre}
        error={errores['nombre']}
        alCambiar={setNombre}
      />
      <Opciones
        nombre="persona-rol"
        leyenda="Rol en la finca"
        opciones={ROLES}
        valor={rol}
        error={errores['rol']}
        alCambiar={setRol}
      />
      <Campo
        id="persona-jornal"
        etiqueta="Valor del jornal en pesos (opcional)"
        ayuda="Solo para calcular costos. Solo lo ven el propietario y el supervisor."
        decimal
        valor={jornal}
        error={errores['jornal']}
        alCambiar={setJornal}
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
        <button type="submit">Guardar persona</button>
      </div>
    </form>
  );
}

export function Personas() {
  const estado = usarFinca();
  const permisos = usarPermisos();
  const cambia = permisos.puede('escribir', 'persona');
  // null = cargando: mientras tanto no se dice «no hay».
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [nueva, setNueva] = useState(false);
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;

  const cargar = () => {
    if (fincaId)
      void leerPersonas(cuaderno(), fincaId, { incluirInactivas: true }).then(setPersonas);
  };
  useEffect(cargar, [fincaId]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!estado.finca || !fincaId) return <SinFinca />;

  const activas = (personas ?? []).filter((p) => p.activa);
  const inactivas = (personas ?? []).filter((p) => !p.activa);
  const cambiarActiva = async (p: Persona, activa: boolean) => {
    await editarPersona(cuaderno(), p.id, { activa });
    cargar();
  };

  return (
    <section aria-labelledby="titulo-personas">
      <h1 id="titulo-personas">Personas</h1>
      <p>
        Quienes trabajan en la finca, tengan o no cuenta. Solo se guarda el nombre y el rol: ni
        cédula ni teléfono.
      </p>
      {!cambia && <SoloConsulta rol={permisos.rol} que="las personas de la finca" />}
      {personas === null ? (
        <p class="ayuda">Cargando personas…</p>
      ) : activas.length === 0 ? (
        <p class="ayuda">Todavía no hay personas.</p>
      ) : (
        <ul class="areas" data-prueba="personas-activas">
          {activas.map((p) => (
            <li class="area" key={p.id}>
              <p class="area-titulo">
                <strong>{p.nombre}</strong> · {NOMBRE_ROL[p.rol]}
              </p>
              {cambia && (
                <div class="acciones-area">
                  <button
                    type="button"
                    class="secundario"
                    onClick={() => void cambiarActiva(p, false)}
                    aria-label={`Desactivar a ${p.nombre}`}
                  >
                    Ya no trabaja aquí
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {nueva ? (
        <FormularioPersona
          fincaId={fincaId}
          alTerminar={() => {
            setNueva(false);
            cargar();
          }}
          alCancelar={() => setNueva(false)}
        />
      ) : (
        cambia && (
          <div class="acciones">
            <button type="button" onClick={() => setNueva(true)}>
              Agregar persona
            </button>
          </div>
        )
      )}
      {inactivas.length > 0 && (
        <details>
          <summary>Personas que ya no trabajan aquí ({inactivas.length})</summary>
          <p class="ayuda">No aparecen en los formularios. Sus registros se conservan.</p>
          <ul class="areas" data-prueba="personas-inactivas">
            {inactivas.map((p) => (
              <li class="area" key={p.id}>
                <p class="area-titulo">
                  {p.nombre} · {NOMBRE_ROL[p.rol]}
                </p>
                {cambia && (
                  <button
                    type="button"
                    class="secundario"
                    onClick={() => void cambiarActiva(p, true)}
                    aria-label={`Reactivar a ${p.nombre}`}
                  >
                    Reactivar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
