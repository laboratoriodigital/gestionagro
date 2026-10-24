/**
 * «Copia en tu Google Drive» dentro de Respaldo (HU-E8.4, etapa 1; decisión del dueño, 5 oct 2026).
 *
 * - Guardar: pide el permiso a Google (un viaje y vuelta) y sube la copia a la carpeta
 *   «CultivoPro · respaldos» del Drive de la persona.
 * - Traer: lista las copias de esa carpeta y entrega la elegida a la revisión de Respaldo, que
 *   muestra qué agregaría antes de unir. Es restaurar: solo con el plan que lo incluye (HU-E0.13).
 * - No se respalda solo en segundo plano: una app web no puede pedirle permiso a Google sin que
 *   la persona lo vea. A los 7 días sin copia, la pantalla lo recuerda.
 */
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  CARPETA,
  CLAVE_ULTIMO_DRIVE,
  type CopiaEnDrive as Copia,
  carpetaDeRespaldos,
  descargarCopia,
  ErrorDeDrive,
  guardarCopiaEnDrive,
  listarCopias,
} from '../almacen/drive.ts';
import {
  canjearPermiso,
  leerVuelta,
  PermisoInvalido,
  textoDelError,
  urlParaPedirPermiso,
} from '../almacen/permiso-drive.ts';
import { urlDelCore } from '../almacen/sesion.ts';
import { fechaHora } from '../formato.ts';

const DIA = 24 * 60 * 60 * 1000;
export const RECORDAR_DESPUES_DE_DIAS = 7;

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('es-CO')} KB`;

type Estado =
  | { tipo: 'quieto' }
  | { tipo: 'trabajando'; texto: string }
  | { tipo: 'hecho'; texto: string }
  | { tipo: 'error'; texto: string }
  | { tipo: 'eligiendo'; token: string; copias: Copia[] };

export function CopiaEnDrive(props: {
  hayFinca: boolean;
  /** Si el plan deja restaurar una copia (`restaurar_copia`); si no, no se ofrece traer. */
  puedeTraer: boolean;
  /** Entrega el archivo traído a la revisión de Respaldo. */
  alTraer: (texto: string) => Promise<void>;
}) {
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: 'quieto' });
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const core = urlDelCore(location.hostname);

  useEffect(() => {
    const cambiar = () => setEnLinea(navigator.onLine);
    addEventListener('online', cambiar);
    addEventListener('offline', cambiar);
    return () => {
      removeEventListener('online', cambiar);
      removeEventListener('offline', cambiar);
    };
  }, []);

  const fallar = (error: unknown) =>
    setEstado({
      tipo: 'error',
      texto:
        error instanceof ErrorDeDrive || error instanceof PermisoInvalido
          ? error.message
          : 'No se pudo terminar. Tus datos siguen guardados en este teléfono.',
    });

  // Vuelta de Google: el fragmento trae el sello o el motivo; se borra de la barra enseguida.
  useEffect(() => {
    const db = cuaderno();
    void db.meta
      .get(CLAVE_ULTIMO_DRIVE)
      .then((m) => setUltimo(typeof m?.valor === 'string' ? m.valor : null));
    const vuelta = leerVuelta(location.hash);
    if (!vuelta) return;
    history.replaceState(null, '', location.pathname);
    if (vuelta.tipo === 'error') {
      setEstado({ tipo: 'error', texto: textoDelError(vuelta.motivo) });
      return;
    }
    void (async () => {
      try {
        setEstado({ tipo: 'trabajando', texto: 'Terminando el permiso de Google…' });
        const { acceso, accion } = await canjearPermiso(db, core, vuelta.sello);
        if (accion === 'guardar') {
          setEstado({ tipo: 'trabajando', texto: 'Guardando la copia en tu Google Drive…' });
          const r = await guardarCopiaEnDrive(db, (...a) => fetch(...a), acceso, {
            app: __VERSION_APP__,
          });
          setUltimo(new Date().toISOString());
          setEstado({
            tipo: 'hecho',
            texto: `Copia guardada en tu Google Drive, en la carpeta «${CARPETA}», como ${r.nombre}.`,
          });
        } else {
          setEstado({ tipo: 'trabajando', texto: 'Buscando tus copias en Google Drive…' });
          const carpeta = await carpetaDeRespaldos((...a) => fetch(...a), acceso);
          const copias = await listarCopias((...a) => fetch(...a), acceso, carpeta);
          setEstado({ tipo: 'eligiendo', token: acceso, copias });
        }
      } catch (error) {
        fallar(error);
      }
    })();
  }, []);

  const pedir = async (accion: 'guardar' | 'traer') => {
    try {
      const vuelta = `${location.origin}/agro/app/respaldo/`;
      location.assign(await urlParaPedirPermiso(cuaderno(), core, vuelta, accion));
    } catch (error) {
      fallar(error);
    }
  };

  const traer = async (token: string, copia: Copia) => {
    try {
      setEstado({ tipo: 'trabajando', texto: 'Trayendo la copia…' });
      await props.alTraer(await descargarCopia((...a) => fetch(...a), token, copia.id));
      setEstado({ tipo: 'quieto' });
    } catch (error) {
      fallar(error);
    }
  };

  const dias = ultimo ? Math.floor((Date.now() - Date.parse(ultimo)) / DIA) : null;
  const trabajando = estado.tipo === 'trabajando';

  return (
    <section aria-labelledby="titulo-drive" data-prueba="copia-en-drive">
      <h2 id="titulo-drive">Copia en tu Google Drive</h2>
      <p>
        Guarda una copia de tu cuaderno en tu propio Google Drive, en la carpeta «{CARPETA}». Queda
        en tu cuenta de Google: nosotros no la vemos. Se guardan las 8 más recientes. Las fotos
        todavía no van en la copia.
      </p>
      {props.hayFinca && (
        <p
          class={dias === null || dias >= RECORDAR_DESPUES_DE_DIAS ? 'aviso' : 'ayuda'}
          data-prueba="ultima-copia-drive"
        >
          {ultimo === null
            ? 'Todavía no has guardado una copia en tu Drive.'
            : dias !== null && dias >= RECORDAR_DESPUES_DE_DIAS
              ? `Hace ${dias} días de tu última copia en Drive (${fechaHora(ultimo)}). Guarda una nueva.`
              : `Última copia en tu Drive: ${fechaHora(ultimo)}.`}
        </p>
      )}
      {!enLinea && (
        <p class="ayuda" data-prueba="drive-sin-senal">
          Necesitas señal para hablar con Google. Tus datos siguen guardados en este teléfono.
        </p>
      )}
      <div class="acciones">
        {props.hayFinca && (
          <button
            type="button"
            disabled={!enLinea || trabajando}
            onClick={() => void pedir('guardar')}
          >
            Guardar copia en mi Google Drive
          </button>
        )}
        {props.puedeTraer && (
          <button
            type="button"
            class="secundario"
            disabled={!enLinea || trabajando}
            onClick={() => void pedir('traer')}
          >
            Traer una copia de mi Google Drive
          </button>
        )}
      </div>
      {estado.tipo === 'trabajando' && (
        <p class="ayuda" role="status">
          {estado.texto}
        </p>
      )}
      {estado.tipo === 'hecho' && (
        <p class="exito" role="status" data-prueba="drive-hecho">
          {estado.texto}
        </p>
      )}
      {estado.tipo === 'error' && (
        <p class="error" role="alert" data-prueba="drive-error">
          {estado.texto}
        </p>
      )}
      {estado.tipo === 'eligiendo' &&
        (estado.copias.length === 0 ? (
          <p class="ayuda" data-prueba="drive-sin-copias">
            No hay copias en la carpeta «{CARPETA}» de tu Google Drive.
          </p>
        ) : (
          <ul class="lista-plana" data-prueba="drive-copias">
            {estado.copias.map((c) => (
              <li key={c.id}>
                <p>
                  {fechaHora(c.creado)} · {kb(c.tamano)}
                </p>
                <button
                  type="button"
                  class="secundario"
                  onClick={() => void traer(estado.token, c)}
                >
                  Traer esta copia
                </button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
