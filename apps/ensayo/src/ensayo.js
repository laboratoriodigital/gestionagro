// La app del producto de ensayo (HU-C3.7), solo en staging. Hace lo que hará la app de un segundo
// producto: entrar con su política, canjear, crear su espacio, renovar hacia él y salir. Muestra lo
// que dice el token para que el dueño vea, con sus ojos, que es de Ensayo y no del agro.
const CORE = document.querySelector('meta[name="core"]').content;
const CLAVE = 'ed1-ensayo';
const $ = (s) => document.querySelector(s);
const leer = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
  } catch {
    return null;
  }
};
const guardar = (s) => localStorage.setItem(CLAVE, JSON.stringify(s));

function error(texto) {
  $('[data-error]').textContent = texto;
  $('[data-error]').hidden = false;
}

async function core(ruta, cuerpo, acceso) {
  const r = await fetch(`${CORE}${ruta}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
    },
    body: JSON.stringify(cuerpo),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.motivo ?? `El CORE respondió ${r.status}`);
  return json;
}

/** UUIDv7 (RFC 9562): 48 bits de milisegundos, la versión, la variante y lo demás al azar. */
function uuidv7() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let ms = Date.now();
  for (let i = 5; i >= 0; i--) {
    b[i] = ms % 256;
    ms = Math.floor(ms / 256);
  }
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function reclamos(acceso) {
  const parte = acceso.split('.')[1] ?? '';
  return JSON.parse(atob(parte.replaceAll('-', '+').replaceAll('_', '/')));
}

function pintar(s) {
  $('[data-sin-sesion]').hidden = Boolean(s);
  $('[data-con-sesion]').hidden = !s;
  if (!s) return;
  $('[data-nombre]').textContent = s.usuario?.nombre ?? '';
  const lista = $('[data-espacios]');
  lista.replaceChildren(
    ...(s.organizaciones ?? []).map((o) => {
      const li = document.createElement('li');
      li.textContent = `${o.nombre} (${o.rol}, plan ${o.plan})`;
      return li;
    }),
  );
  $('[data-sin-espacios]').hidden = (s.organizaciones ?? []).length > 0;
  const r = reclamos(s.acceso);
  $('[data-token]').textContent = JSON.stringify(
    { iss: r.iss, ver: r.ver, aud: r.aud, org: r.org, rol: r.rol, plan: r.plan, celda: r.celda },
    null,
    2,
  );
}

async function renovar(s, org) {
  const n = await core('/api/core/auth/refrescar', {
    refresh: s.refresh,
    ...(org ? { org_id: org } : {}),
  });
  const nueva = { ...s, ...n, refresh: n.refresh ?? s.refresh };
  guardar(nueva);
  return nueva;
}

async function iniciar() {
  $('[data-vuelta]').value = `${location.origin}/`;
  const codigo = new URLSearchParams(location.hash.slice(1)).get('entrar');
  let s = leer();
  try {
    if (codigo) {
      history.replaceState(null, '', location.pathname);
      s = await core('/api/core/auth/canje', { codigo, dispositivo: 'ensayo' });
      guardar(s);
    } else if (s) {
      s = await renovar(s, s.org_id);
    }
  } catch (e) {
    error(e.message);
    localStorage.removeItem(CLAVE);
    s = null;
  }
  pintar(s);

  $('[data-crear]').addEventListener('click', async () => {
    try {
      const actual = leer();
      const id = uuidv7();
      const org = await core(
        '/api/core/organizaciones',
        { id, nombre: 'Espacio de prueba' },
        actual.acceso,
      );
      pintar(await renovar(actual, org.org_id));
    } catch (e) {
      error(e.message);
    }
  });
  $('[data-salir]').addEventListener('click', async () => {
    const actual = leer();
    try {
      if (actual) await core('/api/core/auth/salir', { refresh: actual.refresh });
    } catch (e) {
      error(e.message);
      return;
    }
    localStorage.removeItem(CLAVE);
    pintar(null);
  });
}

void iniciar();
