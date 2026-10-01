/**
 * Shell del cuaderno (HU-E3.1). Rutas bajo `/agro/app/`. Cada vista nueva (finca, registros…)
 * se agrega aquí con su historia.
 */
import { LocationProvider, Route, Router } from 'preact-iso';
import { AvisoActualizacion } from './AvisoActualizacion.tsx';
import { Inicio } from './vistas/Inicio.tsx';
import { NoEncontrada } from './vistas/NoEncontrada.tsx';

export function App() {
  return (
    <LocationProvider scope="/agro/app/">
      <header class="cabecera">
        <a class="marca" href="/agro/app/">
          Cuaderno de campo
        </a>
      </header>
      <AvisoActualizacion />
      <main id="contenido">
        <Router>
          <Route path="/agro/app/" component={Inicio} />
          <Route default component={NoEncontrada} />
        </Router>
      </main>
      <footer class="pie">Versión {__VERSION_APP__}</footer>
    </LocationProvider>
  );
}
