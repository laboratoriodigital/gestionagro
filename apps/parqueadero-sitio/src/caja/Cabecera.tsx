/**
 * La cabecera con sus cuatro señales (plan §5.1, P15): impresora, respaldo, hora y entregas
 * pendientes. Siempre a la vista, nunca en un menú, aunque digan «sin configurar» (HU-Q3.1 CA2).
 * Con la caja vinculada a la nube, una quinta: dónde está lo registrado, y lo que la nube puso en
 * cuarentena con su motivo (HU-Q7.5 CA2).
 */
import type { Rechazo } from './datos.ts';
import { horaBogota } from './fecha.ts';
import type { Senal } from './senales.ts';

export interface PropsCabecera {
  readonly impresora: Senal;
  readonly respaldo: Senal;
  readonly hora: Senal;
  readonly pendientes: Senal;
  readonly prueba: boolean;
  /** `false`: el navegador no garantizó el almacenamiento. `null`: todavía no se sabe. */
  readonly persistente: boolean | null;
  /** Dónde está lo registrado; nula sin cuenta. */
  readonly nube?: Senal | null;
  readonly cuarentena?: readonly Rechazo[];
}

const QUE_ES: Readonly<Record<Rechazo['entidad'], string>> = {
  registro: 'Un registro',
  sede: 'Los datos del parqueadero',
  tarifa: 'Una tarifa',
  abonado: 'Un abonado',
  ajuste_recibo: 'Los ajustes del recibo',
  punto: 'Un punto de la caja',
};

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
        {p.nube && <Indicador senal={p.nube} prueba="senal-nube" />}
      </ul>
      {p.cuarentena && p.cuarentena.length > 0 && (
        <details class="cuarentena" data-prueba="cuarentena">
          <summary>
            {p.cuarentena.length === 1
              ? '1 dato en cuarentena: la nube no lo aceptó'
              : `${p.cuarentena.length} datos en cuarentena: la nube no los aceptó`}
          </summary>
          <ul>
            {p.cuarentena.map((r) => (
              <li key={r.id}>
                {QUE_ES[r.entidad]}, a las {horaBogota(r.recibido)}: {r.motivo}
              </li>
            ))}
          </ul>
          <p>Siguen en esta caja: nada se borró.</p>
        </details>
      )}
      {p.persistente === false && (
        <p class="aviso-almacenamiento" role="status" data-prueba="aviso-almacenamiento">
          Este navegador puede borrar los datos si se llena el teléfono. Haga un respaldo al
          terminar el día.
        </p>
      )}
    </header>
  );
}
