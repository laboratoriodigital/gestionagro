/**
 * Rendimiento por nave y por planta (HU-E6.6), en una sola tabla con filtros (revisión del dueño,
 * 3 oct 2026): por cultivo, por área y por estado del ciclo, y ordenada por lo que se quiera
 * comparar. Lo comercial es lo cosechado menos el descarte. Sin plantas anotadas en el ciclo,
 * «por planta» dice «sin dato», nunca cero (P1).
 */
import { formatearCantidad } from '@ed1/agro-calc';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  type FilaDeRendimiento,
  type GrupoDeRendimiento,
  rendimientoDeLaFinca,
} from '../almacen/rendimiento.ts';
import { TablaDeslizable } from '../componentes/TablaDeslizable.tsx';
import { RendimientoPorPersona } from './RendimientoPorPersona.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';

const fechaCorta = (f: string) => f.split('-').reverse().join('/');

export type EstadoDeCiclo = 'todos' | 'activo' | 'cerrado' | 'sin-ciclo';
export type OrdenDeRendimiento = 'm2' | 'planta' | 'descarte' | 'vendible';
type Fila = FilaDeRendimiento & { cultivo: string };

const ORDENES: { valor: OrdenDeRendimiento; texto: string }[] = [
  { valor: 'm2', texto: 'Más rinde por m²' },
  { valor: 'planta', texto: 'Más rinde por planta' },
  { valor: 'descarte', texto: 'Más descarte' },
  { valor: 'vendible', texto: 'Más vendible en total' },
];

/** Los filtros y el orden, sin interfaz: una sola regla para la pantalla. */
export function filtrarRendimiento(
  grupos: readonly GrupoDeRendimiento[],
  f: { cultivo: string; area: string; estado: EstadoDeCiclo; orden: OrdenDeRendimiento },
): Fila[] {
  const texto = f.area.trim().toLocaleLowerCase('es');
  const valor = (x: Fila): number =>
    f.orden === 'm2'
      ? x.resultado.porM2
      : f.orden === 'planta'
        ? (x.resultado.porPlanta ?? Number.NEGATIVE_INFINITY)
        : f.orden === 'descarte'
          ? (x.resultado.descartePct ?? Number.NEGATIVE_INFINITY)
          : x.resultado.comercial;
  return grupos
    .flatMap((g) => g.filas.map((x) => ({ ...x, cultivo: g.cultivo })))
    .filter((x) => !f.cultivo || x.cultivo === f.cultivo)
    .filter((x) => !texto || x.areas.toLocaleLowerCase('es').includes(texto))
    .filter((x) =>
      f.estado === 'todos'
        ? true
        : f.estado === 'sin-ciclo'
          ? x.ciclo === null
          : x.ciclo?.estado === f.estado,
    )
    .sort((a, b) => valor(b) - valor(a));
}

export function Rendimiento() {
  const estado = usarFinca();
  const [grupos, setGrupos] = useState<GrupoDeRendimiento[] | null>(null);
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;
  useEffect(() => {
    if (fincaId) void rendimientoDeLaFinca(cuaderno(), fincaId).then(setGrupos);
  }, [fincaId]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca />;

  return (
    <section aria-labelledby="titulo-rendimiento">
      <h1 id="titulo-rendimiento">Rendimiento</h1>
      <p>
        Cuánto rinde cada nave por metro cuadrado y por planta, con lo que se vende: lo cosechado
        menos el descarte. Sale de las cosechas anotadas.
      </p>
      {grupos === null ? (
        <p class="ayuda">Calculando…</p>
      ) : grupos.length === 0 ? (
        <p class="ayuda">Todavía no hay cosechas anotadas.</p>
      ) : (
        <TablaDeRendimiento grupos={grupos} />
      )}
      <RendimientoPorPersona fincaId={fincaId} />
    </section>
  );
}

function TablaDeRendimiento(props: { grupos: GrupoDeRendimiento[] }) {
  const [cultivo, setCultivo] = useState('');
  const [area, setArea] = useState('');
  const [estado, setEstado] = useState<EstadoDeCiclo>('todos');
  const [orden, setOrden] = useState<OrdenDeRendimiento>('m2');
  const filas = filtrarRendimiento(props.grupos, { cultivo, area, estado, orden });
  return (
    <div data-prueba="rendimiento-tabla">
      <div class="filtros">
        <div class="campo">
          <label for="rendimiento-cultivo">Cultivo</label>
          <select
            id="rendimiento-cultivo"
            value={cultivo}
            onChange={(e) => setCultivo((e.currentTarget as HTMLSelectElement).value)}
          >
            <option value="">Todos</option>
            {props.grupos.map((g) => (
              <option key={g.cultivo} value={g.cultivo}>
                {g.cultivo}
              </option>
            ))}
          </select>
        </div>
        <div class="campo">
          <label for="rendimiento-area">Área</label>
          <input
            id="rendimiento-area"
            type="search"
            placeholder="Nave 2"
            value={area}
            onInput={(e) => setArea((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="campo">
          <label for="rendimiento-estado">Ciclo</label>
          <select
            id="rendimiento-estado"
            value={estado}
            onChange={(e) =>
              setEstado((e.currentTarget as HTMLSelectElement).value as EstadoDeCiclo)
            }
          >
            <option value="todos">Todos</option>
            <option value="activo">Activos</option>
            <option value="cerrado">Cerrados</option>
            <option value="sin-ciclo">Sin ciclo</option>
          </select>
        </div>
        <div class="campo">
          <label for="rendimiento-orden">Ordenar por</label>
          <select
            id="rendimiento-orden"
            value={orden}
            onChange={(e) =>
              setOrden((e.currentTarget as HTMLSelectElement).value as OrdenDeRendimiento)
            }
          >
            {ORDENES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p class="ayuda" aria-live="polite" data-prueba="rendimiento-cuenta">
        {filas.length === 1 ? '1 fila' : `${filas.length} filas`}
      </p>
      {filas.length === 0 ? (
        <p class="ayuda">Nada con estos filtros.</p>
      ) : (
        <TablaDeslizable nombre="Tabla de rendimiento por nave">
          <table class="tabla-rendimiento">
            <thead>
              <tr>
                <th scope="col">Nave y ciclo</th>
                <th scope="col">Por m²</th>
                <th scope="col">Por planta</th>
                <th scope="col">Descarte</th>
                <th scope="col">Vendible</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} data-prueba="rendimiento-fila">
                  <th scope="row">
                    {f.areas}
                    <span class="detalle-insumo">
                      {f.cultivo}
                      {f.ciclo
                        ? ` ${f.ciclo.variedad}, desde ${fechaCorta(f.ciclo.trasplante)}${f.ciclo.estado === 'cerrado' ? ' (cerrado)' : ''}`
                        : ''}{' '}
                      · {f.cosechas} {f.cosechas === 1 ? 'cosecha' : 'cosechas'}
                    </span>
                  </th>
                  <td>
                    {formatearCantidad(f.resultado.porM2)} {f.unidad}/m²
                  </td>
                  <td>
                    {f.resultado.porPlanta === null
                      ? 'sin dato'
                      : `${formatearCantidad(f.resultado.porPlanta, 3)} ${f.unidad}`}
                  </td>
                  <td>
                    {f.resultado.descartePct === null
                      ? '—'
                      : `${formatearCantidad(f.resultado.descartePct, 1)} %`}
                  </td>
                  <td>
                    {formatearCantidad(f.resultado.comercial)} {f.unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeslizable>
      )}
      {filas.some((f) => f.resultado.porPlanta === null) && (
        <p class="ayuda">«Sin dato» por planta: el ciclo no tiene anotado cuántas plantas tiene.</p>
      )}
    </div>
  );
}
