/**
 * Ciclo de cultivo de un área (HU-E3.4): ver el activo, iniciar uno y cerrarlo.
 * Cultivo y variedad se eligen del catálogo de la finca o se agregan aquí mismo (CA2).
 * Cada formulario abierto cuenta como actividad (HU-E3.1, CA2).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import {
  type Area,
  type Ciclo,
  type Cultivo,
  ErrorDeValidacion,
  fechaAgronomica,
} from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import {
  agregarCultivo,
  agregarVariedad,
  cerrarCiclo,
  diasDesdeTrasplante,
  iniciarCiclo,
} from '../almacen/ciclos.ts';
import type { CuadernoDb } from '../almacen/db.ts';
import { Campo } from '../componentes/Campo.tsx';

const OTRO = '__otro__';
const fecha = (iso: string) => iso.split('-').reverse().join('/');
const mensaje = (error: unknown) =>
  error instanceof ErrorDeValidacion
    ? `No se guardó: ${error.campos.map((c) => c.motivo).join('; ')}.`
    : 'No se pudo guardar en el teléfono. Inténtalo otra vez.';

function CampoFecha(props: {
  id: string;
  etiqueta: string;
  valor: string;
  maximo: string;
  error?: string | undefined;
  alCambiar: (v: string) => void;
}) {
  return (
    <div class="campo">
      <label for={props.id}>{props.etiqueta}</label>
      <input
        id={props.id}
        type="date"
        max={props.maximo}
        value={props.valor}
        aria-invalid={props.error ? 'true' : 'false'}
        aria-describedby={props.error ? `${props.id}-error` : undefined}
        onInput={(e) => props.alCambiar((e.currentTarget as HTMLInputElement).value)}
      />
      {props.error && (
        <p id={`${props.id}-error`} class="error">
          {props.error}
        </p>
      )}
    </div>
  );
}

function FormularioCiclo(props: {
  db: CuadernoDb;
  area: Area;
  cultivos: Cultivo[];
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const hoy = fechaAgronomica(Date.now());
  const [cultivoId, setCultivoId] = useState('');
  const [cultivoNuevo, setCultivoNuevo] = useState('');
  const [variedad, setVariedad] = useState('');
  const [variedadNueva, setVariedadNueva] = useState('');
  const [trasplante, setTrasplante] = useState('');
  const [plantas, setPlantas] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const cultivo = props.cultivos.find((c) => c.id === cultivoId);
  const variedades = cultivo?.variedades ?? [];

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    const nombreCultivo = cultivoId === OTRO ? cultivoNuevo.trim() : (cultivo?.nombre ?? '');
    const nombreVariedad =
      variedad === OTRO || cultivoId === OTRO ? variedadNueva.trim() : variedad;
    if (!nombreCultivo) err['cultivo'] = 'Elige o escribe el cultivo.';
    if (!nombreVariedad) err['variedad'] = 'Elige o escribe la variedad.';
    if (!trasplante) err['trasplante'] = 'Escribe la fecha de trasplante.';
    else if (trasplante > hoy)
      err['trasplante'] = 'La fecha de trasplante no puede ser después de hoy.';
    let numeroPlantas: number | null = null;
    if (plantas.trim()) {
      const leido = leerNumero(plantas);
      if (!leido.ok || !Number.isInteger(leido.valor) || leido.valor < 1) {
        err['plantas'] = 'Escribe un número entero de plantas, o déjalo vacío si no lo sabes.';
      } else numeroPlantas = leido.valor;
    }
    setErrores(err);
    if (Object.keys(err).length > 0) return;
    try {
      // Lo nuevo entra primero al catálogo: queda disponible aunque el ciclo no se guarde.
      const enCatalogo = await agregarCultivo(props.db, props.area.finca_id, nombreCultivo);
      await agregarVariedad(props.db, enCatalogo.id, nombreVariedad);
      await iniciarCiclo(props.db, {
        fincaId: props.area.finca_id,
        areaId: props.area.id,
        cultivo: nombreCultivo,
        variedad: nombreVariedad,
        fechaTrasplante: trasplante,
        plantas: numeroPlantas,
      });
      props.alTerminar();
    } catch (error) {
      setErrores({ general: mensaje(error) });
    }
  };

  return (
    <form class="formulario-area" onSubmit={(e) => void guardar(e)} noValidate>
      <h3>Nuevo ciclo en {props.area.nombre}</h3>
      <div class="campo">
        <label for="ciclo-cultivo">Cultivo</label>
        <select
          id="ciclo-cultivo"
          value={cultivoId}
          aria-invalid={errores['cultivo'] ? 'true' : 'false'}
          onChange={(e) => {
            setCultivoId((e.currentTarget as HTMLSelectElement).value);
            setVariedad('');
          }}
        >
          <option value="">Elige el cultivo</option>
          {props.cultivos.map((c) => (
            <option value={c.id} key={c.id}>
              {c.nombre}
            </option>
          ))}
          <option value={OTRO}>Otro cultivo…</option>
        </select>
        {errores['cultivo'] && <p class="error">{errores['cultivo']}</p>}
      </div>
      {cultivoId === OTRO && (
        <Campo
          id="ciclo-cultivo-nuevo"
          etiqueta="Nombre del cultivo"
          valor={cultivoNuevo}
          alCambiar={setCultivoNuevo}
        />
      )}
      {cultivoId && cultivoId !== OTRO && (
        <div class="campo">
          <label for="ciclo-variedad">Variedad</label>
          <select
            id="ciclo-variedad"
            value={variedad}
            aria-invalid={errores['variedad'] ? 'true' : 'false'}
            onChange={(e) => setVariedad((e.currentTarget as HTMLSelectElement).value)}
          >
            <option value="">Elige la variedad</option>
            {variedades.map((v) => (
              <option value={v} key={v}>
                {v}
              </option>
            ))}
            <option value={OTRO}>Otra variedad…</option>
          </select>
          {errores['variedad'] && <p class="error">{errores['variedad']}</p>}
        </div>
      )}
      {(cultivoId === OTRO || variedad === OTRO) && (
        <Campo
          id="ciclo-variedad-nueva"
          etiqueta="Nombre de la variedad"
          valor={variedadNueva}
          error={cultivoId === OTRO ? errores['variedad'] : undefined}
          alCambiar={setVariedadNueva}
        />
      )}
      <CampoFecha
        id="ciclo-trasplante"
        etiqueta="Fecha de trasplante"
        valor={trasplante}
        maximo={hoy}
        error={errores['trasplante']}
        alCambiar={setTrasplante}
      />
      <Campo
        id="ciclo-plantas"
        etiqueta="Número de plantas (opcional)"
        decimal
        valor={plantas}
        error={errores['plantas']}
        alCambiar={setPlantas}
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
        <button type="submit">Iniciar ciclo</button>
      </div>
    </form>
  );
}

function FormularioCierre(props: {
  db: CuadernoDb;
  ciclo: Ciclo;
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const hoy = fechaAgronomica(Date.now());
  const [fin, setFin] = useState('');
  const [confirmado, setConfirmado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!fin) err['fin'] = 'Escribe la fecha de fin.';
    else if (fin > hoy) err['fin'] = 'La fecha de fin no puede ser después de hoy.';
    else if (fin < props.ciclo.fecha_trasplante)
      err['fin'] = 'La fecha de fin no puede ser antes del trasplante.';
    if (!confirmado) err['confirmado'] = 'Confirma que el ciclo terminó.';
    setErrores(err);
    if (Object.keys(err).length > 0) return;
    try {
      await cerrarCiclo(props.db, props.ciclo.id, fin, true);
      props.alTerminar();
    } catch (error) {
      setErrores({ general: mensaje(error) });
    }
  };

  return (
    <form class="formulario-area" onSubmit={(e) => void guardar(e)} noValidate>
      <h3>
        Cerrar el ciclo de {props.ciclo.cultivo} · {props.ciclo.variedad}
      </h3>
      <CampoFecha
        id="ciclo-fin"
        etiqueta="Fecha de fin"
        valor={fin}
        maximo={hoy}
        error={errores['fin']}
        alCambiar={setFin}
      />
      <div class="campo">
        <label class="opcion">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado((e.currentTarget as HTMLInputElement).checked)}
          />
          Entiendo que después no se podrán agregar registros a este ciclo sin confirmarlo.
        </label>
        {errores['confirmado'] && <p class="error">{errores['confirmado']}</p>}
      </div>
      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      <div class="acciones">
        <button type="button" class="secundario" onClick={props.alCancelar}>
          Cancelar
        </button>
        <button type="submit">Cerrar ciclo</button>
      </div>
    </form>
  );
}

export function CicloDeArea(props: {
  db: CuadernoDb;
  area: Area;
  ciclo: Ciclo | undefined;
  cultivos: Cultivo[];
  alCambiar: () => void;
}) {
  const [abierto, setAbierto] = useState<'iniciar' | 'cerrar' | null>(null);
  const terminar = () => {
    setAbierto(null);
    props.alCambiar();
  };
  const c = props.ciclo;

  return (
    <div class="ciclo" data-prueba="ciclo">
      {c ? (
        <p>
          <strong>
            {c.cultivo} · {c.variedad}
          </strong>{' '}
          · trasplante {fecha(c.fecha_trasplante)} ·{' '}
          <span data-prueba="dias">día {diasDesdeTrasplante(c)}</span>
          {c.plantas !== null && ` · ${c.plantas.toLocaleString('es-CO')} plantas`}
        </p>
      ) : (
        <p class="ayuda">Sin ciclo activo.</p>
      )}
      <div class="acciones-area">
        {c ? (
          <button
            type="button"
            class="secundario"
            onClick={() => setAbierto(abierto === 'cerrar' ? null : 'cerrar')}
            aria-label={`Cerrar ciclo de ${props.area.nombre}`}
          >
            Cerrar ciclo
          </button>
        ) : (
          <button
            type="button"
            class="secundario"
            onClick={() => setAbierto(abierto === 'iniciar' ? null : 'iniciar')}
            aria-label={`Iniciar ciclo en ${props.area.nombre}`}
          >
            Iniciar ciclo
          </button>
        )}
      </div>
      {abierto === 'iniciar' && !c && (
        <FormularioCiclo
          db={props.db}
          area={props.area}
          cultivos={props.cultivos}
          alTerminar={terminar}
          alCancelar={() => setAbierto(null)}
        />
      )}
      {abierto === 'cerrar' && c && (
        <FormularioCierre
          db={props.db}
          ciclo={c}
          alTerminar={terminar}
          alCancelar={() => setAbierto(null)}
        />
      )}
    </div>
  );
}
