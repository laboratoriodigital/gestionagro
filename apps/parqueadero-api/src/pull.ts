/**
 * `GET /api/v1/sync/pull` del parqueadero (HU-Q7.4, PARQUEADERO §12): lo que el parqueadero tiene en
 * la celda después de los cursores de la caja. Es el pull de la celda agro con el registro del
 * parqueadero: dos cajas de la misma sede ven los vehículos de la otra.
 *
 * - Hasta `PAGINA_MAXIMA` cambios por página, los catálogos primero (una entrada nombra su tarifa).
 *   Se pide uno más de cada tabla para saber si hay otra página sin contar filas.
 * - Solo lee: 2 consultas por los índices `catalogo_pull` y `registro_pull` (3 con la caja), ninguna
 *   escritura.
 * - Permisos (HU-Q7.8): solo baja lo que el rol puede leer según la matriz. El filtro va en la
 *   consulta: lo negado nunca sale de la base.
 * - Una caja retirada (HU-Q7.7 CA3) no baja nada: 403 `retirado`. La caja dice quién es en
 *   `dispositivo`; esa revisión es una consulta más.
 * - Devuelve el registro con la forma que la caja guarda: `seq` e `instante_recibido` son de la
 *   celda y no viajan.
 */
import type { Registro } from '@ed1/parqueadero-schema';
import {
  type CambioDeCatalogo,
  ENTIDADES_DE_CATALOGO,
  type EntidadDeCatalogo,
  entidadesQuePuede,
  type RespuestaPull,
  tiposNegados,
} from '@ed1/parqueadero-schema/sync';
import { type CatalogoValido, PAGINA_MAXIMA, type Reemplazo } from '@ed1/sync';
import { estadoDeLaCaja, RETIRADA } from './dispositivos.ts';
import type { ContextoCelda } from './worker.ts';

const cursor = (valor: string | undefined) => {
  const n = Number(valor ?? '0');
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

type FilaRegistro = Omit<Registro, 'datos'> & { seq: number; datos: string };
interface FilaCatalogo {
  seq: number;
  entidad: EntidadDeCatalogo;
  datos: string;
  reemplazo: string | null;
}

export async function pull(c: ContextoCelda): Promise<Response> {
  const { org, rol, db } = c.get('sesion');
  const desdeRegistro = cursor(c.req.query('registro'));
  const desdeCatalogo = cursor(c.req.query('catalogo'));
  if (desdeRegistro === null || desdeCatalogo === null) {
    return c.json({ estado: 'invalido', motivo: 'Cursor inválido' }, 400);
  }
  const dispositivo = c.req.query('dispositivo');
  if (dispositivo && (await estadoDeLaCaja(db, org, dispositivo.slice(0, 120))) === 'retirado') {
    return c.json(RETIRADA, 403);
  }

  const legibles = entidadesQuePuede(rol, 'leer');
  const deCatalogos = ENTIDADES_DE_CATALOGO.filter((e) => legibles.includes(e));
  const catalogos =
    deCatalogos.length > 0
      ? await db
          .prepare(
            `SELECT seq, entidad, datos, reemplazo FROM catalogo WHERE org_id = ? AND seq > ? AND entidad IN (${deCatalogos.map(() => '?').join(', ')}) ORDER BY seq LIMIT ?`,
          )
          .bind(org, desdeCatalogo, ...deCatalogos, PAGINA_MAXIMA + 1)
          .all<FilaCatalogo>()
      : { results: [] as FilaCatalogo[] };
  const deCatalogo = catalogos.results.slice(0, PAGINA_MAXIMA);
  const espacio = PAGINA_MAXIMA - deCatalogo.length;
  const ocultos = tiposNegados(rol, 'leer');
  const sinOcultos =
    ocultos.length > 0 ? ` AND tipo NOT IN (${ocultos.map(() => '?').join(', ')})` : '';
  const registros =
    espacio > 0 && legibles.includes('registro')
      ? await db
          .prepare(
            `SELECT seq, id, org_id, tipo, v, fecha_local, instante_evento, autor_usuario_id,
               dispositivo_id, origen, anula_id, estadia_id, serie, consecutivo, datos
             FROM registro WHERE org_id = ? AND seq > ?${sinOcultos} ORDER BY seq LIMIT ?`,
          )
          .bind(org, desdeRegistro, ...ocultos, espacio + 1)
          .all<FilaRegistro>()
      : { results: [] as FilaRegistro[] };
  const deRegistro = registros.results.slice(0, espacio);

  const respuesta: RespuestaPull = {
    catalogos: deCatalogo.map(
      (f): CambioDeCatalogo => ({
        entidad: f.entidad,
        datos: JSON.parse(f.datos) as CatalogoValido,
        ...(f.reemplazo ? { reemplazo: JSON.parse(f.reemplazo) as Reemplazo } : {}),
      }),
    ),
    registros: deRegistro.map(
      ({ seq: _seq, datos, ...r }): Registro => ({ ...r, datos: JSON.parse(datos) as unknown }),
    ),
    cursor: {
      catalogo: deCatalogo.at(-1)?.seq ?? desdeCatalogo,
      registro: deRegistro.at(-1)?.seq ?? desdeRegistro,
    },
    // Hay más si alguna tabla devolvió de sobra, o si los catálogos llenaron la página y aún no se
    // miraron los registros.
    mas:
      catalogos.results.length > PAGINA_MAXIMA ||
      registros.results.length > espacio ||
      (espacio === 0 && deCatalogo.length > 0),
  };
  return c.json(respuesta);
}
