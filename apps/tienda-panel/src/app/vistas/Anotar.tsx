/**
 * Anotar un pedido (HU-T9.6 CA1): el que llegó por teléfono o en persona. Las combinaciones salen
 * del inventario con su precio de hoy; queda por confirmar, con el canal `panel`, y los datos del
 * comprador, si los hay, van a su sobre cifrado.
 *
 * Las combinaciones se buscan por el nombre del producto, de a 50: con la tienda llena eran 12.000
 * casillas en una pantalla (bitácora tienda3 21). Lo que ya lleva cantidad no se pierde al buscar
 * otra cosa: sube a «En el pedido».
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { cuantosSeVen, enPesos, opNueva, rutaDeInventario, unirSinRepetir } from '../catalogo.ts';
import { Texto } from '../componentes/index.ts';
import {
  crearTurno,
  FORMAS_ANOTADAS,
  FORMAS_DE_PAGO,
  type FormularioDeAnotado,
  revisarAnotado,
} from '../pedidos.ts';
import { irA } from '../ruta.ts';
import type { FilaDeInventario, PaginaDeInventario } from './Inventario.tsx';

type Error = { campo: string; mensaje: string };

export function Anotar({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  // Lo que se ve ahora (la búsqueda, de a 50) y todo lo que se ha visto, por su precio y su nombre.
  const [combinaciones, setCombinaciones] = useState<FilaDeInventario[] | null>(null);
  const [conocidas, setConocidas] = useState<Record<string, FilaDeInventario>>({});
  const [buscar, setBuscar] = useState('');
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const turno = useRef(crearTurno());
  const [falla, setFalla] = useState<string | null>(null);
  const [f, setF] = useState<FormularioDeAnotado>({
    cantidades: {},
    formaPago: '',
    envio: '',
    nombre: '',
    celular: '',
    direccion: '',
    ciudad: '',
    notas: '',
  });
  const [errores, setErrores] = useState<Error[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());

  const cargar = useCallback(
    async (q: string, cursor: string | null = null) => {
      const t = turno.current.tomar();
      const r = await pedirAlPanel<PaginaDeInventario>(conexion, rutaDeInventario({ q, cursor }));
      if (!turno.current.vigente(t)) return;
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return setFalla(r.motivo);
      setSiguiente(r.datos.siguiente ?? null);
      setTotal(r.datos.total ?? r.datos.filas.length);
      setConocidas((antes) => ({
        ...antes,
        ...Object.fromEntries(r.datos.filas.map((c) => [c.variante, c])),
      }));
      setCombinaciones((antes) =>
        cursor && antes ? unirSinRepetir(antes, r.datos.filas, (c) => c.variante) : r.datos.filas,
      );
    },
    [conexion, alVencer],
  );
  useEffect(() => {
    const t = setTimeout(() => void cargar(buscar.trim()), buscar ? 250 : 0);
    return () => clearTimeout(t);
  }, [cargar, buscar]);

  const campo =
    (c: Exclude<keyof FormularioDeAnotado, 'cantidades'>) =>
    (v: string): void =>
      setF((x) => ({ ...x, [c]: v }));
  const error = (c: string) => errores.find((e) => e.campo === c)?.mensaje;
  const revisado = revisarAnotado(f);
  const precio = new Map(Object.values(conocidas).map((c) => [c.variante, c.precioCop]));
  // Lo que ya lleva cantidad y la búsqueda de ahora no muestra.
  const enElPedido = Object.entries(f.cantidades)
    .filter(([v, n]) => n.trim() !== '' && !combinaciones?.some((c) => c.variante === v))
    .map(([v]) => conocidas[v])
    .filter((c): c is FilaDeInventario => c !== undefined);
  const casilla = (c: FilaDeInventario) => (
    <Texto
      key={c.variante}
      id={`cantidad-${c.variante}`}
      etiqueta={`${c.nombre}${c.combinacion ? ` · ${c.combinacion}` : ''} · ${enPesos(c.precioCop)}`}
      valor={f.cantidades[c.variante] ?? ''}
      alCambiar={(v) => setF((x) => ({ ...x, cantidades: { ...x.cantidades, [c.variante]: v } }))}
      error={error(`cantidad-${c.variante}`)}
      opcional
      numerico
    />
  );
  const subtotal = revisado.cuerpo.lineas.reduce(
    (s, l) => s + (precio.get(l.variante) ?? 0) * l.cantidad,
    0,
  );

  const enviar = async (e: Event) => {
    e.preventDefault();
    setErrores(revisado.errores);
    if (revisado.errores.length) return;
    setOcupado(true);
    const r = await pedirAlPanel<{ id: string }>(conexion, 'pedidos/anotar', {
      cuerpo: { op: op.current, ...revisado.cuerpo },
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      op.current = opNueva();
      return setErrores(r.problemas ?? [{ campo: 'productos', mensaje: r.motivo }]);
    }
    irA(`/pedidos/${encodeURIComponent(r.datos.id)}/`);
  };

  if (!combinaciones)
    return (
      <main class="contenido" role={falla ? undefined : 'status'}>
        {falla ? (
          <Aviso tono="peligro" titulo="No pudimos leer tus productos">
            {falla}
          </Aviso>
        ) : (
          'Leyendo tus productos…'
        )}
      </main>
    );

  return (
    <main class="contenido">
      <p>
        <a href="/pedidos/">Pedidos</a>
      </p>
      <h1>Anotar un pedido</h1>
      <p class="nota">
        El que te llegó por teléfono o en persona. Queda por confirmar, como los de la tienda.
      </p>
      <form class="formulario" onSubmit={(e) => void enviar(e)} noValidate>
        <ResumenDeErrores errores={errores} />
        <fieldset class="ed1-grupo" id="productos">
          <legend class="ed1-grupo__titulo">¿Qué lleva?</legend>
          {enElPedido.length > 0 ? (
            <fieldset class="ed1-grupo">
              <legend class="ed1-grupo__titulo">En el pedido</legend>
              {enElPedido.map(casilla)}
            </fieldset>
          ) : null}
          <div class="ed1-campo">
            <label class="ed1-campo__etiqueta" for="buscar-producto">
              Busca el producto por nombre
            </label>
            <input
              class="ed1-campo__control"
              id="buscar-producto"
              type="search"
              value={buscar}
              onInput={(e) => setBuscar((e.target as HTMLInputElement).value)}
              // Enter busca; no manda el pedido.
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
            />
          </div>
          {combinaciones.length === 0 ? (
            <p>
              {buscar.trim()
                ? `Ningún producto se llama «${buscar.trim()}».`
                : 'Todavía no tienes productos a la venta.'}
            </p>
          ) : (
            combinaciones.map(casilla)
          )}
          {cuantosSeVen(combinaciones.length, total, 'combinaciones') ? (
            <p class="nota">{cuantosSeVen(combinaciones.length, total, 'combinaciones')}</p>
          ) : null}
          {siguiente !== null ? (
            <button
              class="ed1-boton ed1-boton--secundario"
              type="button"
              onClick={() => void cargar(buscar.trim(), siguiente)}
            >
              Ver más combinaciones
            </button>
          ) : null}
        </fieldset>
        <div class={`ed1-campo${error('formaPago') ? ' ed1-campo--con-error' : ''}`}>
          <label class="ed1-campo__etiqueta" for="formaPago">
            Cómo paga
          </label>
          <select
            class="ed1-campo__control"
            id="formaPago"
            value={f.formaPago}
            aria-invalid={error('formaPago') ? 'true' : undefined}
            aria-describedby={error('formaPago') ? 'formaPago-error' : undefined}
            onChange={(e) => campo('formaPago')((e.target as HTMLSelectElement).value)}
          >
            <option value="">Elige</option>
            {FORMAS_ANOTADAS.map((id) => (
              <option key={id} value={id}>
                {FORMAS_DE_PAGO[id] ?? id}
              </option>
            ))}
          </select>
          {error('formaPago') ? (
            <p class="ed1-campo__error" id="formaPago-error">
              {error('formaPago')}
            </p>
          ) : null}
        </div>
        <Texto
          id="envio"
          etiqueta="Envío"
          valor={f.envio}
          alCambiar={campo('envio')}
          error={error('envio')}
          opcional
          numerico
        />
        <fieldset class="ed1-grupo">
          <legend class="ed1-grupo__titulo">Comprador</legend>
          <p class="nota">Se guardan cifrados; en la bandeja salen tapados.</p>
          <Texto
            id="nombre"
            etiqueta="Nombre"
            valor={f.nombre}
            alCambiar={campo('nombre')}
            opcional
          />
          <Texto
            id="celular"
            etiqueta="Celular"
            valor={f.celular}
            alCambiar={campo('celular')}
            opcional
            numerico
          />
          <Texto
            id="direccion"
            etiqueta="Dirección"
            valor={f.direccion}
            alCambiar={campo('direccion')}
            opcional
          />
          <Texto
            id="ciudad"
            etiqueta="Ciudad"
            valor={f.ciudad}
            alCambiar={campo('ciudad')}
            opcional
          />
          <Texto
            id="notas"
            etiqueta="Indicaciones para la entrega"
            valor={f.notas}
            alCambiar={campo('notas')}
            opcional
          />
        </fieldset>
        <p class="cifra">
          Total:{' '}
          {enPesos(
            subtotal +
              (revisado.errores.some((e) => e.campo === 'envio') ? 0 : revisado.cuerpo.envioCop),
          )}
        </p>
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Anotar el pedido
        </button>
      </form>
    </main>
  );
}
