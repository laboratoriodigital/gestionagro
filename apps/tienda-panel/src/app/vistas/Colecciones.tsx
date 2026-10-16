/**
 * HU-T8.4: las colecciones. Un producto puede estar en varias; las colecciones se ordenan (CA1).
 * Borrar una colección no borra sus productos (CA2), y la confirmación lo dice.
 *
 * Una colección muestra sus productos de a 50 y agrega otros buscándolos, en vez de una casilla
 * por cada producto de la tienda: con 2.000, la lista se cortaba en 500 y guardar quitaba de la
 * colección los que no alcanzaban a verse (bitácora tienda3 21). Lo que no se ha cargado sigue
 * elegido: solo sale lo que se desmarca.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import {
  cuantosSeVen,
  type FilaDeProducto,
  opNueva,
  type PaginaDeProductos,
  rutaDeProductos,
  unirProductos,
} from '../catalogo.ts';
import { Confirmar } from '../componentes/index.ts';
import { crearTurno } from '../pedidos.ts';
import { irA } from '../ruta.ts';

export interface ColeccionDelPanel {
  id: string;
  slug: string;
  nombre: string;
  descripcionMd: string;
  visible: boolean;
  version: number;
  productos: string[];
}

type Lectura = { tipo: 'cargando' } | { tipo: 'error'; motivo: string } | { tipo: 'listo' };

function usarColecciones(conexion: Conexion, alVencer: (m: string) => void) {
  const [colecciones, setColecciones] = useState<ColeccionDelPanel[]>([]);
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando' });
  const cargar = useCallback(async () => {
    const c = await pedirAlPanel<{ colecciones: ColeccionDelPanel[] }>(conexion, 'colecciones');
    if (c.tipo === 'sin-sesion') return alVencer(c.motivo);
    if (c.tipo !== 'ok') {
      setLectura({ tipo: 'error', motivo: c.motivo });
      return;
    }
    setColecciones(c.datos.colecciones);
    setLectura({ tipo: 'listo' });
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return { colecciones, lectura, cargar };
}

export function Colecciones({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const { colecciones, lectura, cargar } = usarColecciones(conexion, alVencer);
  const [nombre, setNombre] = useState('');
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const crear = async (e: Event) => {
    e.preventDefault();
    const r = await pedirAlPanel<{ id: string }>(conexion, 'colecciones/guardar', {
      cuerpo: { op: opNueva(), nombre },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setErrores(
        (r.problemas ?? [{ campo: 'nombre', mensaje: r.motivo }]).map((p) => ({
          campo: 'nueva-coleccion',
          mensaje: p.mensaje,
        })),
      );
      return;
    }
    setErrores([]);
    setNombre('');
    irA(`/productos/colecciones/${r.datos.id}/`);
  };

  const mover = async (i: number, a: number) => {
    const ids = colecciones.map((c) => c.id);
    const [movida] = ids.splice(i, 1);
    if (!movida) return;
    ids.splice(a, 0, movida);
    const r = await pedirAlPanel(conexion, 'colecciones/ordenar', {
      cuerpo: { op: opNueva(), ids },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setAviso(r.tipo === 'ok' ? 'Orden guardado.' : r.motivo);
    await cargar();
  };

  return (
    <main class="contenido">
      <p>
        <a href="/productos/">Productos</a>
      </p>
      <h1>Colecciones</h1>
      <p class="nota">
        Agrupa tus productos: «Lino», «Nuevos», «Para regalar». Un producto puede estar en varias.
      </p>
      {aviso ? (
        <Aviso tono="info" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      {lectura.tipo === 'cargando' ? <p role="status">Cargando las colecciones…</p> : null}
      {lectura.tipo === 'error' ? (
        <Aviso tono="peligro" titulo="No pudimos leer las colecciones">
          {lectura.motivo}
        </Aviso>
      ) : null}
      {lectura.tipo === 'listo' && colecciones.length === 0 ? (
        <p>Todavía no tienes colecciones. Crea la primera aquí abajo.</p>
      ) : null}
      <ol class="colecciones">
        {colecciones.map((c, i) => (
          <li key={c.id} class="coleccion">
            <a href={`/productos/colecciones/${c.id}/`}>{c.nombre}</a>
            <span class="nota">
              {c.productos.length === 1 ? '1 producto' : `${c.productos.length} productos`}
              {c.visible ? '' : ' · escondida'}
            </span>
            <span class="coleccion__orden">
              <button
                class="ed1-boton ed1-boton--texto"
                type="button"
                disabled={i === 0}
                onClick={() => void mover(i, i - 1)}
              >
                Subir {c.nombre}
              </button>
              <button
                class="ed1-boton ed1-boton--texto"
                type="button"
                disabled={i === colecciones.length - 1}
                onClick={() => void mover(i, i + 1)}
              >
                Bajar {c.nombre}
              </button>
            </span>
          </li>
        ))}
      </ol>
      <form class="formulario" noValidate onSubmit={(e) => void crear(e)}>
        <ResumenDeErrores errores={errores} />
        <div class={`ed1-campo${errores.length ? ' ed1-campo--con-error' : ''}`}>
          <label class="ed1-campo__etiqueta" for="nueva-coleccion">
            Nombre de la colección nueva
          </label>
          <input
            class="ed1-campo__control"
            id="nueva-coleccion"
            type="text"
            value={nombre}
            aria-invalid={errores.length ? 'true' : undefined}
            onInput={(e) => setNombre((e.target as HTMLInputElement).value)}
          />
        </div>
        <button class="ed1-boton ed1-boton--primario" type="submit">
          Crear colección
        </button>
      </form>
    </main>
  );
}

export function Coleccion({
  conexion,
  id,
  alVencer,
}: {
  conexion: Conexion;
  id: string;
  alVencer: (motivo: string) => void;
}) {
  const { colecciones, lectura, cargar } = usarColecciones(conexion, alVencer);
  const actual = colecciones.find((c) => c.id === id) ?? null;
  // Los productos que se ven: los de la colección, de a 50, y los que se agregaron buscando.
  const [vistos, setVistos] = useState<FilaDeProducto[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  const [hallados, setHallados] = useState<FilaDeProducto[]>([]);
  const turno = useRef(crearTurno());

  const leerMiembros = useCallback(
    async (cursor: string | null) => {
      const r = await pedirAlPanel<PaginaDeProductos>(
        conexion,
        rutaDeProductos({ coleccion: id, cursor }),
      );
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') return;
      setSiguiente(r.datos.siguiente ?? null);
      setVistos((antes) => (cursor ? unirProductos(antes, r.datos.productos) : r.datos.productos));
    },
    [conexion, id, alVencer],
  );
  useEffect(() => {
    void leerMiembros(null);
  }, [leerMiembros, actual?.version]);

  useEffect(() => {
    const q = buscar.trim();
    const t = turno.current.tomar();
    if (!q) {
      setHallados([]);
      return;
    }
    const espera = setTimeout(async () => {
      const r = await pedirAlPanel<PaginaDeProductos>(conexion, rutaDeProductos({ q }));
      if (!turno.current.vigente(t)) return;
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      setHallados(r.tipo === 'ok' ? r.datos.productos : []);
    }, 250);
    return () => clearTimeout(espera);
  }, [buscar, conexion, alVencer]);
  const [nombre, setNombre] = useState('');
  const [visible, setVisible] = useState(true);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'aviso' | 'peligro'; texto: string } | null>(
    null,
  );

  useEffect(() => {
    if (!actual) return;
    setNombre(actual.nombre);
    setVisible(actual.visible);
    setElegidos(actual.productos);
  }, [actual?.id, actual?.version]);

  /** Marcar agrega al final (si no estaba) y deja el producto a la vista; desmarcar lo saca. */
  const elegir = (p: FilaDeProducto, si: boolean) => {
    setElegidos((antes) =>
      si ? (antes.includes(p.id) ? antes : [...antes, p.id]) : antes.filter((x) => x !== p.id),
    );
    setVistos((antes) => unirProductos(antes, [p]));
  };
  const porAgregar = hallados.filter((p) => !vistos.some((v) => v.id === p.id));
  // Los de la colección que todavía no se han cargado: siguen elegidos.
  const sinVer = elegidos.filter((x) => !vistos.some((v) => v.id === x)).length;

  const guardar = async (e: Event) => {
    e.preventDefault();
    if (!actual) return;
    // En el orden de la colección; lo que se agregó va al final.
    const r = await pedirAlPanel(conexion, 'colecciones/guardar', {
      cuerpo: { op: opNueva(), id, version: actual.version, nombre, visible, productos: elegidos },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo === 'ok') {
      setErrores([]);
      setAviso({ tono: 'exito', texto: 'Colección guardada.' });
      await cargar();
      return;
    }
    if (r.problemas) {
      setErrores(r.problemas.map((p) => ({ campo: 'nombre', mensaje: p.mensaje })));
      return;
    }
    setAviso({ tono: r.estado === 'cambiado' ? 'aviso' : 'peligro', texto: r.motivo });
    if (r.estado === 'cambiado') await cargar();
  };

  const borrar = async () => {
    if (!actual) return;
    const r = await pedirAlPanel(conexion, 'colecciones/borrar', {
      cuerpo: { op: opNueva(), id, version: actual.version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setAviso({ tono: 'peligro', texto: r.motivo });
      return;
    }
    irA('/productos/colecciones/');
  };

  if (lectura.tipo === 'cargando')
    return (
      <main class="contenido" role="status">
        Cargando la colección…
      </main>
    );
  if (lectura.tipo === 'error' || !actual)
    return (
      <main class="contenido">
        <h1>Colección</h1>
        <Aviso tono="peligro" titulo="No pudimos abrir la colección">
          {lectura.tipo === 'error' ? lectura.motivo : 'Esa colección ya no está.'}
        </Aviso>
        <p>
          <a href="/productos/colecciones/">Volver a colecciones</a>
        </p>
      </main>
    );

  return (
    <main class="contenido">
      <p>
        <a href="/productos/colecciones/">Colecciones</a>
      </p>
      <h1>{actual.nombre}</h1>
      {aviso ? (
        <Aviso tono={aviso.tono} titulo={aviso.tono === 'exito' ? 'Listo' : 'Atención'}>
          {aviso.texto}
        </Aviso>
      ) : null}
      <form class="formulario" noValidate onSubmit={(e) => void guardar(e)}>
        <ResumenDeErrores errores={errores} />
        <div class={`ed1-campo${errores.length ? ' ed1-campo--con-error' : ''}`}>
          <label class="ed1-campo__etiqueta" for="nombre">
            Nombre
          </label>
          <input
            class="ed1-campo__control"
            id="nombre"
            type="text"
            value={nombre}
            onInput={(e) => setNombre((e.target as HTMLInputElement).value)}
          />
        </div>
        <label class="casilla" for="visible">
          <input
            id="visible"
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible((e.target as HTMLInputElement).checked)}
          />
          Se ve en la tienda
        </label>
        <fieldset class="ed1-grupo">
          <legend class="ed1-grupo__titulo">Productos en «{actual.nombre}»</legend>
          {vistos.length === 0 ? (
            <p>Esta colección todavía no tiene productos. Búscalos aquí abajo para agregarlos.</p>
          ) : null}
          {vistos.map((p) => (
            <Casilla
              key={p.id}
              producto={p}
              elegido={elegidos.includes(p.id)}
              alCambiar={(si) => elegir(p, si)}
            />
          ))}
          {sinVer > 0 ? (
            <p class="nota">
              {cuantosSeVen(vistos.length, vistos.length + sinVer)} Los que no se ven siguen en la
              colección.
            </p>
          ) : null}
          {siguiente !== null ? (
            <button
              class="ed1-boton ed1-boton--secundario"
              type="button"
              onClick={() => void leerMiembros(siguiente)}
            >
              Ver más de «{actual.nombre}»
            </button>
          ) : null}
        </fieldset>
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="agregar">
            Agregar productos: búscalos por nombre
          </label>
          <input
            class="ed1-campo__control"
            id="agregar"
            type="search"
            value={buscar}
            onInput={(e) => setBuscar((e.target as HTMLInputElement).value)}
          />
        </div>
        {buscar.trim() ? (
          <fieldset class="ed1-grupo">
            <legend class="ed1-grupo__titulo">Para agregar</legend>
            {porAgregar.length === 0 ? (
              <p>Ningún otro producto se llama «{buscar.trim()}».</p>
            ) : null}
            {porAgregar.map((p) => (
              <Casilla
                key={p.id}
                producto={p}
                elegido={elegidos.includes(p.id)}
                alCambiar={(si) => elegir(p, si)}
              />
            ))}
          </fieldset>
        ) : null}
        <button class="ed1-boton ed1-boton--primario" type="submit">
          Guardar colección
        </button>
      </form>
      <Confirmar
        abrir="Borrar la colección"
        consecuencia={`Se borra «${actual.nombre}». Sus productos siguen en la tienda.`}
        confirmar="Sí, borrar la colección"
        alConfirmar={borrar}
      />
    </main>
  );
}

function Casilla({
  producto,
  elegido,
  alCambiar,
}: {
  producto: FilaDeProducto;
  elegido: boolean;
  alCambiar: (si: boolean) => void;
}) {
  return (
    <label class="casilla" for={`p-${producto.id}`}>
      <input
        id={`p-${producto.id}`}
        type="checkbox"
        checked={elegido}
        onChange={(e) => alCambiar((e.target as HTMLInputElement).checked)}
      />
      {producto.nombre}
    </label>
  );
}
