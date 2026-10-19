/**
 * El dominio propio de una tienda (HU-T13.1, HU-T13.2 y HU-T13.3; TIENDA-3.0 §4.2 a §4.4).
 *
 * 1. **Conectar:** el comercio escribe `www.midominio.co`; se crea el hostname en Cloudflare for
 *    SaaS con prevalidación y propiedad por TXT, y la fila queda `pendiente` en la base de control
 *    con los TXT que pidió Cloudflare. Nace como **alias**: hasta que el comercio lo elija canónico,
 *    responde 301 a la dirección de la plataforma, así Google ve una sola.
 * 2. **Esperar:** la pantalla, al abrirse, y la tarea de cada hora preguntan a Cloudflare. El estado
 *    pasa a `validando` y a `activo`, o a `error` con su motivo en palabras (P1). Al activarse, su
 *    dirección entra a `TIENDA_HOSTS`.
 * 3. **Canónico (HU-T13.2):** el comercio elige el dominio activo como canónico; la dirección de la
 *    plataforma pasa a alias, y lo publicado se vuelve a hornear con el canónico nuevo.
 * 4. **Retirar:** se borra de Cloudflare y la fila queda `retirado`, sin borrarse (§4.4). Otra tienda
 *    que lo pida después vuelve a probar la propiedad por TXT: nunca hereda la validación (CA3).
 *
 * La base de control y el shard son bases distintas: la fila del dominio va en una y el registro y
 * la operación en la otra. Repetir la misma `op`, o conectar otra vez el mismo hostname, no crea
 * nada nuevo.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  ESTADO_EN_PALABRAS,
  type EstadoDelDominio,
  leerDominio,
  type Registro,
  registrosDelDominio,
  type Validacion,
} from '@ed1/tienda-schema/dominios';
import { z } from 'zod';
import { guardarOperacion, type Problema, type Quien, yaAplicada } from './catalogo.ts';
import { claveDelHost, punteroDelHost } from './hosts.ts';
import { anotar } from './registro.ts';
import {
  borrarHostname,
  CODIGO_DUPLICADO,
  crearHostname,
  ErrorDeSaas,
  estadoDe,
  leerHostname,
  type Saas,
  validacionDe,
} from './saas.ts';

/** Lo que se usa del KV `TIENDA_HOSTS`: escribir y borrar una dirección. */
export interface KvDeHosts {
  put(clave: string, valor: string): Promise<void>;
  delete(clave: string): Promise<void>;
}

/** Quien administra el dominio: el shard de la tienda, la base de control y el KV del despacho. */
export interface QuienDelDominio extends Quien {
  control: BaseD1;
  celda: string;
  shardNombre: string;
  hosts: KvDeHosts;
}

/** Los dominios propios que puede tener una tienda: el de «www» y su raíz (HU-T13.3). */
export const DOMINIOS_PROPIOS_POR_TIENDA = 2;
/** Cuántos pregunta a Cloudflare la pantalla al abrirse, y la tarea por vuelta. */
export const CONSULTAS_POR_PANTALLA = 2;
export const CONSULTAS_POR_VUELTA = 20;

export interface FilaDeDominio {
  hostname: string;
  org_id: string;
  tipo: 'plataforma' | 'propio';
  rol: 'canonico' | 'alias';
  estado: EstadoDelDominio;
  cf_hostname_id: string | null;
  validacion: string | null;
  motivo: string | null;
  creado: string;
  activado: string | null;
}

export interface DominioDelPanel {
  hostname: string;
  tipo: 'plataforma' | 'propio';
  rol: 'canonico' | 'alias';
  estado: EstadoDelDominio;
  enPalabras: string;
  motivo: string | null;
  registros: Registro[];
  activado: string | null;
}

const COLUMNAS =
  'hostname, org_id, tipo, rol, estado, cf_hostname_id, validacion, motivo, creado, activado';

const validacionDeLaFila = (f: FilaDeDominio): Validacion => {
  try {
    return f.validacion
      ? (JSON.parse(f.validacion) as Validacion)
      : { propiedad: null, certificado: [] };
  } catch {
    return { propiedad: null, certificado: [] };
  }
};

export const paraElPanel = (f: FilaDeDominio): DominioDelPanel => ({
  hostname: f.hostname,
  tipo: f.tipo,
  rol: f.rol,
  estado: f.estado,
  enPalabras: ESTADO_EN_PALABRAS[f.estado],
  motivo: f.motivo,
  // Los registros se muestran mientras se esperan; activo, ya no hacen falta.
  registros:
    f.tipo === 'propio' && (f.estado === 'pendiente' || f.estado === 'validando')
      ? registrosDelDominio(f.hostname, validacionDeLaFila(f))
      : [],
  activado: f.activado,
});

async function filasDeLaTienda(control: BaseD1, org: string): Promise<FilaDeDominio[]> {
  const { results } = await control
    .prepare(
      `SELECT ${COLUMNAS} FROM dominio INDEXED BY dominio_por_tienda WHERE org_id = ? ORDER BY tipo, creado`,
    )
    .bind(org)
    .all<FilaDeDominio>();
  return results;
}

/** La entrada de `TIENDA_HOSTS` de cada dirección activa de la tienda, con su canónica de ahora. */
export async function apuntarLaTienda(
  q: Omit<QuienDelDominio, 'hosts'> & { hosts: Pick<KvDeHosts, 'put'> },
): Promise<void> {
  const tienda = await q.db
    .prepare('SELECT version_publicada, estado FROM tienda WHERE org_id = ?')
    .bind(q.org)
    .first<{ version_publicada: number | null; estado: string }>();
  if (!tienda) return;
  const activas = (await filasDeLaTienda(q.control, q.org)).filter((f) => f.estado === 'activo');
  const canonico = activas.find((f) => f.rol === 'canonico')?.hostname;
  for (const f of activas) {
    await q.hosts.put(
      claveDelHost(f.hostname),
      punteroDelHost({
        org: q.org,
        celda: q.celda,
        shard: q.shardNombre,
        version: tienda.version_publicada,
        canonico,
        estado: tienda.estado,
        rol: f.rol,
      }),
    );
  }
}

/**
 * Pregunta a Cloudflare por un dominio que espera y guarda lo que cambió. Devuelve la fila como
 * quedó, y si se activó en esta vuelta.
 */
export async function actualizarDominio(
  control: BaseD1,
  saas: Saas,
  f: FilaDeDominio,
  instante: string,
): Promise<{ fila: FilaDeDominio; seActivo: boolean }> {
  if (!f.cf_hostname_id || (f.estado !== 'pendiente' && f.estado !== 'validando'))
    return { fila: f, seActivo: false };
  const h = await leerHostname(saas, f.cf_hostname_id);
  const { estado, motivo } = estadoDe(h);
  const validacion = JSON.stringify(validacionDe(h));
  if (estado === f.estado && motivo === f.motivo && validacion === f.validacion)
    return { fila: f, seActivo: false };
  const activado = estado === 'activo' ? instante : null;
  // Solo si sigue como se leyó: un retiro a la vez no se pisa.
  await control
    .prepare(
      `UPDATE dominio SET estado = ?, motivo = ?, validacion = ?, activado = ?
        WHERE hostname = ? AND org_id = ? AND estado = ?`,
    )
    .bind(estado, motivo, validacion, activado, f.hostname, f.org_id, f.estado)
    .run();
  return {
    fila: { ...f, estado, motivo, validacion, activado },
    seActivo: estado === 'activo',
  };
}

/** CA2: los dominios de la tienda; al abrir la pantalla, pregunta por los que esperan. */
export async function listarDominios(
  q: QuienDelDominio,
  saas: Saas | null,
): Promise<{ disponible: boolean; dominios: DominioDelPanel[] }> {
  const filas = await filasDeLaTienda(q.control, q.org);
  let consultadas = 0;
  let activados = false;
  const salida: FilaDeDominio[] = [];
  for (const f of filas) {
    if (saas && consultadas < CONSULTAS_POR_PANTALLA && f.cf_hostname_id && f.estado !== 'activo') {
      if (f.estado === 'pendiente' || f.estado === 'validando') {
        consultadas++;
        try {
          const r = await actualizarDominio(q.control, saas, f, q.instante);
          activados ||= r.seActivo;
          salida.push(r.fila);
          continue;
        } catch (e) {
          console.error(`tienda-api: Cloudflare no dijo el estado de un dominio (${String(e)})`);
        }
      }
    }
    salida.push(f);
  }
  if (activados) await apuntarLaTienda(q);
  return {
    disponible: saas !== null,
    dominios: salida.filter((f) => f.estado !== 'retirado').map(paraElPanel),
  };
}

const Conectar = z.object({ op: z.string().min(8).max(64), hostname: z.string().max(300) });
const DelDominio = z.object({ op: z.string().min(8).max(64), hostname: z.string().max(253) });

export type ResultadoDelDominio =
  | { estado: 'guardado'; id: string; version: number; dominio?: DominioDelPanel }
  | { estado: 'problemas'; problemas: Problema[] }
  | { estado: 'no-existe'; motivo: string }
  | { estado: 'sin-configurar'; motivo: string }
  | { estado: 'sin-respuesta'; motivo: string };

export const NO_DISPONIBLE =
  'Conectar un dominio propio todavía no está disponible. Tu tienda sigue en su dirección de siempre.';
const problema = (mensaje: string): ResultadoDelDominio => ({
  estado: 'problemas',
  problemas: [{ campo: 'hostname', mensaje }],
});

const anotarEnLaTienda = async (
  q: QuienDelDominio,
  accion: string,
  hostname: string,
  despues: Record<string, unknown>,
  op: string,
  ruta: string,
  r: ResultadoDelDominio,
) =>
  q.db.batch([
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion,
      entidad: 'dominio',
      entidadId: hostname,
      antes: null,
      despues: { hostname, ...despues },
      instante: q.instante,
    }),
    guardarOperacion(q, op, ruta, r),
  ]);

/** CA1 y CA3: conectar un dominio propio. */
export async function conectarDominio(
  q: QuienDelDominio,
  saas: Saas | null,
  cuerpo: unknown,
): Promise<ResultadoDelDominio> {
  const r0 = Conectar.safeParse(cuerpo);
  if (!r0.success) return problema('Escribe la dirección de tu tienda, como www.midominio.co.');
  const previa = await yaAplicada<ResultadoDelDominio>(q, r0.data.op);
  if (previa) return previa;
  const leido = leerDominio(r0.data.hostname);
  if (!leido.ok) return problema(leido.motivo);
  if (!saas) return { estado: 'sin-configurar', motivo: NO_DISPONIBLE };
  const hostname = leido.hostname;
  const propias = (await filasDeLaTienda(q.control, q.org)).filter(
    (f) => f.tipo === 'propio' && f.estado !== 'retirado',
  );
  const ya = propias.find((f) => f.hostname === hostname);
  if (ya) return { estado: 'guardado', id: hostname, version: 1, dominio: paraElPanel(ya) };
  if (propias.length >= DOMINIOS_PROPIOS_POR_TIENDA) {
    return problema(
      'Tu tienda ya tiene sus dos direcciones propias (con «www» y sin ella). Desconecta una para conectar otra.',
    );
  }
  const deOtra = await q.control
    .prepare('SELECT org_id, estado FROM dominio WHERE hostname = ?')
    .bind(hostname)
    .first<{ org_id: string; estado: string }>();
  if (deOtra && deOtra.estado !== 'retirado') {
    return problema('Esa dirección ya está conectada a otra tienda. Si es tuya, escríbenos.');
  }
  let h: Awaited<ReturnType<typeof crearHostname>>;
  try {
    h = await crearHostname(saas, hostname);
  } catch (e) {
    if (e instanceof ErrorDeSaas && e.codigos.includes(CODIGO_DUPLICADO)) {
      return problema(
        'Esa dirección ya está conectada en Cloudflare a otra cuenta. Si es tuya, quítala de allí y vuelve a intentarlo.',
      );
    }
    console.error(`tienda-api: Cloudflare no creó el dominio (${String(e)})`);
    return {
      estado: 'sin-respuesta',
      motivo: 'No pudimos conectar el dominio ahora. Vuelve a intentarlo en unos minutos.',
    };
  }
  const { estado, motivo } = estadoDe(h);
  // P1: nada nace activo, aunque Cloudflare lo diga, hasta pasar por la consulta de la pantalla.
  const inicial = estado === 'error' ? 'error' : 'pendiente';
  const validacion = JSON.stringify(validacionDe(h));
  // CA3: un hostname retirado se vuelve a tomar solo con la validación nueva; uno de otra tienda
  // que no está retirado, nunca (el WHERE del conflicto lo impide aunque lleguen a la vez).
  const fila = await q.control
    .prepare(
      `INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, cf_hostname_id, validacion, motivo, creado)
       VALUES (?, ?, ?, 'propio', 'alias', ?, ?, ?, ?, ?)
       ON CONFLICT (hostname) DO UPDATE SET org_id = excluded.org_id, celda_id = excluded.celda_id,
         tipo = 'propio', rol = 'alias', estado = excluded.estado, cf_hostname_id = excluded.cf_hostname_id,
         validacion = excluded.validacion, motivo = excluded.motivo, creado = excluded.creado,
         activado = NULL, retirado = NULL
       WHERE dominio.estado = 'retirado'
       RETURNING ${COLUMNAS}`,
    )
    .bind(hostname, q.org, q.celda, inicial, h.id, validacion, motivo, q.instante)
    .first<FilaDeDominio>();
  if (!fila) {
    await borrarHostname(saas, h.id).catch(() => undefined);
    return problema('Esa dirección ya está conectada a otra tienda. Si es tuya, escríbenos.');
  }
  const r: ResultadoDelDominio = {
    estado: 'guardado',
    id: hostname,
    version: 1,
    dominio: paraElPanel(fila),
  };
  await anotarEnLaTienda(q, 'dominio.conectar', hostname, {}, r0.data.op, 'dominios/conectar', r);
  return r;
}

/** HU-T13.2 CA1: el dominio activo pasa a canónico, y la dirección que lo era, a alias. */
export async function elegirCanonico(
  q: QuienDelDominio,
  cuerpo: unknown,
): Promise<ResultadoDelDominio & { cambio?: boolean }> {
  const r0 = DelDominio.safeParse(cuerpo);
  if (!r0.success) return problema('Falta qué dirección será la principal.');
  const previa = await yaAplicada<ResultadoDelDominio>(q, r0.data.op);
  if (previa) return previa;
  const filas = await filasDeLaTienda(q.control, q.org);
  const elegida = filas.find((f) => f.hostname === r0.data.hostname && f.estado === 'activo');
  if (!elegida) {
    return {
      estado: 'no-existe',
      motivo: 'Esa dirección todavía no está conectada: espera a que diga «Conectado».',
    };
  }
  const r: ResultadoDelDominio = { estado: 'guardado', id: elegida.hostname, version: 1 };
  if (elegida.rol === 'canonico') return { ...r, cambio: false };
  await q.control.batch([
    q.control
      .prepare(
        "UPDATE dominio SET rol = 'alias' WHERE org_id = ? AND rol = 'canonico' AND estado = 'activo'",
      )
      .bind(q.org),
    q.control
      .prepare(
        "UPDATE dominio SET rol = 'canonico' WHERE hostname = ? AND org_id = ? AND estado = 'activo'",
      )
      .bind(elegida.hostname, q.org),
  ]);
  await apuntarLaTienda(q);
  await anotarEnLaTienda(
    q,
    'dominio.canonico',
    elegida.hostname,
    {},
    r0.data.op,
    'dominios/canonico',
    r,
  );
  return { ...r, cambio: true };
}

/**
 * Desconectar un dominio propio: se borra de Cloudflare, la fila queda `retirado` y su dirección
 * sale de `TIENDA_HOSTS`. Si era el canónico, la dirección de la plataforma lo vuelve a ser.
 */
export async function retirarDominio(
  q: QuienDelDominio,
  saas: Saas | null,
  cuerpo: unknown,
): Promise<ResultadoDelDominio & { eraCanonico?: boolean }> {
  const r0 = DelDominio.safeParse(cuerpo);
  if (!r0.success) return problema('Falta qué dirección desconectar.');
  const previa = await yaAplicada<ResultadoDelDominio>(q, r0.data.op);
  if (previa) return previa;
  const f = (await filasDeLaTienda(q.control, q.org)).find(
    (d) => d.hostname === r0.data.hostname && d.tipo === 'propio' && d.estado !== 'retirado',
  );
  if (!f) return { estado: 'no-existe', motivo: 'Esa dirección ya no está conectada.' };
  if (!saas) return { estado: 'sin-configurar', motivo: NO_DISPONIBLE };
  if (f.cf_hostname_id) {
    try {
      await borrarHostname(saas, f.cf_hostname_id);
    } catch (e) {
      console.error(`tienda-api: Cloudflare no borró el dominio (${String(e)})`);
      return {
        estado: 'sin-respuesta',
        motivo: 'No pudimos desconectar el dominio ahora. Vuelve a intentarlo en unos minutos.',
      };
    }
  }
  const eraCanonico = f.rol === 'canonico' && f.estado === 'activo';
  await q.control.batch([
    q.control
      .prepare(
        "UPDATE dominio SET estado = 'retirado', rol = 'alias', retirado = ?, cf_hostname_id = NULL WHERE hostname = ? AND org_id = ?",
      )
      .bind(q.instante, f.hostname, q.org),
    // La plataforma vuelve a ser la canónica si no queda otra.
    q.control
      .prepare(
        `UPDATE dominio SET rol = 'canonico' WHERE org_id = ? AND tipo = 'plataforma' AND estado = 'activo'
           AND NOT EXISTS (SELECT 1 FROM dominio WHERE org_id = ? AND rol = 'canonico' AND estado = 'activo')`,
      )
      .bind(q.org, q.org),
  ]);
  await q.hosts.delete(claveDelHost(f.hostname));
  await apuntarLaTienda(q);
  const r: ResultadoDelDominio = { estado: 'guardado', id: f.hostname, version: 1 };
  await anotarEnLaTienda(q, 'dominio.retirar', f.hostname, {}, r0.data.op, 'dominios/retirar', r);
  return { ...r, eraCanonico };
}

/**
 * La tarea de cada hora: pregunta a Cloudflare por los dominios que esperan, de los más viejos a
 * los más nuevos, y apunta en `TIENDA_HOSTS` los que se activaron. Devuelve cuántos cambiaron.
 */
export async function revisarDominios(e: {
  control: BaseD1;
  shards: [string, BaseD1][];
  celda: string;
  hosts: Pick<KvDeHosts, 'put'>;
  saas: Saas;
  instante: string;
}): Promise<{ revisados: number; activados: number; fallas: string[] }> {
  const { results } = await e.control
    .prepare(
      `SELECT ${COLUMNAS} FROM dominio INDEXED BY dominio_por_validar
        WHERE estado IN ('pendiente', 'validando') ORDER BY creado LIMIT ?`,
    )
    .bind(CONSULTAS_POR_VUELTA)
    .all<FilaDeDominio>();
  let activados = 0;
  const fallas: string[] = [];
  for (const f of results) {
    try {
      const r = await actualizarDominio(e.control, e.saas, f, e.instante);
      if (!r.seActivo) continue;
      activados++;
      for (const [nombre, db] of e.shards) {
        const tiene = await db
          .prepare('SELECT 1 AS si FROM tienda WHERE org_id = ?')
          .bind(f.org_id)
          .first<{ si: number }>();
        if (!tiene) continue;
        await apuntarLaTienda({
          db,
          org: f.org_id,
          actor: 'sistema:dominios',
          instante: e.instante,
          control: e.control,
          celda: e.celda,
          shardNombre: nombre,
          hosts: e.hosts,
        });
        break;
      }
    } catch (error) {
      fallas.push(`${f.hostname}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { revisados: results.length, activados, fallas };
}
