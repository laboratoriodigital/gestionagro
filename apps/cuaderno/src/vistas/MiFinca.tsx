/**
 * La finca configurada: áreas y sus camas o surcos, todas editables con historial; agregar
 * áreas después del registro inicial (HU-E3.3, CA3 y CA4). Cada formulario abierto cuenta como
 * actividad (HU-E3.1, CA2).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import {
  type Area,
  type Ciclo,
  type Cultivo,
  ErrorDeValidacion,
  type Finca,
} from '@gestionagro/agro-schema';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { type EstadoDeArea, estadosPorArea } from '../almacen/aplicaciones.ts';
import type { CuadernoDb, VersionAnterior } from '../almacen/db.ts';
import {
  agregarArea,
  crearSubarea,
  editarArea,
  historialDe,
  TIPOS_PRINCIPALES,
  TIPOS_SUBAREA,
} from '../almacen/finca.ts';
import { Campo, CampoSeleccion, Opciones } from '../componentes/Campo.tsx';
import {
  ABIERTAS_HASTA,
  ControlesPlegables,
  Plegable,
  usarPlegables,
} from '../componentes/Plegables.tsx';
import { Vencimientos } from '../componentes/Vencimientos.tsx';
import { fechaHora, metros, NOMBRE_REGIMEN, NOMBRE_TIPO } from '../formato.ts';
import { CicloDeArea } from './CicloDeArea.tsx';
import { SoloConsulta, usarPermisos } from './usarPermisos.tsx';

type Abierto =
  | { tipo: 'editar' | 'subarea' | 'historial'; areaId: string }
  | { tipo: 'nueva-area' }
  | null;

type TipoArea = Area['tipo'];

const opcionesDe = (tipos: readonly TipoArea[]) =>
  tipos.map((t) => ({ valor: t, texto: NOMBRE_TIPO[t] ?? t }));

const mensaje = (error: unknown) =>
  error instanceof ErrorDeValidacion
    ? `No se guardó: ${error.campos.map((c) => c.motivo).join('; ')}.`
    : 'No se pudo guardar en el teléfono. Inténtalo otra vez.';

/**
 * Formulario de un área. `elegirTipo`: «principal» (nave, bloque o lote, en lista),
 * «subarea» (cama o surco) o nada al editar, porque el tipo de un área no cambia.
 */
function FormularioArea(props: {
  titulo: string;
  inicial: { nombre: string; m2: string };
  elegirTipo?: 'principal' | 'subarea';
  alGuardar: (datos: { nombre: string; area_m2: number; tipo?: TipoArea }) => Promise<void>;
  alCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(props.inicial.nombre);
  const [m2, setM2] = useState(props.inicial.m2);
  const [tipo, setTipo] = useState<TipoArea | ''>('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const enviar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (props.elegirTipo && !tipo) {
      err['tipo'] =
        props.elegirTipo === 'subarea' ? 'Elige si es cama o surco.' : 'Elige nave, bloque o lote.';
    }
    if (!nombre.trim()) err['nombre'] = 'Escribe el nombre.';
    const leido = leerNumero(m2);
    if (!leido.ok) err['m2'] = leido.motivo;
    else if (leido.valor <= 0) err['m2'] = 'El área debe ser mayor que 0 m².';
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
      {props.elegirTipo === 'subarea' && (
        <Opciones
          nombre="tipo-subarea"
          leyenda="Tipo"
          opciones={opcionesDe(TIPOS_SUBAREA)}
          valor={tipo}
          error={errores['tipo']}
          alCambiar={setTipo}
        />
      )}
      {props.elegirTipo === 'principal' && (
        <CampoSeleccion
          id="form-area-tipo"
          etiqueta="Tipo"
          indicacion="Elige nave, bloque o lote"
          opciones={opcionesDe(TIPOS_PRINCIPALES)}
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
  if (versiones.length === 0) return <p class="ayuda">No tiene cambios anteriores.</p>;
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

/**
 * Botones Editar e Historial y sus paneles; iguales para un área y para una cama o surco. `extra`
 * va en la misma fila (en un área: «+ Cama o surco»), para que las herramientas no se apilen
 * (revisión del dueño, 1 oct 2026).
 */
function EditarConHistorial(props: {
  db: CuadernoDb;
  area: Area;
  abierto: Abierto;
  alternar: (tipo: 'editar' | 'historial', areaId: string) => void;
  cambia: boolean;
  alCerrar: () => void;
  alGuardar: () => void;
  extra?: ComponentChildren;
}) {
  const a = props.area;
  const abiertoAqui = props.abierto && 'areaId' in props.abierto && props.abierto.areaId === a.id;
  return (
    <>
      <div class="herramientas-area">
        {props.cambia && (
          <button
            type="button"
            class="herramienta"
            onClick={() => props.alternar('editar', a.id)}
            aria-label={`Editar ${a.nombre}`}
          >
            Editar
          </button>
        )}
        <button
          type="button"
          class="herramienta"
          onClick={() => props.alternar('historial', a.id)}
          aria-label={`Historial de ${a.nombre}`}
        >
          Historial
        </button>
        {props.extra}
      </div>
      {abiertoAqui && props.abierto?.tipo === 'editar' && (
        <FormularioArea
          titulo={`Editar ${a.nombre}`}
          inicial={{ nombre: a.nombre, m2: String(a.area_m2).replace('.', ',') }}
          alGuardar={async (d) => {
            await editarArea(props.db, a.id, { nombre: d.nombre, area_m2: d.area_m2 });
            props.alGuardar();
          }}
          alCancelar={props.alCerrar}
        />
      )}
      {abiertoAqui && props.abierto?.tipo === 'historial' && (
        <Historial db={props.db} areaId={a.id} />
      )}
    </>
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
  const permisos = usarPermisos();
  const cambia = permisos.puede('escribir', 'area');
  // Carencia y reentrada vigentes por área (HU-E3.10); se recalculan al volver a la pantalla.
  const [vencimientos, setVencimientos] = useState<Map<string, EstadoDeArea>>(new Map());
  useEffect(() => {
    void estadosPorArea(props.db, props.finca.id).then(setVencimientos);
  }, [props.db, props.finca.id, props.areas]);
  const principales = props.areas.filter((a) => a.padre_id === null);
  const hijas = (id: string) => props.areas.filter((a) => a.padre_id === id);
  // Con muchas naves, camas y surcos, cada área se pliega (revisión del dueño, 3 oct 2026).
  const plegables = usarPlegables(
    principales.map((a) => a.id),
    props.areas.length <= ABIERTAS_HASTA,
  );
  /** Lo que se ve con el área cerrada: si hoy no se puede cosechar o entrar, o no se sabe. */
  const sello = (id: string) => {
    const e = vencimientos.get(id);
    if (!e) return null;
    if (e.carencia.tipo === 'desconocida' || e.reentrada.tipo === 'desconocida')
      return <span class="sello-area desconocida">? carencia desconocida</span>;
    if (e.carencia.tipo === 'hasta')
      return <span class="sello-area en-carencia">✕ en carencia</span>;
    if (e.reentrada.tipo === 'desde')
      return <span class="sello-area en-carencia">✕ sin entrar</span>;
    return null;
  };
  const cerrarYRecargar = () => {
    setAbierto(null);
    props.alCambiar();
  };
  const alternar = (tipo: 'editar' | 'subarea' | 'historial', areaId: string) =>
    setAbierto(
      abierto && 'areaId' in abierto && abierto.tipo === tipo && abierto.areaId === areaId
        ? null
        : { tipo, areaId },
    );

  return (
    <section aria-labelledby="titulo-finca">
      <h1 id="titulo-finca">{props.finca.nombre}</h1>
      <p>
        {props.finca.municipio} · Producción {NOMBRE_REGIMEN[props.finca.regimen]?.toLowerCase()}
      </p>
      <h2>Áreas</h2>
      {!cambia && <SoloConsulta rol={permisos.rol} que="las áreas y sus ciclos" />}
      {principales.length > 1 && <ControlesPlegables p={plegables} que="áreas" id="areas" />}
      <ul class="areas" data-prueba="areas">
        {principales.map((a) => (
          <li key={a.id} class="area" data-prueba="area">
            <Plegable
              id={a.id}
              p={plegables}
              resumen={
                <span class="area-titulo">
                  <strong>{a.nombre}</strong> · {NOMBRE_TIPO[a.tipo]} · {metros(a.area_m2)}
                  {hijas(a.id).length > 0 && ` · ${hijas(a.id).length} camas o surcos`}{' '}
                  {sello(a.id)}
                </span>
              }
            >
              <Vencimientos estado={vencimientos.get(a.id)} />
              <CicloDeArea
                db={props.db}
                area={a}
                ciclo={props.ciclos.find((c) => c.estado === 'activo' && c.area_ids.includes(a.id))}
                cultivos={props.cultivos}
                cambia={permisos.puede('escribir', 'ciclo')}
                alCambiar={props.alCambiar}
              />
              {hijas(a.id).length > 0 && (
                <ul class="subareas" aria-label={`Camas y surcos de ${a.nombre}`}>
                  {hijas(a.id).map((s) => (
                    <li key={s.id} data-prueba="subarea">
                      <p class="area-titulo">
                        {s.nombre} · {NOMBRE_TIPO[s.tipo]} · {metros(s.area_m2)}
                      </p>
                      <EditarConHistorial
                        db={props.db}
                        area={s}
                        abierto={abierto}
                        alternar={alternar}
                        cambia={cambia}
                        alCerrar={() => setAbierto(null)}
                        alGuardar={cerrarYRecargar}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <EditarConHistorial
                db={props.db}
                area={a}
                abierto={abierto}
                alternar={alternar}
                cambia={cambia}
                alCerrar={() => setAbierto(null)}
                alGuardar={cerrarYRecargar}
                extra={
                  cambia && (
                    <button
                      type="button"
                      class="herramienta"
                      onClick={() => alternar('subarea', a.id)}
                      aria-label={`Agregar cama o surco en ${a.nombre}`}
                    >
                      + Cama o surco
                    </button>
                  )
                }
              />
              {abierto &&
                'areaId' in abierto &&
                abierto.areaId === a.id &&
                abierto.tipo === 'subarea' && (
                  <FormularioArea
                    titulo={`Nueva cama o surco en ${a.nombre}`}
                    inicial={{ nombre: '', m2: '' }}
                    elegirTipo="subarea"
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
            </Plegable>
          </li>
        ))}
      </ul>
      {abierto?.tipo === 'nueva-area' ? (
        <FormularioArea
          titulo="Nueva área"
          inicial={{ nombre: '', m2: '' }}
          elegirTipo="principal"
          alGuardar={async (d) => {
            await agregarArea(props.db, props.finca.id, {
              tipo: d.tipo ?? 'nave',
              nombre: d.nombre,
              area_m2: d.area_m2,
              capacidad_plantas: null,
            });
            cerrarYRecargar();
          }}
          alCancelar={() => setAbierto(null)}
        />
      ) : (
        cambia && (
          <div class="acciones">
            <button type="button" onClick={() => setAbierto({ tipo: 'nueva-area' })}>
              Agregar área
            </button>
          </div>
        )
      )}
    </section>
  );
}
