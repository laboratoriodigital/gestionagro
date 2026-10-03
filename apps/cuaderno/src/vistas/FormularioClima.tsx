/**
 * Formulario de clima de una nave con su DPV (HU-E3.8).
 *
 * - El DPV y su indicación salen de `agro-calc` y del mismo catálogo de rangos que la calculadora
 *   pública (CA2, P2). El cultivo sale del ciclo activo del área.
 * - Valores prellenados desde la calculadora en el fragmento `#t=…&hr=…&th=…` (CA3, HU-E2.7).
 *   El fragmento no viaja al servidor (P13).
 * - El formulario cuenta como abierto solo mientras tiene algo escrito (HU-E3.1, CA2).
 */
import {
  buscarEtapa,
  clasificarDpv,
  cultivoDpvDe,
  dpvAireKPa,
  ErrorDeMedida,
  formatearKPa,
  leerNumero,
} from '@gestionagro/agro-calc';
import type { Area, Ciclo, Registro } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { type DatosClimaGuardado, guardarClima } from '../almacen/clima.ts';
import { Campo, CampoSeleccion } from '../componentes/Campo.tsx';
import { AccionesDeFormulario, aTexto, EventoQueSeCorrige } from '../componentes/Correccion.tsx';
import { tomarLecturaPendiente } from '../lectura-pendiente.ts';

interface Valores {
  areaId: string;
  t: string;
  hr: string;
  th: string;
}

/** Lee t, hr y th del fragmento del enlace (CA3). Nada más. */
export function valoresDelFragmento(hash: string): Partial<Valores> {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const v: Partial<Valores> = {};
  for (const [clave, campo] of [
    ['t', 't'],
    ['hr', 'hr'],
    ['th', 'th'],
  ] as const) {
    const x = p.get(clave);
    if (x !== null) v[campo] = x.slice(0, 12);
  }
  return v;
}

/** Etapa del catálogo de rangos para el cultivo del ciclo, si el cultivo tiene una sola etapa. */
function etapaDelCiclo(ciclo: Ciclo | undefined) {
  if (!ciclo) return undefined;
  const cultivo = cultivoDpvDe(ciclo.cultivo);
  const [unica] = cultivo?.etapas ?? [];
  return cultivo && cultivo.etapas.length === 1 && unica
    ? buscarEtapa(cultivo.id, unica.id)
    : undefined;
}

export function FormularioClima(props: {
  fincaId: string;
  areas: Area[];
  ciclos: Ciclo[];
  alGuardar: () => void;
  /** Registro de clima vigente que se corrige (HU-E3.12). */
  corrige?: Registro | undefined;
  alCancelar?: () => void;
}) {
  const antes = props.corrige?.datos as DatosClimaGuardado | undefined;
  const [v, setV] = useState<Valores>({
    areaId:
      props.corrige?.area_ids[0] ?? (props.areas.length === 1 ? (props.areas[0]?.id ?? '') : ''),
    t: aTexto(antes?.temperaturaC),
    hr: aTexto(antes?.humedadRelativaPct),
    th: aTexto(antes?.temperaturaHojaC),
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<string | null>(null);
  const [desdeCalculadora, setDesdeCalculadora] = useState(false);

  // CA3: valores que llegan desde la calculadora; se borran del enlace para no repetirlos.
  useEffect(() => {
    if (props.corrige) return;
    const desdeEnlace = valoresDelFragmento(window.location.hash);
    if (Object.keys(desdeEnlace).length > 0) {
      setV((actual) => ({ ...actual, ...desdeEnlace }));
      setDesdeCalculadora(true);
      history.replaceState(null, '', window.location.pathname);
      return;
    }
    // Llegó de la calculadora antes de que existiera la finca (HU-E2.7).
    const pendiente = tomarLecturaPendiente();
    if (pendiente && Object.keys(pendiente).length > 0) {
      setV((actual) => ({ ...actual, ...pendiente }));
      setDesdeCalculadora(true);
    }
  }, []);

  const tieneAlgo = Boolean(v.t || v.hr || v.th);
  useEffect(() => (tieneAlgo ? abrirFormulario() : undefined), [tieneAlgo]);

  const t = leerNumero(v.t);
  const hr = leerNumero(v.hr);
  let vistaPrevia: { texto: string; indicacion: string | null } | null = null;
  if (t.ok && hr.ok) {
    try {
      const dpv = dpvAireKPa(t.valor, hr.valor);
      const ciclo = props.ciclos.find(
        (c) => c.estado === 'activo' && c.area_ids.includes(v.areaId),
      );
      const etapa = etapaDelCiclo(ciclo);
      const ind = etapa ? clasificarDpv(dpv, etapa) : null;
      vistaPrevia = {
        texto: formatearKPa(dpv),
        indicacion: ind ? `${ind.titulo}. ${ind.accion}` : null,
      };
    } catch {
      vistaPrevia = null; // fuera de rango: el error se muestra al guardar, junto al campo
    }
  }

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!v.areaId) err['area'] = 'Elige el área donde mediste.';
    if (!t.ok) err['t'] = v.t ? t.motivo : 'Escribe la temperatura.';
    if (!hr.ok) err['hr'] = v.hr ? hr.motivo : 'Escribe la humedad.';
    let th: number | null = null;
    if (v.th.trim()) {
      const leida = leerNumero(v.th);
      if (!leida.ok) err['th'] = leida.motivo;
      else th = leida.valor;
    }
    setErrores(err);
    setGuardado(null);
    if (Object.keys(err).length > 0 || !t.ok || !hr.ok) return;
    try {
      await guardarClima(
        cuaderno(),
        props.fincaId,
        v.areaId,
        {
          temperaturaC: t.valor,
          humedadRelativaPct: hr.valor,
          temperaturaHojaC: th,
        },
        { corrige: props.corrige },
      );
      setV({ ...v, t: '', hr: '', th: '' });
      setGuardado('Guardado en este teléfono.');
      setDesdeCalculadora(false);
      props.alGuardar();
    } catch (error) {
      if (error instanceof ErrorDeMedida) {
        const campo =
          { temperaturaC: 't', humedadRelativaPct: 'hr', temperaturaHojaC: 'th' }[error.campo] ??
          't';
        setErrores({ [campo]: error.message.replace(/^«[^»]+»\s*/, 'Valor ') });
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
      data-prueba="formulario-clima"
    >
      <h2>{props.corrige ? 'Corregir clima' : 'Clima'}</h2>
      {desdeCalculadora && (
        <p class="estado" data-prueba="lectura-de-calculadora">
          Lectura traída de la calculadora. Revisa los valores, elige el área y guarda.
        </p>
      )}
      {props.corrige ? (
        <EventoQueSeCorrige registro={props.corrige} areas={props.areas} />
      ) : (
        <CampoSeleccion
          id="clima-area"
          etiqueta="Área"
          indicacion="Elige el área"
          opciones={props.areas.map((a) => ({ valor: a.id, texto: a.nombre }))}
          valor={v.areaId}
          error={errores['area']}
          alCambiar={(x) => setV({ ...v, areaId: x })}
        />
      )}
      <Campo
        id="clima-t"
        etiqueta="Temperatura del aire (°C)"
        decimal
        valor={v.t}
        error={errores['t']}
        alCambiar={(x) => setV({ ...v, t: x })}
      />
      <Campo
        id="clima-hr"
        etiqueta="Humedad relativa (%)"
        decimal
        valor={v.hr}
        error={errores['hr']}
        alCambiar={(x) => setV({ ...v, hr: x })}
      />
      <Campo
        id="clima-th"
        etiqueta="Temperatura de la hoja (°C, opcional)"
        decimal
        valor={v.th}
        error={errores['th']}
        alCambiar={(x) => setV({ ...v, th: x })}
      />
      <p class="estado" aria-live="polite" data-prueba="clima-dpv">
        {vistaPrevia ? (
          <>
            DPV: <strong>{vistaPrevia.texto}</strong>
            {vistaPrevia.indicacion && (
              <span data-prueba="clima-indicacion"> · {vistaPrevia.indicacion}</span>
            )}
          </>
        ) : (
          'Escribe temperatura y humedad para ver el DPV.'
        )}
      </p>
      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      {guardado && (
        <p class="exito" role="status">
          {guardado}
        </p>
      )}
      <AccionesDeFormulario
        corrigiendo={Boolean(props.corrige)}
        texto="Guardar clima"
        alCancelar={props.alCancelar}
      />
    </form>
  );
}
