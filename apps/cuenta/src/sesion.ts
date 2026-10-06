/**
 * La sesión de la cuenta en el navegador (HU-C7.3, ADR-28). Lo único de la cuenta que corre en el
 * navegador, como archivo propio (CSP `script-src 'self'`):
 *
 * - al volver de Google, canjea el código del fragmento (`#entrar=…`) por la sesión y lo borra de
 *   la barra de direcciones;
 * - muestra quién entró, o el formulario para entrar;
 * - «Salir» cierra la sesión en el CORE y la olvida aquí;
 * - si se llegó desde una app (`?vuelve=`), ofrece volver, solo a un origen declarado en el registro.
 *
 * Guarda el refresh en este navegador: la cuenta no tiene otra cosa que proteger con él todavía, y
 * la CSP no deja correr código ajeno.
 */
const CLAVE = 'ed1-cuenta';
const CLAVE_DISPOSITIVO = 'ed1-cuenta-dispositivo';
const CLAVE_VUELVE = 'ed1-cuenta-vuelve';

interface Guardado {
  refresh: string;
  nombre: string;
}

interface App {
  nombre: string;
  origenes: string[];
}

function leer(): Guardado | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Guardado | null;
    return g?.refresh ? g : null;
  } catch {
    return null;
  }
}

function dispositivo(): string {
  let id = localStorage.getItem(CLAVE_DISPOSITIVO);
  if (!id) {
    id = `navegador-${crypto.randomUUID()}`;
    localStorage.setItem(CLAVE_DISPOSITIVO, id);
  }
  return id;
}

const todos = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelectorAll<T>(selector);

function pintar(g: Guardado | null) {
  for (const el of todos('[data-sin-sesion]')) el.hidden = Boolean(g);
  for (const el of todos('[data-con-sesion]')) el.hidden = !g;
  for (const el of todos('[data-nombre]')) el.textContent = g?.nombre ?? '';
}

function mostrarError(texto: string) {
  const caja = document.querySelector<HTMLElement>('[data-error]');
  const parrafo = document.querySelector<HTMLElement>('[data-error-texto]');
  if (parrafo) parrafo.textContent = texto;
  if (caja) caja.hidden = false;
}

/** La app a la que se vuelve, si su origen está declarado; si no, ninguna. */
export function appDeVuelta(vuelve: string | null, apps: readonly App[]): App | null {
  if (!vuelve) return null;
  let origen: string;
  try {
    origen = new URL(vuelve).origin;
  } catch {
    return null;
  }
  return apps.find((a) => a.origenes.includes(origen)) ?? null;
}

function prepararVuelta(apps: readonly App[]) {
  const pedida = new URLSearchParams(location.search).get('vuelve');
  if (pedida) sessionStorage.setItem(CLAVE_VUELVE, pedida);
  const vuelve = pedida ?? sessionStorage.getItem(CLAVE_VUELVE);
  const app = appDeVuelta(vuelve, apps);
  if (!app || !vuelve) return;
  for (const el of todos('[data-vuelve-nombre]')) el.textContent = app.nombre;
  for (const el of todos('[data-vuelve-aviso]')) el.hidden = false;
  for (const el of todos<HTMLAnchorElement>('a[data-vuelve-enlace]')) {
    el.href = vuelve;
    el.textContent = `Volver a ${app.nombre}`;
    el.hidden = false;
  }
}

async function canjear(codigo: string): Promise<Guardado | null> {
  const r = await fetch('/api/core/auth/canje', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ codigo, dispositivo: dispositivo() }),
  });
  const cuerpo = (await r.json().catch(() => ({}))) as {
    refresh?: string;
    usuario?: { nombre?: string };
    motivo?: string;
  };
  if (!r.ok || !cuerpo.refresh) {
    mostrarError(cuerpo.motivo ?? 'No pudimos completar la entrada. Intenta de nuevo.');
    return null;
  }
  const g = { refresh: cuerpo.refresh, nombre: cuerpo.usuario?.nombre ?? '' };
  localStorage.setItem(CLAVE, JSON.stringify(g));
  return g;
}

async function salir(boton: HTMLButtonElement) {
  const g = leer();
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  if (g) {
    const r = await fetch('/api/core/auth/salir', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh: g.refresh }),
    }).catch(() => null);
    if (!r?.ok) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
      mostrarError('No pudimos cerrar la sesión. Revisa tu conexión e intenta de nuevo.');
      return;
    }
  }
  localStorage.removeItem(CLAVE);
  boton.disabled = false;
  boton.removeAttribute('aria-busy');
  pintar(null);
}

async function iniciar() {
  const main = document.querySelector<HTMLElement>('[data-apps]');
  const apps = JSON.parse(main?.dataset['apps'] ?? '[]') as App[];
  // La vuelta del formulario es este mismo origen: staging o producción.
  for (const el of todos<HTMLInputElement>('input[data-vuelta]')) {
    el.value = `${location.origin}/`;
  }
  prepararVuelta(apps);
  const codigo = new URLSearchParams(location.hash.slice(1)).get('entrar');
  let g = leer();
  if (codigo) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    g = (await canjear(codigo)) ?? g;
  }
  pintar(g);
  for (const boton of todos<HTMLButtonElement>('button[data-salir]')) {
    boton.addEventListener('click', () => void salir(boton));
  }
}

if (typeof document !== 'undefined') void iniciar();
