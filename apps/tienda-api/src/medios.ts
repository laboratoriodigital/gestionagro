/**
 * HU-T8.3: las fotos de un producto. El panel sube solo las derivadas que generó el teléfono (el
 * original no sale de él) y la API las guarda en el bucket público de las fotos (HU-T5.6), en
 * `<org>/<huella>/<ancho>.<formato>`, con caché inmutable: la huella es la del original, así que
 * la misma foto nunca se guarda dos veces.
 *
 * - CA1: el texto alternativo es obligatorio.
 * - CA2/CA3: el formato que se declara es el que tienen los bytes. Un PNG que dice ser WebP (lo
 *   que haría Safari si nadie mira) no se guarda.
 */
import type { SentenciaD1 } from '@ed1/d1';
import {
  ANCHOS_DE_DERIVADAS,
  BYTES_POR_DERIVADA,
  escribirFormatos,
  esDelFormato,
  FORMATOS_DE_FOTO,
  FOTOS_POR_PRODUCTO,
  type FormatoDeFoto,
  TIPO_DE_FOTO,
} from '@ed1/tienda-schema';
import type { Quien } from './catalogo.ts';
import { anotar } from './registro.ts';

/** Lo que la API usa del bucket de las fotos. */
export interface BucketDeFotos {
  put(
    clave: string,
    valor: ArrayBuffer,
    opciones: { httpMetadata: { contentType: string; cacheControl: string } },
  ): Promise<unknown>;
}

type Problema = { campo: string; mensaje: string };
export type ResultadoDeFoto =
  | { estado: 'guardado'; id: string; formato: FormatoDeFoto; anchos: number[] }
  | { estado: 'problemas'; problemas: Problema[] }
  | { estado: 'quitada'; id: string }
  | { estado: 'asignada'; id: string; variante: string | null }
  | { estado: 'no-existe'; motivo: string };

const HUELLA = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const texto = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
const entero = (v: FormDataEntryValue | null) => {
  const n = Number(texto(v));
  return Number.isInteger(n) && n > 0 && n <= 20_000 ? n : null;
};

/** `medios/subir`: un formulario con los datos de la foto y un archivo por derivada (`d400`…). */
export async function subirFoto(
  q: Quien,
  bucket: BucketDeFotos,
  datos: FormData,
  /**
   * HU-T5.13 y HU-T5.14: una imagen de la tienda (el logo, el favicon, el hero), no de un producto:
   * se sube igual, por huella, y el panel la guarda en su ajuste. No lleva fila en `medio`.
   */
  opciones: { deLaTienda?: boolean } = {},
): Promise<ResultadoDeFoto> {
  const problemas: Problema[] = [];
  const producto = texto(datos.get('producto'));
  const huella = texto(datos.get('huella'));
  const alt = texto(datos.get('alt'));
  const formato = texto(datos.get('formato')) as FormatoDeFoto;
  const ancho = entero(datos.get('ancho'));
  const alto = entero(datos.get('alto'));
  if (!opciones.deLaTienda && !ID.test(producto))
    problemas.push({ campo: 'producto', mensaje: 'falta el producto' });
  if (!HUELLA.test(huella))
    problemas.push({ campo: 'huella', mensaje: 'falta la huella de la foto' });
  if (alt.length < 3 || alt.length > 300) {
    problemas.push({
      campo: 'alt',
      mensaje: 'describe la foto en pocas palabras, para quien no la puede ver',
    });
  }
  if (!FORMATOS_DE_FOTO.includes(formato))
    problemas.push({ campo: 'formato', mensaje: 'el formato va en webp o jpeg' });
  if (ancho === null || alto === null)
    problemas.push({ campo: 'ancho', mensaje: 'faltan las medidas de la foto' });

  const derivadas: { ancho: number; bytes: ArrayBuffer }[] = [];
  for (const a of ANCHOS_DE_DERIVADAS) {
    const archivo = datos.get(`d${a}`);
    if (archivo === null) continue;
    if (typeof archivo === 'string') {
      problemas.push({ campo: `d${a}`, mensaje: 'la derivada no es un archivo' });
      continue;
    }
    if (ancho !== null && a > ancho) {
      problemas.push({
        campo: `d${a}`,
        mensaje: `la foto mide ${ancho} px: no tiene derivada de ${a}`,
      });
      continue;
    }
    if (archivo.size > BYTES_POR_DERIVADA) {
      problemas.push({ campo: `d${a}`, mensaje: `la derivada de ${a} px pesa demasiado` });
      continue;
    }
    const bytes = await archivo.arrayBuffer();
    if (FORMATOS_DE_FOTO.includes(formato) && !esDelFormato(new Uint8Array(bytes), formato)) {
      problemas.push({
        campo: `d${a}`,
        mensaje: `la derivada de ${a} px no es ${formato}: el teléfono la hizo en otro formato`,
      });
      continue;
    }
    derivadas.push({ ancho: a, bytes });
  }
  if (!derivadas.some((d) => d.ancho === 400) && !problemas.some((p) => p.campo.startsWith('d'))) {
    problemas.push({
      campo: 'd400',
      mensaje:
        ancho !== null && ancho < 400
          ? 'la foto es muy pequeña: necesita al menos 400 px de ancho'
          : 'falta la derivada de 400 px',
    });
  }
  if (problemas.length > 0) return { estado: 'problemas', problemas };

  if (opciones.deLaTienda) {
    for (const d of derivadas) {
      await bucket.put(`${q.org}/${huella}/${d.ancho}.${formato}`, d.bytes, {
        httpMetadata: {
          contentType: TIPO_DE_FOTO[formato],
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
    }
    return { estado: 'guardado', id: huella, formato, anchos: derivadas.map((d) => d.ancho) };
  }

  const fila = await q.db
    .prepare(
      `SELECT p.nombre, (SELECT count(*) FROM medio m WHERE m.org_id = ? AND m.producto_id = p.id) AS fotos,
              (SELECT 1 FROM medio m WHERE m.org_id = ? AND m.producto_id = p.id AND m.id = ?) AS ya
         FROM producto p WHERE p.org_id = ? AND p.id = ? AND p.borrado IS NULL`,
    )
    .bind(q.org, q.org, huella, q.org, producto)
    .first<{ nombre: string; fotos: number; ya: number | null }>();
  if (!fila) return { estado: 'no-existe', motivo: 'Ese producto ya no está.' };
  const anchos = derivadas.map((d) => d.ancho);
  // La misma foto otra vez: ya está, con sus derivadas. Responder igual hace la subida repetible.
  if (fila.ya) return { estado: 'guardado', id: huella, formato, anchos };
  if (fila.fotos >= FOTOS_POR_PRODUCTO) {
    return {
      estado: 'problemas',
      problemas: [
        { campo: 'producto', mensaje: `un producto lleva hasta ${FOTOS_POR_PRODUCTO} fotos` },
      ],
    };
  }

  // Primero las derivadas, después la fila: una fila nunca apunta a una foto que no está.
  for (const d of derivadas) {
    await bucket.put(`${q.org}/${huella}/${d.ancho}.${formato}`, d.bytes, {
      httpMetadata: {
        contentType: TIPO_DE_FOTO[formato],
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }
  const lote: SentenciaD1[] = [
    q.db
      .prepare(
        `INSERT INTO medio (org_id, id, producto_id, posicion, alt, ancho, alto, formatos, creado)
         VALUES (?, ?, ?, (SELECT coalesce(max(posicion), -1) + 1 FROM medio WHERE org_id = ? AND producto_id = ?), ?, ?, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
      )
      .bind(
        q.org,
        huella,
        producto,
        q.org,
        producto,
        alt,
        ancho,
        alto,
        escribirFormatos(
          formato,
          Object.fromEntries(derivadas.map((d) => [d.ancho, d.bytes.byteLength])),
        ),
        q.instante,
      ),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'medio.subir',
      entidad: 'medio',
      entidadId: huella,
      antes: null,
      despues: { nombre: fila.nombre, alt, formato, anchos },
      instante: q.instante,
    }),
  ];
  await q.db.batch(lote);
  return { estado: 'guardado', id: huella, formato, anchos };
}

/**
 * `medios/quitar`: la foto deja de ser del producto. Sus derivadas se quedan en el bucket: son por
 * huella y otro producto puede usar la misma foto (HU-T17.2 decide cuándo se borran).
 */
export async function quitarFoto(q: Quien, cuerpo: unknown): Promise<ResultadoDeFoto> {
  const c = (cuerpo ?? {}) as { producto?: unknown; id?: unknown };
  if (
    typeof c.producto !== 'string' ||
    !ID.test(c.producto) ||
    typeof c.id !== 'string' ||
    !HUELLA.test(c.id)
  ) {
    return { estado: 'problemas', problemas: [{ campo: 'id', mensaje: 'falta la foto' }] };
  }
  const fila = await q.db
    .prepare(
      `SELECT m.alt, m.formatos, p.nombre FROM medio m JOIN producto p ON p.org_id = m.org_id AND p.id = m.producto_id
        WHERE m.org_id = ? AND m.producto_id = ? AND m.id = ?`,
    )
    .bind(q.org, c.producto, c.id)
    .first<{ alt: string; formatos: string; nombre: string }>();
  if (!fila) return { estado: 'no-existe', motivo: 'Esa foto ya no está.' };
  await q.db.batch([
    q.db
      .prepare('DELETE FROM medio WHERE org_id = ? AND producto_id = ? AND id = ?')
      .bind(q.org, c.producto, c.id),
    await anotar(q.db, {
      org: q.org,
      actor: q.actor,
      accion: 'medio.quitar',
      entidad: 'medio',
      entidadId: c.id,
      antes: { nombre: fila.nombre, alt: fila.alt },
      despues: null,
      instante: q.instante,
    }),
  ]);
  return { estado: 'quitada', id: c.id };
}

/**
 * HU-T5.9 CA1: la foto de una combinación (`medio.variante_id`, que ya existía). Al elegir esa
 * combinación, la ficha la muestra. `variante: null` la vuelve una foto general.
 */
export async function fotoDeLaVariante(q: Quien, cuerpo: unknown): Promise<ResultadoDeFoto> {
  const c = (cuerpo ?? {}) as { producto?: unknown; id?: unknown; variante?: unknown };
  if (
    typeof c.producto !== 'string' ||
    !ID.test(c.producto) ||
    typeof c.id !== 'string' ||
    !HUELLA.test(c.id) ||
    (c.variante !== null && (typeof c.variante !== 'string' || !ID.test(c.variante)))
  ) {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'variante', mensaje: 'falta la foto o la combinación' }],
    };
  }
  const variante = c.variante as string | null;
  if (variante) {
    const suya = await q.db
      .prepare(
        'SELECT 1 AS si FROM variante WHERE org_id = ? AND id = ? AND producto_id = ? AND activa = 1',
      )
      .bind(q.org, variante, c.producto)
      .first<{ si: number }>();
    if (!suya) return { estado: 'no-existe', motivo: 'Esa combinación ya no está.' };
  }
  const r = await q.db
    .prepare('UPDATE medio SET variante_id = ? WHERE org_id = ? AND producto_id = ? AND id = ?')
    .bind(variante, q.org, c.producto, c.id)
    .run();
  if ((r.meta?.changes ?? 0) === 0) return { estado: 'no-existe', motivo: 'Esa foto ya no está.' };
  return { estado: 'asignada', id: c.id, variante };
}
