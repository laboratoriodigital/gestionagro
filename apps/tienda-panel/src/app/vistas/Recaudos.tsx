/**
 * Recaudos (HU-T9.5, TIENDA-3.0 §8.7 «Lo que ve el comercio»): cuánta plata de contraentrega me
 * deben, cuánta ya cobró la transportadora y falta que me liquide, y desde cuándo. Liquidar marca
 * varios con el número de la liquidación; lo perdido va aparte.
 */
import { Aviso, ResumenDeErrores, Tarjeta } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos, opNueva } from '../catalogo.ts';
import { Guia, Texto } from '../componentes/index.ts';
import {
  antiguedad,
  type Recaudos as Datos,
  type FilaDeRecaudo,
  revisarLiquidacion,
} from '../recaudos.ts';

const cuantos = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`);

function Total({
  titulo,
  total,
  ahora,
  verbo,
}: {
  titulo: string;
  total: Datos['porRecaudar'];
  ahora: number;
  verbo: string;
}) {
  return (
    <Tarjeta titulo={titulo}>
      <p class="total cifra">{enPesos(total.montoCop)}</p>
      <p class="nota">
        {total.cantidad === 0
          ? 'Nada pendiente.'
          : `${cuantos(total.cantidad)}; el más viejo ${verbo} ${antiguedad(total.desde ?? '', ahora)}.`}
      </p>
    </Tarjeta>
  );
}

const detalleDe = (r: FilaDeRecaudo) =>
  [r.transportadora, r.guia ? `guía ${r.guia}` : null].filter(Boolean).join(' · ');

export function Recaudos({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [referencia, setReferencia] = useState('');
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());
  const ahora = Date.now();

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<Datos>(conexion, 'recaudos');
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.motivo);
    setError(null);
    setDatos(r.datos);
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!datos)
    return (
      <main class="contenido" role={error ? undefined : 'status'}>
        {error ? (
          <Aviso tono="peligro" titulo="No pudimos leer los recaudos">
            {error}
          </Aviso>
        ) : (
          'Leyendo los recaudos…'
        )}
      </main>
    );

  const porLiquidar = datos.recaudos.filter((r) => r.estado === 'recaudado');
  const enCamino = datos.recaudos.filter((r) => r.estado === 'por_recaudar');
  const perdidos = datos.recaudos.filter((r) => r.estado === 'perdido');
  const suma = porLiquidar
    .filter((r) => elegidos.includes(r.pedido))
    .reduce((s, r) => s + r.montoCop, 0);

  const liquidar = async (e: Event) => {
    e.preventDefault();
    const revisados = revisarLiquidacion(elegidos, referencia);
    setErrores(revisados);
    if (revisados.length) return;
    setOcupado(true);
    const r = await pedirAlPanel(conexion, 'recaudos/liquidar', {
      cuerpo: { op: op.current, pedidos: elegidos, liquidacionRef: referencia.trim() },
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    op.current = opNueva();
    if (r.tipo !== 'ok') {
      setErrores(r.problemas ?? [{ campo: 'pedidos', mensaje: r.motivo }]);
      return cargar();
    }
    setAviso(
      `Liquidación ${referencia.trim()} guardada: ${cuantos(elegidos.length)} por ${enPesos(suma)}.`,
    );
    setElegidos([]);
    setReferencia('');
    await cargar();
  };

  return (
    <main class="contenido">
      <p>
        <a href="/pedidos/">Pedidos</a>
      </p>
      <h1>Recaudos</h1>
      <Guia guia="contraentrega" />
      <p class="nota">La plata de los pedidos contra entrega, desde que salen hasta tu cuenta.</p>
      {aviso ? (
        <Aviso tono="info" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      <div class="totales">
        <Total titulo="Por recaudar" total={datos.porRecaudar} ahora={ahora} verbo="salió" />
        <Total
          titulo="Recaudado sin liquidar"
          total={datos.sinLiquidar}
          ahora={ahora}
          verbo="se cobró"
        />
      </div>

      <h2>Por liquidar</h2>
      {porLiquidar.length === 0 ? (
        <p>La transportadora no te debe nada de lo que ya cobró.</p>
      ) : (
        <form class="formulario" onSubmit={(e) => void liquidar(e)} noValidate>
          <ResumenDeErrores errores={errores} />
          <fieldset class="ed1-grupo" id="pedidos">
            <legend class="ed1-grupo__titulo">¿Cuáles llegaron en la liquidación?</legend>
            {porLiquidar.map((r) => (
              <label class="casilla" for={`liquidar-${r.pedido}`} key={r.pedido}>
                <input
                  id={`liquidar-${r.pedido}`}
                  type="checkbox"
                  checked={elegidos.includes(r.pedido)}
                  onChange={(e) =>
                    setElegidos((x) =>
                      (e.target as HTMLInputElement).checked
                        ? [...x, r.pedido]
                        : x.filter((p) => p !== r.pedido),
                    )
                  }
                />
                <span>
                  #{r.numero} · <span class="cifra">{enPesos(r.montoCop)}</span>
                  <span class="fila__detalle">
                    {' '}
                    · te quedan {enPesos(r.netoCop)} · se cobró {antiguedad(r.desde, ahora)}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <Texto
            id="liquidacionRef"
            etiqueta="Número de la liquidación"
            valor={referencia}
            alCambiar={setReferencia}
            error={errores.find((x) => x.campo === 'liquidacionRef')?.mensaje}
            ayuda="El que trae el comprobante de la transportadora."
          />
          <button
            class="ed1-boton ed1-boton--primario"
            type="submit"
            disabled={ocupado}
            aria-busy={ocupado ? 'true' : undefined}
          >
            {elegidos.length
              ? `Liquidar ${cuantos(elegidos.length)} por ${enPesos(suma)}`
              : 'Liquidar'}
          </button>
        </form>
      )}

      <h2>En camino</h2>
      {enCamino.length === 0 ? (
        <p>No hay pedidos contra entrega en camino.</p>
      ) : (
        <ul class="lineas">
          {enCamino.map((r) => (
            <li key={r.pedido}>
              <span>
                <a href={`/pedidos/${encodeURIComponent(r.pedido)}/`}>#{r.numero}</a>
                <span class="fila__detalle">
                  {' '}
                  {detalleDe(r)} · salió {antiguedad(r.desde, ahora)}
                </span>
              </span>
              <span class="cifra">{enPesos(r.montoCop)}</span>
            </li>
          ))}
        </ul>
      )}

      {perdidos.length > 0 ? (
        <section aria-labelledby="perdidos-titulo">
          <h2 id="perdidos-titulo">Perdidos</h2>
          <p class="nota">
            La transportadora no respondió por ellos: {enPesos(datos.perdidos.montoCop)} en{' '}
            {cuantos(datos.perdidos.cantidad)}.
          </p>
          <ul class="lineas">
            {perdidos.map((r) => (
              <li key={r.pedido}>
                <span>
                  <a href={`/pedidos/${encodeURIComponent(r.pedido)}/`}>#{r.numero}</a>
                  <span class="fila__detalle"> {detalleDe(r)}</span>
                </span>
                <span class="cifra">{enPesos(r.montoCop)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
