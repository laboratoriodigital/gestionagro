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
  acceso = (cuerpo as { acceso?: string }).acceso ?? null;
  return g;
}

// ── Tus espacios (HU-C7.4) ─────────────────────────────────────────────────

interface Espacio {
  org_id: string;
  nombre: string;
  producto_nombre: string;
  rol: string;
  plan_nombre: string;
  plan_vence: string | null;
  abrir: string | null;
}

/** El acceso de esta visita: el del canje, o uno renovado con el refresh guardado. */
let acceso: string | null = null;

const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Bogota',
});
/** «28 feb 2027»: la fecha de Bogotá como dato, sin los «de» de la frase. */
const fecha = (iso: string) =>
  FECHA.formatToParts(new Date(iso))
    .filter((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')
    .map((p) => p.value.replace('.', ''))
    .join(' ');

type EstadoDeEspacios = 'cargando' | 'vacio' | 'error' | 'lista';

function mostrarEspacios(estado: EstadoDeEspacios, causa?: string) {
  const partes: Record<EstadoDeEspacios, string> = {
    cargando: '[data-espacios-cargando]',
    vacio: '[data-espacios-vacio]',
    error: '[data-espacios-error]',
    lista: '[data-espacios-lista]',
  };
  for (const [nombre, selector] of Object.entries(partes)) {
    for (const el of todos(selector)) el.hidden = nombre !== estado;
  }
  if (causa) for (const el of todos('[data-espacios-causa]')) el.textContent = causa;
}

const nodo = <K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  clase: string,
  texto?: string,
) => {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
};

/** Una tarjeta por espacio, con las clases de `Tarjeta` del sistema de diseño. Solo texto: nada de HTML. */
function tarjeta(e: Espacio): HTMLLIElement {
  const li = document.createElement('li');
  const caja = nodo('section', 'ed1-tarjeta');
  caja.append(nodo('h3', 'ed1-tarjeta__titulo', e.nombre));
  const cuerpo = nodo('div', 'ed1-tarjeta__cuerpo');
  const rol = e.rol.charAt(0).toUpperCase() + e.rol.slice(1);
  cuerpo.append(nodo('p', 'portada__detalle', `${e.producto_nombre} · ${rol}`));
  const plan = nodo('p', 'portada__detalle', `Plan ${e.plan_nombre}`);
  if (e.plan_vence) {
    plan.append(' · vence ', nodo('span', 'ed1-etiqueta', fecha(e.plan_vence)));
  }
  cuerpo.append(plan);
  caja.append(cuerpo);
  if (e.abrir) {
    const pie = nodo('div', 'ed1-tarjeta__pie');
    const enlace = nodo('a', 'ed1-boton ed1-boton--primario', `Abrir en ${e.producto_nombre}`);
    enlace.href = e.abrir;
    pie.append(enlace);
    caja.append(pie);
  }
  li.className = 'ed1-revelar';
  li.append(caja);
  return li;
}

/** Renueva con el refresh guardado. Si la sesión ya no sirve, la olvida y lo dice. */
async function renovar(g: Guardado): Promise<string | null> {
  const r = await fetch('/api/core/auth/refrescar', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh: g.refresh }),
  }).catch(() => null);
  const cuerpo = (await r?.json().catch(() => ({}))) as {
    acceso?: string;
    refresh?: string | null;
    motivo?: string;
  };
  if (r?.status === 401 || r?.status === 403) {
    localStorage.removeItem(CLAVE);
    pintar(null);
    mostrarError(cuerpo.motivo ?? 'Tu sesión venció. Vuelve a entrar.');
    return null;
  }
  if (!r?.ok || !cuerpo.acceso) return null;
  if (cuerpo.refresh)
    localStorage.setItem(CLAVE, JSON.stringify({ ...g, refresh: cuerpo.refresh }));
  return cuerpo.acceso;
}

async function cargarEspacios() {
  const g = leer();
  if (!g) return;
  mostrarEspacios('cargando');
  acceso ??= await renovar(g);
  if (!leer()) return; // la sesión venció al renovar: ya se dijo
  if (!acceso) {
    mostrarEspacios(
      'error',
      'No pudimos traer tus espacios. Revisa tu conexión e intenta de nuevo.',
    );
    return;
  }
  const r = await fetch('/api/core/cuenta/espacios', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${acceso}` },
    body: '{}',
  }).catch(() => null);
  const cuerpo = (await r?.json().catch(() => ({}))) as { espacios?: Espacio[]; motivo?: string };
  if (!r?.ok || !cuerpo.espacios) {
    acceso = null;
    mostrarEspacios('error', cuerpo.motivo ?? 'No pudimos traer tus espacios. Intenta de nuevo.');
    return;
  }
  if (cuerpo.espacios.length === 0) {
    mostrarEspacios('vacio');
    return;
  }
  for (const lista of todos('[data-espacios-lista]')) {
    lista.replaceChildren(...cuerpo.espacios.map(tarjeta));
  }
  mostrarEspacios('lista');
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
  acceso = null;
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
  for (const boton of todos<HTMLButtonElement>('button[data-espacios-reintentar]')) {
    boton.addEventListener('click', () => void cargarEspacios());
  }
  if (g) await cargarEspacios();
}

if (typeof document !== 'undefined') void iniciar();
