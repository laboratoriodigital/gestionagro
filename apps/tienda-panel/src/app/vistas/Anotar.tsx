/**
 * Anotar un pedido (HU-T9.6 CA1): el que llegó por teléfono o en persona. Las combinaciones salen
 * del inventario con su precio de hoy; queda por confirmar, con el canal `panel`, y los datos del
 * comprador, si los hay, van a su sobre cifrado.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos, opNueva } from '../catalogo.ts';
import { Texto } from '../componentes/index.ts';
import {
  FORMAS_ANOTADAS,
  FORMAS_DE_PAGO,
  type FormularioDeAnotado,
  revisarAnotado,
} from '../pedidos.ts';
import { irA } from '../ruta.ts';
import type { FilaDeInventario } from './Inventario.tsx';

type Error = { campo: string; mensaje: string };

export function Anotar({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [combinaciones, setCombinaciones] = useState<FilaDeInventario[] | null>(null);
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

  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<{ filas: FilaDeInventario[] }>(conexion, 'inventario');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return setFalla(r.motivo);
      setCombinaciones(r.datos.filas);
    })();
  }, [conexion, alVencer]);

  const campo =
    (c: Exclude<keyof FormularioDeAnotado, 'cantidades'>) =>
    (v: string): void =>
      setF((x) => ({ ...x, [c]: v }));
  const error = (c: string) => errores.find((e) => e.campo === c)?.mensaje;
  const revisado = revisarAnotado(f);
  const precio = new Map((combinaciones ?? []).map((c) => [c.variante, c.precioCop]));
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
          {combinaciones.length === 0 ? (
            <p>Todavía no tienes productos a la venta.</p>
          ) : (
            combinaciones.map((c) => (
              <Texto
                key={c.variante}
                id={`cantidad-${c.variante}`}
                etiqueta={`${c.nombre}${c.combinacion ? ` · ${c.combinacion}` : ''} · ${enPesos(c.precioCop)}`}
                valor={f.cantidades[c.variante] ?? ''}
                alCambiar={(v) =>
                  setF((x) => ({ ...x, cantidades: { ...x.cantidades, [c.variante]: v } }))
                }
                error={error(`cantidad-${c.variante}`)}
                opcional
                numerico
              />
            ))
          )}
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
