/**
 * «Más» (HU-E0.11): todas las secciones del cuaderno, agrupadas por lo que se hace con ellas. La
 * barra de abajo lleva lo de todos los días; lo demás se encuentra aquí. Sale de `RUTAS_APP` (P2):
 * una sección nueva aparece sola en su grupo.
 *
 * Cada grupo es una tarjeta con su título en una franja de color, y cada sección lleva su ícono:
 * el dueño la vio «muy plana» y no distinguía los títulos de las acciones (24 oct 2026).
 */

import { Icono, type NombreDeIcono } from '../componentes/Iconos.tsx';
import { GRUPOS_DEL_MENU, RUTAS_APP, rutaDe } from '../rutas.ts';
import { usarHayFinca } from './usarHayFinca.ts';

/** El ícono de cada sección de «Más». */
const ICONO: Record<string, NombreDeIcono> = {
  '': 'areas',
  registrar: 'anotar',
  historial: 'historial',
  carencias: 'carencias',
  lotes: 'lotes',
  rendimiento: 'rendimiento',
  costos: 'costos',
  personas: 'personas',
  insumos: 'insumos',
  respaldo: 'respaldo',
  cuenta: 'cuenta',
};

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
          const id = `grupo-${grupo.toLowerCase().replace(/\s+/g, '-')}`;
          return (
            <section key={grupo} class="menu-mas__grupo" aria-labelledby={id}>
              <h2 id={id}>{grupo}</h2>
              <ul>
                {rutas.map((r) => (
                  <li key={r.segmento}>
                    <a href={rutaDe(r.segmento)}>
                      <Icono nombre={ICONO[r.segmento] ?? 'mas'} />
                      {r.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
    </section>
  );
}
