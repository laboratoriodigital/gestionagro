/**
 * Consultar a Bold y conciliar (HU-T11.6, TIENDA-3.0 §9.5): el respaldo de los avisos (HU-T11.5),
 * para el comprador que pagó y cerró la página o el aviso que nunca llegó.
 *
 * - **Desde la página** (`POST /api/v1/cobros/estado`, con el token del cobro): si el cobro sigue
 *   esperando y la última consulta tiene más de 20 s, se le pregunta a Bold y se aplica (CA1).
 * - **El cron** revisa los cobros que esperan desde hace más de 5 minutos, con espera creciente
 *   (5, 15, 30 y 60 minutos desde la consulta anterior) y como mucho 20 consultas por tienda por
 *   vuelta. La cuenta tiene un solo cron, por hora (HU-T17.1, D-T10): la vuelta es cada hora, no
 *   cada 15 minutos, y la espera de 60 minutos queda igual.
 * - **A las 24 h sin noticias**, `vencido`; el pedido sigue por pagar, para que un aviso tardío
 *   todavía lo pague (§7.3). Un 429 de Bold salta esa tienda en la vuelta y se avisa (CA2).
 * - **Nunca se aprueba por la vuelta del navegador** (CA3): la página solo manda el token, y lo que
 *   vale es lo que Bold responde a la consulta autenticada. `NO_TRANSACTION_FOUND` y `PENDING`
 *   siguen esperando, y un estado que nadie leyó también, con un log que lo nombra.
 *
 * Lo que Bold diga se aplica igual que un aviso, en el mismo sitio (`aplicarRespuesta`).
 */
import type { SentenciaD1 } from '@ed1/d1';
import { ErrorDeBold, type EstadoEnElProveedor, type LlavesBold, proveedorBold } from '@ed1/pagos';
import { enviarTelegram } from '@ed1/telegram';
import { z } from 'zod';
import {
  aplicarRespuesta,
  avisarPrueba,
  type CobroDelAviso,
  type ContextoDelAviso,
  type RespuestaDeBold,
} from './avisos.ts';
import { avisarAlComprador } from './avisos-al-comprador.ts';
import { correosDeLaCelda, mandarResultadoDePrueba } from './correos.ts';
import { type Ambiente, llavesDeBold } from './credenciales.ts';
import { cerrarLinksVencidos } from './links.ts';
import { kekDelEntorno } from './llaves.ts';
import { sha256 } from './pedidos.ts';
import type { Tarea } from './tareas.ts';

/** Solo el token: lo que traiga la vuelta de Bold en la dirección no se lee (CA3). */
export const PeticionDeEstadoDelCobro = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
});

export const SEGUNDOS_ENTRE_CONSULTAS = 20;
export const ESPERAS_EN_MINUTOS = [5, 15, 30, 60] as const;
export const CONSULTAS_POR_TIENDA = 20;
export const HORAS_SIN_NOTICIAS = 24;

const MINUTO_MS = 60_000;

/** Lo que dijo la consulta, como respuesta para el cobro; `null` es seguir esperando. */
export function respuestaDeLaConsulta(e: EstadoEnElProveedor): RespuestaDeBold | null {
  const datos = { total: e.total, transaccion: e.transaccion, medio: null };
  // `@ed1/pagos` deja `VOIDED` como rechazo (así lo lee el CORE); aquí es el reembolso (§9.5).
  if (e.crudo === 'VOIDED') return { tipo: 'anulado', ...datos };
  if (e.estado === 'aprobado') return { tipo: 'aprobado', ...datos };
  if (e.estado === 'rechazado') return { tipo: 'rechazado', ...datos };
  return null;
}

interface CobroEnEspera extends CobroDelAviso {
  consultas: number;
  ultima_consulta: string | null;
  creado: string;
  vence: string;
}

const anotarConsulta = (c: ContextoDelAviso, k: CobroDelAviso, crudo: string) =>
  c.db
    .prepare(
      `UPDATE cobro SET consultas = consultas + 1, ultima_consulta = ?, estado_proveedor = ?
        WHERE org_id = ? AND id = ?`,
    )
    .bind(c.ahora, crudo.slice(0, 40), c.org, k.id);

/**
 * Le pregunta a Bold por un cobro y aplica lo que diga, con la consulta anotada en el mismo lote.
 * Lanza si Bold falla; un 429 sale como `ErrorDeBold` con su estado.
 */
export async function consultarCobro(
  c: ContextoDelAviso,
  k: CobroDelAviso,
  llaves: LlavesBold,
  fetchFn: typeof fetch,
): Promise<'movido' | 'esperando'> {
  // HU-T11.8: de un link se le pregunta a Bold por el link; vencido, lo cierra quien vence links.
  const bold = proveedorBold(llaves, fetchFn);
  const e = k.link ? await bold.consultarLink(k.link) : await bold.consultar(k.id);
  if (e.estado === 'revisar') {
    console.error(`tienda-api: Bold dijo ${e.crudo} del cobro ${k.id}; se sigue esperando`);
  }
  const r = k.link && e.crudo === 'EXPIRED' ? null : respuestaDeLaConsulta(e);
  const anotar = anotarConsulta(c, k, e.crudo);
  if (r && (await aplicarRespuesta(c, r, k, [anotar]))) {
    if (k.ambiente === 'pruebas') avisarPrueba(c, k.id, 'consulta');
    return 'movido';
  }
  await anotar.run();
  return 'esperando';
}

/** Veinticuatro horas sin noticias: `vencido`, y lo apartado que quedara, vencido (§7.3). */
export function vencerCobro(c: ContextoDelAviso, k: CobroDelAviso): SentenciaD1[] {
  return [
    c.db
      .prepare(
        `UPDATE cobro SET estado = 'vencido', actualizado = ?
          WHERE org_id = ? AND id = ? AND estado = 'esperando'`,
      )
      .bind(c.ahora, c.org, k.id),
    c.db
      .prepare(
        `UPDATE apartado SET estado = 'vencido', cerrado = ?
          WHERE org_id = ? AND cobro_id = ? AND estado = 'activo'`,
      )
      .bind(c.ahora, c.org, k.id),
    c.db
      .prepare(
        `INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, actor, detalle)
         SELECT ?, ?, ?, 'pago', 'sistema', ? WHERE EXISTS
           (SELECT 1 FROM pedido WHERE org_id = ? AND id = ? AND estado = 'por_pagar')`,
      )
      .bind(
        c.org,
        k.pedido_id,
        c.ahora,
        JSON.stringify({ cobro: k.id, ambiente: k.ambiente, resultado: 'vencido' }),
        c.org,
        k.pedido_id,
      ),
  ];
}

/** Lo que la página puede saber de su cobro: el estado y el código del pedido, nada más. */
export interface EstadoDelCobro {
  estado: 'esperando' | 'pagado' | 'revisar' | 'rechazado' | 'vencido' | 'reembolsado';
  pedido: string;
}

const PARA_LA_PAGINA: Record<string, EstadoDelCobro['estado']> = {
  esperando: 'esperando',
  aprobado: 'pagado',
  aprobado_sin_existencias: 'pagado',
  revisar: 'revisar',
  rechazado: 'rechazado',
  vencido: 'vencido',
  reembolsado: 'reembolsado',
};

const leerPorToken = async (c: ContextoDelAviso, huella: string) =>
  c.db
    .prepare(
      `SELECT k.id, k.pedido_id, k.ambiente, k.estado, k.monto_cop, k.ultima_consulta, p.codigo
         FROM cobro k JOIN pedido p ON p.org_id = k.org_id AND p.id = k.pedido_id
        WHERE k.org_id = ? AND k.token_huella = ?`,
    )
    .bind(c.org, huella)
    .first<CobroDelAviso & { ultima_consulta: string | null; codigo: string }>();

/**
 * El estado del cobro para la página que lo pagó (CA1). Si sigue esperando y la última consulta
 * tiene más de 20 s, primero le pregunta a Bold; si Bold falla, responde lo que hay.
 */
export async function estadoDelCobro(
  c: ContextoDelAviso,
  token: string,
  fetchFn: typeof fetch,
): Promise<EstadoDelCobro | null> {
  const huella = await sha256(token);
  let k = await leerPorToken(c, huella);
  if (!k) return null;
  const desde = k.ultima_consulta ? Date.parse(c.ahora) - Date.parse(k.ultima_consulta) : null;
  if (k.estado === 'esperando' && (desde === null || desde >= SEGUNDOS_ENTRE_CONSULTAS * 1000)) {
    const kek = await kekDelEntorno(c.kekTexto);
    const llaves = kek ? await llavesDeBold(c.db, c.org, k.ambiente, kek) : null;
    if (llaves) {
      try {
        if ((await consultarCobro(c, k, llaves, fetchFn)) === 'movido') {
          k = (await leerPorToken(c, huella)) ?? k;
        }
      } catch (e) {
        console.error(`tienda-api: no se pudo consultar a Bold por ${k.id} (${String(e)})`);
      }
    }
  }
  return { estado: PARA_LA_PAGINA[k.estado] ?? 'esperando', pedido: k.codigo };
}

export interface VueltaDeLaTienda {
  consultas: number;
  movidos: number;
  vencidos: number;
  sinLlaves: number;
  fallas: number;
  /** Bold respondió 429: la tienda se saltó el resto de la vuelta. */
  saltada: boolean;
}

/** ¿Le toca consulta a este cobro? Espera 5, 15, 30 y después 60 minutos desde la anterior. */
export function tocaConsultar(k: CobroEnEspera, instante: number): boolean {
  const espera = ESPERAS_EN_MINUTOS[Math.min(k.consultas, ESPERAS_EN_MINUTOS.length - 1)] ?? 60;
  return instante - Date.parse(k.ultima_consulta ?? k.creado) >= espera * MINUTO_MS;
}

/** Una tienda en la vuelta del cron: lo que espera, del más viejo al más nuevo. */
export async function conciliarTienda(
  c: ContextoDelAviso,
  instante: number,
  fetchFn: typeof fetch,
): Promise<VueltaDeLaTienda> {
  const v: VueltaDeLaTienda = {
    consultas: 0,
    movidos: 0,
    vencidos: 0,
    sinLlaves: 0,
    fallas: 0,
    saltada: false,
  };
  const { results } = await c.db
    .prepare(
      `SELECT id, pedido_id, ambiente, estado, monto_cop, consultas, ultima_consulta, creado, vence, link
         FROM cobro WHERE org_id = ? AND estado = 'esperando' AND creado <= ? ORDER BY creado LIMIT 200`,
    )
    .bind(c.org, new Date(instante - ESPERAS_EN_MINUTOS[0] * MINUTO_MS).toISOString())
    .all<CobroEnEspera>();
  const kek = await kekDelEntorno(c.kekTexto);
  const llaves = new Map<Ambiente, LlavesBold | null>();
  // HU-T11.8 CA2: los links vencidos, cada uno con su última pregunta a Bold.
  v.vencidos += await cerrarLinksVencidos(c, fetchFn);
  for (const k of results) {
    if (k.link && Date.parse(k.vence) <= instante) continue;
    if (instante - Date.parse(k.creado) >= HORAS_SIN_NOTICIAS * 60 * MINUTO_MS) {
      // Un aviso tardío todavía lo aprueba desde `vencido` (§7.3): vencer no pierde un pago.
      await c.db.batch(vencerCobro(c, k));
      v.vencidos++;
      continue;
    }
    if (v.consultas >= CONSULTAS_POR_TIENDA || !tocaConsultar(k, instante)) continue;
    if (!llaves.has(k.ambiente)) {
      llaves.set(k.ambiente, kek ? await llavesDeBold(c.db, c.org, k.ambiente, kek) : null);
    }
    const ll = llaves.get(k.ambiente);
    if (!ll) {
      v.sinLlaves++;
      continue;
    }
    v.consultas++;
    try {
      if ((await consultarCobro(c, k, ll, fetchFn)) === 'movido') v.movidos++;
    } catch (e) {
      if (e instanceof ErrorDeBold && e.estado === 429) {
        v.saltada = true;
        break;
      }
      v.fallas++;
      console.error(`tienda-api: no se pudo consultar a Bold por ${k.id} (${String(e)})`);
    }
  }
  return v;
}

/** La vuelta de cada hora: cada tienda con cobros esperando de cada shard. */
export const CONCILIAR: Tarea = {
  nombre: 'conciliar-cobros',
  frecuencia: 'hora',
  async correr(e, instante) {
    const total = { consultas: 0, movidos: 0, vencidos: 0, sinLlaves: 0 };
    const saltadas: string[] = [];
    const fallas: string[] = [];
    // HU-T14.3: el resultado de los cobros de prueba que esta vuelta resolvió, al final.
    const correos: Promise<unknown>[] = [];
    const ahora = new Date(instante).toISOString();
    const bases = e.shards.map(([, db]) => db);
    for (const [nombre, db] of e.shards) {
      // Cada tienda del shard, como las purgas; la consulta de sus cobros filtra por su org_id.
      const { results } = await db.prepare('SELECT org_id FROM tienda').all<{ org_id: string }>();
      for (const { org_id } of results) {
        try {
          const correo = e.correo;
          const v = await conciliarTienda(
            {
              db,
              org: org_id,
              ahora,
              kekTexto: e.kekTexto,
              ...(correo
                ? {
                    alResolverPrueba: (cobro: string, via: 'aviso' | 'consulta') => {
                      correos.push(
                        mandarResultadoDePrueba(
                          {
                            db,
                            org: org_id,
                            ahora,
                            correo,
                            enLaCelda: (d) => correosDeLaCelda(bases, d),
                          },
                          cobro,
                          via,
                        ).catch((error) =>
                          console.error(
                            `tienda-api: el correo de la prueba ${cobro} falló (${String(error)})`,
                          ),
                        ),
                      );
                    },
                    // HU-P2.1: el pago que encontró la consulta, al comprador.
                    alPagar: (pedido: string) => {
                      correos.push(
                        kekDelEntorno(e.kekTexto)
                          .then((kek) =>
                            avisarAlComprador(
                              {
                                db,
                                org: org_id,
                                ahora,
                                correo,
                                enLaCelda: (d) => correosDeLaCelda(bases, d),
                              },
                              kek,
                              pedido,
                              'pagado',
                            ),
                          )
                          .catch((error) =>
                            console.error(
                              `tienda-api: el correo del pago de ${pedido} falló (${String(error)})`,
                            ),
                          ),
                      );
                    },
                  }
                : {}),
            },
            instante,
            e.fetch ?? fetch,
          );
          total.consultas += v.consultas;
          total.movidos += v.movidos;
          total.vencidos += v.vencidos;
          total.sinLlaves += v.sinLlaves;
          if (v.saltada) saltadas.push(`${nombre}/${org_id}`);
          if (v.fallas > 0) fallas.push(`${nombre}/${org_id}: ${v.fallas} consulta(s) fallaron`);
        } catch (error) {
          fallas.push(
            `${nombre}/${org_id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    await Promise.all(correos);
    if (saltadas.length > 0) {
      const aviso = await enviarTelegram(
        e.telegram,
        `Tienda · Bold respondió 429 y se saltó la conciliación de ${saltadas.length} tienda(s) en esta vuelta:\n${saltadas.slice(0, 10).join('\n')}`,
        e.fetch,
      );
      if (aviso) console.error(`tienda-api: no se pudo avisar por Telegram (${aviso})`);
    }
    if (fallas.length > 0) {
      throw new Error(`conciliación con fallas: ${fallas.slice(0, 5).join('; ')}`);
    }
    return `${total.consultas} consultas, ${total.movidos} cobros movidos, ${total.vencidos} vencidos${total.sinLlaves > 0 ? `; ${total.sinLlaves} sin llaves` : ''}${saltadas.length > 0 ? `; ${saltadas.length} tiendas saltadas por 429` : ''}`;
  },
};
