/**
 * Registrar el día a día de la finca sin señal (S5): clima con su DPV (HU-E3.8), riego (HU-E3.7),
 * labores (HU-E3.9), aplicaciones con su carencia (HU-E3.10), cosecha (HU-E6.1) y monitoreo
 * (HU-E3.11). Cada formulario vive en su archivo.
 */
import type { Area, Ciclo, Registro } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { leerCiclos } from '../almacen/ciclos.ts';
import { pendientesDeSubir, ultimosRegistros } from '../almacen/consultas.ts';
import { leerFinca } from '../almacen/finca.ts';
import { leerPersonas } from '../almacen/personas.ts';
import { resumenDe } from '../componentes/resumen.ts';
import { fechaHora } from '../formato.ts';
import { guardarLecturaPendiente } from '../lectura-pendiente.ts';
import { FormularioAplicacion } from './FormularioAplicacion.tsx';
import { FormularioClima, valoresDelFragmento } from './FormularioClima.tsx';
import { FormularioCosecha } from './FormularioCosecha.tsx';
import { FormularioLabor } from './FormularioLabor.tsx';
import { FormularioMonitoreo } from './FormularioMonitoreo.tsx';
import { FormularioRiego } from './FormularioRiego.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';
import { SoloConsulta, usarPermisos } from './usarPermisos.tsx';

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
  { id: 'aplicacion', titulo: 'Aplicaciones' },
  { id: 'cosecha', titulo: 'Cosecha' },
  { id: 'monitoreo', titulo: 'Monitoreo' },
] as const;
type TipoRegistro = (typeof TIPOS)[number]['id'];

export function Registrar() {
  const estado = usarFinca();
  const permisos = usarPermisos();
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

  // Sin finca, una lectura que llega de la calculadora se guarda para después (HU-E2.7).
  const sinFinca = !estado.cargando && !fincaId;
  const [lecturaGuardada, setLecturaGuardada] = useState(false);
  useEffect(() => {
    if (!sinFinca) return;
    const lectura = valoresDelFragmento(window.location.hash);
    if (Object.keys(lectura).length === 0) return;
    guardarLecturaPendiente(lectura);
    history.replaceState(null, '', window.location.pathname);
    setLecturaGuardada(true);
  }, [sinFinca]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca lecturaGuardada={lecturaGuardada} />;

  return (
    <section aria-labelledby="titulo-registrar">
      <h1 id="titulo-registrar">Registrar</h1>
      {permisos.rol !== undefined && !permisos.puede('escribir', 'registro') ? (
        <SoloConsulta rol={permisos.rol} que="lo que registra el equipo" />
      ) : (
        <>
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
          {areas.length > 0 && tipo === 'aplicacion' && estado.finca && (
            <FormularioAplicacion finca={estado.finca} areas={areas} alGuardar={cargar} />
          )}
          {areas.length > 0 && tipo === 'cosecha' && (
            <FormularioCosecha fincaId={fincaId} areas={areas} alGuardar={cargar} />
          )}
          {areas.length > 0 && tipo === 'labor' && (
            <FormularioLabor fincaId={fincaId} areas={areas} alGuardar={cargar} />
          )}
          {areas.length > 0 && tipo === 'monitoreo' && (
            <FormularioMonitoreo fincaId={fincaId} areas={areas} alGuardar={cargar} />
          )}
          {areas.length > 0 && tipo === 'riego' && (
            <FormularioRiego fincaId={fincaId} areas={areas} alGuardar={cargar} />
          )}
        </>
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
