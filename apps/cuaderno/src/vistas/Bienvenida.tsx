/**
 * La bienvenida del cuaderno (HU-E0.10): lo primero que ve un teléfono sin finca y sin cuenta.
 * Boceto aprobado por el dueño el 23 oct 2026: el saludo sobre el verde bosque, y abajo, sobre
 * blanco para leer al sol, entrar con Google, pedir un enlace al correo o empezar sin cuenta.
 *
 * - Entrar pide lo mismo que «Cuenta»: la política aceptada y señal (HU-E0.5, HU-C10.2). Vuelve a
 *   «Cuenta», que canjea la entrada y ofrece las fincas de la nube.
 * - Sin señal, lo dice y deja empezar en el teléfono: el cuaderno no exige cuenta (ED1 §28).
 */
import { pedirEnlaceDeEntrada } from '@ed1/correo/entrar';
import { useEffect, useState } from 'preact/hooks';
import marca from '../../../../content/marca.json' with { type: 'json' };
import { urlDelCore } from '../almacen/sesion.ts';
import {
  AceptarPolitica,
  urlDeEntrada,
  VERSION_POLITICA,
} from '../componentes/AceptarPolitica.tsx';
import { EntrarConCorreo } from '../componentes/EntrarConCorreo.tsx';

/** «Buenos días», «Buenas tardes» o «Buenas noches», según la hora del teléfono. */
export function saludo(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Buenos días';
  if (hora >= 12 && hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function Bienvenida({ alEmpezar }: { alEmpezar: () => void }) {
  const [acepta, setAcepta] = useState(false);
  const [conCorreo, setConCorreo] = useState(false);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const core = urlDelCore(location.hostname);
  const vuelta = `${location.origin}/agro/app/cuenta/`;

  useEffect(() => {
    const cambio = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', cambio);
    window.addEventListener('offline', cambio);
    return () => {
      window.removeEventListener('online', cambio);
      window.removeEventListener('offline', cambio);
    };
  }, []);

  return (
    <section
      class="bienvenida-entrada"
      aria-labelledby="titulo-bienvenida"
      data-prueba="bienvenida"
    >
      <div class="bienvenida-entrada__saludo">
        <svg
          class="bienvenida-entrada__hoja"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d={marca.hoja.d} />
        </svg>
        <h1 id="titulo-bienvenida">{saludo(new Date().getHours())}. Tu finca te espera.</h1>
        <p>Entra con tu cuenta y sigue donde dejaste, o empieza ahora en este teléfono.</p>
      </div>

      <div class="bienvenida-entrada__cuerpo">
        <AceptarPolitica acepta={acepta} alCambiar={setAcepta} />
        <div class="acciones acciones--columna">
          <button
            type="button"
            disabled={!enLinea || !acepta}
            onClick={() => location.assign(urlDeEntrada(core, vuelta))}
            data-prueba="bienvenida-google"
          >
            Entrar con Google
          </button>
          {!conCorreo && (
            <button type="button" class="secundario" onClick={() => setConCorreo(true)}>
              Recibir un enlace en mi correo
            </button>
          )}
        </div>
        {conCorreo && (
          <EntrarConCorreo
            puede={enLinea && acepta}
            pedir={(correo) =>
              pedirEnlaceDeEntrada(core, { correo, vuelta, politica: VERSION_POLITICA })
            }
          />
        )}
        {enLinea ? (
          !acepta && (
            <p class="ayuda">Para entrar, acepta primero la política de tratamiento de datos.</p>
          )
        ) : (
          <p class="ayuda" role="status">
            Necesitas señal para entrar. Puedes empezar en este teléfono y entrar después.
          </p>
        )}

        <div class="bienvenida-entrada__sin-cuenta">
          <p>
            <strong>¿Primera vez o sin señal?</strong>
          </p>
          <button type="button" class="enlace" onClick={alEmpezar} data-prueba="empezar-sin-cuenta">
            Empezar en este teléfono, sin cuenta
          </button>
          <p class="ayuda">
            Lo que anotes se guarda primero aquí. Puedes entrar a tu cuenta después.
          </p>
        </div>
      </div>
    </section>
  );
}
