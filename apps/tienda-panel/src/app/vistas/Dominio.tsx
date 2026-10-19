/**
 * HU-T13.1 a HU-T13.3: la pantalla del dominio propio (TIENDA-3.0 §4.2 y §4.3), en «Más › Tu
 * dominio», para quien administra la tienda.
 *
 * - Escribe su dirección → tres registros explicados en palabras, cada uno con «Copiar» → un estado
 *   que se actualiza solo mientras la pantalla está abierta: esperando, preparando el candado,
 *   conectado, o lo que falló, dicho en palabras.
 * - Conectado, puede volverlo la dirección principal (HU-T13.2): la de la plataforma lleva a ella.
 * - La dirección sin «www» (HU-T13.3): si su proveedor deja un CNAME en la raíz, se conecta igual;
 *   si no, cómo redirigirla desde los proveedores más comunes. Nunca se le pide mover su dominio.
 */
import { leerDominio, REDIRIGIR_LA_RAIZ, type Registro } from '@ed1/tienda-schema/dominios';
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { Conexion } from '../api.ts';
import { Confirmar } from '../componentes/Confirmar.tsx';
import {
  algunoEspera,
  conectarDominio,
  type DominioDelPanel,
  type DominiosDelPanel,
  desconectarDominio,
  elegirPrincipal,
  leerDominios,
  REVISAR_CADA_MS,
  rolEnPalabras,
} from '../dominio.ts';

type Lectura =
  | { tipo: 'cargando' }
  | { tipo: 'error'; motivo: string }
  | { tipo: 'listo'; datos: DominiosDelPanel };

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      class="ed1-boton ed1-boton--texto"
      type="button"
      aria-label={`Copiar ${etiqueta}`}
      onClick={() => {
        void navigator.clipboard?.writeText(texto).then(() => {
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        });
      }}
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}

/** Los registros a crear, uno por fila, en el orden en que se crean. */
function Registros({ registros }: { registros: Registro[] }) {
  return (
    <ol class="registros">
      {registros.map((r) => (
        <li key={`${r.tipo}-${r.completo}`}>
          <p>
            <strong>{r.tipo}</strong>. {r.paraQue}
          </p>
          <dl class="datos">
            <div>
              <dt>Nombre</dt>
              <dd class="cifra">
                {r.nombre} <Copiar texto={r.nombre} etiqueta={`el nombre del ${r.tipo}`} />
              </dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd class="cifra">
                {r.valor} <Copiar texto={r.valor} etiqueta={`el valor del ${r.tipo}`} />
              </dd>
            </div>
          </dl>
          {r.nombre !== r.completo ? (
            <p class="nota">
              Si tu proveedor pide el nombre completo: <span class="cifra">{r.completo}</span>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Conectar({
  conexion,
  sugerencia,
  directo = false,
  alConectar,
  alVencer,
}: {
  conexion: Conexion;
  sugerencia: string;
  /** La raíz, cuando el comercio ya dijo que su proveedor deja un CNAME en ella. */
  directo?: boolean;
  alConectar: () => void;
  alVencer: (motivo: string) => void;
}) {
  const [texto, setTexto] = useState(sugerencia);
  const [error, setError] = useState<string | null>(null);
  const [raiz, setRaiz] = useState<{ hostname: string; registrable: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (hostname: string) => {
    setEnviando(true);
    const r = await conectarDominio(conexion, hostname);
    setEnviando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.problemas?.[0]?.mensaje ?? r.motivo);
    setTexto('');
    setRaiz(null);
    alConectar();
  };
  const alEnviar = (e: Event) => {
    e.preventDefault();
    setError(null);
    const leido = leerDominio(texto);
    if (!leido.ok) return setError(leido.motivo);
    // HU-T13.3: la raíz se conecta solo si su proveedor deja un CNAME en ella.
    if (leido.raiz && !directo)
      return setRaiz({ hostname: leido.hostname, registrable: leido.registrable });
    void enviar(leido.hostname);
  };

  return (
    <form class="formulario" onSubmit={alEnviar} noValidate>
      {error ? <ResumenDeErrores errores={[{ campo: 'dominio', mensaje: error }]} /> : null}
      <div class={`ed1-campo${error ? ' ed1-campo--con-error' : ''}`}>
        <label class="ed1-campo__etiqueta" for="dominio">
          La dirección de tu tienda
        </label>
        <input
          class="ed1-campo__control cifra"
          id="dominio"
          name="dominio"
          type="text"
          inputMode="url"
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          placeholder="www.midominio.co"
          value={texto}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'dominio-error' : 'dominio-ayuda'}
          onInput={(e) => setTexto((e.target as HTMLInputElement).value)}
        />
        {error ? (
          <p class="ed1-campo__error" id="dominio-error">
            {error}
          </p>
        ) : (
          <p class="ed1-campo__ayuda" id="dominio-ayuda">
            Con «www» delante. Tu dominio sigue siendo tuyo, en tu proveedor: solo agregas tres
            registros.
          </p>
        )}
      </div>
      {raiz ? (
        <Aviso tono="info" titulo={`${raiz.hostname} no lleva «www»`}>
          <p>
            Una dirección sin «www» solo se conecta si tu proveedor deja un CNAME en la raíz (lo
            llaman CNAME flattening, ALIAS o ANAME; Cloudflare lo hace). Si no lo sabes, conecta{' '}
            <span class="cifra">www.{raiz.registrable}</span> y redirige la otra desde tu proveedor.
          </p>
          <div class="acciones">
            <button
              class="ed1-boton ed1-boton--primario"
              type="button"
              disabled={enviando}
              onClick={() => void enviar(`www.${raiz.registrable}`)}
            >
              Conectar www.{raiz.registrable}
            </button>
            <button
              class="ed1-boton ed1-boton--secundario"
              type="button"
              disabled={enviando}
              onClick={() => void enviar(raiz.hostname)}
            >
              Mi proveedor lo permite
            </button>
          </div>
        </Aviso>
      ) : (
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={enviando}
          aria-busy={enviando ? 'true' : undefined}
        >
          Conectar
        </button>
      )}
    </form>
  );
}

function UnDominio({
  conexion,
  d,
  puedeGestionar,
  alCambiar,
  alVencer,
}: {
  conexion: Conexion;
  d: DominioDelPanel;
  puedeGestionar: boolean;
  alCambiar: (mensaje: string | null) => void;
  alVencer: (motivo: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hacer = async (
    accion: () => ReturnType<typeof elegirPrincipal>,
    mensaje: string,
  ): Promise<void> => {
    setOcupado(true);
    setError(null);
    const r = await accion();
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.motivo);
    alCambiar(mensaje);
  };
  const rol = rolEnPalabras(d);
  return (
    <section class="dominio" aria-labelledby={`dominio-${d.hostname}`}>
      <h2 id={`dominio-${d.hostname}`} class="cifra">
        {d.hostname}
      </h2>
      <p>
        <strong>{d.enPalabras}</strong>
        {rol ? `. ${rol}` : ''}
        {d.tipo === 'plataforma' ? '. Es la dirección que tu tienda tiene siempre.' : ''}
      </p>
      {d.motivo ? <p class="nota">{d.motivo}</p> : null}
      {error ? (
        <Aviso tono="peligro" titulo="No se pudo">
          {error}
        </Aviso>
      ) : null}
      {d.registros.length > 0 ? (
        <>
          <p>Crea estos registros en el proveedor de tu dominio, en este orden:</p>
          <Registros registros={d.registros} />
          <p class="nota">
            Los proveedores tardan de minutos a unas horas en mostrarlos. Esta pantalla vuelve a
            revisar sola mientras esté abierta.
          </p>
        </>
      ) : null}
      {puedeGestionar && d.tipo === 'propio' ? (
        <div class="acciones">
          {d.estado === 'activo' && d.rol === 'alias' ? (
            <button
              class="ed1-boton ed1-boton--primario"
              type="button"
              disabled={ocupado}
              onClick={() =>
                void hacer(
                  () => elegirPrincipal(conexion, d.hostname),
                  `${d.hostname} es ahora la dirección principal. Tu tienda se vuelve a preparar con ella en unos minutos.`,
                )
              }
            >
              Usar como dirección principal
            </button>
          ) : null}
          <Confirmar
            abrir="Desconectar"
            consecuencia={
              d.rol === 'canonico' && d.estado === 'activo'
                ? `Quien escriba ${d.hostname} ya no llegará a tu tienda, y la dirección de la plataforma vuelve a ser la principal.`
                : `Quien escriba ${d.hostname} ya no llegará a tu tienda.`
            }
            confirmar={`Desconectar ${d.hostname}`}
            alConfirmar={() =>
              hacer(
                () => desconectarDominio(conexion, d.hostname),
                `${d.hostname} quedó desconectado. Puedes borrar sus registros en tu proveedor.`,
              )
            }
          />
        </div>
      ) : null}
    </section>
  );
}

export function Dominio({
  conexion,
  puedeGestionar,
  alVencer,
}: {
  conexion: Conexion;
  puedeGestionar: boolean;
  alVencer: (motivo: string) => void;
}) {
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando' });
  const [listo, setListo] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    const r = await leerDominios(conexion);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setLectura({ tipo: 'error', motivo: r.motivo });
    setLectura({ tipo: 'listo', datos: r.datos });
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  // CA2: mientras uno espera y la pantalla sigue abierta, vuelve a preguntar.
  const espera = lectura.tipo === 'listo' && algunoEspera(lectura.datos.dominios);
  useEffect(() => {
    if (!espera) return;
    const id = setInterval(() => void cargar(), REVISAR_CADA_MS);
    return () => clearInterval(id);
  }, [espera, cargar]);

  const volver = (
    <p>
      <a href="/mas/">Más</a>
    </p>
  );
  if (lectura.tipo === 'cargando')
    return (
      <main class="contenido" role="status">
        {volver}
        Leyendo tus direcciones…
      </main>
    );
  if (lectura.tipo === 'error')
    return (
      <main class="contenido">
        {volver}
        <h1>Tu dominio</h1>
        <Aviso tono="peligro" titulo="No pudimos leer tus direcciones">
          {lectura.motivo}
        </Aviso>
      </main>
    );
  const { disponible, dominios } = lectura.datos;
  const propios = dominios.filter((d) => d.tipo === 'propio');
  const www = propios.find((d) => !leerDominioRaiz(d.hostname));
  const sinRaiz = www && !propios.some((d) => leerDominioRaiz(d.hostname));
  return (
    <main class="contenido">
      {volver}
      <h1>Tu dominio</h1>
      <p>
        Tu tienda puede vivir también en tu propio dominio, como www.mitienda.co. El dominio sigue
        siendo tuyo, en tu proveedor: solo le agregas unos registros, y tu tienda tiene su candado
        (HTTPS) desde el primer minuto.
      </p>
      {listo ? (
        <Aviso tono="exito" titulo="Listo">
          {listo}
        </Aviso>
      ) : null}
      {!disponible ? (
        <Aviso tono="info" titulo="Todavía no disponible">
          Conectar un dominio propio todavía no está disponible. Tu tienda sigue en su dirección de
          siempre.
        </Aviso>
      ) : null}
      {dominios.map((d) => (
        <UnDominio
          key={d.hostname}
          conexion={conexion}
          d={d}
          puedeGestionar={puedeGestionar && disponible}
          alCambiar={(m) => {
            setListo(m);
            void cargar();
          }}
          alVencer={alVencer}
        />
      ))}
      {puedeGestionar && disponible && propios.length === 0 ? (
        <>
          <h2>Conectar tu dominio</h2>
          <Conectar
            conexion={conexion}
            sugerencia=""
            alConectar={() => {
              setListo('Ahora crea los registros que ves en tu proveedor.');
              void cargar();
            }}
            alVencer={alVencer}
          />
        </>
      ) : null}
      {sinRaiz && www ? (
        <section aria-labelledby="sin-www">
          <h2 id="sin-www">¿Y sin «www»?</h2>
          <p>
            Para que <span class="cifra">{registrableDe(www.hostname)}</span> también llegue a tu
            tienda, redirígelo a <span class="cifra">{www.hostname}</span> desde tu proveedor:
          </p>
          <dl class="datos">
            {REDIRIGIR_LA_RAIZ.map((r) => (
              <div key={r.proveedor}>
                <dt>{r.proveedor}</dt>
                <dd>{r.pasos.replaceAll('tudominio', registrableDe(www.hostname))}</dd>
              </div>
            ))}
          </dl>
          {puedeGestionar && disponible ? (
            <>
              <p>Si tu proveedor deja un CNAME en la raíz, conéctala aquí:</p>
              <Conectar
                conexion={conexion}
                sugerencia={registrableDe(www.hostname)}
                directo
                alConectar={() => {
                  setListo('Ahora crea los registros de la dirección sin «www».');
                  void cargar();
                }}
                alVencer={alVencer}
              />
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

const leerDominioRaiz = (hostname: string) => {
  const l = leerDominio(hostname);
  return l.ok && l.raiz;
};
const registrableDe = (hostname: string) => {
  const l = leerDominio(hostname);
  return l.ok ? l.registrable : hostname;
};
