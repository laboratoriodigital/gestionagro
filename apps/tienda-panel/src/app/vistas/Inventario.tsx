/**
 * HU-T8.5: el inventario y su libro. La lista dice cuántas hay de cada combinación, cuántas están
 * apartadas por pagos en curso y cuántas personas esperan una agotada. Cada combinación tiene su
 * libro: por qué cambió cada número. Ajustar suma o resta; contar dice cuántas hay de verdad.
 */
import { Aviso, type EstadoDeContenido, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { opNueva } from '../catalogo.ts';
import { Confirmar, Lista } from '../componentes/index.ts';
import { horaDeBogota } from './Registro.tsx';

export interface FilaDeInventario {
  variante: string;
  producto: string;
  nombre: string;
  combinacion: string;
  sku: string | null;
  stock: number | null;
  apartadas: number;
  esperan: number;
  version: number;
}

interface Movimiento {
  id: number;
  delta: number;
  stock: number | null;
  motivo: string;
  ref: string | null;
  instante: string;
}

/** Cada motivo del libro (`ref_motivo_inventario`) como lo dice el comercio. */
export const MOTIVOS: Record<string, string> = {
  venta: 'Pedido confirmado',
  cancelacion: 'Pedido cancelado',
  devolucion: 'Devolución',
  ajuste: 'Ajuste',
  carga: 'Carga del archivo',
  conteo: 'Conteo',
};

const nombreDe = (f: FilaDeInventario) =>
  f.combinacion ? `${f.nombre} · ${f.combinacion}` : f.nombre;

const existencias = (f: FilaDeInventario) => {
  if (f.stock === null) return 'sin contar';
  const partes = [`${f.stock} en existencia`];
  if (f.apartadas > 0) partes.push(`${f.apartadas} apartadas`);
  if (f.esperan > 0) partes.push(f.esperan === 1 ? '1 persona espera' : `${f.esperan} esperan`);
  return partes.join(' · ');
};

export function Inventario({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [estado, setEstado] = useState<EstadoDeContenido<FilaDeInventario>>({ tipo: 'cargando' });
  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<{ filas: FilaDeInventario[] }>(conexion, 'inventario');
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setEstado(
      r.tipo === 'ok'
        ? { tipo: 'listo', elementos: r.datos.filas }
        : { tipo: 'error', causa: r.motivo },
    );
  }, [conexion, alVencer]);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <main class="contenido">
      <p>
        <a href="/productos/">Productos</a>
      </p>
      <h1>Inventario</h1>
      <p class="nota">
        Cuántas hay de cada combinación. Abre una para ajustarla, contarla o ver por qué cambió.
      </p>
      <Lista
        titulo="Inventario"
        estado={estado}
        vacio={{
          porque: 'Todavía no tienes productos.',
          accion: <a href="/productos/nuevo/">Crea el primero</a>,
        }}
        fila={(f: FilaDeInventario) => ({
          href: `/productos/inventario/${encodeURIComponent(f.variante)}/`,
          dato: nombreDe(f),
          estado:
            f.stock !== null && f.stock - f.apartadas <= 0 ? (
              <span class="estado estado--pendiente">Agotada</span>
            ) : undefined,
          detalle: existencias(f),
        })}
      />
    </main>
  );
}

type Lectura =
  | { tipo: 'cargando' }
  | { tipo: 'error'; motivo: string }
  | { tipo: 'listo'; fila: FilaDeInventario; movimientos: Movimiento[]; siguiente: number | null };

export function Existencias({
  conexion,
  variante,
  alVencer,
}: {
  conexion: Conexion;
  variante: string;
  alVencer: (motivo: string) => void;
}) {
  const [lectura, setLectura] = useState<Lectura>({ tipo: 'cargando' });
  const [tipo, setTipo] = useState<'ajuste' | 'conteo'>('ajuste');
  const [cantidad, setCantidad] = useState('');
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    async (desde: number | null = null) => {
      const r = await pedirAlPanel<{
        fila: FilaDeInventario;
        movimientos: Movimiento[];
        siguiente: number | null;
      }>(
        conexion,
        `inventario/${encodeURIComponent(variante)}${desde === null ? '' : `?cursor=${desde}`}`,
      );
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') {
        if (desde === null) setLectura({ tipo: 'error', motivo: r.motivo });
        return;
      }
      setLectura((antes) => ({
        tipo: 'listo',
        fila: r.datos.fila,
        movimientos: [
          ...(desde !== null && antes.tipo === 'listo' ? antes.movimientos : []),
          ...r.datos.movimientos,
        ],
        siguiente: r.datos.siguiente,
      }));
    },
    [conexion, variante, alVencer],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (lectura.tipo === 'cargando')
    return (
      <main class="contenido" role="status">
        Cargando el inventario…
      </main>
    );
  if (lectura.tipo === 'error')
    return (
      <main class="contenido">
        <p>
          <a href="/productos/inventario/">Inventario</a>
        </p>
        <Aviso tono="peligro" titulo="No pudimos leer esta combinación">
          {lectura.motivo}
        </Aviso>
      </main>
    );
  const { fila, movimientos, siguiente } = lectura;

  const guardar = async (e: Event) => {
    e.preventDefault();
    const texto = cantidad.trim().replace('−', '-');
    const n = Number(texto);
    if (texto === '' || !Number.isInteger(n)) {
      setErrores([{ campo: 'cantidad', mensaje: 'Escribe un número entero, sin puntos.' }]);
      return;
    }
    setGuardando(true);
    const r = await pedirAlPanel<{ version: number }>(conexion, 'inventario/ajustar', {
      cuerpo: { op: opNueva(), variante, version: fila.version, tipo, cantidad: n },
    });
    setGuardando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setErrores(
        (r.problemas ?? [{ campo: 'cantidad', mensaje: r.motivo }]).map((p) => ({
          campo: 'cantidad',
          mensaje: p.mensaje,
        })),
      );
      if (r.estado === 'cambiado') await cargar();
      return;
    }
    setErrores([]);
    setCantidad('');
    setAviso(tipo === 'conteo' ? 'Conteo guardado.' : 'Ajuste guardado.');
    await cargar();
  };

  const atender = async () => {
    const r = await pedirAlPanel(conexion, 'avisame/atender', {
      cuerpo: { op: opNueva(), variante },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    setAviso(r.tipo === 'ok' ? 'Listo: la cuenta de quienes esperan vuelve a cero.' : r.motivo);
    await cargar();
  };

  return (
    <main class="contenido">
      <p>
        <a href="/productos/inventario/">Inventario</a>
      </p>
      <h1>{nombreDe(fila)}</h1>
      <p class="cifra">{existencias(fila)}</p>
      {aviso ? (
        <Aviso tono="info" titulo="Listo">
          {aviso}
        </Aviso>
      ) : null}
      {fila.esperan > 0 ? (
        <section class="seccion">
          <h2>
            {fila.esperan === 1
              ? '1 persona pidió que le avises'
              : `${fila.esperan} personas pidieron que les avises`}
          </h2>
          <p class="nota">
            Te escribieron por WhatsApp desde la tienda: ahí están sus números. Cuando les avises,
            márcalo aquí.
          </p>
          <Confirmar
            abrir="Ya les avisé"
            consecuencia="La cuenta vuelve a cero y queda en el registro."
            confirmar="Sí, ya les avisé"
            alConfirmar={atender}
          />
        </section>
      ) : null}
      {fila.stock === null ? (
        <p>
          Esta combinación no cuenta existencias: se vende sin límite. Para contarlas, cámbialo en{' '}
          <a href={`/productos/${encodeURIComponent(fila.producto)}/`}>el producto</a>.
        </p>
      ) : (
        <form class="formulario" onSubmit={(e) => void guardar(e)} noValidate>
          <ResumenDeErrores errores={errores} />
          <fieldset class="ed1-grupo">
            <legend class="ed1-grupo__titulo">¿Qué pasó?</legend>
            <label class="casilla" for="tipo-ajuste">
              <input
                id="tipo-ajuste"
                type="radio"
                name="tipo"
                checked={tipo === 'ajuste'}
                onChange={() => setTipo('ajuste')}
              />
              Entraron o salieron unidades
            </label>
            <label class="casilla" for="tipo-conteo">
              <input
                id="tipo-conteo"
                type="radio"
                name="tipo"
                checked={tipo === 'conteo'}
                onChange={() => setTipo('conteo')}
              />
              Las conté
            </label>
          </fieldset>
          <div class={`ed1-campo${errores.length ? ' ed1-campo--con-error' : ''}`}>
            <label class="ed1-campo__etiqueta" for="cantidad">
              {tipo === 'conteo' ? '¿Cuántas hay?' : '¿Cuántas? Con menos (−) si salieron'}
            </label>
            <input
              class="ed1-campo__control cifra"
              id="cantidad"
              type="text"
              inputMode={tipo === 'conteo' ? 'numeric' : 'text'}
              value={cantidad}
              aria-invalid={errores.length ? 'true' : undefined}
              onInput={(e) => setCantidad((e.target as HTMLInputElement).value)}
            />
          </div>
          <button
            class="ed1-boton ed1-boton--primario"
            type="submit"
            disabled={guardando}
            aria-busy={guardando ? 'true' : undefined}
          >
            {tipo === 'conteo' ? 'Guardar el conteo' : 'Guardar el ajuste'}
          </button>
        </form>
      )}
      <h2>Libro</h2>
      {movimientos.length === 0 ? (
        <p>Todavía no ha cambiado.</p>
      ) : (
        <ol class="registro libro">
          {movimientos.map((m) => (
            <li key={m.id} class="registro__fila">
              <span class="registro__hora cifra">{horaDeBogota(m.instante)}</span>
              <span>
                {MOTIVOS[m.motivo] ?? m.motivo}:{' '}
                <span class="cifra">
                  {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`} → quedan {m.stock}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {siguiente !== null ? (
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          onClick={() => void cargar(siguiente)}
        >
          Ver más
        </button>
      ) : null}
    </main>
  );
}
