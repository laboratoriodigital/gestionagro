/**
 * «Más › Tu plan» (HU-T13.5 CA1): el plan de ahora y hasta cuándo, lo que pasa si vence (CA3), y
 * los planes pagos con sus periodos de 1, 3, 6 o 12 meses, con el total y el valor por mes. Paga
 * quien administra la tienda, con el Bold de Laboratorio Digital: el CORE pone el monto y confirma.
 * Al volver de Bold, la dirección trae `?pago=`: se confirma, se quita de la barra y, si quedó
 * aprobado, la sesión trae el plan nuevo.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useEffect, useState } from 'preact/hooks';
import type { Conexion } from '../api.ts';
import {
  abrirCheckout,
  confirmarCobro,
  crearCobro,
  diasParaVencer,
  nombreDelPeriodo,
  ordenDeLaVuelta,
  type PlanDeLaTienda,
  pesos,
  planesDeLaTienda,
  type RespuestaDelPago,
} from '../plan.ts';
import { fechaLegible } from '../terminos.ts';

const PLANES = planesDeLaTienda();

/** Lo que el plan permite hoy, en palabras, de lo que la API dijo (`funciones`). */
function loQuePermite(funciones: Record<string, unknown> | null): string[] {
  if (!funciones) return [];
  const productos = funciones['productos'];
  const usuarios = funciones['usuarios'];
  return [
    typeof productos === 'number'
      ? `Hasta ${productos} productos en tu tienda`
      : 'Productos sin límite',
    typeof usuarios === 'number'
      ? usuarios === 1
        ? 'Una persona: tú'
        : `Hasta ${usuarios} personas en tu equipo`
      : 'Tu equipo, sin límite de personas',
    funciones['cobro_en_linea']
      ? 'Cobro en línea con tu Bold'
      : 'Pedidos por WhatsApp, sin cobro en línea',
    funciones['dominio_propio'] ? 'Tu propio dominio' : 'Tu dirección en laboratorio-digital.app',
  ];
}

function PagarPlan({
  plan,
  conexion,
  alVencer,
}: {
  plan: PlanDeLaTienda;
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [meses, setMeses] = useState(plan.periodos.at(-1)?.meses ?? 1);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pagar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r = await crearCobro(conexion, plan.id, meses, `${location.origin}/mas/plan/`);
      if (r.tipo !== 'ok') return setError(r.motivo);
      await abrirCheckout(r.datos);
    } catch (err) {
      if (err instanceof Error && err.name === 'ErrorDeSesion') return alVencer(err.message);
      setError('No pudimos abrir el pago de Bold. Revisa la señal e intenta otra vez.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <form class="formulario" onSubmit={pagar} noValidate>
      {error ? (
        <ResumenDeErrores errores={[{ campo: `meses-${plan.id}`, mensaje: error }]} />
      ) : null}
      <fieldset class="ed1-grupo" id={`meses-${plan.id}`}>
        <legend class="ed1-grupo__titulo">¿Por cuánto tiempo?</legend>
        {plan.periodos.map((p) => (
          <label class="casilla" for={`${plan.id}-${p.meses}`} key={p.meses}>
            <input
              id={`${plan.id}-${p.meses}`}
              type="radio"
              name={`meses-${plan.id}`}
              checked={meses === p.meses}
              onChange={() => setMeses(p.meses)}
            />
            <span>
              {nombreDelPeriodo(p.meses)}: <span class="cifra">{pesos(p.total)}</span>
              {p.meses > 1 ? (
                <>
                  {' '}
                  · <span class="cifra">{pesos(p.porMes)}</span> al mes
                  {p.ahorro > 0 ? (
                    <>
                      {' '}
                      · ahorras <span class="cifra">{pesos(p.ahorro)}</span>
                    </>
                  ) : null}
                </>
              ) : null}
            </span>
          </label>
        ))}
      </fieldset>
      <button
        class="ed1-boton ed1-boton--primario"
        type="submit"
        disabled={enviando}
        aria-busy={enviando ? 'true' : undefined}
      >
        Pagar el plan {plan.nombre}
      </button>
    </form>
  );
}

export function Plan({
  conexion,
  plan,
  vence,
  funciones,
  puedePagar,
  alCambiar,
  alVencer,
}: {
  conexion: Conexion;
  plan: string | null;
  vence: string | null;
  funciones: Record<string, unknown> | null;
  puedePagar: boolean;
  /** El plan cambió: el panel vuelve a preguntar por la tienda. */
  alCambiar: () => void;
  alVencer: (motivo: string) => void;
}) {
  const [vuelta, setVuelta] = useState<
    RespuestaDelPago | { estado: 'problema'; motivo: string } | null
  >(null);
  const [orden] = useState<string | null>(() => ordenDeLaVuelta(location.search));
  const [intento, setIntento] = useState(0);

  // La vuelta de Bold: se confirma con el CORE y la orden sale de la barra.
  useEffect(() => {
    if (!orden) return;
    history.replaceState(null, '', location.pathname);
    let vivo = true;
    void confirmarCobro(conexion, orden).then(
      (r) => {
        if (!vivo) return;
        setVuelta(r.tipo === 'ok' ? r.datos : { estado: 'problema', motivo: r.motivo });
        if (r.tipo === 'ok' && r.datos.estado === 'aprobado') alCambiar();
      },
      (e: Error) => alVencer(e.message),
    );
    return () => {
      vivo = false;
    };
  }, [orden, intento, conexion, alCambiar, alVencer]);

  const actual = PLANES.find((p) => p.id === plan) ?? PLANES.find((p) => p.gratuito);
  const dias = diasParaVencer(vence, Date.now());
  const pagos = PLANES.filter((p) => !p.gratuito && p.periodos.length > 0);

  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Tu plan</h1>

      {vuelta?.estado === 'aprobado' ? (
        <Aviso
          tono="exito"
          titulo={`Listo: pagaste el plan ${PLANES.find((p) => p.id === vuelta.plan)?.nombre ?? ''}`}
        >
          {vuelta.plan_vence ? (
            <>Te dura hasta el {fechaLegible(vuelta.plan_vence.slice(0, 10))}. </>
          ) : null}
          Publica tu tienda para que muestre todo lo que incluye.
        </Aviso>
      ) : null}
      {vuelta?.estado === 'esperando' ? (
        <Aviso tono="aviso" titulo="Estamos esperando la confirmación de Bold">
          <p>Si ya pagaste, en unos minutos queda. </p>
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            onClick={() => {
              setVuelta(null);
              setIntento((n) => n + 1);
            }}
          >
            Revisar otra vez
          </button>
        </Aviso>
      ) : null}
      {vuelta &&
      (vuelta.estado === 'rechazado' ||
        vuelta.estado === 'revisar' ||
        vuelta.estado === 'problema') ? (
        <Aviso tono="peligro" titulo="El pago no quedó">
          {vuelta.motivo ?? 'Bold no aprobó el pago. Puedes intentarlo otra vez.'}
        </Aviso>
      ) : null}

      <section class="tienda">
        <p class="tienda__nombre">Plan {actual?.nombre ?? plan}</p>
        {vence ? (
          <p>
            Activo hasta el {fechaLegible(vence.slice(0, 10))}
            {dias !== null ? `, en ${dias === 1 ? '1 día' : `${dias} días`}` : ''}, con los 7 días
            de gracia.
          </p>
        ) : null}
        <ul>
          {loQuePermite(funciones).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      {vence ? (
        <Aviso tono={dias !== null && dias <= 7 ? 'aviso' : 'info'} titulo="Si tu plan vence">
          <ul>
            <li>Tu tienda sigue en internet y recibiendo pedidos por WhatsApp.</li>
            <li>Deja de cobrar en línea y de ofrecer la contraentrega.</li>
            <li>Tu dominio propio lleva a tu dirección de laboratorio-digital.app.</li>
            <li>
              Los productos que pasen de 15 quedan ocultos. No se borra nada: al pagar, vuelven.
            </li>
          </ul>
        </Aviso>
      ) : null}

      <h2>Los planes</h2>
      <p class="nota">Los precios de la tienda son una propuesta: todavía no se cobra ninguno.</p>
      {pagos.map((p) => (
        <section class="tienda" key={p.id}>
          <p class="tienda__nombre">{p.nombre}</p>
          <p>{p.paraQuien}</p>
          <ul>
            {p.incluye.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {puedePagar ? (
            <PagarPlan plan={p} conexion={conexion} alVencer={alVencer} />
          ) : (
            <p class="nota">El plan lo paga quien administra la tienda.</p>
          )}
        </section>
      ))}
    </main>
  );
}
