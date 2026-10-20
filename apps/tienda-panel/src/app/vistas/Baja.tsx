/**
 * HU-T13.7: dar de baja la tienda, en «Más › Dar de baja la tienda», solo para el propietario y con
 * la entrada reciente. Primero ofrece descargar todo (HU-T10.7); para confirmar, se escribe el nombre
 * de la tienda. A los 30 días se borran las llaves de los datos de sus compradores.
 */
import { Aviso, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { opNueva } from '../catalogo.ts';
import { fechaLegible } from '../terminos.ts';

export function Baja({
  conexion,
  nombre,
  alVencer,
}: {
  conexion: Conexion;
  nombre: string;
  alVencer: (motivo: string) => void;
}) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecha, setHecha] = useState<string | null>(null);

  const enviar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    if (texto.trim().toLowerCase() !== nombre.trim().toLowerCase()) {
      setError(`Escribe el nombre exacto de tu tienda: ${nombre}.`);
      return;
    }
    setEnviando(true);
    const r = await pedirAlPanel<{ estado: 'guardado'; borrado: string }>(conexion, 'baja', {
      cuerpo: { op: opNueva(), nombre: texto },
    });
    setEnviando(false);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.problemas?.[0]?.mensaje ?? r.motivo);
    setHecha(r.datos.borrado);
  };

  const volver = (
    <p>
      <a href="/mas/">Más</a>
    </p>
  );
  if (hecha)
    return (
      <main class="contenido">
        {volver}
        <h1>Tu tienda está dada de baja</h1>
        <Aviso tono="info" titulo="Ya no está en internet">
          Sus direcciones dejaron de responder. Hasta el {fechaLegible(hecha.slice(0, 10))} puedes
          entrar al panel y descargar todo lo suyo; ese día se borran los datos de tus compradores.
        </Aviso>
        <p>
          <a href="/mas/datos/">Descargar todo</a>
        </p>
      </main>
    );
  return (
    <main class="contenido">
      {volver}
      <h1>Dar de baja la tienda</h1>
      <p>
        Tu tienda deja de estar en internet: sus direcciones dejan de responder y ya no recibe
        pedidos. Durante 30 días puedes entrar aquí y descargar todo lo suyo. Pasados esos días se
        borran los datos de tus compradores, y no hay forma de recuperarlos.
      </p>
      <Aviso tono="aviso" titulo="Antes, descarga todo">
        Tus productos, tus pedidos y tus ajustes, en un archivo que puedes guardar.{' '}
        <a href="/mas/datos/">Descargar todo</a>
      </Aviso>
      <form class="formulario" onSubmit={enviar} noValidate>
        {error ? <ResumenDeErrores errores={[{ campo: 'nombre-baja', mensaje: error }]} /> : null}
        <div class={`ed1-campo${error ? ' ed1-campo--con-error' : ''}`}>
          <label class="ed1-campo__etiqueta" for="nombre-baja">
            Para confirmar, escribe el nombre de tu tienda: {nombre}
          </label>
          <input
            class="ed1-campo__control"
            id="nombre-baja"
            name="nombre-baja"
            autocomplete="off"
            value={texto}
            aria-invalid={error ? 'true' : undefined}
            onInput={(ev) => setTexto((ev.target as HTMLInputElement).value)}
          />
          {error ? (
            <p class="ed1-campo__error" id="nombre-baja-error">
              {error}
            </p>
          ) : null}
        </div>
        <button
          class="ed1-boton ed1-boton--peligro"
          type="submit"
          disabled={enviando}
          aria-busy={enviando ? 'true' : undefined}
        >
          Dar de baja la tienda
        </button>
      </form>
    </main>
  );
}
