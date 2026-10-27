/**
 * HU-T10.4: publicar y las versiones. «Publicar» dice todo lo que falta, con dónde se arregla, o
 * cómo va; «Versiones» dice cuándo, quién y qué, y «Volver a esta» mueve la tienda a una anterior
 * sin tocar pedidos ni inventario.
 *
 * HU-T8.6: «Ver antes de publicar» hornea lo de ahora sin publicarlo y da el enlace de la vista
 * previa, que dura un día; si a la tienda le falta algo para publicar, también lo dice.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, type FallaDeLaCompuerta, pedirAlPanel } from '../api.ts';
import { Confirmar, Guia } from '../componentes/index.ts';
import {
  avanceDe,
  cuando,
  enCurso,
  enlaceDe,
  esperaAntesDeLeer,
  resumenDe,
  sePuedeVolver,
  TANDAS_DEL_PANEL,
  type Versiones,
} from '../publicacion.ts';

type Resultado =
  | { tipo: 'publicada'; version: number }
  | { tipo: 'nada-cambio'; version: number | null }
  | { tipo: 'volvio'; version: number }
  | { tipo: 'compuerta'; fallas: FallaDeLaCompuerta[]; motivo: string }
  | { tipo: 'error'; motivo: string };

export function Publicar({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [datos, setDatos] = useState<Versiones | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [publicando, setPublicando] = useState(false);
  const [lecturas, setLecturas] = useState(0);
  const [faltan, setFaltan] = useState<number | null>(null);
  const [vista, setVista] = useState<
    | { tipo: 'lista'; url: string; vence: string; fallas: FallaDeLaCompuerta[] }
    | { tipo: 'error'; motivo: string }
    | null
  >(null);
  const [preparando, setPreparando] = useState(false);

  const verAntes = async () => {
    setPreparando(true);
    setVista(null);
    const r = await pedirAlPanel<{ url: string; vence: string; fallas: FallaDeLaCompuerta[] }>(
      conexion,
      'vista-previa',
      { cuerpo: {} },
    );
    setPreparando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setVista(r.tipo === 'ok' ? { tipo: 'lista', ...r.datos } : { tipo: 'error', motivo: r.motivo });
  };

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<Versiones>(conexion, 'publicaciones');
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setFalla(r.motivo);
    setFalla(null);
    setDatos(r.datos);
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  const horneando = datos?.versiones.some(enCurso) ?? false;
  // Mientras algo se hornea, la lista se vuelve a leer cada vez más espaciado; al terminar, vuelve
  // a empezar en 3 s para la próxima.
  useEffect(() => {
    if (!horneando) return setLecturas(0);
    const t = setTimeout(() => {
      setLecturas((n) => n + 1);
      void cargar();
    }, esperaAntesDeLeer(lecturas));
    return () => clearTimeout(t);
  }, [horneando, datos, cargar, lecturas]);

  const publicar = async () => {
    setPublicando(true);
    setResultado(null);
    setFaltan(null);
    // Una tienda grande se sube por tandas (bitácora tienda3 30): se pide otra mientras falte.
    let r = await pedirAlPanel<{ estado: string; version: number | null; faltan?: number }>(
      conexion,
      'publicar',
      { cuerpo: {} },
    );
    for (
      let tanda = 1;
      tanda < TANDAS_DEL_PANEL && r.tipo === 'ok' && r.datos.estado === 'por-tandas';
      tanda++
    ) {
      setFaltan(r.datos.faltan ?? null);
      r = await pedirAlPanel(conexion, 'publicar', { cuerpo: {} });
    }
    setPublicando(false);
    setFaltan(null);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo === 'ok' && r.datos.estado === 'por-tandas')
      setResultado({
        tipo: 'error',
        motivo:
          'Tu tienda es grande y no alcanzó a subir toda. Vuelve a publicar: sigue donde quedó.',
      });
    else if (r.tipo === 'ok')
      setResultado(
        r.datos.estado === 'publicada'
          ? { tipo: 'publicada', version: r.datos.version as number }
          : { tipo: 'nada-cambio', version: r.datos.version },
      );
    else if (r.tipo === 'error' && r.estado === 'compuerta' && r.fallas)
      setResultado({ tipo: 'compuerta', fallas: r.fallas, motivo: r.motivo });
    else setResultado({ tipo: 'error', motivo: r.motivo });
    await cargar();
  };

  const volver = async (version: number) => {
    const r = await pedirAlPanel(conexion, 'publicaciones/volver', { cuerpo: { version } });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setResultado(
      r.tipo === 'ok' ? { tipo: 'volvio', version } : { tipo: 'error', motivo: r.motivo },
    );
    await cargar();
  };

  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Publicar</h1>
      <Guia guia="publicar" />
      <p class="nota">
        Lo que cambies en el panel sale en la tienda cuando publicas. Si algo no queda bien, vuelves
        a una versión anterior en segundos.
      </p>
      <button
        class="ed1-boton ed1-boton--primario"
        type="button"
        disabled={publicando || horneando}
        aria-busy={publicando ? 'true' : undefined}
        onClick={() => void publicar()}
      >
        Publicar los cambios
      </button>
      <button
        class="ed1-boton ed1-boton--secundario"
        type="button"
        disabled={preparando || publicando}
        aria-busy={preparando ? 'true' : undefined}
        onClick={() => void verAntes()}
      >
        Ver antes de publicar
      </button>
      {preparando ? <p role="status">Preparando la vista previa…</p> : null}
      {vista?.tipo === 'lista' ? (
        <Aviso tono="info" titulo="Tu vista previa está lista">
          <p>
            <a href={vista.url} target="_blank" rel="noopener">
              Abrir la vista previa
            </a>
            . Así se verá tu tienda cuando publiques; tus clientes siguen viendo la de ahora. El
            enlace dura un día.
          </p>
          {vista.fallas.length > 0 ? (
            <>
              <p>Antes de publicar te falta:</p>
              <ul>
                {vista.fallas.map((f) => (
                  <li key={`${f.codigo}-${f.mensaje}`}>{f.mensaje}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Aviso>
      ) : null}
      {vista?.tipo === 'error' ? (
        <Aviso tono="peligro" titulo="No pudimos preparar la vista previa">
          {vista.motivo}
        </Aviso>
      ) : null}
      {publicando || horneando ? (
        <p role="status">
          {publicando
            ? avanceDe(faltan)
            : 'Hay una publicación en curso; esta página se pone al día sola.'}
        </p>
      ) : null}
      {resultado?.tipo === 'publicada' ? (
        <Aviso tono="exito" titulo={`Publicaste la versión ${resultado.version}`}>
          En menos de un minuto la ve todo el que entre a tu tienda.
        </Aviso>
      ) : null}
      {resultado?.tipo === 'nada-cambio' ? (
        <Aviso tono="info" titulo="Tu tienda ya está al día">
          Ya muestra lo mismo que tienes en el panel, así que no hizo falta una versión nueva. Lo
          que no se ve en la tienda, como las llaves de Bold, funciona sin publicar.
        </Aviso>
      ) : null}
      {resultado?.tipo === 'volvio' ? (
        <Aviso tono="exito" titulo={`La tienda volvió a la versión ${resultado.version}`}>
          Los pedidos y el inventario no cambian. En menos de un minuto la ve todo el que entre.
        </Aviso>
      ) : null}
      {resultado?.tipo === 'error' ? (
        <Aviso tono="peligro" titulo="No se publicó">
          {resultado.motivo}
        </Aviso>
      ) : null}
      {resultado?.tipo === 'compuerta' ? (
        <Aviso tono="peligro" titulo={resultado.motivo}>
          <ul>
            {resultado.fallas.map((f) => {
              const enlace = enlaceDe(f.donde);
              return (
                <li key={`${f.codigo}-${f.mensaje}`}>
                  {f.mensaje}
                  {enlace ? (
                    <>
                      {' '}
                      (<a href={enlace}>{f.donde}</a>)
                    </>
                  ) : (
                    ` (${f.donde})`
                  )}
                </li>
              );
            })}
          </ul>
        </Aviso>
      ) : null}

      <h2>Versiones</h2>
      {falla ? (
        <Aviso tono="peligro" titulo="No pudimos leer las versiones">
          {falla}
        </Aviso>
      ) : null}
      {!datos && !falla ? <p role="status">Leyendo las versiones…</p> : null}
      {datos && datos.versiones.length === 0 ? <p>Todavía no has publicado tu tienda.</p> : null}
      {datos && datos.versiones.length > 0 ? (
        <ol class="lineas versiones">
          {datos.versiones.map((v) => (
            <li key={v.version}>
              <span>
                <strong>Versión {v.version}</strong>
                <span class="fila__detalle">
                  {' '}
                  · {cuando(v)} · {v.autor} · {resumenDe(v, datos.versionPublicada)}
                </span>
              </span>
              {sePuedeVolver(v, datos.versionPublicada) ? (
                <Confirmar
                  abrir={`Volver a la versión ${v.version}`}
                  consecuencia="La tienda se verá como en esa versión. Los pedidos y el inventario no cambian, y las existencias se ponen al día solas."
                  confirmar={`Sí, volver a la versión ${v.version}`}
                  alConfirmar={() => volver(v.version)}
                />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </main>
  );
}
