/**
 * Costo por kilo y margen por ciclo (HU-E7.3), en «Costos»: cuánto cuesta producir cada unidad
 * vendible en cada nave y cuánto queda al venderla, para fijar precios con números. Lo que no se
 * conoce no suma 0: el número dice «al menos» y cuántos datos faltan (P1). Dice qué costos no están
 * incluidos para que el número no engañe (CA3).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type CostoDeCiclo, costoPorCiclo } from '../almacen/costo-por-ciclo.ts';

const pesos = (n: number) => `$ ${Math.round(Math.abs(n)).toLocaleString('es-CO')}`;
const cantidad = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function Faltan(props: { f: CostoDeCiclo }) {
  const partes = [
    props.f.insumosSinCosto > 0 &&
      plural(props.f.insumosSinCosto, 'aplicación sin costo', 'aplicaciones sin costo'),
    props.f.jornalesSinValor > 0 &&
      plural(props.f.jornalesSinValor, 'jornal sin valor', 'jornales sin valor'),
  ].filter(Boolean);
  if (partes.length === 0) return null;
  return (
    <p class="aviso-ecologico" data-prueba="costo-incompleto">
      Faltan datos: {partes.join(' y ')}. El costo real es mayor.
    </p>
  );
}

function Fila(props: { f: CostoDeCiclo }) {
  const { f } = props;
  const r = f.resultado;
  const alMenos = r.costoCompleto ? '' : 'al menos ';
  return (
    <li class="area" data-prueba="costo-ciclo">
      <p class="area-titulo">
        <strong>{f.areas}</strong>
        {f.ciclo ? ` · ${f.ciclo.cultivo} ${f.ciclo.variedad}` : ' · sin ciclo'}
        {f.ciclo?.estado === 'cerrado' ? ' (cerrado)' : ''}
      </p>
      <p data-prueba="costo-por-unidad">
        {r.porUnidad !== null && f.unidad ? (
          <>
            Cuesta {alMenos}
            <strong>
              {pesos(r.porUnidad)} por {f.unidad}
            </strong>{' '}
            vendible ({cantidad(f.vendible)} {f.unidad})
          </>
        ) : f.variasUnidades ? (
          'Se cosechó en varias unidades: el costo no se puede repartir entre ellas.'
        ) : (
          'Todavía no hay cosecha vendible: no hay costo por unidad.'
        )}
      </p>
      <p class="detalle-insumo">
        Costos: {alMenos}
        {pesos(r.costo)} (insumos {pesos(f.insumos)} · mano de obra {pesos(f.manoDeObra)})
      </p>
      <Faltan f={f} />
      <p class="detalle-insumo" data-prueba="margen">
        {r.margen === null
          ? 'Todavía no hay ventas de este ciclo.'
          : `${r.margen >= 0 ? 'Ganancia' : 'Pérdida'}${r.margenCompleto ? '' : ' aproximada'}: ${pesos(r.margen)} (ventas ${pesos(f.ingresos)})`}
      </p>
      {f.ventasSinPrecio > 0 && (
        <p class="aviso-ecologico">
          {plural(f.ventasSinPrecio, 'despacho no tiene', 'despachos no tienen')} precio: sus ventas
          no se cuentan.
        </p>
      )}
    </li>
  );
}

export function CostoPorKilo(props: { fincaId: string }) {
  const [filas, setFilas] = useState<CostoDeCiclo[] | null>(null);
  useEffect(() => {
    void costoPorCiclo(cuaderno(), props.fincaId).then(setFilas);
  }, [props.fincaId]);

  return (
    <div data-prueba="costo-por-kilo">
      <h2>Costo por kilo y margen</h2>
      {filas === null ? (
        <p class="ayuda">Calculando…</p>
      ) : filas.length === 0 ? (
        <p class="ayuda">Todavía no hay costos ni cosechas para calcularlo.</p>
      ) : (
        <ul class="areas">
          {filas.map((f) => (
            <Fila key={f.clave} f={f} />
          ))}
        </ul>
      )}
      <p class="ayuda">
        Sale de los insumos aplicados, los jornales y las cosechas anotadas, sobre lo vendible (lo
        cosechado menos el descarte), y de los despachos con precio. No incluye arriendo,
        depreciación del invernadero, empaques, transporte, servicios ni otros gastos que no se
        anotan en el cuaderno.
      </p>
    </div>
  );
}
