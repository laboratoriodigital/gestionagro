/**
 * La página `/entrar/correo/` (HU-C10.2): el enlace que llegó al correo. El código se borra de la
 * barra antes de hablar con el CORE (P13), queda solo en memoria, y se gasta al tocar «Entrar».
 * Todo lo que responde el CORE se pinta como texto.
 */
const uno = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);

function mostrar(parte: 'cargando' | 'vigente' | 'error', motivo?: string) {
  const partes = {
    cargando: '[data-enlace-cargando]',
    vigente: '[data-enlace-vigente]',
    error: '[data-enlace-error]',
  };
  for (const [nombre, selector] of Object.entries(partes)) {
    const el = uno(selector);
    if (el) el.hidden = nombre !== parte;
  }
  const texto = uno('[data-enlace-error-texto]');
  if (motivo && texto) texto.textContent = motivo;
}

async function alCore(ruta: string, enlace: string) {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enlace }),
  }).catch(() => null);
  const cuerpo = (await r?.json().catch(() => ({}))) as Record<string, unknown>;
  return { r, cuerpo };
}

const SIN_CONEXION = 'Sin conexión: no pudimos revisar tu enlace. Revisa la señal y recarga.';

async function iniciar() {
  const enlace = new URLSearchParams(location.hash.slice(1)).get('enlace');
  history.replaceState(null, '', location.pathname);
  if (!enlace) {
    mostrar('error', 'A este enlace le falta una parte. Ábrelo desde el correo, sin cambiarlo.');
    return;
  }
  const visto = await alCore('/api/core/auth/correo/ver', enlace);
  if (!visto.r) return mostrar('error', SIN_CONEXION);
  if (!visto.r.ok) return mostrar('error', String(visto.cuerpo['motivo'] ?? ''));
  const producto = uno('[data-enlace-producto]');
  const correo = uno('[data-enlace-correo]');
  if (producto) producto.textContent = String(visto.cuerpo['producto'] ?? '');
  if (correo) correo.textContent = String(visto.cuerpo['correo'] ?? '');
  mostrar('vigente');
  const boton = uno<HTMLButtonElement>('button[data-enlace-entrar]');
  boton?.focus();
  boton?.addEventListener('click', async () => {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    const abierto = await alCore('/api/core/auth/correo/abrir', enlace);
    const vuelta = abierto.cuerpo['vuelta'];
    if (abierto.r?.ok && typeof vuelta === 'string') {
      location.replace(vuelta);
      return;
    }
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    mostrar('error', abierto.r ? String(abierto.cuerpo['motivo'] ?? '') : SIN_CONEXION);
  });
}

void iniciar();
