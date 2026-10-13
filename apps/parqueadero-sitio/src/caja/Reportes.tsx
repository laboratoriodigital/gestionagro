/**
 * Los reportes del día (HU-Q8.5): los turnos de todas las cajas que este teléfono tiene, con su
 * diferencia y su motivo, y las anulaciones y copias de cada cajero. Con la nube son los de todas
 * las cajas del parqueadero (HU-Q7.5); sin ella, los de esta caja. Se descarga en CSV para Excel.
 *
 * Quién ve qué (HU-Q7.8): con la cuenta, el cajero ve solo los turnos de su caja; propietario y
 * administrador, todos. Sin cuenta (M0) no hay roles: la caja muestra los suyos, como su cierre.
 *
 * CA3: con un turno abierto o un registro del día en cuarentena, arriba dice que los totales son
 * parciales y por qué (P1).
 */
import { formatearPesos as $ } from '@ed1/dinero';
import { csvDelReporte, NOMBRE_DEL_MEDIO, type ReporteDelDia } from '@ed1/parqueadero-recibos';
import { MEDIOS_DE_PAGO, type MedioDePago } from '@ed1/parqueadero-schema';
import { useState } from 'preact/hooks';
import type { BaseDeLaCaja } from './datos.ts';
import { diaLocalBogota, horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import { csvDelDia, type Lectura, leerReporte } from './reportes.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly reloj: () => number;
  readonly alVolver: () => void;
}

/** «Efectivo»: el nombre del medio empieza la fila. */
const medio = (m: MedioDePago) =>
  NOMBRE_DEL_MEDIO[m].charAt(0).toUpperCase() + NOMBRE_DEL_MEDIO[m].slice(1);

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Por qué los totales todavía no son los del día cerrado (CA3). */
function porQueParcial(r: ReporteDelDia): string {
  const razones = [
    r.abiertos > 0 ? `${plural(r.abiertos, 'turno sigue abierto', 'turnos siguen abiertos')}` : '',
    r.enCuarentena > 0
      ? `${plural(r.enCuarentena, 'registro del día está', 'registros del día están')} en cuarentena en la nube`
      : '',
  ].filter(Boolean);
  return `Totales parciales: ${razones.join(' y ')}.`;
}

function descargar(nombre: string, texto: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: nombre }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Reportes({ db, reloj, alVolver }: Props) {
  const hoy = diaLocalBogota(reloj());
  const [fecha, setFecha] = useState(hoy);
  const lectura = useConsulta<Lectura | null>(() => leerReporte(db, fecha), null, [fecha]);
  if (!lectura) return <section class="tarjeta" aria-busy="true" />;
  const { reporte: r, soloEstaCaja, sinTurnos, diario } = lectura;
  const medios = MEDIOS_DE_PAGO.filter((m) => r.porMedio[m] !== undefined);
  const cajeros = Object.entries(r.porCajero);

  return (
    <>
      <section class="tarjeta" data-prueba="reportes">
        <h1>Reportes</h1>
        <div class="campo">
          <label for="reporte-fecha">Día</label>
          <input
            id="reporte-fecha"
            type="date"
            max={hoy}
            value={fecha}
            onInput={(e) => e.currentTarget.value && setFecha(e.currentTarget.value)}
          />
        </div>
        {soloEstaCaja && <p class="ayuda">Como cajero, ve los registros de esta caja.</p>}
        {sinTurnos ? (
          <>
            <p class="ayuda">Lo registrado durante este día. Se actualiza con cada cobro.</p>
            {r.enCuarentena > 0 && (
              <p class="error" role="status" data-prueba="parcial">
                Totales parciales: hay registros en cuarentena en la nube.
              </p>
            )}
            <dl class="filas" data-prueba="totales">
              <div>
                <dt>Entradas</dt>
                <dd>{diario.entradas}</dd>
              </div>
              <div>
                <dt>Salidas</dt>
                <dd>{diario.salidas}</dd>
              </div>
              {diario.mensualidades > 0 && (
                <div>
                  <dt>Mensualidades</dt>
                  <dd>{diario.mensualidades}</dd>
                </div>
              )}
              {MEDIOS_DE_PAGO.filter((m) => diario.porMedio[m] !== undefined).map((m) => (
                <div key={m}>
                  <dt>{medio(m)}</dt>
                  <dd class="cifra">{$(diario.porMedio[m] ?? 0)}</dd>
                </div>
              ))}
            </dl>
            {diario.entradas === 0 && diario.salidas === 0 && diario.mensualidades === 0 && (
              <p class="ayuda">No hay entradas ni cobros para este día.</p>
            )}
            <button
              type="button"
              class="boton"
              onClick={() => descargar(`reporte-${fecha}.csv`, csvDelDia(diario))}
            >
              Descargar para Excel
            </button>
          </>
        ) : r.turnos.length === 0 ? (
          <p data-prueba="sin-turnos">Ese día no se abrió ningún turno.</p>
        ) : (
          <>
            {!r.completo && (
              <p class="error" role="status" data-prueba="parcial">
                {porQueParcial(r)}
              </p>
            )}
            <dl class="filas" data-prueba="totales">
              <div>
                <dt>Entradas</dt>
                <dd>{r.entradas}</dd>
              </div>
              <div>
                <dt>Salidas</dt>
                <dd>{r.salidas}</dd>
              </div>
              {medios.map((m) => (
                <div key={m}>
                  <dt>{medio(m)}</dt>
                  <dd class="cifra">{$(r.porMedio[m] ?? 0)}</dd>
                </div>
              ))}
              <div>
                <dt>Diferencia de los cierres</dt>
                <dd class="cifra">{$(r.diferencia)}</dd>
              </div>
            </dl>
            <button
              type="button"
              class="boton"
              onClick={() => descargar(`reporte-${r.fecha}.csv`, csvDelReporte(r))}
            >
              Descargar para Excel
            </button>
          </>
        )}
      </section>

      {!sinTurnos &&
        r.turnos.map((t) => {
          const s = t.resumen;
          return (
            <section
              class="seccion"
              key={`${t.dispositivo}-${s.numero}`}
              data-prueba="turno-del-reporte"
              aria-label={`Caja ${t.caja ?? 'sin serie'}, turno ${s.numero}`}
            >
              <h2 class="etiqueta">
                Caja {t.caja ?? '—'} · <span class="exacto">{s.numero}</span> · {s.operador}
              </h2>
              <p>
                {t.cierre
                  ? `De ${horaBogota(s.abrio)} a ${horaBogota(t.cierre.cerro)}`
                  : `Abierto desde las ${horaBogota(s.abrio)}`}
              </p>
              <dl class="filas">
                <div>
                  <dt>Entradas y salidas</dt>
                  <dd>
                    {s.entradas} y {s.salidas}
                  </dd>
                </div>
                {s.mensualidades > 0 && (
                  <div>
                    <dt>Mensualidades</dt>
                    <dd>{s.mensualidades}</dd>
                  </div>
                )}
                {MEDIOS_DE_PAGO.filter((m) => s.porMedio[m] !== undefined).map((m) => (
                  <div key={m}>
                    <dt>{medio(m)}</dt>
                    <dd class="cifra">{$(s.porMedio[m] ?? 0)}</dd>
                  </div>
                ))}
                <div>
                  <dt>Efectivo esperado</dt>
                  <dd class="cifra">{$(s.esperado)}</dd>
                </div>
                {t.cierre && (
                  <>
                    <div>
                      <dt>Contado</dt>
                      <dd class="cifra">{$(t.cierre.contado)}</dd>
                    </div>
                    <div>
                      <dt>Diferencia</dt>
                      <dd class="cifra" data-prueba="diferencia-del-turno">
                        {$(t.cierre.diferencia)}
                        {t.cierre.motivo ? `: ${t.cierre.motivo}` : ''}
                      </dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>Anulaciones y copias</dt>
                  <dd>
                    {s.anulaciones} y {s.copias}
                  </dd>
                </div>
              </dl>
            </section>
          );
        })}

      {!sinTurnos && cajeros.length > 0 && (
        <section class="seccion" aria-labelledby="por-cajero" data-prueba="por-cajero">
          <h2 class="etiqueta" id="por-cajero">
            Por cajero
          </h2>
          <dl class="filas">
            {cajeros.map(([nombre, c]) => (
              <div key={nombre}>
                <dt>{nombre}</dt>
                <dd>
                  {plural(c.turnos, 'turno', 'turnos')},{' '}
                  {plural(c.anulaciones, 'anulación', 'anulaciones')},{' '}
                  {plural(c.copias, 'copia', 'copias')}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </>
  );
}
