/**
 * «¿No tienes Google?» (HU-C10.2): pide un enlace a tu correo para entrar a la cuenta. Necesita lo
 * mismo que Google: la política aceptada y señal. El enlace vuelve a «Cuenta» con `#entrar=`, igual
 * que Google, y el cuaderno lo canjea con lo que ya tiene.
 */
import type { RespuestaDelEnlace } from '@ed1/correo/entrar';
import { useState } from 'preact/hooks';

interface Props {
  puede: boolean;
  pedir: (correo: string) => Promise<RespuestaDelEnlace>;
}

export function EntrarConCorreo({ puede, pedir }: Props) {
  const [correo, setCorreo] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaDelEnlace | null>(null);
  const error = respuesta && !respuesta.enviado ? respuesta.mensaje : null;

  return (
    <form
      class="entrar-correo"
      data-prueba="entrar-correo"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!puede) return;
        setPidiendo(true);
        const r = await pedir(correo);
        setPidiendo(false);
        setRespuesta(r);
      }}
    >
      <p class="ayuda">¿No tienes Google? Te enviamos un enlace a tu correo.</p>
      <div class="campo">
        <label for="entrar-correo">Tu correo</label>
        <input
          id="entrar-correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={correo}
          onInput={(e) => setCorreo((e.currentTarget as HTMLInputElement).value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'entrar-correo-error' : undefined}
        />
        {error && (
          <p class="error" id="entrar-correo-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div class="acciones">
        <button type="submit" class="secundario" disabled={!puede || pidiendo}>
          {pidiendo ? 'Enviando…' : 'Enviarme un enlace'}
        </button>
      </div>
      {respuesta?.enviado && (
        <p class="ayuda" role="status">
          {respuesta.mensaje}
        </p>
      )}
    </form>
  );
}
