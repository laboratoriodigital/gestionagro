/**
 * HU-P3.1 (sprint PF1): cambiar varios productos a la vez, sin la hoja de cálculo. Se eligen uno
 * por uno o por su categoría, se elige el cambio y, antes de aplicar, la API dice cuántos productos
 * y combinaciones cambian, con un ejemplo. Todo o nada: queda en el registro.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import {
  enPesos,
  type FilaDeProducto,
  opNueva,
  type PaginaDeProductos,
  type PromocionEnPantalla,
  promocionDelCuerpo,
  promocionEnPantalla,
  rutaDeProductos,
} from '../catalogo.ts';
import { Confirmar, Texto } from '../componentes/index.ts';
import type { ColeccionDelPanel } from './Colecciones.tsx';
import { Promocion } from './Producto.tsx';

type Cambio =
  | 'subir-porcentaje'
  | 'bajar-porcentaje'
  | 'subir-valor'
  | 'bajar-valor'
  | 'activo'
  | 'borrador'
  | 'archivado'
  | 'papelera'
  | 'promocion'
  | 'sin-promocion';

const CAMBIOS: readonly [Cambio, string][] = [
  ['subir-porcentaje', 'Subir el precio un porcentaje'],
  ['bajar-porcentaje', 'Bajar el precio un porcentaje'],
  ['subir-valor', 'Subir el precio en pesos'],
  ['bajar-valor', 'Bajar el precio en pesos'],
  ['activo', 'Activar: se ven y se venden'],
  ['borrador', 'Pasar a borrador: no se ven'],
  ['archivado', 'Archivar: ya no se venden'],
  ['promocion', 'Poner una promoción por cantidad'],
  ['sin-promocion', 'Quitar la promoción'],
  ['papelera', 'Mandar a la papelera'],
];

interface VistaPrevia {
  productos: number;
  combinaciones: number;
  nombres: string[];
  ejemplo: { nombre: string; antes: number; despues: number } | null;
}

/** El cambio como lo pide la API. Un número ilegible va como texto: la API dice qué está mal. */
export function cambioDelCuerpo(
  cambio: Cambio,
  cantidad: string,
  promocion: PromocionEnPantalla,
): Record<string, unknown> {
  const n = /^\d+$/.test(cantidad.trim().replace(/\./g, ''))
    ? Number(cantidad.trim().replace(/\./g, ''))
    : cantidad;
  const conSigno = (s: 1 | -1) => (typeof n === 'number' ? s * n : n);
  switch (cambio) {
    case 'subir-porcentaje':
      return { tipo: 'precio', modo: 'porcentaje', cantidad: conSigno(1) };
    case 'bajar-porcentaje':
      return { tipo: 'precio', modo: 'porcentaje', cantidad: conSigno(-1) };
    case 'subir-valor':
      return { tipo: 'precio', modo: 'valor', cantidad: conSigno(1) };
    case 'bajar-valor':
      return { tipo: 'precio', modo: 'valor', cantidad: conSigno(-1) };
    case 'papelera':
      return { tipo: 'papelera' };
    case 'promocion':
      return { tipo: 'promocion', promocion: promocionDelCuerpo(promocion) };
    case 'sin-promocion':
      return { tipo: 'promocion', promocion: null };
    default:
      return { tipo: 'estado', estado: cambio };
  }
}

export function Varios({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [por, setPor] = useState<'elegidos' | 'coleccion'>('elegidos');
  const [buscar, setBuscar] = useState('');
  const [productos, setProductos] = useState<FilaDeProducto[]>([]);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [colecciones, setColecciones] = useState<ColeccionDelPanel[]>([]);
  const [coleccion, setColeccion] = useState('');
  const [cambio, setCambio] = useState<Cambio>('subir-porcentaje');
  const [cantidad, setCantidad] = useState('');
  const [promocion, setPromocion] = useState<PromocionEnPantalla>({
    ...promocionEnPantalla(null),
    tipo: 'regalo',
  });
  const [vista, setVista] = useState<VistaPrevia | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [op, setOp] = useState(opNueva);

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await pedirAlPanel<PaginaDeProductos>(
        conexion,
        rutaDeProductos({ q: buscar.trim() }),
      );
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo === 'ok') setProductos(r.datos.productos);
    }, 250);
    return () => clearTimeout(t);
  }, [conexion, buscar, alVencer]);
  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<{ colecciones: ColeccionDelPanel[] }>(conexion, 'colecciones');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo === 'ok') setColecciones(r.datos.colecciones);
    })();
  }, [conexion, alVencer]);

  const cuerpo = (vistaPrevia: boolean) => ({
    op,
    ...(por === 'elegidos' ? { ids: elegidos } : { coleccion }),
    cambio: cambioDelCuerpo(cambio, cantidad, promocion),
    vistaPrevia,
  });
  // Cualquier cambio en lo elegido deja la vista previa vieja: hay que revisar otra vez.
  const olvidar = () => {
    setVista(null);
    setListo(null);
  };
  const revisar = async () => {
    setFalla(null);
    const r = await pedirAlPanel<VistaPrevia>(conexion, 'productos/lote', { cuerpo: cuerpo(true) });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setFalla(r.problemas?.[0]?.mensaje ?? r.motivo);
      return;
    }
    setVista(r.datos);
  };
  const aplicar = async () => {
    const r = await pedirAlPanel<{ productos: number }>(conexion, 'productos/lote', {
      cuerpo: cuerpo(false),
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setFalla(r.problemas?.[0]?.mensaje ?? r.motivo);
      return;
    }
    setVista(null);
    setElegidos([]);
    setOp(opNueva());
    setListo(
      `Listo: cambiaste ${r.datos.productos === 1 ? '1 producto' : `${r.datos.productos} productos`}. Publica para que tus clientes lo vean.`,
    );
  };
  const necesitaCantidad = cambio.includes('porcentaje') || cambio.includes('valor');
  const nada = por === 'elegidos' ? elegidos.length === 0 : !coleccion;

  return (
    <main class="contenido">
      <h1>Cambiar varios productos</h1>
      <p class="nota">Elige los productos y el cambio. Antes de aplicarlo te decimos qué cambia.</p>
      {listo ? (
        <Aviso tono="exito" titulo="Cambios guardados">
          {listo} <a href="/mas/publicar/">Publicar</a>
        </Aviso>
      ) : null}

      <fieldset class="ed1-grupo">
        <legend class="ed1-grupo__titulo">¿Cuáles?</legend>
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="varios-por">
            Elegir
          </label>
          <select
            class="ed1-campo__control"
            id="varios-por"
            value={por}
            onChange={(e) => {
              setPor((e.target as HTMLSelectElement).value as 'elegidos' | 'coleccion');
              olvidar();
            }}
          >
            <option value="elegidos">Uno por uno</option>
            <option value="coleccion">Todos los de una categoría</option>
          </select>
        </div>
        {por === 'coleccion' ? (
          <div class="ed1-campo">
            <label class="ed1-campo__etiqueta" for="varios-coleccion">
              Categoría
            </label>
            <select
              class="ed1-campo__control"
              id="varios-coleccion"
              value={coleccion}
              onChange={(e) => {
                setColeccion((e.target as HTMLSelectElement).value);
                olvidar();
              }}
            >
              <option value="">Elige una</option>
              {colecciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <Texto
              id="varios-buscar"
              etiqueta="Buscar por nombre"
              valor={buscar}
              alCambiar={setBuscar}
            />
            <ul class="varios__lista">
              {productos.map((p) => (
                <li key={p.id}>
                  <label class="casilla">
                    <input
                      type="checkbox"
                      checked={elegidos.includes(p.id)}
                      onChange={(e) => {
                        const si = (e.target as HTMLInputElement).checked;
                        setElegidos((a) => (si ? [...a, p.id] : a.filter((x) => x !== p.id)));
                        olvidar();
                      }}
                    />
                    <span>
                      {p.nombre}
                      {p.desde === null ? '' : ` · ${enPesos(p.desde)}`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p class="nota">
              {elegidos.length === 1 ? '1 elegido' : `${elegidos.length} elegidos`}
            </p>
          </>
        )}
      </fieldset>

      <fieldset class="ed1-grupo">
        <legend class="ed1-grupo__titulo">¿Qué cambio?</legend>
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="varios-cambio">
            Cambio
          </label>
          <select
            class="ed1-campo__control"
            id="varios-cambio"
            value={cambio}
            onChange={(e) => {
              setCambio((e.target as HTMLSelectElement).value as Cambio);
              olvidar();
            }}
          >
            {CAMBIOS.map(([id, texto]) => (
              <option key={id} value={id}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        {necesitaCantidad ? (
          <Texto
            id="varios-cantidad"
            etiqueta={cambio.includes('porcentaje') ? 'Cuánto, en porcentaje' : 'Cuánto, en pesos'}
            valor={cantidad}
            alCambiar={(v) => {
              setCantidad(v);
              olvidar();
            }}
          />
        ) : null}
        {cambio === 'promocion' ? (
          <Promocion
            valor={promocion}
            alCambiar={(v) => {
              setPromocion(v);
              olvidar();
            }}
            error={undefined}
          />
        ) : null}
      </fieldset>

      {falla ? (
        <Aviso tono="peligro" titulo="Revisa">
          {falla}
        </Aviso>
      ) : null}
      {vista ? (
        <section class="seccion" aria-live="polite">
          <h2>
            Cambia {vista.productos === 1 ? '1 producto' : `${vista.productos} productos`} y{' '}
            {vista.combinaciones === 1 ? '1 combinación' : `${vista.combinaciones} combinaciones`}
          </h2>
          {vista.ejemplo ? (
            <p>
              Por ejemplo, «{vista.ejemplo.nombre}»: {enPesos(vista.ejemplo.antes)} →{' '}
              <strong>{enPesos(vista.ejemplo.despues)}</strong>
            </p>
          ) : null}
          <p class="nota">
            {vista.nombres.join(', ')}
            {vista.productos > vista.nombres.length ? '…' : ''}
          </p>
          <Confirmar
            abrir="Aplicar el cambio"
            consecuencia="Se aplica a todos a la vez y queda en el registro."
            confirmar="Sí, aplicar"
            alConfirmar={aplicar}
          />
        </section>
      ) : (
        <button
          class="ed1-boton ed1-boton--primario"
          type="button"
          disabled={nada}
          onClick={() => void revisar()}
        >
          Revisar el cambio
        </button>
      )}
      <p>
        <a href="/productos/">Volver a productos</a>
      </p>
    </main>
  );
}
