/**
 * Rendimiento por nave y por planta (HU-E6.6): una tabla por cultivo para comparar naves (CA2).
 * Lo comercial es lo cosechado menos el descarte. Sin plantas anotadas en el ciclo, «por planta»
 * dice «sin dato», nunca cero (P1).
 */
import { formatearCantidad } from '@gestionagro/agro-calc';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type GrupoDeRendimiento, rendimientoDeLaFinca } from '../almacen/rendimiento.ts';
import { RendimientoPorPersona } from './RendimientoPorPersona.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';

const fechaCorta = (f: string) => f.split('-').reverse().join('/');

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
        grupos.map((g) => (
          <div key={g.cultivo} data-prueba="rendimiento-cultivo">
            <h2>{g.cultivo}</h2>
            <table class="tabla-rendimiento">
              <thead>
                <tr>
                  <th scope="col">Nave y ciclo</th>
                  <th scope="col">Por m²</th>
                  <th scope="col">Por planta</th>
                  <th scope="col">Descarte</th>
                </tr>
              </thead>
              <tbody>
                {g.filas.map((f) => (
                  <tr key={f.clave} data-prueba="rendimiento-fila">
                    <th scope="row">
                      {f.areas}
                      <span class="detalle-insumo">
                        {f.ciclo
                          ? ` · ${f.ciclo.variedad}, desde ${fechaCorta(f.ciclo.trasplante)}${f.ciclo.estado === 'cerrado' ? ' (cerrado)' : ''}`
                          : ''}{' '}
                        · {formatearCantidad(f.resultado.comercial)} {f.unidad} en {f.cosechas}{' '}
                        {f.cosechas === 1 ? 'cosecha' : 'cosechas'}
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
                  </tr>
                ))}
              </tbody>
            </table>
            {g.filas.some((f) => f.resultado.porPlanta === null) && (
              <p class="ayuda">
                «Sin dato» por planta: el ciclo no tiene anotado cuántas plantas tiene.
              </p>
            )}
          </div>
        ))
      )}
      <RendimientoPorPersona fincaId={fincaId} />
    </section>
  );
}
