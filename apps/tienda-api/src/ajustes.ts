/**
 * HU-T10.3: los ajustes de la tienda, por sección (TIENDA-3.0 §5.7 y §12.3).
 *
 * - **Cada sección con su esquema (CA1).** Guardar una es atómico y lleva su `version`: si alguien
 *   guardó antes, responde «cambiado» con la de ahora, como el catálogo.
 * - **La entrada reciente (CA2).** Lo que la matriz pide para cada cambio sale de
 *   `accionesDeAjuste`: el WhatsApp, el modo de pedido y el cobro piden haber entrado hace menos de
 *   10 minutos. Si no, `reautenticar` y no se guarda nada.
 * - **El WhatsApp sin verificar (CA3).** `whatsappVerificado` lo pone el sistema, nunca el
 *   formulario: un número nuevo queda sin verificar hasta que el comercio abre el chat de prueba
 *   y confirma que es el suyo.
 * - **Vacío no es un valor de fábrica (CA4).** Lo vacío no se guarda; lo que falta para publicar
 *   lo dice `faltantes`, y la compuerta no publica.
 */
import {
  type Accion,
  accionesDeAjuste,
  aVersionVigente,
  type Decision,
  faltantes,
  NOMBRES_DE_SECCION,
  type Seccion,
  VERSION_VIGENTE,
  validarSeccion,
} from '@ed1/tienda-schema';
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
import { acortarConservacion, mesesDe } from './titular.ts';

interface FilaDeAjuste {
  seccion: string;
  esquema: number;
  datos: string;
  version: number;
}

async function leerFilas(q: Quien): Promise<Map<Seccion, FilaDeAjuste>> {
  const { results } = await q.db
    .prepare('SELECT seccion, esquema, datos, version FROM ajuste WHERE org_id = ?')
    .bind(q.org)
    .all<FilaDeAjuste>();
  return new Map(results.map((f) => [f.seccion as Seccion, f]));
}

/** Lo guardado, llevado al esquema vigente. Una sección que no existe es `{}`, nunca un defecto. */
const datosDe = (s: Seccion, f: FilaDeAjuste | undefined): Record<string, unknown> =>
  f ? aVersionVigente(s, f.esquema, JSON.parse(f.datos)) : {};

export interface AjustesDelPanel {
  secciones: Partial<Record<Seccion, { datos: Record<string, unknown>; version: number }>>;
  /** Lo que falta para publicar, campo por campo (`legal.razonSocial`). */
  faltantes: string[];
}

/** Las secciones que puede ver este rol: `cobro` solo quien puede gestionarlo. */
export async function leerAjustes(
  q: Quien,
  puedeVer: (s: Seccion) => boolean,
): Promise<AjustesDelPanel> {
  const filas = await leerFilas(q);
  const todas = Object.fromEntries(
    NOMBRES_DE_SECCION.map((s) => [s, datosDe(s, filas.get(s))]),
  ) as Record<Seccion, Record<string, unknown>>;
  return {
    secciones: Object.fromEntries(
      NOMBRES_DE_SECCION.filter(puedeVer).map((s) => [
        s,
        { datos: todas[s], version: filas.get(s)?.version ?? 0 },
      ]),
    ),
    faltantes: faltantes(todas),
  };
}

const Guardar = z.object({
  op: z.string().min(8).max(64),
  seccion: z.enum(NOMBRES_DE_SECCION as [Seccion, ...Seccion[]]),
  /** 0: la sección todavía no existe. */
  version: z.number().int().min(0),
  datos: z.record(z.string(), z.unknown()),
});

/** Quita lo vacío a cualquier profundidad: un texto vacío o un objeto sin nada no se guarda. */
export function sinVacios(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sinVacios);
  if (v === null || typeof v !== 'object')
    return typeof v === 'string' && v.trim() === '' ? undefined : v;
  const limpio: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    const y = sinVacios(x);
    if (y === undefined) continue;
    if (y !== null && typeof y === 'object' && !Array.isArray(y) && Object.keys(y).length === 0)
      continue;
    limpio[k] = y;
  }
  return limpio;
}

export type ResultadoDeAjuste =
  | Resultado
  | { estado: 'prohibido'; motivo: string }
  | { estado: 'reautenticar'; motivo: string };

export const PIDE_ENTRADA =
  'Para cambiar esto, vuelve a entrar con Google: lo que cambia por dónde llegan los pedidos o la plata pide haber entrado hace menos de 10 minutos.';

/**
 * Guardar una sección (CA1), con lo que la matriz pide para ese cambio (CA2). `decidir` dice, para
 * una acción, si este rol con esta entrada puede.
 */
export async function guardarAjuste(
  q: Quien,
  cuerpo: unknown,
  decidir: (accion: Accion) => Decision,
): Promise<ResultadoDeAjuste> {
  const r0 = Guardar.safeParse(cuerpo);
  if (!r0.success) {
    return {
      estado: 'problemas',
      problemas: r0.error.issues.map((i) => ({
        campo: i.path.map(String).join('.'),
        mensaje: i.message,
      })),
    };
  }
  const d = r0.data;
  const previa = await yaAplicada<ResultadoDeAjuste>(q, d.op);
  if (previa) return previa;
  const fila = (await leerFilas(q)).get(d.seccion);
  const antes = datosDe(d.seccion, fila);
  if ((fila?.version ?? 0) !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: fila?.version ?? 0 };

  const nuevos = sinVacios(d.datos) as Record<string, unknown>;
  // CA3: lo pone el sistema. Sigue verificado solo si el número no cambió.
  if (d.seccion === 'contacto') {
    nuevos['whatsappVerificado'] =
      antes['whatsapp'] === nuevos['whatsapp'] && antes['whatsappVerificado'] === true;
  }
  const decisiones = accionesDeAjuste(d.seccion, antes, nuevos).map(decidir);
  if (decisiones.includes('prohibido'))
    return { estado: 'prohibido', motivo: 'Tu rol no puede cambiar esta parte de los ajustes.' };
  if (decisiones.includes('reautenticar')) return { estado: 'reautenticar', motivo: PIDE_ENTRADA };

  const v = validarSeccion(d.seccion, nuevos);
  if (!v.ok) return { estado: 'problemas', problemas: v.problemas };

  const r: Resultado = { estado: 'guardado', id: d.seccion, version: d.version + 1 };
  // HU-T7.3 CA2: bajar los meses de conservación acorta también los contactos que ya están.
  const acortar =
    d.seccion === 'legal' && mesesDe(v.datos) < mesesDe(antes)
      ? [acortarConservacion(q, mesesDe(v.datos))]
      : [];
  const escribir =
    d.version === 0
      ? q.db
          .prepare(
            `INSERT INTO ajuste (org_id, seccion, esquema, datos, version, actualizado, actualizado_por)
             VALUES (?, ?, ?, ?, 1, ?, ?) ON CONFLICT (org_id, seccion) DO NOTHING`,
          )
          .bind(
            q.org,
            d.seccion,
            VERSION_VIGENTE[d.seccion],
            JSON.stringify(v.datos),
            q.instante,
            q.actor,
          )
      : q.db
          .prepare(
            `UPDATE ajuste SET esquema = ?, datos = ?, version = version + 1, actualizado = ?, actualizado_por = ?
              WHERE org_id = ? AND seccion = ? AND version = ?`,
          )
          .bind(
            VERSION_VIGENTE[d.seccion],
            JSON.stringify(v.datos),
            q.instante,
            q.actor,
            q.org,
            d.seccion,
            d.version,
          );
  try {
    await q.db.batch([
      escribir,
      q.db.prepare(SI_CAMBIO),
      ...acortar,
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'ajustes.guardar',
        entidad: 'ajuste',
        entidadId: d.seccion,
        antes: fila ? antes : null,
        despues: v.datos,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'ajustes/guardar', r),
    ]);
    return r;
  } catch (e) {
    if (esCambiado(e)) {
      const ahora = (await leerFilas(q)).get(d.seccion);
      return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: ahora?.version ?? 0 };
    }
    if (esOperacionRepetida(e)) return (await yaAplicada<ResultadoDeAjuste>(q, d.op)) ?? r;
    throw e;
  }
}

const Verificar = z.object({ op: z.string().min(8).max(64), version: z.number().int().min(1) });

/**
 * CA3: el comercio abrió el chat de prueba con su número y dice que es el suyo. Marca verificado
 * el número que está guardado en esa versión, no otro.
 */
export async function verificarWhatsapp(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Verificar.safeParse(cuerpo);
  if (!r0.success) {
    return { estado: 'problemas', problemas: [{ campo: 'version', mensaje: 'falta la versión' }] };
  }
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const fila = (await leerFilas(q)).get('contacto');
  const antes = datosDe('contacto', fila);
  if (!fila || typeof antes['whatsapp'] !== 'string') {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'contacto.whatsapp', mensaje: 'Primero guarda el número de WhatsApp.' }],
    };
  }
  if (fila.version !== d.version)
    return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: fila.version };
  const despues = { ...antes, whatsappVerificado: true };
  const r: Resultado = { estado: 'guardado', id: 'contacto', version: fila.version + 1 };
  try {
    await q.db.batch([
      q.db
        .prepare(
          `UPDATE ajuste SET datos = ?, version = version + 1, actualizado = ?, actualizado_por = ?
            WHERE org_id = ? AND seccion = 'contacto' AND version = ?`,
        )
        .bind(JSON.stringify(despues), q.instante, q.actor, q.org, d.version),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'ajustes.whatsapp_verificado',
        entidad: 'ajuste',
        entidadId: 'contacto',
        antes: null,
        despues: null,
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'ajustes/verificar-whatsapp', r),
    ]);
    return r;
  } catch (e) {
    if (esCambiado(e)) return { estado: 'cambiado', motivo: MOTIVO_CAMBIADO, version: null };
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    throw e;
  }
}
