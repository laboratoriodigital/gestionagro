/**
 * HU-T7.2: los términos del servicio y el contrato de transmisión. Al entrar por primera vez, o
 * cuando cambia su versión, el propietario los ve antes que el resto del panel (CA1); el
 * colaborador los puede leer y el panel le dice quién los acepta. La casilla nunca viene marcada.
 * Lo que no se acepta aquí lo niega la API igual (CA3): publicar y conectar el cobro.
 *
 * `Aceptable` es el texto con su casilla; la pantalla Cobro lo usa para la custodia de las llaves
 * de Bold (HU-T11.2).
 */
import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { Conexion } from '../api.ts';
import { Casilla } from '../componentes/index.ts';
import {
  aceptarTexto,
  fechaLegible,
  leerTerminos,
  type TerminosDelPanel,
  type TextoDelComercio,
} from '../terminos.ts';

/** El texto, su casilla y el botón. `alAceptar` corre después de que la API lo guardó. */
export function Aceptable({
  conexion,
  texto,
  boton,
  alAceptar,
  alCambiar,
  alVencer,
}: {
  conexion: Conexion;
  texto: TextoDelComercio;
  boton: string;
  alAceptar: () => void;
  /** El texto cambió mientras se leía: hay que volver a traerlo. */
  alCambiar: () => void;
  alVencer: (motivo: string) => void;
}) {
  const [marcada, setMarcada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviar = async () => {
    setEnviando(true);
    setError(null);
    const r = await aceptarTexto(conexion, texto);
    setEnviando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo === 'ok') return alAceptar();
    setError(r.motivo);
    setMarcada(false);
    if (r.estado === 'cambiado') alCambiar();
  };
  return (
    <>
      {texto.secciones.map(([titulo, parrafo]) => (
        <section key={titulo}>
          <h2>{titulo}</h2>
          <p>{parrafo}</p>
        </section>
      ))}
      {error ? (
        <Aviso tono="peligro" titulo="No quedó aceptado">
          {error}
        </Aviso>
      ) : null}
      <Casilla
        id={`aceptar-${texto.cual}`}
        marcada={marcada}
        alCambiar={setMarcada}
        etiqueta={<span>{texto.aceptar}</span>}
      />
      <div class="acciones">
        <button
          class="ed1-boton ed1-boton--primario"
          type="button"
          disabled={!marcada || enviando}
          aria-busy={enviando ? 'true' : undefined}
          onClick={() => void enviar()}
        >
          {boton}
        </button>
      </div>
    </>
  );
}

type Lectura =
  | { tipo: 'cargando' }
  | { tipo: 'error'; motivo: string }
  | { tipo: 'listo'; datos: TerminosDelPanel };

export function Terminos({
  conexion,
  rol,
  pedir,
  alAceptar,
  alVencer,
}: {
  conexion: Conexion;
  rol: string;
  /** El panel los pide antes de seguir (CA1): sin «volver a Más». */
  pedir: boolean;
  alAceptar: () => void;
  alVencer: (motivo: string) => void;
}) {
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando' });
  const cargar = useCallback(async () => {
    const r = await leerTerminos(conexion);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setLectura({ tipo: 'error', motivo: r.motivo });
    setLectura({ tipo: 'listo', datos: r.datos });
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const volver = pedir ? null : (
    <p>
      <a href="/mas/">Más</a>
    </p>
  );
  if (lectura.tipo === 'cargando')
    return (
      <main class="contenido" role="status">
        {volver}
        Abriendo los términos…
      </main>
    );
  if (lectura.tipo === 'error')
    return (
      <main class="contenido">
        {volver}
        <Aviso tono="peligro" titulo="No pudimos abrir los términos">
          {lectura.motivo}
        </Aviso>
        <button class="ed1-boton ed1-boton--secundario" type="button" onClick={() => void cargar()}>
          Intentar otra vez
        </button>
      </main>
    );
  const { datos } = lectura;
  const t = datos.terminos;
  return (
    <main class="contenido texto-legal">
      {volver}
      <h1>Términos del servicio de la Tienda</h1>
      <p>
        Versión {t.version}, del {fechaLegible(datos.fecha)}.
      </p>
      {datos.estado !== 'vigente' ? (
        <p class="texto-legal__aviso">
          <strong>Borrador: {datos.revision}.</strong> Lo marcado «por completar» se completará
          antes de que sea la versión vigente.
        </p>
      ) : null}
      {pedir ? (
        <Aviso tono="info" titulo="Antes de seguir">
          Lee y acepta los términos en nombre de tu tienda. Sin ellos no se puede publicar ni cobrar
          en línea.
        </Aviso>
      ) : null}
      {t.aceptados ? (
        <>
          <Aviso tono="exito" titulo="Tu tienda ya los aceptó">
            Esta es la versión vigente. Si cambia, te la mostramos otra vez.
          </Aviso>
          {t.secciones.map(([titulo, parrafo]) => (
            <section key={titulo}>
              <h2>{titulo}</h2>
              <p>{parrafo}</p>
            </section>
          ))}
        </>
      ) : puede(rol, 'terminos.aceptar') ? (
        <Aceptable
          conexion={conexion}
          texto={t}
          boton={pedir ? 'Aceptar y seguir' : 'Aceptar'}
          alAceptar={() => {
            alAceptar();
            void cargar();
          }}
          alCambiar={() => void cargar()}
          alVencer={alVencer}
        />
      ) : (
        <>
          <Aviso tono="aviso" titulo="Los acepta quien administra la tienda">
            Hasta que los acepte, la tienda no se puede publicar ni cobrar en línea. Lo demás lo
            puedes hacer igual.
          </Aviso>
          {t.secciones.map(([titulo, parrafo]) => (
            <section key={titulo}>
              <h2>{titulo}</h2>
              <p>{parrafo}</p>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
