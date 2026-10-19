/**
 * HU-T17.3: el respaldo semanal de cada tienda en R2 (TIENDA-3.0 §15.4, punto 2). Para poder
 * recuperar una tienda aunque se dañe su base, sin depender de Time Travel.
 *
 * - **Lo que lleva.** Las filas de cada tabla de la tienda **tal como están en la base**
 *   (`TABLAS_DEL_RESPALDO`), con sus ids, para que restaurarlas (HU-T17.4, `restaurar.ts`) deje cada
 *   pedido unido a su combinación y a su cobro. Los datos personales van **en sus sobres**: el
 *   contacto de cada pedido y cada solicitud, cifrados como están, con su IV y la versión de su
 *   llave, más esas llaves envueltas por la KEK, que no viaja. Nada sale en claro (CA2). Las
 *   llaves de las credenciales no viajan: se vuelven a pegar en el panel. Lleva también la tienda en
 *   `tienda-export/1`, lo mismo que «Descargar todo» (HU-T10.7), para leerla sin la base.
 * - **Dónde.** `respaldos/<org>/<fecha>.json` del almacén de la celda, fuera de `exportaciones/`,
 *   que vence a los 7 días (`docs/runbooks/tienda-ciclo-de-vida.md`). Se guardan las 4 últimas y
 *   la primera de cada uno de los 3 últimos meses; lo demás se borra.
 * - **Que cuadre (CA2 ❌).** Antes de dar el respaldo por bueno se cuentan en la base los
 *   productos, los pedidos y sus líneas, los contactos y las solicitudes, y se comparan con el archivo; después
 *   de guardarlo se relee y se compara su huella. Si algo no cuadra, se avisa por Telegram con la
 *   tienda y la causa, y la tarea queda en falla en `/api/salud`.
 * - **Por qué la versión 2** (bitácora tienda3 32): la 1 llevaba el catálogo como la exportación,
 *   que al cargarse estrena ids, y los pedidos respaldados quedaban sin su combinación. El simulacro
 *   de restauración (HU-T17.4) lo encontró antes de que hiciera falta.
 * - La copia fuera de Cloudflare la hace HU-C11.4 del CORE, que todavía no existe: cuando exista,
 *   suma estos archivos (TIENDA §15.4, punto 3).
 */
import type { BaseD1 } from '@ed1/d1';
import { type Exportacion, exportarTienda } from './exportar.ts';
import { sha256 } from './pedidos.ts';

export const FORMATO_DE_RESPALDO = 'tienda-respaldo/2';
export const PREFIJO_DE_RESPALDOS = 'respaldos/';
export const SEMANALES = 4;
export const MENSUALES = 3;

/**
 * Las tablas de una tienda, en el orden en que se restauran: lo que otra fila nombra va antes.
 * Con su orden de lectura, para que dos respaldos de la misma base salgan iguales. No viajan la
 * credencial (las llaves del comercio se pegan otra vez), las operaciones (la memoria de los
 * reintentos) ni las importaciones (su archivo ya está en las demás tablas).
 */
export const TABLAS_DEL_RESPALDO = [
  ['tienda', 'org_id'],
  ['ajuste', 'seccion'],
  ['llave', 'proposito, version'],
  ['coleccion', 'id'],
  ['producto', 'id'],
  ['coleccion_producto', 'coleccion_id, producto_id'],
  ['variante', 'id'],
  ['medio', 'producto_id, id'],
  ['movimiento_inventario', 'id'],
  ['interes_reposicion', 'variante_id'],
  ['envio_opcion', 'id'],
  ['cupon', 'codigo'],
  ['pedido', 'id'],
  ['pedido_linea', 'pedido_id, linea'],
  ['pedido_contacto', 'pedido_id'],
  ['pedido_evento', 'id'],
  ['contraentrega', 'pedido_id'],
  ['cobro', 'id'],
  ['apartado', 'id'],
  ['aviso_proveedor', 'proveedor, aviso_id'],
  ['solicitud', 'id'],
  ['pagina', 'id'],
  ['publicacion', 'version'],
  ['registro', 'id'],
  ['correo', 'clave'],
] as const;
export type TablaDelRespaldo = (typeof TABLAS_DEL_RESPALDO)[number][0];

/** Un valor de una fila: los bytes (sobres, IV, llaves envueltas) van en base64. */
export type Valor = string | number | null | { b64: string };
export type Fila = Record<string, Valor>;
export type Filas = Record<TablaDelRespaldo, Fila[]>;

/** Lo que el respaldo necesita del almacén R2 de la celda. */
export interface AlmacenDeRespaldos {
  put(clave: string, valor: string, opciones?: unknown): Promise<unknown>;
  get(clave: string): Promise<{ text(): Promise<string> } | null>;
  list(opciones: { prefix: string; cursor?: string; delimiter?: string }): Promise<{
    objects: { key: string; uploaded?: Date }[];
    /** Con `delimiter`, las «carpetas» que hay debajo de `prefix`. */
    delimitedPrefixes?: string[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(claves: string | string[]): Promise<void>;
}

export interface Respaldo {
  formato: typeof FORMATO_DE_RESPALDO;
  org: string;
  hecho: string;
  /** La tienda como «Descargar todo»: para leerla sin la base. */
  tienda: Exportacion;
  /** Las filas de cada tabla, como están en la base: lo que se restaura. */
  filas: Filas;
  /** Lo que la base tenía al respaldar; el archivo tiene que decir lo mismo. */
  recuentos: Recuentos;
}

export interface Recuentos {
  productos: number;
  pedidos: number;
  lineas: number;
  contactos: number;
  solicitudes: number;
}

const enBase64 = (b: ArrayBuffer | Uint8Array | number[]) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b as ArrayBuffer);
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s);
};

/** D1 devuelve un BLOB como `ArrayBuffer` o, según el runtime, como una lista de bytes. */
const esBytes = (v: unknown): v is ArrayBuffer | Uint8Array | number[] =>
  v instanceof ArrayBuffer || v instanceof Uint8Array || Array.isArray(v);

/**
 * Las filas de cada tabla de la tienda, como están en la base. Las llaves de las credenciales no
 * salen. Lo usan el respaldo y la restauración, que compara las huellas tabla por tabla (HU-T17.4).
 */
export async function filasDeLaTienda(db: BaseD1, org: string): Promise<Filas> {
  const leidas = await Promise.all(
    TABLAS_DEL_RESPALDO.map(([tabla, orden]) =>
      db
        .prepare(
          `SELECT * FROM ${tabla} WHERE org_id = ?${tabla === 'llave' ? " AND proposito <> 'credenciales'" : ''} ORDER BY ${orden}`,
        )
        .bind(org)
        .all<Record<string, unknown>>(),
    ),
  );
  return Object.fromEntries(
    TABLAS_DEL_RESPALDO.map(([tabla], i) => [
      tabla,
      (leidas[i]?.results ?? []).map((f) =>
        Object.fromEntries(
          Object.entries(f).map(([k, v]) => [
            k,
            esBytes(v) ? { b64: enBase64(v) } : (v as string | number | null),
          ]),
        ),
      ),
    ]),
  ) as Filas;
}

/** La huella de cada tabla: dos tiendas con las mismas filas dan las mismas huellas. */
export async function huellasDeLasFilas(f: Filas): Promise<Record<TablaDelRespaldo, string>> {
  const pares = await Promise.all(
    TABLAS_DEL_RESPALDO.map(
      async ([tabla]) => [tabla, await sha256(JSON.stringify(f[tabla]))] as const,
    ),
  );
  return Object.fromEntries(pares) as Record<TablaDelRespaldo, string>;
}

/** La fecha del respaldo en Bogotá (UTC−5, sin horario de verano): `AAAA-MM-DD`. */
export const fechaDeRespaldo = (instante: number) =>
  new Date(instante - 5 * 3_600_000).toISOString().slice(0, 10);

export const claveDeRespaldo = (org: string, instante: number) =>
  `${PREFIJO_DE_RESPALDOS}${org}/${fechaDeRespaldo(instante)}.json`;

/**
 * Qué respaldos de una tienda sobran: se quedan los `SEMANALES` más nuevos y el primero de cada
 * uno de los `MENSUALES` meses más recientes. Las claves son las de `claveDeRespaldo`.
 */
export function respaldosQueSobran(claves: readonly string[]): string[] {
  const fecha = (k: string) => k.slice(k.lastIndexOf('/') + 1, -'.json'.length);
  const orden = [...claves].sort((a, b) => fecha(b).localeCompare(fecha(a)));
  const quedan = new Set(orden.slice(0, SEMANALES));
  const primeroDelMes = new Map<string, string>();
  for (const k of orden) primeroDelMes.set(fecha(k).slice(0, 7), k);
  for (const k of [...primeroDelMes.values()].slice(0, MENSUALES)) quedan.add(k);
  return orden.filter((k) => !quedan.has(k));
}

async function recuentosDeLaBase(db: BaseD1, org: string): Promise<Recuentos> {
  const [productos, pedidos, lineas, contactos, solicitudes] = await Promise.all([
    db
      .prepare('SELECT count(*) AS n FROM producto WHERE org_id = ? AND borrado IS NULL')
      .bind(org)
      .first<{ n: number }>(),
    db
      .prepare('SELECT count(*) AS n FROM pedido WHERE org_id = ?')
      .bind(org)
      .first<{ n: number }>(),
    db
      .prepare('SELECT count(*) AS n FROM pedido_linea WHERE org_id = ?')
      .bind(org)
      .first<{ n: number }>(),
    db
      .prepare('SELECT count(*) AS n FROM pedido_contacto WHERE org_id = ?')
      .bind(org)
      .first<{ n: number }>(),
    db
      .prepare('SELECT count(*) AS n FROM solicitud WHERE org_id = ?')
      .bind(org)
      .first<{ n: number }>(),
  ]);
  return {
    productos: productos?.n ?? 0,
    pedidos: pedidos?.n ?? 0,
    lineas: lineas?.n ?? 0,
    contactos: contactos?.n ?? 0,
    solicitudes: solicitudes?.n ?? 0,
  };
}

/** Lo que dice el archivo, contado igual que la base. */
export const recuentosDelRespaldo = (r: Omit<Respaldo, 'recuentos'>): Recuentos => ({
  productos: r.filas.producto.filter((p) => p['borrado'] === null).length,
  pedidos: r.filas.pedido.length,
  lineas: r.filas.pedido_linea.length,
  contactos: r.filas.pedido_contacto.length,
  solicitudes: r.filas.solicitud.length,
});

export class RespaldoQueNoCuadra extends Error {}

/** El respaldo de una tienda: lo arma, revisa que cuadre, lo guarda, lo relee y rota los viejos. */
export async function respaldarTienda(
  db: BaseD1,
  org: string,
  almacen: AlmacenDeRespaldos,
  instante: number,
  medios: string | undefined,
): Promise<{ clave: string; recuentos: Recuentos; borrados: number }> {
  const hecho = new Date(instante).toISOString();
  const tienda = await exportarTienda(
    { db, org, actor: 'sistema', instante: hecho },
    { medios, datosPersonales: false, kek: null, sinAnotar: true },
  );
  if (!('formato' in tienda)) throw new RespaldoQueNoCuadra(tienda.motivo);
  const sinRecuentos: Omit<Respaldo, 'recuentos'> = {
    formato: FORMATO_DE_RESPALDO,
    org,
    hecho,
    tienda,
    filas: await filasDeLaTienda(db, org),
  };
  const enLaBase = await recuentosDeLaBase(db, org);
  const enElArchivo = recuentosDelRespaldo(sinRecuentos);
  const distintos = (Object.keys(enLaBase) as (keyof Recuentos)[]).filter(
    (k) => enLaBase[k] !== enElArchivo[k],
  );
  if (distintos.length > 0) {
    throw new RespaldoQueNoCuadra(
      `no cuadra con la base: ${distintos.map((k) => `${k} ${enElArchivo[k]} de ${enLaBase[k]}`).join(', ')}`,
    );
  }
  const texto = JSON.stringify({ ...sinRecuentos, recuentos: enLaBase } satisfies Respaldo);
  const clave = claveDeRespaldo(org, instante);
  await almacen.put(clave, texto, { httpMetadata: { contentType: 'application/json' } });
  const releido = await almacen.get(clave);
  if (!releido || (await sha256(await releido.text())) !== (await sha256(texto))) {
    throw new RespaldoQueNoCuadra('el archivo guardado no es el que se escribió');
  }

  const claves: string[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await almacen.list({
      prefix: `${PREFIJO_DE_RESPALDOS}${org}/`,
      ...(cursor ? { cursor } : {}),
    });
    claves.push(...pagina.objects.map((o) => o.key));
    cursor = pagina.truncated ? pagina.cursor : undefined;
  } while (cursor);
  const sobran = respaldosQueSobran(claves);
  if (sobran.length > 0) await almacen.delete(sobran);
  return { clave, recuentos: enLaBase, borrados: sobran.length };
}
