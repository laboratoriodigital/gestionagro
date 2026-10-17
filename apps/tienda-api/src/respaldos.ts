/**
 * HU-T17.3: el respaldo semanal de cada tienda en R2 (TIENDA-3.0 §15.4, punto 2). Para poder
 * recuperar una tienda aunque se dañe su base, sin depender de Time Travel.
 *
 * - **Lo que lleva.** La tienda en `tienda-export/1`, lo mismo que «Descargar todo» (HU-T10.7);
 *   todos los pedidos con sus líneas, tal como están en la base, porque la exportación deja fuera
 *   los que están en curso y son los que más importa no perder; y los datos personales **en sus
 *   sobres**: el contacto de cada pedido y cada solicitud, cifrados como están en la base, con su
 *   IV y la versión de su llave, más esas llaves envueltas por la KEK, que no viaja: sin ellas un
 *   sobre restaurado no se podría abrir. Nada sale en claro (CA2). Las llaves de las credenciales
 *   no viajan, como el cobro en «Descargar todo»: se vuelven a pegar en el panel.
 * - **Dónde.** `respaldos/<org>/<fecha>.json` del almacén de la celda, fuera de `exportaciones/`,
 *   que vence a los 7 días (`docs/runbooks/tienda-ciclo-de-vida.md`). Se guardan las 4 últimas y
 *   la primera de cada uno de los 3 últimos meses; lo demás se borra.
 * - **Que cuadre (CA2 ❌).** Antes de dar el respaldo por bueno se cuentan en la base los
 *   productos, los pedidos y sus líneas, los contactos y las solicitudes, y se comparan con el archivo; después
 *   de guardarlo se relee y se compara su huella. Si algo no cuadra, se avisa por Telegram con la
 *   tienda y la causa, y la tarea queda en falla en `/api/salud`.
 * - La copia fuera de Cloudflare la hace HU-C11.4 del CORE, que todavía no existe: cuando exista,
 *   suma estos archivos (TIENDA §15.4, punto 3).
 */
import type { BaseD1 } from '@ed1/d1';
import { type Exportacion, exportarTienda } from './exportar.ts';
import { sha256 } from './pedidos.ts';

export const FORMATO_DE_RESPALDO = 'tienda-respaldo/1';
export const PREFIJO_DE_RESPALDOS = 'respaldos/';
export const SEMANALES = 4;
export const MENSUALES = 3;

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

/** Un sobre, como está en la base: los bytes en base64. */
export interface Sobre {
  sobre: string;
  iv: string;
  llaveVersion: number;
}

export interface Respaldo {
  formato: typeof FORMATO_DE_RESPALDO;
  org: string;
  hecho: string;
  tienda: Exportacion;
  /** Las filas de `pedido` y `pedido_linea`, todas, con sus columnas. */
  pedidos: { pedidos: Record<string, unknown>[]; lineas: Record<string, unknown>[] };
  sobres: {
    contactos: ({
      pedidoId: string;
      codigo: string;
      celularIndice: string | null;
      creado: string;
      purgarDespues: string;
    } & Sobre)[];
    solicitudes: ({
      id: string;
      radicado: number;
      tipo: string;
      pedido: string | null;
      canal: string;
      estado: string;
      creada: string;
      vence: string;
      respondida: string | null;
      cerrada: string | null;
    } & Sobre)[];
  };
  /** Las DEK de `datos_personales` e `indices`, envueltas por la KEK (`kekId`) como en la base. */
  llaves: {
    proposito: string;
    version: number;
    envuelta: string;
    kekId: string;
    creada: string;
    retirada: string | null;
  }[];
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
  productos: r.tienda.productos.length,
  pedidos: r.pedidos.pedidos.length,
  lineas: r.pedidos.lineas.length,
  contactos: r.sobres.contactos.length,
  solicitudes: r.sobres.solicitudes.length,
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
  const [pedidos, lineas, contactos, solicitudes, llaves] = await Promise.all([
    db
      .prepare('SELECT * FROM pedido WHERE org_id = ? ORDER BY creado, codigo')
      .bind(org)
      .all<Record<string, unknown>>(),
    db
      .prepare('SELECT * FROM pedido_linea WHERE org_id = ? ORDER BY pedido_id, linea')
      .bind(org)
      .all<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT c.pedido_id, p.codigo, c.sobre, c.iv, c.llave_version, c.celular_indice, c.creado,
                c.purgar_despues
           FROM pedido_contacto c JOIN pedido p ON p.org_id = ? AND p.id = c.pedido_id
          WHERE c.org_id = ? ORDER BY p.codigo`,
      )
      .bind(org, org)
      .all<{
        pedido_id: string;
        codigo: string;
        sobre: ArrayBuffer;
        iv: ArrayBuffer;
        llave_version: number;
        celular_indice: string | null;
        creado: string;
        purgar_despues: string;
      }>(),
    db
      .prepare(
        `SELECT s.id, s.radicado, s.tipo, p.codigo AS pedido, s.canal, s.estado, s.sobre, s.iv,
                s.llave_version, s.creada, s.vence, s.respondida, s.cerrada
           FROM solicitud s LEFT JOIN pedido p ON p.org_id = ? AND p.id = s.pedido_id
          WHERE s.org_id = ? ORDER BY s.radicado`,
      )
      .bind(org, org)
      .all<{
        id: string;
        radicado: number;
        tipo: string;
        pedido: string | null;
        canal: string;
        estado: string;
        sobre: ArrayBuffer;
        iv: ArrayBuffer;
        llave_version: number;
        creada: string;
        vence: string;
        respondida: string | null;
        cerrada: string | null;
      }>(),
    db
      .prepare(
        `SELECT proposito, version, envuelta, kek_id, creada, retirada FROM llave
          WHERE org_id = ? AND proposito IN ('datos_personales', 'indices') ORDER BY proposito, version`,
      )
      .bind(org)
      .all<{
        proposito: string;
        version: number;
        envuelta: ArrayBuffer;
        kek_id: string;
        creada: string;
        retirada: string | null;
      }>(),
  ]);
  const sinRecuentos: Omit<Respaldo, 'recuentos'> = {
    formato: FORMATO_DE_RESPALDO,
    org,
    hecho,
    tienda,
    pedidos: { pedidos: pedidos.results, lineas: lineas.results },
    sobres: {
      contactos: contactos.results.map((c) => ({
        pedidoId: c.pedido_id,
        codigo: c.codigo,
        sobre: enBase64(c.sobre),
        iv: enBase64(c.iv),
        llaveVersion: c.llave_version,
        celularIndice: c.celular_indice,
        creado: c.creado,
        purgarDespues: c.purgar_despues,
      })),
      solicitudes: solicitudes.results.map(({ sobre, iv, llave_version, ...s }) => ({
        ...s,
        sobre: enBase64(sobre),
        iv: enBase64(iv),
        llaveVersion: llave_version,
      })),
    },
    llaves: llaves.results.map((l) => ({
      proposito: l.proposito,
      version: l.version,
      envuelta: enBase64(l.envuelta),
      kekId: l.kek_id,
      creada: l.creada,
      retirada: l.retirada,
    })),
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
