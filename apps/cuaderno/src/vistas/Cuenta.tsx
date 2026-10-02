/**
 * Cuenta (HU-E4.2): entrar con Google, ver con qué cuenta y en qué fincas, y salir.
 *
 * - La cuenta es opcional: la pantalla lo dice y nada del cuaderno la exige (ED1 §28).
 * - Al volver de Google, el código se quita de la barra de direcciones antes de canjearlo (P13).
 * - Sin señal y con el access vencido se muestra «sin sesión para sincronizar», no un error (CA2).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { codigoPendiente } from '../almacen/invitacion.ts';
import {
  canjear,
  ErrorDeSesion,
  estadoDeSesion,
  leerRegreso,
  MENSAJES_DE_ERROR,
  type Sesion,
  salirDeLaCuenta,
  urlDelCore,
} from '../almacen/sesion.ts';
import { sesionDeLaFinca } from '../almacen/vinculo.ts';
import { AceptarPolitica, urlDeEntrada } from '../componentes/AceptarPolitica.tsx';
import { FincaEnLaNube } from './FincaEnLaNube.tsx';
import { TusDispositivos } from './TusDispositivos.tsx';

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
  // HU-E0.5, CA3: entrar exige aceptar la política vigente; el CORE guarda versión y fecha.
  const [acepta, setAcepta] = useState(false);
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
          // Si se entró para aceptar una invitación (HU-E4.4), se sigue en «Unirme».
          if (await codigoPendiente(db)) location.assign('/agro/app/unirme/');
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
      const r = await sesionDeLaFinca(db, core);
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
    location.assign(urlDeEntrada(core, vuelta));
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
          {sesion.organizaciones.length > 0 && (
            <ul data-prueba="cuenta-fincas">
              {sesion.organizaciones.map((o) => (
                <li key={o.org_id}>
                  {o.nombre} · {NOMBRE_ROL[o.rol] ?? o.rol}
                </li>
              ))}
            </ul>
          )}
          <FincaEnLaNube sesion={sesion} alCambiarSesion={setSesion} enLinea={enLinea} />
          <TusDispositivos enLinea={enLinea} />
          <h2>Tu cuenta</h2>
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
          <AceptarPolitica acepta={acepta} alCambiar={setAcepta} />
          <div class="acciones">
            <button
              type="button"
              disabled={!enLinea || !acepta}
              onClick={entrar}
              data-prueba="entrar-google"
            >
              Entrar con Google
            </button>
          </div>
          {!enLinea && <p class="ayuda">Necesitas señal para entrar. Puedes seguir registrando.</p>}
        </>
      )}
    </section>
  );
}
