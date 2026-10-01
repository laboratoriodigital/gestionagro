/**
 * Registrar el día a día de la finca sin señal (S5): clima con su DPV (HU-E3.8), riego (HU-E3.7)
 * y labores (HU-E3.9).
 * Las aplicaciones se agregan aquí con su historia.
 *
 * - El DPV y su indicación salen de `agro-calc` y del mismo catálogo de rangos que la calculadora
 *   pública (CA2, P2). El cultivo sale del ciclo activo del área.
 * - Valores prellenados desde la calculadora en el fragmento `#t=…&hr=…&th=…` (CA3, HU-E2.7).
 *   El fragmento no viaja al servidor (P13).
 * - El formulario cuenta como abierto solo mientras tiene algo escrito (HU-E3.1, CA2).
 */
import {
  buscarEtapa,
  CULTIVOS_DPV,
  clasificarDpv,
  dpvAireKPa,
  ErrorDeMedida,
  formatearKPa,
  formatearPct,
  leerNumero,
} from '@gestionagro/agro-calc';
import type { Area, Ciclo, Registro } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { leerCiclos } from '../almacen/ciclos.ts';
import { type DatosClimaGuardado, guardarClima } from '../almacen/clima.ts';
import { pendientesDeSubir, ultimosRegistros } from '../almacen/consultas.ts';
import { leerFinca } from '../almacen/finca.ts';
import { leerPersonas } from '../almacen/personas.ts';
import type { DatosRiegoGuardado } from '../almacen/riego.ts';
import { Campo, CampoSeleccion } from '../componentes/Campo.tsx';
import { fechaHora } from '../formato.ts';
import { FormularioLabor } from './FormularioLabor.tsx';
import { FormularioRiego } from './FormularioRiego.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';

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
  const cultivo = CULTIVOS_DPV.find((c) => c.nombre.toLowerCase() === ciclo.cultivo.toLowerCase());
  const [unica] = cultivo?.etapas ?? [];
  return cultivo && cultivo.etapas.length === 1 && unica
    ? buscarEtapa(cultivo.id, unica.id)
    : undefined;
}

function FormularioClima(props: {
  fincaId: string;
  areas: Area[];
  ciclos: Ciclo[];
  alGuardar: () => void;
}) {
  const [v, setV] = useState<Valores>({
    areaId: props.areas.length === 1 ? (props.areas[0]?.id ?? '') : '',
    t: '',
    hr: '',
    th: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardado, setGuardado] = useState<string | null>(null);

  // CA3: valores que llegan desde la calculadora; se borran del enlace para no repetirlos.
  useEffect(() => {
    const desdeEnlace = valoresDelFragmento(window.location.hash);
    if (Object.keys(desdeEnlace).length > 0) {
      setV((actual) => ({ ...actual, ...desdeEnlace }));
      history.replaceState(null, '', window.location.pathname);
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
      await guardarClima(cuaderno(), props.fincaId, v.areaId, {
        temperaturaC: t.valor,
        humedadRelativaPct: hr.valor,
        temperaturaHojaC: th,
      });
      setV({ ...v, t: '', hr: '', th: '' });
      setGuardado('Guardado en este teléfono.');
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
      <h2>Clima</h2>
      <CampoSeleccion
        id="clima-area"
        etiqueta="Área"
        indicacion="Elige el área"
        opciones={props.areas.map((a) => ({ valor: a.id, texto: a.nombre }))}
        valor={v.areaId}
        error={errores['area']}
        alCambiar={(x) => setV({ ...v, areaId: x })}
      />
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
      <div class="acciones">
        <button type="submit">Guardar clima</button>
      </div>
    </form>
  );
}

/** Resumen de un registro en una línea, en palabras de finca. */
function resumenDe(r: Registro, nombres: ReadonlyMap<string, string>): string {
  const coma = (n: number) => String(n).replace('.', ',');
  if (r.tipo === 'clima') {
    const d = r.datos as DatosClimaGuardado;
    const hoja = d.temperaturaHojaC !== null ? ` · hoja ${coma(d.temperaturaHojaC)} °C` : '';
    return `Clima · ${coma(d.temperaturaC)} °C · ${coma(d.humedadRelativaPct)} % · DPV ${formatearKPa(d.dpvKPa)}${hoja}`;
  }
  if (r.tipo === 'riego') {
    const d = r.datos as DatosRiegoGuardado;
    const unidad = d.unidad === 'mL_gotero' ? 'mL por gotero' : 'L por área';
    const drenaje =
      d.drenajePct === null ? 'drenaje no medido' : `drenaje ${formatearPct(d.drenajePct)}`;
    const ce = d.ceEntradaDsM === null ? '' : ` · CE ${coma(d.ceEntradaDsM)} dS/m`;
    const ph = d.phEntrada === null ? '' : ` · pH ${coma(d.phEntrada)}`;
    // Los riegos v1 no tienen duración.
    const min = r.v >= 2 ? d.duracionMin : null;
    const duracion = min === null ? '' : ` · ${coma(min)} min`;
    return `Riego · ${coma(d.volumenAplicado)} ${unidad}${duracion} · ${drenaje}${ce}${ph}`;
  }
  if (r.tipo === 'labor') {
    const d = r.datos as { labor: string; horasPorPersona: number };
    const quienes = r.persona_ids.map((id) => nombres.get(id) ?? 'Persona').join(', ');
    return `Labor · ${d.labor} · ${coma(d.horasPorPersona)} h por persona · ${quienes}`;
  }
  return r.tipo;
}

function UltimosRegistros(props: {
  registros: Registro[];
  areas: Area[];
  personas: Map<string, string>;
  pendientes: Set<string>;
}) {
  if (props.registros.length === 0) return <p class="ayuda">Todavía no hay registros.</p>;
  const nombre = (id: string | undefined) => props.areas.find((a) => a.id === id)?.nombre ?? 'Área';
  return (
    <ul class="areas" data-prueba="ultimos-registros">
      {props.registros.map((r) => (
        <li class="area" key={r.id} data-prueba={`registro-${r.tipo}`}>
          <p class="area-titulo">
            <strong>{nombre(r.area_ids[0])}</strong> · {fechaHora(r.instante_evento)}
          </p>
          <p class="detalle-insumo">{resumenDe(r, props.personas)}</p>
          {props.pendientes.has(r.id) && <p class="ayuda">Solo en este teléfono</p>}
        </li>
      ))}
    </ul>
  );
}

const TIPOS = [
  { id: 'clima', titulo: 'Clima' },
  { id: 'riego', titulo: 'Riego' },
  { id: 'labor', titulo: 'Labores' },
] as const;
type TipoRegistro = (typeof TIPOS)[number]['id'];

export function Registrar() {
  const estado = usarFinca();
  const [areas, setAreas] = useState<Area[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [personas, setPersonas] = useState<Map<string, string>>(new Map());
  // Un enlace con valores de clima (#t=…) abre directo en Clima (HU-E3.8, CA3).
  const [tipo, setTipo] = useState<TipoRegistro>('clima');
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;

  const cargar = () => {
    if (!fincaId) return;
    const db = cuaderno();
    void (async () => {
      const datos = await leerFinca(db);
      setAreas((datos?.areas ?? []).filter((a) => a.padre_id === null && a.activa));
      setCiclos(await leerCiclos(db, fincaId));
      setRegistros(
        await ultimosRegistros(
          db,
          fincaId,
          TIPOS.map((t) => t.id),
        ),
      );
      setPendientes(await pendientesDeSubir(db));
      // Con las inactivas: una labor vieja sigue mostrando quién la hizo.
      const todas = await leerPersonas(db, fincaId, { incluirInactivas: true });
      setPersonas(new Map(todas.map((p) => [p.id, p.nombre])));
    })();
  };
  useEffect(cargar, [fincaId]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca />;

  return (
    <section aria-labelledby="titulo-registrar">
      <h1 id="titulo-registrar">Registrar</h1>
      <p>Se guarda en este teléfono aunque no haya señal.</p>
      <fieldset class="pestanas">
        <legend class="solo-lectores">Qué vas a registrar</legend>
        {TIPOS.map((t) => (
          <button
            type="button"
            key={t.id}
            class={tipo === t.id ? '' : 'secundario'}
            aria-pressed={tipo === t.id}
            onClick={() => setTipo(t.id)}
          >
            {t.titulo}
          </button>
        ))}
      </fieldset>
      {areas.length > 0 && tipo === 'clima' && (
        <FormularioClima fincaId={fincaId} areas={areas} ciclos={ciclos} alGuardar={cargar} />
      )}
      {areas.length > 0 && tipo === 'labor' && (
        <FormularioLabor fincaId={fincaId} areas={areas} alGuardar={cargar} />
      )}
      {areas.length > 0 && tipo === 'riego' && (
        <FormularioRiego fincaId={fincaId} areas={areas} alGuardar={cargar} />
      )}
      <h2>Últimos registros</h2>
      <UltimosRegistros
        registros={registros}
        areas={areas}
        personas={personas}
        pendientes={pendientes}
      />
    </section>
  );
}
