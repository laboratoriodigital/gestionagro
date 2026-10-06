/**
 * Alertas al dueño por Telegram (HU-E8.3, ADR-16): el vigía avisa cuando cambia el nivel de la
 * celda o lo que no pudo medir (CA1), con el nivel, la cuota más usada y la causa.
 *
 * - **Solo cuando cambia lo que hay que decir.** La firma del aviso (nivel y fallas) se guarda en el
 *   KV de flags al enviarlo; mientras no cambie, no se repite. Así no hay un mensaje por hora ni
 *   una escritura por hora.
 * - **Si Telegram falla, no se silencia (CA2, P1).** Queda en el log con el motivo y la firma no se
 *   guarda: la vuelta siguiente lo intenta otra vez.
 * - **Excepción a P13, dicha:** la API de Telegram exige el token del bot en la ruta de la URL; no
 *   hay otra forma. La llamada va solo de la celda a Telegram por HTTPS y la URL nunca se escribe
 *   en el log (solo el estado HTTP). ARQUITECTURA §7.5.
 */
import { CUOTAS_GRATUITAS, type Cuota, type KvDeFlags, type Vigilancia } from './vigia.ts';

export const CLAVE_ULTIMO_AVISO = 'aviso_ultimo';

const NOMBRE_NIVEL: Record<Vigilancia['nivel'], string> = {
  normal: 'normal',
  alerta: 'ALERTA',
  ahorro: 'AHORRO',
  esencial: 'ESENCIAL',
  bloqueo: 'BLOQUEO',
};

const QUE_PASA: Record<Vigilancia['nivel'], string> = {
  normal: 'Todo funciona normal.',
  alerta: 'Solo aviso: nada cambia para los usuarios.',
  ahorro: 'Las fotos y los eventos de herramientas se pausan; los teléfonos revisan cada 60 min.',
  esencial: 'Solo suben registros; bajar lo del equipo se pausa hasta las 19:00 de Colombia.',
  bloqueo: 'La base no acepta escrituras hasta las 19:00 de Colombia; los teléfonos guardan todo.',
};

/**
 * Qué identifica a un aviso: si no cambia, no se repite. Con Workers Paid cuentan además el escalón
 * de lo incluido, si la proyección pasa el presupuesto y lo que se apagó (HU-C11.1).
 */
export const firmaDelAviso = (v: Vigilancia) =>
  [
    v.nivel,
    ...v.fallas,
    ...(v.pago
      ? [
          `incluido ${v.pago.escalon}`,
          v.pago.sobrePresupuesto ? 'sobre presupuesto' : '',
          ...v.pago.apagadas,
        ]
      : []),
  ].join('|');

const usd = (n: number) => `USD ${n.toFixed(2)}`;

/** El aviso con Workers Paid: cuánto va a costar el mes y qué se hizo. */
function mensajeDePago(
  v: Vigilancia & { pago: NonNullable<Vigilancia['pago']> },
  celda: string,
  destino: string,
): string {
  const p = v.pago;
  const lineas = [
    `${destino === 'staging' ? '[staging] ' : ''}Celda ${celda}: este mes va para ${usd(p.usdProyectado)}.`,
    p.escalon > 0
      ? `Ya se usó más del ${p.escalon} % de lo incluido en el plan.`
      : 'Va dentro de lo incluido en el plan.',
    p.sobrePresupuesto ? 'La proyección pasa el presupuesto del producto.' : '',
    p.apagadas.length > 0
      ? `Se agotó el presupuesto: se apagó ${p.apagadas.join(', ')}. La venta sigue.`
      : '',
    v.fallas.length > 0 ? `No se pudo medir: ${v.fallas.join('; ')}.` : '',
  ];
  return lineas.filter(Boolean).join('\n');
}

export function mensajeDelVigia(v: Vigilancia, celda: string, destino: string): string {
  if (v.pago) return mensajeDePago({ ...v, pago: v.pago }, celda, destino);
  const [cuota, porcentaje] =
    (Object.entries(v.uso) as [Cuota, number][]).sort((a, b) => b[1] - a[1])[0] ?? [];
  const lineas = [
    `${destino === 'staging' ? '[staging] ' : ''}Celda ${celda}: nivel ${NOMBRE_NIVEL[v.nivel]}${v.escrito ? ` (antes ${v.antes})` : ''}.`,
    QUE_PASA[v.nivel],
    cuota ? `Cuota más usada: ${CUOTAS_GRATUITAS[cuota].nombre}, ${porcentaje} % de hoy.` : '',
    v.fallas.length > 0 ? `No se pudo medir: ${v.fallas.join('; ')}.` : '',
  ];
  return lineas.filter(Boolean).join('\n');
}

export interface Telegram {
  token: string | undefined;
  chat: string | undefined;
}

/** Envía el texto al chat del dueño. Devuelve null si salió, o el motivo si no. */
export async function enviarTelegram(
  t: Telegram,
  texto: string,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  if (!t.token || !t.chat) return 'faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID';
  try {
    const r = await fetchFn(`https://api.telegram.org/bot${t.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: t.chat, text: texto, disable_web_page_preview: true }),
    });
    if (r.ok) return null;
    const cuerpo = (await r.json().catch(() => ({}))) as { description?: string };
    return `Telegram respondió ${r.status}${cuerpo.description ? `: ${cuerpo.description}` : ''}`;
  } catch (e) {
    return `Telegram no respondió (${(e as Error).message})`;
  }
}

/**
 * Avisa si cambió lo que hay que decir. Devuelve qué pasó, para el log. Nunca lanza: una alerta
 * que falla no debe tumbar la vuelta del vigía.
 */
export async function avisarSiCambio(
  kv: KvDeFlags,
  v: Vigilancia,
  contexto: { celda: string; destino: string; telegram: Telegram },
  fetchFn: typeof fetch = fetch,
): Promise<'sin-cambio' | 'enviado' | `fallo: ${string}`> {
  const firma = firmaDelAviso(v);
  if ((await kv.get(CLAVE_ULTIMO_AVISO)) === firma) return 'sin-cambio';
  const fallo = await enviarTelegram(
    contexto.telegram,
    mensajeDelVigia(v, contexto.celda, contexto.destino),
    fetchFn,
  );
  if (fallo) return `fallo: ${fallo}`;
  await kv.put(CLAVE_ULTIMO_AVISO, firma);
  return 'enviado';
}
