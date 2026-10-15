/**
 * Inicio (HU-T8.1): a qué tienda entró la sesión, con su estado y su plan. El tablero de TIENDA
 * §12.2 llega con M2; hasta entonces, la pantalla dice qué hay y qué falta, sin cifras inventadas.
 */
import { Aviso, Tarjeta } from '@ed1/ui/v2/componentes';
import type { Yo } from '../api.ts';
import { NOMBRE_DEL_ROL } from './ElegirTienda.tsx';

const ESTADO_DE_LA_TIENDA: Readonly<Record<string, string>> = {
  borrador: 'Sin publicar',
  abierta: 'Abierta',
  cerrada: 'Cerrada por ahora',
  suspendida: 'Suspendida',
  baja: 'Dada de baja',
};

export function Inicio({ yo }: { yo: Yo }) {
  const productos = yo.funciones?.['productos'];
  return (
    <main class="contenido">
      <h1>{yo.tienda?.nombre ?? 'Tu tienda'}</h1>
      {yo.tienda?.estado === 'borrador' ? (
        <Aviso tono="info" titulo="Tu tienda todavía no está publicada">
          Los compradores la verán cuando la publiques.
        </Aviso>
      ) : null}
      <Tarjeta titulo="Tu tienda">
        <dl class="datos">
          <div>
            <dt>Estado</dt>
            <dd>
              {ESTADO_DE_LA_TIENDA[yo.tienda?.estado ?? ''] ?? yo.tienda?.estado ?? 'Sin dato'}
            </dd>
          </div>
          <div>
            <dt>Tu rol</dt>
            <dd>{NOMBRE_DEL_ROL[yo.rol] ?? yo.rol}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd>{yo.plan ?? 'Sin dato'}</dd>
          </div>
          <div>
            <dt>Productos en tu plan</dt>
            <dd class="cifra">
              {productos === undefined || yo.funciones === null
                ? 'No pudimos leer tu plan'
                : productos === null
                  ? 'Sin límite'
                  : String(productos)}
            </dd>
          </div>
        </dl>
      </Tarjeta>
      <p class="nota">
        Los pedidos, los productos y el tablero de ventas llegan a este panel en las próximas
        versiones.
      </p>
    </main>
  );
}
