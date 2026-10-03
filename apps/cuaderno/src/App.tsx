/**
 * Shell del cuaderno (HU-E3.1). Rutas bajo `/agro/app/`, declaradas en `rutas.ts` (P2): cada
 * pantalla se agrega allí y aquí su componente.
 */
import type { ComponentType } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { LocationProvider, Route, Router, useLocation } from 'preact-iso';
import marca from '../../../content/marca.json' with { type: 'json' };
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { AvisoDePausa } from './AvisoDePausa.tsx';
import { AvisoDeReemplazo } from './AvisoDeReemplazo.tsx';
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
  unirme: Unirme,
  lotes: Lotes,
  rendimiento: Rendimiento,
  costos: Costos,
  planes: Planes,
};

/** Con y sin «/» final: el enlace directo llega como /agro/app/insumos/ y la navegación como /agro/app/insumos. */
const sinBarraFinal = (ruta: string) => (ruta.endsWith('/') ? ruta.slice(0, -1) : ruta);

/**
 * Las secciones en una sola fila que se desliza de lado: en un teléfono de 360 px, once enlaces en
 * tres filas se comían un tercio de la pantalla en cada vista. La sección abierta se lleva a la
 * vista al cambiar de pantalla, sin mover la página.
 */
function Navegacion() {
  const { path } = useLocation();
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const barra = nav.current;
    const actual = barra?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!barra || !actual) return;
    const centro = actual.offsetLeft - (barra.clientWidth - actual.offsetWidth) / 2;
    barra.scrollTo({ left: Math.max(0, centro) });
  }, [path]);
  return (
    <nav class="navegacion" aria-label="Secciones del cuaderno" ref={nav}>
      {RUTAS_APP.filter((r) => !('enMenu' in r) || r.enMenu).map((r) => {
        const ruta = rutaDe(r.segmento);
        return (
          <a
            key={ruta}
            href={ruta}
            aria-current={sinBarraFinal(path) === sinBarraFinal(ruta) ? 'page' : undefined}
          >
            {r.titulo}
          </a>
        );
      })}
    </nav>
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
              <path
                fill="currentColor"
                d="M20.5 3.5C11 3.5 4.5 8.6 4.5 16.6c0 1.2.1 2.2.4 3.2 1.3-6.4 5.7-10.4 11-12.4-4.6 3.1-7.8 7.3-9 13 9.2-.6 13.6-7.3 13.6-16.9z"
              />
            </svg>
            {marca.nombre}
          </a>
          <FincaActiva />
          <IndicadorDatos />
        </div>
        <Navegacion />
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
        {marca.nombre} · {marca.cuaderno} · versión {__VERSION_APP__}
      </footer>
    </LocationProvider>
  );
}
