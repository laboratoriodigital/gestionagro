/**
 * HU-T8.2: la lista de productos, con su precio desde y sus existencias, para buscar y abrir uno.
 * La papelera es la misma lista con lo borrado: de ahí se saca.
 */
import { Aviso, type EstadoDeContenido } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { ESTADOS, enPesos, type FilaDeProducto, opNueva } from '../catalogo.ts';
import { Lista } from '../componentes/index.ts';

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

  const cargar = useCallback(
    async (q: string) => {
      const r = await pedirAlPanel<{ productos: FilaDeProducto[] }>(
        conexion,
        `productos?${new URLSearchParams({ ...(papelera ? { papelera: '1' } : {}), q })}`,
      );
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      setEstado(
        r.tipo === 'ok'
          ? { tipo: 'listo', elementos: r.datos.productos }
          : { tipo: 'error', causa: r.motivo },
      );
    },
    [conexion, papelera, alVencer],
  );

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
            Colecciones
          </a>
          <a class="ed1-boton ed1-boton--secundario" href="/productos/inventario/">
            Inventario
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
