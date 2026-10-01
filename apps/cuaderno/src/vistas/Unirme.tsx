/**
 * Unirme a una finca con el enlace de una invitación (HU-E4.4).
 *
 * 1. El código llega en el fragmento (`#invitacion=…`): se guarda en la base local y se quita de la
 *    barra de direcciones antes de cualquier pedido (CA2, P13).
 * 2. Se muestra a qué finca, con qué rol, de parte de quién y hasta cuándo; o por qué ya no sirve
 *    y a quién pedir otro enlace (CA3).
 * 3. Sin sesión: se acepta la política y se entra con Google; Cuenta vuelve aquí. Con sesión:
 *    «Unirme» acepta la invitación y la finca baja a este teléfono (CA4).
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  aceptarInvitacion,
  codigoDelFragmento,
  codigoPendiente,
  guardarCodigo,
  type Invitacion,
  NOMBRE_ROL,
  verInvitacion,
} from '../almacen/invitacion.ts';
import { ErrorDeSesion, leerSesion, type Sesion, urlDelCore } from '../almacen/sesion.ts';
import { AceptarPolitica, urlDeEntrada } from '../componentes/AceptarPolitica.tsx';
import { sincronizarAhora } from '../sincronizacion.ts';

export function Unirme() {
  const [invitacion, setInvitacion] = useState<Invitacion | null | undefined>(undefined);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [acepta, setAcepta] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ finca: string; rol: string } | null>(null);
  const core = urlDelCore(location.hostname);

  useEffect(() => {
    const db = cuaderno();
    const delEnlace = codigoDelFragmento(location.hash);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    void (async () => {
      if (delEnlace) await guardarCodigo(db, delEnlace);
      const codigo = await codigoPendiente(db);
      setSesion(await leerSesion(db));
      if (!codigo) {
        setInvitacion(null);
        return;
      }
      try {
        setInvitacion(await verInvitacion(core, codigo));
      } catch (e) {
        setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo revisar la invitación.');
        setInvitacion(null);
      }
    })();
  }, [core]);

  const unirme = async () => {
    setTrabajando(true);
    setError(null);
    try {
      const r = await aceptarInvitacion(cuaderno(), core);
      setListo({ finca: r.finca, rol: r.rol });
      void sincronizarAhora();
    } catch (e) {
      setError(e instanceof ErrorDeSesion ? e.message : 'No se pudo aceptar la invitación.');
    } finally {
      setTrabajando(false);
    }
  };

  const entrar = () => location.assign(urlDeEntrada(core, `${location.origin}/agro/app/cuenta/`));

  return (
    <section aria-labelledby="titulo-unirme">
      <h1 id="titulo-unirme">Unirme a una finca</h1>
      {error && (
        <p class="error" role="alert" data-prueba="unirme-error">
          {error}
        </p>
      )}
      {listo ? (
        <>
          <p class="exito" data-prueba="unirme-listo">
            Ya eres parte de {listo.finca} como {NOMBRE_ROL[listo.rol] ?? listo.rol}. La finca se
            está bajando a este teléfono.
          </p>
          <p>
            <a href="/agro/app/">Ir a las áreas de la finca</a>
          </p>
        </>
      ) : invitacion === undefined ? (
        <p>Cargando…</p>
      ) : invitacion === null ? (
        <p data-prueba="unirme-sin-invitacion">
          No hay una invitación en este teléfono. Abre el enlace que te mandaron por WhatsApp.
        </p>
      ) : invitacion.estado === 'no-sirve' ? (
        <p class="error" data-prueba="unirme-no-sirve">
          {invitacion.motivo}
        </p>
      ) : (
        <>
          <p data-prueba="unirme-invitacion">
            {invitacion.invita} te invita al cuaderno de <strong>{invitacion.finca}</strong> como{' '}
            <strong>{NOMBRE_ROL[invitacion.rol] ?? invitacion.rol}</strong>.
          </p>
          {sesion ? (
            <div class="acciones">
              <button type="button" disabled={trabajando} onClick={() => void unirme()}>
                {trabajando ? 'Uniéndome…' : `Unirme a ${invitacion.finca}`}
              </button>
            </div>
          ) : (
            <>
              <p>Para unirte, entra con tu cuenta de Google. No necesitas crear otra contraseña.</p>
              <AceptarPolitica acepta={acepta} alCambiar={setAcepta} />
              <div class="acciones">
                <button type="button" disabled={!acepta} onClick={entrar}>
                  Entrar con Google
                </button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
