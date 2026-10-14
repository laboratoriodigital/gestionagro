/**
 * Publicar es hornear (HU-T4.4, TIENDA-3.0 §10.3), con la compuerta antes (HU-T4.3):
 *
 * 1. una sola publicación en curso por tienda: el índice único `publicacion_en_curso` lo impide;
 * 2. leer los datos de la tienda, en pocas consultas;
 * 3. hornear con `@ed1/tienda-horno`, y pasar la compuerta: si falla, la publicación queda
 *    `fallida` con todas sus fallas y nada más cambia;
 * 4. subir al almacén solo los objetos nuevos, por huella (`objetos/<hh>/<huella>`);
 * 5. guardar el manifiesto de la versión y **releerlo** para verificarlo (P16);
 * 6. si la huella del conjunto es la de la versión publicada: «Nada cambió», sin versión nueva;
 * 7. el puntero de cada hostname activo en `TIENDA_HOSTS`, y por último la versión publicada.
 *
 * Cualquier falla deja la publicación `fallida` con su motivo, y la tienda sigue sirviendo la
 * versión anterior: el KV y `version_publicada` cambian al final, nunca a medias (P21).
 *
 * Por ahora en la misma solicitud, sin cola: en el plan gratuito una tienda pequeña cabe en ella, y
 * la cola llega cuando el tamaño de una tienda lo pida (bitácora tienda3 7). El código no cambia:
 * el consumidor de la cola llamará a esta misma función.
 */
import type { BaseD1 } from '@ed1/d1';
import {
  type CodigoDeFalla,
  compuerta,
  type Falla,
  hornear,
  manifiesto,
  type ProductoParaHornear,
  type ProductoParaLaCompuerta,
  type TiendaParaHornear,
} from '@ed1/tienda-horno';
import { type Seccion, validarSeccion } from '@ed1/tienda-schema';

/** Lo que la publicación usa de un bucket R2. */
export interface Almacen {
  get(clave: string): Promise<{ text(): Promise<string> } | null>;
  put(
    clave: string,
    valor: string,
    opciones?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}

/** Lo que usa del KV `TIENDA_HOSTS`. */
export interface EscritorKv {
  put(clave: string, valor: string): Promise<void>;
}

export interface Contexto {
  shard: BaseD1;
  shardNombre: string;
  control: BaseD1;
  sitios: Almacen;
  hosts: EscritorKv;
  celda: string;
  release: string;
  org: string;
  pedidaPor: string;
  /** ISO 8601, del reloj del Worker: la publicación guarda cuándo, el horno no lo usa. */
  ahora: string;
  /** Solo para los comercios de prueba de staging (HU-T2.6). */
  omitir?: readonly CodigoDeFalla[];
}

export type Resultado =
  | { estado: 'publicada'; version: number; archivos: number; nuevos: number }
  | { estado: 'nada-cambio'; version: number | null }
  | { estado: 'compuerta'; fallas: Falla[] }
  | { estado: 'en-curso' }
  | { estado: 'fallida'; motivo: string };

interface FilaProducto {
  id: string;
  slug: string;
  nombre: string;
  descripcion_md: string;
  estado: 'borrador' | 'activo' | 'archivado';
  opciones: string;
  retracto: 'aplica' | 'no_aplica';
  retracto_motivo: string | null;
  actualizado: string;
}

/** La sección guardada, ya validada; una que no valida cuenta como vacía (y la compuerta lo dice). */
function seccion(fila: { seccion: string; datos: string } | undefined): Record<string, unknown> {
  if (!fila) return {};
  const r = validarSeccion(fila.seccion as Seccion, JSON.parse(fila.datos));
  return r.ok ? r.datos : {};
}

export async function publicar(c: Contexto): Promise<Resultado> {
  // 1. Reservar la versión: si hay otra en curso, el índice único lo impide.
  let version: number;
  try {
    const fila = await c.shard
      .prepare(
        `INSERT INTO publicacion (org_id, version, estado, pedida_por, pedida)
         VALUES (?, (SELECT COALESCE(MAX(version), 0) + 1 FROM publicacion WHERE org_id = ?), 'horneando', ?, ?)
         RETURNING version`,
      )
      .bind(c.org, c.org, c.pedidaPor, c.ahora)
      .first<{ version: number }>();
    if (!fila) throw new Error('no se pudo reservar la versión');
    version = fila.version;
  } catch (e) {
    if (/UNIQUE|publicacion_en_curso/i.test(String(e))) return { estado: 'en-curso' };
    throw e;
  }
  const fallar = async (motivo: string): Promise<Resultado> => {
    await c.shard
      .prepare(
        "UPDATE publicacion SET estado = 'fallida', motivo = ? WHERE org_id = ? AND version = ?",
      )
      .bind(motivo.slice(0, 2000), c.org, version)
      .run();
    return { estado: 'fallida', motivo };
  };

  try {
    // 2. Los datos de la tienda.
    const tienda = await c.shard
      .prepare('SELECT nombre, version_publicada FROM tienda WHERE org_id = ?')
      .bind(c.org)
      .first<{ nombre: string; version_publicada: number | null }>();
    if (!tienda) return await fallar('la tienda no existe en su shard');
    const { results: filasAjuste } = await c.shard
      .prepare('SELECT seccion, datos FROM ajuste WHERE org_id = ?')
      .bind(c.org)
      .all<{ seccion: string; datos: string }>();
    const ajustes = Object.fromEntries(filasAjuste.map((f) => [f.seccion, seccion(f)])) as Partial<
      Record<Seccion, Record<string, unknown>>
    >;
    const { results: productos } = await c.shard
      .prepare(
        `SELECT id, slug, nombre, descripcion_md, estado, opciones, retracto, retracto_motivo, actualizado
         FROM producto WHERE org_id = ? AND borrado IS NULL ORDER BY posicion, slug`,
      )
      .bind(c.org)
      .all<FilaProducto>();
    const { results: variantes } = await c.shard
      .prepare(
        'SELECT id, producto_id, clave, precio_cop, stock, reservado FROM variante WHERE org_id = ? AND activa = 1',
      )
      .bind(c.org)
      .all<{
        id: string;
        producto_id: string;
        clave: string;
        precio_cop: number;
        stock: number | null;
        reservado: number;
      }>();
    const { results: fotos } = await c.shard
      .prepare('SELECT producto_id, COUNT(*) AS n FROM medio WHERE org_id = ? GROUP BY producto_id')
      .bind(c.org)
      .all<{ producto_id: string; n: number }>();
    const { results: colecciones } = await c.shard
      .prepare(
        `SELECT c.slug, c.nombre, p.slug AS producto FROM coleccion c
         LEFT JOIN coleccion_producto cp ON cp.org_id = c.org_id AND cp.coleccion_id = c.id
         LEFT JOIN producto p ON p.org_id = cp.org_id AND p.id = cp.producto_id
         WHERE c.org_id = ? AND c.borrado IS NULL AND c.visible = 1 ORDER BY c.posicion, cp.posicion`,
      )
      .bind(c.org)
      .all<{ slug: string; nombre: string; producto: string | null }>();
    const { results: envios } = await c.shard
      .prepare(
        'SELECT nombre, dias_max FROM envio_opcion WHERE org_id = ? AND activa = 1 AND borrado IS NULL',
      )
      .bind(c.org)
      .all<{ nombre: string; dias_max: number | null }>();
    const { results: dominios } = await c.control
      .prepare("SELECT hostname, rol FROM dominio WHERE org_id = ? AND estado = 'activo'")
      .bind(c.org)
      .all<{ hostname: string; rol: string }>();
    const canonico = dominios.find((d) => d.rol === 'canonico')?.hostname;
    if (!canonico) return await fallar('la tienda no tiene una dirección activa');

    // 3. Hornear y pasar la compuerta.
    const activos = productos.filter((p) => p.estado === 'activo');
    const paraHornear: ProductoParaHornear[] = activos.flatMap((p) => {
      const suyas = variantes.filter((v) => v.producto_id === p.id);
      if (suyas.length === 0) return [];
      return [
        {
          slug: p.slug,
          nombre: p.nombre,
          ...(p.descripcion_md ? { descripcion: p.descripcion_md } : {}),
          opciones: JSON.parse(p.opciones) as ProductoParaHornear['opciones'],
          variantes: suyas.map((v) => ({
            id: v.id,
            clave: v.clave,
            precioCop: v.precio_cop,
            stock: v.stock === null ? null : Math.max(0, v.stock - v.reservado),
          })),
          actualizado: p.actualizado,
        },
      ];
    });
    const conDefectos = (s: Seccion) => {
      const r = validarSeccion(s, ajustes[s] ?? {});
      return r.ok ? r.datos : {};
    };
    const identidad = ajustes.identidad ?? {};
    const contacto = ajustes.contacto ?? {};
    const agentes = ajustes.agentes ?? {};
    const medicion = ajustes.medicion ?? {};
    const porColeccion = new Map<string, { nombre: string; productos: string[] }>();
    for (const f of colecciones) {
      const actual = porColeccion.get(f.slug) ?? { nombre: f.nombre, productos: [] };
      if (f.producto) actual.productos.push(f.producto);
      porColeccion.set(f.slug, actual);
    }
    const datos: TiendaParaHornear = {
      dominio: canonico,
      release: c.release,
      nombre: (identidad['nombre'] as string | undefined) ?? tienda.nombre,
      ...(identidad['frase'] ? { frase: identidad['frase'] as string } : {}),
      ...(contacto['whatsapp'] ? { whatsapp: contacto['whatsapp'] as string } : {}),
      ...(contacto['correo'] ? { correo: contacto['correo'] as string } : {}),
      apariencia: conDefectos('apariencia') as unknown as TiendaParaHornear['apariencia'],
      agentes: {
        search: (agentes['search'] as 'yes' | 'no' | undefined) ?? 'yes',
        aiInput: (agentes['aiInput'] as 'yes' | 'no' | undefined) ?? 'yes',
        aiTrain: (agentes['aiTrain'] as 'yes' | 'no' | undefined) ?? 'no',
      },
      ...(medicion['googleVerificacion']
        ? { googleVerificacion: medicion['googleVerificacion'] as string }
        : {}),
      productos: paraHornear,
      colecciones: [...porColeccion].map(([slug, col]) => ({ slug, ...col })),
    };
    const archivos = await hornear(datos);
    const revision = compuerta({
      ajustes,
      productos: productos.map(
        (p): ProductoParaLaCompuerta => ({
          slug: p.slug,
          nombre: p.nombre,
          estado: p.estado,
          precioCop: variantes.find((v) => v.producto_id === p.id)?.precio_cop ?? null,
          fotos: fotos.find((f) => f.producto_id === p.id)?.n ?? 0,
          retracto: p.retracto,
          retractoMotivo: p.retracto_motivo,
        }),
      ),
      archivos,
      envios: envios.map((e) => ({ nombre: e.nombre, plazoDias: e.dias_max ?? 0 })),
      ...(c.omitir ? { omitir: c.omitir } : {}),
    });
    if (!revision.ok) {
      await fallar(JSON.stringify(revision.fallas));
      return { estado: 'compuerta', fallas: revision.fallas };
    }

    // 4 y 6. El manifiesto, y si nada cambió.
    const m = await manifiesto(archivos);
    if (tienda.version_publicada !== null) {
      const anterior = await c.shard
        .prepare('SELECT huella FROM publicacion WHERE org_id = ? AND version = ?')
        .bind(c.org, tienda.version_publicada)
        .first<{ huella: string | null }>();
      if (anterior?.huella === m.huella) {
        await c.shard
          .prepare('DELETE FROM publicacion WHERE org_id = ? AND version = ?')
          .bind(c.org, version)
          .run();
        return { estado: 'nada-cambio', version: tienda.version_publicada };
      }
    }
    const previas = new Set<string>();
    if (tienda.version_publicada !== null) {
      const previo = await c.sitios.get(
        `sitios/${c.org}/${tienda.version_publicada}/manifiesto.json`,
      );
      if (previo) {
        const pm = JSON.parse(await previo.text()) as typeof m;
        for (const a of Object.values(pm.archivos)) previas.add(a.huella);
      }
    }
    let nuevos = 0;
    for (const [ruta, archivo] of archivos) {
      const entrada = m.archivos[ruta];
      if (!entrada || previas.has(entrada.huella)) continue;
      await c.sitios.put(
        `objetos/${entrada.huella.slice(0, 2)}/${entrada.huella}`,
        archivo.contenido,
        {
          httpMetadata: { contentType: archivo.tipo },
        },
      );
      previas.add(entrada.huella);
      nuevos++;
    }

    // 5. El manifiesto, guardado y releído.
    const claveManifiesto = `sitios/${c.org}/${version}/manifiesto.json`;
    await c.sitios.put(claveManifiesto, JSON.stringify(m), {
      httpMetadata: { contentType: 'application/json' },
    });
    const releido = await c.sitios.get(claveManifiesto);
    const verificado = releido ? (JSON.parse(await releido.text()) as typeof m) : null;
    if (
      !verificado ||
      verificado.huella !== m.huella ||
      Object.keys(verificado.archivos).length !== archivos.size
    ) {
      return await fallar('el manifiesto guardado no es el que se horneó');
    }

    // 7. Los punteros y, al final, la versión publicada.
    for (const d of dominios) {
      await c.hosts.put(
        `h:${d.hostname}`,
        JSON.stringify({
          org: c.org,
          celda: c.celda,
          shard: c.shardNombre,
          version,
          canonico,
          estado: 'abierta',
          rol: d.rol,
        }),
      );
    }
    const bytes = Object.values(m.archivos).reduce((s, a) => s + a.bytes, 0);
    await c.shard.batch([
      c.shard
        .prepare(
          "UPDATE publicacion SET estado = 'reemplazada' WHERE org_id = ? AND estado = 'publicada'",
        )
        .bind(c.org),
      c.shard
        .prepare(
          "UPDATE publicacion SET estado = 'publicada', archivos = ?, bytes = ?, huella = ?, publicada = ? WHERE org_id = ? AND version = ?",
        )
        .bind(archivos.size, bytes, m.huella, c.ahora, c.org, version),
      c.shard
        .prepare('UPDATE tienda SET version_publicada = ? WHERE org_id = ?')
        .bind(version, c.org),
    ]);
    return { estado: 'publicada', version, archivos: archivos.size, nuevos };
  } catch (e) {
    return await fallar(e instanceof Error ? e.message : String(e));
  }
}
