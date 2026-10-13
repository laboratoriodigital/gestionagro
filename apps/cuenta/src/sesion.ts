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

// ── Dónde has entrado, tus pagos y la actividad (HU-C7.5, HU-C7.6, HU-C7.8) ──

interface SesionVisible {
  id: string;
  producto_nombre: string;
  dispositivo: string;
  creado: string;
  ultimo_uso: string;
  esta: boolean;
}

interface PagoVisible {
  espacio: string;
  plan_nombre: string;
  meses: number;
  monto_cop: number;
  estado: string;
  creado: string;
  periodo_desde: string | null;
  periodo_hasta: string | null;
}

interface AsistenteVisible {
  id: string;
  cliente: string;
  espacio: string;
  producto_nombre: string;
  puede: string[];
  creada: string;
  ultimo_uso: string | null;
}

interface HechoVisible {
  espacio: string;
  instante: string;
  frase: string;
}

const FECHA_HORA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});
const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;
const ESTADO_DEL_PAGO: Record<string, string> = {
  aprobado: 'Aprobado',
  esperando: 'Esperando confirmación',
  rechazado: 'No se aprobó',
  revisar: 'En revisión',
  vencido: 'No se terminó',
};

type EstadoDeBloque = 'cargando' | 'vacio' | 'error' | 'lista';
const bloque = (id: string) => document.querySelector<HTMLElement>(`[data-bloque="${id}"]`);

function mostrarBloque(id: string, estado: EstadoDeBloque, causa?: string) {
  const b = bloque(id);
  if (!b) return;
  for (const el of b.querySelectorAll<HTMLElement>('[data-estado]')) {
    el.hidden = el.dataset['estado'] !== estado;
  }
  const parrafo = b.querySelector<HTMLElement>('[data-causa]');
  if (causa && parrafo) parrafo.textContent = causa;
}

/** Pide al CORE con el acceso de la cuenta; si venció, renueva una vez. */
async function alCore(
  ruta: string,
  datos: unknown = {},
): Promise<{ r: Response | null; cuerpo: Record<string, unknown> }> {
  const g = leer();
  if (!g) return { r: null, cuerpo: {} };
  for (let intento = 0; intento < 2; intento++) {
    acceso ??= await renovar(g);
    if (!acceso) return { r: null, cuerpo: {} };
    const r = await fetch(ruta, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${acceso}` },
      body: JSON.stringify(datos),
    }).catch(() => null);
    const cuerpo = (await r?.json().catch(() => ({}))) as Record<string, unknown>;
    if (r?.status === 401 && intento === 0) {
      acceso = null;
      continue;
    }
    return { r, cuerpo };
  }
  return { r: null, cuerpo: {} };
}

/** Una fila de lista: título, detalle y, si hace falta, una acción a la derecha. */
function fila(titulo: Node[], detalle: string, accion?: HTMLElement): HTMLLIElement {
  const li = nodo('li', 'ed1-lista__elemento portada__fila');
  const texto = nodo('div', 'portada__fila-texto');
  const cabeza = nodo('p', 'portada__fila-titulo');
  cabeza.append(...titulo);
  texto.append(cabeza, nodo('p', 'portada__detalle', detalle));
  li.append(texto);
  if (accion) li.append(accion);
  return li;
}

function filaDeSesion(s: SesionVisible): HTMLLIElement {
  const titulo: Node[] = [document.createTextNode(s.producto_nombre)];
  if (s.esta)
    titulo.push(document.createTextNode(' '), nodo('span', 'ed1-etiqueta', 'Este navegador'));
  const detalle = `Equipo …${s.dispositivo} · entró el ${fecha(s.creado)} · último uso ${fecha(s.ultimo_uso)}`;
  if (s.esta) return fila(titulo, detalle);
  const boton = nodo('button', 'ed1-boton ed1-boton--texto', 'Cerrar');
  boton.type = 'button';
  boton.setAttribute(
    'aria-label',
    `Cerrar la sesión de ${s.producto_nombre} en el equipo …${s.dispositivo}`,
  );
  boton.addEventListener('click', () => void cerrarSesiones({ sesion: s.id }, boton));
  return fila(titulo, detalle, boton);
}

function filaDePago(p: PagoVisible): HTMLLIElement {
  const periodo =
    p.periodo_desde && p.periodo_hasta
      ? `del ${fecha(p.periodo_desde)} al ${fecha(p.periodo_hasta)}`
      : p.meses === 1
        ? 'un mes'
        : `${p.meses} meses`;
  // El monto a la derecha, como la acción de las otras listas: las cifras quedan en columna.
  return fila(
    [document.createTextNode(`${p.plan_nombre} · ${p.espacio}`)],
    `${periodo} · ${ESTADO_DEL_PAGO[p.estado] ?? p.estado} · pagado el ${fecha(p.creado)}`,
    nodo('span', 'portada__monto', pesos(p.monto_cop)),
  );
}

/** Un asistente con acceso, lo que puede hacer y el botón para quitárselo (HU-C9.6). */
function filaDeAsistente(a: AsistenteVisible): HTMLLIElement {
  const boton = nodo('button', 'ed1-boton ed1-boton--texto', 'Quitar acceso');
  boton.type = 'button';
  boton.setAttribute('aria-label', `Quitar el acceso de ${a.cliente} a ${a.espacio}`);
  boton.addEventListener('click', () => void quitarAsistente(a.id, boton));
  const uso = a.ultimo_uso ? `último uso ${fecha(a.ultimo_uso)}` : 'todavía no lo ha usado';
  return fila(
    [document.createTextNode(`${a.cliente} · ${a.espacio}`)],
    `${a.puede.join(' ')} · ${a.producto_nombre} · desde el ${fecha(a.creada)} · ${uso}`,
    boton,
  );
}

async function quitarAsistente(id: string, boton: HTMLButtonElement) {
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  const { r, cuerpo } = await alCore('/api/core/cuenta/asistentes/quitar', { id });
  boton.disabled = false;
  boton.removeAttribute('aria-busy');
  if (!r?.ok) {
    mostrarBloque(
      'asistentes',
      'error',
      (cuerpo['motivo'] as string | undefined) ?? 'No pudimos quitar el acceso. Intenta de nuevo.',
    );
    return;
  }
  await cargarBloque<AsistenteVisible>(
    'asistentes',
    '/api/core/cuenta/asistentes',
    'asistentes',
    filaDeAsistente,
  );
}

const filaDeHecho = (h: HechoVisible) =>
  fila(
    [document.createTextNode(h.frase)],
    `${h.espacio} · ${FECHA_HORA.format(new Date(h.instante))}`,
  );

async function cargarBloque<T>(
  id: string,
  ruta: string,
  clave: string,
  pintarFila: (x: T) => HTMLLIElement,
  datos: unknown = {},
): Promise<T[] | null> {
  mostrarBloque(id, 'cargando');
  const { r, cuerpo } = await alCore(ruta, datos);
  const lista = cuerpo[clave] as T[] | undefined;
  if (!r?.ok || !Array.isArray(lista)) {
    mostrarBloque(
      id,
      'error',
      (cuerpo['motivo'] as string | undefined) ?? 'No pudimos traer esto. Intenta de nuevo.',
    );
    return null;
  }
  if (lista.length === 0) {
    mostrarBloque(id, 'vacio');
    return lista;
  }
  bloque(id)
    ?.querySelector('[data-estado="lista"]')
    ?.replaceChildren(...lista.map(pintarFila));
  mostrarBloque(id, 'lista');
  return lista;
}

async function cargarSesiones() {
  const g = leer();
  const sesiones = await cargarBloque<SesionVisible>(
    'sesiones',
    '/api/core/cuenta/sesiones',
    'sesiones',
    filaDeSesion,
    { refresh: g?.refresh },
  );
  const otras = (sesiones ?? []).filter((s) => !s.esta).length;
  // Solo esta sesión abierta: la lista dice «no tienes otras», no muestra la propia sola.
  if (sesiones && otras === 0) mostrarBloque('sesiones', 'vacio');
  for (const b of todos('button[data-cerrar-todas]')) b.hidden = otras < 2;
}

async function cerrarSesiones(
  pedido: { sesion: string } | { todas_menos: string },
  boton: HTMLButtonElement,
) {
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  const { r, cuerpo } = await alCore('/api/core/cuenta/sesiones/cerrar', pedido);
  boton.disabled = false;
  boton.removeAttribute('aria-busy');
  const aviso = bloque('sesiones')?.querySelector<HTMLElement>('[data-reentrar]');
  if (r?.status === 403 && cuerpo['estado'] === 'entrar-de-nuevo') {
    const texto = aviso?.querySelector('[data-reentrar-texto]');
    if (texto && typeof cuerpo['motivo'] === 'string') texto.textContent = cuerpo['motivo'];
    if (aviso) aviso.hidden = false;
    aviso?.scrollIntoView?.({ block: 'nearest' });
    return;
  }
  if (aviso) aviso.hidden = true;
  if (!r?.ok) {
    mostrarBloque(
      'sesiones',
      'error',
      (cuerpo['motivo'] as string | undefined) ?? 'No pudimos cerrar la sesión. Intenta de nuevo.',
    );
    return;
  }
  await cargarSesiones();
}

/** Entrar de nuevo con Google: el mismo formulario de entrada, con la casilla por marcar. */
function entrarDeNuevo() {
  for (const el of todos('[data-sin-sesion]')) el.hidden = false;
  const casilla = document.querySelector<HTMLInputElement>(
    '.portada__formulario input[type="checkbox"]',
  );
  casilla?.scrollIntoView?.({ block: 'center' });
  casilla?.focus();
}

function cargarLoMio() {
  void cargarSesiones();
  void cargarBloque<PagoVisible>('pagos', '/api/core/cuenta/pagos', 'pagos', filaDePago);
  void cargarBloque<AsistenteVisible>(
    'asistentes',
    '/api/core/cuenta/asistentes',
    'asistentes',
    filaDeAsistente,
  );
  void cargarBloque<HechoVisible>('actividad', '/api/core/cuenta/actividad', 'hechos', filaDeHecho);
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

async function iniciar(): Promise<boolean> {
  const main = document.querySelector<HTMLElement>('[data-apps]');
  const apps = JSON.parse(main?.dataset['apps'] ?? '[]') as App[];
  // La vuelta del formulario es esta misma página, en este origen: staging o producción. Así quien
  // entra desde /autorizar/ vuelve ahí (HU-C9.4).
  for (const el of todos<HTMLInputElement>('input[data-vuelta]')) {
    el.value = `${location.origin}${location.pathname}`;
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
  for (const boton of todos<HTMLButtonElement>('[data-bloque] button[data-reintentar]')) {
    boton.addEventListener('click', () => cargarLoMio());
  }
  for (const boton of todos<HTMLButtonElement>('button[data-cerrar-todas]')) {
    boton.addEventListener('click', () => {
      const refresh = leer()?.refresh;
      if (refresh) void cerrarSesiones({ todas_menos: refresh }, boton);
    });
  }
  for (const boton of todos<HTMLButtonElement>('button[data-reentrar-boton]')) {
    boton.addEventListener('click', entrarDeNuevo);
  }
  // Lo de la portada, solo en la portada.
  if (g && document.querySelector('[data-espacios-lista]')) {
    await cargarEspacios();
    cargarLoMio();
  }
  return Boolean(g);
}

/** Si hay sesión, cuando la página terminó de canjear o leerla (lo usa /autorizar/, HU-C9.4). */
export const conSesion: Promise<boolean> =
  typeof document !== 'undefined' ? iniciar() : Promise.resolve(false);

export { alCore };
