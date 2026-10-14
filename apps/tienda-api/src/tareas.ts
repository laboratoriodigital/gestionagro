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
 */
import type { BaseD1 } from '@ed1/d1';
import { enviarTelegram } from '@ed1/telegram';

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
  /** Para las pruebas; en el Worker, el `fetch` global. */
  fetch?: typeof fetch;
}

export interface Tarea {
  nombre: string;
  frecuencia: Frecuencia;
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
  for (const t of tareas.filter((x) => toca.has(x.frecuencia))) {
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
  const deTienda = new Map<string, { shard: string; version: number | null; estado: string }>();
  for (const [nombre, db] of e.shards) {
    const { results } = await db
      .prepare('SELECT org_id, version_publicada, estado FROM tienda')
      .all<{ org_id: string; version_publicada: number | null; estado: string }>();
    for (const t of results)
      deTienda.set(t.org_id, { shard: nombre, version: t.version_publicada, estado: t.estado });
  }
  const { results: dominios } = await e.control
    .prepare("SELECT hostname, org_id, rol FROM dominio WHERE estado = 'activo' ORDER BY hostname")
    .all<{ hostname: string; org_id: string; rol: string }>();
  const canonicos = new Map(
    dominios.filter((d) => d.rol === 'canonico').map((d) => [d.org_id, d.hostname]),
  );
  const esperados = new Map<string, string>();
  for (const d of dominios) {
    const t = deTienda.get(d.org_id);
    if (!t) continue;
    esperados.set(
      `h:${d.hostname}`,
      JSON.stringify({
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

export const TAREAS: readonly Tarea[] = [RECONSTRUIR_HOSTS];
