/**
 * HU-T8.2: la lista de productos, con su precio desde y sus existencias, para buscar y abrir uno.
 * La papelera es la misma lista con lo borrado: de ahí se saca. De a 50 con «Ver más», y dice
 * cuántos se ven de cuántos hay: con 2.000, la lista se cortaba en 500 sin decirlo (bitácora
 * tienda3 21). Cada lectura toma un turno y solo se pinta la última.
 */
import { Aviso, type EstadoDeContenido } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import {
  cuantosSeVen,
  ESTADOS,
  enPesos,
  type FilaDeProducto,
  opNueva,
  type PaginaDeProductos,
  rutaDeProductos,
  unirProductos,
} from '../catalogo.ts';
import { Lista } from '../componentes/index.ts';
import { crearTurno } from '../pedidos.ts';

const ESTADO_CORTO: Record<string, { texto: string; tono: string }> = {
  borrador: { texto: 'Borrador', tono: 'pendiente' },
  activo: { texto: 'Activo', tono: 'bien' },
  archivado: { texto: 'Archivado', tono: 'neutro' },
};

const existencias = (p: FilaDeProducto) =>
  p.existencias === null ? 'sin contar' : `${p.existencias} en existencia`;

export function Productos({
  conexion,
  papelera,
  alVencer,
}: {
  conexion: Conexion;
  papelera: boolean;
  alVencer: (motivo: string) => void;
}) {
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState<EstadoDeContenido<FilaDeProducto>>({ tipo: 'cargando' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [leyendo, setLeyendo] = useState(false);
  const turno = useRef(crearTurno());

  /** La primera página (`cursor` nulo) o la siguiente, que se une a lo que ya se ve. */
  const cargar = useCallback(
    async (q: string, cursor: string | null = null) => {
      const t = turno.current.tomar();
      setLeyendo(true);
      const r = await pedirAlPanel<PaginaDeProductos>(
        conexion,
        rutaDeProductos({ papelera, q, cursor }),
      );
      if (!turno.current.vigente(t)) return;
      setLeyendo(false);
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') {
        setEstado({ tipo: 'error', causa: r.motivo });
        return;
      }
      setSiguiente(r.datos.siguiente ?? null);
      setTotal(r.datos.total ?? r.datos.productos.length);
      setEstado((antes) => ({
        tipo: 'listo',
        elementos:
          cursor && antes.tipo === 'listo'
            ? unirProductos(antes.elementos, r.datos.productos)
            : r.datos.productos,
      }));
    },
    [conexion, papelera, alVencer],
  );
  const vistos = estado.tipo === 'listo' ? estado.elementos.length : 0;

  useEffect(() => {
    const t = setTimeout(() => void cargar(buscar.trim()), buscar ? 250 : 0);
    return () => clearTimeout(t);
  }, [cargar, buscar]);

  const restaurar = async (p: FilaDeProducto) => {
    const r = await pedirAlPanel<{ version: number }>(conexion, 'productos/restaurar', {
      cuerpo: { op: opNueva(), id: p.id, version: p.version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setAviso(r.problemas?.[0]?.mensaje ?? r.motivo);
      return;
    }
    setAviso(`«${p.nombre}» volvió a tus productos.`);
    await cargar(buscar.trim());
  };

  return (
    <main class="contenido">
      <h1>{papelera ? 'Papelera' : 'Productos'}</h1>
      {papelera ? (
        <p class="nota">
          Lo que mandaste a la papelera. No se ve en la tienda; puedes sacarlo de aquí.
        </p>
      ) : (
        <div class="acciones acciones--fila">
          <a class="ed1-boton ed1-boton--primario" href="/productos/nuevo/">
            Nuevo producto
          </a>
          <a class="ed1-boton ed1-boton--secundario" href="/productos/colecciones/">
            Categorías
          </a>
          <a class="ed1-boton ed1-boton--secundario" href="/productos/inventario/">
            Inventario
          </a>
          <a class="ed1-boton ed1-boton--secundario" href="/productos/varios/">
            Cambiar varios
          </a>
        </div>
      )}
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="buscar">
          Buscar por nombre
        </label>
        <input
          class="ed1-campo__control"
          id="buscar"
          type="search"
          value={buscar}
          onInput={(e) => setBuscar((e.target as HTMLInputElement).value)}
        />
      </div>
      {aviso ? (
        <Aviso tono="info" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      {papelera ? (
        <ul class="papelera">
          {estado.tipo === 'listo'
            ? estado.elementos.map((p) => (
                <li key={p.id} class="papelera__fila">
                  <span>{p.nombre}</span>
                  <button
                    class="ed1-boton ed1-boton--secundario"
                    type="button"
                    onClick={() => void restaurar(p)}
                  >
                    Sacar «{p.nombre}» de la papelera
                  </button>
                </li>
              ))
            : null}
        </ul>
      ) : null}
      {papelera && estado.tipo === 'listo' && estado.elementos.length > 0 ? null : (
        <Lista
          titulo={papelera ? 'Papelera' : 'Productos'}
          estado={estado}
          vacio={
            papelera
              ? { porque: 'La papelera está vacía.' }
              : buscar
                ? { porque: `Ningún producto se llama «${buscar}».` }
                : {
                    porque: 'Todavía no tienes productos.',
                    accion: <a href="/productos/nuevo/">Crea el primero</a>,
                  }
          }
          fila={(p: FilaDeProducto) => ({
            href: `/productos/${p.id}/`,
            dato: p.nombre,
            ...(p.desde === null
              ? {}
              : { monto: p.combinaciones > 1 ? `desde ${enPesos(p.desde)}` : enPesos(p.desde) }),
            estado: (
              <span class={`estado estado--${ESTADO_CORTO[p.estado]?.tono ?? 'neutro'}`}>
                {ESTADO_CORTO[p.estado]?.texto ??
                  ESTADOS.find((e) => e.id === p.estado)?.texto ??
                  p.estado}
              </span>
            ),
            detalle: `${p.combinaciones === 1 ? '1 combinación' : `${p.combinaciones} combinaciones`} · ${existencias(p)}`,
          })}
        />
      )}
      {estado.tipo === 'listo' && cuantosSeVen(vistos, total) ? (
        <p class="nota">{cuantosSeVen(vistos, total)}</p>
      ) : null}
      {siguiente !== null ? (
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          disabled={leyendo}
          onClick={() => void cargar(buscar.trim(), siguiente)}
        >
          Ver más productos
        </button>
      ) : null}
      {papelera ? (
        <p>
          <a href="/productos/">Volver a productos</a>
        </p>
      ) : (
        <p>
          <a href="/productos/papelera/">Ver la papelera</a>
        </p>
      )}
    </main>
  );
}
