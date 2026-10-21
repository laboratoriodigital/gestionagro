/**
 * HU-T8.2: crear o editar un producto con sus opciones y combinaciones desde el teléfono.
 *
 * - Se guarda entero: opciones, combinaciones, precios y existencias en una sola escritura.
 * - CA2: si alguien más guardó antes, la API responde «cambiado» y la pantalla lo dice, sin pisar
 *   lo de la otra persona; «Ver cómo quedó» vuelve a leer.
 * - CA4: precio y existencias se escriben siempre; «no se cuenta» es una casilla, no un vacío.
 * - Lo escrito se guarda en el teléfono mientras se escribe (HU-T8.1 CA2).
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Almacen } from '../almacen.ts';
import { type Conexion, pedirAlPanel } from '../api.ts';
import {
  type Combinacion,
  campoDelProblema,
  claveDe,
  combinacion,
  combinacionesDe,
  cuerpoDe,
  ESTADOS,
  type FormularioDeProducto,
  formularioDe,
  opNueva,
  type ProductoDelPanel,
} from '../catalogo.ts';
import { Casilla, Confirmar, Texto } from '../componentes/index.ts';
import { irA } from '../ruta.ts';
import { Fotos } from './Fotos.tsx';

type Error = { campo: string; mensaje: string };

/** El borrador de este producto en esta versión: otra versión empieza de lo que hay en la tienda. */
const claveDelBorrador = (p: ProductoDelPanel | null) =>
  `borrador:producto:${p ? `${p.id}:${p.version}` : 'nuevo'}`;

function Formulario({
  conexion,
  almacen,
  producto,
  alGuardar,
  guardado = null,
  alVencer,
  alRecargar,
}: {
  conexion: Conexion;
  almacen: Almacen;
  producto: ProductoDelPanel | null;
  alGuardar: (id: string) => void;
  /** Cuándo se guardó por última vez: se dice junto al botón, con el acceso a publicar. */
  guardado?: number | null;
  alVencer: (motivo: string) => void;
  alRecargar: () => void;
}) {
  const [f, setF] = useState<FormularioDeProducto>(() => formularioDe(producto));
  const tocado = useRef(false);
  const op = useRef(opNueva());
  const [errores, setErrores] = useState<Error[]>([]);
  const [cambiado, setCambiado] = useState<string | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void almacen.leer<FormularioDeProducto>(claveDelBorrador(producto)).then((g) => {
      if (vivo && g && !tocado.current) setF(g);
    });
    return () => {
      vivo = false;
    };
  }, [almacen, producto]);

  const cambiar = (cambio: (antes: FormularioDeProducto) => FormularioDeProducto) => {
    tocado.current = true;
    setF((antes) => {
      const despues = cambio(antes);
      void almacen.guardar(claveDelBorrador(producto), despues);
      return despues;
    });
  };
  const poner = <K extends keyof FormularioDeProducto>(campo: K, v: FormularioDeProducto[K]) =>
    cambiar((a) => ({ ...a, [campo]: v }));
  const ponerCombinacion = (clave: string, cambio: Partial<Combinacion>) =>
    cambiar((a) => ({
      ...a,
      combinaciones: { ...a.combinaciones, [clave]: { ...combinacion(a, clave), ...cambio } },
    }));

  const combinaciones = combinacionesDe(f.opciones);
  const enPantalla = combinaciones.map(claveDe);
  const errorDe = (id: string) =>
    errores
      .filter((e) => e.campo === id)
      .map((e) => e.mensaje)
      .join(' ') || undefined;

  const guardar = async (e: Event) => {
    e.preventDefault();
    setOcupado(true);
    setFalla(null);
    const { cuerpo, enviadas } = cuerpoDe(f, {
      op: op.current,
      ...(producto ? { id: producto.id, version: producto.version } : {}),
    });
    const r = await pedirAlPanel<{ id: string; version: number }>(conexion, 'productos/guardar', {
      cuerpo,
    });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo === 'ok') {
      await almacen.borrar(claveDelBorrador(producto));
      alGuardar(r.datos.id);
      return;
    }
    // Lo que se responde con problemas no se aplicó: la misma `op` se puede reusar al corregir.
    if (r.estado === 'problemas' && r.problemas) {
      setErrores(
        r.problemas.map((p) => ({
          campo: campoDelProblema(p.campo, enviadas, enPantalla),
          mensaje: p.mensaje,
        })),
      );
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>('.ed1-resumen-errores')?.focus(),
      );
      return;
    }
    setErrores([]);
    if (r.estado === 'cambiado') {
      op.current = opNueva();
      setCambiado(r.motivo);
      return;
    }
    setFalla(r.motivo);
  };

  const borrar = async () => {
    if (!producto) return;
    const r = await pedirAlPanel(conexion, 'productos/borrar', {
      cuerpo: { op: opNueva(), id: producto.id, version: producto.version },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      if (r.estado === 'cambiado') setCambiado(r.motivo);
      else setFalla(r.motivo);
      return;
    }
    await almacen.borrar(claveDelBorrador(producto));
    irA('/productos/');
  };

  return (
    <form class="formulario" noValidate onSubmit={(e) => void guardar(e)}>
      <ResumenDeErrores errores={errores} />
      {cambiado ? (
        <Aviso tono="aviso" titulo="Alguien más guardó este producto">
          <p>{cambiado}</p>
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            onClick={async () => {
              await almacen.borrar(claveDelBorrador(producto));
              alRecargar();
            }}
          >
            Ver cómo quedó
          </button>
        </Aviso>
      ) : null}
      <Texto
        id="nombre"
        etiqueta="Nombre"
        valor={f.nombre}
        alCambiar={(v) => poner('nombre', v)}
        error={errorDe('nombre')}
      />
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="estado">
          Estado
        </label>
        <select
          class="ed1-campo__control"
          id="estado"
          value={f.estado}
          onChange={(e) => poner('estado', (e.target as HTMLSelectElement).value)}
        >
          {ESTADOS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.texto}
            </option>
          ))}
        </select>
      </div>
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="descripcionMd">
          Descripción<span class="ed1-campo__opcional"> (opcional)</span>
        </label>
        <textarea
          class="ed1-campo__control"
          id="descripcionMd"
          rows={4}
          value={f.descripcion}
          onInput={(e) => poner('descripcion', (e.target as HTMLTextAreaElement).value)}
        />
      </div>

      <fieldset class="ed1-grupo" id="opciones">
        <legend class="ed1-grupo__titulo">Opciones</legend>
        <p class="nota">Talla, color, sabor… Sin opciones, el producto tiene un solo precio.</p>
        {errorDe('opciones') ? <p class="ed1-campo__error">{errorDe('opciones')}</p> : null}
        {f.opciones.map((o, i) => (
          <div class="opcion" key={i}>
            <Texto
              id={`o${i}-nombre`}
              etiqueta={`Nombre de la opción ${i + 1}`}
              valor={o.nombre}
              alCambiar={(v) =>
                poner(
                  'opciones',
                  f.opciones.map((x, j) => (j === i ? { ...x, nombre: v } : x)),
                )
              }
            />
            <Texto
              id={`o${i}-valores`}
              etiqueta={`Valores de ${o.nombre || `la opción ${i + 1}`}`}
              ayuda="Separados por coma: S, M, L"
              valor={o.valores}
              alCambiar={(v) =>
                poner(
                  'opciones',
                  f.opciones.map((x, j) => (j === i ? { ...x, valores: v } : x)),
                )
              }
            />
            <button
              class="ed1-boton ed1-boton--texto"
              type="button"
              onClick={() =>
                poner(
                  'opciones',
                  f.opciones.filter((_, j) => j !== i),
                )
              }
            >
              Quitar {o.nombre || `la opción ${i + 1}`}
            </button>
          </div>
        ))}
        {f.opciones.length < 3 ? (
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            onClick={() => poner('opciones', [...f.opciones, { nombre: '', valores: '' }])}
          >
            Agregar una opción
          </button>
        ) : null}
      </fieldset>

      <fieldset class="ed1-grupo" id="combinaciones">
        <legend class="ed1-grupo__titulo">
          {combinaciones.length === 1 ? 'Precio y existencias' : 'Combinaciones'}
        </legend>
        {errorDe('combinaciones') ? (
          <p class="ed1-campo__error">{errorDe('combinaciones')}</p>
        ) : null}
        {combinaciones.map((valores, i) => {
          const clave = claveDe(valores);
          const c = combinacion(f, clave);
          const nombre = valores.length > 0 ? valores.join(' / ') : null;
          return (
            <div class="combinacion" key={clave}>
              {nombre ? (
                <>
                  <p class="combinacion__nombre">{nombre}</p>
                  <Casilla
                    id={`c${i}-vende`}
                    etiqueta={`Se vende ${nombre}`}
                    marcada={c.vende}
                    alCambiar={(v) => ponerCombinacion(clave, { vende: v })}
                  />
                </>
              ) : null}
              {c.vende ? (
                <>
                  <Texto
                    id={`c${i}-precio`}
                    etiqueta={nombre ? `Precio de ${nombre}` : 'Precio'}
                    ayuda="En pesos, sin centavos."
                    numerico
                    valor={c.precio}
                    alCambiar={(v) => ponerCombinacion(clave, { precio: v })}
                    error={errorDe(`c${i}-precio`)}
                  />
                  <Texto
                    id={`c${i}-antes`}
                    etiqueta={nombre ? `Precio antes de ${nombre}` : 'Precio antes'}
                    ayuda="Si está en oferta: el precio tachado."
                    opcional
                    numerico
                    valor={c.antes}
                    alCambiar={(v) => ponerCombinacion(clave, { antes: v })}
                    error={errorDe(`c${i}-antes`)}
                  />
                  <Texto
                    id={`c${i}-stock`}
                    etiqueta={nombre ? `Existencias de ${nombre}` : 'Existencias'}
                    numerico
                    deshabilitado={c.noSeCuenta}
                    valor={c.noSeCuenta ? '' : c.stock}
                    alCambiar={(v) => ponerCombinacion(clave, { stock: v })}
                    error={errorDe(`c${i}-stock`)}
                  />
                  <Casilla
                    id={`c${i}-nocuenta`}
                    etiqueta={nombre ? `No se cuentan las de ${nombre}` : 'No se cuentan'}
                    marcada={c.noSeCuenta}
                    alCambiar={(v) => ponerCombinacion(clave, { noSeCuenta: v })}
                  />
                  <Texto
                    id={`c${i}-sku`}
                    etiqueta={nombre ? `Referencia (SKU) de ${nombre}` : 'Referencia (SKU)'}
                    opcional
                    valor={c.sku}
                    alCambiar={(v) => ponerCombinacion(clave, { sku: v })}
                    error={errorDe(`c${i}-sku`)}
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </fieldset>

      <Texto
        id="slug"
        etiqueta="Dirección en la tienda"
        opcional
        ayuda={
          producto
            ? 'Si la cambias, la dirección anterior lleva a la nueva.'
            : 'Si la dejas vacía, sale del nombre.'
        }
        valor={f.slug}
        alCambiar={(v) => poner('slug', v)}
        error={errorDe('slug')}
      />
      <div id="retracto">
        <Casilla
          id="retracto-aplica"
          etiqueta="Tiene derecho de retracto (el comprador puede devolverlo en 5 días hábiles)"
          marcada={f.retractoAplica}
          alCambiar={(v) => poner('retractoAplica', v)}
        />
        {f.retractoAplica ? null : (
          <Texto
            id="retracto-motivo"
            etiqueta="Por qué no aplica"
            ayuda="Por ejemplo: es un alimento perecedero."
            valor={f.retractoMotivo}
            alCambiar={(v) => poner('retractoMotivo', v)}
            error={errorDe('retracto')}
          />
        )}
      </div>
      <Casilla
        id="solo-mayores"
        etiqueta="Solo para mayores de edad"
        marcada={f.soloMayores}
        alCambiar={(v) => poner('soloMayores', v)}
      />
      {falla ? (
        <Aviso tono="peligro" titulo="No se guardó">
          {falla}
        </Aviso>
      ) : null}
      <button
        class="ed1-boton ed1-boton--primario"
        type="submit"
        disabled={ocupado}
        aria-busy={ocupado ? 'true' : undefined}
      >
        {producto ? 'Guardar cambios' : 'Crear producto'}
      </button>
      {guardado !== null && !ocupado ? (
        <p class="guardado" role="status">
          Guardado a las{' '}
          {new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' }).format(
            guardado,
          )}
          . Sale en tu tienda cuando publiques. <a href="/mas/publicar/">Publicar ahora</a>
        </p>
      ) : null}
      {producto ? (
        <Confirmar
          abrir="Mandar a la papelera"
          consecuencia={`«${producto.nombre}» deja de verse en la tienda. Lo puedes sacar de la papelera después.`}
          confirmar="Sí, a la papelera"
          alConfirmar={borrar}
        />
      ) : null}
    </form>
  );
}

export function Producto({
  conexion,
  almacen,
  id,
  alVencer,
}: {
  conexion: Conexion;
  almacen: Almacen;
  /** `null`: uno nuevo. */
  id: string | null;
  alVencer: (motivo: string) => void;
}) {
  const [producto, setProducto] = useState<ProductoDelPanel | null | 'cargando'>(
    id ? 'cargando' : null,
  );
  const [error, setError] = useState<string | null>(null);
  // La hora del último guardado: cada guardado lo dice junto al botón, no solo el primero.
  const [guardado, setGuardado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    const r = await pedirAlPanel<ProductoDelPanel>(conexion, `productos/${encodeURIComponent(id)}`);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') {
      setError(r.motivo);
      return;
    }
    setError(null);
    setProducto(r.datos);
  }, [conexion, id, alVencer]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <main class="contenido">
      <p>
        <a href="/productos/">Productos</a>
      </p>
      <h1>
        {producto === null
          ? 'Nuevo producto'
          : producto === 'cargando'
            ? 'Producto'
            : producto.nombre}
      </h1>
      {error ? (
        <Aviso tono="peligro" titulo="No pudimos abrir el producto">
          {error}
        </Aviso>
      ) : producto === 'cargando' ? (
        <p role="status">Cargando el producto…</p>
      ) : (
        <>
          {producto?.enPapelera ? (
            <Aviso tono="aviso" titulo="Está en la papelera">
              No se ve en la tienda. <a href="/productos/papelera/">Ir a la papelera</a>
            </Aviso>
          ) : null}
          <Formulario
            key={producto ? `${producto.id}:${producto.version}` : 'nuevo'}
            conexion={conexion}
            almacen={almacen}
            producto={producto}
            alVencer={alVencer}
            alRecargar={() => void cargar()}
            guardado={guardado}
            alGuardar={(nuevo) => {
              setGuardado(Date.now());
              if (!id) irA(`/productos/${nuevo}/`);
              else void cargar();
            }}
          />
          {producto && !producto.enPapelera ? (
            <Fotos
              conexion={conexion}
              producto={producto}
              alVencer={alVencer}
              alCambiar={() => void cargar()}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
