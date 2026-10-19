/**
 * HU-T11.2: las llaves de Bold del comercio, desde la pantalla Cobro del panel (TIENDA-3.0 §9.2).
 *
 * - **CA1.** Antes de pegarlas, la tienda acepta los términos (HU-T7.2) y la cláusula de custodia,
 *   con su huella en el registro. Pegarlas pide entrada reciente (`cobro.gestionar`, la matriz).
 *   Se cifran con la DEK `credenciales` de la tienda (`credenciales.ts`) y el panel solo ve sus
 *   últimos 4 caracteres.
 * - **CA2.** La de identidad se prueba contra `payment-voucher` con una referencia que no existe:
 *   `NO_TRANSACTION_FOUND` es una llave válida; 401 o 403, no, y se dice así. Si Bold no responde
 *   no se guarda nada y se dice. La secreta solo se prueba con un cobro: es el cobro de prueba
 *   guiado (HU-T11.3).
 * - **CA3.** `faltantesDelCobro`: con el pago en línea encendido, lo que falta para cobrar, en
 *   palabras, para decirlo arriba y en rojo.
 * - **CA4.** Las llaves no salen en ninguna respuesta, ni en el registro, ni en un log, ni en lo
 *   que se hornea: aquí solo entran, se cifran y se comparan.
 */
import type { BaseD1 } from '@ed1/d1';
import { ErrorDeBold, proveedorBold } from '@ed1/pagos';
import { z } from 'zod';
import {
  esOperacionRepetida,
  guardarOperacion,
  type Quien,
  type Resultado,
  yaAplicada,
} from './catalogo.ts';
import {
  type Ambiente,
  dekDeCredenciales,
  guardarCredencial,
  llavesDeBold,
} from './credenciales.ts';
import { kekDelEntorno } from './llaves.ts';
import { anotar } from './registro.ts';
import { aceptacionDe } from './terminos.ts';

export const AMBIENTES: readonly Ambiente[] = ['pruebas', 'produccion'];
export const NOMBRE_DEL_AMBIENTE: Record<Ambiente, string> = {
  pruebas: 'pruebas',
  produccion: 'producción',
};

/** Una llave como la ve el panel: sus últimos 4 caracteres y cuándo se guardó y se comprobó. */
export interface LlaveVista {
  fin: string;
  guardada: string;
  verificada: string | null;
}

export interface CobroDelPanel {
  terminos: boolean;
  custodia: boolean;
  /** El modo de pedido de la tienda (`venta.modo`); sin decir, por WhatsApp. */
  modo: 'whatsapp' | 'en_linea' | 'ambos';
  /** El ambiente en que cobra (`cobro.ambiente`): pruebas mientras no diga producción. */
  ambiente: Ambiente;
  llaves: Record<Ambiente, { identidad: LlaveVista | null; secreta: LlaveVista | null }>;
  /** CA3: lo que falta para cobrar en línea, en palabras; vacío si no cobra en línea. */
  faltan: string[];
  /** HU-T11.3: el cobro de prueba guiado. */
  prueba: EstadoDeLaPrueba;
}

/**
 * HU-T11.3: en qué va el cobro de prueba. `aprobada` es el instante en que un aviso firmado de Bold
 * aprobó el primero; `ultimo`, el cobro de pruebas más reciente, para decir si se pagó y el aviso
 * no llegó (entonces la dirección de los avisos en Bold está mal).
 */
export interface EstadoDeLaPrueba {
  aprobada: string | null;
  ultimo: { id: string; estado: string; creado: string } | null;
}

export async function estadoDeLaPrueba(db: BaseD1, org: string): Promise<EstadoDeLaPrueba> {
  const [tienda, ultimo] = await Promise.all([
    db
      .prepare('SELECT prueba_aprobada FROM tienda WHERE org_id = ?')
      .bind(org)
      .first<{ prueba_aprobada: string | null }>(),
    db
      .prepare(
        `SELECT id, estado, creado FROM cobro INDEXED BY cobro_de_prueba
          WHERE org_id = ? AND ambiente = 'pruebas' ORDER BY creado DESC LIMIT 1`,
      )
      .bind(org)
      .first<{ id: string; estado: string; creado: string }>(),
  ]);
  return { aprobada: tienda?.prueba_aprobada ?? null, ultimo: ultimo ?? null };
}

/**
 * HU-T11.3 CA3: por qué la tienda todavía no puede cobrar de verdad; `null` si ya puede. Lo usa
 * guardar los ajustes, así que la API lo niega aunque la pantalla no lo pida.
 */
export async function motivoParaNoCobrarDeVerdad(db: BaseD1, org: string): Promise<string | null> {
  const [prueba, { results }] = await Promise.all([
    estadoDeLaPrueba(db, org),
    db
      .prepare(
        `SELECT campo FROM credencial WHERE org_id = ? AND proveedor = 'bold'
          AND ambiente = 'produccion' AND campo IN ('identidad', 'secreta')`,
      )
      .bind(org)
      .all<{ campo: string }>(),
  ]);
  if (!prueba.aprobada)
    return 'Antes de cobrar de verdad, haz el cobro de prueba desde tu tienda y espera a que Bold avise que se aprobó (Más › Cobro en línea).';
  if (results.length !== 2)
    return 'Antes de cobrar de verdad, pega tus llaves de producción de Bold (Más › Cobro en línea).';
  return null;
}

async function modoYAmbiente(db: BaseD1, org: string) {
  const { results } = await db
    .prepare("SELECT seccion, datos FROM ajuste WHERE org_id = ? AND seccion IN ('venta', 'cobro')")
    .bind(org)
    .all<{ seccion: string; datos: string }>();
  const de = (s: string) =>
    JSON.parse(results.find((f) => f.seccion === s)?.datos ?? '{}') as Record<string, unknown>;
  const modo = de('venta')['modo'];
  return {
    modo: modo === 'en_linea' || modo === 'ambos' ? modo : 'whatsapp',
    ambiente: de('cobro')['ambiente'] === 'produccion' ? 'produccion' : 'pruebas',
  } as const;
}

/** Lo que el panel ve de las llaves: nunca su valor. */
export async function leerElCobro(q: Pick<Quien, 'db' | 'org'>): Promise<CobroDelPanel> {
  const [a, m, prueba, { results }] = await Promise.all([
    aceptacionDe(q),
    modoYAmbiente(q.db, q.org),
    estadoDeLaPrueba(q.db, q.org),
    q.db
      .prepare(
        `SELECT ambiente, campo, huella, guardada, verificada FROM credencial
          WHERE org_id = ? AND proveedor = 'bold' AND campo IN ('identidad', 'secreta')`,
      )
      .bind(q.org)
      .all<{
        ambiente: Ambiente;
        campo: 'identidad' | 'secreta';
        huella: string;
        guardada: string;
        verificada: string | null;
      }>(),
  ]);
  const llaves = {
    pruebas: { identidad: null, secreta: null },
    produccion: { identidad: null, secreta: null },
  } as CobroDelPanel['llaves'];
  for (const f of results) {
    llaves[f.ambiente][f.campo] = { fin: f.huella, guardada: f.guardada, verificada: f.verificada };
  }
  const faltan: string[] = [];
  if (m.modo !== 'whatsapp') {
    const amb = NOMBRE_DEL_AMBIENTE[m.ambiente];
    if (!a.terminos.aceptados) faltan.push('aceptar los términos del servicio');
    if (!a.custodia.aceptada) faltan.push('autorizar que se guarden tus llaves de Bold');
    if (!llaves[m.ambiente].identidad) faltan.push(`la llave de identidad de ${amb}`);
    if (!llaves[m.ambiente].secreta) faltan.push(`la llave secreta de ${amb}`);
  }
  return {
    terminos: a.terminos.aceptados,
    custodia: a.custodia.aceptada,
    ...m,
    llaves,
    faltan,
    prueba,
  };
}

/** Lo que dijo Bold de una llave de identidad (CA2). */
export type Comprobacion = 'valida' | 'invalida' | 'sin-respuesta';

/**
 * CA2: la llave de identidad contra `payment-voucher`, con una referencia que no existe. 404
 * (`NO_TRANSACTION_FOUND`) es una llave que Bold reconoce; 401 o 403, una que no.
 */
export async function comprobarIdentidad(
  identidad: string,
  ambiente: Ambiente,
  fetchFn: typeof fetch,
  referencia: string,
): Promise<Comprobacion> {
  try {
    const r = await proveedorBold({ identidad, secreta: '', ambiente }, fetchFn).consultar(
      referencia,
    );
    return r.crudo === 'NO_TRANSACTION_FOUND' ? 'valida' : 'sin-respuesta';
  } catch (e) {
    if (e instanceof ErrorDeBold && (e.estado === 401 || e.estado === 403)) return 'invalida';
    return 'sin-respuesta';
  }
}

/** Una llave de Bold: letras, números, guiones y guiones bajos, sin espacios. */
const llave = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{16,200}$/, 'no parece una llave de Bold: cópiala otra vez, completa');

const Guardar = z
  .object({
    op: z.string().min(8).max(64),
    ambiente: z.enum(['pruebas', 'produccion']),
    identidad: llave,
    secreta: llave,
  })
  .refine((d) => d.identidad !== d.secreta, {
    path: ['secreta'],
    message: 'es igual a la de identidad: en Bold son dos llaves distintas',
  });

export type ResultadoDeLlaves =
  | Resultado
  | { estado: 'sin-terminos' | 'sin-custodia' | 'sin-llave' | 'sin-respuesta'; motivo: string };

const SIN_CUSTODIA =
  'Antes de pegar tus llaves, autoriza que se guarden: es la cláusula de arriba, en esta misma pantalla.';
const SIN_RESPUESTA =
  'Bold no respondió para comprobar tu llave de identidad. No guardamos nada: vuelve a intentar en unos minutos.';

/** CA1 y CA2: guardar las dos llaves de un ambiente, cifradas, con la de identidad comprobada. */
export async function guardarLlaves(
  q: Quien,
  kekTexto: string | undefined,
  cuerpo: unknown,
  comprobar: (identidad: string, ambiente: Ambiente) => Promise<Comprobacion>,
): Promise<ResultadoDeLlaves> {
  const r0 = Guardar.safeParse(cuerpo);
  if (!r0.success) {
    return {
      estado: 'problemas',
      problemas: r0.error.issues.map((i) => ({
        campo: i.path.map(String).join('.') || 'identidad',
        mensaje: i.message,
      })),
    };
  }
  const d = r0.data;
  const previa = await yaAplicada<ResultadoDeLlaves>(q, d.op);
  if (previa) return previa;
  const a = await aceptacionDe(q);
  if (!a.terminos.aceptados) {
    return {
      estado: 'sin-terminos',
      motivo:
        'Antes de conectar tu cuenta de Bold, acepta los términos del servicio, en Más › Términos del servicio.',
    };
  }
  if (!a.custodia.aceptada) return { estado: 'sin-custodia', motivo: SIN_CUSTODIA };
  const kek = await kekDelEntorno(kekTexto);
  if (!kek) {
    console.error('tienda-api: sin la KEK no se pueden guardar las llaves de Bold');
    return {
      estado: 'sin-llave',
      motivo: 'No pudimos guardar tus llaves ahora. Vuelve a intentar más tarde.',
    };
  }
  const comprobada = await comprobar(d.identidad, d.ambiente);
  if (comprobada === 'invalida') {
    return {
      estado: 'problemas',
      problemas: [
        {
          campo: 'identidad',
          mensaje: `Bold no reconoce esta llave de identidad de ${NOMBRE_DEL_AMBIENTE[d.ambiente]}. Cópiala otra vez desde tu panel de Bold, en el ambiente de ${NOMBRE_DEL_AMBIENTE[d.ambiente]}.`,
        },
      ],
    };
  }
  if (comprobada === 'sin-respuesta') return { estado: 'sin-respuesta', motivo: SIN_RESPUESTA };

  const dek = await dekDeCredenciales(q.db, q.org, kek, q.instante);
  const r: Resultado = { estado: 'guardado', id: d.ambiente, version: 1 };
  const campo = (c: 'identidad' | 'secreta', valor: string) =>
    guardarCredencial(
      q.db,
      dek,
      { org: q.org, proveedor: 'bold', ambiente: d.ambiente, campo: c, valor },
      q.instante,
    );
  try {
    await q.db.batch([
      await campo('identidad', d.identidad),
      await campo('secreta', d.secreta),
      q.db
        .prepare(
          `UPDATE credencial SET verificada = ? WHERE org_id = ? AND proveedor = 'bold'
            AND ambiente = ? AND campo = 'identidad'`,
        )
        .bind(q.instante, q.org, d.ambiente),
      // CA4: el registro dice qué se guardó, nunca la llave.
      await anotar(q.db, {
        org: q.org,
        actor: q.actor,
        accion: 'cobro.llaves',
        entidad: 'credencial',
        entidadId: `bold-${d.ambiente}`,
        antes: null,
        despues: { ambiente: d.ambiente },
        instante: q.instante,
      }),
      guardarOperacion(q, d.op, 'cobro/llaves', r),
    ]);
    return r;
  } catch (e) {
    if (esOperacionRepetida(e)) return (await yaAplicada<ResultadoDeLlaves>(q, d.op)) ?? r;
    throw e;
  }
}

/** «Probar»: la llave de identidad guardada, otra vez contra Bold (CA2). No cambia las llaves. */
export async function probarLlaves(
  q: Pick<Quien, 'db' | 'org' | 'instante'>,
  kekTexto: string | undefined,
  cuerpo: unknown,
  comprobar: (identidad: string, ambiente: Ambiente) => Promise<Comprobacion>,
): Promise<
  | { estado: 'valida' | 'invalida' | 'sin-respuesta'; motivo: string }
  | { estado: 'sin-llaves' | 'problemas'; motivo: string }
> {
  const p = z.object({ ambiente: z.enum(['pruebas', 'produccion']) }).safeParse(cuerpo);
  if (!p.success) return { estado: 'problemas', motivo: 'Falta el ambiente.' };
  const ambiente = p.data.ambiente;
  const nombre = NOMBRE_DEL_AMBIENTE[ambiente];
  const kek = await kekDelEntorno(kekTexto);
  const llaves = kek ? await llavesDeBold(q.db, q.org, ambiente, kek) : null;
  if (!llaves) {
    return { estado: 'sin-llaves', motivo: `No hay llaves de ${nombre} guardadas para probar.` };
  }
  const r = await comprobar(llaves.identidad, ambiente);
  if (r === 'valida') {
    await q.db
      .prepare(
        `UPDATE credencial SET verificada = ? WHERE org_id = ? AND proveedor = 'bold'
          AND ambiente = ? AND campo = 'identidad'`,
      )
      .bind(q.instante, q.org, ambiente)
      .run();
    return { estado: r, motivo: `Bold reconoce tu llave de identidad de ${nombre}.` };
  }
  if (r === 'invalida') {
    return {
      estado: r,
      motivo: `Bold ya no reconoce tu llave de identidad de ${nombre}: puede que la hayas cambiado en Bold. Pega las nuevas.`,
    };
  }
  return {
    estado: r,
    motivo: 'Bold no respondió para comprobar tu llave. Vuelve a intentar en unos minutos.',
  };
}
