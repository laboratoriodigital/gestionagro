/**
 * «Datos de un comprador» (HU-T7.3, TIENDA-3.0 §14.3): cuando un comprador pide sus datos, que se
 * corrijan o que se borren, el propietario lo busca por su celular y lo hace aquí. Solo quien
 * administra la tienda, recién entrado (CA3); cada paso queda en el registro (CA1).
 */
import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos } from '../catalogo.ts';
import { Confirmar, estadoDePedido, Texto } from '../componentes/index.ts';
import { enFecha } from '../solicitudes.ts';
import {
  CAMPOS_DEL_CONTACTO,
  type CampoDelContacto,
  celularDe,
  correccionDe,
  type DatosDelTitular,
  type Encontrados,
  type Hecho,
  hechoEnPalabras,
  nombreDeLaDescarga,
} from '../titular.ts';

function guardar(nombre: string, datos: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const opNueva = () => `titular-${crypto.randomUUID()}`;

export function Titular({
  conexion,
  rol,
  alVencer,
}: {
  conexion: Conexion;
  rol: string;
  alVencer: (motivo: string) => void;
}) {
  const [celular, setCelular] = useState('');
  const [errorDelCelular, setErrorDelCelular] = useState<string | undefined>();
  const [buscado, setBuscado] = useState<string | null>(null);
  const [encontrados, setEncontrados] = useState<Encontrados | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'info' | 'peligro'; texto: string } | null>(null);
  const [form, setForm] = useState<Partial<Record<CampoDelContacto, string>>>({});
  const [errorDelForm, setErrorDelForm] = useState<string | undefined>();

  if (!puede(rol, 'titular.gestionar')) {
    return (
      <main class="contenido">
        <h1>Datos de un comprador</h1>
        <Aviso tono="info" titulo="Solo quien administra la tienda">
          Lo que un comprador pide sobre sus datos lo atiende quien administra la tienda.
        </Aviso>
      </main>
    );
  }

  const pedir = async <T,>(ruta: string, cuerpo: unknown): Promise<T | null> => {
    setOcupado(true);
    const r = await pedirAlPanel<T>(conexion, `titular/${ruta}`, { cuerpo });
    setOcupado(false);
    if (r.tipo === 'sin-sesion') {
      alVencer(r.motivo);
      return null;
    }
    if (r.tipo !== 'ok') {
      setAviso({ tono: 'peligro', texto: r.motivo });
      return null;
    }
    return r.datos;
  };

  const buscar = async (texto = celular) => {
    const c = celularDe(texto);
    setErrorDelCelular(c ? undefined : 'Escribe los 10 dígitos del celular, empezando por 3.');
    if (!c) return;
    setAviso(null);
    const r = await pedir<Encontrados>('buscar', { celular: c });
    if (!r) return;
    setBuscado(c);
    setEncontrados(r);
  };

  const descargar = async () => {
    if (!buscado) return;
    const r = await pedir<DatosDelTitular>('exportar', { celular: buscado });
    if (!r) return;
    guardar(nombreDeLaDescarga(r), JSON.stringify(r, null, 2));
    setAviso({
      tono: 'info',
      texto: 'Listo: entrégale el archivo al comprador por un canal suyo.',
    });
  };

  const corregir = async (e: Event) => {
    e.preventDefault();
    if (!buscado) return;
    const c = correccionDe(form);
    if ('error' in c) return setErrorDelForm(c.error);
    setErrorDelForm(undefined);
    const r = await pedir<Hecho>('corregir', { op: opNueva(), celular: buscado, ...c });
    if (!r) return;
    setForm({});
    const siguiente = c.contacto.celular ?? buscado;
    setCelular(siguiente);
    await buscar(siguiente);
    setAviso({ tono: 'info', texto: hechoEnPalabras('corregir', r) });
  };

  const suprimir = async () => {
    if (!buscado) return;
    const r = await pedir<Hecho>('suprimir', { op: opNueva(), celular: buscado });
    if (!r) return;
    const texto = hechoEnPalabras('suprimir', r);
    await buscar(buscado);
    setAviso({ tono: 'info', texto });
  };

  const lista = encontrados?.pedidos ?? [];
  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Datos de un comprador</h1>
      <p>
        Cuando un comprador te pide sus datos, que los corrijas o que los borres, búscalo por su
        celular. Todo lo que hagas aquí queda en el registro.
      </p>
      <form
        class="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar();
        }}
      >
        <Texto
          id="celular-del-comprador"
          etiqueta="Celular del comprador"
          valor={celular}
          alCambiar={setCelular}
          error={errorDelCelular}
          numerico
        />
        <button
          class="ed1-boton ed1-boton--primario"
          type="submit"
          disabled={ocupado}
          aria-busy={ocupado ? 'true' : undefined}
        >
          Buscar
        </button>
      </form>
      {aviso ? (
        <Aviso tono={aviso.tono} titulo={aviso.tono === 'info' ? 'Hecho' : 'No se pudo'}>
          {aviso.texto}
        </Aviso>
      ) : null}
      {encontrados && lista.length === 0 ? (
        <p role="status">No hay pedidos con ese celular.</p>
      ) : null}
      {encontrados?.comprador && lista.length > 0 ? (
        <>
          <h2>
            {encontrados.comprador.nombre ?? 'Sin nombre'} ·{' '}
            <span class="cifra">{encontrados.comprador.celular}</span>
          </h2>
          <ul class="lineas">
            {lista.map((p) => (
              <li key={p.id}>
                <a href={`/pedidos/${encodeURIComponent(p.id)}/`}>Pedido {p.numero}</a> ·{' '}
                {enFecha(p.creado.slice(0, 10))} · {estadoDePedido(p.estado).texto} ·{' '}
                <span class="cifra">{enPesos(p.totalCop)}</span>
                {p.ciudad ? ` · ${p.ciudad}` : ''}
              </li>
            ))}
          </ul>
          <div class="acciones">
            <button
              class="ed1-boton ed1-boton--secundario"
              type="button"
              disabled={ocupado}
              onClick={() => void descargar()}
            >
              Descargar sus datos
            </button>
          </div>
          <details class="ed1-confirmacion">
            <summary class="ed1-boton ed1-boton--secundario">Corregir sus datos</summary>
            <form class="formulario" onSubmit={(e) => void corregir(e)}>
              <p class="nota">
                Escribe solo lo que cambia: lo demás sigue como está, en todos sus pedidos.
              </p>
              {CAMPOS_DEL_CONTACTO.map(([k, etiqueta]) => (
                <Texto
                  key={k}
                  id={`corregir-${k}`}
                  etiqueta={etiqueta}
                  valor={form[k] ?? ''}
                  alCambiar={(v) => setForm({ ...form, [k]: v })}
                  opcional
                  numerico={k === 'celular'}
                />
              ))}
              {errorDelForm ? (
                <p class="ed1-campo__error" role="alert">
                  {errorDelForm}
                </p>
              ) : null}
              <button class="ed1-boton ed1-boton--primario" type="submit" disabled={ocupado}>
                Guardar la corrección
              </button>
            </form>
          </details>
          <Confirmar
            abrir="Borrar sus datos"
            consecuencia={`Se borran el nombre, el celular, el correo y la dirección de sus pedidos terminados. Los pedidos quedan como prueba de la venta; los que están en curso guardan los datos hasta terminar. No se puede deshacer.`}
            confirmar="Borrar sus datos"
            alConfirmar={suprimir}
          />
        </>
      ) : null}
    </main>
  );
}
