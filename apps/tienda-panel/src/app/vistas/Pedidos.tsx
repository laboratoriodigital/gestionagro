/**
 * Los pedidos (HU-T9.1 a HU-T9.3, TIENDA-3.0 §12.2 y §12.5).
 *
 * - **La bandeja.** Filtros de estado, forma de pago y texto arriba, que trabajan sobre lo que ya
 *   llegó, sin red; antes de todo, lo que necesita atención. De a 50, con «Ver más». Cada lectura
 *   toma un turno y solo se pinta la última; mientras llega, se ve la lista de antes.
 * - **Un pedido.** El comprador tapado y «Ver datos de entrega», que queda registrado; «Confirmar
 *   por WhatsApp» arma el mensaje, y «Confirmar» descuenta el inventario.
 */
import { Aviso, type EstadoDeContenido } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos } from '../catalogo.ts';
import { ESTADOS_DE_PEDIDO, Estado, Lista } from '../componentes/index.ts';
import {
  ATENCION,
  crearTurno,
  type FilaDePedido,
  type Filtros,
  FORMAS_DE_PAGO,
  filtrar,
  type PaginaDePedidos,
  unir,
} from '../pedidos.ts';
import { horaDeBogota } from './Registro.tsx';

const forma = (id: string) => FORMAS_DE_PAGO[id] ?? id;

const detalleDe = (p: FilaDePedido) =>
  [
    p.comprador?.nombre,
    forma(p.formaPago),
    p.ciudad,
    p.articulos === 1 ? '1 artículo' : `${p.articulos} artículos`,
  ]
    .filter(Boolean)
    .join(' · ');

const filaDe = (p: FilaDePedido) => ({
  href: `/pedidos/${encodeURIComponent(p.id)}/`,
  dato: `#${p.numero} · ${horaDeBogota(p.creado)}`,
  monto: enPesos(p.totalCop),
  estado: <Estado id={p.estado} />,
  detalle: detalleDe(p),
});

export function Bandeja({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const turno = useRef(crearTurno());
  const [pedidos, setPedidos] = useState<FilaDePedido[] | null>(null);
  const [atencion, setAtencion] = useState<FilaDePedido[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ estado: '', forma: '', texto: '' });

  /** Lee la primera página (`desde` nulo) o la siguiente. Solo pinta si su turno sigue vigente. */
  const leer = useCallback(
    async (desde: string | null) => {
      const t = turno.current.tomar();
      setLeyendo(true);
      const r = await pedirAlPanel<PaginaDePedidos>(
        conexion,
        desde ? `pedidos?cursor=${encodeURIComponent(desde)}` : 'pedidos',
      );
      if (!turno.current.vigente(t)) return;
      setLeyendo(false);
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') {
        setError(r.motivo);
        return;
      }
      setError(null);
      setSiguiente(r.datos.siguiente);
      if (desde) setPedidos((antes) => unir(antes ?? [], r.datos.pedidos));
      else {
        setAtencion(r.datos.atencion);
        setPedidos(r.datos.pedidos);
      }
    },
    [conexion, alVencer],
  );

  useEffect(() => {
    void leer(null);
    const alVolver = () => {
      if (document.visibilityState === 'visible') void leer(null);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [leer]);

  const filtrados = pedidos ? filtrar(pedidos, filtros) : null;
  const estado: EstadoDeContenido<FilaDePedido> =
    filtrados === null
      ? error
        ? { tipo: 'error', causa: error }
        : { tipo: 'cargando' }
      : { tipo: 'listo', elementos: filtrados };
  const elegir = (campo: keyof Filtros) => (e: Event) =>
    setFiltros((f) => ({ ...f, [campo]: (e.target as HTMLInputElement).value }));
  const hayFiltros = Boolean(filtros.estado || filtros.forma || filtros.texto.trim());

  return (
    <main class="contenido" aria-busy={leyendo ? 'true' : undefined}>
      <h1>Pedidos</h1>
      <div class="filtros">
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="filtro-estado">
            Estado
          </label>
          <select
            class="ed1-campo__control"
            id="filtro-estado"
            value={filtros.estado}
            onChange={elegir('estado')}
          >
            <option value="">Todos</option>
            {Object.entries(ESTADOS_DE_PEDIDO).map(([id, e]) => (
              <option key={id} value={id}>
                {e.texto}
              </option>
            ))}
          </select>
        </div>
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="filtro-forma">
            Forma de pago
          </label>
          <select
            class="ed1-campo__control"
            id="filtro-forma"
            value={filtros.forma}
            onChange={elegir('forma')}
          >
            <option value="">Todas</option>
            {Object.entries(FORMAS_DE_PAGO).map(([id, texto]) => (
              <option key={id} value={id}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="filtro-texto">
            Número o comprador
          </label>
          <input
            class="ed1-campo__control"
            id="filtro-texto"
            type="search"
            value={filtros.texto}
            onInput={elegir('texto')}
          />
        </div>
      </div>
      <div class="acciones acciones--fila">
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          disabled={leyendo}
          aria-busy={leyendo ? 'true' : undefined}
          onClick={() => void leer(null)}
        >
          Actualizar
        </button>
      </div>
      {error && pedidos ? (
        <Aviso tono="peligro" titulo="No pudimos actualizar">
          {error}
        </Aviso>
      ) : null}
      {atencion.length > 0 ? (
        <section class="atencion" aria-labelledby="atencion-titulo">
          <h2 id="atencion-titulo">Necesitan atención</h2>
          <Lista
            titulo="Necesitan atención"
            estado={{ tipo: 'listo', elementos: atencion }}
            vacio={{ porque: '' }}
            fila={(p: FilaDePedido) => ({
              ...filaDe(p),
              detalle: `${ATENCION[p.atencion ?? ''] ?? p.atencion} · ${detalleDe(p)}`,
            })}
          />
        </section>
      ) : null}
      <Lista
        titulo="Pedidos"
        estado={estado}
        vacio={
          hayFiltros
            ? { porque: 'Ningún pedido de los que se ven cumple esos filtros.' }
            : { porque: 'Todavía no te han llegado pedidos por la tienda.' }
        }
        fila={filaDe}
      />
      {siguiente !== null ? (
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          disabled={leyendo}
          onClick={() => void leer(siguiente)}
        >
          Ver más
        </button>
      ) : null}
    </main>
  );
}

interface PedidoDelPanel extends FilaDePedido {
  canal: string;
  subtotalCop: number;
  descuentoCop: number;
  envioCop: number;
  cuponCodigo: string | null;
  envioNombre: string | null;
  lineas: {
    variante: string;
    nombre: string;
    opciones: string;
    cantidad: number;
    precioUnitarioCop: number;
    totalCop: number;
    descontado: boolean;
  }[];
  historia: {
    instante: string;
    tipo: string;
    de: string | null;
    a: string | null;
    quien: string;
  }[];
  conContacto: boolean;
}

const EVENTOS: Record<string, string> = {
  nota: 'Nota',
  pago: 'Pago',
  envio: 'Envío',
  recaudo: 'Recaudo',
};

const enFrase = (e: PedidoDelPanel['historia'][number]) => {
  if (e.tipo === 'estado') {
    const a = ESTADOS_DE_PEDIDO[e.a ?? '']?.texto ?? e.a;
    return `${e.quien}: ${e.de ? `de «${ESTADOS_DE_PEDIDO[e.de]?.texto ?? e.de}» a ` : ''}«${a}»`;
  }
  if (e.tipo === 'contacto_leido')
    return `${e.quien} ${e.quien === 'Tú' ? 'viste' : 'vio'} los datos de entrega`;
  return `${e.quien}: ${EVENTOS[e.tipo] ?? e.tipo}`;
};

export function Pedido({
  conexion,
  id,
  alVencer,
}: {
  conexion: Conexion;
  id: string;
  alVencer: (motivo: string) => void;
}) {
  const [pedido, setPedido] = useState<PedidoDelPanel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<PedidoDelPanel>(conexion, `pedidos/${encodeURIComponent(id)}`);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.motivo);
    setPedido(r.datos);
  }, [conexion, id, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error)
    return (
      <main class="contenido">
        <p>
          <a href="/pedidos/">Pedidos</a>
        </p>
        <Aviso tono="peligro" titulo="No pudimos abrir el pedido">
          {error}
        </Aviso>
      </main>
    );
  if (!pedido)
    return (
      <main class="contenido" role="status">
        Abriendo el pedido…
      </main>
    );

  return (
    <main class="contenido">
      <p>
        <a href="/pedidos/">Pedidos</a>
      </p>
      <h1>Pedido #{pedido.numero}</h1>
      <p>
        <Estado id={pedido.estado} /> <span class="cifra">{horaDeBogota(pedido.creado)}</span>
      </p>
      {pedido.atencion ? (
        <Aviso tono="peligro" titulo="Necesita atención">
          {ATENCION[pedido.atencion] ?? pedido.atencion}
        </Aviso>
      ) : null}

      <h2>Comprador</h2>
      {pedido.comprador ? (
        <p class="tapado">
          {[pedido.comprador.nombre, pedido.comprador.celular].filter(Boolean).join(' · ')}
        </p>
      ) : (
        <p class="nota">Llegó por WhatsApp: los datos del comprador están en esa conversación.</p>
      )}

      <h2>Lo que pidió</h2>
      <ul class="lineas">
        {pedido.lineas.map((l) => (
          <li key={`${l.variante}-${l.nombre}`}>
            <span>
              {l.cantidad} × {l.nombre}
              {l.opciones ? <span class="fila__detalle"> ({l.opciones})</span> : null}
            </span>
            <span class="cifra">{enPesos(l.totalCop)}</span>
          </li>
        ))}
      </ul>
      <dl class="datos">
        {pedido.descuentoCop > 0 ? (
          <div>
            <dt>Descuento{pedido.cuponCodigo ? ` (${pedido.cuponCodigo})` : ''}</dt>
            <dd class="cifra">−{enPesos(pedido.descuentoCop)}</dd>
          </div>
        ) : null}
        {pedido.envioNombre ? (
          <div>
            <dt>Envío ({pedido.envioNombre})</dt>
            <dd class="cifra">{enPesos(pedido.envioCop)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Total</dt>
          <dd class="cifra">{enPesos(pedido.totalCop)}</dd>
        </div>
        <div>
          <dt>Forma de pago</dt>
          <dd>{forma(pedido.formaPago)}</dd>
        </div>
        {pedido.ciudad ? (
          <div>
            <dt>Ciudad</dt>
            <dd>{pedido.ciudad}</dd>
          </div>
        ) : null}
      </dl>

      <h2>Historia</h2>
      <ol class="registro">
        <li class="registro__fila">
          <span class="registro__hora cifra">{horaDeBogota(pedido.creado)}</span>
          <span>Llegó el pedido{pedido.canal === 'whatsapp' ? ' por WhatsApp' : ''}</span>
        </li>
        {pedido.historia.map((e) => (
          <li key={`${e.instante}-${e.tipo}-${e.a ?? ''}`} class="registro__fila">
            <span class="registro__hora cifra">{horaDeBogota(e.instante)}</span>
            <span>{enFrase(e)}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
