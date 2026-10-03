/**
 * Planes con precio visible y lista de espera (HU-E0.6). Qué trae cada plan y cuánto costará, con
 * el precio marcado como tentativo (CA2). «Me interesa» deja la señal en el CORE sin cobrar ni
 * pedir tarjeta (CA1); lo toca quien administra la finca, que es quien decidiría.
 *
 * Esta pantalla no se impone: no está en el menú, se llega por enlaces desde Cuenta y desde los
 * avisos de «viene con el plan…», y nunca sale como ventana durante el registro (CA4, ED1 §28).
 *
 * Pagar en línea (HU-E0.7): el propietario paga un mes del plan con Bold. Al volver, la pantalla
 * le pide al CORE que confirme con Bold y, aprobado, renueva la sesión para traer el plan nuevo.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  abrirCheckout,
  cobroMensual,
  confirmarCobro,
  crearCobro,
  diasParaVencer,
  ordenDeLaVuelta,
  pesos,
  type RespuestaDelPago,
} from '../almacen/pago.ts';
import {
  AVISO_PRECIO,
  CON_ESPERA,
  marcarInteres,
  PLANES,
  planesMarcados,
} from '../almacen/planes.ts';
import {
  ErrorDeSesion,
  leerSesion,
  planDeLaFinca,
  renovarSiHaceFalta,
  rolEnLaFinca,
  urlDelCore,
  vencimientoDelPlan,
} from '../almacen/sesion.ts';
import { fechaCorta } from '../formato.ts';

type Quien = 'cargando' | 'sin-cuenta' | 'sin-finca' | 'no-administra' | 'propietario';

type FaseDelPago =
  | { fase: 'abriendo' | 'confirmando' }
  | { fase: 'respuesta'; orden: string; r: RespuestaDelPago }
  | { fase: 'error'; texto: string; orden: string | null };

/** Un plan que vence en una semana o menos se avisa. */
const DIAS_DE_AVISO = 7;

/** Qué pasó con el pago, en palabras, y cómo seguir. */
function EstadoDelPago({
  pago,
  alVerificar,
}: {
  pago: FaseDelPago;
  alVerificar: (orden: string) => void;
}) {
  if (pago.fase === 'abriendo') return <p role="status">Abriendo el pago…</p>;
  if (pago.fase === 'confirmando') {
    return <p role="status">Estamos confirmando tu pago con Bold…</p>;
  }
  if (pago.fase === 'error') {
    const { orden } = pago;
    return (
      <div role="alert" class="error" data-prueba="pago-estado">
        <p>{pago.texto}</p>
        {orden && (
          <button type="button" class="secundario" onClick={() => alVerificar(orden)}>
            Verificar otra vez
          </button>
        )}
      </div>
    );
  }
  if (pago.fase !== 'respuesta') return null;
  const { r, orden } = pago;
  if (r.estado === 'aprobado') {
    return (
      <p role="status" class="exito" data-prueba="pago-estado">
        ¡Pago confirmado! Tu plan está activo
        {r.plan_vence ? ` hasta el ${fechaCorta(r.plan_vence)}` : ''}. Gracias por confiar en
        nosotros.
      </p>
    );
  }
  return (
    <div
      role="status"
      class={r.estado === 'esperando' ? 'aviso' : 'error'}
      data-prueba="pago-estado"
    >
      <p>{r.motivo ?? 'El pago todavía no se confirma.'}</p>
      {r.estado === 'esperando' && (
        <button type="button" class="secundario" onClick={() => alVerificar(orden)}>
          Verificar ahora
        </button>
      )}
    </div>
  );
}

export function Planes() {
  const [quien, setQuien] = useState<Quien>('cargando');
  const [actual, setActual] = useState('gratuito');
  const [vence, setVence] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState<{ plan: string; texto: string; error: boolean } | null>(
    null,
  );
  const [pago, setPago] = useState<FaseDelPago | null>(null);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const core = urlDelCore(location.hostname);

  /** Pregunta al CORE por el pago y, si se aprobó, renueva la sesión para traer el plan nuevo. */
  const confirmar = async (orden: string) => {
    const db = cuaderno();
    setPago({ fase: 'confirmando' });
    try {
      const r = await confirmarCobro(db, core, orden);
      if (r.estado === 'aprobado') {
        const sesion = await leerSesion(db);
        const renovada = await renovarSiHaceFalta(db, core, {
          org: sesion?.org_id ?? null,
          forzar: true,
        });
        if (renovada.sesion) {
          setActual(planDeLaFinca(renovada.sesion));
          setVence(vencimientoDelPlan(renovada.sesion));
        }
      }
      setPago({ fase: 'respuesta', orden, r });
    } catch (e) {
      setPago({
        fase: 'error',
        orden,
        texto:
          e instanceof ErrorDeSesion
            ? e.message
            : 'No se pudo verificar el pago. Inténtalo otra vez.',
      });
    }
  };

  const pagar = async (plan: string) => {
    setPago({ fase: 'abriendo' });
    try {
      const cobro = await crearCobro(cuaderno(), core, plan, `${location.origin}/agro/app/planes/`);
      await abrirCheckout(cobro);
    } catch (e) {
      setPago({
        fase: 'error',
        orden: null,
        texto:
          e instanceof ErrorDeSesion ? e.message : 'No se pudo abrir el pago. Inténtalo otra vez.',
      });
    }
  };

  useEffect(() => {
    const cambio = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', cambio);
    window.addEventListener('offline', cambio);
    return () => {
      window.removeEventListener('online', cambio);
      window.removeEventListener('offline', cambio);
    };
  }, []);

  useEffect(() => {
    const db = cuaderno();
    // Al volver de Bold, la orden viene en la dirección. Se quita para que recargar no la vuelva a
    // confirmar (aunque el CORE contestaría lo mismo).
    const orden = ordenDeLaVuelta(location.search);
    if (orden) {
      history.replaceState(null, '', location.pathname);
      void confirmar(orden);
    }
    void (async () => {
      const sesion = await leerSesion(db);
      setActual(planDeLaFinca(sesion));
      setVence(vencimientoDelPlan(sesion));
      if (!sesion) return setQuien('sin-cuenta');
      const rol = rolEnLaFinca(sesion);
      if (rol === null) return setQuien('sin-finca');
      if (rol !== 'propietario') return setQuien('no-administra');
      setQuien('propietario');
      // Sin señal no se sabe qué ya marcó: el botón sigue disponible y el CORE no duplica.
      planesMarcados(db, core)
        .then((p) => setMarcados(new Set(p)))
        .catch(() => undefined);
    })();
  }, []);

  const avisar = async (plan: string) => {
    setMensaje(null);
    try {
      await marcarInteres(cuaderno(), core, plan);
      setMarcados(new Set([...marcados, plan]));
      setMensaje({
        plan,
        texto: 'Gracias: quedó anotado. Te contaremos antes de que empiece. No se cobra nada.',
        error: false,
      });
    } catch (e) {
      setMensaje({
        plan,
        texto: e instanceof ErrorDeSesion ? e.message : 'No se pudo avisar. Inténtalo otra vez.',
        error: true,
      });
    }
  };

  const dias = diasParaVencer(vence, Date.now());
  const ocupado = pago?.fase === 'abriendo' || pago?.fase === 'confirmando';

  return (
    <section aria-labelledby="titulo-planes">
      <h1 id="titulo-planes">Planes</h1>
      <p>Lo que trae cada plan y cuánto cuesta.</p>
      {vence && (
        <p
          class={dias !== null && dias <= DIAS_DE_AVISO ? 'aviso' : 'ayuda'}
          data-prueba="plan-vence"
        >
          Tu plan {PLANES.find((p) => p.id === actual)?.nombre ?? actual} vale hasta el{' '}
          {fechaCorta(vence)}.
          {dias !== null &&
            dias <= DIAS_DE_AVISO &&
            ' Renuévalo para no perder lo que trae. Si vence, tu finca vuelve al plan Gratis y no pierdes ningún registro.'}
        </p>
      )}
      {pago && <EstadoDelPago pago={pago} alVerificar={(o) => void confirmar(o)} />}
      <p class="aviso-legal" data-prueba="aviso-precio">
        {AVISO_PRECIO}
      </p>
      <ul class="lista-plana" data-prueba="planes">
        {PLANES.map((p) => {
          const cobro = cobroMensual(p.id);
          return (
            <li key={p.id} data-prueba="plan" data-plan={p.id}>
              <h2 class="area-titulo">
                {p.nombre}
                {p.id === actual && <span class="detalle-insumo"> · tu plan</span>}
              </h2>
              <p class="precio-plan">
                <strong>{p.precio}</strong>
              </p>
              <p class="ayuda">{p.para_quien}</p>
              <ul>
                {p.incluye.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              {cobro !== null && quien === 'propietario' && (
                <div class="acciones-area" data-prueba="pagar-plan">
                  <button
                    type="button"
                    disabled={!enLinea || ocupado}
                    onClick={() => void pagar(p.id)}
                  >
                    {p.id === actual ? 'Renovar' : 'Pagar'} un mes · {pesos(cobro)}
                  </button>
                  <p class="ayuda">
                    Con PSE, Nequi o tarjeta, en la página segura de Bold. Sin débito automático:
                    pagas mes a mes, y si no renuevas, tu finca vuelve al plan Gratis sin perder
                    nada.
                  </p>
                  {!enLinea && <p class="ayuda">Necesitas señal para pagar.</p>}
                </div>
              )}
              {CON_ESPERA.has(p.id) &&
                cobro === null &&
                p.id !== actual &&
                quien === 'propietario' && (
                  <div class="acciones-area">
                    {marcados.has(p.id) ? (
                      <p class="exito" data-prueba="ya-avisaste">
                        Ya nos avisaste que te interesa.
                      </p>
                    ) : (
                      <button
                        type="button"
                        class="secundario"
                        onClick={() => void avisar(p.id)}
                        aria-label={`Me interesa el plan ${p.nombre}`}
                      >
                        Me interesa
                      </button>
                    )}
                  </div>
                )}
              {mensaje?.plan === p.id && mensaje.error && (
                <p class="error" role="alert">
                  {mensaje.texto}
                </p>
              )}
              {mensaje?.plan === p.id && !mensaje.error && (
                <p class="ayuda" role="status">
                  {mensaje.texto}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {quien === 'sin-cuenta' && (
        <p class="ayuda" data-prueba="planes-sin-cuenta">
          Para pagar un plan o avisarnos que te interesa, entra con tu cuenta en{' '}
          <a href="/agro/app/cuenta/">Cuenta</a>.
        </p>
      )}
      {quien === 'sin-finca' && (
        <p class="ayuda">
          Para pagar o avisarnos, primero sube tu finca a la nube en{' '}
          <a href="/agro/app/cuenta/">Cuenta</a>.
        </p>
      )}
      {quien === 'no-administra' && (
        <p class="ayuda" data-prueba="planes-no-administra">
          Si te interesa un plan, cuéntale a quien administra la finca: es quien lo paga.
        </p>
      )}
    </section>
  );
}
