/**
 * Las solicitudes (HU-T9.7, TIENDA-3.0 §8.6): las que esperan respuesta van primero, la que venció
 * arriba y en rojo; el retracto cuenta el reembolso, y un pago aprobado sin existencias, el suyo.
 * Abrir una dice lo que contó la persona y queda en el registro; responder la deja respondida y
 * ofrece mandarla por donde dejó el contacto; cerrar pide la respuesta antes.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { opNueva } from '../catalogo.ts';
import { Confirmar } from '../componentes/index.ts';
import {
  type Solicitudes as Datos,
  type DetalleDeSolicitud,
  ESTADOS_DE_SOLICITUD,
  enFecha,
  envioDeLaRespuesta,
  type FilaDeSolicitud,
  mensajeDeRespuesta,
  revisarRespuesta,
  vencimientoEnPalabras,
} from '../solicitudes.ts';

const abierta = (f: FilaDeSolicitud) => f.estado === 'radicada' || f.estado === 'en_tramite';

function EstadoDeSolicitud({ f }: { f: FilaDeSolicitud }) {
  const e = ESTADOS_DE_SOLICITUD[f.estado] ?? { texto: f.estado, tono: 'neutro' };
  return <span class={`estado estado--${e.tono}`}>{e.texto}</span>;
}

function Vence({ f }: { f: FilaDeSolicitud }) {
  const v = vencimientoEnPalabras(f, f.reloj === 'reembolso' ? 'reembolsar' : 'responder');
  return <span class={`vence vence--${v.tono}`}>{v.texto}</span>;
}

function Fila({ f }: { f: FilaDeSolicitud }) {
  return (
    <li class={f.alerta === 'vencida' ? 'solicitud solicitud--vencida' : 'solicitud'}>
      <a href={`/pedidos/solicitudes/${encodeURIComponent(f.id)}/`}>
        <span class="cifra">{f.radicado}</span> · {f.tipo}
      </a>
      <EstadoDeSolicitud f={f} />
      <span class="fila__detalle">
        {abierta(f) ? (
          <Vence f={f} />
        ) : f.cerrada ? (
          `Cerrada el ${enFecha(f.cerrada.slice(0, 10))}`
        ) : (
          `Respondida el ${enFecha((f.respondida ?? f.vence).slice(0, 10))}`
        )}
        {f.pedido ? ` · pedido #${f.pedido}` : ''}
        {f.reloj === 'reembolso' && abierta(f) ? ' · retracto: el reembolso corre' : ''}
      </span>
    </li>
  );
}

export function Solicitudes({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<Datos>(conexion, 'solicitudes');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return setError(r.motivo);
      setDatos(r.datos);
    })();
  }, [conexion, alVencer]);

  if (!datos)
    return (
      <main class="contenido" role={error ? undefined : 'status'}>
        {error ? (
          <Aviso tono="peligro" titulo="No pudimos leer las solicitudes">
            {error}
          </Aviso>
        ) : (
          'Leyendo las solicitudes…'
        )}
      </main>
    );

  const porResponder = datos.solicitudes.filter(abierta);
  const vencidas = porResponder.filter((f) => f.alerta === 'vencida').length;
  const respondidas = datos.solicitudes.filter((f) => f.estado === 'respondida');
  const cerradas = datos.solicitudes.filter((f) => f.estado === 'cerrada');

  return (
    <main class="contenido">
      <p>
        <a href="/pedidos/">Pedidos</a>
      </p>
      <h1>Solicitudes</h1>
      <p class="nota">
        Las quejas, reclamos, retractos y consultas de datos que llegan con radicado. La ley pone el
        plazo para responder.
      </p>
      {vencidas ? (
        <Aviso
          tono="peligro"
          titulo={vencidas === 1 ? 'Una solicitud venció' : `${vencidas} solicitudes vencieron`}
        >
          Respóndelas hoy: el plazo de la ley ya pasó.
        </Aviso>
      ) : null}

      {datos.reembolsos.length ? (
        <section aria-labelledby="reembolsos-titulo">
          <h2 id="reembolsos-titulo">Pagos sin existencias</h2>
          <p class="nota">
            Se aprobó el pago cuando ya no había unidades: repón el producto o devuelve la plata
            dentro de 15 días.
          </p>
          <ul class="lineas">
            {datos.reembolsos.map((r) => {
              const v = vencimientoEnPalabras(r, 'reembolsar');
              return (
                <li
                  key={r.pedidoId}
                  class={r.alerta === 'vencida' ? 'solicitud solicitud--vencida' : 'solicitud'}
                >
                  <a href={`/pedidos/${encodeURIComponent(r.pedidoId)}/`}>Pedido #{r.pedido}</a>
                  <span class={`vence vence--${v.tono}`}>{v.texto}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <h2>Por responder</h2>
      {porResponder.length === 0 ? (
        <p>No hay solicitudes esperando respuesta.</p>
      ) : (
        <ul class="lineas">
          {porResponder.map((f) => (
            <Fila key={f.id} f={f} />
          ))}
        </ul>
      )}

      {respondidas.length ? (
        <>
          <h2>Respondidas</h2>
          <p class="nota">Ciérralas cuando la persona quede atendida.</p>
          <ul class="lineas">
            {respondidas.map((f) => (
              <Fila key={f.id} f={f} />
            ))}
          </ul>
        </>
      ) : null}

      {cerradas.length ? (
        <>
          <h2>Cerradas</h2>
          <ul class="lineas">
            {cerradas.map((f) => (
              <Fila key={f.id} f={f} />
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}

export function Solicitud({
  conexion,
  id,
  alVencer,
}: {
  conexion: Conexion;
  id: string;
  alVencer: (motivo: string) => void;
}) {
  const [detalle, setDetalle] = useState<DetalleDeSolicitud | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const op = useRef(opNueva());

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<DetalleDeSolicitud>(conexion, 'solicitudes/ver', {
      cuerpo: { id },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.motivo);
    setError(null);
    setDetalle(r.datos);
  }, [conexion, id, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (!detalle)
    return (
      <main class="contenido" role={error ? undefined : 'status'}>
        <p>
          <a href="/pedidos/solicitudes/">Solicitudes</a>
        </p>
        {error ? (
          <Aviso tono="peligro" titulo="No pudimos abrir la solicitud">
            {error}
          </Aviso>
        ) : (
          'Abriendo la solicitud…'
        )}
      </main>
    );

  const f = detalle.solicitud;
  const guardar = async (e: Event) => {
    e.preventDefault();
    const revisados = revisarRespuesta(respuesta);
    setErrores(revisados);
    if (revisados.length) return;
    setOcupado(true);
    const r = await pedirAlPanel(conexion, 'solicitudes/responder', {
      cuerpo: { op: op.current, id, respuesta: respuesta.trim() },
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    op.current = opNueva();
    if (r.tipo !== 'ok') {
      setErrores(r.problemas?.length ? r.problemas : [{ campo: 'respuesta', mensaje: r.motivo }]);
      return cargar();
    }
    setAviso('Respuesta guardada. Ahora mándasela a la persona.');
    setRespuesta('');
    await cargar();
  };
  const cerrar = async () => {
    const r = await pedirAlPanel(conexion, 'solicitudes/cerrar', {
      cuerpo: { op: opNueva(), id },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setAviso(null);
      setErrores(r.problemas?.length ? r.problemas : [{ campo: 'solicitud', mensaje: r.motivo }]);
      return;
    }
    setErrores([]);
    setAviso('Solicitud cerrada.');
    await cargar();
  };

  const envio = detalle.respuesta
    ? envioDeLaRespuesta(detalle.contacto, f.radicado, detalle.respuesta.texto)
    : null;

  return (
    <main class="contenido">
      <p>
        <a href="/pedidos/solicitudes/">Solicitudes</a>
      </p>
      <h1 id="solicitud">
        <span class="cifra">{f.radicado}</span> · {f.tipo}
      </h1>
      <p>
        <EstadoDeSolicitud f={f} /> {abierta(f) ? <Vence f={f} /> : null}
      </p>
      {aviso ? (
        <Aviso tono="info" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      <ResumenDeErrores errores={errores.filter((x) => x.campo !== 'respuesta')} />

      <dl class="datos">
        <div>
          <dt>Llegó</dt>
          <dd>{enFecha(f.creada.slice(0, 10))}</dd>
        </div>
        <div>
          <dt>Contacto</dt>
          <dd>{detalle.contacto}</dd>
        </div>
        {detalle.codigoDelPedido ? (
          <div>
            <dt>Pedido</dt>
            <dd class="cifra">
              {f.pedido ? `#${f.pedido} · ` : ''}
              {detalle.codigoDelPedido}
            </dd>
          </div>
        ) : null}
      </dl>
      <h2>Lo que contó</h2>
      <p class="mensaje">{detalle.texto}</p>
      {f.reloj === 'reembolso' && abierta(f) ? (
        <p class="nota">
          Es un retracto: devuelve la plata dentro de 15 días calendario, hasta el{' '}
          {enFecha(f.vence)}.
        </p>
      ) : null}

      <h2>Respuesta</h2>
      {detalle.respuesta ? (
        <>
          <pre class="mensaje">{mensajeDeRespuesta(f.radicado, detalle.respuesta.texto)}</pre>
          {envio ? (
            <a
              class="ed1-boton ed1-boton--primario"
              href={envio.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {envio.por === 'whatsapp' ? 'Mandarla por WhatsApp' : 'Mandarla por correo'}
            </a>
          ) : (
            <p class="nota">
              El contacto no es un celular ni un correo: copia la respuesta y mándasela por donde
              puedas.
            </p>
          )}
          {f.estado === 'respondida' ? (
            <section class="acciones">
              <Confirmar
                abrir="Cerrar la solicitud"
                consecuencia="La persona quedó atendida. La solicitud se cierra y ya no se puede responder."
                confirmar="Sí, cerrarla"
                alConfirmar={cerrar}
              />
            </section>
          ) : null}
        </>
      ) : (
        <form class="formulario" onSubmit={(e) => void guardar(e)} noValidate>
          <ResumenDeErrores errores={errores.filter((x) => x.campo === 'respuesta')} />
          <div class="ed1-campo">
            <label class="ed1-campo__etiqueta" for="respuesta">
              Tu respuesta
            </label>
            <p class="ed1-campo__ayuda" id="respuesta-ayuda">
              Qué vas a hacer y cuándo. Primero se guarda; después la mandas.
            </p>
            {errores.find((x) => x.campo === 'respuesta') ? (
              <p class="ed1-campo__error" id="respuesta-error">
                {errores.find((x) => x.campo === 'respuesta')?.mensaje}
              </p>
            ) : null}
            <textarea
              class="ed1-campo__control"
              id="respuesta"
              rows={5}
              value={respuesta}
              aria-invalid={errores.some((x) => x.campo === 'respuesta') ? 'true' : undefined}
              aria-describedby={
                errores.some((x) => x.campo === 'respuesta')
                  ? 'respuesta-ayuda respuesta-error'
                  : 'respuesta-ayuda'
              }
              onInput={(e) => setRespuesta((e.target as HTMLTextAreaElement).value)}
            />
          </div>
          <button
            class="ed1-boton ed1-boton--primario"
            type="submit"
            disabled={ocupado}
            aria-busy={ocupado ? 'true' : undefined}
          >
            Guardar la respuesta
          </button>
          <p class="nota">Una solicitud no se cierra sin respuesta.</p>
        </form>
      )}
    </main>
  );
}
