/**
 * HU-T10.1: envíos y cupones. La lista dice cada envío con el plazo que verá el comprador y cada
 * cupón en palabras, con sus usos; un envío de más de 30 días calendario lo avisa antes de guardar
 * (Ley 2439) y un cupón agotado lo dice.
 */
import { Aviso, ResumenDeErrores, Tarjeta } from '@ed1/ui/v2/componentes';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos, opNueva } from '../catalogo.ts';
import { Casilla, Confirmar, Texto } from '../componentes/index.ts';
import { irA } from '../ruta.ts';
import {
  type CuponDelPanel,
  cuponEnPalabras,
  type EnvioDelPanel,
  type FormularioDeCupon,
  type FormularioDeEnvio,
  formularioDeCupon,
  formularioDeEnvio,
  PLAZO_DE_LEY_DIAS,
  pasaDeLaLey,
  revisarCupon,
  revisarEnvio,
} from '../venta.ts';

type Error = { campo: string; mensaje: string };
type Datos = { envios: EnvioDelPanel[]; cupones: CuponDelPanel[] };

/** El campo de la API es el del formulario, salvo los que llevan la unidad en el nombre. */
const CAMPOS: Record<string, string> = {
  precioCop: 'precio',
  gratisDesdeCop: 'gratisDesde',
  minimoCop: 'minimo',
};
const delFormulario = (problemas: Error[]) =>
  problemas.map((p) => ({ ...p, campo: CAMPOS[p.campo] ?? p.campo }));

function usarVenta(conexion: Conexion, alVencer: (motivo: string) => void) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<Datos>(conexion, 'venta');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return setFalla(r.motivo);
      setDatos(r.datos);
    })();
  }, [conexion, alVencer]);
  return { datos, falla };
}

function Leyendo({ falla }: { falla: string | null }) {
  return (
    <main class="contenido" role={falla ? undefined : 'status'}>
      {falla ? (
        <Aviso tono="peligro" titulo="No pudimos leer los envíos y los cupones">
          {falla}
        </Aviso>
      ) : (
        'Leyendo los envíos y los cupones…'
      )}
    </main>
  );
}

const enPalabras = (e: EnvioDelPanel) =>
  [
    e.precioCop === 0 ? 'Gratis' : enPesos(e.precioCop),
    e.gratisDesdeCop !== null && e.precioCop > 0
      ? `gratis desde ${enPesos(e.gratisDesdeCop)}`
      : null,
    e.ciudades ? `en ${e.ciudades.join(', ')}` : 'en todas las ciudades',
    e.plazo,
    e.activa ? null : 'apagado',
  ]
    .filter(Boolean)
    .join(' · ');

export function Venta({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const { datos, falla } = usarVenta(conexion, alVencer);
  if (!datos) return <Leyendo falla={falla} />;
  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Envíos y cupones</h1>
      <h2>Envíos</h2>
      <p class="nota">El comprador ve cada uno con su precio y su plazo antes de pedir.</p>
      {datos.envios.length === 0 ? (
        <p>Todavía no tienes envíos: la tienda dice que el envío se acuerda contigo.</p>
      ) : (
        <ul class="lineas">
          {datos.envios.map((e) => (
            <li key={e.id}>
              <span>
                <a href={`/mas/venta/envios/${encodeURIComponent(e.id)}/`}>{e.nombre}</a>
                <span class="fila__detalle"> · {enPalabras(e)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a class="ed1-boton ed1-boton--secundario" href="/mas/venta/envios/nuevo/">
          Agregar un envío
        </a>
      </p>
      <h2>Cupones</h2>
      <p class="nota">
        Un uso cuenta cuando confirmas el pedido o se paga; si lo cancelas, vuelve.
      </p>
      {datos.cupones.length === 0 ? (
        <p>Todavía no tienes cupones.</p>
      ) : (
        <ul class="lineas">
          {datos.cupones.map((c) => (
            <li key={c.codigo}>
              <span>
                <a href={`/mas/venta/cupones/${encodeURIComponent(c.codigo)}/`}>{c.codigo}</a>
                <span class="fila__detalle"> · {cuponEnPalabras(c)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        <a class="ed1-boton ed1-boton--secundario" href="/mas/venta/cupones/nuevo/">
          Crear un cupón
        </a>
      </p>
    </main>
  );
}

/** Guardar o borrar, con su `op`: si falla, la siguiente vez es otra operación. */
function usarEscritura(conexion: Conexion, alVencer: (motivo: string) => void) {
  const [errores, setErrores] = useState<Error[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());
  const escribir = async (ruta: string, cuerpo: object, campo: string): Promise<boolean> => {
    setOcupado(true);
    const r = await pedirAlPanel(conexion, ruta, { cuerpo: { op: op.current, ...cuerpo } });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') {
      alVencer(r.motivo);
      return false;
    }
    if (r.tipo !== 'ok') {
      op.current = opNueva();
      setErrores(delFormulario(r.problemas ?? [{ campo, mensaje: r.motivo }]));
      return false;
    }
    irA('/mas/venta/');
    return true;
  };
  return { errores, setErrores, ocupado, escribir };
}

export function EnvioDeLaTienda({
  conexion,
  id,
  alVencer,
}: {
  conexion: Conexion;
  /** `null`: uno nuevo. */
  id: string | null;
  alVencer: (motivo: string) => void;
}) {
  const { datos, falla } = usarVenta(conexion, alVencer);
  const actual = datos?.envios.find((e) => e.id === id) ?? null;
  const [f, setF] = useState<FormularioDeEnvio | null>(null);
  const { errores, setErrores, ocupado, escribir } = usarEscritura(conexion, alVencer);
  useEffect(() => {
    if (datos && !f) setF(formularioDeEnvio(actual));
  }, [datos, actual, f]);

  if (!datos || !f) return <Leyendo falla={falla} />;
  if (id && !actual)
    return (
      <main class="contenido">
        <p>
          <a href="/mas/venta/">Envíos y cupones</a>
        </p>
        <h1>Ese envío ya no está</h1>
      </main>
    );
  const campo =
    (c: Exclude<keyof FormularioDeEnvio, 'activa'>) =>
    (v: string): void =>
      setF((x) => (x ? { ...x, [c]: v } : x));
  const error = (c: string) => errores.find((e) => e.campo === c)?.mensaje;

  const guardar = async (e: Event) => {
    e.preventDefault();
    const r = revisarEnvio(f);
    setErrores(r.errores);
    if (r.errores.length) return;
    await escribir(
      'envios/guardar',
      { ...r.cuerpo, ...(actual ? { id: actual.id, version: actual.version } : {}) },
      'nombre',
    );
  };

  return (
    <main class="contenido">
      <p>
        <a href="/mas/venta/">Envíos y cupones</a>
      </p>
      <h1>{actual ? actual.nombre : 'Un envío nuevo'}</h1>
      <form class="formulario" onSubmit={(e) => void guardar(e)} noValidate>
        <ResumenDeErrores errores={errores} />
        <Texto
          id="nombre"
          etiqueta="Nombre"
          valor={f.nombre}
          alCambiar={campo('nombre')}
          error={error('nombre')}
          ayuda="Como lo verá el comprador: «Medellín», «Nacional», «Recoger en el local»."
        />
        <Texto
          id="precio"
          etiqueta="Precio"
          valor={f.precio}
          alCambiar={campo('precio')}
          error={error('precio')}
          ayuda="En pesos. 0 si es gratis."
          numerico
        />
        <Texto
          id="gratisDesde"
          etiqueta="Gratis en compras desde"
          valor={f.gratisDesde}
          alCambiar={campo('gratisDesde')}
          error={error('gratisDesde')}
          opcional
          numerico
        />
        <Texto
          id="ciudades"
          etiqueta="Ciudades"
          valor={f.ciudades}
          alCambiar={campo('ciudades')}
          error={error('ciudades')}
          ayuda="Separadas por coma. Vacío: a todas."
          opcional
        />
        <Texto
          id="diasMin"
          etiqueta="Llega en, como mínimo (días)"
          valor={f.diasMin}
          alCambiar={campo('diasMin')}
          error={error('diasMin')}
          opcional
          numerico
        />
        <Texto
          id="diasMax"
          etiqueta="Llega en, como máximo (días)"
          valor={f.diasMax}
          alCambiar={campo('diasMax')}
          error={error('diasMax')}
          numerico
        />
        {pasaDeLaLey(f) ? (
          <Aviso tono="aviso" titulo={`Pasa de ${PLAZO_DE_LEY_DIAS} días calendario`}>
            Sin otro acuerdo, la ley pide entregar en máximo {PLAZO_DE_LEY_DIAS} días calendario
            (Ley 2439). La tienda le dirá al comprador este plazo en días calendario, y que lo
            acepta al pedir.
          </Aviso>
        ) : null}
        <Casilla
          id="activa"
          etiqueta="Se ofrece en la tienda"
          marcada={f.activa}
          alCambiar={(v) => setF((x) => (x ? { ...x, activa: v } : x))}
        />
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Guardar el envío
        </button>
      </form>
      {actual ? (
        <Confirmar
          abrir="Borrar este envío"
          consecuencia="Sale de la tienda en la próxima publicación. Los pedidos que ya lo usaron lo conservan."
          confirmar="Sí, borrar el envío"
          alConfirmar={async () => {
            await escribir('envios/borrar', { id: actual.id, version: actual.version }, 'nombre');
          }}
        />
      ) : null}
    </main>
  );
}

const TIPOS: { id: CuponDelPanel['tipo']; texto: string }[] = [
  { id: 'porcentaje', texto: 'Un porcentaje' },
  { id: 'valor', texto: 'Un valor en pesos' },
  { id: 'envio_gratis', texto: 'El envío' },
];

export function CuponDeLaTienda({
  conexion,
  codigo,
  alVencer,
}: {
  conexion: Conexion;
  /** `null`: uno nuevo. */
  codigo: string | null;
  alVencer: (motivo: string) => void;
}) {
  const { datos, falla } = usarVenta(conexion, alVencer);
  const actual = datos?.cupones.find((c) => c.codigo === codigo) ?? null;
  const [f, setF] = useState<FormularioDeCupon | null>(null);
  const { errores, setErrores, ocupado, escribir } = usarEscritura(conexion, alVencer);
  useEffect(() => {
    if (datos && !f) setF(formularioDeCupon(actual));
  }, [datos, actual, f]);

  if (!datos || !f) return <Leyendo falla={falla} />;
  if (codigo && !actual)
    return (
      <main class="contenido">
        <p>
          <a href="/mas/venta/">Envíos y cupones</a>
        </p>
        <h1>Ese cupón ya no está</h1>
      </main>
    );
  const campo =
    (c: Exclude<keyof FormularioDeCupon, 'activo' | 'tipo'>) =>
    (v: string): void =>
      setF((x) => (x ? { ...x, [c]: v } : x));
  const error = (c: string) => errores.find((e) => e.campo === c)?.mensaje;

  const guardar = async (e: Event) => {
    e.preventDefault();
    const r = revisarCupon(f, actual?.usos ?? 0);
    setErrores(r.errores);
    if (r.errores.length) return;
    await escribir(
      'cupones/guardar',
      { ...r.cuerpo, ...(actual ? { codigo: actual.codigo, version: actual.version } : {}) },
      'codigo',
    );
  };

  return (
    <main class="contenido">
      <p>
        <a href="/mas/venta/">Envíos y cupones</a>
      </p>
      <h1>{actual ? `Cupón ${actual.codigo}` : 'Un cupón nuevo'}</h1>
      {actual ? (
        <Tarjeta titulo="Cómo va">
          <p>{cuponEnPalabras(actual)}</p>
        </Tarjeta>
      ) : null}
      <form class="formulario" onSubmit={(e) => void guardar(e)} noValidate>
        <ResumenDeErrores errores={errores} />
        <Texto
          id="codigo"
          etiqueta="Código"
          valor={f.codigo}
          alCambiar={campo('codigo')}
          error={error('codigo')}
          ayuda="El que escribe el comprador, como BIENVENIDA. Va en mayúsculas."
          deshabilitado={actual !== null}
        />
        <fieldset
          class={`ed1-grupo${error('tipo') ? ' ed1-campo--con-error' : ''}`}
          id="tipo"
          aria-describedby={error('tipo') ? 'tipo-error' : undefined}
        >
          <legend class="ed1-grupo__titulo">¿Qué descuenta?</legend>
          {TIPOS.map((t) => (
            <label class="casilla" for={`tipo-${t.id}`} key={t.id}>
              <input
                id={`tipo-${t.id}`}
                type="radio"
                name="tipo"
                checked={f.tipo === t.id}
                onChange={() => setF((x) => (x ? { ...x, tipo: t.id } : x))}
              />
              {t.texto}
            </label>
          ))}
          {error('tipo') ? (
            <p class="ed1-campo__error" id="tipo-error">
              {error('tipo')}
            </p>
          ) : null}
        </fieldset>
        {f.tipo === 'porcentaje' || f.tipo === 'valor' ? (
          <Texto
            id="valor"
            etiqueta={f.tipo === 'porcentaje' ? 'Porcentaje' : 'Valor en pesos'}
            valor={f.valor}
            alCambiar={campo('valor')}
            error={error('valor')}
            numerico
          />
        ) : null}
        <Texto
          id="minimo"
          etiqueta="Compra mínima"
          valor={f.minimo}
          alCambiar={campo('minimo')}
          error={error('minimo')}
          opcional
          numerico
        />
        <Texto
          id="desde"
          etiqueta="Vale desde"
          valor={f.desde}
          alCambiar={campo('desde')}
          error={error('desde')}
          opcional
          fecha
        />
        <Texto
          id="hasta"
          etiqueta="Vale hasta"
          valor={f.hasta}
          alCambiar={campo('hasta')}
          error={error('hasta')}
          ayuda="Incluido ese día, hasta la medianoche."
          opcional
          fecha
        />
        <Texto
          id="usosMaximos"
          etiqueta="Cuántas veces se puede usar"
          valor={f.usosMaximos}
          alCambiar={campo('usosMaximos')}
          error={error('usosMaximos')}
          ayuda="Cuenta los pedidos confirmados o pagados. Vacío: sin tope."
          opcional
          numerico
        />
        <Casilla
          id="activo"
          etiqueta="Se puede usar en la tienda"
          marcada={f.activo}
          alCambiar={(v) => setF((x) => (x ? { ...x, activo: v } : x))}
        />
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Guardar el cupón
        </button>
      </form>
      {actual ? (
        <Confirmar
          abrir="Borrar este cupón"
          consecuencia="Deja de valer en la tienda. Los pedidos que ya lo usaron conservan su descuento."
          confirmar="Sí, borrar el cupón"
          alConfirmar={async () => {
            await escribir(
              'cupones/borrar',
              { codigo: actual.codigo, version: actual.version },
              'codigo',
            );
          }}
        />
      ) : null}
    </main>
  );
}
