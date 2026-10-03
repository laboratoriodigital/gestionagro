/**
 * Costo por kilo y margen por ciclo (HU-E7.3), en «Costos»: una tabla para comparar las naves de
 * un vistazo (revisión del dueño, 3 oct 2026: «presentar mejor la información de Costos»), con el
 * total de la finca. Lo que no se conoce no suma 0: el número dice «al menos» o «aprox.» y, debajo,
 * qué falta (P1). Dice qué costos no están incluidos para que el número no engañe (CA3).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type CostoDeCiclo, costoPorCiclo } from '../almacen/costo-por-ciclo.ts';
import { TablaDeslizable } from '../componentes/TablaDeslizable.tsx';

const pesos = (n: number) => `$ ${Math.round(Math.abs(n)).toLocaleString('es-CO')}`;
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function faltan(f: CostoDeCiclo): string[] {
  return [
    f.insumosSinCosto > 0 &&
      plural(f.insumosSinCosto, 'aplicación sin costo', 'aplicaciones sin costo'),
    f.jornalesSinValor > 0 && plural(f.jornalesSinValor, 'jornal sin valor', 'jornales sin valor'),
    f.ventasSinPrecio > 0 &&
      plural(f.ventasSinPrecio, 'despacho sin precio', 'despachos sin precio'),
  ].filter((x): x is string => typeof x === 'string');
}

const nombreDe = (f: CostoDeCiclo) =>
  `${f.areas}${f.ciclo ? ` · ${f.ciclo.cultivo} ${f.ciclo.variedad}` : ' · sin ciclo'}${f.ciclo?.estado === 'cerrado' ? ' (cerrado)' : ''}`;

function PorUnidad(props: { f: CostoDeCiclo }) {
  const { f } = props;
  const r = f.resultado;
  if (r.porUnidad === null || !f.unidad) {
    return <>{f.variasUnidades ? 'varias unidades' : 'sin cosecha'}</>;
  }
  return (
    <>
      {!r.costoCompleto && <span class="detalle-insumo">al menos </span>}
      <strong>{pesos(r.porUnidad)}</strong>
      <span class="detalle-insumo"> por {f.unidad}</span>
    </>
  );
}

function Ganancia(props: { margen: number | null; completo: boolean }) {
  if (props.margen === null) return <>sin ventas</>;
  return (
    <span class={props.margen < 0 ? 'desconocida' : ''}>
      {props.margen < 0 ? '− ' : ''}
      {pesos(props.margen)}
      {!props.completo && <span class="detalle-insumo"> aprox.</span>}
    </span>
  );
}

export function CostoPorKilo(props: { fincaId: string }) {
  const [filas, setFilas] = useState<CostoDeCiclo[] | null>(null);
  useEffect(() => {
    void costoPorCiclo(cuaderno(), props.fincaId).then(setFilas);
  }, [props.fincaId]);

  const total = filas && {
    costo: filas.reduce((s, f) => s + f.resultado.costo, 0),
    ventas: filas.reduce((s, f) => s + f.ingresos, 0),
    conVentas: filas.some((f) => f.resultado.margen !== null),
    completo: filas.every((f) => f.resultado.costoCompleto && f.resultado.margenCompleto),
  };

  return (
    <div data-prueba="costo-por-kilo">
      <h2>Costo por kilo y margen</h2>
      {filas === null ? (
        <p class="ayuda">Calculando…</p>
      ) : filas.length === 0 ? (
        <p class="ayuda">Todavía no hay costos ni cosechas para calcularlo.</p>
      ) : (
        <>
          <TablaDeslizable nombre="Costo por kilo y margen">
            <table class="tabla-rendimiento" data-prueba="tabla-costo-por-kilo">
              <thead>
                <tr>
                  <th scope="col">Nave y ciclo</th>
                  <th scope="col">Cuesta</th>
                  <th scope="col">Costos</th>
                  <th scope="col">Ventas</th>
                  <th scope="col">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.clave} data-prueba="costo-ciclo">
                    <th scope="row">{nombreDe(f)}</th>
                    <td data-prueba="costo-por-unidad">
                      <PorUnidad f={f} />
                    </td>
                    <td>
                      {!f.resultado.costoCompleto && <span class="detalle-insumo">al menos </span>}
                      {pesos(f.resultado.costo)}
                    </td>
                    <td>{f.ventas > 0 ? pesos(f.ingresos) : '—'}</td>
                    <td data-prueba="margen">
                      <Ganancia margen={f.resultado.margen} completo={f.resultado.margenCompleto} />
                    </td>
                  </tr>
                ))}
              </tbody>
              {total && filas.length > 1 && (
                <tfoot>
                  <tr data-prueba="costo-total">
                    <th scope="row">Toda la finca</th>
                    <td>—</td>
                    <td>{pesos(total.costo)}</td>
                    <td>{total.conVentas ? pesos(total.ventas) : '—'}</td>
                    <td>
                      <Ganancia
                        margen={total.conVentas ? total.ventas - total.costo : null}
                        completo={total.completo}
                      />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </TablaDeslizable>
          {filas.some((f) => faltan(f).length > 0) && (
            <div class="aviso-legal" data-prueba="costo-incompleto">
              <p>Faltan datos: el costo real es mayor y la ganancia es aproximada.</p>
              <ul>
                {filas
                  .filter((f) => faltan(f).length > 0)
                  .map((f) => (
                    <li key={f.clave}>
                      {f.areas}: {faltan(f).join(', ')}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
      <p class="ayuda">
        Por kilo vendible (lo cosechado menos el descarte), con los insumos aplicados y los jornales
        anotados; las ventas son los despachos con precio. No incluye arriendo, depreciación del
        invernadero, empaques, transporte, servicios ni otros gastos que no se anotan en el
        cuaderno.
      </p>
    </div>
  );
}
