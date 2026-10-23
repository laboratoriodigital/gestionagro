/**
 * «¿No tienes Google?» en la portada y en /autorizar/ (HU-C10.2). Pide el enlace al CORE con lo
 * mismo que lleva el formulario de Google de la página (producto, política y vuelta) y con su misma
 * casilla: sin aceptar la política no se pide nada. Sin JavaScript, Google sigue funcionando; el
 * correo necesita este archivo.
 */
import { pedirEnlaceDeEntrada } from '@ed1/correo/entrar';

function preparar(formulario: HTMLFormElement) {
  const google = formulario
    .closest('[data-sin-sesion]')
    ?.querySelector<HTMLFormElement>('.portada__formulario');
  const campo = formulario.querySelector<HTMLInputElement>('input[type="email"]');
  const error = formulario.querySelector<HTMLElement>('[data-entrar-correo-error]');
  const estado = formulario.querySelector<HTMLElement>('[data-entrar-correo-estado]');
  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!google || !campo || !error || !estado || !boton) return;
  formulario.hidden = false;

  const marcar = (motivo: string | null) => {
    error.textContent = motivo ?? '';
    error.hidden = !motivo;
    campo.closest('.ed1-campo')?.classList.toggle('ed1-campo--con-error', Boolean(motivo));
    if (motivo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.setAttribute('aria-describedby', error.id);
    } else {
      campo.removeAttribute('aria-invalid');
      campo.removeAttribute('aria-describedby');
    }
  };

  formulario.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    estado.textContent = '';
    const casilla = google.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (casilla && !casilla.checked) {
      marcar('Primero acepta la política de tratamiento de datos, arriba.');
      casilla.focus();
      return;
    }
    const valor = (nombre: string) =>
      google.querySelector<HTMLInputElement>(`input[name="${nombre}"]`)?.value ?? '';
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    const r = await pedirEnlaceDeEntrada('', {
      correo: campo.value,
      producto: valor('producto'),
      vuelta: valor('vuelta'),
      politica: valor('politica'),
    });
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    if (!r.enviado) {
      marcar(r.mensaje);
      campo.focus();
      return;
    }
    marcar(null);
    estado.textContent = r.mensaje;
  });
}

for (const formulario of document.querySelectorAll<HTMLFormElement>('form[data-entrar-correo]')) {
  preparar(formulario);
}
