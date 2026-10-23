/**
 * La consola del dueño en el navegador (HU-C13.5). Entra como la cuenta (`sesion.ts`), con la app
 * `consola` y su propia sesión en este navegador: canjea el `#entrar=` de la vuelta, renueva con el
 * refresh guardado y pide los cuatro bloques al CORE. Todo lo que llega se pinta como texto, y nada
 * de esta página escribe en el CORE salvo «Salir».
 */
const CLAVE = 'ed1-consola';
const CLAVE_DISPOSITIVO = 'ed1-cuenta-dispositivo';
const BLOQUES = ['hoy', 'crecio', 'revisar', 'roto'] as const;
type Bloque = (typeof BLOQUES)[number];

interface Guardado {
  refresh: string;
}

let acceso: string | null = null;

const uno = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s);
const todos = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelectorAll<T>(s);

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

function pintar(conSesion: boolean) {
  for (const el of todos('[data-sin-sesion]')) el.hidden = conSesion;
  for (const el of todos('[data-con-sesion]')) el.hidden = !conSesion;
}

function decir(texto: string) {
  const caja = uno('[data-error]');
  const p = uno('[data-error-texto]');
  if (p) p.textContent = texto;
  if (caja) caja.hidden = false;
}

/** Vuelve a la puerta de entrada, diciendo por qué. */
function aLaEntrada(motivo: string) {
  localStorage.removeItem(CLAVE);
  acceso = null;
  pintar(false);
  const nota = uno('[data-sin-sesion-texto]');
  if (nota) nota.textContent = motivo;
}

async function alCore(ruta: string, datos: unknown) {
  const r = await fetch(ruta, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(acceso ? { authorization: `Bearer ${acceso}` } : {}),
    },
    body: JSON.stringify(datos),
  }).catch(() => null);
  const cuerpo = ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return { r, cuerpo };
}

async function canjear(codigo: string): Promise<boolean> {
  const { r, cuerpo } = await alCore('/api/core/auth/canje', {
    codigo,
    dispositivo: dispositivo(),
  });
  if (!r?.ok || typeof cuerpo['refresh'] !== 'string') {
    decir(String(cuerpo['motivo'] ?? 'No pudimos completar la entrada. Intenta de nuevo.'));
    return false;
  }
  localStorage.setItem(CLAVE, JSON.stringify({ refresh: cuerpo['refresh'] }));
  acceso = typeof cuerpo['acceso'] === 'string' ? cuerpo['acceso'] : null;
  return true;
}

/**
 * Una sola renovación a la vez: los cuatro bloques la piden juntos, y un refresh que rota mientras
 * otro bloque lo usa sacaría al dueño de la consola.
 */
let renovando: Promise<boolean> | null = null;
function renovar(): Promise<boolean> {
  renovando ??= renovarAhora().finally(() => {
    renovando = null;
  });
  return renovando;
}

async function renovarAhora(): Promise<boolean> {
  const g = leer();
  if (!g) return false;
  const { r, cuerpo } = await alCore('/api/core/auth/refrescar', { refresh: g.refresh });
  if (r?.status === 401 || r?.status === 403) {
    aLaEntrada('Tu sesión venció. Vuelve a entrar.');
    return false;
  }
  if (!r?.ok || typeof cuerpo['acceso'] !== 'string') return false;
  acceso = cuerpo['acceso'];
  if (typeof cuerpo['refresh'] === 'string') {
    localStorage.setItem(CLAVE, JSON.stringify({ refresh: cuerpo['refresh'] }));
  }
  return true;
}

// ── Pintar ──────────────────────────────────────────────────────────────────────────────────

const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;
const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});
const fecha = (iso: string) => FECHA.format(new Date(iso.length === 10 ? `${iso}T17:00:00Z` : iso));

function nodo<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase = '', texto?: string) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function subtitulo(texto: string) {
  return nodo('h3', 'portada__subtitulo-menor', texto);
}

/** Una lista de filas de texto; vacía, dice lo que corresponde. */
function lista(filas: string[][], vacio: string): HTMLElement {
  if (filas.length === 0) return nodo('p', 'portada__detalle', vacio);
  const ul = nodo('ul', 'ed1-lista');
  for (const [titulo, detalle] of filas) {
    const li = nodo('li', 'ed1-lista__elemento');
    li.append(nodo('p', 'portada__fila-titulo', titulo ?? ''));
    if (detalle) li.append(nodo('p', 'portada__detalle', detalle));
    ul.append(li);
  }
  return ul;
}

/** Una cifra grande con su etiqueta. */
function cifra(etiqueta: string, valor: string, detalle?: string): HTMLElement {
  const caja = nodo('div', 'consola__cifra');
  caja.append(
    nodo('p', 'consola__cifra-etiqueta', etiqueta),
    nodo('p', 'consola__cifra-valor', valor),
  );
  if (detalle) caja.append(nodo('p', 'portada__detalle', detalle));
  return caja;
}

type Datos = Record<string, unknown>;
interface Suma {
  total_cop: number;
  detalle: { producto: string; medio: string; pagos: number; cop: number }[];
}

const AVISO: Record<string, string> = {
  'en-gracia': 'en gracia',
  'vence-en-1-dia': 'vence mañana',
  'vence-en-7-dias': 'vence esta semana',
};

const PINTORES: Record<Bloque, (d: Datos) => HTMLElement[]> = {
  hoy(d) {
    const entro = d['entro'] as Record<'hoy' | 'semana' | 'mes', Suma>;
    const cifras = nodo('div', 'consola__cifras');
    cifras.append(
      cifra('Hoy', pesos(entro.hoy.total_cop)),
      cifra('Últimos 7 días', pesos(entro.semana.total_cop)),
      cifra('Este mes', pesos(entro.mes.total_cop)),
    );
    const vencen = d['vencen'] as {
      espacio: string;
      producto: string;
      plan: string;
      vence: string;
      aviso: string;
    }[];
    const raros = d['para_revisar'] as {
      producto: string;
      medio: string;
      cop: number;
      estado: string;
      desde: string;
    }[];
    return [
      cifras,
      lista(
        entro.mes.detalle.map((g) => [
          `${g.producto} · ${g.medio}`,
          `${g.pagos} ${g.pagos === 1 ? 'pago' : 'pagos'} · ${pesos(g.cop)} este mes`,
        ]),
        'Este mes todavía no entró ningún pago.',
      ),
      subtitulo('Vencen'),
      lista(
        vencen.map((v) => [
          `${v.espacio} · ${v.producto}`,
          `Plan ${v.plan} · ${AVISO[v.aviso] ?? v.aviso} · ${fecha(v.vence)}`,
        ]),
        'Ningún plan vence esta semana.',
      ),
      subtitulo('Pagos para revisar'),
      lista(
        raros.map((p) => [
          `${p.producto} · ${p.medio} · ${pesos(p.cop)}`,
          `${p.estado === 'revisar' ? 'En revisión' : 'Esperando'} desde ${fecha(p.desde)}`,
        ]),
        'No hay pagos para revisar.',
      ),
    ];
  },
  crecio(d) {
    const cuentas = d['cuentas_nuevas'] as { semana: string; n: number }[];
    const espacios = d['espacios_nuevos'] as { producto: string; semanas: { n: number }[] }[];
    const planes = d['por_plan'] as {
      producto: string;
      plan: string;
      gratuito: boolean;
      espacios: number;
    }[];
    const primeros = d['pagaron_por_primera_vez'] as { producto: string; espacios: number }[];
    const interes = d['interes'] as { producto: string; plan: string; personas: number }[];
    const total = (xs: { n: number }[]) => xs.reduce((s, x) => s + x.n, 0);
    const cifras = nodo('div', 'consola__cifras');
    cifras.append(
      cifra(
        'Cuentas nuevas esta semana',
        String(cuentas.at(-1)?.n ?? 0),
        `${total(cuentas)} en 8 semanas`,
      ),
      cifra(
        'Pagaron por primera vez este mes',
        String(primeros.reduce((s, p) => s + p.espacios, 0)),
      ),
    );
    return [
      cifras,
      subtitulo('Espacios nuevos'),
      lista(
        espacios.map((e) => [
          e.producto,
          `${e.semanas.at(-1)?.n ?? 0} esta semana · ${total(e.semanas)} en 8 semanas`,
        ]),
        'No hubo espacios nuevos en 8 semanas.',
      ),
      subtitulo('Espacios por plan'),
      lista(
        planes.map((p) => [
          `${p.producto} · ${p.plan}`,
          `${p.espacios} ${p.gratuito ? '· gratis' : '· pago'}`,
        ]),
        'Todavía no hay espacios.',
      ),
      subtitulo('Lista de interés'),
      lista(
        interes.map((i) => [`${i.producto} · ${i.plan}`, `${i.personas} interesados`]),
        'Nadie se ha anotado.',
      ),
    ];
  },
  revisar(d) {
    const radicados = d['radicados'] as {
      numero: string;
      tipo: string;
      vence: string;
      dias_habiles: number;
      urgente: boolean;
    }[];
    if (radicados.length === 0) {
      return [nodo('p', 'portada__detalle', 'No hay solicitudes de datos abiertas.')];
    }
    const ul = nodo('ul', 'ed1-lista');
    for (const r of radicados) {
      const li = nodo('li', 'ed1-lista__elemento');
      const titulo = nodo('p', 'portada__fila-titulo', `${r.numero} · ${r.tipo}`);
      if (r.urgente) titulo.append(' ', nodo('span', 'ed1-etiqueta consola__urgente', 'Urgente'));
      const quedan =
        r.dias_habiles < 0
          ? 'venció'
          : `${r.dias_habiles} ${r.dias_habiles === 1 ? 'día hábil' : 'días hábiles'}`;
      li.append(
        titulo,
        nodo('p', 'portada__detalle', `Responder a más tardar el ${fecha(r.vence)} · ${quedan}`),
      );
      ul.append(li);
    }
    return [ul];
  },
  roto(d) {
    const copia = d['copia'] as {
      semana: string;
      bases: { base: string; estado: string; intentos: number; motivo: string | null }[];
    };
    const correos = d['correos'] as {
      cupo: number;
      usados: number;
      por_estado: { tipo: string; estado: string; motivo: string | null; n: number }[];
    };
    const fallidos = correos.por_estado.filter((c) => c.estado === 'fallido');
    const cifras = nodo('div', 'consola__cifras');
    cifras.append(cifra('Correos de hoy', `${correos.usados} de ${correos.cupo}`));
    return [
      subtitulo(`Copia de la semana del ${fecha(copia.semana)}`),
      lista(
        copia.bases.map((b) => [
          b.base,
          b.estado === 'hecha'
            ? 'Hecha'
            : b.estado === 'fallida'
              ? `Falló ${b.intentos} ${b.intentos === 1 ? 'vez' : 'veces'}: ${b.motivo ?? 'sin motivo'}`
              : 'Pendiente',
        ]),
        'La copia de esta semana todavía no empieza, o no está configurada.',
      ),
      cifras,
      lista(
        fallidos.map((c) => [
          `${c.tipo === 'aviso' ? 'Avisos' : 'Enlaces'} que no salieron`,
          `${c.n} · ${c.motivo ?? ''}`,
        ]),
        'Hoy no falló ningún correo.',
      ),
    ];
  },
};

function mostrar(bloque: Bloque, estado: 'cargando' | 'error' | 'lista', causa?: string) {
  const b = uno(`[data-bloque="${bloque}"]`);
  if (!b) return;
  for (const el of b.querySelectorAll<HTMLElement>('[data-estado]'))
    el.hidden = el.dataset['estado'] !== estado;
  const p = b.querySelector('[data-causa]');
  if (causa && p) p.textContent = causa;
}

async function cargar(bloque: Bloque): Promise<void> {
  mostrar(bloque, 'cargando');
  for (let intento = 0; intento < 2; intento++) {
    if (!acceso && !(await renovar())) {
      if (leer()) mostrar(bloque, 'error', 'Sin conexión: no pudimos hablar con el CORE.');
      return;
    }
    const { r, cuerpo } = await alCore(`/api/core/consola/${bloque}`, {});
    if (r?.status === 401 && intento === 0) {
      acceso = null;
      continue;
    }
    if (r?.status === 403) {
      if (cuerpo['estado'] === 'entrar-de-nuevo') {
        aLaEntrada(String(cuerpo['motivo']));
      } else {
        pintar(false);
        for (const el of todos('[data-sin-sesion]')) el.hidden = true;
        decir(String(cuerpo['motivo'] ?? 'Esta página no es para tu cuenta.'));
      }
      return;
    }
    if (!r?.ok) {
      mostrar(
        bloque,
        'error',
        String(cuerpo['motivo'] ?? 'No se pudo leer este bloque. Intenta de nuevo.'),
      );
      return;
    }
    const contenido = uno(`[data-bloque="${bloque}"] [data-estado="lista"]`);
    contenido?.replaceChildren(...PINTORES[bloque](cuerpo));
    mostrar(bloque, 'lista');
    return;
  }
}

async function salir(boton: HTMLButtonElement) {
  const g = leer();
  boton.disabled = true;
  if (g) await alCore('/api/core/auth/salir', { refresh: g.refresh });
  boton.disabled = false;
  aLaEntrada('Saliste de la consola.');
}

async function iniciar() {
  for (const el of todos<HTMLInputElement>('input[data-vuelta]')) {
    el.value = `${location.origin}${location.pathname}`;
  }
  const codigo = new URLSearchParams(location.hash.slice(1)).get('entrar');
  if (codigo) {
    history.replaceState(null, '', location.pathname);
    await canjear(codigo);
  }
  for (const b of todos<HTMLButtonElement>('button[data-salir]')) {
    b.addEventListener('click', () => void salir(b));
  }
  for (const bloque of BLOQUES) {
    uno<HTMLButtonElement>(`[data-bloque="${bloque}"] button[data-reintentar]`)?.addEventListener(
      'click',
      () => void cargar(bloque),
    );
  }
  if (!leer()) {
    pintar(false);
    return;
  }
  pintar(true);
  await Promise.all(BLOQUES.map(cargar));
}

void iniciar();
