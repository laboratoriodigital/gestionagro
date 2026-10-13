/**
 * «Cuenta y nube» (HU-Q7.6 y HU-Q7.7): entrar con la cuenta, subir este parqueadero con lo del
 * piloto, sumar una caja vacía y, con permiso, ver y retirar las cajas. Solo fuera de producción
 * hasta HU-Q7.12.
 *
 * Antes de entrar dice qué sube a la nube y qué no, y pide aceptar los términos con el contrato de
 * transmisión (HU-Q7.11 CA1). Una caja vinculada sin la versión vigente queda en pausa y los
 * vuelve a pedir aquí (CA3).
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
import { type EstadoDeLaFirma, estadoDeLaFirma } from './firma.ts';
import { useConsulta } from './ganchos.ts';
import type { Nube } from './nube.ts';
import {
  abrirCheckout,
  confirmarCobro,
  crearCobro,
  ErrorDePago,
  nombreDelPeriodo,
  ordenDeLaVuelta,
  periodosDe,
  pesos,
  textoDelPlan,
} from './plan.ts';
import { aceptarTerminos, terminos, VERSION_DE_LOS_TERMINOS } from './terminos.ts';

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
type Aceptacion = Extract<Meta, { clave: 'terminos' }>;

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
  const firma = useConsulta<EstadoDeLaFirma>(() => estadoDeLaFirma(db, reloj()), {
    es: 'sin-llave',
  });
  const recibos = useConsulta(() => db.registros.count(), 0);
  const enCola = useConsulta(() => db.outbox.count(), 0);
  const rechazos = useConsulta(() => db.rechazos.count(), 0);
  const aceptacion = useConsulta<Aceptacion | null | undefined>(
    () => db.meta.get('terminos').then((m) => (m?.clave === 'terminos' ? m : null)),
    undefined,
  );
  const vigentes = aceptacion?.version === VERSION_DE_LOS_TERMINOS;
  const [marcado, setMarcado] = useState(false);
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
      setError(
        e instanceof ErrorDeCuenta || e instanceof ErrorDePago
          ? e.message
          : `No se pudo: ${String(e)}`,
      );
    } finally {
      setOcupado(false);
    }
  }

  /** El acceso al CORE, renovado si venció: el pago lo pide quien administra (HU-Q7.10). */
  async function acceso(): Promise<string> {
    const r = await renovar(db, core, { ahora: reloj });
    if (!r.sesion) throw new ErrorDeCuenta(r.aviso ?? 'Vuelva a entrar con su cuenta para pagar.');
    return r.sesion.acceso;
  }

  async function pagar(meses: number) {
    await hacer(async () => {
      const cobro = await crearCobro(core, await acceso(), meses, `${location.origin}/caja/`);
      await abrirCheckout(cobro);
      return cobro.pruebas ? 'Se abrió el pago de prueba de Bold.' : 'Se abrió el pago de Bold.';
    });
  }

  // Al volver de Bold: el CORE confirma con Bold; aprobado, el acceso nuevo trae el plan.
  async function confirmar(orden: string) {
    await hacer(async () => {
      const r = await confirmarCobro(core, await acceso(), orden);
      if (r.estado === 'rechazado') {
        throw new ErrorDePago(r.motivo ?? 'Bold no aprobó el pago. No se cobró nada.');
      }
      if (r.estado !== 'aprobado') {
        return 'Bold todavía no confirma el pago. Vuelva a esta pantalla en unos minutos.';
      }
      await renovar(db, core, { ahora: reloj, forzar: true });
      void nube?.ahora();
      return r.plan_vence
        ? `Pago aprobado: la nube sigue hasta el ${fechaBogota(Date.parse(r.plan_vence))}.`
        : 'Pago aprobado.';
    });
  }

  // Al volver de la cuenta: el código se canjea una vez. Con la sesión por renovar, se renueva.
  useEffect(() => {
    const orden = regreso?.startsWith('#pago=')
      ? ordenDeLaVuelta(`?pago=${decodeURIComponent(regreso.slice('#pago='.length))}`)
      : null;
    if (orden) {
      void confirmar(orden);
      return;
    }
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

  if (sesion === undefined || sit === undefined || aceptacion === undefined)
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
        {vigentes && aceptacion ? (
          <p class="ayuda" data-prueba="terminos-aceptados">
            Los términos de la nube (versión {aceptacion.version}) se aceptaron en esta caja el{' '}
            {cuando(aceptacion.aceptados)}.
          </p>
        ) : (
          <Terminos marcado={marcado} alMarcar={setMarcado} />
        )}
        <p class="ayuda">Por ahora se entra con una cuenta de Google.</p>
        <button
          type="button"
          class="boton boton-principal"
          disabled={!vigentes && !marcado}
          onClick={async () => {
            if (!vigentes) await aceptarTerminos(db, reloj);
            location.assign(urlDeEntrada(core, location.origin));
          }}
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

      {org && (
        <PlanDelParqueadero
          org={org}
          puedePagar={alcance(rolDeLaSesion(sesion) ?? '', 'equipo') === 'si'}
          ocupado={ocupado}
          ahora={reloj()}
          alPagar={(meses) => void pagar(meses)}
        />
      )}

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

      {sit === 'vinculada' && !vigentes && (
        <div class="terminos-pendientes" data-prueba="terminos-pendientes">
          <p>
            <strong>La nube está en pausa en esta caja.</strong>{' '}
            {aceptacion
              ? 'Los términos de la nube cambiaron.'
              : 'Falta aceptar los términos de la nube.'}{' '}
            Mientras tanto la caja registra y cobra igual; lo de aquí sube cuando se acepten.
          </p>
          <Terminos marcado={marcado} alMarcar={setMarcado} />
          <button
            type="button"
            class="boton boton-principal"
            disabled={!marcado || ocupado}
            onClick={() =>
              void hacer(async () => {
                await aceptarTerminos(db, reloj);
                setMarcado(false);
                void nube?.ahora();
                return 'Términos aceptados. La caja vuelve a sincronizar.';
              })
            }
          >
            Aceptar y seguir sincronizando
          </button>
        </div>
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
              <dt>Recibos</dt>
              <dd data-prueba="firma">{textoDeLaFirma(firma)}</dd>
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

/** Si los recibos de esta caja salen firmados (HU-Q8.1 y HU-Q8.2); sin firma, lo dice (CA3). */
/** El plan, hasta cuándo sigue la nube y, para quien paga, los periodos (HU-Q7.10 CA1). */
function PlanDelParqueadero({
  org,
  puedePagar,
  ocupado,
  ahora,
  alPagar,
}: {
  readonly org: Sesion['organizaciones'][number];
  readonly puedePagar: boolean;
  readonly ocupado: boolean;
  readonly ahora: number;
  readonly alPagar: (meses: number) => void;
}) {
  const periodos = periodosDe();
  return (
    <section class="seccion" aria-labelledby="titulo-plan" data-prueba="plan">
      <h2 class="etiqueta" id="titulo-plan">
        Plan del parqueadero
      </h2>
      <p data-prueba="texto-del-plan">{textoDelPlan(org, ahora)}</p>
      {puedePagar ? (
        <div class="menu" data-prueba="pagar-plan">
          {periodos.map((p) => (
            <button
              key={p.meses}
              type="button"
              class="boton boton-secundario"
              disabled={ocupado}
              onClick={() => alPagar(p.meses)}
            >
              Pagar {nombreDelPeriodo(p.meses)} · {pesos(p.total)}
              {p.ahorro > 0 ? ` (ahorra ${pesos(p.ahorro)})` : ''}
            </button>
          ))}
        </div>
      ) : (
        <p class="ayuda">El plan lo paga quien es propietario del parqueadero.</p>
      )}
    </section>
  );
}

function textoDeLaFirma(f: EstadoDeLaFirma): string {
  switch (f.es) {
    case 'vigente':
      return `Firmados por esta caja hasta el ${fechaBogota(f.hasta).slice(0, 5)}`;
    case 'vencido':
      return 'Firmados con el certificado vencido: se renueva al sincronizar';
    case 'sin-ed25519':
      return 'Sin firma: este navegador no puede firmarlos. Salen como copia digital';
    default:
      return 'Sin firma todavía: la caja se certifica al sincronizar';
  }
}

/**
 * Qué sube a la nube, qué no, y los términos con el contrato de transmisión (HU-Q7.11 CA1). La
 * casilla empieza sin marcar: aceptar es un acto de quien está en la caja.
 */
function Terminos({
  marcado,
  alMarcar,
}: {
  readonly marcado: boolean;
  readonly alMarcar: (marcado: boolean) => void;
}) {
  const t = terminos();
  return (
    <div class="terminos" data-prueba="terminos">
      <h2>Qué pasa a la nube</h2>
      <p class="terminos-rotulo">Sube a la nube</p>
      <ul>
        {t.sube.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p class="terminos-rotulo">No sale de este teléfono</p>
      <ul>
        {t.noSale.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <details>
        <summary>Leer los términos y el contrato de transmisión (versión {t.version})</summary>
        {t.secciones.map(([titulo, texto]) => (
          <section key={titulo}>
            <h3 class="terminos-seccion">{titulo}</h3>
            <p class="terminos-texto">{texto}</p>
          </section>
        ))}
      </details>
      <label class="casilla">
        <input
          class="casilla-marca"
          type="checkbox"
          checked={marcado}
          onChange={(ev) => alMarcar((ev.target as HTMLInputElement).checked)}
        />
        <span>{t.aceptar}</span>
      </label>
    </div>
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
