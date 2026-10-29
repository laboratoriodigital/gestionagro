/**
 * HU-T8.2: crear o editar un producto con sus opciones y combinaciones desde el teléfono.
 *
 * - Se guarda entero: opciones, combinaciones, precios y existencias en una sola escritura.
 * - CA2: si alguien más guardó antes, la API responde «cambiado» y la pantalla lo dice, sin pisar
 *   lo de la otra persona; «Ver cómo quedó» vuelve a leer.
 * - CA4: precio y existencias se escriben siempre; «no se cuenta» es una casilla, no un vacío.
 * - Lo escrito se guarda en el teléfono mientras se escribe (HU-T8.1 CA2).
 * - Validación del 28 oct 2026 (antes de producción): lo básico arriba (fotos, nombre, precio,
 *   unidades y descripción) y lo demás en secciones plegables que dicen lo que tienen. Las fotos de
 *   uno nuevo suben después de guardarlo como borrador; el precio tachado solo se muestra si ya
 *   estaba, porque para eso está la oferta con fecha. Lo que el plan no incluye va en una línea.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import type { ComponentChildren } from 'preact';
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
  type OfertaEnPantalla,
  ofertaEnPantalla,
  opNueva,
  type PideTextoEnPantalla,
  type ProductoDelPanel,
  type PromocionEnPantalla,
  pideTextoEnPantalla,
  promocionEnPantalla,
} from '../catalogo.ts';
import { Casilla, Confirmar, Texto } from '../componentes/index.ts';
import { irA } from '../ruta.ts';
import { ArchivosDigitales } from './ArchivosDigitales.tsx';
import { EnGoogle } from './EnGoogle.tsx';
import { Fotos } from './Fotos.tsx';

type Error = { campo: string; mensaje: string };

/** El borrador de este producto en esta versión: otra versión empieza de lo que hay en la tienda. */
const claveDelBorrador = (p: ProductoDelPanel | null) =>
  `borrador:producto:${p ? `${p.id}:${p.version}` : 'nuevo'}`;

function Formulario({
  conexion,
  almacen,
  producto,
  tienda,
  alGuardar,
  guardado = null,
  alVencer,
  alRecargar,
  funciones,
}: {
  conexion: Conexion;
  almacen: Almacen;
  producto: ProductoDelPanel | null;
  /** El nombre de la tienda, para el título que sale en Google sin uno propio (HU-P4.4). */
  tienda: string;
  alGuardar: (id: string) => void;
  /** Cuándo se guardó por última vez: se dice junto al botón, con el acceso a publicar. */
  guardado?: number | null;
  alVencer: (motivo: string) => void;
  alRecargar: () => void;
  /** Lo que permite el plan (`GET /yo`): lo que no incluye se dice en una línea. */
  funciones: Record<string, unknown> | null;
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
  // Sin saber el plan (`null`), se muestra todo y la API dice lo que no cabe.
  const delPlan = (clave: string) => !funciones || funciones[clave] === true;
  const errorDe = (id: string) =>
    errores
      .filter((e) => e.campo === id)
      .map((e) => e.mensaje)
      .join(' ') || undefined;

  /** `borrador`: guardarlo sin que se vea, para subirle fotos a uno nuevo. */
  const guardar = async (e: Event | null, opciones: { borrador?: boolean } = {}) => {
    e?.preventDefault();
    setOcupado(true);
    setFalla(null);
    const { cuerpo, enviadas } = cuerpoDe(opciones.borrador ? { ...f, estado: 'borrador' } : f, {
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
      // HU-T18.12: el resumen lleva solo al primer campo con error.
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

  const sinOpciones = combinaciones.length === 1 && (combinaciones[0]?.length ?? 0) === 0;
  const unica = sinOpciones ? combinacion(f, claveDe(combinaciones[0] ?? [])) : null;
  // Una sección cerrada se abre sola si guarda un campo con error (HU-T18.12).
  const conError = (prueba: (campo: string) => boolean) => errores.some((e) => prueba(e.campo));
  const deCombinacion = /^c\d+-/;
  const resumenDeOpciones =
    f.opciones.length === 0
      ? 'No tiene'
      : `${f.opciones.map((o) => o.nombre.trim() || 'Sin nombre').join(' y ')} · ${
          combinaciones.length === 1 ? '1 combinación' : `${combinaciones.length} combinaciones`
        }`;
  const oferta = f.oferta ?? ofertaEnPantalla(null);
  const promocion = f.promocion ?? promocionEnPantalla(null);
  const pideTexto = f.pideTexto ?? pideTextoEnPantalla(null);
  const resumenDeVender =
    [
      f.destacado ? 'Destacado' : null,
      f.nuevo ? 'Nuevo' : null,
      oferta.activa ? `Oferta ${oferta.porcentaje} %` : null,
      promocion.tipo ? 'Promoción' : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Nada todavía';
  const resumenDeEntrega = [
    f.tipo === 'digital' ? 'Digital' : 'Físico',
    f.retractoAplica ? 'con retracto' : 'sin retracto',
    f.soloMayores ? 'solo mayores' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const propioEnGoogle =
    f.slug.trim() !== '' ||
    (f.buscadores?.titulo.trim() ?? '') !== '' ||
    (f.buscadores?.descripcion.trim() ?? '') !== '';

  return (
    <form class="formulario formulario-de-producto" noValidate onSubmit={(e) => void guardar(e)}>
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
      {producto ? null : (
        <section class="fotos fotos--antes" aria-labelledby="fotos-titulo">
          <h2 id="fotos-titulo">Fotos</h2>
          <p class="nota">
            Para subir fotos, el producto se guarda primero como borrador: no se ve en tu tienda
            hasta que lo pongas «En la tienda».
          </p>
          <button
            class="ed1-boton ed1-boton--secundario"
            type="button"
            disabled={ocupado}
            onClick={() => void guardar(null, { borrador: true })}
          >
            Guardar como borrador y agregar fotos
          </button>
        </section>
      )}

      <fieldset class="ed1-grupo estado-del-producto" id="estado">
        <legend class="ed1-grupo__titulo">¿Se ve en tu tienda?</legend>
        <div class="segmentos">
          {ESTADOS.map((s) => (
            <label class="segmentos__opcion" key={s.id}>
              <input
                class="segmentos__control"
                type="radio"
                name="estado"
                value={s.id}
                checked={f.estado === s.id}
                onChange={() => poner('estado', s.id)}
              />
              <span>{ESTADO_CORTO[s.id] ?? s.texto}</span>
            </label>
          ))}
        </div>
        <p class="nota">{ESTADOS.find((s) => s.id === f.estado)?.texto}</p>
      </fieldset>

      <Texto
        id="nombre"
        etiqueta="Nombre"
        valor={f.nombre}
        alCambiar={(v) => poner('nombre', v)}
        error={errorDe('nombre')}
      />
      {unica ? (
        <>
          <div class="fila-de-campos">
            <Texto
              id="c0-precio"
              etiqueta="Precio"
              ayuda="En pesos, sin centavos."
              numerico
              valor={unica.precio}
              alCambiar={(v) => ponerCombinacion(claveDe([]), { precio: v })}
              error={errorDe('c0-precio')}
            />
            <Texto
              id="c0-stock"
              etiqueta="Unidades"
              numerico
              deshabilitado={unica.noSeCuenta}
              valor={unica.noSeCuenta ? '' : unica.stock}
              alCambiar={(v) => ponerCombinacion(claveDe([]), { stock: v })}
              error={errorDe('c0-stock')}
            />
          </div>
          <Casilla
            id="c0-nocuenta"
            etiqueta="No llevo la cuenta de unidades"
            marcada={unica.noSeCuenta}
            alCambiar={(v) => ponerCombinacion(claveDe([]), { noSeCuenta: v })}
          />
        </>
      ) : null}
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

      <Cajon
        id="opciones"
        titulo="Tallas, colores u otras opciones"
        resumen={resumenDeOpciones}
        conError={conError(
          (c) => c === 'opciones' || c === 'combinaciones' || deCombinacion.test(c),
        )}
        abiertoAlEmpezar={f.opciones.length > 0}
      >
        <p class="nota">
          Si viene en tallas, colores o sabores, escríbelos aquí: cada combinación tiene su precio y
          sus unidades. Sin opciones, el producto tiene un solo precio.
        </p>
        {errorDe('opciones') ? <p class="ed1-campo__error">{errorDe('opciones')}</p> : null}
        {f.opciones.map((o, i) => (
          <div class="opcion" key={i}>
            <Texto
              id={`o${i}-nombre`}
              etiqueta={`Nombre de la opción ${i + 1}`}
              {...(i === 0 ? { ayuda: 'Por ejemplo: Talla' } : {})}
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
        {sinOpciones ? null : (
          <div class="combinaciones" id="combinaciones">
            <h3 class="combinaciones__titulo">Precio y unidades de cada combinación</h3>
            {/* Los encabezados de las columnas; cada campo dice el suyo al lector de pantalla. */}
            <div class="fila-de-campos combinaciones__cabeza" aria-hidden="true">
              <span>Precio</span>
              <span>Unidades</span>
            </div>
            {errorDe('combinaciones') ? (
              <p class="ed1-campo__error">{errorDe('combinaciones')}</p>
            ) : null}
            {combinaciones.map((valores, i) => {
              const clave = claveDe(valores);
              const c = combinacion(f, clave);
              const nombre = valores.join(' / ');
              return (
                <div class="combinacion" key={clave}>
                  <p class="combinacion__nombre">{nombre}</p>
                  {c.vende ? (
                    <div class="fila-de-campos">
                      <Texto
                        id={`c${i}-precio`}
                        etiqueta={`Precio de ${nombre}`}
                        etiquetaOculta
                        numerico
                        valor={c.precio}
                        alCambiar={(v) => ponerCombinacion(clave, { precio: v })}
                        error={errorDe(`c${i}-precio`)}
                      />
                      <Texto
                        id={`c${i}-stock`}
                        etiqueta={`Unidades de ${nombre}`}
                        etiquetaOculta
                        numerico
                        deshabilitado={c.noSeCuenta}
                        valor={c.noSeCuenta ? '' : c.stock}
                        alCambiar={(v) => ponerCombinacion(clave, { stock: v })}
                        error={errorDe(`c${i}-stock`)}
                      />
                    </div>
                  ) : (
                    <p class="nota">No se vende.</p>
                  )}
                  <Cajon
                    id={`c${i}-mas`}
                    titulo={`Más de ${nombre}`}
                    pequeno
                    conError={conError((e) => e === `c${i}-sku` || e === `c${i}-antes`)}
                  >
                    <Casilla
                      id={`c${i}-vende`}
                      etiqueta={`Se vende ${nombre}`}
                      marcada={c.vende}
                      alCambiar={(v) => ponerCombinacion(clave, { vende: v })}
                    />
                    {c.vende ? (
                      <>
                        <Casilla
                          id={`c${i}-nocuenta`}
                          etiqueta={`No llevo la cuenta de ${nombre}`}
                          marcada={c.noSeCuenta}
                          alCambiar={(v) => ponerCombinacion(clave, { noSeCuenta: v })}
                        />
                        <Texto
                          id={`c${i}-sku`}
                          etiqueta={`Referencia (SKU) de ${nombre}`}
                          opcional
                          valor={c.sku}
                          alCambiar={(v) => ponerCombinacion(clave, { sku: v })}
                          error={errorDe(`c${i}-sku`)}
                        />
                        {c.antes.trim() ? (
                          <PrecioTachado
                            id={`c${i}-antes`}
                            etiqueta={`Precio tachado de ${nombre}`}
                            valor={c.antes}
                            alCambiar={(v) => ponerCombinacion(clave, { antes: v })}
                            error={errorDe(`c${i}-antes`)}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </Cajon>
                </div>
              );
            })}
          </div>
        )}
      </Cajon>

      <Cajon
        id="vender-mas"
        titulo="Vender más"
        resumen={resumenDeVender}
        conError={conError((c) => c === 'promocion' || c === 'oferta' || c === 'c0-antes')}
      >
        <Casilla
          id="destacado"
          etiqueta="Destacado: va primero en tu tienda"
          marcada={f.destacado ?? false}
          alCambiar={(v) => poner('destacado', v)}
        />
        <Casilla
          id="nuevo"
          etiqueta="Nuevo: lleva la etiqueta «Nuevo»"
          marcada={f.nuevo ?? false}
          alCambiar={(v) => poner('nuevo', v)}
        />
        {delPlan('ofertas_programadas') || oferta.activa ? (
          <Oferta valor={oferta} alCambiar={(v) => poner('oferta', v)} error={errorDe('oferta')} />
        ) : (
          <EsDePro que="La oferta con fecha" />
        )}
        <Promocion
          valor={promocion}
          alCambiar={(v) => poner('promocion', v)}
          error={errorDe('promocion')}
        />
        {unica?.antes.trim() ? (
          <PrecioTachado
            id="c0-antes"
            etiqueta="Precio tachado"
            valor={unica.antes}
            alCambiar={(v) => ponerCombinacion(claveDe([]), { antes: v })}
            error={errorDe('c0-antes')}
          />
        ) : null}
      </Cajon>

      <Cajon
        id="personalizar"
        titulo="Personalizar"
        resumen={
          pideTexto.activo ? `Pide: ${pideTexto.etiqueta.trim() || 'un texto'}` : 'No pide texto'
        }
        conError={conError((c) => c === 'pide-texto')}
      >
        {delPlan('texto_del_comprador') || pideTexto.activo ? (
          <PideTexto
            valor={pideTexto}
            alCambiar={(v) => poner('pideTexto', v)}
            error={errorDe('pide-texto')}
          />
        ) : (
          <EsDePro que="Pedirle un texto al comprador" />
        )}
      </Cajon>

      <Cajon
        id="entrega"
        titulo="Entrega y reglas"
        resumen={resumenDeEntrega}
        conError={conError((c) => c === 'tipo' || c === 'retracto' || c === 'c0-sku')}
      >
        {delPlan('productos_digitales') || f.tipo === 'digital' ? (
          <div class="ed1-campo" id="tipo">
            <label class="ed1-campo__etiqueta" for="tipo-de-producto">
              Tipo de producto
            </label>
            <select
              class="ed1-campo__control"
              id="tipo-de-producto"
              value={f.tipo ?? 'fisico'}
              onChange={(e) =>
                poner('tipo', (e.target as HTMLSelectElement).value as 'fisico' | 'digital')
              }
            >
              <option value="fisico">Físico: se entrega o se envía</option>
              <option value="digital">Digital: un archivo que se descarga</option>
            </select>
            {errorDe('tipo') ? <p class="ed1-campo__error">{errorDe('tipo')}</p> : null}
            {f.tipo === 'digital' ? (
              <p class="nota">No cuenta unidades ni pide envío. Es de los planes Pro e IA Pro.</p>
            ) : null}
          </div>
        ) : (
          <EsDePro que="Vender un archivo que se descarga" />
        )}
        {f.tipo === 'digital' && producto?.tipo === 'digital' ? (
          <ArchivosDigitales
            conexion={conexion}
            variantes={producto.variantes.map((v) => ({
              id: v.id,
              nombre: v.valores.length > 0 ? v.valores.join(' · ') : 'El archivo',
            }))}
            alVencer={alVencer}
          />
        ) : null}
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
        {unica ? (
          <Texto
            id="c0-sku"
            etiqueta="Referencia (SKU)"
            ayuda="Tu código interno, si usas uno."
            opcional
            valor={unica.sku}
            alCambiar={(v) => ponerCombinacion(claveDe([]), { sku: v })}
            error={errorDe('c0-sku')}
          />
        ) : null}
      </Cajon>

      <Cajon
        id="google"
        titulo="Cómo sale en Google"
        resumen={propioEnGoogle ? 'Con texto propio' : 'Automático'}
        conError={conError((c) => c === 'slug' || c.startsWith('en-google'))}
      >
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
        <EnGoogle
          id="en-google"
          valor={f.buscadores ?? { titulo: '', descripcion: '' }}
          alCambiar={(v) => poner('buscadores', v)}
          tituloDeFabrica={`${f.nombre.trim() || 'Tu producto'} · ${tienda}`}
          descripcionDeFabrica={f.descripcion}
          direccion={`/p/${f.slug.trim() || producto?.slug || 'tu-producto'}/`}
          errores={{
            titulo: errorDe('en-google-titulo'),
            descripcion: errorDe('en-google-descripcion'),
          }}
        />
      </Cajon>

      {falla ? (
        <Aviso tono="peligro" titulo="No se guardó">
          {falla}
        </Aviso>
      ) : null}
      <div class="guardar-producto">
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
        ) : (
          <p class="guardar-producto__nota">
            Lo que escribes se guarda en tu teléfono mientras tanto.
          </p>
        )}
      </div>
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

/** Los estados del producto, cortos, para los tres botones de arriba. */
const ESTADO_CORTO: Record<string, string> = {
  borrador: 'Borrador',
  activo: 'En la tienda',
  archivado: 'Archivado',
};

/**
 * Una sección plegable del formulario, con lo que tiene dicho a la derecha para no tener que
 * abrirla. Se abre sola si guarda un campo con error.
 */
function Cajon({
  id,
  titulo,
  resumen,
  conError,
  abiertoAlEmpezar = false,
  pequeno = false,
  children,
}: {
  id: string;
  titulo: string;
  resumen?: string;
  conError: boolean;
  abiertoAlEmpezar?: boolean;
  pequeno?: boolean;
  children: ComponentChildren;
}) {
  const [abierto, setAbierto] = useState(abiertoAlEmpezar);
  useEffect(() => {
    if (conError) setAbierto(true);
  }, [conError]);
  return (
    <details
      class={`cajon${pequeno ? ' cajon--pequeno' : ''}`}
      id={id}
      open={abierto}
      onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="cajon__resumen">
        <span class="cajon__titulo">{titulo}</span>
        {resumen ? <span class="cajon__estado">{resumen}</span> : null}
      </summary>
      <div class="cajon__contenido">{children}</div>
    </details>
  );
}

/** Lo que el plan de la tienda no incluye: una línea, en vez del formulario entero. */
function EsDePro({ que }: { que: string }) {
  return (
    <p class="nota es-de-pro">
      {que} es de los planes Pro e IA Pro. <a href="/mas/plan/">Ver los planes</a>
    </p>
  );
}

/**
 * El precio tachado que ya tenía un producto. Ya no se ofrece para uno nuevo: para eso está la
 * oferta con fecha. Se puede corregir o borrar.
 */
function PrecioTachado({
  id,
  etiqueta,
  valor,
  alCambiar,
  error,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error: string | undefined;
}) {
  return (
    <Texto
      id={id}
      etiqueta={etiqueta}
      ayuda="Se ve tachado al lado del precio. Para una oferta nueva, usa la oferta con fecha; si lo borras, deja de verse."
      opcional
      numerico
      valor={valor}
      alCambiar={alCambiar}
      error={error}
    />
  );
}

export function Producto({
  conexion,
  almacen,
  id,
  tienda = 'tu tienda',
  funciones = null,
  alVencer,
}: {
  conexion: Conexion;
  almacen: Almacen;
  /** `null`: uno nuevo. */
  id: string | null;
  tienda?: string;
  funciones?: Record<string, unknown> | null;
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
          {producto && !producto.enPapelera ? (
            <Fotos
              conexion={conexion}
              producto={producto}
              alVencer={alVencer}
              alCambiar={() => void cargar()}
            />
          ) : null}
          <Formulario
            tienda={tienda}
            funciones={funciones}
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
        </>
      )}
    </main>
  );
}

/**
 * HU-P1.2 (sprint PF1): la promoción por cantidad del producto. La tienda la anuncia en la ficha y
 * la cotización la aplica; si tiene fecha de fin, ese día deja de aplicarse.
 */
export function Promocion({
  valor,
  alCambiar,
  error,
}: {
  valor: PromocionEnPantalla;
  alCambiar: (v: PromocionEnPantalla) => void;
  error: string | undefined;
}) {
  const poner = (cambio: Partial<PromocionEnPantalla>) => alCambiar({ ...valor, ...cambio });
  return (
    <fieldset class="ed1-grupo" id="promocion">
      <legend class="ed1-grupo__titulo">Promoción por cantidad</legend>
      {error ? <p class="ed1-campo__error">{error}</p> : null}
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="promocion-tipo">
          Tipo
        </label>
        <select
          class="ed1-campo__control"
          id="promocion-tipo"
          value={valor.tipo}
          onChange={(e) =>
            poner({ tipo: (e.target as HTMLSelectElement).value as PromocionEnPantalla['tipo'] })
          }
        >
          <option value="">Sin promoción</option>
          <option value="regalo">Lleva más, paga menos</option>
          <option value="porcentaje">Un % menos por cantidad</option>
        </select>
      </div>
      {valor.tipo === 'regalo' ? (
        <div class="fila-de-campos">
          <Texto
            id="promocion-lleva"
            etiqueta="Lleva"
            valor={valor.lleva}
            alCambiar={(v) => poner({ lleva: v })}
          />
          <Texto
            id="promocion-paga"
            etiqueta="Paga"
            valor={valor.paga}
            alCambiar={(v) => poner({ paga: v })}
          />
        </div>
      ) : null}
      {valor.tipo === 'porcentaje' ? (
        <div class="fila-de-campos">
          <Texto
            id="promocion-porcentaje"
            etiqueta="Porcentaje menos"
            valor={valor.porcentaje}
            alCambiar={(v) => poner({ porcentaje: v })}
          />
          <Texto
            id="promocion-desde"
            etiqueta="Desde cuántas unidades"
            valor={valor.desde}
            alCambiar={(v) => poner({ desde: v })}
          />
        </div>
      ) : null}
      {valor.tipo ? (
        <div class="ed1-campo">
          <label class="ed1-campo__etiqueta" for="promocion-hasta">
            Último día<span class="ed1-campo__opcional"> (opcional)</span>
          </label>
          <input
            class="ed1-campo__control"
            id="promocion-hasta"
            type="date"
            value={valor.hasta}
            onInput={(e) => poner({ hasta: (e.target as HTMLInputElement).value })}
          />
          <p class="nota">
            Las unidades del mismo producto cuentan juntas, aunque sean de distinta talla o color.
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}

/**
 * HU-P1.4 (sprint PF3): la oferta programada del producto. Un porcentaje menos en todas sus
 * combinaciones, del primer día al último: empieza y termina sola, sin volver a publicar. La tienda
 * la muestra con el precio de siempre tachado al lado.
 */
export function Oferta({
  valor,
  alCambiar,
  error,
}: {
  valor: OfertaEnPantalla;
  alCambiar: (v: OfertaEnPantalla) => void;
  error: string | undefined;
}) {
  const poner = (cambio: Partial<OfertaEnPantalla>) => alCambiar({ ...valor, ...cambio });
  return (
    <fieldset class="ed1-grupo" id="oferta">
      <legend class="ed1-grupo__titulo">Oferta programada</legend>
      {error ? <p class="ed1-campo__error">{error}</p> : null}
      <Casilla
        id="oferta-activa"
        etiqueta="Ponerle una oferta con fecha"
        marcada={valor.activa}
        alCambiar={(v) => poner({ activa: v })}
      />
      {valor.activa ? (
        <>
          <Texto
            id="oferta-porcentaje"
            etiqueta="Porcentaje menos"
            numerico
            valor={valor.porcentaje}
            alCambiar={(v) => poner({ porcentaje: v })}
          />
          <div class="fila-de-campos">
            <Texto
              id="oferta-desde"
              etiqueta="Primer día"
              fecha
              valor={valor.desde}
              alCambiar={(v) => poner({ desde: v })}
            />
            <Texto
              id="oferta-hasta"
              etiqueta="Último día"
              fecha
              valor={valor.hasta}
              alCambiar={(v) => poner({ hasta: v })}
            />
          </div>
          <p class="nota">
            Empieza a la medianoche del primer día y termina al final del último, en todas las
            combinaciones. Es de los planes Pro e IA Pro.
          </p>
        </>
      ) : null}
    </fieldset>
  );
}

/**
 * HU-P1.5 (sprint PF3): pedirle un texto al comprador en la ficha, como «Nombre para grabar» o
 * «Mensaje de la tarjeta». Llega con el pedido, en su WhatsApp y en los datos de entrega.
 */
export function PideTexto({
  valor,
  alCambiar,
  error,
}: {
  valor: PideTextoEnPantalla;
  alCambiar: (v: PideTextoEnPantalla) => void;
  error: string | undefined;
}) {
  const poner = (cambio: Partial<PideTextoEnPantalla>) => alCambiar({ ...valor, ...cambio });
  return (
    <fieldset class="ed1-grupo" id="pide-texto">
      <legend class="ed1-grupo__titulo">Un texto del comprador</legend>
      {error ? <p class="ed1-campo__error">{error}</p> : null}
      <Casilla
        id="pide-texto-activo"
        etiqueta="Pedirle un texto en la página del producto"
        marcada={valor.activo}
        alCambiar={(v) => poner({ activo: v })}
      />
      {valor.activo ? (
        <>
          <Texto
            id="pide-texto-etiqueta"
            etiqueta="Qué le pides"
            ayuda="Por ejemplo: «Nombre para grabar» o «Mensaje de la tarjeta»."
            valor={valor.etiqueta}
            alCambiar={(v) => poner({ etiqueta: v })}
          />
          <Texto
            id="pide-texto-largo"
            etiqueta="Hasta cuántos caracteres"
            ayuda="Hasta 200."
            numerico
            valor={valor.largo}
            alCambiar={(v) => poner({ largo: v })}
          />
          <Casilla
            id="pide-texto-obligatorio"
            etiqueta="Sin este texto no se puede pedir"
            marcada={valor.obligatorio}
            alCambiar={(v) => poner({ obligatorio: v })}
          />
          <p class="nota">
            Lo ves en el WhatsApp del pedido y en los datos de entrega. Es de los planes Pro e IA
            Pro.
          </p>
        </>
      ) : null}
    </fieldset>
  );
}
