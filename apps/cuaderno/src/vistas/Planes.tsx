/**
 * Planes con precio visible y lista de espera (HU-E0.6). Qué trae cada plan y cuánto costará, con
 * el precio marcado como tentativo (CA2). «Me interesa» deja la señal en el CORE sin cobrar ni
 * pedir tarjeta (CA1); lo toca quien administra la finca, que es quien decidiría.
 *
 * Esta pantalla no se impone: no está en el menú, se llega por enlaces desde Cuenta y desde los
 * avisos de «viene con el plan…», y nunca sale como ventana durante el registro (CA4, ED1 §28).
 *
 * Pagar en línea (HU-E0.7): el propietario paga el plan con Bold. Al volver, la pantalla le pide
 * al CORE que confirme con Bold y, aprobado, renueva la sesión para traer el plan nuevo. Elige 1,
 * 3, 6 o 12 meses y ve el total, lo que sale al mes y lo que ahorra (HU-C5.7); el monto lo pone el
 * CORE.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  abrirCheckout,
  confirmarCobro,
  crearCobro,
  diasParaVencer,
  nombreDelPeriodo,
  ordenDeLaVuelta,
  type Periodo,
  periodosDe,
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

/**
 * Cuántos meses pagar (HU-C5.7): cada periodo con su total, y desde 3 meses lo que sale al mes y
 * lo que se ahorra. Solo los periodos con precio (CA3).
 */
function ElegirPeriodo({
  plan,
  periodos,
  elegido,
  alElegir,
}: {
  plan: string;
  periodos: readonly Periodo[];
  elegido: number;
  alElegir: (meses: number) => void;
}) {
  return (
    <fieldset class="opciones periodos" data-prueba="periodos">
      <legend>¿Por cuánto tiempo?</legend>
      {periodos.map((p) => (
        <label class="opcion" key={p.meses} data-prueba="periodo" data-meses={p.meses}>
          <input
            type="radio"
            name={`periodo-${plan}`}
            value={p.meses}
            checked={p.meses === elegido}
            onChange={() => alElegir(p.meses)}
          />
          <span>
            <strong>
              {p.meses === 1 ? '1 mes' : `${p.meses} meses`} · {pesos(p.total)}
            </strong>
            {p.meses > 1 && (
              <span class="periodo-detalle">
                <span>{pesos(p.porMes)} al mes</span>
                {p.ahorro > 0 && <span>{` · ahorras ${pesos(p.ahorro)}`}</span>}
              </span>
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Qué pasó con el pago, siempre a la vista (HU-C5.7 CA2): con los periodos, la tarjeta crece y el
 * aviso podía quedar debajo del borde de la pantalla, donde parecía que el botón no hacía nada.
 */
function EstadoDelPago(props: { pago: FaseDelPago; alVerificar: (orden: string) => void }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    caja.current?.scrollIntoView?.({ block: 'nearest' });
  }, [props.pago]);
  return (
    <div ref={caja}>
      <TextoDelEstado {...props} />
    </div>
  );
}

/** Qué pasó con el pago, en palabras, y cómo seguir. */
function TextoDelEstado({
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
  // El plan cuyo botón se tocó: lo que pase con el pago se dice ahí, no arriba, fuera de la vista.
  const [pagando, setPagando] = useState<string | null>(null);
  // Los meses elegidos en cada plan; sin elegir, uno, como se pagaba antes.
  const [meses, setMeses] = useState<Record<string, number>>({});
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

  const pagar = async (plan: string, periodo: number) => {
    setPagando(plan);
    setPago({ fase: 'abriendo' });
    try {
      const cobro = await crearCobro(
        cuaderno(),
        core,
        plan,
        periodo,
        `${location.origin}/agro/app/planes/`,
      );
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
      {pago && !pagando && <EstadoDelPago pago={pago} alVerificar={(o) => void confirmar(o)} />}
      <p class="aviso-legal" data-prueba="aviso-precio">
        {AVISO_PRECIO}
      </p>
      <ul class="lista-plana" data-prueba="planes">
        {PLANES.map((p) => {
          const periodos = periodosDe(p.id);
          const cobro = periodos.length > 0 ? periodos : null;
          const elegido =
            periodos.find((x) => x.meses === meses[p.id]) ??
            periodos.find((x) => x.meses === 1) ??
            periodos[0];
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
              {/* Comparar los periodos es para todos (revisión del dueño, 12 oct 2026): sin cuenta
                  o sin finca en la nube también se ve cuánto sale y cuánto se ahorra. Pagar, solo
                  quien administra la finca. */}
              {cobro !== null && elegido && periodos.length > 1 && quien !== 'cargando' && (
                <ElegirPeriodo
                  plan={p.id}
                  periodos={periodos}
                  elegido={elegido.meses}
                  alElegir={(m) => setMeses({ ...meses, [p.id]: m })}
                />
              )}
              {cobro !== null && elegido && quien === 'propietario' && (
                <div class="acciones-area" data-prueba="pagar-plan">
                  <button
                    type="button"
                    disabled={!enLinea || ocupado}
                    onClick={() => void pagar(p.id, elegido.meses)}
                  >
                    {p.id === actual ? 'Renovar' : 'Pagar'} {nombreDelPeriodo(elegido.meses)} ·{' '}
                    {pesos(elegido.total)}
                  </button>
                  {pago && pagando === p.id && (
                    <EstadoDelPago pago={pago} alVerificar={(o) => void confirmar(o)} />
                  )}
                  <p class="ayuda">
                    Con PSE, Nequi o tarjeta, en la página segura de Bold. Sin débito automático:
                    pagas solo el tiempo que elijas, y si no renuevas, tu finca vuelve al plan
                    Gratis sin perder nada.
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
