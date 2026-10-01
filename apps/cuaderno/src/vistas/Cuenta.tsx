/**
 * Cuenta (HU-E4.2): entrar con Google, ver con qué cuenta y en qué fincas, y salir.
 *
 * - La cuenta es opcional: la pantalla lo dice y nada del cuaderno la exige (ED1 §28).
 * - Al volver de Google, el código se quita de la barra de direcciones antes de canjearlo (P13).
 * - Sin señal y con el access vencido se muestra «sin sesión para sincronizar», no un error (CA2).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  canjear,
  ErrorDeSesion,
  estadoDeSesion,
  leerRegreso,
  MENSAJES_DE_ERROR,
  renovarSiHaceFalta,
  type Sesion,
  salirDeLaCuenta,
  urlDelCore,
} from '../almacen/sesion.ts';

const NOMBRE_ROL: Record<string, string> = {
  propietario: 'Propietario',
  supervisor: 'Supervisor',
  operario: 'Operario',
  asesor: 'Asesor',
  auditor: 'Auditor',
};

export function Cuenta() {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined); // undefined = cargando
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const core = urlDelCore(location.hostname);

  useEffect(() => {
    const db = cuaderno();
    const regreso = leerRegreso(location.hash);
    if (regreso) history.replaceState(null, '', location.pathname + location.search);
    const cargar = async () => {
      if (regreso && 'codigo' in regreso) {
        setEntrando(true);
        try {
          setSesion(await canjear(db, regreso.codigo, core));
          return;
        } catch (e) {
          setMensaje(
            e instanceof ErrorDeSesion ? e.message : 'No se pudo entrar. Intenta de nuevo.',
          );
        } finally {
          setEntrando(false);
        }
      } else if (regreso && 'error' in regreso) {
        setMensaje(MENSAJES_DE_ERROR[regreso.error] ?? 'No se pudo entrar. Intenta de nuevo.');
      }
      const r = await renovarSiHaceFalta(db, core);
      setSesion(r.sesion);
      if (r.aviso) setMensaje(r.aviso);
    };
    void cargar();
    const cambio = () => setEnLinea(navigator.onLine);
    window.addEventListener('online', cambio);
    window.addEventListener('offline', cambio);
    return () => {
      window.removeEventListener('online', cambio);
      window.removeEventListener('offline', cambio);
    };
  }, [core]);

  const entrar = () => {
    const vuelta = `${location.origin}/agro/app/cuenta/`;
    location.assign(`${core}/api/core/auth/google/inicio?vuelta=${encodeURIComponent(vuelta)}`);
  };

  const salir = async () => {
    await salirDeLaCuenta(cuaderno());
    setSesion(null);
    setMensaje('Saliste de la cuenta. Tus registros siguen en este teléfono.');
  };

  const estado = estadoDeSesion(sesion ?? null, Date.now());

  return (
    <section aria-labelledby="titulo-cuenta">
      <h1 id="titulo-cuenta">Cuenta</h1>
      {mensaje && (
        <p class="aviso" role="status" data-prueba="cuenta-mensaje">
          {mensaje}
        </p>
      )}
      {sesion === undefined || entrando ? (
        <p>{entrando ? 'Entrando…' : 'Cargando…'}</p>
      ) : sesion ? (
        <>
          <p data-prueba="cuenta-usuario">
            Entraste como <strong>{sesion.usuario.nombre}</strong> ({sesion.usuario.email}).
          </p>
          <p class={estado === 'activa' ? 'exito' : 'aviso'} data-prueba="cuenta-estado">
            {estado === 'activa'
              ? 'Sesión activa.'
              : 'Sin sesión para sincronizar por ahora. Tus registros siguen guardados en este teléfono; la sesión se renueva sola cuando haya señal.'}
          </p>
          <h2>Tus fincas en la nube</h2>
          {sesion.organizaciones.length > 0 ? (
            <ul data-prueba="cuenta-fincas">
              {sesion.organizaciones.map((o) => (
                <li key={o.org_id}>
                  {o.nombre} · {NOMBRE_ROL[o.rol] ?? o.rol}
                </li>
              ))}
            </ul>
          ) : (
            <p class="ayuda" data-prueba="cuenta-sin-fincas">
              Tu finca todavía está solo en este teléfono. Pronto podrás subirla a tu cuenta sin
              volver a escribir nada.
            </p>
          )}
          <div class="acciones">
            <button type="button" class="secundario" onClick={() => void salir()}>
              Salir de la cuenta
            </button>
          </div>
          <p class="ayuda">Salir no borra nada de este teléfono.</p>
        </>
      ) : (
        <>
          <p>
            El cuaderno funciona sin cuenta. Con una cuenta de Google, tus registros podrán
            respaldarse en la nube y tu equipo podrá anotar desde sus teléfonos.
          </p>
          <div class="acciones">
            <button type="button" disabled={!enLinea} onClick={entrar} data-prueba="entrar-google">
              Entrar con Google
            </button>
          </div>
          {!enLinea && <p class="ayuda">Necesitas señal para entrar. Puedes seguir registrando.</p>}
        </>
      )}
    </section>
  );
}
