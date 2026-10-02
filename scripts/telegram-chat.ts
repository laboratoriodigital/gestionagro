/**
 * `node scripts/telegram-chat.ts`: el número del chat del dueño con el bot de Telegram (HU-E8.3),
 * para guardarlo como `TELEGRAM_CHAT_ID`. Lo corre el flujo manual «telegram-chat» con el token
 * del secreto de GitHub: el token nunca pasa por el navegador ni por la consola del dueño (P13).
 *
 * Antes, el dueño le escribe cualquier cosa al bot (por ejemplo /start): Telegram guarda los
 * mensajes de las últimas 24 horas y aquí se leen. Escribe solo número, tipo y nombre del chat.
 */
import { appendFileSync } from 'node:fs';

export interface ChatVisto {
  id: number;
  tipo: string;
  nombre: string;
}

/** Los chats de la respuesta de `getUpdates`, sin repetir. */
export function chatsDe(respuesta: unknown): ChatVisto[] {
  const actualizaciones = (respuesta as { result?: unknown[] }).result ?? [];
  const vistos = new Map<number, ChatVisto>();
  for (const a of actualizaciones as {
    message?: {
      chat?: { id?: number; type?: string; first_name?: string; title?: string; username?: string };
    };
  }[]) {
    const chat = a.message?.chat;
    if (typeof chat?.id !== 'number') continue;
    vistos.set(chat.id, {
      id: chat.id,
      tipo: chat.type ?? '?',
      nombre: chat.title ?? chat.first_name ?? chat.username ?? '',
    });
  }
  return [...vistos.values()];
}

async function principal() {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  if (!token) {
    console.error('Falta el secreto TELEGRAM_BOT_TOKEN en GitHub.');
    process.exitCode = 1;
    return;
  }
  const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const cuerpo = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!r.ok || !cuerpo.ok) {
    console.error(
      `Telegram respondió ${r.status}${cuerpo.description ? `: ${cuerpo.description}` : ''}`,
    );
    process.exitCode = 1;
    return;
  }
  const chats = chatsDe(cuerpo);
  const texto =
    chats.length === 0
      ? 'No hay mensajes recientes. Escríbele /start al bot desde Telegram y vuelve a correr este flujo.'
      : [
          'Chats que le escribieron al bot (guarda el número del tuyo como TELEGRAM_CHAT_ID):',
          ...chats.map((c) => `- ${c.id} · ${c.tipo} · ${c.nombre}`),
        ].join('\n');
  console.log(texto);
  const resumen = process.env['GITHUB_STEP_SUMMARY'];
  if (resumen) appendFileSync(resumen, `${texto}\n`);
}

if (process.argv[1]?.endsWith('telegram-chat.ts')) await principal();
