/**
 * Publicar es hornear (HU-T4.4, TIENDA-3.0 §10.3), con la compuerta antes (HU-T4.3):
 *
 * 1. una sola publicación en curso por tienda: el índice único `publicacion_en_curso` lo impide;
 * 2. leer los datos de la tienda, en pocas consultas;
 * 3. hornear con `@ed1/tienda-horno`, y pasar la compuerta: si falla, la publicación queda
 *    `fallida` con todas sus fallas y nada más cambia;
 * 4. subir al almacén solo los objetos nuevos, por huella (`objetos/<hh>/<huella>`);
 * 5. guardar el manifiesto de la versión y **releerlo** para verificarlo (P16);
 * 6. si la huella del conjunto es la de la versión publicada: «Nada cambió», sin versión nueva;
 * 7. el puntero de cada hostname activo en `TIENDA_HOSTS`, y por último la versión publicada.
 *
 * Cualquier falla deja la publicación `fallida` con su motivo, y la tienda sigue sirviendo la
 * versión anterior: el KV y `version_publicada` cambian al final, nunca a medias (P21).
 *
 * Por ahora en la misma solicitud, sin cola: en el plan gratuito una tienda pequeña cabe en ella, y
 * la cola llega cuando el tamaño de una tienda lo pida (bitácora tienda3 7). El código no cambia:
 * el consumidor de la cola llamará a esta misma función.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  alPlan,
  type CodigoDeFalla,
  compuerta,
  type DatosLegales,
  type Falla,
  type FotoParaHornear,
  fueraDeLosFeeds,
  hornear,
  manifiesto,
  type ProductoParaHornear,
  type ProductoParaLaCompuerta,
  plazoDelEnvio,
  revisarHabilidades,
  type TiendaParaHornear,
  tercerosDe,
} from '@ed1/tienda-horno';
import {
  leerFormatos,
  limitesMasEstrictos,
  promocionEnPalabras,
  promocionVigente,
  type Seccion,
  validarSeccion,
} from '@ed1/tienda-schema';
import { REDES } from '@ed1/tienda-schema/redes';
import { promocionLeida } from './catalogo.ts';
import { tieneComprasSinTerminar } from './compras-pendientes.ts';
import { claveDelHost, direccionesDelPlan, punteroDelHost } from './hosts.ts';
import { estadoDeLaPrueba } from './llaves-de-bold.ts';
import { apiPublica } from './openapi.ts';
import { limitesDeLaTienda, planDeLaTienda } from './plan.ts';
import { anotar } from './registro.ts';

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * HU-P1.2: la promoción del producto en palabras, solo si sigue vigente al publicar. Si vence,
 * la ficha lo dice («hasta el 2 de noviembre»): la cotización deja de aplicarla ese día aunque la
 * ficha no se haya vuelto a hornear.
 */
export function promocionParaHornear(texto: string | null, ahora: string): { promocion?: string } {
  const p = promocionLeida(texto);
  if (!p || !promocionVigente(p, ahora)) return {};
  const [, mes, dia] = (p.hasta ?? '').split('-').map(Number);
  const hasta = p.hasta && mes && dia ? `, hasta el ${dia} de ${MESES[mes - 1]}` : '';
  return { promocion: `${promocionEnPalabras(p)}${hasta}` };
}

/** Lo que la publicación usa de un bucket R2. */
export interface Almacen {
  get(clave: string): Promise<{ text(): Promise<string> } | null>;
  put(
    clave: string,
    valor: string,
    opciones?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

/** Lo que usa del KV `TIENDA_HOSTS`. */
export interface EscritorKv {
  put(clave: string, valor: string): Promise<void>;
}

export interface Contexto {
  shard: BaseD1;
  shardNombre: string;
  control: BaseD1;
  sitios: Almacen;
  hosts: EscritorKv;
  celda: string;
  release: string;
  /** El host de las fotos (`MEDIOS`, HU-T5.6). Sin él, las fichas salen con el marco vacío. */
  medios?: string;
  org: string;
  pedidaPor: string;
  /** ISO 8601, del reloj del Worker: la publicación guarda cuándo, el horno no lo usa. */
  ahora: string;
  /** Solo para los comercios de prueba de staging (HU-T2.6). */
  omitir?: readonly CodigoDeFalla[];
  /** Las escrituras de una tanda; `SUBIDAS_POR_TANDA` si no se dice (bitácora tienda3 30). */
  subidasPorTanda?: number;
}

export type Resultado =
  | { estado: 'publicada'; version: number; archivos: number; nuevos: number }
  | { estado: 'nada-cambio'; version: number | null }
  | { estado: 'compuerta'; fallas: Falla[] }
  | { estado: 'en-curso' }
  | { estado: 'fallida'; motivo: string }
  /** Bitácora tienda3 30: subió una tanda y faltan archivos; se vuelve a pedir para seguir. */
  | { estado: 'por-tandas'; subidos: number; faltan: number };

/**
 * Lo que sube una solicitud (bitácora tienda3 30). En el plan gratuito una invocación hace como
 * mucho 1.000 operaciones con R2, D1 y KV, y la primera publicación de una tienda de 2.000 productos
 * sube 4.221 archivos: se cortaba a la mitad sin decir por qué. Se sube por tandas, y lo que quede
 * para después de los archivos (el manifiesto, lo horneado, las direcciones) cabe en lo que sobra.
 */
export const SUBIDAS_POR_TANDA = 800;
/** Cuántas subidas van a la vez: un Worker abre hasta 6 conexiones simultáneas. */
const SUBIDAS_A_LA_VEZ = 6;
/**
 * Lo que dura una tanda anotada. Lo subido y todavía sin manifiesto lo protege el barrido de
 * objetos por 6 horas; pasada la hora se vuelve a subir, que no cuesta más que una tanda.
 */
const MINUTOS_DE_UNA_TANDA = 60;
const claveDeLasTandas = (org: string) => `sitios/${org}/tandas.json`;
interface Tanda {
  desde: string;
  huellas: string[];
}

interface FilaProducto {
  id: string;
  slug: string;
  nombre: string;
  descripcion_md: string;
  estado: 'borrador' | 'activo' | 'archivado';
  opciones: string;
  retracto: 'aplica' | 'no_aplica';
  retracto_motivo: string | null;
  solo_mayores: number;
  destacado: number;
  nuevo: number;
  actualizado: string;
  seo: string;
  promocion: string | null;
}

/**
 * HU-T8.2 CA3: las direcciones viejas de cada producto activo (`seo.slugsAnteriores`, que guarda
 * el panel al cambiar el slug) llevan a la de ahora.
 */
export function redireccionesDe(productos: readonly Pick<FilaProducto, 'slug' | 'seo'>[]) {
  const saltos: Record<string, string> = {};
  for (const p of productos) {
    let anteriores: unknown;
    try {
      anteriores = (JSON.parse(p.seo) as { slugsAnteriores?: unknown }).slugsAnteriores;
    } catch {
      continue;
    }
    if (!Array.isArray(anteriores)) continue;
    for (const viejo of anteriores) {
      if (typeof viejo === 'string' && /^[a-z0-9-]{1,100}$/.test(viejo) && viejo !== p.slug)
        saltos[`/p/${viejo}/`] = `/p/${p.slug}/`;
    }
  }
  return saltos;
}

/** `{ clave: valor }` si hay valor; si no, nada (exactOptionalPropertyTypes). */
const opcional = <K extends string, V>(clave: K, valor: V | undefined) =>
  (valor === undefined ? {} : { [clave]: valor }) as Partial<Record<K, V>>;

/** La sección guardada, ya validada; una que no valida cuenta como vacía (y la compuerta lo dice). */
function seccion(fila: { seccion: string; datos: string } | undefined): Record<string, unknown> {
  if (!fila) return {};
  const r = validarSeccion(fila.seccion as Seccion, JSON.parse(fila.datos));
  return r.ok ? r.datos : {};
}

/**
 * Lo que una publicación puede tardar antes de darse por cortada (bitácora tienda3 27). Hornea
 * dentro de la solicitud, y en el plan gratuito Cloudflare corta la que pasa de 10 ms de CPU: la
 * fila quedaba «horneando» para siempre, el índice único no dejaba publicar ni re-hornear esa
 * tienda nunca más, y el panel preguntaba cada 3 segundos mientras siguiera abierto.
 */
export const MINUTOS_DE_UNA_PUBLICACION = 10;

/** La publicación en curso que pasó su plazo queda fallida, con el motivo; las demás no se tocan. */
export async function vencerLasCortadas(shard: BaseD1, org: string, ahora: string) {
  const limite = new Date(Date.parse(ahora) - MINUTOS_DE_UNA_PUBLICACION * 60_000).toISOString();
  await shard
    .prepare(
      `UPDATE publicacion SET estado = 'fallida', motivo = ?
        WHERE org_id = ? AND estado IN ('en_cola', 'horneando') AND pedida < ?`,
    )
    .bind(
      `Se cortó a mitad: pasaron ${MINUTOS_DE_UNA_PUBLICACION} minutos sin terminar. Vuelve a publicar.`,
      org,
      limite,
    )
    .run();
}

/** Reserva la versión: si hay otra en curso, el índice único lo impide. */
async function reservar(c: Contexto): Promise<number | null> {
  await vencerLasCortadas(c.shard, c.org, c.ahora);
  try {
    const fila = await c.shard
      .prepare(
        `INSERT INTO publicacion (org_id, version, estado, pedida_por, pedida)
         VALUES (?, (SELECT COALESCE(MAX(version), 0) + 1 FROM publicacion WHERE org_id = ?), 'horneando', ?, ?)
         RETURNING version`,
      )
      .bind(c.org, c.org, c.pedidaPor, c.ahora)
      .first<{ version: number }>();
    if (!fila) throw new Error('no se pudo reservar la versión');
    return fila.version;
  } catch (e) {
    if (/UNIQUE|publicacion_en_curso/i.test(String(e))) return null;
    throw e;
  }
}

const fallarCon =
  (c: Contexto, version: number) =>
  async (motivo: string): Promise<Resultado> => {
    await c.shard
      .prepare(
        "UPDATE publicacion SET estado = 'fallida', motivo = ? WHERE org_id = ? AND version = ?",
      )
      .bind(motivo.slice(0, 2000), c.org, version)
      .run();
    return { estado: 'fallida', motivo };
  };

/**
 * Las direcciones activas de la tienda y su canónica (TIENDA §5.6), como las deja su plan: sin
 * dominio propio en el plan, la canónica es la de la plataforma (HU-T13.5 CA3).
 */
async function direccionesDe(c: Contexto) {
  const { results } = await c.control
    .prepare("SELECT hostname, tipo, rol FROM dominio WHERE org_id = ? AND estado = 'activo'")
    .bind(c.org)
    .all<{ hostname: string; tipo: string; rol: string }>();
  const { filas, canonico } = direccionesDelPlan(
    results,
    limitesDeLaTienda(await planDeLaTienda(c.shard, c.org)).dominioPropio,
  );
  return { dominios: filas, canonico };
}

/** Cada dirección de la tienda, apuntando a la versión `v` (TIENDA §5.6). */
async function apuntarA(
  c: Contexto,
  { dominios, canonico }: Awaited<ReturnType<typeof direccionesDe>>,
  v: number,
) {
  // HU-T13.6: el estado de la tienda, no uno fijo: publicar no levanta una suspensión.
  const tienda = await c.shard
    .prepare('SELECT estado FROM tienda WHERE org_id = ?')
    .bind(c.org)
    .first<{ estado: string }>();
  const estado = tienda?.estado === 'suspendida' ? 'suspendida' : 'abierta';
  for (const d of dominios) {
    await c.hosts.put(
      claveDelHost(d.hostname),
      punteroDelHost({
        org: c.org,
        celda: c.celda,
        shard: c.shardNombre,
        version: v,
        canonico,
        estado,
        rol: d.rol,
      }),
    );
  }
}

/**
 * Bitácora tienda3 49: el despliegue de staging deja las direcciones de los comercios de prueba sin
 * versión antes de publicarlos. El que no se publica en esa vuelta (lleno, con otra publicación en
 * curso o frenado por la compuerta) vuelve a apuntar a la que ya tenía; si nunca publicó, sigue sin.
 */
export async function apuntarALaPublicada(c: Contexto): Promise<number | null> {
  const t = await c.shard
    .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
    .bind(c.org)
    .first<{ version_publicada: number | null }>();
  const v = t?.version_publicada ?? null;
  if (v !== null) await apuntarA(c, await direccionesDe(c), v);
  return v;
}

/**
 * HU-T4.5: lo que se horneó, junto al manifiesto de su versión. Con él, un cambio de existencias
 * vuelve a hornear lo publicado y no lo que el comercio todavía no ha publicado.
 */
interface Horneado {
  datos: TiendaParaHornear;
  redirecciones: Record<string, string>;
}
const claveDeDatos = (org: string, version: number) => `sitios/${org}/${version}/datos.json`;

type Imagen = {
  huella: string;
  formato: 'webp' | 'jpeg';
  ancho: number;
  alto: number;
  anchos: number[];
};
const comoFoto = (x: unknown, alt: string): FotoParaHornear | undefined => {
  const i = x as Imagen | undefined;
  return i && typeof i.huella === 'string'
    ? { huella: i.huella, alt, ancho: i.ancho, alto: i.alto, anchos: i.anchos, formato: i.formato }
    : undefined;
};
/** HU-T5.13 y HU-T5.14: las imágenes de la tienda de sus ajustes, como fotos del horno. */
function imagenesDeLaTienda(
  identidad: Record<string, unknown>,
  apariencia: Record<string, unknown>,
  nombre: string,
): Pick<TiendaParaHornear, 'logo' | 'icono' | 'hero'> {
  const logo = comoFoto(identidad['logo'], nombre);
  const icono = comoFoto(identidad['icono'], nombre);
  const h = apariencia['hero'] as
    | { titulo?: string; texto?: string; imagen?: unknown; boton?: string }
    | undefined;
  const imagenDelHero = h ? comoFoto(h.imagen, h.titulo ?? nombre) : undefined;
  return {
    ...(logo ? { logo } : {}),
    ...(icono ? { icono } : {}),
    ...(h
      ? {
          hero: {
            ...(h.titulo ? { titulo: h.titulo } : {}),
            ...(h.texto ? { texto: h.texto } : {}),
            ...(h.boton ? { boton: h.boton } : {}),
            ...(imagenDelHero ? { imagen: imagenDelHero } : {}),
          },
        }
      : {}),
  };
}

/**
 * Pasos 2 y 3: lo que se hornea de la tienda, horneado, y lo que dice la compuerta. Lo usan publicar
 * y la vista previa (HU-T8.6), que hornea lo mismo sin publicarlo.
 */
async function armarLaTienda(c: Contexto, opciones: { vistaPrevia?: boolean } = {}) {
  const tienda = await c.shard
    .prepare('SELECT nombre, version_publicada, plan FROM tienda WHERE org_id = ?')
    .bind(c.org)
    .first<{ nombre: string; version_publicada: number | null; plan: string }>();
  if (!tienda) return { falla: 'la tienda no existe en su shard' };
  // HU-T13.5: lo que permite su plan. El horno recorta a él; aquí, la compuerta.
  const limites = limitesDeLaTienda(tienda.plan);
  const { results: filasAjuste } = await c.shard
    .prepare('SELECT seccion, datos FROM ajuste WHERE org_id = ?')
    .bind(c.org)
    .all<{ seccion: string; datos: string }>();
  const ajustes = Object.fromEntries(filasAjuste.map((f) => [f.seccion, seccion(f)])) as Partial<
    Record<Seccion, Record<string, unknown>>
  >;
  // Lo que el comercio eligió se guarda tal cual; el horno lo recorta a su plan (HU-T13.5).
  const quiereEnLinea =
    ajustes.venta?.['modo'] === 'en_linea' || ajustes.venta?.['modo'] === 'ambos';
  const enLinea = quiereEnLinea && limites.cobroEnLinea;
  const ambienteDelCobro: 'pruebas' | 'produccion' =
    ajustes.cobro?.['ambiente'] === 'produccion' ? 'produccion' : 'pruebas';
  const { results: productos } = await c.shard
    .prepare(
      `SELECT id, slug, nombre, descripcion_md, estado, opciones, retracto, retracto_motivo, solo_mayores, destacado, nuevo, actualizado, seo, promocion
       FROM producto WHERE org_id = ? AND borrado IS NULL ORDER BY posicion, slug`,
    )
    .bind(c.org)
    .all<FilaProducto>();
  const { results: variantes } = await c.shard
    .prepare(
      'SELECT id, producto_id, clave, precio_cop, precio_antes_cop, stock, reservado FROM variante WHERE org_id = ? AND activa = 1',
    )
    .bind(c.org)
    .all<{
      id: string;
      producto_id: string;
      clave: string;
      precio_cop: number;
      precio_antes_cop: number | null;
      stock: number | null;
      reservado: number;
    }>();
  const { results: medios } = await c.shard
    .prepare(
      'SELECT id, producto_id, variante_id, alt, ancho, alto, formatos FROM medio WHERE org_id = ? ORDER BY producto_id, posicion, id',
    )
    .bind(c.org)
    .all<{
      id: string;
      producto_id: string;
      variante_id: string | null;
      alt: string;
      ancho: number;
      alto: number;
      formatos: string;
    }>();
  const fotosDe = (productoId: string): FotoParaHornear[] =>
    medios
      .filter((f) => f.producto_id === productoId)
      .map((f) => ({
        huella: f.id,
        alt: f.alt,
        // HU-T5.9: la foto de una combinación.
        ...(f.variante_id ? { variante: f.variante_id } : {}),
        ancho: f.ancho,
        alto: f.alto,
        ...leerFormatos(f.formatos),
      }));
  const { results: colecciones } = await c.shard
    .prepare(
      `SELECT c.slug, c.nombre, p.slug AS producto FROM coleccion c
       LEFT JOIN coleccion_producto cp ON cp.org_id = c.org_id AND cp.coleccion_id = c.id
       LEFT JOIN producto p ON p.org_id = cp.org_id AND p.id = cp.producto_id AND p.borrado IS NULL AND p.estado = 'activo'
       WHERE c.org_id = ? AND c.borrado IS NULL AND c.visible = 1 ORDER BY c.posicion, cp.posicion`,
    )
    .bind(c.org)
    .all<{ slug: string; nombre: string; producto: string | null }>();
  const { results: envios } = await c.shard
    .prepare(
      'SELECT id, nombre, precio_cop, gratis_desde_cop, dias_min, dias_max FROM envio_opcion WHERE org_id = ? AND activa = 1 AND borrado IS NULL ORDER BY posicion, nombre',
    )
    .bind(c.org)
    .all<{
      id: string;
      nombre: string;
      precio_cop: number;
      gratis_desde_cop: number | null;
      dias_min: number | null;
      dias_max: number | null;
    }>();
  // HU-T10.2: las páginas propias visibles.
  const { results: paginas } = await c.shard
    .prepare(
      'SELECT slug, titulo, cuerpo_md FROM pagina WHERE org_id = ? AND visible = 1 AND borrado IS NULL ORDER BY slug',
    )
    .bind(c.org)
    .all<{ slug: string; titulo: string; cuerpo_md: string }>();
  const { canonico } = await direccionesDe(c);
  if (!canonico) return { falla: 'la tienda no tiene una dirección activa' };

  // 3. Hornear y pasar la compuerta.
  const activos = productos.filter((p) => p.estado === 'activo');
  const paraHornear: ProductoParaHornear[] = activos.flatMap((p) => {
    const suyas = variantes.filter((v) => v.producto_id === p.id);
    if (suyas.length === 0) return [];
    return [
      {
        slug: p.slug,
        nombre: p.nombre,
        ...(p.descripcion_md ? { descripcion: p.descripcion_md } : {}),
        opciones: JSON.parse(p.opciones) as ProductoParaHornear['opciones'],
        variantes: suyas.map((v) => ({
          id: v.id,
          clave: v.clave,
          precioCop: v.precio_cop,
          ...(v.precio_antes_cop !== null ? { precioAntesCop: v.precio_antes_cop } : {}),
          stock: v.stock === null ? null : Math.max(0, v.stock - v.reservado),
        })),
        actualizado: p.actualizado,
        fotos: fotosDe(p.id),
        retracto:
          p.retracto === 'no_aplica'
            ? { aplica: false, motivo: p.retracto_motivo ?? '' }
            : { aplica: true },
        soloMayores: p.solo_mayores === 1,
        destacado: p.destacado === 1,
        ...(p.nuevo === 1 ? { nuevo: true } : {}),
        ...promocionParaHornear(p.promocion, c.ahora),
      },
    ];
  });
  const conDefectos = (s: Seccion) => {
    const r = validarSeccion(s, ajustes[s] ?? {});
    return r.ok ? r.datos : {};
  };
  const identidad = ajustes.identidad ?? {};
  const contacto = ajustes.contacto ?? {};
  const agentes = ajustes.agentes ?? {};
  const medicion = ajustes.medicion ?? {};
  const legal = ajustes.legal ?? {};
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v : undefined);
  // HU-T7.1: lo que dicen los textos legales sale de la ficha, el contacto, la venta y los envíos.
  const datosLegales: DatosLegales = {
    nombreTienda: texto(identidad['nombre']) ?? tienda.nombre,
    ...opcional('razonSocial', texto(legal['razonSocial'])),
    ...opcional('documento', legal['documento'] as DatosLegales['documento']),
    ...opcional('direccion', texto(legal['direccionNotificacion'])),
    ...opcional('ciudad', texto(legal['ciudad'])),
    ...opcional('telefono', texto(legal['telefono'])),
    ...opcional('correo', texto(legal['correo'])),
    ...opcional('whatsapp', texto(contacto['whatsapp'])),
    ...opcional('garantia', texto(legal['garantia'])),
    ...opcional('retracto', texto(legal['retracto'])),
    formas: ((ajustes.venta?.['formas'] ?? []) as DatosLegales['formas']).slice(),
    envios: envios.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      precioCop: e.precio_cop,
      gratisDesdeCop: e.gratis_desde_cop,
      diasMin: e.dias_min,
      diasMax: e.dias_max,
    })),
    sinRetracto: activos
      .filter((p) => p.retracto === 'no_aplica' && p.retracto_motivo)
      .map((p) => ({ nombre: p.nombre, motivo: p.retracto_motivo as string })),
    medicion: { ga4: Boolean(medicion['ga4']), pixelMeta: Boolean(medicion['pixelMeta']) },
    responsableIva: legal['responsableIva'] === true,
    ...opcional(
      'conservacionMeses',
      typeof legal['conservacionMeses'] === 'number' ? legal['conservacionMeses'] : undefined,
    ),
  };
  const porColeccion = new Map<string, { nombre: string; productos: string[] }>();
  for (const f of colecciones) {
    const actual = porColeccion.get(f.slug) ?? { nombre: f.nombre, productos: [] };
    if (f.producto) actual.productos.push(f.producto);
    porColeccion.set(f.slug, actual);
  }
  const datos: TiendaParaHornear = {
    dominio: canonico,
    release: c.release,
    org: c.org,
    ...(c.medios ? { medios: c.medios } : {}),
    nombre: (identidad['nombre'] as string | undefined) ?? tienda.nombre,
    ...(identidad['frase'] ? { frase: identidad['frase'] as string } : {}),
    ...(contacto['whatsapp'] ? { whatsapp: contacto['whatsapp'] as string } : {}),
    ...(contacto['correo'] ? { correo: contacto['correo'] as string } : {}),
    // HU-P4.3: solo las redes que la sección ya validó.
    ...(REDES.some((r) => contacto[r])
      ? {
          redes: Object.fromEntries(
            REDES.flatMap((r) => (typeof contacto[r] === 'string' ? [[r, contacto[r]]] : [])),
          ),
        }
      : {}),
    apariencia: conDefectos('apariencia') as unknown as TiendaParaHornear['apariencia'],
    // HU-T5.13 y HU-T5.14: el logo, el ícono y el hero, ya validados por su sección.
    ...imagenesDeLaTienda(conDefectos('identidad'), conDefectos('apariencia'), tienda.nombre),
    agentes: {
      search: (agentes['search'] as 'yes' | 'no' | undefined) ?? 'yes',
      aiInput: (agentes['aiInput'] as 'yes' | 'no' | undefined) ?? 'yes',
      aiTrain: (agentes['aiTrain'] as 'yes' | 'no' | undefined) ?? 'no',
    },
    // HU-T15.2 y HU-T15.4: la API pública y, si el comercio lo encendió, el MCP. HU-T18.3: se guarda
    // como lo eligió; el horno lo recorta a su plan (solo Pro e IA Pro lo anuncian).
    api: apiPublica(),
    ...(conDefectos('agentes')['mcp'] === true ? { mcp: true } : {}),
    // HU-T14.5: los feeds que el comercio encendió; apagados si no dice.
    ...(conDefectos('agentes')['feeds']
      ? { feeds: conDefectos('agentes')['feeds'] as NonNullable<TiendaParaHornear['feeds']> }
      : {}),
    ...(medicion['googleVerificacion']
      ? { googleVerificacion: medicion['googleVerificacion'] as string }
      : {}),
    // HU-T14.4: GA4 y el píxel de Meta, con su aviso; el horno y el despacho deciden qué carga.
    ...(medicion['ga4'] || medicion['pixelMeta']
      ? {
          terceros: {
            ...opcional('ga4', texto(medicion['ga4'])),
            ...opcional('pixelMeta', texto(medicion['pixelMeta'])),
            ...opcional('aviso', texto(medicion['avisoConsentimiento'])),
          },
        }
      : {}),
    legal: datosLegales,
    productos: paraHornear,
    colecciones: [...porColeccion].map(([slug, col]) => ({ slug, ...col })),
    ...(paginas.length > 0
      ? { paginas: paginas.map((p) => ({ slug: p.slug, titulo: p.titulo, cuerpo: p.cuerpo_md })) }
      : {}),
    // HU-T11.4: el carrito ofrece pagar en línea; HU-T11.3: en pruebas, la franja lo dice.
    ...(quiereEnLinea
      ? {
          cobroEnLinea: true,
          ...(ambienteDelCobro === 'pruebas' ? { cobroEnPruebas: true } : {}),
        }
      : {}),
    plan: limites,
    // HU-P1.1: el carrito ofrece recordar la compra, si el plan lo incluye.
    ...((await tieneComprasSinTerminar(c.shard, c.org)) ? { comprasSinTerminar: true } : {}),
    ...(opciones.vistaPrevia ? { vistaPrevia: true } : {}),
  };
  const archivos = await hornear(datos);
  // HU-T13.5 CA3: los productos que pasan del límite quedan ocultos, y la compuerta no los pide.
  const ocultos = new Set(alPlan(datos).ocultos);
  // HU-T11.3: lo que la compuerta pide para ofrecer el pago en línea.
  const cobroParaLaCompuerta = enLinea
    ? {
        ambiente: ambienteDelCobro,
        llaves:
          (
            await c.shard
              .prepare(
                `SELECT count(*) AS n FROM credencial WHERE org_id = ? AND proveedor = 'bold'
                  AND ambiente = ? AND campo IN ('identidad', 'secreta')`,
              )
              .bind(c.org, ambienteDelCobro)
              .first<{ n: number }>()
          )?.n === 2,
        pruebaAprobada: (await estadoDeLaPrueba(c.shard, c.org)).aprobada !== null,
      }
    : undefined;
  const revision = compuerta({
    ajustes,
    productos: productos
      .filter((p) => !ocultos.has(p.slug))
      .map(
        (p): ProductoParaLaCompuerta => ({
          slug: p.slug,
          nombre: p.nombre,
          estado: p.estado,
          precioCop: variantes.find((v) => v.producto_id === p.id)?.precio_cop ?? null,
          fotos: medios.filter((f) => f.producto_id === p.id).length,
          retracto: p.retracto,
          retractoMotivo: p.retracto_motivo,
        }),
      ),
    archivos,
    // La compuerta lee el mismo texto que verá el comprador (HU-T10.1 CA1).
    envios: envios.map((e) => ({
      nombre: e.nombre,
      plazoDias: Math.max(e.dias_min ?? 0, e.dias_max ?? 0),
      texto: plazoDelEnvio(e.dias_min, e.dias_max),
    })),
    ...(cobroParaLaCompuerta ? { cobro: cobroParaLaCompuerta } : {}),
    ...(c.omitir ? { omitir: c.omitir } : {}),
  });
  // HU-T15.3 CA2: la huella de cada habilidad, aparte porque es asíncrona.
  const deLasHabilidades = (await revisarHabilidades(archivos)).filter(
    (f) => !c.omitir?.includes(f.codigo),
  );
  if (deLasHabilidades.length > 0) {
    revision.fallas.push(...deLasHabilidades);
    revision.ok = false;
  }
  return { tienda, datos, archivos, revision, activos };
}

export async function publicar(c: Contexto): Promise<Resultado> {
  // 1. Reservar la versión.
  const version = await reservar(c);
  if (version === null) return { estado: 'en-curso' };
  const fallar = fallarCon(c, version);

  try {
    // 2 y 3. Los datos de la tienda, horneados, y la compuerta.
    const armada = await armarLaTienda(c);
    if ('falla' in armada) return await fallar(armada.falla);
    const { tienda, datos, archivos, revision, activos } = armada;
    if (!revision.ok) {
      await fallar(JSON.stringify(revision.fallas));
      return { estado: 'compuerta', fallas: revision.fallas };
    }

    return await entregar(c, version, tienda.version_publicada, archivos, {
      datos,
      redirecciones: redireccionesDe(activos),
    });
  } catch (e) {
    return await fallar(e instanceof Error ? e.message : String(e));
  }
}

/** HU-T11.3: en qué ambiente cobra lo que se hornea; el cobro usa el de la versión publicada. */
const cobroDe = (t: TiendaParaHornear) =>
  t.cobroEnLinea ? (t.cobroEnPruebas ? 'pruebas' : 'produccion') : 'ninguno';

/**
 * Pasos 4 a 7: subir lo nuevo, guardar el manifiesto y lo horneado, y apuntar las direcciones.
 * Si la huella del conjunto es la de la versión publicada, «Nada cambió» y la versión se descarta.
 */
async function entregar(
  c: Contexto,
  version: number,
  versionPublicada: number | null,
  archivos: Awaited<ReturnType<typeof hornear>>,
  h: Horneado,
): Promise<Resultado> {
  const fallar = fallarCon(c, version);
  const direcciones = await direccionesDe(c);
  if (!direcciones.canonico) return await fallar('la tienda no tiene una dirección activa');
  const apuntar = (v: number) => apuntarA(c, direcciones, v);

  // 4 y 6. El manifiesto, y si nada cambió.
  // HU-T14.4: lo que la versión mide con terceros, para la CSP del despacho.
  const m = await manifiesto(archivos, h.redirecciones, tercerosDe(h.datos));
  if (versionPublicada !== null) {
    const anterior = await c.shard
      .prepare('SELECT huella FROM publicacion WHERE org_id = ? AND version = ?')
      .bind(c.org, versionPublicada)
      .first<{ huella: string | null }>();
    if (anterior?.huella === m.huella) {
      await c.shard
        .prepare('DELETE FROM publicacion WHERE org_id = ? AND version = ?')
        .bind(c.org, version)
        .run();
      // Bitácora tienda3 16: los punteros se reescriben igual, por si alguien los pisó.
      await apuntar(versionPublicada);
      return { estado: 'nada-cambio', version: versionPublicada };
    }
  }
  const previas = new Set<string>();
  // Lo que ya subieron las tandas de la última hora.
  const desde = new Date(Date.parse(c.ahora) - MINUTOS_DE_UNA_TANDA * 60_000).toISOString();
  const anotadas = await c.sitios.get(claveDeLasTandas(c.org));
  let tandas: Tanda[] = [];
  if (anotadas) {
    try {
      tandas = (JSON.parse(await anotadas.text()) as Tanda[]).filter((t) => t.desde >= desde);
    } catch {
      tandas = [];
    }
  }
  for (const t of tandas) for (const huella of t.huellas) previas.add(huella);
  if (versionPublicada !== null) {
    const previo = await c.sitios.get(`sitios/${c.org}/${versionPublicada}/manifiesto.json`);
    if (previo) {
      const pm = JSON.parse(await previo.text()) as typeof m;
      for (const a of Object.values(pm.archivos)) previas.add(a.huella);
    }
  }
  // Lo que falta subir, una vez por huella; un texto legal sube también a `legal/` (dos escrituras).
  const pendientes: { ruta: string; huella: string; contenido: string; tipo: string }[] = [];
  const vistas = new Set(previas);
  for (const [ruta, archivo] of archivos) {
    const entrada = m.archivos[ruta];
    if (!entrada || vistas.has(entrada.huella)) continue;
    vistas.add(entrada.huella);
    pendientes.push({
      ruta,
      huella: entrada.huella,
      contenido: archivo.contenido,
      tipo: archivo.tipo,
    });
  }
  const esLegal = (ruta: string) => /^\/(legal\/[a-z]+|solicitud)\/index\.md$/.test(ruta);
  const tanda: typeof pendientes = [];
  let escrituras = 0;
  for (const p of pendientes) {
    const costo = esLegal(p.ruta) ? 2 : 1;
    if (escrituras + costo > (c.subidasPorTanda ?? SUBIDAS_POR_TANDA)) break;
    tanda.push(p);
    escrituras += costo;
  }
  for (let i = 0; i < tanda.length; i += SUBIDAS_A_LA_VEZ) {
    await Promise.all(
      tanda.slice(i, i + SUBIDAS_A_LA_VEZ).map(async (p) => {
        await c.sitios.put(`objetos/${p.huella.slice(0, 2)}/${p.huella}`, p.contenido, {
          httpMetadata: { contentType: p.tipo },
        });
        // HU-T7.1 CA2: cada texto legal, también por su huella en `legal/`, sin vencimiento: un
        // pedido cita la huella de los términos que aceptó (Ley 1480 art. 50 lit. e).
        if (esLegal(p.ruta)) {
          await c.sitios.put(`legal/${c.org}/${p.huella}.md`, p.contenido, {
            httpMetadata: { contentType: p.tipo },
          });
        }
      }),
    );
  }
  const nuevos = tanda.length;
  if (tanda.length < pendientes.length) {
    // Faltan archivos: se anota lo subido y la versión se descarta, como si no se hubiera pedido.
    // La tienda sigue mostrando la que tenía; la próxima solicitud sigue donde esta quedó.
    tandas.push({ desde: c.ahora, huellas: tanda.map((p) => p.huella) });
    await c.sitios.put(claveDeLasTandas(c.org), JSON.stringify(tandas), {
      httpMetadata: { contentType: 'application/json' },
    });
    await c.shard
      .prepare('DELETE FROM publicacion WHERE org_id = ? AND version = ?')
      .bind(c.org, version)
      .run();
    return { estado: 'por-tandas', subidos: nuevos, faltan: pendientes.length - nuevos };
  }

  // 5. Lo horneado y el manifiesto, guardados; el manifiesto, releído.
  await c.sitios.put(claveDeDatos(c.org, version), JSON.stringify(h), {
    httpMetadata: { contentType: 'application/json' },
  });
  const claveManifiesto = `sitios/${c.org}/${version}/manifiesto.json`;
  await c.sitios.put(claveManifiesto, JSON.stringify(m), {
    httpMetadata: { contentType: 'application/json' },
  });
  const releido = await c.sitios.get(claveManifiesto);
  const verificado = releido ? (JSON.parse(await releido.text()) as typeof m) : null;
  if (
    !verificado ||
    verificado.huella !== m.huella ||
    Object.keys(verificado.archivos).length !== archivos.size
  ) {
    return await fallar('el manifiesto guardado no es el que se horneó');
  }

  // 7. Los punteros y, al final, la versión publicada.
  await apuntar(version);
  const bytes = Object.values(m.archivos).reduce((s, a) => s + a.bytes, 0);
  // HU-T13.5: lo que se horneó de verdad, recortado a su plan.
  const horneada = alPlan(h.datos).tienda;
  await c.shard.batch([
    c.shard
      .prepare(
        "UPDATE publicacion SET estado = 'reemplazada' WHERE org_id = ? AND estado = 'publicada'",
      )
      .bind(c.org),
    c.shard
      .prepare(
        "UPDATE publicacion SET estado = 'publicada', archivos = ?, bytes = ?, huella = ?, publicada = ?, cobro_ambiente = ?, release = ?, fuera_de_los_feeds = ? WHERE org_id = ? AND version = ?",
      )
      .bind(
        archivos.size,
        bytes,
        m.huella,
        c.ahora,
        cobroDe(horneada),
        h.datos.release,
        // HU-T14.5 CA2: lo que quedó fuera de los feeds, para el panel.
        horneada.feeds && Object.values(horneada.feeds).some(Boolean)
          ? JSON.stringify(fueraDeLosFeeds(horneada))
          : null,
        c.org,
        version,
      ),
    c.shard
      .prepare('UPDATE tienda SET version_publicada = ? WHERE org_id = ?')
      .bind(version, c.org),
  ]);
  return { estado: 'publicada', version, archivos: archivos.size, nuevos };
}

/**
 * HU-T4.5 (TIENDA §7.4): el re-horneado mínimo. Una combinación pasó de disponible a agotada, o al
 * revés: se vuelve a hornear **lo publicado** con las existencias de ahora, y nada más. Lo que el
 * comercio editó y no ha publicado sigue sin publicar. Solo cambian la ficha, el catálogo y los
 * feeds que dicen si hay, y se suben solo esos archivos (van por huella).
 *
 * Sin una versión publicada, o si esa versión no guardó lo que horneó (es de antes de esta
 * historia), no hace nada: la próxima publicación del comercio lleva las existencias de ahora.
 *
 * HU-T13.2 CA1: se hornea con la dirección canónica de ahora. Así, al elegir el dominio propio como
 * principal (o al desconectarlo), lo publicado cambia su sitemap, sus canónicos, su JSON-LD y sus
 * feeds sin publicar lo que el comercio todavía no publica.
 */
export async function rehornearExistencias(
  c: Contexto,
): Promise<Resultado | { estado: 'sin-publicar' }> {
  const tienda = await c.shard
    .prepare('SELECT version_publicada, plan FROM tienda WHERE org_id = ?')
    .bind(c.org)
    .first<{ version_publicada: number | null; plan: string }>();
  if (!tienda?.version_publicada) return { estado: 'sin-publicar' };
  const guardado = await c.sitios.get(claveDeDatos(c.org, tienda.version_publicada));
  if (!guardado) return { estado: 'sin-publicar' };
  const h = JSON.parse(await guardado.text()) as Horneado;

  const version = await reservar(c);
  if (version === null) return { estado: 'en-curso' };
  try {
    const { results } = await c.shard
      .prepare('SELECT id, stock, reservado FROM variante WHERE org_id = ?')
      .bind(c.org)
      .all<{ id: string; stock: number | null; reservado: number }>();
    const ahora = new Map(results.map((v) => [v.id, v]));
    const { canonico } = await direccionesDe(c);
    const datos: TiendaParaHornear = {
      ...h.datos,
      dominio: canonico ?? h.datos.dominio,
      // HU-T13.5: lo publicado se guarda completo y se recorta al plan. Un plan que baja recorta
      // aquí, sin que el comercio publique; uno que sube espera a su próxima publicación, que pasa
      // por la compuerta.
      plan: h.datos.plan
        ? limitesMasEstrictos(h.datos.plan, limitesDeLaTienda(tienda.plan))
        : limitesDeLaTienda(tienda.plan),
      // El release de la vitrina es el de ahora: los archivos comunes de antes ya no se sirven.
      release: c.release,
      productos: h.datos.productos.map((p) => ({
        ...p,
        variantes: p.variantes.map((v) => {
          const fila = ahora.get(v.id);
          // Una combinación que ya no existe se muestra agotada hasta que el comercio publique.
          if (!fila) return { ...v, stock: 0 };
          return {
            ...v,
            stock: fila.stock === null ? null : Math.max(0, fila.stock - fila.reservado),
          };
        }),
      })),
    };
    return await entregar(c, version, tienda.version_publicada, await hornear(datos), {
      datos,
      redirecciones: h.redirecciones,
    });
  } catch (e) {
    return await fallarCon(c, version)(e instanceof Error ? e.message : String(e));
  }
}

// ── HU-T10.4: las versiones y volver a una ─────────────────────────────────────────────────

export interface FilaDeVersion {
  version: number;
  estado: 'en_cola' | 'horneando' | 'lista' | 'publicada' | 'reemplazada' | 'fallida';
  pedidaPor: string;
  pedida: string;
  publicada: string | null;
  archivos: number | null;
  /** Las fallas de la compuerta, o el motivo de una falla; nada si salió bien. */
  motivo: string | null;
  /** Cuándo se borraron sus archivos de R2 (bitácora tienda3 28): ya no se puede volver a ella. */
  purgada: string | null;
}

/** Las últimas versiones, de la más nueva a la más vieja. */
export async function leerVersiones(shard: BaseD1, org: string, limite = 30) {
  const { results } = await shard
    .prepare(
      `SELECT version, estado, pedida_por, pedida, publicada, archivos, motivo, purgada FROM publicacion
        WHERE org_id = ? ORDER BY version DESC LIMIT ?`,
    )
    .bind(org, limite)
    .all<{
      version: number;
      estado: FilaDeVersion['estado'];
      pedida_por: string;
      pedida: string;
      publicada: string | null;
      archivos: number | null;
      motivo: string | null;
      purgada: string | null;
    }>();
  return results.map(
    (f): FilaDeVersion => ({
      version: f.version,
      estado: f.estado,
      pedidaPor: f.pedida_por,
      pedida: f.pedida,
      publicada: f.publicada,
      archivos: f.archivos,
      motivo: f.motivo,
      purgada: f.purgada,
    }),
  );
}

export type ResultadoDeVolver =
  | { estado: 'publicada'; version: number; antes: number | null }
  | { estado: 'ya-esta'; version: number }
  | { estado: 'no-existe' }
  | { estado: 'en-curso' }
  | { estado: 'fallida'; motivo: string };

/**
 * HU-T10.4 CA2 y CA3: volver a una versión que ya estuvo publicada es mover el puntero, sin
 * hornear: el manifiesto de esa versión y sus objetos siguen en el almacén (son inmutables). No
 * toca pedidos ni inventario. Las existencias que horneó esa versión pueden ser viejas: quien llama
 * re-hornea las de ahora después (`rehornearExistencias`), y mientras tanto la vitrina vende con lo
 * que diga la API, que siempre cuenta con las de ahora.
 */
export async function volverA(c: Contexto, version: number): Promise<ResultadoDeVolver> {
  await vencerLasCortadas(c.shard, c.org, c.ahora);
  const [destino, tienda, enCurso] = await Promise.all([
    c.shard
      .prepare('SELECT estado, purgada FROM publicacion WHERE org_id = ? AND version = ?')
      .bind(c.org, version)
      .first<{ estado: string; purgada: string | null }>(),
    c.shard
      .prepare('SELECT version_publicada FROM tienda WHERE org_id = ?')
      .bind(c.org)
      .first<{ version_publicada: number | null }>(),
    c.shard
      .prepare(
        "SELECT version FROM publicacion WHERE org_id = ? AND estado IN ('en_cola', 'horneando')",
      )
      .bind(c.org)
      .first(),
  ]);
  // Una versión purgada ya no tiene sus archivos en R2 (bitácora tienda3 28).
  if (
    !destino ||
    destino.purgada !== null ||
    (destino.estado !== 'publicada' && destino.estado !== 'reemplazada')
  )
    return { estado: 'no-existe' };
  if (enCurso) return { estado: 'en-curso' };
  const antes = tienda?.version_publicada ?? null;
  if (antes === version) return { estado: 'ya-esta', version };
  if (!(await c.sitios.get(`sitios/${c.org}/${version}/manifiesto.json`)))
    return { estado: 'fallida', motivo: 'el manifiesto de esa versión no está en el almacén' };
  const direcciones = await direccionesDe(c);
  if (!direcciones.canonico)
    return { estado: 'fallida', motivo: 'la tienda no tiene una dirección activa' };

  await apuntarA(c, direcciones, version);
  await c.shard.batch([
    c.shard
      .prepare(
        "UPDATE publicacion SET estado = 'reemplazada' WHERE org_id = ? AND estado = 'publicada'",
      )
      .bind(c.org),
    c.shard
      .prepare("UPDATE publicacion SET estado = 'publicada' WHERE org_id = ? AND version = ?")
      .bind(c.org, version),
    c.shard
      .prepare('UPDATE tienda SET version_publicada = ? WHERE org_id = ?')
      .bind(version, c.org),
    await anotar(c.shard, {
      org: c.org,
      actor: c.pedidaPor,
      accion: 'publicacion.volver',
      entidad: 'publicacion',
      entidadId: String(version),
      antes: { version: antes },
      despues: { version },
      instante: c.ahora,
    }),
  ]);
  return { estado: 'publicada', version, antes };
}

// ── HU-T8.6: la vista previa ────────────────────────────────────────────────────────────────

/** Lo que dura una vista previa; el despacho usa el mismo plazo (`VIDA_DE_LA_VISTA_MS`). */
export const HORAS_DE_LA_VISTA = 24;

export type ResultadoDeLaVista =
  | { estado: 'lista'; url: string; vence: string; fallas: Falla[] }
  | { estado: 'muy-grande'; motivo: string }
  | { estado: 'fallida'; motivo: string };

/**
 * Hornea lo que la tienda tiene ahora, como al publicar, sin reservar versión ni mover el puntero
 * (CA1). Sube solo los archivos que ni la versión publicada ni la vista anterior tienen, y guarda
 * una sola vista por tienda en `sitios/<org>/vista.json`. La compuerta no la detiene: lo que falta
 * para publicar vuelve en `fallas`, para que el panel lo diga.
 */
export async function vistaPrevia(c: Contexto): Promise<ResultadoDeLaVista> {
  try {
    const armada = await armarLaTienda(c, { vistaPrevia: true });
    if ('falla' in armada) return { estado: 'fallida', motivo: armada.falla };
    const { tienda, archivos, revision, activos } = armada;
    const m = await manifiesto(archivos, redireccionesDe(activos));
    const previas = new Set<string>();
    const claves = [
      ...(tienda.version_publicada !== null
        ? [`sitios/${c.org}/${tienda.version_publicada}/manifiesto.json`]
        : []),
      `sitios/${c.org}/vista.json`,
    ];
    for (const clave of claves) {
      const objeto = await c.sitios.get(clave);
      if (!objeto) continue;
      try {
        const leido = JSON.parse(await objeto.text()) as typeof m | { manifiesto: typeof m };
        const archivosLeidos = 'manifiesto' in leido ? leido.manifiesto.archivos : leido.archivos;
        for (const a of Object.values(archivosLeidos)) previas.add(a.huella);
      } catch {
        // Ilegible: sus archivos se vuelven a subir.
      }
    }
    const pendientes: { huella: string; contenido: string; tipo: string }[] = [];
    for (const [ruta, archivo] of archivos) {
      const entrada = m.archivos[ruta];
      if (!entrada || previas.has(entrada.huella)) continue;
      previas.add(entrada.huella);
      pendientes.push({ huella: entrada.huella, contenido: archivo.contenido, tipo: archivo.tipo });
    }
    if (pendientes.length > (c.subidasPorTanda ?? SUBIDAS_POR_TANDA)) {
      return {
        estado: 'muy-grande',
        motivo:
          'Tu tienda tiene demasiados cambios para verlos antes de publicar. Publica por partes o escríbenos.',
      };
    }
    for (let i = 0; i < pendientes.length; i += SUBIDAS_A_LA_VEZ) {
      await Promise.all(
        pendientes.slice(i, i + SUBIDAS_A_LA_VEZ).map((p) =>
          c.sitios.put(`objetos/${p.huella.slice(0, 2)}/${p.huella}`, p.contenido, {
            httpMetadata: { contentType: p.tipo },
          }),
        ),
      );
    }
    await c.sitios.put(
      `sitios/${c.org}/vista.json`,
      JSON.stringify({ huella: m.huella, creada: c.ahora, manifiesto: m }),
      { httpMetadata: { contentType: 'application/json' } },
    );
    const { canonico } = await direccionesDe(c);
    if (!canonico) return { estado: 'fallida', motivo: 'la tienda no tiene una dirección activa' };
    return {
      estado: 'lista',
      url: `https://${canonico}/_vista/${m.huella}/`,
      vence: new Date(Date.parse(c.ahora) + HORAS_DE_LA_VISTA * 3_600_000).toISOString(),
      fallas: revision.ok ? [] : revision.fallas,
    };
  } catch (e) {
    return { estado: 'fallida', motivo: e instanceof Error ? e.message : String(e) };
  }
}
