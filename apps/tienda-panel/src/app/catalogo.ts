/**
 * HU-T8.2: el formulario de un producto, sin pantalla. Lo que la persona escribe se queda como lo
 * escribió (texto) y se convierte al enviarlo; así el borrador sobrevive a «vuelve a entrar».
 *
 * CA4: un precio vacío o ilegible se manda como `null` y la API dice qué falta: nunca se vuelve 0.
 * Unas existencias vacías no son «no se cuenta»: eso es una casilla aparte, a propósito.
 */

/** HU-P1.2: la promoción por cantidad de un producto (`promocionDelProducto` de la API). */
export type PromocionDelPanel =
  | { tipo: 'regalo'; lleva: number; paga: number; hasta: string | null }
  | { tipo: 'porcentaje'; porcentaje: number; desdeUnidades: number; hasta: string | null };

/** HU-P1.4: la oferta programada de un producto (`ofertaProgramada` de la API). */
export interface OfertaDelPanel {
  porcentaje: number;
  desde: string;
  hasta: string;
}

/** HU-P1.5: el texto que el producto le pide al comprador (`pideTexto` de la API). */
export interface PideTextoDelPanel {
  etiqueta: string;
  largo: number;
  obligatorio: boolean;
}

/** Como se escribe en la pantalla: todo texto, y `activo` falso si no pide nada. */
export interface PideTextoEnPantalla {
  activo: boolean;
  etiqueta: string;
  largo: string;
  obligatorio: boolean;
}

export const pideTextoEnPantalla = (
  t: PideTextoDelPanel | null | undefined,
): PideTextoEnPantalla => ({
  activo: Boolean(t),
  etiqueta: t?.etiqueta ?? '',
  largo: t ? String(t.largo) : '40',
  obligatorio: t?.obligatorio ?? true,
});

/** HU-P1.5: lo que va a la API. Un número ilegible va como texto: la API dice qué está mal. */
export function pideTextoDelCuerpo(t: PideTextoEnPantalla): unknown {
  if (!t.activo) return null;
  const largo = t.largo.trim();
  return {
    etiqueta: t.etiqueta.trim(),
    largo: /^\d+$/.test(largo) ? Number(largo) : largo,
    obligatorio: t.obligatorio,
  };
}

/** La oferta como se escribe en la pantalla: todo texto, y `activa` falsa si no hay. */
export interface OfertaEnPantalla {
  activa: boolean;
  porcentaje: string;
  desde: string;
  hasta: string;
}

/** HU-P1.4: la oferta guardada, en los campos de la pantalla. */
export const ofertaEnPantalla = (o: OfertaDelPanel | null | undefined): OfertaEnPantalla => ({
  activa: Boolean(o),
  porcentaje: o ? String(o.porcentaje) : '20',
  desde: o?.desde ?? '',
  hasta: o?.hasta ?? '',
});

/** HU-P1.4: lo que va a la API. Un número ilegible va como texto: la API dice qué está mal. */
export function ofertaDelCuerpo(o: OfertaEnPantalla): unknown {
  if (!o.activa) return null;
  const p = o.porcentaje.trim();
  return {
    porcentaje: /^\d+$/.test(p) ? Number(p) : p,
    desde: o.desde.trim(),
    hasta: o.hasta.trim(),
  };
}

/** La promoción como se escribe en la pantalla: todo texto, y `tipo` vacío si no hay. */
export interface PromocionEnPantalla {
  tipo: '' | 'regalo' | 'porcentaje';
  lleva: string;
  paga: string;
  porcentaje: string;
  desde: string;
  hasta: string;
}

export interface ProductoDelPanel {
  id: string;
  version: number;
  slug: string;
  nombre: string;
  descripcionMd: string;
  estado: string;
  enPapelera: boolean;
  opciones: { nombre: string; valores: string[] }[];
  retracto: { aplica: true } | { aplica: false; motivo: string };
  soloMayores: boolean;
  /** HU-T5.10: va primero en la tienda; lleva la etiqueta «Nuevo». */
  destacado?: boolean;
  nuevo?: boolean;
  /** HU-P1.2: la promoción por cantidad, como la guardó la API. */
  promocion?: PromocionDelPanel | null;
  /** HU-P1.4: la oferta programada. */
  oferta?: OfertaDelPanel | null;
  /** HU-P1.5: el texto que pide al comprador. */
  pideTexto?: PideTextoDelPanel | null;
  /** HU-P6.1: físico o digital. */
  tipo?: 'fisico' | 'digital';
  /** HU-P4.4: cómo sale en Google; sin él, el nombre y la descripción. */
  buscadores?: { titulo?: string; descripcion?: string };
  ivaPct: number | null;
  variantes: {
    id: string;
    valores: string[];
    sku: string | null;
    precioCop: number;
    precioAntesCop: number | null;
    stock: number | null;
    reservado: number;
  }[];
  /** HU-T8.3: las fotos, con su miniatura en el host público de las fotos. */
  medios: {
    id: string;
    /** HU-T5.9: la combinación de esta foto; `null`: es una foto general. */
    varianteId?: string | null;
    alt: string;
    ancho: number;
    alto: number;
    formato: string;
    anchos: number[];
    src: string | null;
  }[];
}

export interface FilaDeProducto {
  id: string;
  slug: string;
  nombre: string;
  estado: string;
  version: number;
  combinaciones: number;
  desde: number | null;
  existencias: number | null;
  borrado: string | null;
  /** La oferta programada que rige hoy o que viene; la que terminó no llega. */
  oferta?: { porcentaje: number; desde: string; hasta: string; vigente: boolean } | null;
}

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * «En oferta · 20 %» o «Oferta desde el 5 de nov», para la lista de productos. El mes va escrito
 * aquí: cada navegador abrevia distinto.
 */
export function marcaDeLaOferta(o: FilaDeProducto['oferta']): string | null {
  if (!o) return null;
  if (o.vigente) return `En oferta · ${o.porcentaje} %`;
  const [, m, d] = o.desde.split('-').map(Number);
  return `Oferta desde el ${d} de ${MESES_CORTOS[(m ?? 1) - 1]}`;
}

/** Una página de la lista de productos: de a 50, con el total (bitácora tienda3 21). */
export interface PaginaDeProductos {
  productos: FilaDeProducto[];
  siguiente: string | null;
  total: number;
}

/** La ruta de una página de productos: `q` va siempre, como antes; lo demás, si tiene valor. */
export function rutaDeProductos(o: {
  papelera?: boolean;
  q?: string;
  coleccion?: string;
  cursor?: string | null;
}) {
  const p = new URLSearchParams();
  if (o.papelera) p.set('papelera', '1');
  p.set('q', o.q ?? '');
  if (o.coleccion) p.set('coleccion', o.coleccion);
  if (o.cursor) p.set('cursor', o.cursor);
  return `productos?${p}`;
}

/** Lo que ya se ve, más lo que llega sin repetir: dos páginas pueden traer el mismo si algo cambió entre una y otra. */
export function unirSinRepetir<T>(
  antes: readonly T[],
  nuevos: readonly T[],
  clave: (x: T) => string,
) {
  const vistos = new Set(antes.map(clave));
  return [...antes, ...nuevos.filter((x) => !vistos.has(clave(x)))];
}

export const unirProductos = (
  antes: readonly FilaDeProducto[],
  nuevos: readonly FilaDeProducto[],
) => unirSinRepetir(antes, nuevos, (p) => p.id);

/** La ruta de una página del inventario (bitácora tienda3 21). */
export function rutaDeInventario(o: { q?: string; cursor?: string | null }) {
  const p = new URLSearchParams({ q: o.q ?? '' });
  if (o.cursor) p.set('cursor', o.cursor);
  return `inventario?${p}`;
}

/** «50 de 2.008»: cuántos se ven de cuántos hay, cuando no se ven todos. */
export function cuantosSeVen(vistos: number, total: number, que = 'productos'): string | null {
  if (vistos >= total) return null;
  const n = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Se ven ${n(vistos)} de ${n(total)} ${que}.`;
}

export interface Combinacion {
  /** Se vende: si no, no se manda y la API la deja inactiva. */
  vende: boolean;
  precio: string;
  antes: string;
  stock: string;
  noSeCuenta: boolean;
  sku: string;
}

export interface FormularioDeProducto {
  nombre: string;
  estado: string;
  descripcion: string;
  slug: string;
  /** Los valores van separados por coma, como se escriben en el teléfono. */
  opciones: { nombre: string; valores: string }[];
  combinaciones: Record<string, Combinacion>;
  retractoAplica: boolean;
  retractoMotivo: string;
  soloMayores: boolean;
  /** HU-T5.10: va primero en la tienda; lleva la etiqueta «Nuevo». */
  destacado?: boolean;
  nuevo?: boolean;
  promocion?: PromocionEnPantalla;
  oferta?: OfertaEnPantalla;
  pideTexto?: PideTextoEnPantalla;
  tipo?: 'fisico' | 'digital';
  buscadores?: { titulo: string; descripcion: string };
}

export const ESTADOS: readonly { id: string; texto: string }[] = [
  { id: 'borrador', texto: 'Borrador: no se ve en la tienda' },
  { id: 'activo', texto: 'Activo: se ve y se vende' },
  { id: 'archivado', texto: 'Archivado: ya no se vende' },
];

const formatoPesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
export const enPesos = (n: number) => `$${formatoPesos.format(n)}`;

/** Los valores de un grupo, sin vacíos: «S, M ,L,» es S, M y L. */
export const valoresDe = (texto: string) =>
  texto
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/** Todas las combinaciones de las opciones, en orden; sin opciones, una sola (la única). */
export function combinacionesDe(opciones: FormularioDeProducto['opciones']): string[][] {
  return opciones
    .map((o) => valoresDe(o.valores))
    .filter((v) => v.length > 0)
    .reduce<string[][]>(
      (todas, valores) => todas.flatMap((c) => valores.map((v) => [...c, v])),
      [[]],
    );
}

export const claveDe = (valores: readonly string[]) => valores.join('|');

/**
 * Pesos escritos como en Colombia: «129.000», «$ 129 000», «129000». Con centavos («1.500,50»)
 * devuelve el número con decimales y la API lo rechaza con su mensaje. Vacío o ilegible: `null`.
 */
export function pesos(texto: string): number | null {
  const t = texto.replace(/[$\s ]/g, '');
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return null;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

const sinCombinacion = (): Combinacion => ({
  vende: true,
  precio: '',
  antes: '',
  stock: '',
  noSeCuenta: false,
  sku: '',
});

export function formularioDe(p: ProductoDelPanel | null): FormularioDeProducto {
  const combinaciones: Record<string, Combinacion> = {};
  for (const v of p?.variantes ?? []) {
    combinaciones[claveDe(v.valores)] = {
      vende: true,
      precio: formatoPesos.format(v.precioCop),
      antes: v.precioAntesCop === null ? '' : formatoPesos.format(v.precioAntesCop),
      stock: v.stock === null ? '' : String(v.stock),
      noSeCuenta: v.stock === null,
      sku: v.sku ?? '',
    };
  }
  return {
    nombre: p?.nombre ?? '',
    estado: p?.estado ?? 'borrador',
    descripcion: p?.descripcionMd ?? '',
    slug: p?.slug ?? '',
    opciones: (p?.opciones ?? []).map((o) => ({ nombre: o.nombre, valores: o.valores.join(', ') })),
    combinaciones,
    retractoAplica: p ? p.retracto.aplica : true,
    retractoMotivo: p && !p.retracto.aplica ? p.retracto.motivo : '',
    soloMayores: p?.soloMayores ?? false,
    destacado: p?.destacado ?? false,
    nuevo: p?.nuevo ?? false,
    promocion: promocionEnPantalla(p?.promocion ?? null),
    oferta: ofertaEnPantalla(p?.oferta),
    pideTexto: pideTextoEnPantalla(p?.pideTexto),
    tipo: p?.tipo ?? 'fisico',
    buscadores: {
      titulo: p?.buscadores?.titulo ?? '',
      descripcion: p?.buscadores?.descripcion ?? '',
    },
  };
}

/** HU-P1.2: la promoción guardada, en los campos de la pantalla. */
export function promocionEnPantalla(p: PromocionDelPanel | null): PromocionEnPantalla {
  return {
    tipo: p?.tipo ?? '',
    lleva: p?.tipo === 'regalo' ? String(p.lleva) : '3',
    paga: p?.tipo === 'regalo' ? String(p.paga) : '2',
    porcentaje: p?.tipo === 'porcentaje' ? String(p.porcentaje) : '10',
    desde: p?.tipo === 'porcentaje' ? String(p.desdeUnidades) : '2',
    hasta: p?.hasta ?? '',
  };
}

/** HU-P1.2: lo que va a la API. Un número ilegible va como texto: la API dice qué está mal. */
export function promocionDelCuerpo(p: PromocionEnPantalla | undefined): unknown {
  if (!p?.tipo) return null;
  const n = (t: string) => (/^\d+$/.test(t.trim()) ? Number(t.trim()) : t);
  const hasta = p.hasta.trim() || null;
  return p.tipo === 'regalo'
    ? { tipo: 'regalo', lleva: n(p.lleva), paga: n(p.paga), hasta }
    : { tipo: 'porcentaje', porcentaje: n(p.porcentaje), desdeUnidades: n(p.desde), hasta };
}

/** La combinación de una clave, o una nueva vacía si todavía no se escribió nada en ella. */
export const combinacion = (f: FormularioDeProducto, clave: string): Combinacion =>
  f.combinaciones[clave] ?? sinCombinacion();

/**
 * El cuerpo de `productos/guardar` y, en `enviadas`, la clave de cada variante en el orden en que
 * va: la API responde los problemas como `variantes.<n>.<campo>`.
 */
export function cuerpoDe(
  f: FormularioDeProducto,
  ids: { op: string; id?: string; version?: number },
): { cuerpo: Record<string, unknown>; enviadas: string[] } {
  const opciones = f.opciones
    .map((o) => ({ nombre: o.nombre.trim(), valores: valoresDe(o.valores) }))
    .filter((o) => o.nombre || o.valores.length > 0);
  const enviadas: string[] = [];
  const variantes = combinacionesDe(f.opciones).flatMap((valores) => {
    const clave = claveDe(valores);
    const c = combinacion(f, clave);
    if (!c.vende) return [];
    enviadas.push(clave);
    // HU-P6.1: un producto digital no cuenta existencias.
    const stock =
      f.tipo === 'digital' || c.noSeCuenta
        ? null
        : c.stock.trim() === ''
          ? undefined
          : Number(c.stock);
    return [
      {
        valores,
        sku: c.sku.trim() || null,
        precioCop: pesos(c.precio),
        precioAntesCop: c.antes.trim() === '' ? null : pesos(c.antes),
        // Sin el campo, la API pide «di cuántas hay, o marca «no se cuenta»» (CA4).
        ...(stock === undefined ? {} : { stock: Number.isNaN(stock) ? c.stock : stock }),
      },
    ];
  });
  return {
    enviadas,
    cuerpo: {
      ...ids,
      nombre: f.nombre,
      estado: f.estado,
      descripcionMd: f.descripcion,
      ...(f.slug.trim() ? { slug: f.slug.trim() } : {}),
      opciones,
      variantes,
      retracto: f.retractoAplica ? { aplica: true } : { aplica: false, motivo: f.retractoMotivo },
      soloMayores: f.soloMayores,
      destacado: f.destacado ?? false,
      nuevo: f.nuevo ?? false,
      promocion: promocionDelCuerpo(f.promocion),
      // HU-P1.4: un borrador de antes no la trae; sin mandarla, la API deja la guardada.
      ...(f.oferta ? { oferta: ofertaDelCuerpo(f.oferta) } : {}),
      ...(f.pideTexto ? { pideTexto: pideTextoDelCuerpo(f.pideTexto) } : {}),
      tipo: f.tipo ?? 'fisico',
      // HU-P4.4: un borrador de antes no lo trae; sin mandarlo, la API deja lo guardado.
      ...(f.buscadores ? { buscadores: f.buscadores } : {}),
    },
  };
}

/**
 * El id del campo de la pantalla para un problema de la API: `variantes.2.precioCop` es el precio
 * de la tercera combinación enviada, que en la pantalla puede estar en otro lugar.
 */
export function campoDelProblema(
  campo: string,
  enviadas: readonly string[],
  enPantalla: readonly string[],
): string {
  const m = campo.match(/^variantes\.(\d+)(?:\.(\w+))?/);
  if (!m) {
    if (campo.startsWith('opciones')) return 'opciones';
    if (campo.startsWith('retracto')) return 'retracto';
    if (campo.startsWith('promocion')) return 'promocion';
    if (campo.startsWith('oferta')) return 'oferta';
    if (campo.startsWith('pideTexto')) return 'pide-texto';
    if (campo === 'tipo') return 'tipo';
    if (campo.startsWith('buscadores.')) return `en-google-${campo.slice('buscadores.'.length)}`;
    return campo || 'nombre';
  }
  const clave = enviadas[Number(m[1])];
  const i = clave === undefined ? -1 : enPantalla.indexOf(clave);
  const sub = { precioCop: 'precio', precioAntesCop: 'antes', stock: 'stock', sku: 'sku' }[
    m[2] ?? ''
  ];
  return i < 0 ? 'combinaciones' : `c${i}-${sub ?? 'precio'}`;
}

/** Una clave de operación nueva: se repite tal cual si el envío se corta y se vuelve a intentar. */
export const opNueva = () => `p${crypto.randomUUID().replaceAll('-', '')}`;
