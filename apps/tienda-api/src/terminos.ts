/**
 * HU-T7.2: los términos del servicio y el contrato de transmisión que acepta el comercio, y la
 * cláusula de custodia de sus llaves de Bold (HU-T11.2), en la API.
 *
 * - **CA1.** Aceptar guarda en la fila de la tienda la huella del texto, cuándo y quién, y deja la
 *   fila del registro con la misma huella, en un solo lote. Solo se acepta la versión vigente: si
 *   el texto cambió mientras se leía, la huella no coincide y responde «cambiado».
 * - **CA3.** `aceptados` es lo que preguntan publicar y conectar el cobro: sin la huella vigente
 *   en la fila de la tienda, la API lo rechaza aunque la pantalla no lo pida.
 */
import {
  type CualTexto,
  huellaDelTexto,
  type PlantillaDelComercio,
  type TextoParaAceptar,
  textoParaAceptar,
} from '@ed1/tienda-schema/comercio';
import { z } from 'zod';
import plantilla from '../../../content/tienda/comercio/terminos.json' with { type: 'json' };
import politica from '../../../content/tienda/privacidad/politica.json' with { type: 'json' };
import {
  esCambiado,
  esOperacionRepetida,
  guardarOperacion,
  type Quien,
  type Resultado,
  SI_CAMBIO,
  yaAplicada,
} from './catalogo.ts';
import { anotar } from './registro.ts';

/** La fecha y si es borrador: el panel lo dice arriba mientras un abogado no lo revise. */
export const ESTADO_DEL_TEXTO = {
  fecha: plantilla.fecha,
  estado: plantilla.estado,
  revision: plantilla.revision,
} as const;

export interface Vigente extends TextoParaAceptar {
  huella: string;
}

let vigentes: Promise<Record<CualTexto, Vigente>> | null = null;
/** El texto vigente de cada uno, con su huella. Se arma una vez por instancia del Worker. */
export function textosVigentes(): Promise<Record<CualTexto, Vigente>> {
  vigentes ??= (async () => {
    const armar = async (cual: CualTexto): Promise<Vigente> => {
      const t = textoParaAceptar(plantilla as PlantillaDelComercio, politica.responsable, cual);
      return { ...t, huella: await huellaDelTexto(t.texto) };
    };
    return { terminos: await armar('terminos'), custodia: await armar('custodia') };
  })();
  return vigentes;
}

export interface EstadoDeLaAceptacion {
  /** La huella del texto vigente y si la tienda la aceptó. */
  terminos: { huella: string; version: string; aceptados: boolean };
  custodia: { huella: string; version: string; aceptada: boolean };
}

/** Lo que aceptó la tienda contra lo vigente. Una tienda que no existe no aceptó nada. */
export async function aceptacionDe(q: Pick<Quien, 'db' | 'org'>): Promise<EstadoDeLaAceptacion> {
  const v = await textosVigentes();
  const fila = await q.db
    .prepare('SELECT terminos_huella, custodia_huella FROM tienda WHERE org_id = ?')
    .bind(q.org)
    .first<{ terminos_huella: string | null; custodia_huella: string | null }>();
  return {
    terminos: {
      huella: v.terminos.huella,
      version: v.terminos.version,
      aceptados: fila?.terminos_huella === v.terminos.huella,
    },
    custodia: {
      huella: v.custodia.huella,
      version: v.custodia.version,
      aceptada: fila?.custodia_huella === v.custodia.huella,
    },
  };
}

export const SIN_TERMINOS = {
  estado: 'sin-terminos',
  motivo:
    'Antes de publicar o cobrar en línea, quien administra la tienda tiene que aceptar los términos del servicio vigentes, en Más › Términos del servicio.',
} as const;

const Aceptar = z.object({
  op: z.string().min(8).max(64),
  cual: z.enum(['terminos', 'custodia']),
  huella: z.string().regex(/^[0-9a-f]{64}$/),
});

const MOTIVO_OTRA_VERSION =
  'Este texto cambió mientras lo leías. Léelo otra vez: lo que vas a aceptar es la versión nueva.';

/**
 * CA1: aceptar el texto que se leyó, si es el vigente. Idempotente con `op`; aceptar otra vez la
 * misma versión no cambia la fecha de la primera aceptación.
 */
export async function aceptar(q: Quien, cuerpo: unknown): Promise<Resultado> {
  const r0 = Aceptar.safeParse(cuerpo);
  if (!r0.success) {
    return {
      estado: 'problemas',
      problemas: [{ campo: 'huella', mensaje: 'falta qué texto se aceptó' }],
    };
  }
  const d = r0.data;
  const previa = await yaAplicada(q, d.op);
  if (previa) return previa;
  const vigente = (await textosVigentes())[d.cual];
  if (d.huella !== vigente.huella) {
    return { estado: 'cambiado', motivo: MOTIVO_OTRA_VERSION, version: null };
  }
  const r: Resultado = { estado: 'guardado', id: d.cual, version: Number(vigente.version) };
  const columnas =
    d.cual === 'terminos'
      ? 'terminos_huella = ?1, terminos_aceptados = ?2, terminos_por = ?3'
      : 'custodia_huella = ?1, custodia_aceptada = ?2, custodia_por = ?3';
  const campo = d.cual === 'terminos' ? 'terminos_huella' : 'custodia_huella';
  try {
    await q.db.batch([
      q.db
        .prepare(
          `UPDATE tienda SET ${columnas}, actualizado = ?2 WHERE org_id = ?4 AND ${campo} IS NOT ?1`,
        )
        .bind(vigente.huella, q.instante, q.actor, q.org),
      q.db.prepare(SI_CAMBIO),
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: d.cual === 'terminos' ? 'terminos.aceptar' : 'custodia.aceptar',
        entidad: d.cual,
        entidadId: vigente.huella,
        antes: null,
        despues: { version: vigente.version },
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'terminos/aceptar', r),
    ]);
    return r;
  } catch (e) {
    // Ya estaba aceptada esta versión: no se escribe otra vez, y la respuesta es la misma.
    if (esCambiado(e)) return r;
    if (esOperacionRepetida(e)) return (await yaAplicada(q, d.op)) ?? r;
    throw e;
  }
}
