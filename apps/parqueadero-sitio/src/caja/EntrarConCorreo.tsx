/**
 * «¿No tiene Google?» (HU-C10.2, HU-Q7.6): pide un enlace al correo del operador. Necesita lo mismo
 * que Google: los términos aceptados (`puede`), y antes de pedir los guarda (`antes`). El enlace
 * vuelve a la caja con `#entrar=`, como Google.
 */
import type { RespuestaDelEnlace } from '@ed1/correo/entrar';
import { useState } from 'preact/hooks';

interface Props {
  readonly puede: boolean;
  readonly antes: () => Promise<void>;
  readonly pedir: (correo: string) => Promise<RespuestaDelEnlace>;
}

export function EntrarConCorreo({ puede, antes, pedir }: Props) {
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
        await antes();
        const r = await pedir(correo);
        setPidiendo(false);
        setRespuesta(r);
      }}
    >
      <p class="ayuda">¿No tiene Google? Le enviamos un enlace a su correo.</p>
      <div class="campo" data-error={error ? '' : undefined}>
        <label for="entrar-correo">Su correo</label>
        <input
          id="entrar-correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={correo}
          onInput={(e) => setCorreo(e.currentTarget.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'entrar-correo-error' : undefined}
        />
        {error && (
          <p class="error" id="entrar-correo-error">
            {error}
          </p>
        )}
      </div>
      <button type="submit" class="boton" disabled={!puede || pidiendo}>
        {pidiendo ? 'Enviando…' : 'Enviarme un enlace'}
      </button>
      <output aria-live="polite">{respuesta?.enviado ? respuesta.mensaje : ''}</output>
    </form>
  );
}
