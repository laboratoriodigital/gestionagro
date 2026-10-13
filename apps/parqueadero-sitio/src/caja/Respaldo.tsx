/**
 * Respaldo y restauración (HU-Q3.10, PARQUEADERO §5.3 regla 6): todo lo de la caja en un archivo
 * que se comparte al correo o a Drive, y un archivo que se une a esta caja sin borrar nada.
 *
 * Con la caja en la nube (HU-Q7.9): la pantalla dice desde cuándo está todo allá, y el archivo se
 * arma después de subir y bajar todo, con lo de todas las cajas del parqueadero. Antes de
 * entregarlo se compara con lo que la nube dice tener: el archivo dice si está completo.
 *
 * La copia en el Google Drive de la persona (HU-Q10.1, `drive.ts`): el mismo archivo, guardado o
 * traído con el permiso que pide el CORE. Fuera de producción hasta que el CORE la publique.
 */
import { type CopiaEnDrive, ErrorDeDrive, leerVuelta, PermisoInvalido } from '@ed1/drive';
import { useEffect, useState } from 'preact/hooks';
import {
  anotarRespaldo,
  armarRespaldo,
  type Contexto,
  RespaldoInvalido,
  restaurar,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import type { AccionDrive } from './drive.ts';
import { esProduccion, urlDelCore } from './entorno.ts';
import { fechaBogota, horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import type { Nube } from './nube.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly nube?: Nube;
  /** El fragmento con que volvió de Google Drive (`#drive=…`), ya borrado de la barra. */
  readonly regreso?: string;
  readonly alVolver: () => void;
}

const cifra = (n: number) => n.toLocaleString('es-CO');

/** Lo que el archivo tiene frente a la nube, en una frase. */
async function frenteALaNube(db: BaseDeLaCaja, nube: Nube | undefined): Promise<string> {
  if (!nube || (await db.meta.get('nube'))?.clave !== 'nube') return '';
  await nube.ahora();
  const { compararConLaNube } = await import('./cuenta.ts');
  const c = await compararConLaNube(db);
  if (!c) return ' No se pudo comparar con la nube: sin señal.';
  const [caja, enLaNube] = c.registros;
  return caja >= enLaNube && c.catalogos[0] >= c.catalogos[1]
    ? ` Tiene los ${cifra(enLaNube)} registros que hay en la nube.`
    : ` La nube tiene ${cifra(enLaNube)} registros y este archivo ${cifra(caja)}: con señal, vuelva a hacerlo para que lleve todo.`;
}

/** Comparte los archivos si el teléfono puede (correo, Drive); si no, los descarga. */
async function entregar(archivos: readonly File[]): Promise<'compartido' | 'descargado'> {
  const datos = { files: [...archivos], title: 'Respaldo del parqueadero' };
  if (navigator.canShare?.(datos)) {
    try {
      await navigator.share(datos);
      return 'compartido';
    } catch (error) {
      // El navegador puede anunciar Web Share y bloquearlo al usarlo. La descarga sigue
      // disponible; cancelar el selector voluntariamente conserva su error de cancelación.
      if (!(error instanceof DOMException && error.name === 'NotAllowedError')) throw error;
    }
  }
  for (const a of archivos) {
    const url = URL.createObjectURL(a);
    const enlace = Object.assign(document.createElement('a'), { href: url, download: a.name });
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'descargado';
}

/** Lo que pasa con Google Drive, con la voz de la caja (el paquete tutea, como el cuaderno). */
const DE_DRIVE: Readonly<Record<string, string>> = {
  'sin-senal': 'No hay señal para hablar con Google. Intente cuando tenga internet.',
  vencido: 'El permiso de Google venció. Vuelva a tocar el botón.',
  lleno: 'Su Google Drive está lleno. Libere espacio y vuelva a intentarlo.',
  rechazado: 'Google no dio el permiso. Vuelva a tocar el botón.',
  cancelada: 'Canceló el permiso en Google. No se guardó ni se trajo nada.',
};

/** Un error del respaldo dicho para la persona: el de Drive y el del archivo, como son. */
function textoDeFalla(e: unknown, que: string): string {
  if (e instanceof PermisoInvalido)
    return e.motivo === 'vencido' ? e.message : (DE_DRIVE[e.motivo] ?? e.message);
  if (e instanceof ErrorDeDrive) return DE_DRIVE[e.motivo] ?? e.message;
  if (e instanceof RespaldoInvalido)
    return `Esta copia no se puede usar, y la caja quedó como estaba: ${e.message}.`;
  if (e instanceof SyntaxError)
    return 'Este archivo no es un respaldo del parqueadero, y la caja quedó como estaba.';
  return `No se pudo ${que}: ${String(e)}`;
}

const tamano = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function Respaldo({ db, ctx, nube, regreso, alVolver }: Props) {
  const conDrive = !esProduccion(location.hostname);
  const core = urlDelCore(location.hostname);
  const vinculada = useConsulta<boolean>(
    () => db.meta.get('nube').then((m) => m?.clave === 'nube'),
    false,
  );
  const alDia = useConsulta<number | null>(
    () => db.meta.get('nube_al_dia').then((m) => (m?.clave === 'nube_al_dia' ? m.instante : null)),
    null,
  );
  const enCola = useConsulta(() => db.outbox.count(), 0);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  /** Las copias de Drive para elegir, con el permiso de una hora que las trajo. */
  const [copias, setCopias] = useState<{ acceso: string; lista: CopiaEnDrive[] } | null>(null);

  async function trabajar(paso: () => Promise<string>, que: string) {
    setOcupado(true);
    setError('');
    setEstado('');
    try {
      setEstado(await paso());
    } catch (e) {
      setError(textoDeFalla(e, que));
    } finally {
      setOcupado(false);
    }
  }

  async function pedirPermiso(accion: AccionDrive) {
    // Sin señal, ir a Google dejaría la caja en una página de error del navegador.
    if (!navigator.onLine) {
      setError(DE_DRIVE['sin-senal'] ?? '');
      return;
    }
    const d = await import('./drive.ts');
    location.assign(await d.urlParaPedirPermiso(db, core, location.origin, accion, ctx.reloj));
  }

  // De vuelta de Google: el permiso se canjea una vez y hace lo que se pidió antes de salir.
  useEffect(() => {
    const v = regreso ? leerVuelta(regreso) : null;
    if (!v) return;
    if (v.tipo === 'error') {
      setError(DE_DRIVE[v.motivo === 'cancelada' ? 'cancelada' : 'rechazado'] ?? '');
      return;
    }
    void trabajar(async () => {
      const d = await import('./drive.ts');
      const { acceso, accion } = await d.canjearPermiso(db, core, v.sello, { ahora: ctx.reloj });
      if (accion === 'guardar') {
        setEstado('Guardando la copia en su Google Drive…');
        // Con la caja en la nube, primero sube y baja: la copia lleva lo de todas las cajas.
        await nube?.ahora();
        const r = await d.guardarCopia(db, ctx, acceso, { app: __VERSION_CAJA__ });
        const copia = `Copia guardada en su Google Drive, en la carpeta «${d.CARPETA}», como ${r.nombre}.`;
        if ('falla' in r.fotos) {
          setError(
            `Las fotos de los vehículos no terminaron de subir: ${textoDeFalla(r.fotos.falla, 'subir las fotos')} La próxima copia sube las que faltan.`,
          );
          return copia;
        }
        const { subidas } = r.fotos;
        return subidas === 0
          ? copia
          : `${copia} ${subidas === 1 ? 'Subió 1 foto' : `Subieron ${subidas} fotos`} de los vehículos a «${d.CARPETA_DE_FOTOS}».`;
      }
      const lista = await d.copiasEnDrive(acceso);
      setCopias({ acceso, lista });
      return lista.length === 0
        ? `No hay copias en la carpeta «${d.CARPETA}» de su Google Drive.`
        : 'Elija la copia que quiere traer. Se une a lo que hay; no borra nada.';
    }, 'usar Google Drive');
  }, []);

  async function traer(copia: CopiaEnDrive) {
    if (!copias) return;
    await trabajar(async () => {
      const d = await import('./drive.ts');
      const r = await d.traerCopia(db, copias.acceso, copia.id);
      setCopias(null);
      return `Listo: se agregaron ${r.agregados} datos de ${copia.nombre} y ${r.yaEstaban} ya estaban. No se borró nada.`;
    }, 'traer la copia');
  }

  async function respaldar() {
    setOcupado(true);
    setError('');
    try {
      const completo = await frenteALaNube(db, nube);
      const r = await armarRespaldo(db, ctx, __VERSION_CAJA__);
      const como = await entregar([
        new File([JSON.stringify(r.json)], `${r.nombre}.json`, { type: 'application/json' }),
        new File([r.csv], `${r.nombre}.csv`, { type: 'text/csv' }),
      ]);
      await anotarRespaldo(db, ctx.reloj());
      setEstado(
        (como === 'compartido'
          ? 'Respaldo compartido. Guárdelo en su correo o en su Drive.'
          : `Respaldo descargado: ${r.nombre}.json y su copia para Excel.`) + completo,
      );
    } catch (e) {
      // Cerrar el menú de compartir no es un error: el respaldo no salió y se dice.
      setError(
        e instanceof DOMException && e.name === 'AbortError'
          ? 'No se compartió: el respaldo no salió del teléfono.'
          : `No se pudo hacer el respaldo: ${String(e)}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  async function cargar(archivo: File | undefined) {
    if (!archivo) return;
    setOcupado(true);
    setError('');
    setEstado('');
    try {
      const r = await restaurar(db, JSON.parse(await archivo.text()));
      setEstado(
        `Listo: se agregaron ${r.agregados} datos y ${r.yaEstaban} ya estaban. No se borró nada.`,
      );
    } catch (e) {
      setError(
        e instanceof RespaldoInvalido
          ? `Este archivo no se puede usar, y la caja quedó como estaba: ${e.message}.`
          : e instanceof SyntaxError
            ? 'Este archivo no es un respaldo del parqueadero, y la caja quedó como estaba.'
            : `No se pudo restaurar: ${String(e)}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section class="tarjeta" data-prueba="respaldo">
      <h1>Respaldo</h1>
      {vinculada ? (
        <>
          <p data-prueba="respaldo-en-la-nube">
            {enCola === 0 && alDia !== null
              ? `Todo está en la nube desde el ${fechaBogota(alDia).slice(0, 5)} a las ${horaBogota(alDia)}.`
              : enCola > 0
                ? `En la nube, salvo ${cifra(enCola)} que esperan señal en este teléfono.`
                : 'La caja está en la nube; todavía no termina la primera vuelta.'}{' '}
            Si se pierde el teléfono, lo del parqueadero vuelve al entrar con la cuenta en otro.
          </p>
          <p class="ayuda">
            El archivo es opcional: lleva lo de todas las cajas, para guardarlo donde usted quiera.
          </p>
        </>
      ) : (
        <p>
          Todo lo de la caja queda en este teléfono. Haga un respaldo al terminar el día y guárdelo
          en su correo o en su Drive: si se pierde el teléfono, la caja vuelve con él.
        </p>
      )}
      <p class="ayuda">
        Las fotos de los vehículos no van en el respaldo: se quedan en este teléfono hasta 30 días
        después de la salida{conDrive ? ', y van con la copia en su Google Drive' : ''}.
      </p>
      <button
        type="button"
        class="boton boton-principal"
        disabled={ocupado}
        onClick={() => void respaldar()}
      >
        {vinculada ? 'Descargar todo el parqueadero' : 'Hacer el respaldo'}
      </button>
      {conDrive && (
        <section class="seccion" aria-labelledby="titulo-drive" data-prueba="copia-en-drive">
          <h2 class="etiqueta" id="titulo-drive">
            Copia en su Google Drive
          </h2>
          <p class="ayuda">
            El mismo archivo, en su propio Google Drive, en la carpeta «Caja del parqueadero ·
            respaldos». Se guardan las 8 más recientes. Google pide permiso cada vez, y la copia va
            directo de este teléfono a su Drive.
          </p>
          <p class="ayuda">
            Con la copia suben las fotos de los vehículos que falten, a «Caja del parqueadero ·
            fotos». A los 30 días de la salida se borran del teléfono, y de su Drive con la copia
            siguiente.
          </p>
          <button
            type="button"
            class="boton boton-secundario"
            disabled={ocupado}
            onClick={() => void pedirPermiso('guardar')}
          >
            Guardar copia en mi Google Drive
          </button>
          <button
            type="button"
            class="boton boton-quieto"
            disabled={ocupado}
            onClick={() => void pedirPermiso('traer')}
          >
            Traer una copia de mi Google Drive
          </button>
          {copias && copias.lista.length > 0 && (
            <ul class="menu" data-prueba="copias-en-drive">
              {copias.lista.map((c) => (
                <li key={c.id} class="caja-fila">
                  <span>
                    {fechaBogota(Date.parse(c.creado)).slice(0, 5)}{' '}
                    {horaBogota(Date.parse(c.creado))} ·{' '}
                    <span class="cifra">{tamano(c.tamano)}</span>
                  </span>
                  <button
                    type="button"
                    class="boton boton-compacto boton-secundario"
                    disabled={ocupado}
                    aria-label={`Traer la copia del ${fechaBogota(Date.parse(c.creado)).slice(0, 5)} a las ${horaBogota(Date.parse(c.creado))}`}
                    onClick={() => void traer(c)}
                  >
                    Traer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div class="campo">
        <label for="restaurar">Restaurar un respaldo (se une a lo que hay; no borra nada)</label>
        <input
          id="restaurar"
          type="file"
          accept=".json,application/json"
          disabled={ocupado}
          onChange={(e) => void cargar(e.currentTarget.files?.[0])}
        />
      </div>
      <output aria-live="polite" data-prueba="estado-del-respaldo">
        {estado}
      </output>
      {error && (
        <p class="error" role="alert" data-prueba="aviso-respaldo">
          {error}
        </p>
      )}
      <button type="button" class="boton boton-secundario" onClick={alVolver}>
        Volver al inicio
      </button>
    </section>
  );
}
