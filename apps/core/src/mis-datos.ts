/**
 * Tus datos (HU-C7.7, Ley 1581 de 2012, ED1 §20.1 [D5]: cada obligación legal, un control técnico).
 *
 * - **Descargar mis datos** (CA1): un JSON con lo que el CORE guarda de la persona. Sale solo del
 *   `sub` de su token de la cuenta: nunca de un id en el cuerpo (CA4).
 * - **Radicar** una consulta, un reclamo o una supresión (CA2): número y fecha límite en días
 *   hábiles de Colombia con sus festivos (`@ed1/calendario`, P2): consulta 10, reclamo y supresión
 *   15. Le llega al dueño por Telegram; si el aviso no sale, el cron del CORE lo reintenta.
 * - **La supresión no borra en el acto** (CA3): la atiende una persona, y lo que la ley obliga a
 *   conservar (los pagos) se conserva. La respuesta lo dice.
 */
import { fechaEnBogota, sumarDiasHabiles } from '@ed1/calendario';
import type { BaseD1 } from '@ed1/d1';
import { enviarTelegram, type Telegram } from '@ed1/telegram';
import type { Context } from 'hono';
import type { Entorno } from './entrar.ts';
import { deLaCuenta } from './mi-cuenta.ts';
import { rolAdministra } from './productos.ts';

export type TipoDeRadicado = 'consulta' | 'reclamo' | 'supresion';
/** Días hábiles de la Ley 1581: art. 14 (consultas) y art. 15 (reclamos, también la supresión). */
export const PLAZO_EN_DIAS_HABILES: Readonly<Record<TipoDeRadicado, number>> = {
  consulta: 10,
  reclamo: 15,
  supresion: 15,
};
const NOMBRE: Readonly<Record<TipoDeRadicado, string>> = {
  consulta: 'consulta',
  reclamo: 'reclamo',
  supresion: 'solicitud de supresión',
};
const iso = (ms: number) => new Date(ms).toISOString();

/** «12 nov 2026» desde `AAAA-MM-DD`, sin pasar por un huso. */
const fechaLarga = (f: string) => {
  const meses = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sept',
    'oct',
    'nov',
    'dic',
  ];
  return `${Number(f.slice(8, 10))} ${meses[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`;
};

/** CA1: todo lo que el CORE guarda de esta persona, por su `sub`. */
export async function misDatos(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const yo = r.sub;
  const todas = async <T>(sql: string, ...valores: unknown[]) =>
    (
      await e.db
        .prepare(sql)
        .bind(...valores)
        .all<T>()
    ).results;
  const persona = await e.db
    .prepare('SELECT id, nombre, email, creado FROM usuario WHERE id = ?')
    .bind(yo)
    .first();
  const membresias = await todas<{
    org_id: string;
    espacio: string;
    producto: string;
    rol: string;
    creado: string;
  }>(
    `SELECT m.org_id, o.nombre AS espacio, o.producto, m.rol, m.creado
       FROM membresia m JOIN organizacion o ON o.id = m.org_id WHERE m.usuario_id = ?`,
    yo,
  );
  const administra = membresias
    .filter((m) => rolAdministra(e.catalogo, m.producto, m.rol))
    .map((m) => m.org_id);
  c.header('cache-control', 'no-store');
  return c.json({
    generado: iso(e.ahora()),
    explicacion:
      'Lo que Laboratorio Digital guarda de ti en tu cuenta. Lo que anotas en cada aplicación (por ejemplo, los registros de tu finca) se descarga desde esa aplicación.',
    persona,
    identidades: await todas('SELECT proveedor, sub FROM identidad WHERE usuario_id = ?', yo),
    espacios: membresias,
    aceptaciones_de_politica: await todas(
      'SELECT producto, version, aceptada FROM aceptacion_politica WHERE usuario_id = ?',
      yo,
    ),
    sesiones: await todas(
      'SELECT producto, dispositivo, creado, expira, revocado FROM sesion WHERE usuario_id = ?',
      yo,
    ),
    pagos_de_lo_que_administras:
      administra.length > 0
        ? await todas(
            `SELECT org_id, producto, plan, meses, monto_cop, estado, creado, periodo_desde, periodo_hasta
               FROM pago WHERE org_id IN (${administra.map(() => '?').join(', ')})`,
            ...administra,
          )
        : [],
    asistentes_con_acceso: await todas(
      'SELECT cliente_id, org_id, recurso, alcances, creada, revocada, ultimo_uso FROM concesion_oauth WHERE usuario_id = ?',
      yo,
    ),
    solicitudes: await todas(
      'SELECT numero, tipo, texto, creado, vence, estado FROM radicado_datos WHERE usuario_id = ?',
      yo,
    ),
  });
}

/** Envía el aviso del radicado al dueño y lo marca; si falla, queda para el cron. */
export async function avisarRadicado(
  db: BaseD1,
  telegram: Telegram,
  radicado: { id: string; numero: string; tipo: TipoDeRadicado; vence: string },
  ahora: number,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  // El texto de la persona no viaja a Telegram: solo el número, el tipo y el plazo (P13).
  const fallo = await enviarTelegram(
    telegram,
    `Nuevo radicado de datos personales ${radicado.numero}: ${NOMBRE[radicado.tipo]}. Responder a más tardar el ${fechaLarga(radicado.vence)} (Ley 1581).`,
    fetchFn,
  );
  if (!fallo) {
    await db
      .prepare('UPDATE radicado_datos SET avisado = ? WHERE id = ? AND avisado IS NULL')
      .bind(iso(ahora), radicado.id)
      .run();
  }
  return fallo;
}

/** El cron: los radicados cuyo aviso no salió. Devuelve cuántos salieron. */
export async function reintentarAvisos(
  db: BaseD1,
  telegram: Telegram,
  ahora: number,
  fetchFn: typeof fetch = fetch,
): Promise<number> {
  const { results } = await db
    .prepare(
      'SELECT id, numero, tipo, vence FROM radicado_datos WHERE avisado IS NULL ORDER BY creado LIMIT 20',
    )
    .all<{ id: string; numero: string; tipo: TipoDeRadicado; vence: string }>();
  let salieron = 0;
  for (const r of results) if (!(await avisarRadicado(db, telegram, r, ahora, fetchFn))) salieron++;
  return salieron;
}

/** CA2: radicar una consulta, un reclamo o una supresión. */
export async function radicar(
  c: Context,
  e: Entorno,
  telegram: Telegram,
  fetchFn: typeof fetch,
): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const cuerpo = ((await c.req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  const tipo = cuerpo['tipo'];
  const texto = typeof cuerpo['texto'] === 'string' ? cuerpo['texto'].trim() : '';
  if (tipo !== 'consulta' && tipo !== 'reclamo' && tipo !== 'supresion')
    return c.json(
      { estado: 'invalido', motivo: 'Elige si es una consulta, un reclamo o una supresión.' },
      400,
    );
  if (texto.length < 10 || texto.length > 2000)
    return c.json(
      { estado: 'invalido', motivo: 'Cuéntanos qué necesitas, entre 10 y 2.000 caracteres.' },
      400,
    );
  const ahora = e.ahora();
  const hoy = fechaEnBogota(ahora);
  const vence = sumarDiasHabiles(hoy, PLAZO_EN_DIAS_HABILES[tipo]);
  const id = crypto.randomUUID();
  const numero = `LD-${hoy.replaceAll('-', '')}-${id.replaceAll('-', '').slice(0, 6).toUpperCase()}`;
  await e.db
    .prepare(
      'INSERT INTO radicado_datos (id, numero, usuario_id, tipo, texto, creado, vence) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, numero, r.sub, tipo, texto, iso(ahora), vence)
    .run();
  const fallo = await avisarRadicado(e.db, telegram, { id, numero, tipo, vence }, ahora, fetchFn);
  if (fallo)
    console.error(`radicado ${numero}: el aviso al dueño no salió; el cron lo reintenta. ${fallo}`);
  return c.json(
    {
      numero,
      vence,
      mensaje:
        tipo === 'supresion'
          ? `Recibimos tu solicitud de supresión con el número ${numero}. La atiende una persona y te respondemos a más tardar el ${fechaLarga(vence)}. Lo que la ley nos obliga a conservar, como los pagos, se guarda el tiempo que exige; lo demás se suprime.`
          : `Recibimos tu ${NOMBRE[tipo]} con el número ${numero}. Te respondemos a más tardar el ${fechaLarga(vence)}.`,
    },
    201,
  );
}

/** «Tus solicitudes»: las de la persona, con su estado. */
export async function verRadicados(c: Context, e: Entorno): Promise<Response> {
  const r = await deLaCuenta(c, e);
  if (r instanceof Response) return r;
  const { results } = await e.db
    .prepare(
      'SELECT numero, tipo, creado, vence, estado FROM radicado_datos WHERE usuario_id = ? ORDER BY creado DESC LIMIT 50',
    )
    .bind(r.sub)
    .all();
  return c.json({ radicados: results });
}
