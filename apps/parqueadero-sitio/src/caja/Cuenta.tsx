/**
 * «Cuenta y nube» (HU-Q7.6 y HU-Q7.7): entrar con la cuenta, subir este parqueadero con lo del
 * piloto, sumar una caja vacía y, con permiso, ver y retirar las cajas. Solo fuera de producción
 * hasta HU-Q7.12: la promesa de privacidad con cuenta (HU-Q7.11) va primero.
 */
import { alcance } from '@ed1/parqueadero-schema/sync';
import { useEffect, useState } from 'preact/hooks';
import {
  type CajaDeLaNube,
  cajasDelParqueadero,
  canjear,
  cerrarSesionesDeLaCaja,
  destinoDeLaCaja,
  ErrorDeCuenta,
  leerRegreso,
  leerSesion,
  MENSAJES_DE_ERROR,
  renovar,
  retirarCaja,
  rolDeLaSesion,
  type Situacion,
  salir,
  situacion,
  subirParqueadero,
  sumarCaja,
  urlDeEntrada,
} from './cuenta.ts';
import type { BaseDeLaCaja, Meta, Sesion } from './datos.ts';
import { urlDelCore } from './entorno.ts';
import { fechaBogota, horaBogota } from './fecha.ts';
import { useConsulta } from './ganchos.ts';
import type { Nube } from './nube.ts';

interface Props {
  readonly db: BaseDeLaCaja;
  readonly reloj: () => number;
  readonly nube?: Nube;
  /** El fragmento con que volvió de la cuenta (`#entrar=…`), ya borrado de la barra. */
  readonly regreso?: string;
  readonly alAjustes: () => void;
  readonly alVolver: () => void;
}

type Reclamo = Extract<Meta, { clave: 'reclamo' }>;

const cifra = (n: number) => n.toLocaleString('es-CO');
const cuando = (ms: number) => `${fechaBogota(ms).slice(0, 5)} ${horaBogota(ms)}`;

export function Cuenta({ db, reloj, nube, regreso, alAjustes, alVolver }: Props) {
  const core = urlDelCore(location.hostname);
  const sesion = useConsulta<Sesion | null | undefined>(() => leerSesion(db), undefined);
  const sit = useConsulta<Situacion | undefined>(
    async () => situacion(db, await leerSesion(db)),
    undefined,
  );
  const reclamo = useConsulta<Reclamo | null>(
    () => db.meta.get('reclamo').then((m) => (m?.clave === 'reclamo' ? m : null)),
    null,
  );
  const serie = useConsulta<string | null>(
    () => db.meta.get('dispositivo').then((m) => (m?.clave === 'dispositivo' ? m.serie : null)),
    null,
  );
  const recibos = useConsulta(() => db.registros.count(), 0);
  const enCola = useConsulta(() => db.outbox.count(), 0);
  const rechazos = useConsulta(() => db.rechazos.count(), 0);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function hacer(paso: () => Promise<string>) {
    setOcupado(true);
    setError('');
    setEstado('');
    try {
      setEstado(await paso());
    } catch (e) {
      setError(e instanceof ErrorDeCuenta ? e.message : `No se pudo: ${String(e)}`);
    } finally {
      setOcupado(false);
    }
  }

  // Al volver de la cuenta: el código se canjea una vez. Con la sesión por renovar, se renueva.
  useEffect(() => {
    const r = regreso ? leerRegreso(regreso) : null;
    if (r && 'error' in r) {
      setError(MENSAJES_DE_ERROR[r.error] ?? 'No se pudo entrar. Intente otra vez.');
      return;
    }
    if (r) {
      void hacer(async () => {
        const s = await canjear(db, r.codigo, core, { ahora: reloj });
        return `Entró como ${s.usuario.nombre}.`;
      });
      return;
    }
    void renovar(db, core, { ahora: reloj }).then(({ aviso }) => aviso && setError(aviso));
  }, []);

  if (sesion === undefined || sit === undefined)
    return <section class="tarjeta" aria-busy="true" />;

  const org = sesion?.organizaciones.find((o) => o.org_id === sesion.org_id);
  const volver = (
    <button type="button" class="boton boton-secundario" onClick={alVolver}>
      Volver al inicio
    </button>
  );
  const avisos = (
    <>
      <output aria-live="polite" data-prueba="estado-de-la-cuenta">
        {estado}
      </output>
      {error && (
        <p class="error" role="alert" data-prueba="aviso-de-la-cuenta">
          {error}
        </p>
      )}
    </>
  );

  if (!sesion) {
    return (
      <section class="tarjeta" data-prueba="cuenta">
        <h1>Cuenta y nube</h1>
        <p>
          Con una cuenta, lo de esta caja se guarda también en la nube y dos cajas trabajan juntas
          sin repetir números. Sin cuenta, la caja sigue igual: todo queda en este teléfono.
        </p>
        <p class="ayuda">Por ahora se entra con una cuenta de Google.</p>
        <button
          type="button"
          class="boton boton-principal"
          onClick={() => location.assign(urlDeEntrada(core, location.origin))}
        >
          Entrar con Google
        </button>
        {avisos}
        {volver}
      </section>
    );
  }

  return (
    <section class="tarjeta" data-prueba="cuenta">
      <h1>Cuenta y nube</h1>
      <p class="ayuda" data-prueba="quien">
        {sesion.usuario.nombre} · {sesion.usuario.email}
      </p>
      {avisos}

      {sit === 'para-subir' && (
        <>
          <p>
            Esta caja guardó <span class="cifra">{cifra(recibos)}</span> registros y sus ajustes. Al
            subirla a la nube conservan sus números: la serie {serie ?? 'A'} sigue siendo suya.
          </p>
          <button
            type="button"
            class="boton boton-principal"
            disabled={ocupado}
            onClick={() =>
              void hacer(async () => {
                const r = await subirParqueadero(db, core, { ahora: reloj });
                void nube?.ahora();
                return `Listo: la caja quedó en la nube con la serie ${r.serie}. Lo guardado sube solo, de a poco.`;
              })
            }
          >
            Subir este parqueadero a la nube
          </button>
        </>
      )}

      {sit === 'para-sumar' && (
        <>
          <p>
            Esta caja está vacía. Al sumarla a un parqueadero recibe su propia serie y baja los
            ajustes y los vehículos que están adentro.
          </p>
          {sesion.organizaciones.map((o) => (
            <button
              key={o.org_id}
              type="button"
              class="boton boton-principal"
              disabled={ocupado}
              onClick={() =>
                void hacer(async () => {
                  const r = await sumarCaja(db, core, o.org_id, { ahora: reloj });
                  void nube?.ahora();
                  return `Listo: esta caja es la serie ${r.serie} de ${o.nombre}.`;
                })
              }
            >
              Sumar esta caja a {o.nombre}
            </button>
          ))}
        </>
      )}

      {sit === 'sin-ajustes' && (
        <>
          <p>
            Su cuenta todavía no tiene un parqueadero. Llene los ajustes en esta caja y vuelva aquí
            para subirlo.
          </p>
          <button type="button" class="boton boton-principal" onClick={alAjustes}>
            Ajustes del parqueadero
          </button>
        </>
      )}

      {sit === 'vinculada' && (
        <>
          <dl class="filas" data-prueba="vinculo">
            <div>
              <dt>Parqueadero</dt>
              <dd>{org?.nombre ?? 'En la nube'}</dd>
            </div>
            <div>
              <dt>Esta caja</dt>
              <dd>
                Serie <span class="exacto">{serie}</span>
              </dd>
            </div>
            <div>
              <dt>Por subir</dt>
              <dd class="cifra">{enCola === 0 ? 'Nada' : cifra(enCola)}</dd>
            </div>
          </dl>
          <Reclamo reclamo={reclamo} enCola={enCola} rechazos={rechazos} />
          {alcance(rolDeLaSesion(sesion) ?? '', 'dispositivos') === 'si' && <Cajas db={db} />}
        </>
      )}

      <button
        type="button"
        class="boton boton-quieto"
        disabled={ocupado}
        onClick={() =>
          void hacer(async () => {
            await salir(db);
            return enCola > 0
              ? `Salió de la cuenta. ${cifra(enCola)} siguen en esta caja y suben al volver a entrar.`
              : 'Salió de la cuenta. Todo sigue en esta caja.';
          })
        }
      >
        Salir de la cuenta
      </button>
      {volver}
    </section>
  );
}

/** Cómo va lo del piloto que subió al reclamar (HU-Q7.6 CA2). */
function Reclamo({
  reclamo,
  enCola,
  rechazos,
}: {
  readonly reclamo: Reclamo | null;
  readonly enCola: number;
  readonly rechazos: number;
}) {
  if (!reclamo) return null;
  if (reclamo.estado === 'verificado' && reclamo.verificado) {
    const v = reclamo.verificado;
    return (
      <p class="exito" data-prueba="reclamo">
        Lo de esta caja quedó verificado en la nube el {cuando(v.cuando)}:{' '}
        <span class="cifra">{cifra(v.registros)}</span> registros y{' '}
        <span class="cifra">{cifra(v.catalogos)}</span> ajustes.
      </p>
    );
  }
  if (reclamo.estado === 'con-rechazos') {
    return (
      <p class="error" data-prueba="reclamo">
        {cifra(rechazos)} no entraron a la nube; la cabecera dice por qué. Siguen guardados en esta
        caja.
      </p>
    );
  }
  return (
    <p data-prueba="reclamo">
      {enCola > 0
        ? `Subiendo lo de esta caja: quedan ${cifra(enCola)}. La caja sigue trabajando mientras tanto.`
        : 'Comprobando con la nube que llegó todo.'}
    </p>
  );
}

/** Las cajas del parqueadero, con su serie; retirar pide confirmar (HU-Q7.7 CA2). */
function Cajas({ db }: { readonly db: BaseDeLaCaja }) {
  const [cajas, setCajas] = useState<CajaDeLaNube[] | null>(null);
  const [propia, setPropia] = useState<string | null>(null);
  const [aRetirar, setARetirar] = useState<CajaDeLaNube | null>(null);
  const [hecho, setHecho] = useState('');
  const [error, setError] = useState('');

  async function cargar() {
    setError('');
    const destino = await destinoDeLaCaja(db);
    if (!destino) return;
    setPropia(destino.dispositivo);
    try {
      setCajas(await cajasDelParqueadero(destino));
    } catch (e) {
      setError(e instanceof ErrorDeCuenta ? e.message : String(e));
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function retirar(c: CajaDeLaNube) {
    const destino = await destinoDeLaCaja(db);
    if (!destino) return;
    try {
      await retirarCaja(destino, c.dispositivo);
      setARetirar(null);
      const cerradas = await cerrarSesionesDeLaCaja(
        db,
        urlDelCore(location.hostname),
        c.dispositivo,
      );
      setHecho(
        cerradas > 0
          ? `${c.nombre} quedó retirada y su sesión de la cuenta, cerrada.`
          : `${c.nombre} quedó retirada: la nube ya no le recibe nada. Si entró con otra cuenta, cierre esa sesión desde esa cuenta.`,
      );
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorDeCuenta ? e.message : String(e));
    }
  }

  return (
    <section class="seccion" aria-labelledby="titulo-cajas" data-prueba="cajas">
      <h2 class="etiqueta" id="titulo-cajas">
        Cajas del parqueadero
      </h2>
      {!cajas && !error && <p class="ayuda">Preguntando a la nube…</p>}
      {cajas && (
        <ul class="menu">
          {cajas.map((c) => (
            <li key={c.dispositivo} class="caja-fila" data-prueba="caja">
              <span>
                {c.nombre}
                {c.dispositivo === propia ? ' (esta)' : ''} · serie{' '}
                <span class="exacto">{c.serie}</span>
                {c.ultimo > 0 && (
                  <>
                    {' '}
                    · último <span class="cifra">{c.ultimo}</span>
                  </>
                )}
                {c.estado === 'retirado' && c.retirado && (
                  <> · retirada el {cuando(Date.parse(c.retirado))}</>
                )}
              </span>
              {c.estado === 'activo' && (
                <button
                  type="button"
                  class="boton boton-compacto boton-secundario"
                  onClick={() => setARetirar(c)}
                >
                  Retirar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {aRetirar && (
        <div role="alertdialog" aria-labelledby="pregunta-retirar" class="confirmar">
          <p id="pregunta-retirar">
            ¿Retirar {aRetirar.nombre}
            {aRetirar.dispositivo === propia ? ', que es esta caja' : ''}? No podrá subir ni bajar
            nada más. Lo que registró sigue valiendo con su serie {aRetirar.serie}.
          </p>
          <button
            type="button"
            class="boton boton-principal"
            onClick={() => void retirar(aRetirar)}
          >
            Sí, retirarla
          </button>
          <button type="button" class="boton boton-secundario" onClick={() => setARetirar(null)}>
            Cancelar
          </button>
        </div>
      )}
      <output aria-live="polite" data-prueba="caja-retirada">
        {hecho}
      </output>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
