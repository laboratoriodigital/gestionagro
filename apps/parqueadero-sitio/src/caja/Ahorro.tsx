/**
 * Lo que ahorra el parqueadero (HU-Q8.6): por semana y por mes, los recibos por el canal que
 * llegaron y el papel que no se gastó, en pesos con el costo que la sede declaró. Sin ese costo no
 * hay pesos (P1): la pantalla lleva al campo de Ajustes.
 */
import { formatearPesos as $ } from '@ed1/dinero';
import { type AhorroConNombre, type LecturaDelAhorro, leerAhorro } from './ahorro.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { diaLocalBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly reloj: () => number;
  readonly alCosto: () => void;
  readonly alVolver: () => void;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** `6 al 12 oct`: las fechas del periodo, cortas. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function rango(desde: string, hasta: string): string {
  const d = (f: string) => `${Number(f.slice(8))} ${MESES[Number(f.slice(5, 7)) - 1]}`;
  return desde === hasta ? d(desde) : `${d(desde)} al ${d(hasta)}`;
}

function Periodo({ p }: { readonly p: AhorroConNombre }) {
  const id = `ahorro-${p.desde}-${p.hasta}`;
  const sinPapel = p.recibos > 0 ? Math.round((100 * p.sinPapel) / p.recibos) : null;
  return (
    <section class="seccion" aria-labelledby={id} data-prueba="periodo-del-ahorro">
      <h2 class="etiqueta" id={id}>
        {p.nombre} · {rango(p.desde, p.hasta)}
      </h2>
      {p.recibos === 0 ? (
        <p>Sin recibos.</p>
      ) : (
        <dl class="filas">
          <div>
            <dt>Recibos</dt>
            <dd>{p.recibos}</dd>
          </div>
          <div>
            <dt>En papel</dt>
            <dd>{p.papel}</dd>
          </div>
          <div>
            <dt>Por WhatsApp</dt>
            <dd>{p.whatsapp}</dd>
          </div>
          <div>
            <dt>En la pantalla</dt>
            <dd>{p.pantalla}</dd>
          </div>
          {p.sinEntrega > 0 && (
            <div>
              <dt>Sin entrega anotada</dt>
              <dd>{p.sinEntrega}</dd>
            </div>
          )}
          {p.anotadas.copia > 0 && (
            <div>
              <dt>Copias impresas</dt>
              <dd>{p.anotadas.copia}</dd>
            </div>
          )}
          <div>
            <dt>Papel ahorrado</dt>
            <dd data-prueba="ahorrado">
              {plural(p.sinPapel, 'recibo', 'recibos')}
              {sinPapel !== null && ` (${sinPapel} %)`}
              {p.pesos !== null && <span class="cifra"> · {$(p.pesos)}</span>}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function Ahorro({ db, reloj, alCosto, alVolver }: Props) {
  const lectura = useConsulta<LecturaDelAhorro | null>(
    () => leerAhorro(db, diaLocalBogota(reloj())),
    null,
  );
  if (!lectura) return <section class="tarjeta" aria-busy="true" />;
  return (
    <>
      <section class="tarjeta" data-prueba="ahorro">
        <h1>Lo que ahorra</h1>
        <p>
          Cada recibo cuenta una vez, por el camino que llegó. El que salió por WhatsApp o en la
          pantalla no gastó papel; uno marcado «No se envió» no cuenta como digital.
        </p>
        {lectura.costo === null ? (
          <>
            <p class="ayuda" data-prueba="sin-costo">
              Para verlo en pesos, escriba en Ajustes lo que le cuesta cada recibo en papel.
            </p>
            <button type="button" class="boton" onClick={alCosto}>
              Escribir el costo del papel
            </button>
          </>
        ) : (
          <p class="ayuda">Con {$(lectura.costo)} por recibo en papel, como dice Ajustes.</p>
        )}
      </section>
      {lectura.periodos.map((p) => (
        <Periodo key={p.nombre} p={p} />
      ))}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </>
  );
}
