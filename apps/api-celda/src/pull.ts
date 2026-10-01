/**
 * `GET /api/v1/sync/pull` (HU-E5.3, ARQUITECTURA §5.6): lo que la organización tiene en la celda
 * después de los cursores del teléfono.
 *
 * - Hasta `PAGINA_MAXIMA` cambios por página (CA1), catálogos primero. Se pide uno más de cada
 *   tabla para saber si hay otra página sin contar filas.
 * - Solo lee: 2 consultas por los índices `registro_pull` y `catalogo_pull`. Ninguna escritura
 *   (CA1); la prueba lo cuenta.
 * - Con la celda en nivel «esencial» o «bloqueo» (ARQUITECTURA §8.2), el pull se pausa y dice hasta
 *   cuándo (CA3): el push de registros sigue, que es lo que no se puede perder.
 * - Permisos (HU-E4.5): solo baja lo que el rol puede leer según la matriz de `@gestionagro/sync`
 *   (un operario no recibe el valor del jornal). El filtro va en la consulta: lo negado nunca sale
 *   de la base.
 * - Lo que devuelve tiene la misma forma que el teléfono guarda: `seq` e `instante_recibido` son
 *   de la celda y no viajan.
 */
import type { Registro } from '@gestionagro/agro-schema';
import {
  type CambioDeCatalogo,
  type CatalogoValido,
  ENTIDADES_DE_CATALOGO,
  type EntidadDeCatalogo,
  entidadesQuePuede,
  PAGINA_MAXIMA,
  type RespuestaPull,
} from '@gestionagro/sync';
import { nivelDeLaCelda, respuestaDePausa } from './nivel.ts';
import type { ContextoCelda } from './worker.ts';

const cursor = (valor: string | undefined) => {
  const n = Number(valor ?? '0');
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
};

interface FilaRegistro {
  seq: number;
  id: string;
  org_id: string;
  finca_id: string;
  area_ids: string;
  ciclo_id: string | null;
  tipo: string;
  v: number;
  fecha_agronomica: string;
  instante_evento: string;
  autor_usuario_id: string | null;
  persona_ids: string;
  dispositivo_id: string;
  origen: Registro['origen'];
  anula_id: string | null;
  datos: string;
}

export async function pull(c: ContextoCelda, ahora: () => number): Promise<Response> {
  const { org, rol, db } = c.get('sesion');
  const nivel = await nivelDeLaCelda(c.env.FLAGS);
  if (nivel === 'esencial' || nivel === 'bloqueo') return respuestaDePausa(c, nivel, ahora());
  const desdeRegistro = cursor(c.req.query('registro'));
  const desdeCatalogo = cursor(c.req.query('catalogo'));
  if (desdeRegistro === null || desdeCatalogo === null) {
    return c.json({ estado: 'invalido', motivo: 'Cursor inválido' }, 400);
  }

  const legibles = entidadesQuePuede(rol, 'leer');
  const deCatalogos = ENTIDADES_DE_CATALOGO.filter((e) => legibles.includes(e));
  const catalogos =
    deCatalogos.length > 0
      ? await db
          .prepare(
            `SELECT seq, entidad, datos FROM catalogo WHERE org_id = ? AND seq > ? AND entidad IN (${deCatalogos.map(() => '?').join(', ')}) ORDER BY seq LIMIT ?`,
          )
          .bind(org, desdeCatalogo, ...deCatalogos, PAGINA_MAXIMA + 1)
          .all<{ seq: number; entidad: EntidadDeCatalogo; datos: string }>()
      : { results: [] as { seq: number; entidad: EntidadDeCatalogo; datos: string }[] };
  const deCatalogo = catalogos.results.slice(0, PAGINA_MAXIMA);
  const espacio = PAGINA_MAXIMA - deCatalogo.length;
  const registros =
    espacio > 0 && legibles.includes('registro')
      ? await db
          .prepare(
            `SELECT seq, id, org_id, finca_id, area_ids, ciclo_id, tipo, v, fecha_agronomica,
               instante_evento, autor_usuario_id, persona_ids, dispositivo_id, origen, anula_id, datos
             FROM registro WHERE org_id = ? AND seq > ? ORDER BY seq LIMIT ?`,
          )
          .bind(org, desdeRegistro, espacio + 1)
          .all<FilaRegistro>()
      : { results: [] as FilaRegistro[] };
  const deRegistro = registros.results.slice(0, espacio);

  const respuesta: RespuestaPull = {
    // En «ahorro» el teléfono espacia las revisiones (ARQUITECTURA §8.2).
    nivel,
    catalogos: deCatalogo.map(
      (f): CambioDeCatalogo => ({
        entidad: f.entidad,
        datos: JSON.parse(f.datos) as CatalogoValido,
      }),
    ),
    registros: deRegistro.map(({ seq: _seq, area_ids, persona_ids, datos, ...r }) => ({
      ...r,
      area_ids: JSON.parse(area_ids) as string[],
      persona_ids: JSON.parse(persona_ids) as string[],
      datos: JSON.parse(datos) as unknown,
    })),
    cursor: {
      catalogo: deCatalogo.at(-1)?.seq ?? desdeCatalogo,
      registro: deRegistro.at(-1)?.seq ?? desdeRegistro,
    },
    // Hay más si alguna tabla devolvió de sobra, o si los catálogos llenaron la página y aún no
    // se miraron los registros.
    mas:
      catalogos.results.length > PAGINA_MAXIMA ||
      registros.results.length > espacio ||
      (espacio === 0 && deCatalogo.length > 0),
  };
  return c.json(respuesta);
}
