/**
 * La pantalla de consentimiento (HU-C9.4). Lee la solicitud que dejó el CORE en el fragmento, la
 * guarda en esta pestaña por si hay que entrar con Google primero, y la muestra. «Permitir» y «No
 * permitir» le mandan al CORE el pedido tal cual, que lo valida otra vez, y siguen a la dirección
 * que el CORE devuelve: la del asistente, con el código o con el error.
 *
 * Todo lo que viene del fragmento se pinta como texto, nunca como HTML.
 */
import { alCore, conSesion } from './sesion.ts';

const CLAVE = 'ed1-autorizar';

interface Solicitud {
  pedido: Record<string, string>;
  cliente: { nombre: string; uri: string | null; tipo: string };
  producto: string;
  producto_nombre: string;
  alcances: { id: string; descripcion: string }[];
  vuelve_a: string;
}

interface Espacio {
  org_id: string;
  nombre: string;
  producto: string;
  rol: string;
}

const uno = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);

function mostrarError(texto: string) {
  const caja = uno('[data-autorizar-error]');
  const p = uno('[data-autorizar-error-texto]');
  if (p) p.textContent = texto;
  if (caja) caja.hidden = false;
  const solicitud = uno('[data-solicitud]');
  if (solicitud) solicitud.hidden = true;
}

function desdeBase64url(texto: string): string {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** La solicitud del fragmento, o la guardada en esta pestaña al volver de Google. */
export function leerSolicitud(
  hash: string,
  guardada: string | null,
): Solicitud | { error: string } | null {
  const fragmento = new URLSearchParams(hash.slice(1));
  const error = fragmento.get('error');
  if (error) return { error };
  const cruda = fragmento.get('solicitud');
  try {
    if (cruda) return JSON.parse(desdeBase64url(cruda)) as Solicitud;
    return guardada ? (JSON.parse(guardada) as Solicitud) : null;
  } catch {
    return { error: 'La solicitud llegó dañada. Vuelve al asistente e inténtalo otra vez.' };
  }
}

function pintar(s: Solicitud, espacios: Espacio[]) {
  for (const [selector, texto] of [
    ['[data-cliente-nombre]', s.cliente.nombre],
    ['[data-producto-nombre]', s.producto_nombre],
    ['[data-vuelve-a]', s.vuelve_a],
  ] as const) {
    const el = uno(selector);
    if (el) el.textContent = texto;
  }
  uno('[data-alcances]')?.replaceChildren(
    ...s.alcances.map((a) => {
      const li = document.createElement('li');
      li.className = 'ed1-lista__elemento';
      li.textContent = a.descripcion;
      return li;
    }),
  );
  const opciones = uno('[data-opciones-espacio]');
  opciones?.replaceChildren(
    ...espacios.map((e, i) => {
      const label = document.createElement('label');
      label.className = 'portada__acepto';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'espacio';
      input.value = e.org_id;
      input.checked = i === 0;
      const texto = document.createElement('span');
      texto.textContent = `${e.nombre} · ${e.rol.charAt(0).toUpperCase()}${e.rol.slice(1)}`;
      label.append(input, texto);
      return label;
    }),
  );
  const sinEspacios = uno('[data-sin-espacios]');
  if (sinEspacios) sinEspacios.hidden = espacios.length > 0;
  const permitir = uno<HTMLButtonElement>('[data-permitir]');
  if (permitir) permitir.disabled = espacios.length === 0;
  const solicitud = uno('[data-solicitud]');
  if (solicitud) solicitud.hidden = false;
}

async function decidir(s: Solicitud, decision: 'permitir' | 'negar', boton: HTMLButtonElement) {
  const org = uno<HTMLInputElement>('input[name="espacio"]:checked')?.value;
  const estado = uno('[data-autorizar-estado]');
  boton.disabled = true;
  boton.setAttribute('aria-busy', 'true');
  if (estado)
    estado.textContent = decision === 'permitir' ? 'Dando acceso…' : 'Avisando al asistente…';
  const { r, cuerpo } = await alCore('/api/core/cuenta/autorizar', {
    pedido: s.pedido,
    decision,
    ...(org ? { org_id: org } : {}),
  });
  boton.disabled = false;
  boton.removeAttribute('aria-busy');
  if (r?.ok && typeof cuerpo['vuelta'] === 'string') {
    sessionStorage.removeItem(CLAVE);
    location.assign(cuerpo['vuelta']);
    return;
  }
  if (estado) estado.textContent = '';
  mostrarError(
    typeof cuerpo['motivo'] === 'string'
      ? cuerpo['motivo']
      : 'No pudimos completar la decisión. Revisa tu conexión e intenta de nuevo.',
  );
}

async function iniciar() {
  const leida = leerSolicitud(location.hash, sessionStorage.getItem(CLAVE));
  if (location.hash.includes('solicitud=') || location.hash.includes('error=')) {
    history.replaceState(null, '', location.pathname);
  }
  if (!leida) {
    mostrarError('No hay ninguna solicitud. Vuelve al asistente y pide acceso desde ahí.');
    return;
  }
  if ('error' in leida) {
    mostrarError(leida.error);
    return;
  }
  sessionStorage.setItem(CLAVE, JSON.stringify(leida));
  if (!(await conSesion)) return; // el formulario de entrada ya está a la vista
  const { r, cuerpo } = await alCore('/api/core/cuenta/espacios');
  if (!r?.ok || !Array.isArray(cuerpo['espacios'])) {
    mostrarError('No pudimos traer tus espacios. Revisa tu conexión e intenta de nuevo.');
    return;
  }
  const espacios = (cuerpo['espacios'] as Espacio[]).filter((e) => e.producto === leida.producto);
  pintar(leida, espacios);
  for (const [selector, decision] of [
    ['[data-permitir]', 'permitir'],
    ['[data-negar]', 'negar'],
  ] as const) {
    const boton = uno<HTMLButtonElement>(selector);
    boton?.addEventListener('click', () => void decidir(leida, decision, boton));
  }
}

if (typeof document !== 'undefined') void iniciar();
