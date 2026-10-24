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

/**
 * Una tarjeta por espacio (HU-C7.9): el nombre, la app y el rol, el plan como insignia y el enlace
 * para abrirlo. Solo texto: nada de HTML.
 */
function tarjeta(e: Espacio): HTMLLIElement {
  const li = document.createElement('li');
  const caja = nodo('section', 'cuenta-espacio');
  const cabeza = nodo('div', 'cuenta-espacio__cabeza');
  cabeza.append(
    nodo('h3', 'cuenta-espacio__nombre', e.nombre),
    nodo('span', 'cuenta-insignia cuenta-insignia--tinta', `Plan ${e.plan_nombre}`),
  );
  const rol = e.rol.charAt(0).toUpperCase() + e.rol.slice(1);
  const detalle = nodo('p', 'portada__detalle', `${e.producto_nombre} · ${rol}`);
  if (e.plan_vence) {
    detalle.append(' · vence ', nodo('span', 'ed1-etiqueta', fecha(e.plan_vence)));
  }
  caja.append(cabeza, detalle);
  if (e.abrir) {
    const enlace = nodo('a', 'cuenta-espacio__abrir', `Abrir en ${e.producto_nombre}`);
    enlace.href = e.abrir;
    caja.append(enlace);
  }
  li.className = 'ed1-revelar';
  li.append(caja);
  return li;
}

// ── Orden de la portada (HU-C7.9) ─────────────────────────────────────────

/** Cuántas filas se ven de entrada en cada lista; el resto, con «Ver todas». */
const A_LA_VISTA: Record<string, number> = { espacios: 3, sesiones: 5, pagos: 5, actividad: 5 };

/** El texto del botón que muestra el resto de una lista. */
const VER_TODAS: Record<string, (n: number) => string> = {
  espacios: (n) => `Ver los ${n} espacios`,
  sesiones: (n) => `Ver las ${n} sesiones`,
  pagos: (n) => `Ver los ${n} pagos`,
  actividad: (n) => `Ver todo (${n})`,
};

/**
 * Deja a la vista las primeras filas de una lista larga y pone, después de ella, un botón que
 * muestra las demás. Las filas escondidas siguen en la página: el botón solo las destapa.
 */
function resumir(id: string, lista: Element | null | undefined) {
  if (!lista) return;
  lista.parentElement?.querySelector(':scope > [data-ver-todas]')?.remove();
  const limite = A_LA_VISTA[id];
  const filas = [...lista.children] as HTMLElement[];
  if (!limite || filas.length <= limite) return;
  for (const f of filas.slice(limite)) f.hidden = true;
  const boton = nodo(
    'button',
    'ed1-boton ed1-boton--texto cuenta-ver-todas',
    VER_TODAS[id]?.(filas.length) ?? `Ver todas (${filas.length})`,
  );
  boton.type = 'button';
  boton.dataset['verTodas'] = '';
  boton.addEventListener('click', () => {
    for (const f of filas) f.hidden = false;
    boton.remove();
  });
  lista.after(boton);
}

/** Lo que cuenta la franja: cuántos espacios y cuántos asistentes con acceso. */
const resumen: { espacios: number | null; asistentes: number | null } = {
  espacios: null,
  asistentes: null,
};
function pintarResumen() {
  const partes: string[] = [];
  if (resumen.espacios !== null)
    partes.push(`${resumen.espacios} ${resumen.espacios === 1 ? 'espacio' : 'espacios'}`);
  if (resumen.asistentes !== null)
    partes.push(
      resumen.asistentes === 1
        ? '1 asistente con acceso'
        : `${resumen.asistentes} asistentes con acceso`,
    );
  for (const el of todos('[data-resumen]')) el.textContent = partes.join(' · ');
}

/** El número junto al título de un bloque; vacío mientras no se sabe o si no hay nada. */
function pintarCuantos(selector: string, n: number | null) {
  for (const el of todos(selector)) el.textContent = n ? String(n) : '';
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
  resumen.espacios = cuerpo.espacios.length;
  pintarResumen();
  pintarCuantos('[data-cuantos-espacios]', cuerpo.espacios.length);
  if (cuerpo.espacios.length === 0) {
    mostrarEspacios('vacio');
    return;
  }
  for (const lista of todos('[data-espacios-lista]')) {
    lista.replaceChildren(...cuerpo.espacios.map(tarjeta));
    resumir('espacios', lista);
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

interface RadicadoVisible {
  numero: string;
  tipo: 'consulta' | 'reclamo' | 'supresion';
  creado: string;
  vence: string;
  estado: 'abierto' | 'respondido';
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
  // El monto a la derecha, como la acción de las otras listas: las cifras quedan en columna. Debajo,
  // el estado como insignia: verde lo aprobado, gris lo que no se terminó (HU-C7.9).
  const lado = nodo('div', 'cuenta-pago');
  lado.append(
    nodo('span', 'portada__monto', pesos(p.monto_cop)),
    nodo(
      'span',
      `cuenta-insignia ${p.estado === 'aprobado' ? 'cuenta-insignia--exito' : 'cuenta-insignia--suave'}`,
      ESTADO_DEL_PAGO[p.estado] ?? p.estado,
    ),
  );
  return fila(
    [document.createTextNode(`${p.plan_nombre} · ${p.espacio}`)],
    `${periodo} · pagado el ${fecha(p.creado)}`,
    lado,
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

const TIPO_DE_RADICADO: Record<RadicadoVisible['tipo'], string> = {
  consulta: 'Consulta',
  reclamo: 'Reclamo',
  supresion: 'Supresión',
};

/** Una solicitud de la Ley 1581 (HU-C7.7). `vence` es un día de Bogotá: al mediodía no cambia de fecha. */
const filaDeRadicado = (s: RadicadoVisible) =>
  fila(
    [document.createTextNode(`${TIPO_DE_RADICADO[s.tipo]} · ${s.numero}`)],
    s.estado === 'respondido'
      ? `Hecha el ${fecha(s.creado)} · Respondida`
      : `Hecha el ${fecha(s.creado)} · te respondemos a más tardar el ${fecha(`${s.vence}T12:00:00Z`)}`,
  );

const cargarRadicados = () =>
  cargarBloque<RadicadoVisible>('datos', '/api/core/cuenta/radicados', 'radicados', filaDeRadicado);

/** «Descargar mis datos»: el JSON del CORE, guardado como archivo en este equipo. */
async function descargarMisDatos(boton: HTMLButtonElement) {
  const estado = document.querySelector<HTMLElement>('[data-descarga-estado]');
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  if (estado) estado.textContent = 'Preparando tus datos…';
  const { r, cuerpo } = await alCore('/api/core/cuenta/mis-datos');
  boton.disabled = false;
  boton.removeAttribute('aria-busy');
  if (!r?.ok) {
    if (estado) estado.textContent = 'No pudimos preparar tus datos. Intenta de nuevo.';
    return;
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(cuerpo, null, 2)], { type: 'application/json' }),
  );
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `mis-datos-laboratorio-digital-${new Date().toISOString().slice(0, 10)}.json`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (estado) estado.textContent = 'Listo: el archivo quedó en tus descargas.';
}

/** Radicar una consulta, un reclamo o una supresión: el número y la fecha límite, a la vista. */
async function radicar(formulario: HTMLFormElement) {
  const tipo = formulario.querySelector<HTMLSelectElement>('select[name="tipo"]');
  const texto = formulario.querySelector<HTMLTextAreaElement>('textarea[name="texto"]');
  const error = formulario.querySelector<HTMLElement>('[data-radicar-error]');
  const hecho = formulario.querySelector<HTMLElement>('[data-radicado]');
  const enviar = formulario.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!tipo || !texto || !error || !hecho || !enviar) return;
  const marcar = (motivo: string | null) => {
    error.textContent = motivo ?? '';
    error.hidden = !motivo;
    texto.closest('.ed1-campo')?.classList.toggle('ed1-campo--con-error', Boolean(motivo));
    if (motivo) {
      texto.setAttribute('aria-invalid', 'true');
      texto.setAttribute('aria-describedby', 'radicar-texto-ayuda radicar-texto-error');
    } else {
      texto.removeAttribute('aria-invalid');
      texto.setAttribute('aria-describedby', 'radicar-texto-ayuda');
    }
  };
  hecho.hidden = true;
  if (texto.value.trim().length < 10) {
    marcar('Cuéntanos un poco más: al menos 10 caracteres.');
    texto.focus();
    return;
  }
  marcar(null);
  enviar.disabled = true;
  enviar.setAttribute('aria-busy', 'true');
  const { r, cuerpo } = await alCore('/api/core/cuenta/radicar', {
    tipo: tipo.value,
    texto: texto.value,
  });
  enviar.disabled = false;
  enviar.removeAttribute('aria-busy');
  if (!r?.ok) {
    marcar(
      (cuerpo['motivo'] as string | undefined) ??
        'No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.',
    );
    return;
  }
  texto.value = '';
  const parrafo = hecho.querySelector('[data-radicado-texto]');
  if (parrafo) parrafo.textContent = String(cuerpo['mensaje'] ?? '');
  hecho.hidden = false;
  hecho.scrollIntoView?.({ block: 'nearest' });
  await cargarRadicados();
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
  pintarCuantos(`[data-bloque="${id}"] [data-cuantos]`, lista.length);
  if (id === 'asistentes') {
    resumen.asistentes = lista.length;
    pintarResumen();
  }
  if (lista.length === 0) {
    mostrarBloque(id, 'vacio');
    return lista;
  }
  const ul = bloque(id)?.querySelector('[data-estado="lista"]');
  ul?.replaceChildren(...lista.map(pintarFila));
  resumir(id, ul);
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
  void cargarRadicados();
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
  for (const boton of todos<HTMLButtonElement>('button[data-descargar]')) {
    boton.addEventListener('click', () => void descargarMisDatos(boton));
  }
  for (const formulario of todos<HTMLFormElement>('form[data-radicar]')) {
    formulario.addEventListener('submit', (ev) => {
      ev.preventDefault();
      void radicar(formulario);
    });
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
