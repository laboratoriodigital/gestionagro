/**
 * La consola del dueño en el navegador (HU-C13.5), como boletín del día. Entra como la cuenta
 * (`sesion.ts`), con la app `consola` y su propia sesión en este navegador: canjea el `#entrar=` de
 * la vuelta, renueva con el refresh guardado y pide los cuatro bloques al CORE. Con «hoy» y «creció»
 * arma la fila de cada producto y su desempeño; con «revisar» y «roto», las observaciones generales.
 * Todo lo que llega se pinta como texto, y nada de esta página escribe en el CORE salvo «Salir».
 */
const CLAVE = 'ed1-consola';
const CLAVE_DISPOSITIVO = 'ed1-cuenta-dispositivo';

interface Guardado {
  refresh: string;
}

let acceso: string | null = null;

const uno = <T extends HTMLElement = HTMLElement>(s: string, raiz: ParentNode = document) =>
  raiz.querySelector<T>(s);
const todos = <T extends HTMLElement = HTMLElement>(s: string, raiz: ParentNode = document) =>
  raiz.querySelectorAll<T>(s);

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
 * Una sola renovación a la vez: los bloques la piden juntos, y un refresh que rota mientras otro
 * bloque lo usa sacaría al dueño de la consola.
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

type Bloque = 'hoy' | 'crecio' | 'revisar' | 'roto';
type Leido = { datos: Record<string, unknown> } | { motivo: string } | { fuera: true };

/** Un bloque del CORE, renovando una vez si el acceso venció. `fuera` si no hay nada que mostrar. */
async function bloque(nombre: Bloque): Promise<Leido> {
  for (let intento = 0; intento < 2; intento++) {
    if (!acceso && !(await renovar())) {
      return leer()
        ? { motivo: 'Sin conexión: no pudimos hablar con la plataforma.' }
        : { fuera: true };
    }
    const { r, cuerpo } = await alCore(`/api/core/consola/${nombre}`, {});
    if (r?.status === 401 && intento === 0) {
      acceso = null;
      continue;
    }
    if (r?.status === 403) {
      if (cuerpo['estado'] === 'entrar-de-nuevo') aLaEntrada(String(cuerpo['motivo']));
      else {
        pintar(false);
        for (const el of todos('[data-sin-sesion]')) el.hidden = true;
        decir(String(cuerpo['motivo'] ?? 'Esta página no es para tu cuenta.'));
      }
      return { fuera: true };
    }
    if (!r?.ok) {
      return { motivo: String(cuerpo['motivo'] ?? 'No se pudo leer. Intenta de nuevo.') };
    }
    return { datos: cuerpo };
  }
  return { motivo: 'No se pudo leer. Intenta de nuevo.' };
}

// ── Formatos ───────────────────────────────────────────────────────────────────────────────

const pesos = (n: number) => `COP ${n.toLocaleString('es-CO')}`;
const FECHA_CORTA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});
const fecha = (iso: string) =>
  FECHA_CORTA.format(new Date(iso.length === 10 ? `${iso}T17:00:00Z` : iso)).replace('.', '');
const DIA_MS = 24 * 60 * 60 * 1000;
const DIA_SEMANA = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'America/Bogota',
});

/**
 * El periodo del boletín y el día, como en la franja de uno: «Semana del 19 al 25 de oct ·
 * viernes 23». La semana va de lunes a domingo, en días de Bogotá (UTC−5, sin horario de verano).
 */
export function periodoDelDia(ahora: number): string {
  const bogota = new Date(ahora - 5 * 60 * 60 * 1000);
  const lunes = new Date(bogota.getTime() - ((bogota.getUTCDay() + 6) % 7) * DIA_MS);
  const domingo = new Date(lunes.getTime() + 6 * DIA_MS);
  const mes = (d: Date) => fecha(d.toISOString().slice(0, 10)).split(' ').slice(1).join(' ');
  const desde =
    mes(lunes) === mes(domingo)
      ? String(lunes.getUTCDate())
      : fecha(lunes.toISOString().slice(0, 10));
  return `Semana del ${desde} al ${fecha(domingo.toISOString().slice(0, 10))} · ${DIA_SEMANA.format(new Date(ahora)).replace(',', '').replace('.', '')}`;
}
const plural = (n: number, singular: string, varios: string) =>
  `${n} ${n === 1 ? singular : varios}`;

function nodo<K extends keyof HTMLElementTagNameMap>(etiqueta: K, clase = '', texto?: string) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

// ── Cada producto: su fila del boletín ─────────────────────────────────────────────────────

interface Grupo {
  producto: string;
  medio: string;
  pagos: number;
  cop: number;
}
interface Hoy {
  entro: Record<'hoy' | 'semana' | 'mes', { total_cop: number; detalle: Grupo[] }>;
  vencen: { espacio: string; producto: string; plan: string; vence: string; aviso: string }[];
  para_revisar: { producto: string; medio: string; cop: number; estado: string; desde: string }[];
}
interface Crecio {
  espacios_nuevos: { producto: string; semanas: { n: number }[] }[];
  por_plan: { producto: string; plan: string; gratuito: boolean; espacios: number }[];
  pagaron_por_primera_vez: { producto: string; espacios: number }[];
  interes: { producto: string; plan: string; personas: number }[];
}

export type Desempeno = 'superior' | 'alto' | 'basico' | 'bajo';
const NOMBRE_DEL_DESEMPENO: Record<Desempeno, string> = {
  superior: 'Superior',
  alto: 'Alto',
  basico: 'Básico',
  bajo: 'Bajo',
};

/** La fila de un producto: sus cifras, su desempeño por la regla escrita en la página y su observación. */
export function filaDelProducto(producto: string, hoy: Hoy, crecio: Crecio) {
  const suma = (ventana: 'hoy' | 'semana' | 'mes') =>
    hoy.entro[ventana].detalle
      .filter((g) => g.producto === producto)
      .reduce((s, g) => s + g.cop, 0);
  const enRevision = hoy.para_revisar.filter(
    (p) => p.producto === producto && p.estado === 'revisar',
  );
  const esperando = hoy.para_revisar.filter(
    (p) => p.producto === producto && p.estado !== 'revisar',
  );
  const vencen = hoy.vencen.filter((v) => v.producto === producto);
  const enGracia = vencen.filter((v) => v.aviso === 'en-gracia');
  const nuevos =
    crecio.espacios_nuevos.find((e) => e.producto === producto)?.semanas.at(-1)?.n ?? 0;
  const semana = suma('semana');
  let desempeno: Desempeno;
  let observacion: string;
  if (enRevision.length > 0) {
    desempeno = 'bajo';
    observacion = `${plural(enRevision.length, 'pago en revisión', 'pagos en revisión')}: míralo en Bold.`;
  } else if (esperando.length > 0 || vencen.length > 0) {
    desempeno = 'basico';
    const partes = [
      vencen.length - enGracia.length > 0
        ? `${plural(vencen.length - enGracia.length, 'plan vence', 'planes vencen')} esta semana`
        : null,
      enGracia.length > 0
        ? `${plural(enGracia.length, 'espacio en gracia', 'espacios en gracia')}`
        : null,
      esperando.length > 0
        ? `${plural(esperando.length, 'pago esperando', 'pagos esperando')} hace más de una hora`
        : null,
    ].filter(Boolean);
    observacion = `${partes.join(' · ')}.`;
  } else if (semana > 0 || nuevos > 0) {
    desempeno = 'superior';
    const partes = [
      semana > 0 ? 'Entró plata' : null,
      nuevos > 0 ? plural(nuevos, 'espacio nuevo', 'espacios nuevos') : null,
    ].filter(Boolean);
    observacion = `${partes.join(' · ')}.`;
  } else {
    desempeno = 'alto';
    observacion = 'Al día. Sin novedades esta semana.';
  }
  return {
    hoy: suma('hoy'),
    semana,
    mes: suma('mes'),
    desempeno,
    observacion,
    vencen,
    pendientes: [...enRevision, ...esperando],
    planes: crecio.por_plan.filter((p) => p.producto === producto),
    primeros: crecio.pagaron_por_primera_vez.find((p) => p.producto === producto)?.espacios ?? 0,
    interes: crecio.interes.filter((i) => i.producto === producto),
    nuevos,
  };
}

function filaDetalle(titulo: string, filas: string[], vacio: string): HTMLElement[] {
  const h = nodo('h4', 'materia__apartado', titulo);
  if (filas.length === 0) return [h, nodo('p', 'materia__vacio', vacio)];
  const ul = nodo('ul', 'materia__items');
  for (const f of filas) ul.append(nodo('li', '', f));
  return [h, ul];
}

function pintarMateria(li: HTMLElement, f: ReturnType<typeof filaDelProducto>) {
  li.dataset['desempeno'] = f.desempeno;
  const sello = uno('[data-sello]', li);
  if (sello) {
    sello.textContent = NOMBRE_DEL_DESEMPENO[f.desempeno];
    sello.setAttribute('aria-label', `Desempeño: ${NOMBRE_DEL_DESEMPENO[f.desempeno]}`);
    sello.classList.add('sello--estampado');
  }
  const set = (sel: string, texto: string) => {
    const el = uno(sel, li);
    if (el) el.textContent = texto;
  };
  set('[data-hoy]', pesos(f.hoy));
  // La etiqueta «Semana» o «Mes» queda en su lugar: en la tabla ancha la dice el encabezado.
  set('[data-semana] [data-valor]', pesos(f.semana));
  set('[data-mes] [data-valor]', pesos(f.mes));
  set('[data-observacion]', f.observacion);
  uno('[data-detalle]', li)?.replaceChildren(
    ...filaDetalle(
      'Vencen',
      f.vencen.map(
        (v) =>
          `${v.espacio} · ${v.plan} · ${v.aviso === 'en-gracia' ? 'en gracia desde' : 'vence el'} ${fecha(v.vence)}`,
      ),
      'Ningún plan vence esta semana.',
    ),
    ...filaDetalle(
      'Pagos para revisar',
      f.pendientes.map(
        (p) =>
          `${p.medio} · ${pesos(p.cop)} · ${p.estado === 'revisar' ? 'en revisión' : 'esperando'} desde ${fecha(p.desde)}`,
      ),
      'Ninguno.',
    ),
    ...filaDetalle(
      'Espacios por plan',
      f.planes.map(
        (p) =>
          // «gratis» solo cuando el nombre del plan no lo dice ya («Gratis», «Gratuito»).
          `${p.plan} · ${plural(p.espacios, 'espacio', 'espacios')}${p.gratuito && !/^grat/i.test(p.plan) ? ' · gratis' : ''}`,
      ),
      'Todavía no hay espacios.',
    ),
    ...filaDetalle(
      'Este mes',
      [
        `${plural(f.primeros, 'espacio pagó', 'espacios pagaron')} por primera vez`,
        `${plural(f.nuevos, 'espacio nuevo', 'espacios nuevos')} esta semana`,
        ...f.interes.map((i) => `${i.plan} · ${plural(i.personas, 'interesado', 'interesados')}`),
      ],
      '',
    ),
  );
}

async function cargarMaterias(): Promise<number> {
  const error = uno('[data-error-materias]');
  if (error) error.hidden = true;
  const [hoy, crecio] = await Promise.all([bloque('hoy'), bloque('crecio')]);
  if ('fuera' in hoy || 'fuera' in crecio) return 0;
  if ('motivo' in hoy || 'motivo' in crecio) {
    const texto = uno('[data-error-materias-texto]');
    if (texto)
      texto.textContent = 'motivo' in hoy ? hoy.motivo : (crecio as { motivo: string }).motivo;
    if (error) error.hidden = false;
    return 0;
  }
  let atencion = 0;
  for (const li of todos('[data-producto]')) {
    const f = filaDelProducto(
      li.dataset['producto'] ?? '',
      hoy.datos as unknown as Hoy,
      crecio.datos as unknown as Crecio,
    );
    pintarMateria(li, f);
    if (f.desempeno === 'bajo' || f.desempeno === 'basico') atencion++;
  }
  return atencion;
}

// ── Observaciones generales ────────────────────────────────────────────────────────────────

function pintarNota(
  id: string,
  estado: 'bien' | 'atencion' | 'error',
  resumen: string,
  items: string[] = [],
) {
  const li = uno(`[data-general="${id}"]`);
  if (!li) return;
  li.dataset['estado'] = estado;
  const r = uno('[data-resumen]', li);
  if (r) r.textContent = resumen;
  uno('[data-lista]', li)?.replaceChildren(...items.map((t) => nodo('li', '', t)));
}

async function cargarGenerales(): Promise<number> {
  const [revisar, roto] = await Promise.all([bloque('revisar'), bloque('roto')]);
  let atencion = 0;
  if ('datos' in revisar) {
    const rad = revisar.datos['radicados'] as {
      numero: string;
      tipo: string;
      vence: string;
      dias_habiles: number;
      urgente: boolean;
    }[];
    const urgentes = rad.filter((r) => r.urgente).length;
    if (urgentes > 0) atencion++;
    pintarNota(
      'datos',
      urgentes > 0 ? 'atencion' : 'bien',
      rad.length === 0
        ? 'Ninguna abierta.'
        : `${plural(rad.length, 'abierta', 'abiertas')}${urgentes > 0 ? `, ${plural(urgentes, 'vence', 'vencen')} en 3 días hábiles o menos` : ''}.`,
      rad.map((r) => {
        const quedan =
          r.dias_habiles < 0 ? 'venció' : plural(r.dias_habiles, 'día hábil', 'días hábiles');
        return `${r.numero} · ${r.tipo} · hasta el ${fecha(r.vence)} · ${quedan}`;
      }),
    );
  } else if ('motivo' in revisar) pintarNota('datos', 'error', revisar.motivo);

  if ('datos' in roto) {
    const copia = roto.datos['copia'] as {
      semana: string;
      bases: { base: string; estado: string; intentos: number; motivo: string | null }[];
    };
    const correos = roto.datos['correos'] as {
      cupo: number;
      usados: number;
      por_estado: { tipo: string; estado: string; motivo: string | null; n: number }[];
    };
    const fallidas = copia.bases.filter((b) => b.estado === 'fallida');
    const hechas = copia.bases.filter((b) => b.estado === 'hecha').length;
    if (fallidas.length > 0) atencion++;
    pintarNota(
      'copia',
      fallidas.length > 0 ? 'atencion' : 'bien',
      copia.bases.length === 0
        ? `La de la semana del ${fecha(copia.semana)} todavía no empieza, o no está configurada.`
        : `${hechas} de ${copia.bases.length} bases copiadas, semana del ${fecha(copia.semana)}.`,
      fallidas.map(
        (b) =>
          `${b.base}: falló ${plural(b.intentos, 'vez', 'veces')}, ${b.motivo ?? 'sin motivo'}`,
      ),
    );
    const fallidos = correos.por_estado.filter((c) => c.estado === 'fallido');
    if (fallidos.length > 0) atencion++;
    pintarNota(
      'correos',
      fallidos.length > 0 ? 'atencion' : 'bien',
      `${correos.usados} de ${correos.cupo} del cupo de hoy.`,
      fallidos.map(
        (c) =>
          `${c.tipo === 'aviso' ? 'Avisos' : 'Enlaces'} que no salieron: ${c.n} · ${c.motivo ?? ''}`,
      ),
    );
  } else if ('motivo' in roto) {
    pintarNota('copia', 'error', roto.motivo);
    pintarNota('correos', 'error', roto.motivo);
  }
  return atencion;
}

// ── El día ─────────────────────────────────────────────────────────────────────────────────

/**
 * El renglón guía: los productos y los que piden atención, y aparte las observaciones generales.
 * Nunca un número de pendientes mayor que el de productos en la misma frase.
 */
export function renglonGuia(productos: number, atencion: number, observaciones: number): string {
  const partes = [
    plural(productos, 'producto', 'productos'),
    atencion === 0 ? 'todos al día' : `${atencion} ${atencion === 1 ? 'pide' : 'piden'} atención`,
    ...(observaciones > 0 ? [plural(observaciones, 'observación', 'observaciones')] : []),
  ];
  return partes.join(' · ');
}

async function cargarTodo() {
  const productos = todos('[data-producto]').length;
  const [materias, generales] = await Promise.all([cargarMaterias(), cargarGenerales()]);
  const guia = uno('[data-guia]');
  if (guia) {
    guia.textContent = renglonGuia(productos, materias, generales);
    guia.dataset['estado'] = materias + generales === 0 ? 'bien' : 'atencion';
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
  const f = uno('[data-fecha]');
  if (f) f.textContent = periodoDelDia(Date.now());
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
  uno<HTMLButtonElement>('button[data-reintentar-materias]')?.addEventListener(
    'click',
    () => void cargarTodo(),
  );
  if (!leer()) {
    pintar(false);
    return;
  }
  pintar(true);
  await cargarTodo();
}

if (typeof document !== 'undefined') void iniciar();
