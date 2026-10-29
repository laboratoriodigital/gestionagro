/**
 * «Más › Páginas» (HU-T10.2): las páginas propias de la tienda, como «Quiénes somos» o «Cómo
 * comprar», sin tocar código. El texto es Markdown sencillo (negrita, listas, enlaces); la dirección
 * sale del título y la API rechaza las que usa la tienda (CA2). Salen en la tienda al publicar, con
 * su enlace en el pie.
 */
import { sugerirDireccion } from '@ed1/tienda-schema/alta';
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { opNueva } from '../catalogo.ts';
import { Casilla, Confirmar, Texto } from '../componentes/index.ts';
import { EnGoogle } from './EnGoogle.tsx';

interface Pagina {
  id: string;
  slug: string;
  titulo: string;
  cuerpo: string;
  visible: boolean;
  version: number;
  /** HU-P4.4: cómo sale en Google; sin él, el título y el comienzo del texto. */
  buscadores?: { titulo?: string; descripcion?: string };
}

type Borrador = Omit<Pagina, 'id' | 'version'> & { id?: string; version?: number };
const NUEVA: Borrador = { slug: '', titulo: '', cuerpo: '', visible: true };

function Editor({
  conexion,
  inicial,
  tienda,
  alTerminar,
  alVencer,
}: {
  conexion: Conexion;
  inicial: Borrador;
  tienda: string;
  alTerminar: (mensaje: string) => void;
  alVencer: (motivo: string) => void;
}) {
  const [f, setF] = useState(inicial);
  const [tocada, setTocada] = useState(Boolean(inicial.id));
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setF((x) => ({ ...x, [k]: v }));
  const error = (campo: string) => errores.find((e) => e.campo === campo)?.mensaje;

  const guardar = async (e: Event) => {
    e.preventDefault();
    setGuardando(true);
    const r = await pedirAlPanel<{ slug: string }>(conexion, 'paginas/guardar', {
      cuerpo: { op: opNueva(), ...f },
    });
    setGuardando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setErrores(r.problemas?.length ? r.problemas : [{ campo: 'titulo', mensaje: r.motivo }]);
      return;
    }
    alTerminar(`Guardaste «${f.titulo}». Sale en tu tienda en /${r.datos.slug}/ cuando publiques.`);
  };

  return (
    <form class="formulario" onSubmit={guardar} noValidate>
      {errores.length > 0 ? <ResumenDeErrores errores={errores} /> : null}
      <Texto
        id="titulo"
        etiqueta="Título"
        valor={f.titulo}
        alCambiar={(v) => {
          poner('titulo', v);
          if (!tocada) poner('slug', sugerirDireccion(v));
        }}
        error={error('titulo')}
      />
      <Texto
        id="slug"
        etiqueta="Su dirección en tu tienda"
        valor={f.slug}
        alCambiar={(v) => {
          setTocada(true);
          poner('slug', v);
        }}
        error={error('slug')}
        ayuda="Letras sin tildes, números y guiones, como quienes-somos."
      />
      <div class={`ed1-campo${error('cuerpo') ? ' ed1-campo--con-error' : ''}`}>
        <label class="ed1-campo__etiqueta" for="cuerpo">
          El texto
        </label>
        <p class="ed1-campo__ayuda" id="cuerpo-ayuda">
          Separa los párrafos con una línea en blanco. Usa **dos asteriscos** para la negrita y un
          guion al empezar la línea para una lista.
        </p>
        <textarea
          class="ed1-campo__control"
          id="cuerpo"
          rows={10}
          aria-describedby="cuerpo-ayuda"
          value={f.cuerpo}
          onInput={(e) => poner('cuerpo', (e.target as HTMLTextAreaElement).value)}
        />
        {error('cuerpo') ? <p class="ed1-campo__error">{error('cuerpo')}</p> : null}
      </div>
      <Casilla
        id="visible"
        etiqueta="Mostrarla en la tienda"
        marcada={f.visible}
        alCambiar={(v) => poner('visible', v)}
      />
      <EnGoogle
        id="en-google"
        valor={{
          titulo: f.buscadores?.titulo ?? '',
          descripcion: f.buscadores?.descripcion ?? '',
        }}
        alCambiar={(v) => poner('buscadores', v)}
        tituloDeFabrica={`${f.titulo.trim() || 'Tu página'} · ${tienda}`}
        descripcionDeFabrica=""
        direccion={`/${f.slug.trim() || 'tu-pagina'}/`}
        errores={{
          titulo: error('buscadores.titulo'),
          descripcion: error('buscadores.descripcion'),
        }}
      />
      <div class="acciones">
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={guardando}
          aria-busy={guardando ? 'true' : undefined}
        >
          Guardar la página
        </button>
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          onClick={() => alTerminar('')}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function Paginas({
  conexion,
  tienda = 'tu tienda',
  alVencer,
}: {
  conexion: Conexion;
  tienda?: string;
  alVencer: (motivo: string) => void;
}) {
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<{ paginas: Pagina[] }>(conexion, 'paginas');
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setFalla(r.motivo);
    setFalla(null);
    setPaginas(r.datos.paginas);
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const borrar = async (p: Pagina) => {
    const r = await pedirAlPanel(conexion, 'paginas/borrar', {
      cuerpo: { op: opNueva(), id: p.id, version: p.version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setAviso(
      r.tipo === 'ok'
        ? `«${p.titulo}» quedó en la papelera. Sale de tu tienda cuando publiques.`
        : r.motivo,
    );
    await cargar();
  };

  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Páginas</h1>
      <p class="nota">
        Cuenta quién eres, cómo compras o lo que tus clientes preguntan. Cada página sale en tu
        tienda, con su enlace al final de cada página, cuando publicas.
      </p>
      {aviso ? (
        <Aviso tono="info" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      {editando ? (
        <Editor
          conexion={conexion}
          inicial={editando}
          tienda={tienda}
          alVencer={alVencer}
          alTerminar={(mensaje) => {
            setEditando(null);
            setAviso(mensaje || null);
            void cargar();
          }}
        />
      ) : (
        <button
          class="ed1-boton ed1-boton--primario"
          type="button"
          onClick={() => {
            setAviso(null);
            setEditando(NUEVA);
          }}
        >
          Nueva página
        </button>
      )}
      {falla ? (
        <Aviso tono="peligro" titulo="No pudimos leer las páginas">
          {falla}
        </Aviso>
      ) : null}
      {!paginas && !falla ? <p role="status">Leyendo las páginas…</p> : null}
      {paginas && paginas.length === 0 && !editando ? (
        <p>Todavía no tienes páginas. Una buena primera es «Quiénes somos».</p>
      ) : null}
      {paginas && paginas.length > 0 && !editando ? (
        <ul class="lineas">
          {paginas.map((p) => (
            <li key={p.id}>
              <span>
                <strong>{p.titulo}</strong>
                <span class="fila__detalle">
                  {' '}
                  · /{p.slug}/{p.visible ? '' : ' · oculta'}
                </span>
              </span>
              <span class="acciones acciones--fila">
                <button
                  class="ed1-boton ed1-boton--secundario"
                  type="button"
                  onClick={() => {
                    setAviso(null);
                    setEditando(p);
                  }}
                >
                  Editar «{p.titulo}»
                </button>
                <Confirmar
                  abrir={`Borrar «${p.titulo}»`}
                  consecuencia="Queda en la papelera 30 días y sale de tu tienda cuando publiques."
                  confirmar={`Sí, borrar «${p.titulo}»`}
                  alConfirmar={() => borrar(p)}
                />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
