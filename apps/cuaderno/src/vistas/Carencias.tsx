/**
 * «¿Qué nave puedo cosechar hoy?» (HU-E9.1): hoy, nave por nave, y los 14 días siguientes.
 * Verde se puede, rojo no (con el día y la hora en que se puede), gris no se sabe porque falta la
 * carencia o la reentrada de la etiqueta (P1). El color nunca va solo: lleva un símbolo y un texto.
 * Se enciende o apaga por plan en `content/agro/cuaderno/funciones.json`; apagada, la carencia de
 * cada área sigue en «Áreas» (HU-E3.10).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  type Color,
  calendarioDeCarencias,
  DIAS_DEL_CALENDARIO,
  type DiaDelCalendario,
  distintasDeSuNave,
  type FilaDelCalendario,
} from '../almacen/calendario.ts';
import { leerFinca } from '../almacen/finca.ts';
import { funcionActiva } from '../almacen/funciones.ts';
import { leerSesion, planDeLaFinca } from '../almacen/sesion.ts';
import { ControlesPlegables, Plegable, usarPlegables } from '../componentes/Plegables.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';

const SIMBOLO: Record<Color, string> = { verde: '✓', rojo: '✕', gris: '?' };
const ESTADO_HOY: Record<Color, string> = {
  verde: 'Se puede cosechar',
  rojo: 'No cosechar',
  gris: 'No se sabe',
};
const DIA_SEMANA = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];

/** «lu 5» desde `AAAA-MM-DD`, en el calendario y sin huso (P8). */
function cabeceraDeDia(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return `${DIA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d}`;
}

const fechaLarga = (f: string) => f.split('-').reverse().join('/');

function textoDelDia(d: DiaDelCalendario): string {
  if (d.color === 'gris') return 'no se sabe';
  if (d.entrarDesde) {
    return d.enCarencia
      ? `no cosechar; se puede entrar desde las ${d.entrarDesde}`
      : `se puede entrar y cosechar desde las ${d.entrarDesde}`;
  }
  return d.color === 'verde' ? 'se puede cosechar' : 'no cosechar';
}

export function Carencias() {
  const estado = usarFinca();
  const [filas, setFilas] = useState<FilaDelCalendario[] | null>(null);
  const [activa, setActiva] = useState<boolean | null>(null);
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;
  const visibles = filas ? distintasDeSuNave(filas) : [];
  const ocultas = (filas?.length ?? 0) - visibles.length;
  const plegables = usarPlegables(visibles.map((f) => f.area.id));
  useEffect(() => {
    if (!fincaId) return;
    const db = cuaderno();
    void (async () => {
      const plan = planDeLaFinca(await leerSesion(db));
      setActiva(funcionActiva('calendario_carencias', plan));
      const d = await leerFinca(db);
      setFilas(await calendarioDeCarencias(db, fincaId, d?.areas ?? []));
    })();
  }, [fincaId]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca />;
  if (activa === false) {
    return (
      <section aria-labelledby="titulo-carencias" data-prueba="carencias-plan">
        <h1 id="titulo-carencias">¿Qué puedo cosechar hoy?</h1>
        <p>
          El calendario de los próximos 14 días, nave por nave, viene con el plan Finca.{' '}
          <a href="/agro/app/planes/">Ver los planes</a>
        </p>
        <p class="ayuda">
          Mientras tanto, cada área muestra en <a href="/agro/app/">Áreas</a> hasta cuándo no se
          puede cosechar ni entrar.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-carencias">
      <h1 id="titulo-carencias">¿Qué puedo cosechar hoy?</h1>
      <p>
        Sale de las aplicaciones anotadas y de la carencia y la reentrada de cada producto, como
        vienen en su etiqueta.
      </p>
      {filas === null ? (
        <p class="ayuda">Calculando…</p>
      ) : filas.length === 0 ? (
        <p class="ayuda">Todavía no hay áreas en la finca.</p>
      ) : (
        <>
          <ul class="areas" data-prueba="carencias-hoy">
            {visibles.map((f) => (
              <li
                key={f.area.id}
                class={`area estado-cosecha ${f.hoy.color}`}
                data-prueba="carencia-hoy"
                data-color={f.hoy.color}
              >
                <p class="area-titulo">
                  <strong>{f.nombre}</strong>{' '}
                  <span class="sello-cosecha">
                    <span aria-hidden="true">{SIMBOLO[f.hoy.color]}</span> {ESTADO_HOY[f.hoy.color]}
                  </span>
                </p>
                {f.hoy.carencia && <p class="detalle-insumo">{f.hoy.carencia}</p>}
                {f.hoy.reentrada && <p class="detalle-insumo">{f.hoy.reentrada}</p>}
              </li>
            ))}
          </ul>

          {ocultas > 0 && (
            <p class="ayuda" data-prueba="carencias-ocultas">
              {ocultas === 1
                ? '1 cama o surco está igual que su nave: no se repite.'
                : `${ocultas} camas o surcos están igual que su nave: no se repiten.`}
            </p>
          )}

          <h2>Los próximos {DIAS_DEL_CALENDARIO} días</h2>
          {visibles.length > 1 && <ControlesPlegables p={plegables} que="áreas" id="carencias" />}
          <ul class="areas" data-prueba="carencias-calendario">
            {visibles.map((f) => (
              <li key={f.area.id} class="area" data-prueba="carencia-calendario">
                <Plegable
                  id={f.area.id}
                  p={plegables}
                  resumen={
                    <>
                      <h3 class="area-titulo">{f.nombre}</h3>
                      <span class={`sello-cosecha ${f.hoy.color}`}>
                        <span aria-hidden="true">{SIMBOLO[f.hoy.color]}</span> hoy
                      </span>
                    </>
                  }
                >
                  <ol class="dias-cosecha">
                    {f.dias.map((d) => (
                      <li
                        key={d.fecha}
                        class={`dia-cosecha ${d.color}`}
                        data-color={d.color}
                        title={`${fechaLarga(d.fecha)}: ${textoDelDia(d)}`}
                      >
                        <span class="fecha-cosecha" aria-hidden="true">
                          {cabeceraDeDia(d.fecha)}
                        </span>
                        <span aria-hidden="true">{SIMBOLO[d.color]}</span>
                        {d.entrarDesde && (
                          <span class="hora-cosecha" aria-hidden="true">
                            {d.entrarDesde}
                          </span>
                        )}
                        <span class="solo-lectores">
                          {fechaLarga(d.fecha)}: {textoDelDia(d)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Plegable>
              </li>
            ))}
          </ul>
          <p class="ayuda">
            ✓ se puede cosechar · ✕ no cosechar (con una hora: desde esa hora se puede entrar) · ?
            falta la carencia o la reentrada del producto: complétala en Insumos.
          </p>
          <p class="ayuda">
            Lo que se aplica en una nave cuenta también para sus camas y surcos. Los días son los de
            Colombia, aunque el teléfono tenga otra hora.
          </p>
        </>
      )}
    </section>
  );
}
