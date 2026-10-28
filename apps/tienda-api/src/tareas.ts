/**
 * Las tareas periódicas de la Tienda (HU-T17.1, TIENDA-3.0 §15.3), en el plan gratuito: la cuenta
 * tiene 5 cron y quedaba uno (D-T10, bitácora tienda3 7). Un solo cron por hora, solo en
 * producción, que reparte el trabajo por frecuencia: cada hora, cada día (a las 3 a. m. de Bogotá)
 * y cada semana (el lunes a esa hora). Lo que pedía 5 o 15 minutos se hace perezoso donde se puede
 * (los apartados vencen al leerlos, anexo A) o pasa a cada hora.
 *
 * - Cada tarea corre aparte: una que falla no tumba a las demás de su frecuencia y dice su causa
 *   (CA3).
 * - Cada una anota su última corrida en el KV de flags (`tarea:<nombre>`), y `/api/salud` dice si
 *   alguna está atrasada (CA1).
 * - La diaria reconstruye `TIENDA_HOSTS` desde las bases: si difiere, gana la base y se avisa por
 *   Telegram con lo que cambió (CA2).
 * - La semanal respalda cada tienda en `respaldos/` del almacén (HU-T17.3, `respaldos.ts`); si un
 *   respaldo no cuadra con la base, avisa por Telegram con la tienda y la causa. Cada tienda tiene
 *   su hora de la semana, y la purga diaria su hora del día (`repartida`, bitácora tienda3 27).
 * - Cada hora se concilian los cobros que esperan sin aviso (HU-T11.6, `conciliar.ts`): lo que
 *   pedía 15 minutos pasa a cada hora.
 * - Cada hora sale el resumen diario de las tiendas a las que ya les toca, a la hora que eligió
 *   cada comercio (HU-T14.3, `correos.ts`).
 * - Cada hora, el freno de R2 mide lo de la cuenta y, antes de que cobre, apaga publicar y subir
 *   fotos (bitácora tienda3 27, `freno-r2.ts`).
 * - La diaria purga lo que cumplió su plazo, y nada antes (HU-T17.2): la papelera a los 30 días y
 *   las respuestas guardadas de `operacion` a las 48 horas. Las exportaciones las borra la regla de
 *   ciclo de vida del bucket a los 7 días (`docs/runbooks/tienda-ciclo-de-vida.md`).
 * - Cada día, en la hora de cada tienda, se purgan de R2 las versiones viejas de su sitio, y cada
 *   semana los objetos que ya no usa ninguna tienda (bitácora tienda3 28, `purga-de-sitios.ts`).
 * - Una tarea que sigue bien no se vuelve a anotar antes de su plazo: cada escritura del KV cuenta
 *   contra las 1.000 diarias de la cuenta (bitácora tienda3 28).
 */
import type { CorreoTransaccional } from '@ed1/correo';
import type { BaseD1 } from '@ed1/d1';
import { enviarTelegram } from '@ed1/telegram';
import { borrarLasBajas } from './baja.ts';
import { purgarComprasPendientes } from './compras-pendientes.ts';
import { CONCILIAR } from './conciliar.ts';
import { cancelarPreparadosVencidos, HORAS_PARA_CONFIRMAR } from './confirmar.ts';
import { CORREOS } from './correos.ts';
import { cuadrarTiendas, ventanaDeLaSemana } from './cuadre.ts';
import type { BucketDigital } from './digitales.ts';
import { revisarDominios } from './dominios.ts';
import { FRENO_R2 } from './freno-r2.ts';
import { claveDelHost, direccionesDelPlan, punteroDelHost } from './hosts.ts';
import { kekDelEntorno, reenvolverLlaves } from './llaves.ts';
import { limitesDeLaTienda } from './plan.ts';
import type { Almacen } from './publicar.ts';
import { barrerObjetos, mantenerSitio } from './purga-de-sitios.ts';
import { REHORNEAR_POR_RELEASE, RELEASES_VIEJAS } from './releases.ts';
import { type AlmacenDeRespaldos, respaldarTienda } from './respaldos.ts';
import type { Saas } from './saas.ts';
import { hostnamesColgantes } from './suspension.ts';
import { purgarContactos } from './titular.ts';
import { vencerLosPlanes } from './vencimiento.ts';

export type Frecuencia = 'hora' | 'dia' | 'semana';

export interface KvDeTareas {
  get(clave: string): Promise<string | null>;
  put(clave: string, valor: string): Promise<void>;
}

export interface EntornoDeTareas {
  celda: string;
  shards: [string, BaseD1][];
  control: BaseD1;
  hosts: KvDeTareas;
  flags: KvDeTareas;
  telegram: { token: string | undefined; chat: string | undefined };
  /** El almacén de la celda (`SITIOS`), donde van los respaldos; sin él, la semanal falla. */
  almacen?: AlmacenDeRespaldos;
  /** HU-P6.1: el bucket privado de los productos digitales; la baja borra sus archivos. */
  digitales?: BucketDigital;
  /** El host de las fotos (`MEDIOS`): los respaldos las nombran por su enlace. */
  medios?: string;
  /** La KEK de la celda: la conciliación descifra con ella las llaves de Bold (HU-T11.6). */
  kekTexto?: string;
  /** Para las pruebas; en el Worker, el `fetch` global. */
  fetch?: typeof fetch;
  /** Los correos de las tiendas (HU-T14.3); sin él, la tarea dice que no hay con qué enviar. */
  correo?: CorreoTransaccional;
  /** El token de solo lectura de métricas y la cuenta: el freno de R2 mide con ellos. */
  metricas?: { token: string | undefined; cuenta: string | undefined };
  /** HU-T4.6: la release de la vitrina de este despliegue; las tiendas se re-hornean con ella. */
  release?: string;
  /** HU-T13.1: Cloudflare for SaaS, para preguntar por los dominios propios que esperan. */
  saas?: Saas;
  /** HU-T14.6: el dataset de Analytics Engine de la medición de las tiendas, en este ambiente. */
  datasetDeEventos?: string;
}

export interface Tarea {
  nombre: string;
  frecuencia: Frecuencia;
  /**
   * Corre cada hora, y a cada tienda le toca una vez por su frecuencia, en su turno (`leToca`).
   * En el plan gratuito una corrida del cron tiene un tope de 50 consultas a D1 (bitácora tienda3
   * 27): con todas las tiendas en la misma hora, la purga y el respaldo dejaban de caber.
   */
  repartida?: boolean;
  /** Devuelve un resumen corto de lo que hizo; lanza si falla. */
  correr(e: EntornoDeTareas, instante: number): Promise<string>;
}

/** Hora UTC de las 3 a. m. de Bogotá (UTC−5, sin horario de verano). */
const HORA_DIARIA_UTC = 8;
const HORA_MS = 60 * 60 * 1000;
const PLAZO_MS: Record<Frecuencia, number> = {
  hora: HORA_MS,
  dia: 24 * HORA_MS,
  semana: 7 * 24 * HORA_MS,
};

/** Qué frecuencias tocan en un instante del cron por hora. */
export function tocan(instante: number): Frecuencia[] {
  const d = new Date(instante);
  const frecuencias: Frecuencia[] = ['hora'];
  if (d.getUTCHours() === HORA_DIARIA_UTC) {
    frecuencias.push('dia');
    if (d.getUTCDay() === 1) frecuencias.push('semana');
  }
  return frecuencias;
}

const HORAS_DEL_CICLO = { dia: 24, semana: 168 } as const;
export type Ciclo = keyof typeof HORAS_DEL_CICLO;
/** El 1 de enero de 1970 fue jueves: la semana del cron empieza 4 días después, un lunes. */
const LUNES_MS = 4 * 24 * HORA_MS;

/** La hora del ciclo de una tienda: siempre la misma, sacada de su id (FNV-1a de 32 bits). */
export function turnoDe(org: string, ciclo: Ciclo): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < org.length; i++) h = Math.imul(h ^ org.charCodeAt(i), 0x01000193) >>> 0;
  return h % HORAS_DEL_CICLO[ciclo];
}

/** Qué hora del ciclo es un instante: la hora UTC del día, o la de la semana desde el lunes. */
export function horaDelCiclo(instante: number, ciclo: Ciclo): number {
  const horas = Math.floor((instante - (ciclo === 'semana' ? LUNES_MS : 0)) / HORA_MS);
  const n = HORAS_DEL_CICLO[ciclo];
  return ((horas % n) + n) % n;
}

export const leToca = (org: string, instante: number, ciclo: Ciclo) =>
  turnoDe(org, ciclo) === horaDelCiclo(instante, ciclo);

/** La primera hora en punto, desde `desde`, en que le toca a una tienda. */
export function siguienteTurno(org: string, ciclo: Ciclo, desde: number): number {
  let t = Math.ceil(desde / HORA_MS) * HORA_MS;
  while (!leToca(org, t, ciclo)) t += HORA_MS;
  return t;
}

export interface Corrida {
  nombre: string;
  ok: boolean;
  resumen: string;
}

export async function despachar(
  e: EntornoDeTareas,
  instante: number,
  tareas: readonly Tarea[],
): Promise<Corrida[]> {
  const toca = new Set(tocan(instante));
  const corridas: Corrida[] = [];
  for (const t of tareas.filter((x) => x.repartida || toca.has(x.frecuencia))) {
    let corrida: Corrida;
    try {
      corrida = { nombre: t.nombre, ok: true, resumen: await t.correr(e, instante) };
    } catch (error) {
      corrida = {
        nombre: t.nombre,
        ok: false,
        resumen: error instanceof Error ? error.message : String(error),
      };
      console.error(`tienda-api: la tarea ${t.nombre} falló (${corrida.resumen})`);
    }
    corridas.push(corrida);
    try {
      if (await sinCambios(e.flags, t, corrida, instante)) continue;
      await e.flags.put(
        `tarea:${t.nombre}`,
        JSON.stringify({
          ultima: new Date(instante).toISOString(),
          ok: corrida.ok,
          resumen: corrida.resumen.slice(0, 300),
        }),
      );
    } catch (error) {
      console.error(`tienda-api: no se pudo anotar la tarea ${t.nombre} (${String(error)})`);
    }
  }
  return corridas;
}

/**
 * Una tarea que sigue bien y se anotó hace menos de su plazo no se anota otra vez: una repartida
 * corre cada hora, pero basta con que diga una vez al día, o a la semana, que está bien. Una falla, o
 * la vuelta de una falla, se anota siempre.
 */
async function sinCambios(flags: KvDeTareas, t: Tarea, corrida: Corrida, instante: number) {
  if (!corrida.ok) return false;
  const texto = await flags.get(`tarea:${t.nombre}`);
  if (!texto) return false;
  try {
    const r = JSON.parse(texto) as { ultima: string; ok: boolean };
    return r.ok && instante - Date.parse(r.ultima) < PLAZO_MS[t.frecuencia] - HOLGURA_MS;
  } catch {
    return false;
  }
}

/** Lo que un cron se puede adelantar o atrasar: una por hora se anota igual cada hora. */
const HOLGURA_MS = 5 * 60 * 1000;

/** Si cada tarea corrió a tiempo: «al-dia», «atrasada» (más del doble de su frecuencia) o «nunca». */
export async function estadoDeLasTareas(
  flags: KvDeTareas,
  tareas: readonly Tarea[],
  ahora: number,
): Promise<Record<string, 'al-dia' | 'atrasada' | 'nunca' | 'fallo'>> {
  const estado: Record<string, 'al-dia' | 'atrasada' | 'nunca' | 'fallo'> = {};
  for (const t of tareas) {
    const texto = await flags.get(`tarea:${t.nombre}`);
    if (!texto) {
      estado[t.nombre] = 'nunca';
      continue;
    }
    const r = JSON.parse(texto) as { ultima: string; ok: boolean };
    estado[t.nombre] = !r.ok
      ? 'fallo'
      : ahora - Date.parse(r.ultima) > 2 * PLAZO_MS[t.frecuencia]
        ? 'atrasada'
        : 'al-dia';
  }
  return estado;
}

/**
 * La entrada de `TIENDA_HOSTS` que debería tener cada hostname activo, desde las bases (P2): la
 * base de control dice los hostnames y el shard de cada tienda dice su versión publicada.
 */
export async function hostsEsperados(e: EntornoDeTareas): Promise<Map<string, string>> {
  const deTienda = new Map<
    string,
    { shard: string; version: number | null; estado: string; plan: string }
  >();
  for (const [nombre, db] of e.shards) {
    const { results } = await db
      .prepare('SELECT org_id, version_publicada, estado, plan FROM tienda')
      .all<{ org_id: string; version_publicada: number | null; estado: string; plan: string }>();
    for (const t of results)
      deTienda.set(t.org_id, {
        shard: nombre,
        version: t.version_publicada,
        estado: t.estado,
        plan: t.plan,
      });
  }
  const { results: todos } = await e.control
    .prepare(
      "SELECT hostname, org_id, tipo, rol FROM dominio WHERE estado = 'activo' ORDER BY hostname",
    )
    .all<{ hostname: string; org_id: string; tipo: string; rol: string }>();
  // HU-T13.5 CA3: las direcciones de cada tienda como las deja su plan.
  const porTienda = new Map<string, typeof todos>();
  for (const d of todos) porTienda.set(d.org_id, [...(porTienda.get(d.org_id) ?? []), d]);
  const canonicos = new Map<string, string>();
  const dominios: typeof todos = [];
  for (const [org, suyos] of porTienda) {
    const t = deTienda.get(org);
    const { filas, canonico } = direccionesDelPlan(suyos, limitesDeLaTienda(t?.plan).dominioPropio);
    if (canonico) canonicos.set(org, canonico);
    dominios.push(...filas);
  }
  const esperados = new Map<string, string>();
  for (const d of dominios) {
    const t = deTienda.get(d.org_id);
    if (!t) continue;
    esperados.set(
      claveDelHost(d.hostname),
      punteroDelHost({
        org: d.org_id,
        celda: e.celda,
        shard: t.shard,
        version: t.version,
        canonico: canonicos.get(d.org_id) ?? d.hostname,
        estado: t.estado,
        rol: d.rol,
      }),
    );
  }
  return esperados;
}

/** La diaria: `TIENDA_HOSTS` reconstruido desde las bases. Si difiere, gana la base y se avisa. */
export const RECONSTRUIR_HOSTS: Tarea = {
  nombre: 'reconstruir-hosts',
  frecuencia: 'dia',
  async correr(e) {
    const esperados = await hostsEsperados(e);
    const cambios: string[] = [];
    for (const [clave, valor] of esperados) {
      const actual = await e.hosts.get(clave);
      if (actual === valor) continue;
      await e.hosts.put(clave, valor);
      cambios.push(`${clave.slice(2)}: ${actual === null ? 'faltaba' : 'difería'}`);
    }
    if (cambios.length > 0) {
      const aviso = await enviarTelegram(
        e.telegram,
        `Tienda · TIENDA_HOSTS se corrigió desde la base en ${cambios.length} dirección(es):\n${cambios.slice(0, 20).join('\n')}`,
        e.fetch,
      );
      if (aviso) console.error(`tienda-api: no se pudo avisar por Telegram (${aviso})`);
    }
    return cambios.length === 0
      ? `${esperados.size} direcciones al día`
      : `${cambios.length} corregidas`;
  },
};

/** Los plazos de las purgas (TIENDA §15.3, HU-T17.2 CA1). */
export const DIAS_EN_LA_PAPELERA = 30;
export const HORAS_DE_UNA_OPERACION = 48;

/** Las tablas con papelera que nada más nombra: se purgan con su fila. */
const PAPELERA_SIMPLE = ['envio_opcion', 'cupon', 'pagina'] as const;

/**
 * Purga una tienda. El límite es un instante ISO: se va lo que se borró **en** o antes de él.
 * - Una colección se lleva sus enlaces a productos.
 * - Un producto se lleva sus variantes, fotos, enlaces, libro de inventario y «avísame», pero solo
 *   si ninguna de sus variantes está en un pedido o un apartado: lo vendido se queda en la
 *   papelera, porque el pedido nombra la variante (P21). Las fotos en R2 no se tocan aquí: son por
 *   huella y otra versión publicada puede usarlas.
 * - Un contacto de pedido cuyo `purgar_despues` ya llegó a `ahora` se va; el pedido queda, con la
 *   purga en su historia (HU-T7.3 CA2).
 */
export async function purgarTienda(
  db: BaseD1,
  org: string,
  limitePapelera: string,
  limiteOperacion: string,
  ahora: string,
): Promise<{ filas: number; retenidos: number; contactos: number }> {
  const { results: productos } = await db
    .prepare(
      `SELECT p.id,
         EXISTS (SELECT 1 FROM variante v WHERE v.org_id = ? AND v.producto_id = p.id AND (
           EXISTS (SELECT 1 FROM pedido_linea l WHERE l.org_id = ? AND l.variante_id = v.id)
           OR EXISTS (SELECT 1 FROM apartado a WHERE a.org_id = ? AND a.variante_id = v.id))) AS vendido
       FROM producto p WHERE p.org_id = ? AND p.borrado IS NOT NULL AND p.borrado <= ?`,
    )
    .bind(org, org, org, org, limitePapelera)
    .all<{ id: string; vendido: number }>();
  const purgables = productos.filter((p) => !p.vendido).map((p) => p.id);
  const ids = JSON.stringify(purgables);
  const variantes = `SELECT id FROM variante INDEXED BY variante_por_producto WHERE org_id = ? AND producto_id IN (SELECT value FROM json_each(?))`;
  const colecciones = `SELECT id FROM coleccion WHERE org_id = ? AND borrado IS NOT NULL AND borrado <= ?`;
  // Sin productos que purgar no se nombra ninguno: con la lista vacía, SQLite igual recorría las
  // combinaciones de la tienda en cada borrado (40.000 filas leídas al día, bitácora tienda3 26).
  const deProductos =
    purgables.length === 0
      ? []
      : [
          db
            .prepare(
              'DELETE FROM coleccion_producto WHERE org_id = ? AND producto_id IN (SELECT value FROM json_each(?))',
            )
            .bind(org, ids),
          db
            .prepare(
              'DELETE FROM medio WHERE org_id = ? AND producto_id IN (SELECT value FROM json_each(?))',
            )
            .bind(org, ids),
          db
            .prepare(
              `DELETE FROM interes_reposicion WHERE org_id = ? AND variante_id IN (${variantes})`,
            )
            .bind(org, org, ids),
          db
            .prepare(
              `DELETE FROM movimiento_inventario WHERE org_id = ? AND variante_id IN (${variantes})`,
            )
            .bind(org, org, ids),
          db
            .prepare(
              'DELETE FROM variante INDEXED BY variante_por_producto WHERE org_id = ? AND producto_id IN (SELECT value FROM json_each(?))',
            )
            .bind(org, ids),
          db
            .prepare(
              'DELETE FROM producto WHERE org_id = ? AND id IN (SELECT value FROM json_each(?))',
            )
            .bind(org, ids),
        ];
  const lote = [
    db
      .prepare(
        `DELETE FROM coleccion_producto WHERE org_id = ? AND coleccion_id IN (${colecciones})`,
      )
      .bind(org, org, limitePapelera),
    ...deProductos,
    db
      .prepare('DELETE FROM coleccion WHERE org_id = ? AND borrado IS NOT NULL AND borrado <= ?')
      .bind(org, limitePapelera),
    ...PAPELERA_SIMPLE.map((tabla) =>
      db
        .prepare(`DELETE FROM ${tabla} WHERE org_id = ? AND borrado IS NOT NULL AND borrado <= ?`)
        .bind(org, limitePapelera),
    ),
    db.prepare('DELETE FROM operacion WHERE org_id = ? AND creada <= ?').bind(org, limiteOperacion),
    // HU-P1.1: las compras sin terminar vencidas o que ya son un pedido.
    purgarComprasPendientes(db, org, ahora),
  ];
  const resultados = await db.batch([...lote, ...purgarContactos(db, org, ahora)]);
  return {
    filas: resultados.slice(0, lote.length).reduce((n, r) => n + (r.meta?.changes ?? 0), 0),
    retenidos: productos.filter((p) => p.vendido).length,
    contactos: resultados.at(-1)?.meta?.changes ?? 0,
  };
}

/**
 * La diaria: las purgas de cada tienda de cada shard, cada una en su hora del día. Una tienda que
 * falla no detiene a las demás.
 */
export const PURGAS: Tarea = {
  nombre: 'purgas',
  frecuencia: 'dia',
  repartida: true,
  async correr(e, instante) {
    const limitePapelera = new Date(instante - DIAS_EN_LA_PAPELERA * 24 * HORA_MS).toISOString();
    const limiteOperacion = new Date(instante - HORAS_DE_UNA_OPERACION * HORA_MS).toISOString();
    let tiendas = 0;
    let filas = 0;
    let retenidos = 0;
    let contactos = 0;
    const fallas: string[] = [];
    for (const [nombre, db] of e.shards) {
      const { results } = await db.prepare('SELECT org_id FROM tienda').all<{ org_id: string }>();
      for (const { org_id } of results) {
        if (!leToca(org_id, instante, 'dia')) continue;
        tiendas++;
        try {
          const r = await purgarTienda(
            db,
            org_id,
            limitePapelera,
            limiteOperacion,
            new Date(instante).toISOString(),
          );
          filas += r.filas;
          retenidos += r.retenidos;
          contactos += r.contactos;
        } catch (error) {
          fallas.push(
            `${nombre}/${org_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    if (fallas.length > 0) throw new Error(`purgas con fallas: ${fallas.slice(0, 5).join('; ')}`);
    if (tiendas === 0) return 'ninguna tienda tiene esta hora';
    return `${filas} filas purgadas${contactos > 0 ? `; ${contactos} contactos vencidos` : ''}${retenidos > 0 ? `; ${retenidos} productos vendidos se quedan en la papelera` : ''}`;
  },
};

/**
 * La semanal: el respaldo de cada tienda de cada shard, cada una en su hora de la semana. Una que
 * no cuadra no detiene a las demás.
 */
export const RESPALDOS: Tarea = {
  nombre: 'respaldos',
  frecuencia: 'semana',
  repartida: true,
  async correr(e, instante) {
    if (!e.almacen) throw new Error('el cron no tiene el almacén de la celda (SITIOS)');
    let hechos = 0;
    let borrados = 0;
    const fallas: string[] = [];
    for (const [nombre, db] of e.shards) {
      const { results } = await db.prepare('SELECT org_id FROM tienda').all<{ org_id: string }>();
      for (const { org_id } of results) {
        if (!leToca(org_id, instante, 'semana')) continue;
        try {
          const r = await respaldarTienda(db, org_id, e.almacen, instante, e.medios);
          hechos++;
          borrados += r.borrados;
        } catch (error) {
          fallas.push(
            `${nombre}/${org_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    if (fallas.length > 0) {
      const aviso = await enviarTelegram(
        e.telegram,
        `Tienda · ${fallas.length} respaldo(s) semanal(es) fallaron:\n${fallas.slice(0, 10).join('\n')}`,
        e.fetch,
      );
      if (aviso) console.error(`tienda-api: no se pudo avisar por Telegram (${aviso})`);
      throw new Error(`respaldos con fallas: ${fallas.slice(0, 5).join('; ')}`);
    }
    if (hechos === 0) return 'ninguna tienda tiene esta hora';
    return `${hechos} tiendas respaldadas${borrados > 0 ? `; ${borrados} respaldos viejos borrados` : ''}`;
  },
};

/**
 * La diaria del sitio horneado: a cada tienda, en su hora del día, se le pone al día el índice de lo
 * que usa su sitio y se purgan sus versiones viejas de R2 (TIENDA §351, bitácora tienda3 28).
 */
export const VERSIONES_DEL_SITIO: Tarea = {
  nombre: 'versiones-del-sitio',
  frecuencia: 'dia',
  repartida: true,
  async correr(e, instante) {
    if (!e.almacen) throw new Error('el cron no tiene el almacén de la celda (SITIOS)');
    let tiendas = 0;
    let purgadas = 0;
    const atrasadas: string[] = [];
    const fallas: string[] = [];
    for (const [nombre, db] of e.shards) {
      const { results } = await db.prepare('SELECT org_id FROM tienda').all<{ org_id: string }>();
      for (const { org_id } of results) {
        if (!leToca(org_id, instante, 'dia')) continue;
        tiendas++;
        try {
          const r = await mantenerSitio(db, org_id, e.almacen, instante);
          purgadas += r.purgadas;
          if (!r.alDia) atrasadas.push(org_id);
        } catch (error) {
          fallas.push(
            `${nombre}/${org_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    if (fallas.length > 0)
      throw new Error(`versiones del sitio con fallas: ${fallas.slice(0, 5).join('; ')}`);
    if (tiendas === 0) return 'ninguna tienda tiene esta hora';
    return `${purgadas} versiones viejas purgadas${atrasadas.length > 0 ? `; con versiones por leer: ${atrasadas.slice(0, 5).join(', ')}` : ''}`;
  },
};

/**
 * La semanal del sitio horneado: los objetos de R2 que no usa ninguna tienda de la celda. Si no
 * puede saber con certeza qué se usa, no borra nada y lo dice (bitácora tienda3 28).
 */
export const OBJETOS_SIN_USO: Tarea = {
  nombre: 'objetos-sin-uso',
  frecuencia: 'semana',
  async correr(e, instante) {
    if (!e.almacen) throw new Error('el cron no tiene el almacén de la celda (SITIOS)');
    const r = await barrerObjetos(e.almacen, instante);
    if (r.estado === 'sin-barrer') return `no barrí: ${r.motivo}`;
    return `${r.borrados} de ${r.revisados} objetos borrados${r.incompleto ? '; quedaron objetos sin revisar' : ''}`;
  },
};

/**
 * HU-T17.6 CA1: cada hora, si el Worker tiene una KEK nueva, reenvuelve con ella unas pocas DEK de
 * cada shard; el despliegue hace lo mismo al cargarla. Con una sola KEK no lee nada.
 */
export const REENVOLVER_LLAVES: Tarea = {
  nombre: 'reenvolver-llaves',
  frecuencia: 'hora',
  async correr(e) {
    const kek = await kekDelEntorno(e.kekTexto);
    if (!kek) return 'sin KEK: nada que reenvolver';
    if (kek.todas.size === 1) return `solo está ${kek.id}: nada que reenvolver`;
    let reenvueltas = 0;
    for (const [, db] of e.shards) reenvueltas += (await reenvolverLlaves(db, kek)).reenvueltas;
    return `${reenvueltas} llaves reenvueltas con ${kek.id}`;
  },
};

/**
 * HU-T13.1 CA2: cada hora, el estado de los dominios propios que esperan a Cloudflare; los que se
 * activan entran a `TIENDA_HOSTS`. Es la hora del cron de la Tienda (D-T10), no cada 5 minutos: la
 * pantalla del dominio pregunta al abrirse, y eso es lo que mira el comercio (bitácora tienda3 34).
 */
export const DOMINIOS: Tarea = {
  nombre: 'dominios',
  frecuencia: 'hora',
  async correr(e, instante) {
    if (!e.saas) return 'sin Cloudflare for SaaS: nada que revisar';
    const r = await revisarDominios({
      control: e.control,
      shards: e.shards,
      celda: e.celda,
      hosts: e.hosts,
      saas: e.saas,
      instante: new Date(instante).toISOString(),
    });
    if (r.fallas.length > 0)
      throw new Error(`dominios con fallas: ${r.fallas.slice(0, 5).join('; ')}`);
    return `${r.revisados} dominios revisados, ${r.activados} activados`;
  },
};

/**
 * HU-T13.6 CA2: cada día, los dominios propios retirados que todavía apuntan su CNAME aquí. Avisa
 * por Telegram; nadie los puede tomar sin su TXT nuevo, pero el comercio debería borrar el registro.
 */
export const HOSTNAMES_COLGANTES: Tarea = {
  nombre: 'hostnames-colgantes',
  frecuencia: 'dia',
  async correr(e) {
    const r = await hostnamesColgantes(e.control, e.fetch ?? ((u, i) => fetch(u, i)));
    if (r.colgantes.length > 0) {
      const aviso = await enviarTelegram(
        e.telegram,
        `Tienda · ${r.colgantes.length} dominio(s) retirado(s) siguen apuntando aquí. Pídele al comercio que borre su CNAME:\n${r.colgantes.join('\n')}`,
        e.fetch,
      );
      if (aviso) console.error(`tienda-api: no se pudo avisar por Telegram (${aviso})`);
    }
    return `${r.revisados} retirados revisados, ${r.colgantes.length} siguen apuntando aquí`;
  },
};

/** HU-T13.7: a los 30 días de la baja, el borrado criptográfico y los respaldos de la tienda. */
export const BAJAS: Tarea = {
  nombre: 'bajas',
  frecuencia: 'dia',
  async correr(e, instante) {
    const r = await borrarLasBajas({
      shards: e.shards,
      ...(e.almacen ? { almacen: e.almacen } : {}),
      ...(e.digitales ? { digitales: e.digitales } : {}),
      instante: new Date(instante).toISOString(),
    });
    return r.borradas.length > 0
      ? `${r.borradas.length} tienda(s) dadas de baja: sus llaves de datos personales y sus respaldos, borrados`
      : 'ninguna baja por borrar';
  },
};

/**
 * HU-T13.5 CA3: cada hora, las tiendas cuyo plan venció con su gracia pasan al gratuito, aunque el
 * comercio no abra el panel: lo que pasa del límite se oculta, el cobro en línea se apaga y el
 * dominio propio redirige a la dirección de la plataforma. Nada se borra.
 */
export const PLANES_VENCIDOS: Tarea = {
  nombre: 'planes-vencidos',
  frecuencia: 'hora',
  async correr(e, instante) {
    const r = await vencerLosPlanes({
      shards: e.shards,
      control: e.control,
      hosts: e.hosts,
      celda: e.celda,
      instante: new Date(instante).toISOString(),
      ...(e.almacen && e.release
        ? { sitios: e.almacen as unknown as Almacen, release: e.release }
        : {}),
      ...(e.medios ? { medios: e.medios } : {}),
    });
    if (r.fallas.length > 0)
      throw new Error(`planes vencidos que no se re-hornearon: ${r.fallas.slice(0, 5).join('; ')}`);
    return r.vencidas.length > 0
      ? `${r.vencidas.length} tienda(s) pasaron al plan gratuito`
      : 'ningún plan vencido';
  },
};

/**
 * HU-T14.6 CA1: cada semana, en el turno de cada tienda, sus pedidos y pagos de la base frente a lo
 * que contó la medición de su vitrina, los 7 días anteriores. Una consulta a Analytics Engine por
 * shard y vuelta; dos lecturas de la base por tienda. El tablero muestra el último cuadre.
 */
export const CUADRE_DE_EVENTOS: Tarea = {
  nombre: 'cuadre-de-eventos',
  frecuencia: 'semana',
  repartida: true,
  async correr(e, instante) {
    const token = e.metricas?.token;
    const cuenta = e.metricas?.cuenta;
    if (!token || !cuenta || !e.datasetDeEventos)
      return 'sin el token de métricas o el dataset: nada que cuadrar';
    const v = ventanaDeLaSemana(instante);
    const m = {
      token,
      cuenta,
      dataset: e.datasetDeEventos,
      fetch: e.fetch ?? ((u: RequestInfo | URL, i?: RequestInit) => fetch(u, i)),
    };
    let cuadradas = 0;
    for (const [, db] of e.shards) {
      const { results } = await db
        .prepare("SELECT org_id FROM tienda WHERE estado IN ('abierta', 'suspendida')")
        .all<{ org_id: string }>();
      const orgs = results.map((t) => t.org_id).filter((o) => leToca(o, instante, 'semana'));
      cuadradas += (await cuadrarTiendas(db, orgs, m, instante)).length;
    }
    return `${cuadradas} tienda(s) cuadradas, semana del ${v.semana}`;
  },
};

/**
 * HU-T15.5 CA2: cada hora, los pedidos que preparó un asistente y nadie confirmó en 48 horas se
 * cancelan. Una sentencia por shard, sobre el índice parcial de los que esperan.
 */
export const PREPARADOS_VENCIDOS: Tarea = {
  nombre: 'preparados-vencidos',
  frecuencia: 'hora',
  async correr(e, instante) {
    let n = 0;
    for (const [, db] of e.shards)
      n += await cancelarPreparadosVencidos(db, new Date(instante).toISOString());
    return n > 0
      ? `${n} pedido(s) preparados sin confirmar en ${HORAS_PARA_CONFIRMAR} h, cancelados`
      : 'ningún preparado vencido';
  },
};

export const TAREAS: readonly Tarea[] = [
  RECONSTRUIR_HOSTS,
  PURGAS,
  RESPALDOS,
  VERSIONES_DEL_SITIO,
  OBJETOS_SIN_USO,
  CONCILIAR,
  CORREOS,
  FRENO_R2,
  REHORNEAR_POR_RELEASE,
  RELEASES_VIEJAS,
  REENVOLVER_LLAVES,
  DOMINIOS,
  HOSTNAMES_COLGANTES,
  BAJAS,
  PLANES_VENCIDOS,
  CUADRE_DE_EVENTOS,
  PREPARADOS_VENCIDOS,
];
