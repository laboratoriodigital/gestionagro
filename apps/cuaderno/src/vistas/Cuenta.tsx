/**
 * Cuenta (HU-E4.2): entrar con Google, ver con qué cuenta y en qué fincas, y salir.
 *
 * - La cuenta es opcional: la pantalla lo dice y nada del cuaderno la exige (ED1 §28).
 * - Al volver de Google, el código se quita de la barra de direcciones antes de canjearlo (P13).
 * - Sin señal y con el access vencido se muestra «sin sesión para sincronizar», no un error (CA2).
 */
import { pedirEnlaceDeEntrada } from '@ed1/correo/entrar';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { baseActiva } from '../almacen/fincas-locales.ts';
import { codigoPendiente } from '../almacen/invitacion.ts';
import { PLANES } from '../almacen/planes.ts';
import {
  canjear,
  ErrorDeSesion,
  estadoDeSesion,
  leerRegreso,
  MENSAJES_DE_ERROR,
  planDeLaFinca,
  type Sesion,
  salirDeLaCuenta,
  urlDeLaCuenta,
  urlDelCore,
  vencimientoDelPlan,
} from '../almacen/sesion.ts';
import { sesionDeLaFinca } from '../almacen/vinculo.ts';
import {
  AceptarPolitica,
  urlDeEntrada,
  VERSION_POLITICA,
} from '../componentes/AceptarPolitica.tsx';
import { EntrarConCorreo } from '../componentes/EntrarConCorreo.tsx';
import { fechaCorta } from '../formato.ts';
import { FincaEnLaNube } from './FincaEnLaNube.tsx';
import { FincasDelTelefono, irAFinca, usarFincasLocales } from './FincasDelTelefono.tsx';
import { TusDispositivos } from './TusDispositivos.tsx';

/** «Exportador», desde la lista de planes; un plan desconocido se nombra tal cual. */
const nombreDelPlan = (plan: string | undefined) =>
  PLANES.find((p) => p.id === (plan ?? 'gratuito'))?.nombre ?? plan ?? 'Gratis';

const NOMBRE_ROL: Record<string, string> = {
  propietario: 'Propietario',
  supervisor: 'Supervisor',
  operario: 'Operario',
  asesor: 'Asesor',
  auditor: 'Auditor',
};

/** En la lista de la nube: la finca abierta, una que está en el teléfono, o una por bajar. */
function AccionDeFinca({
  local,
  disabled,
  enLinea,
  alAbrir,
}: {
  local: { base: string } | undefined;
  disabled: boolean;
  enLinea: boolean;
  alAbrir: (base: string | null) => void;
}) {
  if (local?.base === baseActiva())
    return <span class="detalle-insumo"> · abierta en este teléfono</span>;
  return (
    <>
      {' '}
      <button
        type="button"
        class="secundario"
        disabled={disabled || (!local && !enLinea)}
        onClick={() => alAbrir(local?.base ?? null)}
      >
        {local ? 'Cambiar a esta finca' : 'Abrir en este teléfono'}
      </button>
    </>
  );
}

export function Cuenta() {
  const [sesion, setSesion] = useState<Sesion | null | undefined>(undefined); // undefined = cargando
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  // HU-E0.5, CA3: entrar exige aceptar la política vigente; el CORE guarda versión y fecha.
  const [acepta, setAcepta] = useState(false);
  const core = urlDelCore(location.hostname);
  // HU-E4.7: las fincas de este teléfono, para abrir o cambiar a las de la nube.
  const locales = usarFincasLocales();
  const [abriendo, setAbriendo] = useState(false);
  const abrir = (base: string | null, bajar?: { org_id: string; nombre: string }) => {
    setAbriendo(true);
    void irAFinca(base, bajar).catch(() => setAbriendo(false));
  };

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
          {sesion.org_id && (
            <p data-prueba="cuenta-plan">
              Plan de esta finca: <strong>{nombreDelPlan(planDeLaFinca(sesion))}</strong>
              {vencimientoDelPlan(sesion) &&
                ` hasta el ${fechaCorta(vencimientoDelPlan(sesion) ?? '')}`}{' '}
              · <a href="/agro/app/planes/">Ver los planes</a>
            </p>
          )}
          {sesion.organizaciones.length > 0 && (
            <>
              <h2>Tus fincas en la nube</h2>
              <ul class="lista-plana" data-prueba="cuenta-fincas">
                {sesion.organizaciones.map((o) => (
                  <li key={o.org_id}>
                    <strong>{o.nombre}</strong> · {NOMBRE_ROL[o.rol] ?? o.rol} · plan{' '}
                    {nombreDelPlan(o.plan)}
                    <AccionDeFinca
                      local={locales.find((l) => l.org_id === o.org_id)}
                      disabled={abriendo}
                      enLinea={enLinea}
                      alAbrir={(base) => abrir(base, base ? undefined : o)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <FincaEnLaNube sesion={sesion} alCambiarSesion={setSesion} enLinea={enLinea} />
          <FincasDelTelefono lista={locales} />
          <TusDispositivos enLinea={enLinea} />
          <h2>Planes</h2>
          <p>
            Mira qué trae cada plan y cuánto cuesta.{' '}
            <a href="/agro/app/planes/" data-prueba="ver-planes">
              Ver los planes
            </a>
          </p>
          <h2>Tu cuenta</h2>
          <p>
            Los asistentes de inteligencia artificial con acceso a tu finca, desde dónde entraste,
            tus pagos y tus datos están en tu cuenta de Laboratorio Digital, la misma para todas
            nuestras aplicaciones.{' '}
            <a href={urlDeLaCuenta(location.hostname)} data-prueba="ir-a-la-cuenta">
              Abrir mi cuenta
            </a>
          </p>
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
            El cuaderno funciona sin cuenta. Con una cuenta, tus registros podrán respaldarse en la
            nube y tu equipo podrá anotar desde sus teléfonos.
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
          <EntrarConCorreo
            puede={enLinea && acepta}
            pedir={(correo) =>
              pedirEnlaceDeEntrada(core, {
                correo,
                vuelta: `${location.origin}/agro/app/cuenta/`,
                politica: VERSION_POLITICA,
              })
            }
          />
          {!enLinea && <p class="ayuda">Necesitas señal para entrar. Puedes seguir registrando.</p>}
          <FincasDelTelefono lista={locales} />
        </>
      )}
    </section>
  );
}
