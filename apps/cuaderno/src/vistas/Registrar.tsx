/**
 * Registrar el día a día de la finca sin señal (S5). Hoy: clima de una nave con su DPV (HU-E3.8).
 * Riego, labores y aplicaciones se agregan aquí con sus historias.
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
  leerNumero,
} from '@gestionagro/agro-calc';
import type { Area, Ciclo, Registro } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import { leerCiclos } from '../almacen/ciclos.ts';
import {
  type DatosClimaGuardado,
  guardarClima,
  pendientesDeSubir,
  ultimosClimas,
} from '../almacen/clima.ts';
import { leerFinca } from '../almacen/finca.ts';
import { Campo, CampoSeleccion } from '../componentes/Campo.tsx';
import { fechaHora } from '../formato.ts';
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

function UltimosClimas(props: { registros: Registro[]; areas: Area[]; pendientes: Set<string> }) {
  if (props.registros.length === 0) return <p class="ayuda">Todavía no hay registros de clima.</p>;
  const nombre = (id: string | undefined) => props.areas.find((a) => a.id === id)?.nombre ?? 'Área';
  return (
    <ul class="areas" data-prueba="ultimos-climas">
      {props.registros.map((r) => {
        const d = r.datos as DatosClimaGuardado;
        return (
          <li class="area" key={r.id} data-prueba="registro-clima">
            <p class="area-titulo">
              <strong>{nombre(r.area_ids[0])}</strong> · {fechaHora(r.instante_evento)}
            </p>
            <p class="detalle-insumo">
              {String(d.temperaturaC).replace('.', ',')} °C ·{' '}
              {String(d.humedadRelativaPct).replace('.', ',')} % · DPV {formatearKPa(d.dpvKPa)}
              {d.temperaturaHojaC !== null &&
                ` · hoja ${String(d.temperaturaHojaC).replace('.', ',')} °C`}
            </p>
            {props.pendientes.has(r.id) && <p class="ayuda">Solo en este teléfono</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function Registrar() {
  const estado = usarFinca();
  const [areas, setAreas] = useState<Area[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;

  const cargar = () => {
    if (!fincaId) return;
    const db = cuaderno();
    void (async () => {
      const datos = await leerFinca(db);
      setAreas((datos?.areas ?? []).filter((a) => a.padre_id === null && a.activa));
      setCiclos(await leerCiclos(db, fincaId));
      setRegistros(await ultimosClimas(db, fincaId));
      setPendientes(await pendientesDeSubir(db));
    })();
  };
  useEffect(cargar, [fincaId]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca />;

  return (
    <section aria-labelledby="titulo-registrar">
      <h1 id="titulo-registrar">Registrar</h1>
      <p>Se guarda en este teléfono aunque no haya señal.</p>
      {areas.length > 0 && (
        <FormularioClima fincaId={fincaId} areas={areas} ciclos={ciclos} alGuardar={cargar} />
      )}
      <h2>Últimos registros de clima</h2>
      <UltimosClimas registros={registros} areas={areas} pendientes={pendientes} />
    </section>
  );
}
