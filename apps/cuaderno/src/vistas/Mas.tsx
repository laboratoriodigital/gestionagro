/**
 * «Más» (HU-E0.11): todas las secciones del cuaderno, agrupadas por lo que se hace con ellas. La
 * barra de abajo lleva lo de todos los días; lo demás se encuentra aquí. Sale de `RUTAS_APP` (P2):
 * una sección nueva aparece sola en su grupo.
 */

import { GRUPOS_DEL_MENU, RUTAS_APP, rutaDe } from '../rutas.ts';
import { usarHayFinca } from './usarHayFinca.ts';

export function Mas() {
  const hayFinca = usarHayFinca();
  const visibles = RUTAS_APP.filter(
    (r) => (!('enMenu' in r) || r.enMenu) && (hayFinca || !('requiereFinca' in r)),
  );
  return (
    <section aria-labelledby="titulo-mas">
      <h1 id="titulo-mas">Más</h1>
      <nav aria-label="Todas las secciones" class="menu-mas">
        {GRUPOS_DEL_MENU.map((grupo) => {
          const rutas = visibles.filter((r) => 'grupo' in r && r.grupo === grupo);
          if (rutas.length === 0) return null;
          return (
            <div key={grupo} class="menu-mas__grupo">
              <h2>{grupo}</h2>
              <ul>
                {rutas.map((r) => (
                  <li key={r.segmento}>
                    <a href={rutaDe(r.segmento)}>{r.titulo}</a>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </section>
  );
}
