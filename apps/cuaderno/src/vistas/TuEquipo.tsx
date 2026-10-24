/**
 * «Tu equipo» en Cuenta (HU-E4.4): el propietario invita por WhatsApp con un rol. El enlace sirve
 * una sola vez y vence en 7 días; el mensaje sale listo y la persona elige a quién mandarlo (CA1).
 *
 * Dos pasos: «Preparar invitación» pide el código a la nube y «Enviar por WhatsApp» es un enlace
 * que la persona toca. Abrir WhatsApp solo, después de esperar la respuesta, lo bloquean los
 * navegadores del teléfono porque ya no cuenta como un toque.
 *
 * En un plan con tope de personas (HU-E0.13), con la finca llena no se ofrece invitar: lo dice y
 * lleva a los planes. Nadie de los que ya están sale.
 */
import { useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  crearInvitacion,
  enlaceDeWhatsApp,
  NOMBRE_ROL,
  ROLES_PARA_INVITAR,
} from '../almacen/invitacion.ts';
import { topeDelPlan } from '../almacen/limites.ts';
import { ErrorDeSesion, urlDelCore } from '../almacen/sesion.ts';
import { PersonasConAcceso } from './PersonasConAcceso.tsx';
import { TopeDelPlan, usarPermisos } from './usarPermisos.tsx';

const QUE_HACE: Record<string, string> = {
  operario: 'registra el trabajo del día',
  supervisor: 'registra y organiza todo lo de la finca',
  asesor: 'consulta la información de la finca',
  propietario: 'administra la finca, igual que tú',
};

export function TuEquipo(props: { finca: string; enLinea: boolean }) {
  const [rol, setRol] = useState<string>('operario');
  const { plan } = usarPermisos();
  const [cuantas, setCuantas] = useState<number | null>(null);
  const tope = plan === undefined ? null : topeDelPlan('miembros', plan);
  const llena = tope !== null && cuantas !== null && cuantas >= tope;
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState<{ enlace: string; mensaje: string; rol: string } | null>(
    null,
  );

  const invitar = async () => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await crearInvitacion(cuaderno(), urlDelCore(location.hostname), rol, {
        origen: location.origin,
        finca: props.finca,
      });
      setEnviada({ enlace: r.enlace, mensaje: r.mensaje, rol });
    } catch (e) {
      setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo crear la invitación.');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div data-prueba="tu-equipo">
      <h2>Tu equipo</h2>
      <p>Invita a las personas que trabajan contigo para que anoten desde su propio teléfono.</p>
      {llena && plan ? (
        <TopeDelPlan plan={plan}>
          {`caben ${tope} personas con cuenta en la finca, contándote a ti. Para invitar a alguien más, pasas a otro plan. Las personas que solo anotas por su nombre, en «Personas», no tienen límite.`}
        </TopeDelPlan>
      ) : (
        <>
          <div class="campo">
            <label for="rol-invitado">Rol</label>
            <select
              id="rol-invitado"
              value={rol}
              onChange={(e) => setRol((e.currentTarget as HTMLSelectElement).value)}
            >
              {ROLES_PARA_INVITAR.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}: {QUE_HACE[r]}
                </option>
              ))}
            </select>
          </div>
          <div class="acciones">
            <button
              type="button"
              disabled={!props.enLinea || trabajando}
              onClick={() => void invitar()}
            >
              {trabajando ? 'Preparando…' : 'Preparar invitación'}
            </button>
          </div>
        </>
      )}
      {!props.enLinea && <p class="ayuda">Necesitas señal para invitar.</p>}
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      {enviada && (
        <div data-prueba="invitacion-creada">
          <p class="exito">
            Invitación como {NOMBRE_ROL[enviada.rol]} lista. Sirve una sola vez y vence en 7 días.
          </p>
          <p>
            <a
              class="boton"
              href={enlaceDeWhatsApp(enviada.mensaje)}
              target="_blank"
              rel="noopener"
              data-prueba="enviar-whatsapp"
            >
              Enviar por WhatsApp
            </a>
          </p>
          <p class="ayuda">
            Si prefieres, copia este enlace y mándalo como quieras:{' '}
            <span class="enlace-invitacion">{enviada.enlace}</span>
          </p>
        </div>
      )}
      <PersonasConAcceso enLinea={props.enLinea} alContar={setCuantas} />
    </div>
  );
}
