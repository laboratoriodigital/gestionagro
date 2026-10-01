/**
 * Shell del cuaderno (HU-E3.1). Rutas bajo `/agro/app/`, declaradas en `rutas.ts` (P2): cada
 * pantalla se agrega allí y aquí su componente.
 */
import type { ComponentType } from 'preact';
import { LocationProvider, Route, Router, useLocation } from 'preact-iso';
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { IndicadorDatos } from './IndicadorDatos.tsx';
import { RUTAS_APP, rutaDe } from './rutas.ts';
import { Cuenta } from './vistas/Cuenta.tsx';
import { Historial } from './vistas/Historial.tsx';
import { Inicio } from './vistas/Inicio.tsx';
import { Insumos } from './vistas/Insumos.tsx';
import { NoEncontrada } from './vistas/NoEncontrada.tsx';
import { Personas } from './vistas/Personas.tsx';
import { Registrar } from './vistas/Registrar.tsx';
import { Respaldo } from './vistas/Respaldo.tsx';

const PANTALLAS: Record<(typeof RUTAS_APP)[number]['segmento'], ComponentType> = {
  '': Inicio,
  registrar: Registrar,
  historial: Historial,
  personas: Personas,
  insumos: Insumos,
  respaldo: Respaldo,
  cuenta: Cuenta,
};

/** Con y sin «/» final: el enlace directo llega como /agro/app/insumos/ y la navegación como /agro/app/insumos. */
const sinBarraFinal = (ruta: string) => (ruta.endsWith('/') ? ruta.slice(0, -1) : ruta);

function Navegacion() {
  const { path } = useLocation();
  return (
    <nav class="navegacion" aria-label="Secciones del cuaderno">
      {RUTAS_APP.map((r) => {
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
  return (
    <LocationProvider scope="/agro/app/">
      <header class="cabecera">
        <a class="marca" href="/agro/app/">
          Cuaderno de campo
        </a>
        <Navegacion />
        <IndicadorDatos />
      </header>
      <AvisoActualizacion />
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
      <footer class="pie">Versión {__VERSION_APP__}</footer>
    </LocationProvider>
  );
}
