/**
 * Unirme a una tienda con el enlace de una invitación (HU-T10.5 CA1).
 *
 * 1. El código llega en el fragmento (`#invitacion=…`): se guarda en el teléfono y se quita de la
 *    barra antes de cualquier pedido (P13).
 * 2. Se muestra a qué tienda, de parte de quién y hasta cuándo; o por qué ya no sirve.
 * 3. Sin sesión: se acepta la política y se entra con Google, que vuelve aquí. Con sesión: «Unirme»
 *    la acepta y la sesión se renueva hacia esa tienda.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useEffect, useState } from 'preact/hooks';
import type { Conexion } from '../api.ts';
import {
  aceptarInvitacion,
  codigoDelFragmento,
  codigoPendiente,
  guardarCodigo,
  type Invitacion,
  verInvitacion,
} from '../equipo.ts';
import type { Sesion } from '../sesion.ts';

const hasta = (expira: string) =>
  new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  }).format(Date.parse(expira));

export function Unirme({
  conexion,
  sesion,
  alEntrar,
  alUnirse,
}: {
  conexion: Conexion;
  sesion: Sesion | null;
  alEntrar: () => void;
  alUnirse: (sesion: Sesion) => void;
}) {
  const [invitacion, setInvitacion] = useState<Invitacion | null | undefined>(undefined);
  const [acepta, setAcepta] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const delEnlace = codigoDelFragmento(location.hash);
    if (location.hash) history.replaceState(null, '', location.pathname);
    void (async () => {
      if (delEnlace) await guardarCodigo(conexion.almacen, delEnlace);
      const codigo = await codigoPendiente(conexion.almacen);
      setInvitacion(codigo ? await verInvitacion(conexion.core, codigo, conexion.fetchFn) : null);
    })();
  }, [conexion]);

  const unirme = async () => {
    setTrabajando(true);
    setError(null);
    const r = await aceptarInvitacion(conexion);
    setTrabajando(false);
    if (r.tipo === 'ok') alUnirse(r.sesion);
    else setError(r.motivo);
  };

  return (
    <main class="portada">
      <p class="etiqueta">Tienda · Laboratorio Digital</p>
      <h1>Unirme a una tienda</h1>
      {invitacion === undefined ? <p role="status">Revisando la invitación…</p> : null}
      {invitacion === null ? (
        <p>Abre el enlace que te mandaron por WhatsApp para unirte a su tienda.</p>
      ) : null}
      {invitacion?.estado === 'no-sirve' ? (
        <Aviso tono="peligro" titulo="Esta invitación no sirve">
          {invitacion.motivo}
        </Aviso>
      ) : null}
      {error ? (
        <Aviso tono="peligro" titulo="No pudiste unirte">
          {error}
        </Aviso>
      ) : null}
      {invitacion?.estado === 'vigente' ? (
        <>
          <p class="portada__entrada">
            {invitacion.invita} te invitó a <strong>{invitacion.tienda}</strong> como colaborador.
            El enlace sirve una sola vez, hasta el {hasta(invitacion.expira)}.
          </p>
          {sesion ? (
            <button
              class="ed1-boton ed1-boton--primario"
              type="button"
              disabled={trabajando}
              aria-busy={trabajando ? 'true' : undefined}
              onClick={() => void unirme()}
            >
              Unirme a {invitacion.tienda}
            </button>
          ) : (
            <>
              <label class="acepto">
                <input
                  type="checkbox"
                  checked={acepta}
                  onChange={(e) => setAcepta((e.target as HTMLInputElement).checked)}
                />
                <span>
                  Leí y acepto la <a href="/privacidad/">política de tratamiento de datos</a> de mi
                  cuenta.
                </span>
              </label>
              <span class="ed1-boton-con-motivo">
                <button
                  class="ed1-boton ed1-boton--primario"
                  type="button"
                  aria-describedby={acepta ? undefined : 'unirme-motivo'}
                  aria-disabled={acepta ? undefined : 'true'}
                  onClick={() => {
                    if (acepta) alEntrar();
                    else document.getElementById('unirme-motivo')?.focus();
                  }}
                >
                  Entrar con Google para unirme
                </button>
                {acepta ? null : (
                  <span class="ed1-boton__motivo" id="unirme-motivo" tabindex={-1}>
                    Primero acepta la política de datos.
                  </span>
                )}
              </span>
            </>
          )}
        </>
      ) : null}
    </main>
  );
}
