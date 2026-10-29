/**
 * HU-T10.2: las páginas propias desde el panel (TIENDA §5.3 `pagina`), con las reglas del catálogo:
 * cada escritura lleva su `version` y su `op`, deja su fila en el registro, y borrar manda a la
 * papelera de 30 días. Salen en la tienda al publicar, en `/<dirección>/`, con su enlace en el pie.
 * Una página no toma la dirección de un texto legal ni de una ruta del sistema (CA2).
 */
import type { SentenciaD1 } from '@ed1/d1';
import { type Buscadores, buscadoresLeidos } from '@ed1/tienda-schema/buscadores';
import { GuardarPagina, leerDireccionDePagina } from '@ed1/tienda-schema/paginas';
import { z } from 'zod';
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  MOTIVO_CAMBIADO,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { anotar } from './registro.ts';

const MOTIVO_NO_EXISTE = 'Esa página ya no está: puede que la hayan borrado.';
const YA_ESTA = 'Ya tienes otra página con esa dirección. Elige otra.';

interface FilaDePagina {
  id: string;
  slug: string;
  titulo: string;
  cuerpo_md: string;
  visible: number;
  version: number;
  seo: string | null;
}

export interface Pagina {
  id: string;
  slug: string;
  titulo: string;
  cuerpo: string;
  visible: boolean;
  version: number;
  buscadores: Buscadores;
}

const paginaDe = (f: FilaDePagina): Pagina => ({
  id: f.id,
  slug: f.slug,
  titulo: f.titulo,
  cuerpo: f.cuerpo_md,
  visible: f.visible === 1,
  version: f.version,
  buscadores: buscadoresDeLaPagina(f.seo),
});

/** HU-P4.4: lo de buscadores de una página; lo ilegible no existe (P1). */
export function buscadoresDeLaPagina(seo: string | null): Buscadores {
  try {
    const v = JSON.parse(seo ?? '{}') as unknown;
    return v && typeof v === 'object' ? buscadoresLeidos(v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const COLUMNAS = 'id, slug, titulo, cuerpo_md, visible, version, seo';

export async function listarPaginas(q: Quien): Promise<{ paginas: Pagina[] }> {
  const { results } = await q.db
    .prepare(
      `SELECT ${COLUMNAS} FROM pagina WHERE org_id = ? AND borrado IS NULL ORDER BY titulo, id`,
    )
    .bind(q.org)
    .all<FilaDePagina>();
  return { paginas: results.map(paginaDe) };
}

const leerPagina = (q: Quien, id: string) =>
  q.db
    .prepare(`SELECT ${COLUMNAS} FROM pagina WHERE org_id = ? AND id = ? AND borrado IS NULL`)
    .bind(q.org, id)
    .first<FilaDePagina>();

const versionDeLaPagina = (q: Quien, id: string) => async () =>
  (await leerPagina(q, id))?.version ?? null;

const problemasDe = (r: z.ZodSafeParseResult<unknown>) =>
  r.success
    ? []
    : r.error.issues.map((i) => ({ campo: i.path.map(String).join('.'), mensaje: i.message }));

function aplicar(
  q: Quien,
  op: string,
  lote: SentenciaD1[],
  r: Resultado,
  versionActual: () => Promise<number | null>,
): Promise<Resultado> {
  return q.db.batch(lote).then(
    () => r,
    async (e: unknown) => {
      if (esCambiado(e))
        return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: await versionActual() };
      if (esOperacionRepetida(e)) return (await yaAplicada(q, op)) ?? r;
      // CA2: dos páginas con la misma dirección; la base no deja la segunda.
      if (/UNIQUE constraint failed: pagina\.org_id, pagina\.slug/i.test(String(e)))
        return { estado: 'problemas', problemas: [{ campo: 'slug', mensaje: YA_ESTA }] };
      throw e;
    },
  );
}

export async function guardarPagina(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = GuardarPagina.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const direccion = leerDireccionDePagina(d.slug);
  if (!direccion.ok)
    return { estado: 'problemas', problemas: [{ campo: 'slug', mensaje: direccion.motivo }] };
  if (d.id && d.version === undefined)
    return {
      estado: 'problemas',
      problemas: [{ campo: 'version', mensaje: 'falta la versión que leíste' }],
    };
  const actual = d.id ? await leerPagina(q, d.id) : null;
  if (d.id && !actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual && actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };

  const id = actual?.id ?? `pg-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const r: Resultado = {
    estado: 'guardado',
    id,
    version: (actual?.version ?? 0) + 1,
    slug: direccion.slug,
  };
  // HU-P4.4: quien no lo manda no lo borra.
  const seo = d.buscadores ? JSON.stringify(buscadoresLeidos(d.buscadores)) : (actual?.seo ?? null);
  const valores = [direccion.slug, d.titulo, d.cuerpo, d.visible ? 1 : 0, seo, q.instante] as const;
  const lote: SentenciaD1[] = actual
    ? [
        q.db
          .prepare(
            `UPDATE pagina SET slug = ?, titulo = ?, cuerpo_md = ?, visible = ?, seo = ?, actualizado = ?, version = version + 1
             WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL`,
          )
          .bind(...valores, q.org, id, actual.version),
        q.db.prepare(SI_CAMBIO),
      ]
    : [
        q.db
          .prepare(
            'INSERT INTO pagina (org_id, id, slug, titulo, cuerpo_md, visible, seo, actualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(q.org, id, ...valores),
      ];
  lote.push(
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: actual ? 'pagina.editar' : 'pagina.crear',
      entidad: 'pagina',
      entidadId: id,
      antes: actual
        ? { nombre: actual.titulo, slug: actual.slug, visible: actual.visible === 1 }
        : null,
      despues: { nombre: d.titulo, slug: direccion.slug, visible: d.visible },
      instante: q.instante,
    }),
    guardarOperacion(q, d.op, 'paginas/guardar', r),
  );
  return aplicar(q, d.op, lote, r, versionDeLaPagina(q, id));
}

const BorrarPagina = z.object({
  op: z.string().min(8).max(64),
  id: z.string().min(1).max(40),
  version: z.number().int().min(1),
});

export async function borrarPagina(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = BorrarPagina.safeParse(cuerpo);
  if (!r0.success) return { estado: 'problemas', problemas: problemasDe(r0) };
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const actual = await leerPagina(q, d.id);
  if (!actual) return { estado: 'no-existe', motivo: MOTIVO_NO_EXISTE };
  if (actual.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: actual.version };
  const r: Resultado = { estado: 'guardado', id: d.id, version: actual.version + 1 };
  return aplicar(
    q,
    d.op,
    [
      q.db
        .prepare(
          'UPDATE pagina SET borrado = ?, version = version + 1 WHERE org_id = ? AND id = ? AND version = ? AND borrado IS NULL',
        )
        .bind(q.instante, q.org, d.id, actual.version),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'pagina.borrar',
        entidad: 'pagina',
        entidadId: d.id,
        antes: { nombre: actual.titulo },
        despues: null,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'paginas/borrar', r),
    ],
    r,
    versionDeLaPagina(q, d.id),
  );
}
