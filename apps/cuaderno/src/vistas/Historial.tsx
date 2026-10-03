/**
 * Historial por área, tipo y fechas, y corregir sin borrar (HU-E3.12).
 *
 * - Filtra en el teléfono con el índice de fecha agronómica y muestra de a 50: 90 días cargan
 *   rápido en un teléfono barato (CA1).
 * - «Corregir» abre el formulario del tipo con lo guardado; al guardar queda un registro nuevo que
 *   anula al anterior. Tocar «Versiones anteriores» muestra cada versión con cuándo se anotó, en
 *   qué teléfono y cuándo se corrigió (CA2).
 * - No hay botón de borrar: nadie borra un registro (CA3, ADR-4).
 */
import {
  type Area,
  type Ciclo,
  type Finca,
  fechaAgronomica,
  instanteDeUuidv7,
  type Registro,
} from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { leerCiclos } from '../almacen/ciclos.ts';
import { type EntradaDeHistorial, historial, pendientesDeSubir } from '../almacen/consultas.ts';
import { idDispositivo } from '../almacen/dispositivo.ts';
import { leerFinca } from '../almacen/finca.ts';
import { leerPersonas } from '../almacen/personas.ts';
import { CampoSeleccion } from '../componentes/Campo.tsx';
import { Paginador, usarPaginacion } from '../componentes/Paginador.tsx';
import { resumenDe } from '../componentes/resumen.ts';
import { fechaHora } from '../formato.ts';
import { FormularioAplicacion } from './FormularioAplicacion.tsx';
import { FormularioClima } from './FormularioClima.tsx';
import { FormularioCosecha } from './FormularioCosecha.tsx';
import { FormularioLabor } from './FormularioLabor.tsx';
import { FormularioMonitoreo } from './FormularioMonitoreo.tsx';
import { FormularioRiego } from './FormularioRiego.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';

const TIPOS = [
  { valor: 'clima', texto: 'Clima' },
  { valor: 'riego', texto: 'Riego' },
  { valor: 'labor', texto: 'Labores' },
  { valor: 'aplicacion', texto: 'Aplicaciones' },
  { valor: 'cosecha', texto: 'Cosecha' },
  { valor: 'monitoreo', texto: 'Monitoreo' },
  { valor: 'lote_venta', texto: 'Lotes de venta' },
  { valor: 'despacho', texto: 'Despachos' },
] as const;

const POR_PAGINA = 50;
const DIAS_POR_DEFECTO = 30;

/** `AAAA-MM-DD` menos n días, en el calendario y sin husos (P8). */
export function restarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a ?? 0, (m ?? 1) - 1, (d ?? 1) - dias)).toISOString().slice(0, 10);
}

/** Cuándo se escribió un registro: lo guarda su id (UUIDv7). */
const escrito = (r: Registro) => fechaHora(new Date(instanteDeUuidv7(r.id)).toISOString());

function Versiones(props: {
  entrada: EntradaDeHistorial;
  nombres: ReadonlyMap<string, string>;
  dispositivo: string;
}) {
  const cadena = [props.entrada.registro, ...props.entrada.anteriores];
  return (
    <ol class="historial" data-prueba="versiones-anteriores">
      {props.entrada.anteriores.map((anterior, i) => {
        const reemplazo = cadena[i];
        return (
          <li key={anterior.id} data-prueba="version-anulada">
            <p class="detalle-insumo">
              <s>{resumenDe(anterior, props.nombres)}</s>
            </p>
            <p class="ayuda">
              Anotado el {escrito(anterior)}{' '}
              {anterior.dispositivo_id === props.dispositivo
                ? 'en este teléfono'
                : 'en otro teléfono'}
              {reemplazo && ` · corregido el ${escrito(reemplazo)}`}
              {reemplazo &&
                (reemplazo.dispositivo_id === props.dispositivo
                  ? ' en este teléfono'
                  : ' en otro teléfono')}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Corregir(props: {
  registro: Registro;
  finca: Finca;
  areas: Area[];
  ciclos: Ciclo[];
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const comunes = {
    areas: props.areas,
    corrige: props.registro,
    alGuardar: props.alTerminar,
    alCancelar: props.alCancelar,
  };
  switch (props.registro.tipo) {
    case 'clima':
      return <FormularioClima fincaId={props.finca.id} ciclos={props.ciclos} {...comunes} />;
    case 'riego':
      return <FormularioRiego fincaId={props.finca.id} {...comunes} />;
    case 'labor':
      return <FormularioLabor fincaId={props.finca.id} {...comunes} />;
    case 'aplicacion':
      return <FormularioAplicacion finca={props.finca} {...comunes} />;
    case 'cosecha':
      return <FormularioCosecha fincaId={props.finca.id} {...comunes} />;
    case 'monitoreo':
      return <FormularioMonitoreo fincaId={props.finca.id} {...comunes} />;
    case 'lote_venta':
      return (
        <p class="ayuda">
          Las cosechas de un lote se cambian en <a href="/agro/app/lotes/">Lotes</a>.
        </p>
      );
    default:
      return <p class="ayuda">Este tipo de registro todavía no se puede corregir.</p>;
  }
}

export function Historial() {
  const estado = usarFinca();
  const finca = !estado.cargando ? estado.finca : null;
  const hoy = fechaAgronomica(Date.now());
  const [filtro, setFiltro] = useState({
    areaId: '',
    tipo: '',
    desde: restarDias(hoy, DIAS_POR_DEFECTO - 1),
    hasta: hoy,
  });
  const [areas, setAreas] = useState<Area[]>([]);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [dispositivo, setDispositivo] = useState('');
  const [entradas, setEntradas] = useState<EntradaDeHistorial[] | null>(null);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!finca) return;
    const db = cuaderno();
    void (async () => {
      const datos = await leerFinca(db);
      setAreas((datos?.areas ?? []).filter((a) => a.padre_id === null));
      setCiclos(await leerCiclos(db, finca.id));
      const todas = await leerPersonas(db, finca.id, { incluirInactivas: true });
      setNombres(new Map(todas.map((p) => [p.id, p.nombre])));
      setDispositivo(await idDispositivo(db));
    })();
  }, [finca?.id]);

  const fechasValidas = filtro.desde <= filtro.hasta;
  const consultar = () => {
    if (!finca || !fechasValidas) return;
    const db = cuaderno();
    void (async () => {
      setEntradas(
        await historial(db, finca.id, {
          desde: filtro.desde,
          hasta: filtro.hasta,
          areaId: filtro.areaId || undefined,
          tipo: filtro.tipo || undefined,
        }),
      );
      setPendientes(await pendientesDeSubir(db));
    })();
  };
  useEffect(consultar, [finca?.id, filtro]);
  const paginas = usarPaginacion(entradas?.length ?? 0, POR_PAGINA);
  // Otro filtro, otra lista: se vuelve a la primera página. Corregir un registro no la cambia.
  useEffect(() => paginas.reiniciar(), [filtro]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!finca) return <SinFinca />;

  const nombreArea = (id: string | undefined) => areas.find((a) => a.id === id)?.nombre ?? 'Área';
  const alternar = (id: string) => {
    const nuevas = new Set(abiertas);
    if (nuevas.has(id)) nuevas.delete(id);
    else nuevas.add(id);
    setAbiertas(nuevas);
  };

  return (
    <section aria-labelledby="titulo-historial">
      <h1 id="titulo-historial">Historial</h1>
      <p>Lo registrado por área y por día. Corregir no borra: la versión anterior queda aquí.</p>
      <div class="filtros" data-prueba="filtros-historial">
        <CampoSeleccion
          id="historial-area"
          etiqueta="Área"
          indicacion="Todas las áreas"
          opciones={areas.map((a) => ({ valor: a.id, texto: a.nombre }))}
          valor={filtro.areaId}
          alCambiar={(x) => setFiltro({ ...filtro, areaId: x })}
        />
        <CampoSeleccion
          id="historial-tipo"
          etiqueta="Tipo"
          indicacion="Todos los tipos"
          opciones={TIPOS}
          valor={filtro.tipo as (typeof TIPOS)[number]['valor'] | ''}
          alCambiar={(x) => setFiltro({ ...filtro, tipo: x })}
        />
        <div class="campo">
          <label for="historial-desde">Desde</label>
          <input
            id="historial-desde"
            type="date"
            value={filtro.desde}
            max={hoy}
            onInput={(e) => {
              const valor = (e.currentTarget as HTMLInputElement).value;
              if (valor) setFiltro({ ...filtro, desde: valor });
            }}
          />
        </div>
        <div class="campo">
          <label for="historial-hasta">Hasta</label>
          <input
            id="historial-hasta"
            type="date"
            value={filtro.hasta}
            aria-describedby={fechasValidas ? undefined : 'historial-fechas-error'}
            onInput={(e) => {
              const valor = (e.currentTarget as HTMLInputElement).value;
              if (valor) setFiltro({ ...filtro, hasta: valor });
            }}
          />
          {!fechasValidas && (
            <p id="historial-fechas-error" class="error">
              «Desde» va antes de «Hasta».
            </p>
          )}
        </div>
      </div>
      {aviso && (
        <p class="exito" role="status">
          {aviso}
        </p>
      )}
      {entradas === null ? (
        <p>Buscando…</p>
      ) : entradas.length === 0 ? (
        <p class="ayuda" data-prueba="historial-vacio">
          No hay registros con estos filtros.
        </p>
      ) : (
        <>
          <p class="ayuda" aria-live="polite" data-prueba="historial-cuenta">
            {entradas.length === 1 ? '1 registro' : `${entradas.length} registros`}
          </p>
          <ul class="areas" data-prueba="historial">
            {entradas.slice(paginas.desde, paginas.hasta).map((e) => {
              const r = e.registro;
              return (
                <li key={r.id} class="area" data-prueba={`historial-${r.tipo}`}>
                  <p class="area-titulo">
                    <strong>{nombreArea(r.area_ids[0])}</strong> · {fechaHora(r.instante_evento)}
                    {e.anteriores.length > 0 && <span class="etiqueta"> · Corregido</span>}
                  </p>
                  <p class="detalle-insumo">{resumenDe(r, nombres)}</p>
                  {pendientes.has(r.id) && <p class="ayuda">Solo en este teléfono</p>}
                  {corrigiendo === r.id ? (
                    <Corregir
                      registro={r}
                      finca={finca}
                      areas={areas}
                      ciclos={ciclos}
                      alCancelar={() => setCorrigiendo(null)}
                      alTerminar={() => {
                        setCorrigiendo(null);
                        setAviso(
                          'Corrección guardada en este teléfono. La versión anterior quedó en el historial.',
                        );
                        consultar();
                      }}
                    />
                  ) : (
                    <div class="acciones">
                      <button
                        type="button"
                        class="secundario"
                        onClick={() => {
                          setAviso(null);
                          setCorrigiendo(r.id);
                        }}
                      >
                        Corregir
                      </button>
                      {e.anteriores.length > 0 && (
                        <button
                          type="button"
                          class="secundario"
                          aria-expanded={abiertas.has(r.id)}
                          onClick={() => alternar(r.id)}
                        >
                          Versiones anteriores ({e.anteriores.length})
                        </button>
                      )}
                    </div>
                  )}
                  {abiertas.has(r.id) && (
                    <Versiones entrada={e} nombres={nombres} dispositivo={dispositivo} />
                  )}
                </li>
              );
            })}
          </ul>
          <Paginador id="historial" total={entradas.length} p={paginas} que="registros" />
        </>
      )}
    </section>
  );
}
