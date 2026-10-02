/**
 * Planes con precio visible y lista de espera (HU-E0.6). Qué trae cada plan y cuánto costará, con
 * el precio marcado como tentativo (CA2). «Me interesa» deja la señal en el CORE sin cobrar ni
 * pedir tarjeta (CA1); lo toca quien administra la finca, que es quien decidiría.
 *
 * Esta pantalla no se impone: no está en el menú, se llega por enlaces desde Cuenta y desde los
 * avisos de «viene con el plan…», y nunca sale como ventana durante el registro (CA4, ED1 §28).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
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
  rolEnLaFinca,
  urlDelCore,
} from '../almacen/sesion.ts';

type Quien = 'cargando' | 'sin-cuenta' | 'sin-finca' | 'no-administra' | 'propietario';

export function Planes() {
  const [quien, setQuien] = useState<Quien>('cargando');
  const [actual, setActual] = useState('gratuito');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState<{ plan: string; texto: string; error: boolean } | null>(
    null,
  );
  const core = urlDelCore(location.hostname);

  useEffect(() => {
    const db = cuaderno();
    void (async () => {
      const sesion = await leerSesion(db);
      setActual(planDeLaFinca(sesion));
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

  return (
    <section aria-labelledby="titulo-planes">
      <h1 id="titulo-planes">Planes</h1>
      <p>Lo que trae cada plan y cuánto costará. Hoy no se cobra nada.</p>
      <p class="aviso-legal" data-prueba="aviso-precio">
        {AVISO_PRECIO}
      </p>
      <ul class="lista-plana" data-prueba="planes">
        {PLANES.map((p) => (
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
            {CON_ESPERA.has(p.id) && p.id !== actual && quien === 'propietario' && (
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
        ))}
      </ul>
      {quien === 'sin-cuenta' && (
        <p class="ayuda" data-prueba="planes-sin-cuenta">
          Para avisarnos que te interesa un plan, entra con tu cuenta en{' '}
          <a href="/agro/app/cuenta/">Cuenta</a>.
        </p>
      )}
      {quien === 'sin-finca' && (
        <p class="ayuda">
          Para avisarnos, primero sube tu finca a la nube en <a href="/agro/app/cuenta/">Cuenta</a>.
        </p>
      )}
      {quien === 'no-administra' && (
        <p class="ayuda" data-prueba="planes-no-administra">
          Si te interesa un plan, cuéntale a quien administra la finca: es quien lo pide.
        </p>
      )}
    </section>
  );
}
