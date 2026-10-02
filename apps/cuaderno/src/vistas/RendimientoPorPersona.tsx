/**
 * Rendimiento por operario (HU-E7.4), en «Rendimiento»: lo que cosecha cada persona por hora y sus
 * horas en labores, en un periodo. Del plan Exportador (ARQUITECTURA §2.4, interruptor en
 * `content/agro/cuaderno/funciones.json`) y solo para propietario y supervisor (CA2, §9). Dice
 * cuántas cosechas no entran porque no tienen horas o quién cosechó (CA3, P1).
 */
import { formatearCantidad } from '@gestionagro/agro-calc';
import { fechaAgronomica } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { funcionActiva } from '../almacen/funciones.ts';
import { type ClavePeriodo, OPCIONES_DE_PERIODO, periodoDe } from '../almacen/periodos.ts';
import {
  type RendimientoDelEquipo,
  rendimientoDelEquipo,
} from '../almacen/rendimiento-operario.ts';
import { leerSesion, planDeLaFinca, rolEnLaFinca } from '../almacen/sesion.ts';
import { CampoSeleccion } from '../componentes/Campo.tsx';

/** Quien administra la finca (§9). Sin finca en la nube, el teléfono es de quien lo configuró. */
const ADMINISTRAN = [null, 'propietario', 'supervisor'];

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function RendimientoPorPersona(props: { fincaId: string }) {
  const [acceso, setAcceso] = useState<'cargando' | 'plan' | 'rol' | 'si'>('cargando');
  const [clave, setClave] = useState<ClavePeriodo>('mes');
  const [datos, setDatos] = useState<RendimientoDelEquipo | null>(null);

  useEffect(() => {
    const db = cuaderno();
    void (async () => {
      const sesion = await leerSesion(db);
      if (!funcionActiva('rendimiento_operario', planDeLaFinca(sesion))) setAcceso('plan');
      else if (!ADMINISTRAN.includes(rolEnLaFinca(sesion))) setAcceso('rol');
      else setAcceso('si');
    })();
  }, []);
  useEffect(() => {
    if (acceso !== 'si') return;
    const hoy = fechaAgronomica(Date.now());
    void rendimientoDelEquipo(cuaderno(), props.fincaId, periodoDe(clave, hoy)).then(setDatos);
  }, [acceso, clave, props.fincaId]);

  if (acceso === 'cargando' || acceso === 'rol') return null;
  return (
    <div data-prueba="rendimiento-por-persona">
      <h2>Por persona</h2>
      {acceso === 'plan' ? (
        <p class="ayuda" data-prueba="rendimiento-persona-plan">
          Cuánto cosecha cada persona por hora viene con el plan Exportador. Mientras tanto, anota
          las horas de quien cosecha: cuando tengas el plan, el cálculo sale de esos registros.{' '}
          <a href="/agro/app/planes/">Ver los planes</a>
        </p>
      ) : (
        <>
          <CampoSeleccion
            id="rendimiento-periodo"
            etiqueta="Periodo"
            opciones={OPCIONES_DE_PERIODO}
            valor={clave}
            alCambiar={(x) => setClave((x || 'mes') as ClavePeriodo)}
          />
          {datos === null ? (
            <p class="ayuda">Calculando…</p>
          ) : datos.personas.length === 0 ? (
            <p class="ayuda">No hay cosechas ni labores con personas en este periodo.</p>
          ) : (
            <table class="tabla-rendimiento" data-prueba="tabla-por-persona">
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Cosecha por hora</th>
                  <th scope="col">Horas en labores</th>
                </tr>
              </thead>
              <tbody>
                {datos.personas.map((p) => (
                  <tr key={p.personaId} data-prueba="fila-persona">
                    <th scope="row">{p.nombre}</th>
                    <td>
                      {p.cosecha.length === 0
                        ? '—'
                        : p.cosecha.map((c) => (
                            <span class="detalle-insumo" key={c.unidad}>
                              {c.porHora === null
                                ? `sin horas (${c.unidad})`
                                : `${formatearCantidad(c.porHora)} ${c.unidad}/h · ${formatearCantidad(c.cantidad)} ${c.unidad} en ${formatearCantidad(c.horas)} h`}
                            </span>
                          ))}
                    </td>
                    <td>{formatearCantidad(p.horasLabor)} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {datos && (datos.cosechasSinHoras > 0 || datos.cosechasSinPersona > 0) && (
            <p class="aviso-ecologico" data-prueba="cosechas-fuera">
              No entran al cálculo:{' '}
              {[
                datos.cosechasSinHoras > 0 &&
                  plural(datos.cosechasSinHoras, 'cosecha sin horas', 'cosechas sin horas'),
                datos.cosechasSinPersona > 0 &&
                  plural(
                    datos.cosechasSinPersona,
                    'cosecha sin quién cosechó',
                    'cosechas sin quién cosechó',
                  ),
              ]
                .filter(Boolean)
                .join(' y ')}
              .
            </p>
          )}
          <p class="ayuda">
            Una cosecha en equipo se reparte por partes iguales entre quienes la hicieron. Sirve
            para organizar el trabajo, no para liquidar pagos.
          </p>
        </>
      )}
    </div>
  );
}
