/**
 * Formulario de aplicaciones (HU-E3.10). Áreas, insumo, dosis según etiqueta y quién aplicó.
 * Mezcla y equipo van plegados.
 *
 * - La dosis es la de la etiqueta: número y unidad como los escribe la etiqueta. La app no sugiere
 *   ninguna (CA2, instrucciones §7).
 * - Al elegir el insumo se ven su carencia y su reentrada; desconocidas, en rojo (CA4).
 * - En una finca ecológica aparece el mismo aviso de Insumos; no bloquea (CA5, HU-E3.6).
 * - Al guardar se ve, por área, hasta cuándo no se cosecha y desde cuándo se puede entrar (CA1).
 * - «Cuándo se aplicó» (HU-E10.2): vacío es ahora. Una aplicación de la mañana anotada en la noche
 *   o al otro día cuenta su carencia desde que se aplicó. Llega lleno desde la calculadora.
 */
import { leerNumero } from '@ed1/agro-calc';
import {
  type Area,
  ErrorDeRegistro,
  ErrorDeValidacion,
  type Finca,
  type Insumo,
  instanteEnColombia,
  type Persona,
  type Registro,
} from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import {
  cantidadSugerida,
  type DatosAplicacionGuardada,
  type EstadoDeArea,
  estadosPorArea,
  guardarAplicacion,
} from '../almacen/aplicaciones.ts';
import { avisoEcologico, leerInsumos, plazo } from '../almacen/insumos.ts';
import { leerPersonas } from '../almacen/personas.ts';
import { Campo, CampoSeleccion } from '../componentes/Campo.tsx';
import { usarCamas } from '../componentes/CampoCama.tsx';
import { AccionesDeFormulario, aTexto, EventoQueSeCorrige } from '../componentes/Correccion.tsx';
import { Vencimientos } from '../componentes/Vencimientos.tsx';

/**
 * La fecha y la hora que trae la calculadora de carencias en el fragmento (HU-E10.2):
 * `#aplicacion=1&fecha=AAAA-MM-DD&hora=HH:MM`. Solo si son una fecha y una hora reales (P1).
 */
export function aplicacionDelFragmento(hash: string): { fecha: string; hora: string } | null {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  if (!p.has('aplicacion')) return null;
  const fecha = p.get('fecha') ?? '';
  const hora = p.get('hora') ?? '';
  return instanteEnColombia(fecha, hora) === null ? null : { fecha, hora };
}

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
  /** Cantidad de producto gastada, en la unidad del insumo (HU-E7.1). */
  cantidad: string;
  /** Cuándo se aplicó, en hora de Colombia; vacío = ahora (HU-E10.2). */
  fecha: string;
  hora: string;
}

type Errores = Partial<Record<keyof Valores | 'cuando' | 'general', string>>;

const CAMPO_DE_ERROR: Record<string, keyof Valores> = {
  area_ids: 'areas',
  persona_ids: 'personas',
  insumo_id: 'insumoId',
  'datos.dosis': 'dosis',
  'datos.dosisUnidad': 'dosisUnidad',
  'datos.volumenMezclaL': 'mezcla',
  'datos.cantidadUsada': 'cantidad',
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
  /** Fecha y hora que trae la calculadora de carencias (HU-E10.2). */
  cuandoInicial?: { fecha: string; hora: string } | undefined;
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
    cantidad: '',
    fecha: '',
    hora: '',
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
          cantidad: aTexto(antes.cantidadUsada ?? null),
          fecha: '',
          hora: '',
        }
      : { ...vacio(), ...props.cuandoInicial };
  const [v, setV] = useState<Valores>(inicial);
  // Plan Finca: aplicar solo en algunas camas o surcos (revisión del dueño, 3 oct 2026).
  const camas = usarCamas();
  /** Una cama marcada aplica solo ahí: la nave entera se desmarca, y al revés. */
  const alternarCama = (naveId: string, camaId: string) =>
    setV({
      ...v,
      areas: v.areas.includes(camaId)
        ? v.areas.filter((x) => x !== camaId)
        : [...v.areas.filter((x) => x !== naveId), camaId],
    });
  const alternarNave = (naveId: string) => {
    const deLaNave = new Set(camas.camasDe(naveId).map((c) => c.id));
    setV({
      ...v,
      areas: v.areas.includes(naveId)
        ? v.areas.filter((x) => x !== naveId)
        : [...v.areas.filter((x) => !deLaNave.has(x)), naveId],
    });
  };
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

  const tieneAlgo = Boolean(
    v.insumoId || v.dosis || v.dosisUnidad || v.mezcla || v.equipo || v.cantidad,
  );
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  const insumo = insumos?.find((i) => i.id === v.insumoId);
  const aviso = insumo ? avisoEcologico(props.finca, insumo) : null;
  const dosisLeida = leerNumero(v.dosis);
  const mezclaLeida = leerNumero(v.mezcla);
  const sugerida =
    insumo && dosisLeida.ok && mezclaLeida.ok
      ? cantidadSugerida(dosisLeida.valor, v.dosisUnidad, mezclaLeida.valor, insumo.unidad)
      : null;
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
    let cuando: Date | undefined;
    if (!props.corrige && (v.fecha || v.hora)) {
      const ms = instanteEnColombia(v.fecha, v.hora);
      if (ms === null)
        err.cuando = 'Escribe la fecha y la hora, o deja las dos vacías si fue ahora.';
      else cuando = new Date(ms);
    }
    let cantidad: number | null = null;
    if (v.cantidad.trim()) {
      const c = leerNumero(v.cantidad);
      if (!c.ok) err.cantidad = c.motivo;
      else if (c.valor <= 0) err.cantidad = 'Debe ser mayor que 0, o déjalo vacío.';
      else cantidad = c.valor;
    }
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
          cantidadUsada: cantidad,
        },
        { corrige: props.corrige, cuando },
      );
      const estados = await estadosPorArea(db, props.finca.id);
      // Las naves y las camas aplicadas; una cama se nombra con su nave.
      const elegibles = [
        ...props.areas,
        ...props.areas.flatMap((a) =>
          camas.camasDe(a.id).map((c) => ({ ...c, nombre: `${a.nombre} · ${c.nombre}` })),
        ),
      ];
      setGuardadas(
        elegibles
          .filter((a) => v.areas.includes(a.id))
          .map((a) => ({ area: a, estado: estados.get(a.id) })),
      );
      setV(vacio());
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeValidacion || error instanceof ErrorDeRegistro) {
        const nuevos: Errores = {};
        for (const c of error.campos) {
          const campo = c.campo === 'cuando' ? 'cuando' : CAMPO_DE_ERROR[c.campo];
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
                onChange={() => (camas.porCama ? alternarNave(a.id) : alternar('areas', a.id))}
              />
              {a.nombre}
            </label>
          ))}
          {camas.porCama &&
            props.areas
              .filter((a) => camas.camasDe(a.id).length > 0)
              .map((a) => (
                <details
                  key={`camas-${a.id}`}
                  class="camas-aplicacion"
                  open={camas.camasDe(a.id).some((c) => v.areas.includes(c.id))}
                >
                  <summary>Solo algunas camas de {a.nombre}</summary>
                  {camas.camasDe(a.id).map((c) => (
                    <label class="opcion" key={c.id}>
                      <input
                        type="checkbox"
                        checked={v.areas.includes(c.id)}
                        onChange={() => alternarCama(a.id, c.id)}
                      />
                      {a.nombre} · {c.nombre}
                    </label>
                  ))}
                </details>
              ))}
          {errores.areas && (
            <p id="aplicacion-areas-error" class="error">
              {errores.areas}
            </p>
          )}
        </fieldset>
      )}
      {!props.corrige && (
        <fieldset
          class="opciones"
          data-prueba="aplicacion-cuando"
          aria-describedby={errores.cuando ? 'aplicacion-cuando-error' : undefined}
        >
          <legend>Cuándo se aplicó</legend>
          <p class="ayuda">Déjalo vacío si la aplicaste ahora.</p>
          <div class="campo">
            <label for="aplicacion-fecha">Fecha</label>
            <input
              id="aplicacion-fecha"
              type="date"
              value={v.fecha}
              onInput={(e) => setV({ ...v, fecha: (e.currentTarget as HTMLInputElement).value })}
            />
          </div>
          <div class="campo">
            <label for="aplicacion-hora">Hora</label>
            <input
              id="aplicacion-hora"
              type="time"
              value={v.hora}
              onInput={(e) => setV({ ...v, hora: (e.currentTarget as HTMLInputElement).value })}
            />
          </div>
          {errores.cuando && (
            <p id="aplicacion-cuando-error" class="error">
              {errores.cuando}
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
      <details class="avanzado" open={Boolean(errores.mezcla || errores.cantidad)}>
        <summary>Mezcla, equipo y cantidad usada (opcional)</summary>
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
        <Campo
          id="aplicacion-cantidad"
          etiqueta={`Producto gastado en total${insumo ? ` (${insumo.unidad})` : ''}`}
          ayuda="Para descontarla de la bodega. Si se aplicó en varias áreas, el total: se reparte por sus metros."
          decimal
          valor={v.cantidad}
          error={errores.cantidad}
          alCambiar={(x) => setV({ ...v, cantidad: x })}
        />
        {sugerida !== null && insumo && v.cantidad.trim() === '' && (
          <p class="ayuda" data-prueba="cantidad-sugerida">
            Según la dosis y la mezcla: {aTexto(sugerida)} {insumo.unidad}.{' '}
            <button
              type="button"
              class="secundario"
              onClick={() => setV({ ...v, cantidad: aTexto(sugerida) })}
            >
              Usar {aTexto(sugerida)} {insumo.unidad}
            </button>
          </p>
        )}
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
