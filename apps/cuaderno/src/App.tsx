/**
 * Shell del cuaderno (HU-E3.1). Rutas bajo `/agro/app/`, declaradas en `rutas.ts` (P2): cada
 * pantalla se agrega allí y aquí su componente.
 */
import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { LocationProvider, Route, Router, useLocation } from 'preact-iso';
import marca from '../../../content/marca.json' with { type: 'json' };
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { AvisoDePausa } from './AvisoDePausa.tsx';
import { AvisoDeReemplazo } from './AvisoDeReemplazo.tsx';
import { Anotar } from './componentes/Anotar.tsx';
import { Icono } from './componentes/Iconos.tsx';
import { FincaActiva } from './FincaActiva.tsx';
import { IndicadorDatos } from './IndicadorDatos.tsx';
import { RUTAS_APP, rutaDe } from './rutas.ts';
import { iniciarSincronizacion } from './sincronizacion.ts';
import { Carencias } from './vistas/Carencias.tsx';
import { Costos } from './vistas/Costos.tsx';
import { Cuenta } from './vistas/Cuenta.tsx';
import { Historial } from './vistas/Historial.tsx';
import { Inicio } from './vistas/Inicio.tsx';
import { Insumos } from './vistas/Insumos.tsx';
import { Lotes } from './vistas/Lotes.tsx';
import { Mas } from './vistas/Mas.tsx';
import { NoEncontrada } from './vistas/NoEncontrada.tsx';
import { Personas } from './vistas/Personas.tsx';
import { Planes } from './vistas/Planes.tsx';
import { Registrar } from './vistas/Registrar.tsx';
import { Rendimiento } from './vistas/Rendimiento.tsx';
import { Respaldo } from './vistas/Respaldo.tsx';
import { Unirme } from './vistas/Unirme.tsx';

const PANTALLAS: Record<(typeof RUTAS_APP)[number]['segmento'], ComponentType> = {
  '': Inicio,
  registrar: Registrar,
  historial: Historial,
  carencias: Carencias,
  personas: Personas,
  insumos: Insumos,
  respaldo: Respaldo,
  cuenta: Cuenta,
  mas: Mas,
  unirme: Unirme,
  lotes: Lotes,
  rendimiento: Rendimiento,
  costos: Costos,
  planes: Planes,
};

/** Con y sin «/» final: el enlace directo llega como /agro/app/insumos/ y la navegación como /agro/app/insumos. */
const sinBarraFinal = (ruta: string) => (ruta.endsWith('/') ? ruta.slice(0, -1) : ruta);

/**
 * La barra de abajo (HU-E0.11), al alcance del pulgar: Inicio, Carencias, Anotar, Historial y Más.
 * Reemplaza la fila de once secciones que se deslizaba de lado arriba; las demás viven en «Más».
 * «Anotar» no es una sección: abre la hoja con los seis registros del día.
 */
const EN_LA_BARRA = [
  { segmento: '', titulo: 'Inicio', icono: 'inicio' },
  { segmento: 'carencias', titulo: 'Carencias', icono: 'carencias' },
  null,
  { segmento: 'historial', titulo: 'Historial', icono: 'historial' },
  { segmento: 'mas', titulo: 'Más', icono: 'mas' },
] as const;

function BarraInferior() {
  const { path } = useLocation();
  const [anotar, setAnotar] = useState(false);
  return (
    <>
      <nav class="barra-inferior" aria-label="Secciones del cuaderno">
        {EN_LA_BARRA.map((r) => {
          if (!r) {
            return (
              <button
                key="anotar"
                type="button"
                class="barra-inferior__anotar"
                aria-haspopup="dialog"
                onClick={() => setAnotar(true)}
              >
                <span class="barra-inferior__circulo">
                  <Icono nombre="anotar" />
                </span>
                Anotar
              </button>
            );
          }
          const ruta = rutaDe(r.segmento);
          return (
            <a
              key={ruta}
              href={ruta}
              aria-current={sinBarraFinal(path) === sinBarraFinal(ruta) ? 'page' : undefined}
            >
              <Icono nombre={r.icono} />
              {r.titulo}
            </a>
          );
        })}
      </nav>
      <Anotar abierta={anotar} alCerrar={() => setAnotar(false)} />
    </>
  );
}

export function App() {
  // Sube lo pendiente al abrir, al volver la señal y cada 15 min (HU-E5.2). Sin finca vinculada
  // no hace nada.
  useEffect(() => iniciarSincronizacion(), []);
  return (
    <LocationProvider scope="/agro/app/">
      <header class="cabecera">
        <div class="cabecera-fila">
          <a class="marca" href="/agro/app/">
            <svg class="marca-hoja" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d={marca.hoja.d} />
            </svg>
            {marca.nombre}
          </a>
          <FincaActiva />
          <IndicadorDatos />
        </div>
      </header>
      <AvisoActualizacion />
      <AvisoDePausa />
      <AvisoDeReemplazo />
      <main id="contenido">
        <Router>
          {RUTAS_APP.flatMap((r) => {
            const ruta = rutaDe(r.segmento);
            const rutas = r.segmento ? [ruta, sinBarraFinal(ruta)] : [ruta];
            return rutas.map((path) => (
              <Route key={path} path={path} component={PANTALLAS[r.segmento]} />
            ));
          })}
          <Route default component={NoEncontrada} />
        </Router>
      </main>
      <footer class="pie">
        {marca.nombre} · {marca.cuaderno} · versión {__VERSION_APP__} ·{' '}
        <a href="/agro/guia/">Cómo se usa</a>
      </footer>
      <BarraInferior />
    </LocationProvider>
  );
}
