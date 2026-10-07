/**
 * La cabecera con sus cuatro señales (plan §5.1, P15): impresora, respaldo, hora y entregas
 * pendientes. Siempre a la vista, nunca en un menú, aunque digan «sin configurar» (HU-Q3.1 CA2).
 */
import type { Senal } from './senales.ts';

export interface PropsCabecera {
  readonly impresora: Senal;
  readonly respaldo: Senal;
  readonly hora: Senal;
  readonly pendientes: Senal;
  readonly prueba: boolean;
  /** `false`: el navegador no garantizó el almacenamiento. `null`: todavía no se sabe. */
  readonly persistente: boolean | null;
}

function Indicador({ senal, prueba }: { senal: Senal; prueba: string }) {
  return (
    <li class={`senal senal-${senal.tono}`} data-prueba={prueba}>
      {senal.texto}
    </li>
  );
}

export function Cabecera(p: PropsCabecera) {
  return (
    <header class="cabecera">
      <div class="cabecera-titulo">
        <span>Caja</span>
        {p.prueba && (
          <span class="marca-prueba" data-prueba="marca-prueba">
            PRUEBA: los recibos no valen
          </span>
        )}
      </div>
      <ul class="senales">
        <Indicador senal={p.impresora} prueba="senal-impresora" />
        <Indicador senal={p.respaldo} prueba="senal-respaldo" />
        <Indicador senal={p.hora} prueba="senal-hora" />
        <Indicador senal={p.pendientes} prueba="senal-pendientes" />
      </ul>
      {p.persistente === false && (
        <p class="aviso-almacenamiento" role="status" data-prueba="aviso-almacenamiento">
          Este navegador puede borrar la caja si se llena el teléfono. Haga el respaldo al cerrar el
          turno.
        </p>
      )}
    </header>
  );
}
