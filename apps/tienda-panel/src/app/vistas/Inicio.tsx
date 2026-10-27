/**
 * Inicio (HU-T8.1 y HU-T14.2): a qué tienda entró la sesión y el tablero de TIENDA §12.2. Primero
 * lo que hay que hacer, en palabras y lo urgente arriba; después cómo voy hoy y este mes frente al
 * mes anterior a la misma altura, y el margen de la contraentrega. Las cifras vienen de la API: si
 * no llegan, se dice, sin inventar ceros.
 */
import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso, Tarjeta } from '@ed1/ui/v2/componentes';
import { useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel, type Yo } from '../api.ts';
import { enPesos } from '../catalogo.ts';
import { enLista } from '../cobro.ts';
import {
  type Cifras,
  comparacion,
  cuadreEnPalabras,
  enPorcentaje,
  margen,
  mesAnteriorEnPalabras,
  pendientesEnOrden,
  type Tablero,
} from '../tablero.ts';
import { fechaLegible } from '../terminos.ts';
import { NOMBRE_DEL_ROL } from './ElegirTienda.tsx';

const ESTADO_DE_LA_TIENDA: Readonly<Record<string, string>> = {
  borrador: 'Sin publicar',
  abierta: 'Abierta',
  cerrada: 'Cerrada por ahora',
  suspendida: 'Suspendida',
  baja: 'Dada de baja',
};

const pedidos = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`);

function Periodo({ titulo, c }: { titulo: string; c: Cifras }) {
  return (
    <Tarjeta titulo={titulo}>
      <p class="total cifra">{enPesos(c.ventasCop)}</p>
      <dl class="datos">
        <div>
          <dt>Pedidos</dt>
          <dd class="cifra">
            {c.vendidos} de {c.pedidos}
          </dd>
        </div>
        <div>
          <dt>Ticket</dt>
          <dd class="cifra">{c.ticketCop === null ? 'Sin ventas' : enPesos(c.ticketCop)}</dd>
        </div>
        <div>
          <dt>Cierre</dt>
          <dd class="cifra">{enPorcentaje(c.tasaDeCierre)}</dd>
        </div>
      </dl>
    </Tarjeta>
  );
}

function ElTablero({ t }: { t: Tablero }) {
  const pendientes = pendientesEnOrden(t.pendientes);
  const anterior = mesAnteriorEnPalabras(t.periodos);
  const ventas = comparacion(t.mes.ventasCop, t.anterior.ventasCop);
  const ce = t.contraentrega;
  const porcentaje = margen(ce);
  return (
    <>
      <h2>Lo que hay que hacer</h2>
      {pendientes.length === 0 ? (
        <p>Nada pendiente.</p>
      ) : (
        <ul class="lineas pendientes">
          {pendientes.map((p) => (
            <li key={p.clave} class={p.urgente ? 'pendiente pendiente--urgente' : 'pendiente'}>
              <a href={p.href}>{p.texto}</a>
            </li>
          ))}
        </ul>
      )}

      <h2>Ventas</h2>
      <p class="nota">
        Este mes, <span class={`estado estado--${ventas.tono}`}>{ventas.texto}</span> frente a{' '}
        {anterior}. Cuentan los pedidos confirmados, pagados, despachados o entregados.
      </p>
      <div class="totales">
        <Periodo titulo="Hoy" c={t.hoy} />
        <Periodo titulo="Este mes" c={t.mes} />
        <Periodo titulo={`El mes anterior (${anterior})`} c={t.anterior} />
      </div>

      <h2>Contra entrega este mes</h2>
      {ce.cerrados === 0 ? (
        <p>
          Todavía no se cierra ningún pedido contra entrega de este mes
          {ce.enCamino ? `; ${pedidos(ce.enCamino)} en camino` : ''}.
        </p>
      ) : (
        <Tarjeta titulo="Lo que te queda">
          <p class="total cifra">{enPesos(ce.netoCop)}</p>
          <dl class="datos">
            <div>
              <dt>Cobrado</dt>
              <dd class="cifra">{enPesos(ce.cobradoCop)}</dd>
            </div>
            <div>
              <dt>Comisión y fletes</dt>
              <dd class="cifra">{enPesos(ce.costosCop)}</dd>
            </div>
            <div>
              <dt>Margen</dt>
              <dd class="cifra">{porcentaje === null ? 'Sin cobros' : `${porcentaje} %`}</dd>
            </div>
            <div>
              <dt>Devueltos</dt>
              <dd class="cifra">
                {ce.devueltos} de {ce.cerrados}
              </dd>
            </div>
          </dl>
          {ce.sinCostos ? (
            <p class="nota">
              {ce.sinCostos === 1
                ? 'A 1 pedido le falta la comisión o el flete: el margen real es menor.'
                : `A ${ce.sinCostos} pedidos les falta la comisión o el flete: el margen real es menor.`}
            </p>
          ) : null}
          {ce.enCamino ? <p class="nota">Y {pedidos(ce.enCamino)} en camino.</p> : null}
        </Tarjeta>
      )}

      {t.cuadre ? (
        <>
          <h2>Tus métricas frente a tus pedidos</h2>
          <Tarjeta titulo={`La semana que empezó el ${fechaLegible(t.cuadre.semana)}`}>
            <p>{cuadreEnPalabras('pedidos', t.cuadre.pedidos)}</p>
            <p>{cuadreEnPalabras('pagos', t.cuadre.pagos)}</p>
            <p class="nota">Tus ventas de arriba salen de tus pedidos, no de las métricas.</p>
          </Tarjeta>
        </>
      ) : null}
    </>
  );
}

/**
 * 26 oct 2026: la dirección de la tienda, a la mano en el Inicio: abrirla y copiarla para
 * compartirla. Sin publicar, dice que todavía no abre y lleva a publicar.
 */
function TuDireccion({ direccion, publicada }: { direccion: string; publicada: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const url = `https://${direccion}`;
  return (
    <section class="direccion-de-la-tienda" aria-labelledby="tu-tienda-en-linea">
      <h2 id="tu-tienda-en-linea" class="direccion-de-la-tienda__titulo">
        Tu tienda en línea
      </h2>
      <p class="direccion-de-la-tienda__url">
        <a href={url} target="_blank" rel="noopener">
          {direccion}
        </a>
      </p>
      <p class="direccion-de-la-tienda__acciones">
        <a class="ed1-boton ed1-boton--primario" href={url} target="_blank" rel="noopener">
          Abrir mi tienda
        </a>
        <button
          class="ed1-boton ed1-boton--texto"
          type="button"
          aria-label="Copiar el enlace de mi tienda"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => {
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            });
          }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </p>
      {publicada ? null : (
        <p class="nota">
          Todavía no abre: tus clientes la verán cuando la publiques.{' '}
          <a href="/mas/publicar/">Publicar mi tienda</a>
        </p>
      )}
    </section>
  );
}

export function Inicio({
  yo,
  conexion,
  alVencer,
}: {
  yo: Yo;
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<Tablero>(conexion, 'tablero');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return setError(r.motivo);
      setTablero(r.datos);
    })();
  }, [conexion, alVencer]);

  const productos = yo.funciones?.['productos'];
  return (
    <main class="contenido">
      <h1>{yo.tienda?.nombre ?? 'Tu tienda'}</h1>
      {yo.direccion && yo.tienda && yo.tienda.estado !== 'baja' ? (
        <TuDireccion direccion={yo.direccion} publicada={yo.tienda.estado !== 'borrador'} />
      ) : null}
      {yo.cobro && yo.cobro.faltan.length > 0 ? (
        <Aviso tono="peligro" titulo="El pago en línea todavía no funciona">
          Falta {enLista(yo.cobro.faltan)}.{' '}
          {puede(yo.rol, 'cobro.gestionar') ? (
            <a href="/mas/cobro/">Arreglarlo</a>
          ) : (
            'Lo arregla quien administra la tienda.'
          )}
        </Aviso>
      ) : null}
      {yo.terminos?.aceptados === false ? (
        <Aviso tono="aviso" titulo="Faltan los términos del servicio">
          Quien administra la tienda tiene que aceptarlos para publicar o cobrar en línea.{' '}
          <a href="/mas/terminos/">Leerlos</a>
        </Aviso>
      ) : null}
      {yo.tienda?.estado === 'borrador' && !yo.direccion ? (
        <Aviso tono="info" titulo="Tu tienda todavía no está publicada">
          Los compradores la verán cuando la publiques.
        </Aviso>
      ) : null}
      {tablero ? (
        <ElTablero t={tablero} />
      ) : error ? (
        <Aviso tono="peligro" titulo="No pudimos leer el tablero">
          {error}
        </Aviso>
      ) : (
        <p role="status">Leyendo el tablero…</p>
      )}
      <h2>Tu tienda</h2>
      <dl class="datos">
        <div>
          <dt>Estado</dt>
          <dd>{ESTADO_DE_LA_TIENDA[yo.tienda?.estado ?? ''] ?? yo.tienda?.estado ?? 'Sin dato'}</dd>
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
    </main>
  );
}
