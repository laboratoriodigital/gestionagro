/**
 * Los pedidos (HU-T9.1 a HU-T9.3, TIENDA-3.0 §12.2 y §12.5).
 *
 * - **La bandeja.** Filtros de estado, forma de pago y texto arriba, que trabajan sobre lo que ya
 *   llegó, sin red; antes de todo, lo que necesita atención. De a 50, con «Ver más». Cada lectura
 *   toma un turno y solo se pinta la última; mientras llega, se ve la lista de antes.
 * - **Un pedido.** El comprador tapado y «Ver datos de entrega», que queda registrado; «Confirmar
 *   por WhatsApp» arma el mensaje, y «Confirmar» descuenta el inventario.
 * - **Despachar (HU-T9.4).** La transportadora y la guía; contra entrega, son obligatorias, y la
 *   comisión y el flete de ida, si se saben, entran al recaudo que nace con el despacho.
 * - **En camino (HU-T9.5).** Entregar, que contra entrega es recaudar; recibir una devolución, con el
 *   flete de vuelta y si las unidades volvieron; o marcar la plata como perdida.
 * - **Notas, enlace y cancelar (HU-T9.6).** Las notas van a la historia; un enlace de seguimiento
 *   nuevo deja sin servir el anterior; cancelar pregunta si las unidades vuelven al inventario.
 */
import { Aviso, type EstadoDeContenido, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos, opNueva } from '../catalogo.ts';
import {
  Casilla,
  Confirmar,
  ESTADOS_DE_PEDIDO,
  Estado,
  Lista,
  Texto,
} from '../componentes/index.ts';
import {
  crearTurno,
  type FilaDePedido,
  type Filtros,
  FORMAS_DE_PAGO,
  type FormularioDeDespacho,
  filtrar,
  type PaginaDePedidos,
  revisarDespacho,
  textoDeAtencion,
  unir,
} from '../pedidos.ts';
import { fleteDeVuelta } from '../recaudos.ts';
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
        <a class="ed1-boton ed1-boton--primario" href="/pedidos/nuevo/">
          Anotar un pedido
        </a>
        <a class="ed1-boton ed1-boton--secundario" href="/pedidos/recaudos/">
          Recaudos
        </a>
        <a class="ed1-boton ed1-boton--secundario" href="/pedidos/solicitudes/">
          Solicitudes
        </a>
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
              detalle: `${textoDeAtencion(p, Date.now())} · ${detalleDe(p)}`,
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
    nota?: string;
  }[];
  conContacto: boolean;
  /** HU-T11.8: el link de pago que sigue vigente. */
  link?: { url: string; vence: string; mensaje: string } | null;
  transportadora: string | null;
  guia: string | null;
  recaudo: Recaudo | null;
}

interface Recaudo {
  estado: string;
  montoCop: number;
  comisionCop: number | null;
  fleteIdaCop: number | null;
  fleteVueltaCop: number | null;
  liquidado: string | null;
  liquidacionRef: string | null;
  netoCop: number;
}

/** La plata de la contraentrega, en palabras (HU-T9.4 y HU-T9.5). */
export const ESTADOS_DEL_RECAUDO: Readonly<Record<string, string>> = {
  por_recaudar: 'Por recaudar: la transportadora lo cobra al entregar',
  recaudado: 'Recaudado: falta que la transportadora lo liquide',
  devuelto: 'Devuelto: el comprador no lo recibió',
  perdido: 'Perdido: la transportadora no responde por él',
};

type Error = { campo: string; mensaje: string };

/** HU-T9.4: despachar, con la guía y, contra entrega, lo que cuesta el recaudo si se sabe. */
function Despachar({
  conexion,
  pedido,
  alVencer,
  alDespachar,
}: {
  conexion: Conexion;
  pedido: PedidoDelPanel;
  alVencer: (motivo: string) => void;
  alDespachar: (aviso: string) => Promise<void>;
}) {
  const contraentrega = pedido.formaPago === 'contraentrega';
  const [f, setF] = useState<FormularioDeDespacho>({
    transportadora: '',
    guia: '',
    comision: '',
    fleteIda: '',
  });
  const [errores, setErrores] = useState<Error[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());
  const campo = (c: keyof FormularioDeDespacho) => (v: string) => setF((x) => ({ ...x, [c]: v }));
  const error = (c: string) => errores.find((e) => e.campo === c)?.mensaje;

  const enviar = async (e: Event) => {
    e.preventDefault();
    const revisado = revisarDespacho(f, contraentrega);
    setErrores(revisado.errores);
    if (revisado.errores.length) return;
    setOcupado(true);
    const r = await pedirAlPanel(conexion, 'pedidos/despachar', {
      cuerpo: { op: op.current, pedido: pedido.id, version: pedido.version, ...revisado.cuerpo },
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      op.current = opNueva();
      return setErrores(r.problemas ?? [{ campo: 'transportadora', mensaje: r.motivo }]);
    }
    await alDespachar(
      contraentrega
        ? 'Pedido despachado. La plata queda por recaudar hasta que la transportadora lo entregue.'
        : 'Pedido despachado.',
    );
  };

  return (
    <section class="acciones">
      <h2>Despachar</h2>
      <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <ResumenDeErrores errores={errores} />
        <Texto
          id="transportadora"
          etiqueta="Transportadora"
          valor={f.transportadora}
          alCambiar={campo('transportadora')}
          error={error('transportadora')}
          opcional={!contraentrega}
        />
        <Texto
          id="guia"
          etiqueta="Número de guía"
          valor={f.guia}
          alCambiar={campo('guia')}
          error={error('guia')}
          opcional={!contraentrega}
          ayuda="El comprador la ve en el seguimiento de su pedido."
        />
        {contraentrega ? (
          <>
            <Texto
              id="comisionCop"
              etiqueta="Comisión del recaudo, con IVA"
              valor={f.comision}
              alCambiar={campo('comision')}
              error={error('comisionCop')}
              opcional
              numerico
            />
            <Texto
              id="fleteIdaCop"
              etiqueta="Flete de ida"
              valor={f.fleteIda}
              alCambiar={campo('fleteIda')}
              error={error('fleteIdaCop')}
              opcional
              numerico
              ayuda="Si todavía no los sabes, los dejas vacíos: no cuentan como $0."
            />
          </>
        ) : null}
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Despachar
        </button>
      </form>
    </section>
  );
}

/**
 * HU-T9.5 CA1 y HU-T9.6 CA2: recibir una devolución. Pide decir si las unidades volvieron (solo
 * entonces suman al inventario) y, si viajaba contra entrega, el flete de vuelta si se sabe.
 */
function Devolver({
  conexion,
  pedido,
  alVencer,
  alDevolver,
}: {
  conexion: Conexion;
  pedido: PedidoDelPanel;
  alVencer: (motivo: string) => void;
  alDevolver: (aviso: string) => Promise<void>;
}) {
  const conFlete = pedido.formaPago === 'contraentrega' && pedido.estado === 'despachado';
  const [volvio, setVolvio] = useState(false);
  const [flete, setFlete] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());
  const enviar = async (e: Event) => {
    e.preventDefault();
    const fleteVueltaCop = conFlete ? fleteDeVuelta(flete) : null;
    if (fleteVueltaCop === undefined)
      return setError('Escribe el flete en pesos, como 10.000, o déjalo vacío.');
    setError(null);
    setOcupado(true);
    const r = await pedirAlPanel(conexion, 'pedidos/devolver', {
      cuerpo: {
        op: op.current,
        pedido: pedido.id,
        version: pedido.version,
        volvio,
        fleteVueltaCop,
      },
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      op.current = opNueva();
      return setError(r.problemas?.[0]?.mensaje ?? r.motivo);
    }
    await alDevolver(
      volvio
        ? 'Devolución recibida. Las unidades volvieron al inventario.'
        : 'Devolución recibida. El inventario no cambió.',
    );
  };
  return (
    <details class="ed1-confirmacion">
      <summary class="ed1-boton ed1-boton--secundario">Recibir una devolución</summary>
      <form
        class="ed1-confirmacion__formulario formulario"
        onSubmit={(e) => void enviar(e)}
        noValidate
      >
        <Casilla
          id="volvio"
          etiqueta="Las unidades volvieron y se pueden vender otra vez"
          marcada={volvio}
          alCambiar={setVolvio}
        />
        {conFlete ? (
          <Texto
            id="fleteVueltaCop"
            etiqueta="Flete de vuelta"
            valor={flete}
            alCambiar={setFlete}
            error={error ?? undefined}
            opcional
            numerico
          />
        ) : error ? (
          <p class="ed1-campo__error" role="alert">
            {error}
          </p>
        ) : null}
        <p class="ed1-confirmacion__consecuencia">
          El pedido queda devuelto{conFlete ? ' y la plata de la contraentrega no se cobra' : ''}.
          {volvio ? ' Las unidades vuelven al inventario una sola vez.' : ''}
        </p>
        <button
          class="ed1-boton ed1-boton--peligro"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Sí, recibir la devolución
        </button>
      </form>
    </details>
  );
}

/** HU-T9.6 CA2: cancelar. Si ya había descontado, pregunta si las unidades vuelven. */
function Cancelar({
  conexion,
  pedido,
  alVencer,
  alCancelar,
}: {
  conexion: Conexion;
  pedido: PedidoDelPanel;
  alVencer: (motivo: string) => void;
  alCancelar: (aviso: string) => Promise<void>;
}) {
  const descontado = pedido.lineas.some((l) => l.descontado);
  const [volvio, setVolvio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());
  const enviar = async (e: Event) => {
    e.preventDefault();
    setOcupado(true);
    const r = await pedirAlPanel(conexion, 'pedidos/cancelar', {
      cuerpo: {
        op: op.current,
        pedido: pedido.id,
        version: pedido.version,
        volvio: descontado && volvio,
      },
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      op.current = opNueva();
      return setError(r.problemas?.[0]?.mensaje ?? r.motivo);
    }
    await alCancelar(
      descontado && volvio
        ? 'Pedido cancelado. Las unidades volvieron al inventario.'
        : 'Pedido cancelado.',
    );
  };
  return (
    <details class="ed1-confirmacion">
      <summary class="ed1-boton ed1-boton--secundario">Cancelar el pedido</summary>
      <form
        class="ed1-confirmacion__formulario formulario"
        onSubmit={(e) => void enviar(e)}
        noValidate
      >
        {descontado ? (
          <Casilla
            id="cancelar-volvio"
            etiqueta="Las unidades siguen aquí: vuelven al inventario"
            marcada={volvio}
            alCambiar={setVolvio}
          />
        ) : null}
        <p class="ed1-confirmacion__consecuencia">
          El pedido queda cancelado y no se puede volver a confirmar.
        </p>
        {error ? (
          <p class="ed1-campo__error" role="alert">
            {error}
          </p>
        ) : null}
        <button
          class="ed1-boton ed1-boton--peligro"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Sí, cancelar el pedido
        </button>
      </form>
    </details>
  );
}

/** HU-T9.6 CA1: una nota en la historia del pedido. */
function Nota({
  conexion,
  pedido,
  alVencer,
  alAnotar,
}: {
  conexion: Conexion;
  pedido: PedidoDelPanel;
  alVencer: (motivo: string) => void;
  alAnotar: (aviso: string) => Promise<void>;
}) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const op = useRef(opNueva());
  const enviar = async (e: Event) => {
    e.preventDefault();
    if (!texto.trim()) return setError('Escribe la nota.');
    const r = await pedirAlPanel(conexion, 'pedidos/nota', {
      cuerpo: { op: op.current, pedido: pedido.id, texto: texto.trim() },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    op.current = opNueva();
    if (r.tipo !== 'ok') return setError(r.problemas?.[0]?.mensaje ?? r.motivo);
    setError(undefined);
    setTexto('');
    await alAnotar('Nota guardada en la historia del pedido.');
  };
  return (
    <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
      <Texto
        id="nota"
        etiqueta="Agregar una nota"
        valor={texto}
        alCambiar={setTexto}
        error={error}
      />
      <button class="ed1-boton ed1-boton--secundario" type="submit">
        Guardar la nota
      </button>
    </form>
  );
}

interface Contacto {
  nombre?: string;
  celular?: string;
  correo?: string;
  direccion?: string;
  ciudad?: string;
  notas?: string;
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
  if (e.tipo === 'nota') return `${e.quien}: «${e.nota ?? ''}»`;
  if (e.tipo === 'recaudo')
    return `${e.quien}: recaudo ${e.a === 'liquidado' ? 'liquidado' : `«${(ESTADOS_DEL_RECAUDO[e.a ?? ''] ?? e.a ?? '').split(':')[0]}»`}`;
  if (e.tipo === 'contacto_leido')
    return `${e.quien} ${e.quien === 'Tú' ? 'viste' : 'vio'} los datos de entrega`;
  // HU-T7.3: el comprador pidió corregir o borrar sus datos, o se cumplió el plazo.
  if (e.tipo === 'contacto_corregido')
    return `${e.quien} ${e.quien === 'Tú' ? 'corregiste' : 'corrigió'} los datos de entrega`;
  if (e.tipo === 'contacto_suprimido')
    return e.quien === 'La tienda'
      ? 'Los datos de entrega se borraron al cumplir su plazo'
      : `${e.quien} ${e.quien === 'Tú' ? 'borraste' : 'borró'} los datos de entrega, a pedido del comprador`;
  return `${e.quien}: ${EVENTOS[e.tipo] ?? e.tipo}`;
};

/** HU-T11.8: cuánto dura el link, de 15 minutos a 24 horas; 60 minutos si no se elige. */
const DURACIONES: readonly [number, string][] = [
  [15, '15 minutos'],
  [30, '30 minutos'],
  [60, '1 hora'],
  [120, '2 horas'],
  [240, '4 horas'],
  [720, '12 horas'],
  [1440, '24 horas'],
];

/**
 * HU-T11.8 CA1: cobrar con un link de Bold el pedido que llegó por el chat. El pedido pasa a «por
 * pagar» y sus unidades quedan apartadas hasta que el link vence. WhatsApp se abre con un enlace, no
 * después de esperar a la red: el navegador no deja abrir una ventana tarde.
 */
function CobrarConLink({
  conexion,
  pedido,
  alVencer,
  alCobrar,
}: {
  conexion: Conexion;
  pedido: PedidoDelPanel;
  alVencer: (motivo: string) => void;
  alCobrar: () => void;
}) {
  const [minutos, setMinutos] = useState(60);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ link: string; mensaje: string } | null>(null);
  const vigente = pedido.link
    ? {
        link: pedido.link.url,
        // El mismo mensaje que dio la API al crearlo: al recargar el pedido no cambia.
        mensaje: pedido.link.mensaje,
      }
    : null;
  const mostrado = hecho ?? vigente;
  const cobrar = async () => {
    setEnviando(true);
    setError(null);
    const r = await pedirAlPanel<{ link: string; mensaje: string }>(conexion, 'pedidos/link', {
      cuerpo: { op: opNueva(), pedido: pedido.id, version: pedido.version, minutos },
    });
    setEnviando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.problemas?.[0]?.mensaje ?? r.motivo);
    setHecho({ link: r.datos.link, mensaje: r.datos.mensaje });
    alCobrar();
  };
  if (mostrado)
    return (
      <section class="acciones">
        <h2>Link de pago</h2>
        <pre class="mensaje">{mostrado.mensaje}</pre>
        <a
          class="ed1-boton ed1-boton--primario"
          href={`https://wa.me/?text=${encodeURIComponent(mostrado.mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Mandarlo por WhatsApp
        </a>
        <p class="nota">
          Cuando el comprador pague, Bold avisa y el pedido queda pagado. Si el link vence sin pago,
          las unidades vuelven a estar disponibles y el pedido vuelve a pendiente.
        </p>
      </section>
    );
  if (pedido.estado !== 'pendiente') return null;
  return (
    <section class="acciones">
      <h2>Cobrar con link</h2>
      <p class="nota">
        Bold crea un link de pago por {enPesos(pedido.totalCop)}. Mientras sirve, las unidades del
        pedido quedan apartadas.
      </p>
      {error ? (
        <Aviso tono="peligro" titulo="No se creó el link">
          {error}
        </Aviso>
      ) : null}
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="duracion-del-link">
          El link sirve por
        </label>
        <select
          class="ed1-campo__control"
          id="duracion-del-link"
          value={String(minutos)}
          onChange={(e) => setMinutos(Number((e.target as HTMLSelectElement).value))}
        >
          {DURACIONES.map(([m, texto]) => (
            <option key={m} value={String(m)}>
              {texto}
            </option>
          ))}
        </select>
      </div>
      <button
        class="ed1-boton ed1-boton--secundario"
        type="button"
        disabled={enviando}
        aria-busy={enviando ? 'true' : undefined}
        onClick={() => void cobrar()}
      >
        Cobrar con link
      </button>
    </section>
  );
}

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
  const [contacto, setContacto] = useState<Contacto | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'info' | 'peligro'; texto: string } | null>(null);
  const [whatsapp, setWhatsapp] = useState<{ url: string; mensaje: string } | null>(null);
  const [enlace, setEnlace] = useState<string | null>(null);

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

  const verDatos = async () => {
    const r = await pedirAlPanel<{ contacto: Contacto }>(conexion, 'pedidos/contacto', {
      cuerpo: { pedido: pedido.id },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setAviso({ tono: 'peligro', texto: r.motivo });
    setContacto(r.datos.contacto);
    await cargar();
  };
  const armarWhatsapp = async () => {
    const r = await pedirAlPanel<{ url: string; mensaje: string }>(conexion, 'pedidos/whatsapp', {
      cuerpo: { pedido: pedido.id },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setAviso({ tono: 'peligro', texto: r.motivo });
    setWhatsapp(r.datos);
    await cargar();
  };
  const confirmar = async () => {
    const r = await pedirAlPanel(conexion, 'pedidos/confirmar', {
      cuerpo: { op: opNueva(), pedido: pedido.id, version: pedido.version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setAviso(
      r.tipo === 'ok'
        ? { tono: 'info', texto: 'Pedido confirmado. Sus unidades ya salieron del inventario.' }
        : { tono: 'peligro', texto: r.problemas?.[0]?.mensaje ?? r.motivo },
    );
    await cargar();
  };

  const unidades = pedido.lineas.reduce((s, l) => s + (l.descontado ? 0 : l.cantidad), 0);
  const porConfirmar = pedido.estado === 'pendiente' && pedido.formaPago !== 'en_linea';
  const porDespachar = pedido.estado === 'confirmado' || pedido.estado === 'pagado';
  const contraentrega = pedido.formaPago === 'contraentrega';
  const cancelable = pedido.estado === 'pendiente' || pedido.estado === 'confirmado';
  const hacerEnlace = async () => {
    const r = await pedirAlPanel<{ enlace: string }>(conexion, 'pedidos/enlace', {
      cuerpo: { pedido: pedido.id },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok')
      return setAviso({ tono: 'peligro', texto: r.problemas?.[0]?.mensaje ?? r.motivo });
    setEnlace(r.datos.enlace);
    await cargar();
  };
  const cambiar = (ruta: string, listo: string) => async () => {
    const r = await pedirAlPanel(conexion, ruta, {
      cuerpo: { op: opNueva(), pedido: pedido.id, version: pedido.version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setAviso(
      r.tipo === 'ok'
        ? { tono: 'info', texto: listo }
        : { tono: 'peligro', texto: r.problemas?.[0]?.mensaje ?? r.motivo },
    );
    await cargar();
  };
  const alCambiar = async (texto: string) => {
    setAviso({ tono: 'info', texto });
    await cargar();
  };

  return (
    <main class="contenido">
      <p>
        <a href="/pedidos/">Pedidos</a>
      </p>
      <h1>Pedido #{pedido.numero}</h1>
      <p>
        <Estado id={pedido.estado} /> <span class="cifra">{horaDeBogota(pedido.creado)}</span>
      </p>
      {aviso ? (
        <Aviso tono={aviso.tono} titulo={aviso.tono === 'info' ? 'Listo' : 'No se pudo'}>
          {aviso.texto}
        </Aviso>
      ) : null}
      {pedido.atencion ? (
        <Aviso tono="peligro" titulo="Necesita atención">
          {textoDeAtencion(pedido, Date.now())}.
          {pedido.atencion === 'sin_existencias'
            ? ' Repón las unidades en Inventario y despáchalo, o cancélalo y devuelve el dinero desde tu cuenta de Bold.'
            : null}
        </Aviso>
      ) : null}

      <h2>Comprador</h2>
      {contacto ? (
        <dl class="datos">
          {(
            [
              ['Nombre', contacto.nombre],
              ['Celular', contacto.celular],
              ['Correo', contacto.correo],
              ['Dirección', contacto.direccion],
              ['Ciudad', contacto.ciudad],
              ['Notas', contacto.notas],
            ] as const
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      ) : pedido.conContacto ? (
        <>
          <p class="tapado">
            {[pedido.comprador?.nombre, pedido.comprador?.celular].filter(Boolean).join(' · ')}
          </p>
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            onClick={() => void verDatos()}
          >
            Ver datos de entrega
          </button>
          <p class="nota">Queda en el registro quién los vio y cuándo.</p>
        </>
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
        {pedido.transportadora ? (
          <div>
            <dt>Transportadora</dt>
            <dd>{pedido.transportadora}</dd>
          </div>
        ) : null}
        {pedido.guia ? (
          <div>
            <dt>Guía</dt>
            <dd class="cifra">{pedido.guia}</dd>
          </div>
        ) : null}
        {pedido.recaudo ? (
          <>
            <div>
              <dt>Recaudo</dt>
              <dd>{ESTADOS_DEL_RECAUDO[pedido.recaudo.estado] ?? pedido.recaudo.estado}</dd>
            </div>
            <div>
              <dt>Te queda, con comisión y fletes</dt>
              <dd class="cifra">{enPesos(pedido.recaudo.netoCop)}</dd>
            </div>
            {pedido.recaudo.liquidacionRef ? (
              <div>
                <dt>Liquidación</dt>
                <dd class="cifra">{pedido.recaudo.liquidacionRef}</dd>
              </div>
            ) : null}
          </>
        ) : null}
      </dl>

      {porConfirmar ? (
        <section class="acciones">
          <h2>Confirmar</h2>
          <p class="nota">
            Primero confirma con el comprador; después, confirma aquí para que las unidades salgan
            del inventario.
          </p>
          {whatsapp ? (
            <>
              <pre class="mensaje">{whatsapp.mensaje}</pre>
              <a
                class="ed1-boton ed1-boton--primario"
                href={whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir WhatsApp con el mensaje
              </a>
            </>
          ) : (
            <button
              class="ed1-boton ed1-boton--primario"
              type="button"
              onClick={() => void armarWhatsapp()}
            >
              Confirmar por WhatsApp
            </button>
          )}
          <Confirmar
            abrir="Confirmar el pedido"
            consecuencia={
              unidades === 1
                ? 'Sale 1 unidad del inventario y el pedido queda confirmado.'
                : `Salen ${unidades} unidades del inventario y el pedido queda confirmado.`
            }
            confirmar="Sí, confirmar"
            alConfirmar={confirmar}
          />
        </section>
      ) : null}

      {pedido.estado === 'pendiente' || pedido.link ? (
        <CobrarConLink
          key={pedido.version}
          conexion={conexion}
          pedido={pedido}
          alVencer={alVencer}
          alCobrar={() => void cargar()}
        />
      ) : null}

      {porDespachar ? (
        <Despachar
          key={pedido.version}
          conexion={conexion}
          pedido={pedido}
          alVencer={alVencer}
          alDespachar={alCambiar}
        />
      ) : null}

      {pedido.estado === 'despachado' ? (
        <section class="acciones">
          <h2>En camino</h2>
          <Confirmar
            abrir="Marcar entregado"
            consecuencia={
              contraentrega
                ? `La transportadora lo entregó y cobró ${enPesos(pedido.totalCop)}: la plata queda recaudada, por liquidar.`
                : 'El pedido queda entregado.'
            }
            confirmar="Sí, se entregó"
            alConfirmar={cambiar(
              'pedidos/entregar',
              contraentrega
                ? 'Pedido entregado. La plata queda recaudada: falta que la transportadora la liquide.'
                : 'Pedido entregado.',
            )}
          />
          <Devolver
            key={pedido.version}
            conexion={conexion}
            pedido={pedido}
            alVencer={alVencer}
            alDevolver={alCambiar}
          />
          {contraentrega ? (
            <Confirmar
              abrir="La plata se perdió"
              consecuencia="La transportadora no responde por el paquete ni por la plata. El pedido se cierra y queda aparte en Recaudos."
              confirmar="Sí, se perdió"
              alConfirmar={cambiar('pedidos/perder', 'Quedó como perdido, aparte en Recaudos.')}
            />
          ) : null}
        </section>
      ) : null}
      {pedido.estado === 'entregado' ? (
        <section class="acciones">
          <h2>Devolución</h2>
          <Devolver
            key={pedido.version}
            conexion={conexion}
            pedido={pedido}
            alVencer={alVencer}
            alDevolver={alCambiar}
          />
        </section>
      ) : null}

      {cancelable ? (
        <Cancelar
          key={`cancelar-${pedido.version}`}
          conexion={conexion}
          pedido={pedido}
          alVencer={alVencer}
          alCancelar={alCambiar}
        />
      ) : null}

      <h2>Seguimiento</h2>
      {enlace ? (
        <>
          <p class="nota">Este es el enlace nuevo; el de antes ya no sirve.</p>
          <pre class="mensaje">{enlace}</pre>
          <a
            class="ed1-boton ed1-boton--primario"
            href={`https://wa.me/?text=${encodeURIComponent(`Aquí puedes seguir tu pedido #${pedido.numero}: ${enlace}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Mandarlo por WhatsApp
          </a>
        </>
      ) : (
        <Confirmar
          abrir="Hacer un enlace de seguimiento nuevo"
          consecuencia="El comprador ve su pedido con el enlace nuevo. El que tenía antes deja de servir."
          confirmar="Sí, hacer uno nuevo"
          alConfirmar={hacerEnlace}
        />
      )}

      <h2>Historia</h2>
      <ol class="registro">
        <li class="registro__fila">
          <span class="registro__hora cifra">{horaDeBogota(pedido.creado)}</span>
          <span>
            {pedido.canal === 'panel'
              ? 'Se anotó en el panel'
              : `Llegó el pedido${pedido.canal === 'whatsapp' ? ' por WhatsApp' : ''}`}
          </span>
        </li>
        {pedido.historia.map((e) => (
          <li key={`${e.instante}-${e.tipo}-${e.a ?? ''}`} class="registro__fila">
            <span class="registro__hora cifra">{horaDeBogota(e.instante)}</span>
            <span>{enFrase(e)}</span>
          </li>
        ))}
      </ol>
      <Nota conexion={conexion} pedido={pedido} alVencer={alVencer} alAnotar={alCambiar} />
    </main>
  );
}
