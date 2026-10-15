import { describe, expect, it } from 'vitest';
import {
  envioDeLaRespuesta,
  mensajeDeRespuesta,
  revisarRespuesta,
  vencimientoEnPalabras,
} from './solicitudes.ts';

describe('el vencimiento en palabras (HU-T9.7)', () => {
  it('sin aviso, la fecha; a 3 días y el mismo día, avisa; vencida, en rojo', () => {
    expect(vencimientoEnPalabras({ vence: '2026-10-30', dias: 15, alerta: null })).toEqual({
      texto: 'Vence el 30 de octubre',
      tono: 'neutro',
    });
    expect(vencimientoEnPalabras({ vence: '2026-10-18', dias: 3, alerta: 'pronto' })).toEqual({
      texto: 'Vence en 3 días, el 18 de octubre',
      tono: 'pendiente',
    });
    expect(vencimientoEnPalabras({ vence: '2026-10-15', dias: 0, alerta: 'hoy' })).toMatchObject({
      texto: 'Vence hoy: responder antes de que acabe el día',
      tono: 'pendiente',
    });
    expect(vencimientoEnPalabras({ vence: '2026-10-14', dias: -1, alerta: 'vencida' })).toEqual({
      texto: 'Venció hace 1 día, sin respuesta',
      tono: 'mal',
    });
    expect(
      vencimientoEnPalabras({ vence: '2026-10-10', dias: -5, alerta: 'vencida' }, 'reembolsar'),
    ).toEqual({ texto: 'Venció hace 5 días, sin reembolso', tono: 'mal' });
  });
});

describe('la respuesta (HU-T9.7 CA1)', () => {
  it('❌ vacía o corta no se guarda, lo mismo que dice la API', () => {
    expect(revisarRespuesta('  ')).toEqual([
      { campo: 'respuesta', mensaje: 'Escribe la respuesta que le vas a mandar.' },
    ]);
    expect(revisarRespuesta('Ya va')[0]?.mensaje).toContain('al menos 10 caracteres');
    expect(revisarRespuesta('x'.repeat(4001))[0]?.mensaje).toContain('4.000');
    expect(revisarRespuesta('Te mandamos otra camisa.')).toEqual([]);
  });

  it('un celular de Colombia abre WhatsApp con su número; un correo, el correo', () => {
    const texto = 'Te mandamos otra camisa esta semana.';
    const mensaje = mensajeDeRespuesta('R-7', texto);
    expect(mensaje).toBe('Respuesta a tu solicitud R-7:\n\nTe mandamos otra camisa esta semana.');
    expect(envioDeLaRespuesta('300 123 4567', 'R-7', texto)).toEqual({
      por: 'whatsapp',
      href: `https://wa.me/573001234567?text=${encodeURIComponent(mensaje)}`,
    });
    expect(envioDeLaRespuesta('+57 300-123-4567', 'R-7', texto)?.href).toContain(
      'wa.me/573001234567?',
    );
    expect(envioDeLaRespuesta('ensayo.dos@ejemplo.test', 'R-7', texto)).toEqual({
      por: 'correo',
      href: `mailto:ensayo.dos@ejemplo.test?subject=${encodeURIComponent('Tu solicitud R-7')}&body=${encodeURIComponent(mensaje)}`,
    });
  });

  it('❌ lo que no es ni celular ni correo no se adivina', () => {
    expect(envioDeLaRespuesta('6012345678', 'R-7', 'x')).toBeNull();
    expect(envioDeLaRespuesta('Calle de prueba 99', 'R-7', 'x')).toBeNull();
  });
});
