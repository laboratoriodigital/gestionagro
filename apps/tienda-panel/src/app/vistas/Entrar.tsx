/**
 * Entrar (HU-T8.1, el boceto): «Entrar con Google», con la política aceptada antes (HU-E0.5 CA3).
 * La casilla nunca viene marcada; el botón dice por qué no avanza mientras falte.
 *
 * HU-C10.2: quien no tiene Google pide un enlace a su correo, con la misma casilla. El enlace vuelve
 * a esta pantalla con `#entrar=`, igual que Google.
 */
import type { RespuestaDelEnlace } from '@ed1/correo/entrar';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';

export function Entrar({
  aviso,
  alEntrar,
  alPedirEnlace,
}: {
  aviso: string | null;
  alEntrar: () => void;
  alPedirEnlace: (correo: string) => Promise<RespuestaDelEnlace>;
}) {
  const [acepta, setAcepta] = useState(false);
  const [correo, setCorreo] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaDelEnlace | null>(null);
  const error = respuesta && !respuesta.enviado ? respuesta.mensaje : null;

  const pedir = async (e: Event) => {
    e.preventDefault();
    if (!acepta) {
      document.getElementById('entrar-motivo')?.focus();
      return;
    }
    setPidiendo(true);
    const r = await alPedirEnlace(correo);
    setPidiendo(false);
    setRespuesta(r);
    if (!r.enviado) document.getElementById('entrar-correo')?.focus();
  };

  return (
    <main class="portada">
      <p class="etiqueta">TiendaPro</p>
      <h1>El panel de tu tienda</h1>
      <p class="portada__entrada">
        Aquí recibes tus pedidos, cargas tus productos y ves cómo vende tu tienda, desde el
        teléfono.
      </p>
      {aviso ? <Aviso tono="aviso" titulo={aviso} /> : null}
      <label class="acepto">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta((e.target as HTMLInputElement).checked)}
        />
        <span>
          Leí y acepto la <a href="/privacidad/">política de tratamiento de datos</a> de mi cuenta.
        </span>
      </label>
      <span class="ed1-boton-con-motivo">
        <button
          class="ed1-boton ed1-boton--primario"
          type="button"
          aria-describedby={acepta ? undefined : 'entrar-motivo'}
          onClick={() => {
            if (acepta) alEntrar();
            else document.getElementById('entrar-motivo')?.focus();
          }}
          aria-disabled={acepta ? undefined : 'true'}
        >
          Entrar con Google
        </button>
        {acepta ? null : (
          <span class="ed1-boton__motivo" id="entrar-motivo" tabindex={-1}>
            Primero acepta la política de datos.
          </span>
        )}
      </span>

      <form class="entrar-correo" onSubmit={(e) => void pedir(e)} noValidate>
        <p class="entrar-correo__o">¿No tienes Google? Te enviamos un enlace a tu correo.</p>
        <div class={`ed1-campo${error ? ' ed1-campo--con-error' : ''}`}>
          <label class="ed1-campo__etiqueta" for="entrar-correo">
            Tu correo
          </label>
          <input
            class="ed1-campo__control"
            id="entrar-correo"
            type="email"
            inputMode="email"
            autocomplete="email"
            value={correo}
            onInput={(e) => setCorreo((e.target as HTMLInputElement).value)}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error ? 'entrar-correo-error' : undefined}
          />
          {error ? (
            <p class="ed1-campo__error" id="entrar-correo-error">
              {error}
            </p>
          ) : null}
        </div>
        <button
          class="ed1-boton ed1-boton--secundario"
          type="submit"
          disabled={pidiendo}
          aria-busy={pidiendo ? 'true' : undefined}
          aria-describedby={acepta ? undefined : 'entrar-motivo'}
        >
          {pidiendo ? 'Enviando…' : 'Enviarme un enlace'}
        </button>
        <p class="entrar-correo__estado" role="status" data-prueba="entrar-correo-estado">
          {respuesta?.enviado ? respuesta.mensaje : ''}
        </p>
      </form>
    </main>
  );
}
