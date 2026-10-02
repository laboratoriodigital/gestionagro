/** El número del chat del dueño con el bot (HU-E8.3): se lee de getUpdates sin repetir. */
import { describe, expect, it } from 'vitest';
import { chatsDe } from '../../scripts/telegram-chat.ts';

describe('telegram-chat', () => {
  it('lista cada chat una vez, con número, tipo y nombre', () => {
    const respuesta = {
      ok: true,
      result: [
        { message: { chat: { id: 111, type: 'private', first_name: 'Dueño Ensayo' } } },
        { message: { chat: { id: 111, type: 'private', first_name: 'Dueño Ensayo' } } },
        { message: { chat: { id: -222, type: 'group', title: 'Grupo Ensayo' } } },
        { edited_message: {} },
      ],
    };
    expect(chatsDe(respuesta)).toEqual([
      { id: 111, tipo: 'private', nombre: 'Dueño Ensayo' },
      { id: -222, tipo: 'group', nombre: 'Grupo Ensayo' },
    ]);
    expect(chatsDe({ ok: true, result: [] })).toEqual([]);
  });
});
