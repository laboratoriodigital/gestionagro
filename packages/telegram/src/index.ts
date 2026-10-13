/**
 * El aviso al dueño por Telegram (HU-E8.3, ADR-16). Lo usan el vigía de la celda y el CORE
 * (HU-C7.7): una sola forma de enviarlo (P2).
 *
 * **Excepción a P13, dicha:** la API de Telegram exige el token del bot en la ruta de la URL; no
 * hay otra forma. La URL nunca se escribe en el log, solo el estado HTTP.
 */
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
