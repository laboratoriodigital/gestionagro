/**
 * La hoja del recibo en la caja (HU-Q6.6): la misma de `/r/` (`src/r/mostrar.ts`), con las clases
 * de `src/hoja-recibo.css`. El h1 dice la clase y el número: «Recibo de entrada A-000123».
 */
import type { VistaDeRecibo } from '@ed1/parqueadero-recibos';

export function HojaRecibo({ vista, prueba }: { vista: VistaDeRecibo; prueba: string }) {
  const grupo = (filas: VistaDeRecibo['grupos'][number], i: number) => (
    <dl class="hoja-grupo" key={i}>
      {filas.map(([etiqueta, valor]) => (
        <div key={etiqueta}>
          <dt>{etiqueta}</dt>
          <dd>{valor}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <article class="hoja-recibo" data-prueba={prueba}>
      {vista.prueba && <p class="hoja-prueba">PRUEBA: NO VALE</p>}
      <header class="hoja-sede">
        <p class="hoja-sede-nombre">{vista.sede.nombre}</p>
        {vista.sede.datos.map((d) => (
          <p key={d} class="hoja-sede-dato">
            {d}
          </p>
        ))}
      </header>
      <h1 class="hoja-titulo">
        <span class="hoja-clase">{vista.clase}</span>{' '}
        <span class="hoja-numero">{vista.numero}</span>
      </h1>
      <p class="hoja-placa">
        <span class="hoja-placa-numero">{vista.placa}</span> <span>{vista.vehiculo}</span>
      </p>
      {vista.grupos.map(grupo)}
      {vista.total && (
        <p class="hoja-total" data-prueba="total-del-recibo">
          <span class="hoja-total-etiqueta">Total</span>{' '}
          <span class="hoja-total-valor">{vista.total.valor}</span>{' '}
          <span class="hoja-pago">{vista.total.pago}</span>
        </p>
      )}
      {vista.cierre.map((g, i) => grupo(g, vista.grupos.length + i))}
      <footer class="hoja-legal">
        {vista.legal.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </footer>
    </article>
  );
}
