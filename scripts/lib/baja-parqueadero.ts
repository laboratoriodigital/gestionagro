/**
 * Un parqueadero se va (HU-Q10.2, PARQUEADERO §14.5 runbook 5, P21): exportar todo lo suyo de la
 * celda, entregarlo, verificar la huella y, solo entonces, purgar. El runbook es
 * `docs/runbooks/parqueadero-baja.md`; la línea de comandos, `scripts/baja-parqueadero.ts`.
 *
 * - **Exportar** arma el mismo `parqueadero-export/1` del respaldo de la caja, con todo lo del
 *   parqueadero en la celda: el parqueadero lo abre en una caja nueva con «Restaurar». Lo exige
 *   con todas sus cajas retiradas (HU-Q7.7): así no llega nada después de exportar.
 * - **La huella** es el SHA-256 del archivo entregado, tal cual. Es la que queda en `purga`.
 * - **Purgar** vuelve a leer la celda y compara cada tabla con la del archivo: si la celda tiene
 *   algo que no se entregó, no borra. Después escribe la fila de `purga` (lo único que deja pasar
 *   el `DELETE` por el trigger `registro_sin_borrado`) y borra los registros, los catálogos, su
 *   historial y la cuarentena del parqueadero. Las cajas retiradas se quedan: una caja retirada no
 *   vuelve a subir nada (HU-Q7.7 CA3), y sin su fila la celda no sabría que lo está.
 *
 * El acceso a D1 entra como `Consultor`: la API HTTP de Cloudflare en la línea de comandos, el D1
 * local en las pruebas. Nada aquí corre en un Worker, así que no aplica el límite de 50 consultas.
 */
import {
  armarExport,
  csvDeRegistros,
  hashDeFilas,
  type ParqueaderoExportV1,
  type Registro,
  TABLAS_EXPORTADAS,
  verificarExport,
} from '../../packages/parqueadero-schema/src/index.ts';

export type Valor = string | number | null;

export interface Consultor {
  leer<T>(sql: string, params?: readonly Valor[]): Promise<T[]>;
  /** Las sentencias en orden; si una falla, lanza y no sigue. */
  escribir(sentencias: readonly { sql: string; params: readonly Valor[] }[]): Promise<void>;
}

/** Un parqueadero de la cuenta: su id es un UUIDv7 (`org_id`). */
const ORG = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HUELLA = /^[0-9a-f]{64}$/;
/** Filas por lectura: una página cabe holgada en una respuesta de la API de D1. */
const PAGINA = 500;
/** Lo que el archivo dice en `dispositivo`: no es una caja, es la celda. Ninguna serie es «NUB». */
const DE_LA_CELDA = { serie: 'NUB' } as const;

export class BajaRechazada extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'BajaRechazada';
  }
}

export function validarOrg(org: string): string {
  if (!ORG.test(org)) throw new BajaRechazada(`«${org}» no es el id de un parqueadero (UUIDv7)`);
  return org;
}

export async function sha256(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Las cajas del parqueadero que todavía pueden subir algo: hay que retirarlas antes. */
export async function cajasSinRetirar(db: Consultor, org: string): Promise<string[]> {
  const filas = await db.leer<{ serie: string }>(
    "SELECT serie FROM dispositivo WHERE org_id = ? AND estado <> 'retirado' ORDER BY serie",
    [org],
  );
  return filas.map((f) => f.serie);
}

async function porPaginas<T extends { orden: number | string }>(
  db: Consultor,
  sql: (desde: string) => string,
  org: string,
  inicio: number | string,
): Promise<T[]> {
  const todas: T[] = [];
  let desde: number | string = inicio;
  for (;;) {
    const pagina = await db.leer<T>(sql('?'), [org, desde, PAGINA]);
    todas.push(...pagina);
    if (pagina.length < PAGINA) return todas;
    desde = pagina.at(-1)?.orden ?? desde;
  }
}

export interface Contenido {
  readonly catalogo: { id: string; entidad: string; nombre?: string }[];
  readonly registro: Registro[];
  readonly historial: { id: string }[];
}

/** Todo lo del parqueadero en la celda, con la forma que la caja guarda (como el pull). */
export async function leerParqueadero(db: Consultor, org: string): Promise<Contenido> {
  const catalogo = await porPaginas<{ orden: number; datos: string }>(
    db,
    (p) =>
      `SELECT seq AS orden, datos FROM catalogo WHERE org_id = ? AND seq > ${p} ORDER BY seq LIMIT ?`,
    org,
    0,
  );
  const registro = await porPaginas<
    { orden: number; datos: string } & Omit<Registro, 'datos'> & { seq?: number }
  >(
    db,
    (p) =>
      `SELECT seq AS orden, id, org_id, tipo, v, fecha_local, instante_evento, autor_usuario_id,
         dispositivo_id, origen, anula_id, estadia_id, serie, consecutivo, datos
       FROM registro WHERE org_id = ? AND seq > ${p} ORDER BY seq LIMIT ?`,
    org,
    0,
  );
  const historial = await porPaginas<{
    orden: string;
    id: string;
    entidad: string;
    entidad_id: string;
    version: number;
    datos: string;
    reemplazada: string;
    motivo: 'edicion' | 'conflicto';
  }>(
    db,
    (p) =>
      `SELECT id AS orden, id, entidad, entidad_id, version, datos, reemplazada, motivo
       FROM entidad_historial WHERE org_id = ? AND id > ${p} ORDER BY id LIMIT ?`,
    org,
    '',
  );
  return {
    catalogo: catalogo.map((f) => JSON.parse(f.datos) as Contenido['catalogo'][number]),
    registro: registro.map(
      ({ orden: _o, datos, ...r }): Registro => ({ ...r, datos: JSON.parse(datos) as unknown }),
    ),
    // En la caja, la versión anterior va sin su id ni su número (`almacen.ts`, `sincronizar.ts`).
    historial: historial.map(({ orden: _o, datos, ...h }) => {
      const { id: _id, version: _v, ...resto } = JSON.parse(datos) as Record<string, unknown>;
      return { ...h, datos: resto };
    }),
  };
}

export interface Exportacion {
  readonly archivo: ParqueaderoExportV1;
  /** El archivo tal cual se entrega: la huella es de estos bytes. */
  readonly texto: string;
  readonly csv: string;
  readonly huella: string;
  readonly nombre: string;
  readonly parqueadero: string;
}

const nombreDeLaSede = (c: Contenido) =>
  c.catalogo.find((x) => x.entidad === 'sede')?.nombre ?? null;

/** Exporta todo el parqueadero. Con una caja sin retirar, no. */
export async function exportar(
  db: Consultor,
  org: string,
  { celda, ahora }: { celda: string; ahora: () => number },
): Promise<Exportacion> {
  validarOrg(org);
  const abiertas = await cajasSinRetirar(db, org);
  if (abiertas.length > 0) {
    throw new BajaRechazada(
      `primero retire sus cajas (${abiertas.join(', ')}): «Cuenta y nube» › «Cajas del parqueadero», o docs/runbooks/parqueadero-retirar-caja.md. Así nada llega después de exportar.`,
    );
  }
  const c = await leerParqueadero(db, org);
  if (c.catalogo.length + c.registro.length === 0) {
    throw new BajaRechazada('la celda no tiene nada de ese parqueadero: revise el id y el destino');
  }
  const generado = new Date(ahora()).toISOString();
  const archivo = await armarExport({
    generado,
    app: `baja ${celda}`,
    dispositivo: { id: `celda-${celda}`, ...DE_LA_CELDA },
    sede_id: c.catalogo.find((x) => x.entidad === 'sede')?.id ?? null,
    catalogo: c.catalogo,
    registro: c.registro,
    historial: c.historial,
  });
  const texto = `${JSON.stringify(archivo, null, 2)}\n`;
  return {
    archivo,
    texto,
    csv: csvDeRegistros(c.registro),
    huella: await sha256(texto),
    nombre: `parqueadero-baja-${org}-${generado.slice(0, 10)}`,
    parqueadero: nombreDeLaSede(c) ?? org,
  };
}

/** Lo que el parqueadero recibió es lo que se exportó, entero y con su huella. */
export async function verificarEntrega(
  texto: string,
  huella: string,
): Promise<ParqueaderoExportV1> {
  if (!HUELLA.test(huella)) throw new BajaRechazada('la huella es un SHA-256 de 64 caracteres');
  if ((await sha256(texto)) !== huella) {
    throw new BajaRechazada('el archivo no tiene la huella dada: no es el que se entregó');
  }
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new BajaRechazada('el archivo no es un JSON');
  }
  const problemas = await verificarExport(json);
  if (problemas.length > 0)
    throw new BajaRechazada(`el archivo no está entero: ${problemas.join('; ')}`);
  return json as ParqueaderoExportV1;
}

export interface Purga {
  readonly borrados: Record<'registro' | 'catalogo' | 'entidad_historial' | 'cuarentena', number>;
  /** La purga ya estaba hecha con esa huella: no había nada que borrar. */
  readonly yaHecha: boolean;
}

/** La tabla de la celda que corresponde a cada tabla del archivo. */
const EN_LA_CELDA = {
  catalogo: 'catalogo',
  registro: 'registro',
  historial: 'entidad_historial',
} as const;

/**
 * Purga el parqueadero con la exportación entregada. Antes: la huella, el archivo entero, todas
 * las cajas retiradas y la celda igual al archivo. `confirmar` es el nombre del parqueadero, que
 * se escribe a mano.
 */
export async function purgar(
  db: Consultor,
  org: string,
  o: { texto: string; huella: string; autor: string; confirmar: string; ahora: () => number },
): Promise<Purga> {
  validarOrg(org);
  const archivo = await verificarEntrega(o.texto, o.huella);
  const autor = o.autor.trim();
  if (autor.length < 3) throw new BajaRechazada('falta quién autoriza la purga (--autor)');
  const anterior = await db.leer<{ exportacion_huella: string }>(
    'SELECT exportacion_huella FROM purga WHERE org_id = ?',
    [org],
  );
  if (anterior[0] && anterior[0].exportacion_huella !== o.huella) {
    throw new BajaRechazada(
      'ese parqueadero ya tiene una purga con otra huella: revise cuál archivo se entregó',
    );
  }
  const abiertas = await cajasSinRetirar(db, org);
  if (abiertas.length > 0) {
    throw new BajaRechazada(`hay cajas sin retirar (${abiertas.join(', ')}): no se purga`);
  }
  const c = await leerParqueadero(db, org);
  const [cuarentena] = await db.leer<{ n: number }>(
    'SELECT count(*) AS n FROM cuarentena WHERE org_id = ?',
    [org],
  );
  const quedan = c.catalogo.length + c.registro.length + c.historial.length + (cuarentena?.n ?? 0);
  if (anterior[0] && quedan === 0) {
    return {
      borrados: { registro: 0, catalogo: 0, entidad_historial: 0, cuarentena: 0 },
      yaHecha: true,
    };
  }
  // Con la purga ya autorizada con esta huella, lo que queda es lo que un corte dejó a medias: la
  // celda ya se comparó con el archivo la primera vez, y ahora tiene menos.
  if (!anterior[0]) {
    const nombre = nombreDeLaSede(c);
    if (o.confirmar.trim() !== (nombre ?? org)) {
      throw new BajaRechazada(
        `para confirmar, escriba el nombre del parqueadero: «${nombre ?? org}»`,
      );
    }
    if (archivo.sede_id !== (c.catalogo.find((x) => x.entidad === 'sede')?.id ?? null)) {
      throw new BajaRechazada('el archivo es de otro parqueadero');
    }
    for (const t of TABLAS_EXPORTADAS) {
      if ((await hashDeFilas(c[t])) !== archivo.tablas[t].hash) {
        throw new BajaRechazada(
          `«${t}» en la celda no es igual a lo entregado (${c[t].length} filas en la celda, ${archivo.tablas[t].recuento} en el archivo): exporte y entregue otra vez`,
        );
      }
    }
  }
  // La fila de `purga` va primero: sin ella el trigger rechaza el DELETE. Si algo se corta a
  // mitad, repetir el comando con la misma huella termina lo que falte.
  await db.escribir([
    {
      sql: `INSERT INTO purga (org_id, autorizada, autor, exportacion_huella) VALUES (?, ?, ?, ?)
            ON CONFLICT (org_id) DO NOTHING`,
      params: [org, new Date(o.ahora()).toISOString(), autor, o.huella],
    },
    ...Object.values(EN_LA_CELDA).map((t) => ({
      sql: `DELETE FROM ${t} WHERE org_id = ?`,
      params: [org],
    })),
    { sql: 'DELETE FROM cuarentena WHERE org_id = ?', params: [org] },
  ]);
  return {
    borrados: {
      registro: c.registro.length,
      catalogo: c.catalogo.length,
      entidad_historial: c.historial.length,
      cuarentena: cuarentena?.n ?? 0,
    },
    yaHecha: false,
  };
}

/** `Consultor` sobre la API HTTP de D1 (`/query`), con el token de la cuenta. */
export function consultorHttp(
  fetchFn: typeof fetch,
  { token, cuenta, base }: { token: string; cuenta: string; base: string },
): Consultor {
  const url = `https://api.cloudflare.com/client/v4/accounts/${cuenta}/d1/database/${base}/query`;
  async function una<T>(sql: string, params: readonly Valor[]): Promise<T[]> {
    const r = await fetchFn(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    const cuerpo = (await r.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: { message?: string }[];
      result?: { results?: T[] }[];
    };
    if (!r.ok || cuerpo.success === false) {
      const causa = cuerpo.errors?.map((e) => e.message).join('; ') || `HTTP ${r.status}`;
      throw new Error(`D1: ${causa}`);
    }
    return cuerpo.result?.[0]?.results ?? [];
  }
  return {
    leer: (sql, params = []) => una(sql, params),
    escribir: async (sentencias) => {
      for (const s of sentencias) await una(s.sql, s.params);
    },
  };
}

/**
 * El parqueadero del ensayo (CA2): Ensayo Dos, con un id que ninguna cuenta tiene. Solo para
 * `ensayarBaja`, que corre en staging.
 */
export const ORG_DEL_ENSAYO = '0199b8a0-0000-7000-8000-00000000e002';

/** Deja la celda sin nada del parqueadero del ensayo, ni su purga: como si nunca hubiera estado. */
async function limpiarEnsayo(db: Consultor, ahora: string) {
  const org = ORG_DEL_ENSAYO;
  await db.escribir([
    {
      sql: `INSERT INTO purga (org_id, autorizada, autor, exportacion_huella) VALUES (?, ?, 'ensayo', ?)
            ON CONFLICT (org_id) DO NOTHING`,
      params: [org, ahora, '0'.repeat(64)],
    },
    ...['registro', 'catalogo', 'entidad_historial', 'cuarentena', 'dispositivo', 'purga'].map(
      (t) => ({ sql: `DELETE FROM ${t} WHERE org_id = ?`, params: [org] }),
    ),
  ]);
}

type CatalogoDeEnsayo = { id: string; entidad: string; version: number } & Record<string, unknown>;

interface Ensayo {
  readonly sede: CatalogoDeEnsayo & { nombre: string };
  readonly tarifa: CatalogoDeEnsayo;
  readonly registros: readonly Registro[];
}

/** Ensayo Dos en la celda, como si sus cajas lo hubieran subido: una caja, su sede, una tarifa
 * editada (con su versión anterior en el historial), una entrada y su salida. */
async function sembrarEnsayo(db: Consultor, e: Ensayo, ahora: string, caja: string) {
  const org = ORG_DEL_ENSAYO;
  const tarifaV1 = { ...e.tarifa, org_id: org, version: 1 };
  const tarifaV2 = { ...e.tarifa, org_id: org, version: 2, valor: 200, actualizado: ahora };
  const sede = { ...e.sede, org_id: org };
  const { id: _i, version: _v, ...anterior } = tarifaV1;
  await db.escribir([
    {
      sql: `INSERT INTO dispositivo (org_id, id, serie, nombre, estado, creado) VALUES (?, ?, 'A', 'Caja A', 'activo', ?)`,
      params: [org, caja, ahora],
    },
    ...[sede, tarifaV2].map((c, i) => ({
      sql: `INSERT INTO catalogo (id, org_id, seq, entidad, version, v, datos, actualizado, dispositivo_id)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      params: [c.id, org, i + 1, c.entidad, c.version, JSON.stringify(c), ahora, caja],
    })),
    {
      sql: `INSERT INTO entidad_historial (id, org_id, entidad, entidad_id, version, datos, reemplazada, motivo)
            VALUES (?, ?, 'tarifa', ?, 1, ?, ?, 'edicion')`,
      params: [
        `${tarifaV1.id}@v1`,
        org,
        tarifaV1.id,
        JSON.stringify({ ...anterior, id: tarifaV1.id, version: 1 }),
        ahora,
      ],
    },
    ...e.registros.map((r, i) => ({
      sql: `INSERT INTO registro (id, org_id, seq, tipo, v, fecha_local, instante_evento, instante_recibido,
              autor_usuario_id, dispositivo_id, origen, anula_id, estadia_id, serie, consecutivo, datos)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        r.id,
        org,
        i + 1,
        r.tipo,
        r.v,
        r.fecha_local,
        r.instante_evento,
        ahora,
        caja,
        r.origen,
        r.anula_id,
        r.estadia_id,
        r.serie,
        r.consecutivo,
        JSON.stringify(r.datos),
      ],
    })),
  ]);
}

/**
 * El ensayo de punta a punta (CA2), con Ensayo Dos: sembrar, comprobar que el `DELETE` sin purga
 * no pasa (CA3), que no exporta con la caja activa, retirarla, exportar, verificar la huella,
 * purgar y comprobar que no queda nada. Devuelve lo que pasó, paso por paso; lanza en el primero
 * que falle. Deja la celda como estaba.
 */
export async function ensayarBaja(
  db: Consultor,
  e: Ensayo,
  { celda, ahora, nuevoId }: { celda: string; ahora: () => number; nuevoId: () => string },
): Promise<{ pasos: string[]; exportacion: Exportacion }> {
  const org = ORG_DEL_ENSAYO;
  const pasos: string[] = [];
  const cuando = () => new Date(ahora()).toISOString();
  const caja = `caja-ensayo-baja-${nuevoId()}`;
  await limpiarEnsayo(db, cuando());
  // Ids nuevos en cada ensayo: el id de un registro es único en todo el shard.
  const entrada = nuevoId();
  const registros = e.registros.map((r, i) => ({
    ...r,
    id: i === 0 ? entrada : nuevoId(),
    org_id: org,
    estadia_id: entrada,
    dispositivo_id: caja,
  }));
  await sembrarEnsayo(db, { ...e, registros }, cuando(), caja);
  pasos.push(
    `sembrado ${e.sede.nombre}: 1 caja, 2 catálogos, 1 versión anterior, ${registros.length} registros`,
  );

  const sinPurga = await db
    .escribir([{ sql: 'DELETE FROM registro WHERE org_id = ?', params: [org] }])
    .then(() => null)
    .catch((x: unknown) => String(x));
  if (!sinPurga?.includes('purga autorizada')) {
    throw new Error(`CA3: el DELETE sin purga no lo rechazó el trigger (${sinPurga ?? 'pasó'})`);
  }
  pasos.push('CA3: sin la fila de purga, D1 rechazó el DELETE');

  const activa = await exportar(db, org, { celda, ahora }).catch((x: unknown) => x);
  if (!(activa instanceof BajaRechazada)) throw new Error('exportó con una caja sin retirar');
  await db.escribir([
    {
      sql: "UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE org_id = ? AND id = ?",
      params: [cuando(), org, caja],
    },
  ]);
  pasos.push('con la caja activa no exportó; caja retirada');

  const ex = await exportar(db, org, { celda, ahora });
  await verificarEntrega(ex.texto, ex.huella);
  pasos.push(
    `exportado y verificado: ${ex.archivo.tablas.registro.recuento} registros, huella ${ex.huella}`,
  );
  const purga = await purgar(db, org, {
    texto: ex.texto,
    huella: ex.huella,
    autor: 'ensayo HU-Q10.2',
    confirmar: e.sede.nombre,
    ahora,
  });
  const restos = await leerParqueadero(db, org);
  const quedan = restos.catalogo.length + restos.registro.length + restos.historial.length;
  if (quedan > 0) throw new Error(`después de purgar quedan ${quedan} filas`);
  const [fila] = await db.leer<{ exportacion_huella: string }>(
    'SELECT exportacion_huella FROM purga WHERE org_id = ?',
    [org],
  );
  if (fila?.exportacion_huella !== ex.huella) throw new Error('la purga no guardó la huella');
  pasos.push(
    `purgado: ${purga.borrados.registro} registros, ${purga.borrados.catalogo} catálogos, ${purga.borrados.entidad_historial} versiones; la purga guarda la huella`,
  );
  await limpiarEnsayo(db, cuando());
  pasos.push('celda limpia: el ensayo no dejó nada');
  return { pasos, exportacion: ex };
}
