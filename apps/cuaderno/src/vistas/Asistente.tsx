/**
 * Asistente de configuración de la finca en 3 pasos (HU-E3.3, CA1).
 * Todo arranca vacío: no hay nombres, municipios ni régimen de ejemplo que puedan quedarse
 * (CA2; bitácora ecommerce, «la configuración de fábrica»). Mientras está abierto cuenta como
 * formulario abierto: una actualización no lo interrumpe (HU-E3.1, CA2).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import { ErrorDeValidacion } from '@gestionagro/agro-schema';
import { useEffect, useRef, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import type { CuadernoDb } from '../almacen/db.ts';
import { crearFincaConAreas, type DatosArea, TIPOS_PRINCIPALES } from '../almacen/finca.ts';
import { Campo, CampoSeleccion, Opciones } from '../componentes/Campo.tsx';
import { metros, NOMBRE_REGIMEN, NOMBRE_TIPO } from '../formato.ts';

type Regimen = 'ecologico' | 'convencional';
type TipoPrincipal = (typeof TIPOS_PRINCIPALES)[number];

interface FilaArea {
  clave: number;
  /** Cada área tiene su tipo: una finca puede tener naves y lotes a la vez. */
  tipo: TipoPrincipal | '';
  nombre: string;
  m2: string;
}

const REGIMENES = [
  { valor: 'ecologico', texto: NOMBRE_REGIMEN['ecologico'] ?? 'Ecológico' },
  { valor: 'convencional', texto: NOMBRE_REGIMEN['convencional'] ?? 'Convencional' },
] as const;

export const TIPOS_DE_AREA = TIPOS_PRINCIPALES.map((t) => ({
  valor: t,
  texto: NOMBRE_TIPO[t] ?? t,
}));

export function Asistente(props: { db: CuadernoDb; alTerminar: () => void }) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [nombre, setNombre] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [regimen, setRegimen] = useState<Regimen | ''>('');
  const [filas, setFilas] = useState<FilaArea[]>([{ clave: 1, tipo: '', nombre: '', m2: '' }]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => abrirFormulario(), []);
  useEffect(() => titulo.current?.focus(), [paso]);

  const validarPaso1 = () => {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e['nombre'] = 'Escribe el nombre de la finca.';
    if (!municipio.trim()) e['municipio'] = 'Escribe el municipio.';
    if (!regimen) e['regimen'] = 'Elige cómo produces.';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const areasValidas = (): DatosArea[] | null => {
    const e: Record<string, string> = {};
    const areas: DatosArea[] = [];
    for (const f of filas) {
      if (!f.tipo) e[`tipo-${f.clave}`] = 'Elige si es nave, bloque o lote.';
      if (!f.nombre.trim()) e[`nombre-${f.clave}`] = 'Escribe el nombre del área.';
      const m2 = leerNumero(f.m2);
      if (!m2.ok) e[`m2-${f.clave}`] = m2.motivo;
      else if (m2.valor <= 0) e[`m2-${f.clave}`] = 'El área debe ser mayor que 0 m².';
      else if (f.tipo)
        areas.push({
          tipo: f.tipo,
          nombre: f.nombre.trim(),
          area_m2: m2.valor,
          capacidad_plantas: null,
        });
    }
    setErrores(e);
    return Object.keys(e).length === 0 ? areas : null;
  };

  const guardar = async () => {
    const areas = areasValidas();
    if (!areas || !regimen) return;
    setGuardando(true);
    try {
      await crearFincaConAreas(
        props.db,
        { nombre: nombre.trim(), municipio: municipio.trim(), regimen },
        areas,
      );
      props.alTerminar();
    } catch (error) {
      setGuardando(false);
      setErrores({
        general:
          error instanceof ErrorDeValidacion
            ? `No se guardó: ${error.campos.map((c) => c.motivo).join('; ')}.`
            : 'No se pudo guardar en el teléfono. Nada quedó a medias: inténtalo otra vez.',
      });
    }
  };

  const cambiarFila = (clave: number, campo: 'tipo' | 'nombre' | 'm2', valor: string) =>
    setFilas(filas.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));

  return (
    <section class="asistente" aria-labelledby="titulo-asistente">
      <p class="paso">Paso {paso} de 3</p>
      <h1 id="titulo-asistente" tabIndex={-1} ref={titulo}>
        {paso === 1 ? 'Tu finca' : paso === 2 ? 'Tus áreas' : 'Revisa y guarda'}
      </h1>

      {paso === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (validarPaso1()) setPaso(2);
          }}
          noValidate
        >
          <Campo
            id="nombre"
            etiqueta="Nombre de la finca"
            valor={nombre}
            error={errores['nombre']}
            alCambiar={setNombre}
          />
          <Campo
            id="municipio"
            etiqueta="Municipio"
            valor={municipio}
            error={errores['municipio']}
            alCambiar={setMunicipio}
          />
          <Opciones
            nombre="regimen"
            leyenda="¿Cómo produces?"
            opciones={REGIMENES}
            valor={regimen}
            error={errores['regimen']}
            alCambiar={setRegimen}
          />
          <div class="acciones">
            <button type="submit">Siguiente</button>
          </div>
        </form>
      )}

      {paso === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (areasValidas()) setPaso(3);
          }}
          noValidate
        >
          <p class="ayuda">
            Agrega cada nave, bloque o lote. Puedes mezclar tipos. Las camas y surcos se agregan
            después, dentro de cada área.
          </p>
          {filas.map((f, i) => (
            <fieldset class="fila-area" key={f.clave}>
              <legend>Área {i + 1}</legend>
              <CampoSeleccion
                id={`area-tipo-${f.clave}`}
                etiqueta="Tipo"
                indicacion="Elige nave, bloque o lote"
                opciones={TIPOS_DE_AREA}
                valor={f.tipo}
                error={errores[`tipo-${f.clave}`]}
                alCambiar={(v) => cambiarFila(f.clave, 'tipo', v)}
              />
              <Campo
                id={`area-nombre-${f.clave}`}
                etiqueta="Nombre"
                valor={f.nombre}
                error={errores[`nombre-${f.clave}`]}
                alCambiar={(v) => cambiarFila(f.clave, 'nombre', v)}
              />
              <Campo
                id={`area-m2-${f.clave}`}
                etiqueta="Tamaño (m²)"
                decimal
                valor={f.m2}
                error={errores[`m2-${f.clave}`]}
                alCambiar={(v) => cambiarFila(f.clave, 'm2', v)}
              />
              {filas.length > 1 && (
                <button
                  type="button"
                  class="secundario"
                  onClick={() => setFilas(filas.filter((x) => x.clave !== f.clave))}
                >
                  Quitar área {i + 1}
                </button>
              )}
            </fieldset>
          ))}
          <button
            type="button"
            class="secundario"
            onClick={() =>
              setFilas([
                ...filas,
                // El tipo de la fila anterior se propone: casi siempre se repite. Se puede cambiar.
                {
                  clave: Math.max(...filas.map((f) => f.clave)) + 1,
                  tipo: filas.at(-1)?.tipo ?? '',
                  nombre: '',
                  m2: '',
                },
              ])
            }
          >
            Agregar otra área
          </button>
          <div class="acciones">
            <button type="button" class="secundario" onClick={() => setPaso(1)}>
              Atrás
            </button>
            <button type="submit">Siguiente</button>
          </div>
        </form>
      )}

      {paso === 3 && (
        <div>
          <dl class="resumen">
            <dt>Finca</dt>
            <dd>{nombre.trim()}</dd>
            <dt>Municipio</dt>
            <dd>{municipio.trim()}</dd>
            <dt>Producción</dt>
            <dd>{regimen ? NOMBRE_REGIMEN[regimen] : ''}</dd>
          </dl>
          <ul class="lista-areas" data-prueba="resumen-areas">
            {filas.map((f) => {
              const m2 = leerNumero(f.m2);
              return (
                <li key={f.clave}>
                  {f.nombre.trim()} · {f.tipo ? NOMBRE_TIPO[f.tipo] : ''} ·{' '}
                  {m2.ok ? metros(m2.valor) : ''}
                </li>
              );
            })}
          </ul>
          {errores['general'] && (
            <p class="error" role="alert">
              {errores['general']}
            </p>
          )}
          <div class="acciones">
            <button
              type="button"
              class="secundario"
              onClick={() => setPaso(2)}
              disabled={guardando}
            >
              Atrás
            </button>
            <button type="button" onClick={() => void guardar()} disabled={guardando}>
              Guardar mi finca
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
