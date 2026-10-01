/**
 * «Tu finca en la nube» dentro de Cuenta (HU-E4.3, HU-E5.2, HU-E3.14 CA3).
 *
 * - Sin vincular: ofrece subir la finca del teléfono. Si la cuenta ya tiene fincas, las nombra y
 *   pregunta antes, para no subir una segunda finca sin querer (CA3).
 * - Vinculada: cuánto falta por subir, el resultado de la última subida en palabras y los datos
 *   que la nube no aceptó, con su motivo, en rojo.
 * - Vinculada a otra cuenta: no sube nada y dice qué hacer. Nunca mezcla.
 */
import { useEffect, useState } from 'preact/hooks';
import { escucharActividad } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import type { Rechazo } from '../almacen/db.ts';
import { type ResumenDeDatos, resumenDeDatos } from '../almacen/estado-datos.ts';
import type { ResultadoDeRecepcion } from '../almacen/recepcion.ts';
import { ErrorDeSesion, type Sesion, urlDelCore } from '../almacen/sesion.ts';
import {
  bajarFinca,
  type EstadoDelVinculo,
  estadoDelVinculo,
  subirFinca,
} from '../almacen/vinculo.ts';
import {
  type EstadoDeSincronizacion,
  escucharSincronizacion,
  estadoDeSincronizacion,
  sincronizarAhora,
} from '../sincronizacion.ts';

const minutos = (ms: number) => Math.max(1, Math.round(ms / 60_000));
const hora = (ms: number) =>
  new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(ms);

/** Lo que bajó del equipo, en palabras (HU-E5.3). Vacío si no hay nada que decir. */
function textoDeRecepcion(r: ResultadoDeRecepcion | undefined): string {
  if (!r) return '';
  const bajados = r.recibidos > 0 ? ` Se bajaron ${r.recibidos} cambios del equipo.` : '';
  const chocan =
    r.conflictos > 0
      ? ` ${r.conflictos} cambios del equipo tocan algo que tú también editaste: se guardaron aparte, sin borrar el tuyo.`
      : '';
  switch (r.estado) {
    case 'al-dia':
      return `${bajados}${chocan}`;
    case 'sin-senal':
      return `${bajados} Se cortó la señal al bajar lo del equipo; sigue cuando vuelva.`;
    case 'esperar':
      return `${bajados} ${r.motivo}`;
    default:
      return `${bajados} ${r.motivo}`;
  }
}

export function textoDeSincronizacion(e: EstadoDeSincronizacion): string | null {
  if (e.tipo === 'enviando') return 'Sincronizando…';
  if (e.tipo === 'sin-sesion')
    return 'Sin sesión para sincronizar: se renueva sola cuando haya señal.';
  if (e.tipo !== 'resultado') return null;
  const r = e.resultado;
  const enviados = r.enviados > 0 ? ` Se subieron ${r.enviados}.` : '';
  switch (r.estado) {
    case 'al-dia':
      // «Lo tuyo»: lo del equipo solo se sabe hasta la última revisión, y se dice cuándo fue.
      return `Todo lo tuyo está en la nube.${enviados}${textoDeRecepcion(e.recepcion)} Lo del equipo se revisó a las ${hora(e.cuando)}.`;
    case 'sin-senal':
      return `Sin señal: lo pendiente sube cuando vuelva.${enviados}`;
    case 'esperar':
      return `La nube pidió una pausa; se intenta de nuevo en ${minutos(r.ms)} min. Tus datos están en el teléfono.${enviados}`;
    default:
      return `${r.motivo} Tus datos siguen en este teléfono.`;
  }
}

export function FincaEnLaNube({
  sesion,
  alCambiarSesion,
  enLinea,
}: {
  sesion: Sesion;
  alCambiarSesion: (s: Sesion) => void;
  enLinea: boolean;
}) {
  const [estado, setEstado] = useState<EstadoDelVinculo | null>(null);
  const [finca, setFinca] = useState<string | null>(null);
  const [resumen, setResumen] = useState<ResumenDeDatos | null>(null);
  const [rechazos, setRechazos] = useState<Rechazo[]>([]);
  const [sync, setSync] = useState<EstadoDeSincronizacion>(estadoDeSincronizacion());
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = cuaderno();
    const cargar = async () => {
      setEstado(await estadoDelVinculo(db, sesion));
      setFinca((await db.finca.toCollection().first())?.nombre ?? null);
      setResumen(await resumenDeDatos(db));
      setRechazos(await db.rechazo.toArray());
    };
    void cargar();
    const dejarSync = escucharSincronizacion((e) => {
      setSync(e);
      void cargar();
    });
    const dejarActividad = escucharActividad((a) => {
      if (a.escriturasEnCurso === 0) void cargar();
    });
    return () => {
      dejarSync();
      dejarActividad();
    };
  }, [sesion]);

  const subir = async () => {
    setSubiendo(true);
    setError(null);
    try {
      const { sesion: nueva } = await subirFinca(cuaderno(), urlDelCore(location.hostname));
      alCambiarSesion(nueva);
      await sincronizarAhora();
    } catch (e) {
      setError(
        e instanceof ErrorDeSesion ? e.message : 'No se pudo subir la finca. Intenta de nuevo.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  const bajar = async (orgId: string) => {
    setSubiendo(true);
    setError(null);
    try {
      alCambiarSesion(await bajarFinca(cuaderno(), urlDelCore(location.hostname), orgId));
      await sincronizarAhora();
    } catch (e) {
      setError(
        e instanceof ErrorDeSesion ? e.message : 'No se pudo bajar la finca. Intenta de nuevo.',
      );
    } finally {
      setSubiendo(false);
    }
  };

  if (estado === null) return <p>Cargando…</p>;

  return (
    <div data-prueba="finca-en-la-nube">
      <h2>Tu finca en la nube</h2>
      {error && (
        <p class="error" role="alert" data-prueba="nube-error">
          {error}
        </p>
      )}
      {estado === 'sin-finca' && (
        <p class="ayuda">Configura tu finca en «Áreas» para poder subirla.</p>
      )}
      {estado === 'para-bajar' && (
        <>
          <p data-prueba="nube-para-bajar">
            Este teléfono todavía no tiene finca. Si es la de tu cuenta, bájala con todo lo que ya
            registró el equipo:
          </p>
          <div class="acciones">
            {sesion.organizaciones.map((o) => (
              <button
                type="button"
                key={o.org_id}
                disabled={!enLinea || subiendo}
                onClick={() => void bajar(o.org_id)}
              >
                {subiendo ? 'Bajando…' : `Bajar «${o.nombre}» a este teléfono`}
              </button>
            ))}
          </div>
          {!enLinea && <p class="ayuda">Necesitas señal para bajar la finca.</p>}
        </>
      )}
      {estado === 'otra-cuenta' && (
        <p class="error" data-prueba="nube-otra-cuenta">
          Este teléfono tiene una finca vinculada a otra cuenta. Para no mezclar datos, sal y entra
          con la cuenta de esa finca.
        </p>
      )}
      {estado === 'sin-subir' && (
        <>
          {sesion.organizaciones.length > 0 ? (
            <p data-prueba="nube-pregunta">
              Tu cuenta ya tiene en la nube: {sesion.organizaciones.map((o) => o.nombre).join(', ')}
              . Si «{finca}» es otra finca, súbela como una finca nueva.
            </p>
          ) : (
            <p data-prueba="nube-sin-subir">
              «{finca}» está solo en este teléfono. Súbela para respaldarla y, después, invitar a tu
              equipo.
            </p>
          )}
          <div class="acciones">
            <button
              type="button"
              disabled={!enLinea || subiendo}
              onClick={() => void subir()}
              data-prueba="subir-finca"
            >
              {subiendo ? 'Subiendo…' : 'Subir mi finca a la nube'}
            </button>
          </div>
          {!enLinea && <p class="ayuda">Necesitas señal para subir la finca.</p>}
        </>
      )}
      {estado === 'vinculada' && (
        <>
          <p class="exito" data-prueba="nube-vinculada">
            {finca
              ? `«${finca}» está vinculada a tu cuenta.`
              : 'Este teléfono está bajando la finca de tu cuenta.'}
          </p>
          {resumen && (
            <p data-prueba="nube-pendientes">
              {resumen.soloAqui + resumen.cambiosSoloAqui === 0
                ? 'Nada pendiente por subir.'
                : `Por subir: ${resumen.soloAqui} registros y ${resumen.cambiosSoloAqui} cambios de configuración.`}
            </p>
          )}
          {textoDeSincronizacion(sync) && (
            <p class="ayuda" role="status" data-prueba="nube-sync">
              {textoDeSincronizacion(sync)}
            </p>
          )}
          <div class="acciones">
            <button
              type="button"
              class="secundario"
              disabled={!enLinea || sync.tipo === 'enviando'}
              onClick={() => void sincronizarAhora()}
            >
              Sincronizar ahora
            </button>
          </div>
        </>
      )}
      {rechazos.length > 0 && (
        <div class="error" data-prueba="nube-rechazos">
          <p>La nube no aceptó estos datos. Siguen en este teléfono:</p>
          <ul>
            {rechazos.map((r) => (
              <li key={r.id}>
                {r.entidad === 'registro' ? 'Registro' : r.entidad}: {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
