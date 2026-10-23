/**
 * Los correos del CORE (HU-C10.1, PLATAFORMA §4.11): el enlace para entrar (HU-C10.2) y los avisos
 * de vencimiento del plan (HU-C10.3), por `@ed1/correo`, el adaptador que comparte con la Tienda.
 *
 * - **El proveedor sale del destino**, como en la Tienda (HU-T18.4): producción manda con Resend y
 *   nunca cae a Gmail; staging, con la cuenta de Gmail. Sin su configuración, cada correo queda
 *   «no disponible» (CA3, P1).
 * - **El remitente, del producto** (decisión del dueño del 23 oct 2026): un producto con dominio de
 *   su marca verificado lo declara en `productos.json › correo` y sale de ahí con su nombre
 *   («TiendaPro»); los demás salen de `cuenta@laboratorio-digital.com`, con el nombre del producto
 *   delante («CultivoPro vía Laboratorio Digital»). Mientras ese dominio no esté verificado en
 *   Resend, Resend lo rechaza y el correo queda «no disponible»: entrar con Google sigue igual.
 * - **Una fila por correo** en `correo_del_core` (0012): su clave dice qué correo es, así que dos
 *   corridas del cron no mandan dos avisos, y lleva la cuenta del cupo del día.
 */
import {
  type Correo,
  type CorreoTransaccional,
  correoGmail,
  correoResend,
  type MotivoSinEnviar,
  NOMBRE_DE_LA_PLATAFORMA,
} from '@ed1/correo';
import type { BaseD1 } from '@ed1/d1';
import type { Producto } from '@ed1/productos';

/** El remitente de los productos sin dominio propio (decisión del dueño del 23 oct 2026). */
export const REMITENTE_DEL_CORE = 'cuenta@laboratorio-digital.com';

/**
 * De los 400 diarios de la cuenta de Gmail, 100 son del CORE y 300 de la Tienda (PLATAFORMA §4.11,
 * `apps/tienda-api/src/correos.ts`). Con Resend se mantiene el reparto: su capa gratis da 100 al día
 * a toda la cuenta, y el CORE no debe quitarle a la Tienda lo que ella cuenta como suyo.
 */
export const TOPE_DIARIO_DEL_CORE = 100;
/** Los intentos de un aviso que no salió; el enlace se intenta una vez, mientras la persona espera. */
export const INTENTOS_DE_UN_AVISO = 3;

/** Lo que el CORE necesita del ambiente para mandar correos. */
export interface EnvDeCorreo {
  DESTINO?: string;
  CORREO_GMAIL_CLIENTE_ID?: string;
  CORREO_GMAIL_CLIENTE_SECRETO?: string;
  CORREO_GMAIL_REFRESH?: string;
  CORREO_GMAIL_REMITENTE?: string;
  RESEND_API_KEY?: string;
}

/** Quién firma el correo: la marca del producto si tiene remitente propio, o la de la plataforma. */
export function firmaDelProducto(producto: Pick<Producto, 'nombre' | 'correo'>): {
  marca: string;
  nombre: string | undefined;
} {
  return producto.correo
    ? { marca: producto.nombre, nombre: undefined }
    : { marca: NOMBRE_DE_LA_PLATAFORMA, nombre: producto.nombre };
}

/**
 * El correo del CORE para un producto, con el `fetch` que se le dé. Cada correo sale firmado como
 * su producto (`firmaDelProducto`), sin que quien llama tenga que decirlo.
 */
export function correoDelCore(
  env: EnvDeCorreo,
  producto: Pick<Producto, 'nombre' | 'correo'>,
  fetchFn: typeof fetch,
): CorreoTransaccional {
  const firma = firmaDelProducto(producto);
  const proveedor = proveedorDelCore(env, producto, firma.marca, fetchFn);
  return {
    proveedor: proveedor.proveedor,
    disponible: proveedor.disponible,
    enviar: (c) => proveedor.enviar({ ...(firma.nombre ? { nombre: firma.nombre } : {}), ...c }),
  };
}

function proveedorDelCore(
  env: EnvDeCorreo,
  producto: Pick<Producto, 'correo'>,
  marca: string,
  fetchFn: typeof fetch,
): CorreoTransaccional {
  return env.DESTINO === 'produccion'
    ? correoResend(
        {
          clave: env.RESEND_API_KEY,
          remitente: producto.correo?.remitente ?? REMITENTE_DEL_CORE,
          marca,
        },
        fetchFn,
      )
    : correoGmail(
        {
          clienteId: env.CORREO_GMAIL_CLIENTE_ID,
          clienteSecreto: env.CORREO_GMAIL_CLIENTE_SECRETO,
          refresh: env.CORREO_GMAIL_REFRESH,
          remitente: env.CORREO_GMAIL_REMITENTE,
          marca,
        },
        fetchFn,
      );
}

export type ResultadoDeUnCorreo =
  | { estado: 'enviado' }
  | { estado: 'repetido' }
  | { estado: 'fallido'; motivo: MotivoSinEnviar };

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Manda un correo a lo sumo una vez por clave. Si esa clave ya salió o está saliendo, no lo manda
 * (`repetido`). Si falló, lo vuelve a intentar hasta `intentos` veces. Lo que no salió no gasta el
 * cupo del día. Un `enviando` que no llegó a cerrarse (el Worker se cayó a mitad) queda así y no se
 * reenvía: mejor un aviso de menos que uno repetido (como en la Tienda).
 *
 * Escribe 2 filas por correo enviado (la fila y su índice) más 1 al cerrarla.
 */
export async function enviarUnaVez(
  db: BaseD1,
  correo: CorreoTransaccional,
  datos: { clave: string; tipo: 'enlace' | 'aviso'; intentos?: number },
  mensaje: Correo,
  ahora: number,
): Promise<ResultadoDeUnCorreo> {
  const dia = iso(ahora).slice(0, 10);
  const previa = await db
    .prepare('SELECT estado, intentos FROM correo_del_core WHERE clave = ?')
    .bind(datos.clave)
    .first<{ estado: string; intentos: number }>();
  if (previa && previa.estado !== 'fallido') return { estado: 'repetido' };
  if (previa && previa.intentos >= (datos.intentos ?? 1)) return { estado: 'repetido' };
  // Sin configuración o sin cupo no hubo intento: no se escribe nada ni se gasta uno de los
  // intentos. El cron corre cada 15 minutos, y escribir en cada vuelta gastaría filas por nada.
  if (!correo.disponible) return { estado: 'fallido', motivo: 'no-disponible' };
  const usados = await db
    .prepare(
      "SELECT count(*) AS n FROM correo_del_core WHERE dia = ? AND estado IN ('enviando', 'enviado')",
    )
    .bind(dia)
    .first<{ n: number }>();
  if ((usados?.n ?? 0) >= TOPE_DIARIO_DEL_CORE) return { estado: 'fallido', motivo: 'tope' };
  await marcar(db, datos, dia, ahora, previa !== null);
  const r = await correo.enviar(mensaje);
  await db
    .prepare('UPDATE correo_del_core SET estado = ?, motivo = ?, actualizado = ? WHERE clave = ?')
    .bind(r.enviado ? 'enviado' : 'fallido', r.enviado ? null : r.motivo, iso(ahora), datos.clave)
    .run();
  if (!r.enviado) {
    // El detalle va al log sin la dirección: `@ed1/correo` nunca la pone en él.
    console.error(`agro-core: el correo ${datos.tipo} no salió (${r.motivo}: ${r.detalle})`);
    return { estado: 'fallido', motivo: r.motivo };
  }
  return { estado: 'enviado' };
}

/** Deja la fila en `enviando` antes de llamar al proveedor: cuenta como intento y como cupo. */
async function marcar(
  db: BaseD1,
  datos: { clave: string; tipo: 'enlace' | 'aviso' },
  dia: string,
  ahora: number,
  existia: boolean,
): Promise<void> {
  if (existia) {
    await db
      .prepare(
        "UPDATE correo_del_core SET estado = 'enviando', motivo = NULL, dia = ?, intentos = intentos + 1, actualizado = ? WHERE clave = ?",
      )
      .bind(dia, iso(ahora), datos.clave)
      .run();
    return;
  }
  await db
    .prepare(
      "INSERT INTO correo_del_core (clave, tipo, dia, estado, motivo, intentos, creado, actualizado) VALUES (?, ?, ?, 'enviando', NULL, 1, ?, ?)",
    )
    .bind(datos.clave, datos.tipo, dia, iso(ahora), iso(ahora))
    .run();
}
