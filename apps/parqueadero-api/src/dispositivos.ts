/**
 * Las cajas de un parqueadero en su celda (HU-Q7.6 y HU-Q7.7; PARQUEADERO §5.4, §11.4 y §12).
 * Cada dispositivo tiene su serie y numera sus recibos solo: dos cajas nunca repiten un número
 * porque la base hace única la serie de cada parqueadero (anexo A, `dispositivo_serie`).
 *
 * - `POST /api/v1/reclamar`: la primera caja, la que trae lo del piloto, entra con la serie que ya
 *   usa (la «A» de M0) y sus mismos números. Solo en un parqueadero sin otras cajas: con otra caja
 *   en la nube, los números de esta chocarían con los suyos. Es idempotente.
 * - `POST /api/v1/dispositivos`: una caja nueva recibe la siguiente serie libre (A, B, …, Z, AA…).
 *   Nunca la de una caja retirada: sus recibos siguen valiendo con esa serie (CA2). Idempotente.
 * - `POST /api/v1/dispositivos/retirar`: la caja retirada no sube ni baja nada más (CA3); lo que
 *   registró antes sigue en la celda con su serie.
 * - `GET /api/v1/dispositivos`: las cajas con su serie, su estado y su último número.
 * - `GET /api/v1/resumen`: cuánto tiene la celda de este parqueadero y de una caja. La caja lo
 *   compara con lo suyo para dar por verificado lo que subió (P21) y para decir si su archivo de
 *   respaldo tiene todo lo de la nube (HU-Q7.9).
 *
 * Lo que reclamar no hace aquí (P17): cargar el archivo entero en una invocación. Un parqueadero
 * con 10.000 recibos no cabe en las 50 consultas ni en los 10 ms de CPU del plan gratuito. La caja
 * sube lo suyo por la cola de siempre, de a 25, con los mismos ids (`push.ts`), y verifica con
 * `resumen` al terminar.
 *
 * Permisos (HU-Q7.8): dar de alta, retirar y reclamar es la fila «Dispositivos» de §11.2.
 */
import type { BaseD1 } from '@ed1/d1';
import { alcance } from '@ed1/parqueadero-schema/sync';
import type { ContextoCelda } from './worker.ts';

const SERIE = /^[A-Z0-9]{1,3}$/;
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

interface FilaDispositivo {
  id: string;
  serie: string;
  nombre: string;
  estado: 'activo' | 'retirado';
  creado: string;
  retirado: string | null;
}

/** La primera serie que el parqueadero no usa: A…Z y después AA…ZZ. Las retiradas no vuelven. */
export function siguienteSerie(usadas: Iterable<string>): string | null {
  const ya = new Set(usadas);
  for (const a of LETRAS) if (!ya.has(a)) return a;
  for (const a of LETRAS) for (const b of LETRAS) if (!ya.has(a + b)) return a + b;
  return null;
}

/** Lo que la celda responde a una caja retirada, en push, pull y resumen. */
export const RETIRADA = {
  estado: 'retirado',
  motivo:
    'Esta caja fue retirada del parqueadero: ya no sube ni baja nada. Sus recibos siguen guardados en ella.',
} as const;

/** El estado de una caja en la celda, o `null` si nadie la dio de alta. */
export async function estadoDeLaCaja(
  db: BaseD1,
  org: string,
  dispositivo: string,
): Promise<FilaDispositivo['estado'] | null> {
  const fila = await db
    .prepare('SELECT estado FROM dispositivo WHERE org_id = ? AND id = ?')
    .bind(org, dispositivo)
    .first<{ estado: FilaDispositivo['estado'] }>();
  return fila?.estado ?? null;
}

const sinPermiso = (c: ContextoCelda) => {
  const { rol } = c.get('sesion');
  return alcance(rol, 'dispositivos') === 'si'
    ? null
    : c.json(
        {
          estado: 'sin-permiso',
          motivo: `Con el rol de ${rol} no se dan de alta ni se retiran cajas. Pídaselo a quien administra el parqueadero.`,
        },
        403,
      );
};

async function cuerpoDe(c: ContextoCelda): Promise<Record<string, unknown> | null> {
  try {
    const cuerpo: unknown = await c.req.json();
    return cuerpo !== null && typeof cuerpo === 'object'
      ? (cuerpo as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const texto = (valor: unknown, max: number) =>
  typeof valor === 'string' && valor.trim().length > 0 && valor.length <= max ? valor.trim() : null;

const invalido = (c: ContextoCelda, motivo: string) => c.json({ estado: 'invalido', motivo }, 400);

const cajasDe = async (db: BaseD1, org: string) =>
  (
    await db
      .prepare(
        'SELECT id, serie, nombre, estado, creado, retirado FROM dispositivo WHERE org_id = ? ORDER BY creado, serie',
      )
      .bind(org)
      .all<FilaDispositivo>()
  ).results;

const insertar = (
  db: BaseD1,
  org: string,
  d: { id: string; serie: string; nombre: string },
  instante: string,
) =>
  db
    .prepare(
      `INSERT INTO dispositivo (org_id, id, serie, nombre, estado, creado) VALUES (?, ?, ?, ?, 'activo', ?)`,
    )
    .bind(org, d.id, d.serie, d.nombre, instante)
    .run();

const esSerieRepetida = (error: unknown) =>
  /UNIQUE constraint failed: dispositivo\./.test(
    error instanceof Error ? error.message : String(error),
  );

const publica = (d: FilaDispositivo) => ({
  dispositivo: d.id,
  serie: d.serie,
  nombre: d.nombre,
  estado: d.estado,
  creado: d.creado,
  retirado: d.retirado,
});

/** `POST /api/v1/reclamar` (HU-Q7.6 CA2 y CA3): la primera caja conserva su serie. */
export async function reclamar(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const negado = sinPermiso(c);
  if (negado) return negado;
  const { org, db } = c.get('sesion');
  const cuerpo = await cuerpoDe(c);
  const id = texto(cuerpo?.['dispositivo'], 120);
  const serie = typeof cuerpo?.['serie'] === 'string' ? cuerpo['serie'] : '';
  const nombre = texto(cuerpo?.['nombre'], 60) ?? `Caja ${serie}`;
  const sede = cuerpo?.['sede_id'] ?? null;
  if (!id) return invalido(c, 'Falta la caja');
  if (!SERIE.test(serie)) return invalido(c, 'La serie son de 1 a 3 letras o cifras en mayúscula');
  if (sede !== null && typeof sede !== 'string') return invalido(c, 'La sede no es válida');

  const [cajas, sedes] = await Promise.all([
    cajasDe(db, org),
    db
      .prepare("SELECT id FROM catalogo WHERE org_id = ? AND entidad = 'sede'")
      .bind(org)
      .all<{ id: string }>(),
  ]);
  const propia = cajas.find((d) => d.id === id);
  if (propia?.estado === 'retirado') return c.json(RETIRADA, 403);
  if (propia && propia.serie !== serie) {
    return c.json(
      {
        estado: 'otra-serie',
        motivo: `Esta caja ya está en la nube con la serie ${propia.serie}.`,
      },
      409,
    );
  }
  if (propia) return c.json({ resultado: 'ya-reclamado', caja: publica(propia) });
  if (cajas.length > 0) {
    return c.json(
      {
        estado: 'con-cajas',
        motivo:
          'Este parqueadero ya tiene cajas en la nube. Una caja con recibos propios no se suma a él: sus números chocarían con los de las otras. Para sumar un teléfono, úselo vacío.',
      },
      409,
    );
  }
  if (sede !== null && sedes.results.some((s) => s.id !== sede)) {
    return c.json(
      {
        estado: 'otra-sede',
        motivo: 'Este parqueadero de la nube tiene otra sede: esta caja no es suya.',
      },
      409,
    );
  }
  const instante = new Date(ahora()).toISOString();
  try {
    await insertar(db, org, { id, serie, nombre }, instante);
  } catch (error) {
    // Otra caja reclamó en el mismo instante y se quedó con la serie.
    if (!esSerieRepetida(error)) throw error;
    return c.json(
      { estado: 'con-cajas', motivo: 'Otra caja acaba de entrar a este parqueadero.' },
      409,
    );
  }
  return c.json(
    {
      resultado: 'reclamado',
      caja: publica({ id, serie, nombre, estado: 'activo', creado: instante, retirado: null }),
    },
    201,
  );
}

/** `POST /api/v1/dispositivos` (HU-Q7.7 CA1): la siguiente serie libre. */
export async function darDeAlta(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const negado = sinPermiso(c);
  if (negado) return negado;
  const { org, db } = c.get('sesion');
  const cuerpo = await cuerpoDe(c);
  const id = texto(cuerpo?.['dispositivo'], 120);
  const nombre = texto(cuerpo?.['nombre'], 60);
  if (!id) return invalido(c, 'Falta la caja');
  const instante = new Date(ahora()).toISOString();
  // Dos altas a la vez pueden pedir la misma serie: la base deja una y la otra vuelve a mirar.
  for (let intento = 0; intento < 3; intento++) {
    const cajas = await cajasDe(db, org);
    const propia = cajas.find((d) => d.id === id);
    if (propia?.estado === 'retirado') return c.json(RETIRADA, 403);
    if (propia) return c.json({ resultado: 'ya-de-alta', caja: publica(propia) });
    const serie = siguienteSerie(cajas.map((d) => d.serie));
    if (!serie) {
      return c.json(
        { estado: 'sin-series', motivo: 'Este parqueadero ya usó todas las series.' },
        409,
      );
    }
    try {
      await insertar(db, org, { id, serie, nombre: nombre ?? `Caja ${serie}` }, instante);
    } catch (error) {
      if (!esSerieRepetida(error)) throw error;
      continue;
    }
    return c.json(
      {
        resultado: 'de-alta',
        caja: publica({
          id,
          serie,
          nombre: nombre ?? `Caja ${serie}`,
          estado: 'activo',
          creado: instante,
          retirado: null,
        }),
      },
      201,
    );
  }
  return c.json(
    { estado: 'reintentar', motivo: 'Otras cajas se están dando de alta. Intente otra vez.' },
    409,
  );
}

/** `POST /api/v1/dispositivos/retirar` (HU-Q7.7 CA2): la caja deja de subir y de bajar. */
export async function retirar(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const negado = sinPermiso(c);
  if (negado) return negado;
  const { org, db } = c.get('sesion');
  const id = texto((await cuerpoDe(c))?.['dispositivo'], 120);
  if (!id) return invalido(c, 'Falta la caja');
  const instante = new Date(ahora()).toISOString();
  const r = await db
    .prepare(
      `UPDATE dispositivo SET estado = 'retirado', retirado = ? WHERE org_id = ? AND id = ? AND estado = 'activo'`,
    )
    .bind(instante, org, id)
    .run();
  if ((r.meta.changes ?? 0) > 0)
    return c.json({ resultado: 'retirado', dispositivo: id, retirado: instante });
  const estado = await estadoDeLaCaja(db, org, id);
  if (estado === null) {
    return c.json({ estado: 'no-encontrado', motivo: 'Esa caja no es de este parqueadero.' }, 404);
  }
  return c.json({ resultado: 'retirado', dispositivo: id });
}

/** `GET /api/v1/dispositivos` (HU-Q7.7): las cajas, con su último número. */
export async function listar(c: ContextoCelda): Promise<Response> {
  const negado = sinPermiso(c);
  if (negado) return negado;
  const { org, db } = c.get('sesion');
  const { results } = await db
    .prepare(
      `SELECT d.id, d.serie, d.nombre, d.estado, d.creado, d.retirado,
         (SELECT max(r.consecutivo) FROM registro r WHERE r.org_id = ?1 AND r.serie = d.serie) AS ultimo
       FROM dispositivo d WHERE d.org_id = ?1 ORDER BY d.creado, d.serie`,
    )
    .bind(org)
    .all<FilaDispositivo & { ultimo: number | null }>();
  return c.json({
    dispositivos: results.map((d) => ({ ...publica(d), ultimo: d.ultimo ?? 0 })),
  });
}

/**
 * `GET /api/v1/resumen?dispositivo=…` (HU-Q7.6 CA2, HU-Q7.9): lo que la celda tiene. Lo lee
 * cualquier rol: todos leen todo lo de su sede (§11.2). Una consulta.
 */
export async function resumen(c: ContextoCelda): Promise<Response> {
  const { org, db } = c.get('sesion');
  const id = c.req.query('dispositivo') ?? '';
  if (!id || id.length > 120) return invalido(c, 'Falta la caja');
  const fila = await db
    .prepare(
      `SELECT
         (SELECT count(*) FROM registro WHERE org_id = ?1) AS registros,
         (SELECT count(*) FROM catalogo WHERE org_id = ?1) AS catalogos,
         (SELECT count(*) FROM registro WHERE org_id = ?1 AND dispositivo_id = ?2) AS de_la_caja,
         (SELECT count(*) FROM cuarentena WHERE org_id = ?1 AND dispositivo_id = ?2) AS en_cuarentena,
         (SELECT estado FROM dispositivo WHERE org_id = ?1 AND id = ?2) AS estado`,
    )
    .bind(org, id)
    .first<{
      registros: number;
      catalogos: number;
      de_la_caja: number;
      en_cuarentena: number;
      estado: FilaDispositivo['estado'] | null;
    }>();
  if (fila?.estado === 'retirado') return c.json(RETIRADA, 403);
  return c.json({
    registros: fila?.registros ?? 0,
    catalogos: fila?.catalogos ?? 0,
    caja: {
      dispositivo: id,
      estado: fila?.estado ?? 'sin-alta',
      registros: fila?.de_la_caja ?? 0,
      en_cuarentena: fila?.en_cuarentena ?? 0,
    },
  });
}
