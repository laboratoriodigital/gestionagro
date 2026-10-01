/**
 * La finca configurada: áreas con sus subáreas, edición con historial y nuevas camas o surcos
 * (HU-E3.3, CA3 y CA4). Cada formulario abierto cuenta como actividad (HU-E3.1, CA2).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import {
  type Area,
  type Ciclo,
  type Cultivo,
  ErrorDeValidacion,
  type Finca,
} from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import type { CuadernoDb, VersionAnterior } from '../almacen/db.ts';
import { crearSubarea, editarArea, historialDe, TIPOS_SUBAREA } from '../almacen/finca.ts';
import { Campo, Opciones } from '../componentes/Campo.tsx';
import { fechaHora, metros, NOMBRE_REGIMEN, NOMBRE_TIPO } from '../formato.ts';
import { CicloDeArea } from './CicloDeArea.tsx';

type Abierto = { tipo: 'editar' | 'subarea' | 'historial'; areaId: string } | null;

const mensaje = (error: unknown) =>
  error instanceof ErrorDeValidacion
    ? `No se guardó: ${error.campos.map((c) => c.motivo).join('; ')}.`
    : 'No se pudo guardar en el teléfono. Inténtalo otra vez.';

function FormularioArea(props: {
  titulo: string;
  inicial: { nombre: string; m2: string };
  conTipo: boolean;
  alGuardar: (datos: { nombre: string; area_m2: number; tipo?: 'cama' | 'surco' }) => Promise<void>;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(props.inicial.nombre);
  const [m2, setM2] = useState(props.inicial.m2);
  const [tipo, setTipo] = useState<'cama' | 'surco' | ''>('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const enviar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!nombre.trim()) err['nombre'] = 'Escribe el nombre.';
    const leido = leerNumero(m2);
    if (!leido.ok) err['m2'] = leido.motivo;
    else if (leido.valor <= 0) err['m2'] = 'El área debe ser mayor que 0 m².';
    if (props.conTipo && !tipo) err['tipo'] = 'Elige si es cama o surco.';
    setErrores(err);
    if (Object.keys(err).length > 0 || !leido.ok) return;
    try {
      await props.alGuardar({
        nombre: nombre.trim(),
        area_m2: leido.valor,
        ...(tipo ? { tipo } : {}),
      });
    } catch (error) {
      setErrores({ general: mensaje(error) });
    }
  };

  return (
    <form class="formulario-area" onSubmit={(e) => void enviar(e)} noValidate>
      <h3>{props.titulo}</h3>
      {props.conTipo && (
        <Opciones
          nombre="tipo-subarea"
          leyenda="Tipo"
          opciones={TIPOS_SUBAREA.map((t) => ({ valor: t, texto: NOMBRE_TIPO[t] ?? t }))}
          valor={tipo}
          error={errores['tipo']}
          alCambiar={setTipo}
        />
      )}
      <Campo
        id="form-area-nombre"
        etiqueta="Nombre"
        valor={nombre}
        error={errores['nombre']}
        alCambiar={setNombre}
      />
      <Campo
        id="form-area-m2"
        etiqueta="Tamaño (m²)"
        decimal
        valor={m2}
        error={errores['m2']}
        alCambiar={setM2}
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
        <button type="submit">Guardar</button>
      </div>
    </form>
  );
}

function Historial(props: { db: CuadernoDb; areaId: string }) {
  const [versiones, setVersiones] = useState<VersionAnterior[] | null>(null);
  useEffect(() => {
    void historialDe(props.db, props.areaId).then(setVersiones);
  }, [props.areaId]);
  if (!versiones) return null;
  if (versiones.length === 0) return <p class="ayuda">Esta área no tiene cambios anteriores.</p>;
  return (
    <ol class="historial" data-prueba="historial">
      {versiones.map((v) => {
        const a = v.datos as Area;
        return (
          <li key={v.id}>
            Versión {v.version}: {a.nombre} · {metros(a.area_m2)} · reemplazada el{' '}
            {fechaHora(v.reemplazada)}
          </li>
        );
      })}
    </ol>
  );
}

export function MiFinca(props: {
  db: CuadernoDb;
  finca: Finca;
  areas: Area[];
  ciclos: Ciclo[];
  cultivos: Cultivo[];
  alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const principales = props.areas.filter((a) => a.padre_id === null);
  const hijas = (id: string) => props.areas.filter((a) => a.padre_id === id);
  const cerrarYRecargar = () => {
    setAbierto(null);
    props.alCambiar();
  };
  const alternar = (tipo: NonNullable<Abierto>['tipo'], areaId: string) =>
    setAbierto(abierto?.tipo === tipo && abierto.areaId === areaId ? null : { tipo, areaId });

  return (
    <section aria-labelledby="titulo-finca">
      <h1 id="titulo-finca">{props.finca.nombre}</h1>
      <p>
        {props.finca.municipio} · Producción {NOMBRE_REGIMEN[props.finca.regimen]?.toLowerCase()}
      </p>
      <h2>Áreas</h2>
      <ul class="areas" data-prueba="areas">
        {principales.map((a) => (
          <li key={a.id} class="area" data-prueba="area">
            <p class="area-titulo">
              <strong>{a.nombre}</strong> · {NOMBRE_TIPO[a.tipo]} · {metros(a.area_m2)}
            </p>
            <CicloDeArea
              db={props.db}
              area={a}
              ciclo={props.ciclos.find((c) => c.estado === 'activo' && c.area_ids.includes(a.id))}
              cultivos={props.cultivos}
              alCambiar={props.alCambiar}
            />
            {hijas(a.id).length > 0 && (
              <ul class="subareas" aria-label={`Camas y surcos de ${a.nombre}`}>
                {hijas(a.id).map((s) => (
                  <li key={s.id}>
                    {s.nombre} · {NOMBRE_TIPO[s.tipo]} · {metros(s.area_m2)}
                  </li>
                ))}
              </ul>
            )}
            <div class="acciones-area">
              <button
                type="button"
                class="secundario"
                onClick={() => alternar('editar', a.id)}
                aria-label={`Editar ${a.nombre}`}
              >
                Editar
              </button>
              <button
                type="button"
                class="secundario"
                onClick={() => alternar('subarea', a.id)}
                aria-label={`Agregar cama o surco en ${a.nombre}`}
              >
                Agregar cama o surco
              </button>
              <button
                type="button"
                class="secundario"
                onClick={() => alternar('historial', a.id)}
                aria-label={`Historial de ${a.nombre}`}
              >
                Historial
              </button>
            </div>
            {abierto?.areaId === a.id && abierto.tipo === 'editar' && (
              <FormularioArea
                titulo={`Editar ${a.nombre}`}
                inicial={{ nombre: a.nombre, m2: String(a.area_m2).replace('.', ',') }}
                conTipo={false}
                alGuardar={async (d) => {
                  await editarArea(props.db, a.id, { nombre: d.nombre, area_m2: d.area_m2 });
                  cerrarYRecargar();
                }}
                alCancelar={() => setAbierto(null)}
              />
            )}
            {abierto?.areaId === a.id && abierto.tipo === 'subarea' && (
              <FormularioArea
                titulo={`Nueva cama o surco en ${a.nombre}`}
                inicial={{ nombre: '', m2: '' }}
                conTipo
                alGuardar={async (d) => {
                  await crearSubarea(props.db, a.id, {
                    tipo: d.tipo ?? 'cama',
                    nombre: d.nombre,
                    area_m2: d.area_m2,
                    capacidad_plantas: null,
                  });
                  cerrarYRecargar();
                }}
                alCancelar={() => setAbierto(null)}
              />
            )}
            {abierto?.areaId === a.id && abierto.tipo === 'historial' && (
              <Historial db={props.db} areaId={a.id} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
