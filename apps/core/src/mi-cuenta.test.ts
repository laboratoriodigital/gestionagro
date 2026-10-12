/**
 * HU-C7.8 CA1: cada hecho de la auditoría en una frase que entiende el productor, sin palabras
 * técnicas. Las rutas se prueban en `entrar.test.ts` («lo mío en la cuenta»).
 */
import { describe, expect, it } from 'vitest';
import { frase } from './mi-cuenta.ts';

const nombres: Record<string, string> = { 'u-luis': 'Luis' };
const de = (accion: string, detalle: Record<string, unknown> | null = null, quien = 'Ana') =>
  frase({ accion, detalle, quien }, (id) => nombres[id] ?? 'una persona que ya no está');

describe('HU-C7.8 · la actividad en frases', () => {
  it('cambiar un rol dice de cuál a cuál, y sin el de antes, solo el nuevo', () => {
    expect(de('rol_cambiado', { persona: 'u-luis', antes: 'operario', rol: 'supervisor' })).toBe(
      'Ana cambió a Luis de operario a supervisor.',
    );
    expect(de('rol_cambiado', { persona: 'u-luis', rol: 'supervisor' })).toBe(
      'Ana cambió el rol de Luis a supervisor.',
    );
  });

  it('los pagos dicen el plan, el tiempo y el monto, o que no se aprobaron', () => {
    const pago = { plan: 'finca', meses: 6, monto_cop: 210000 };
    expect(de('pago_cerrado', { ...pago, estado: 'aprobado' })).toBe(
      'Ana pagó el plan finca por 6 meses (COP 210.000).',
    );
    expect(de('pago_cerrado', { ...pago, estado: 'rechazado' })).toBe(
      'Un pago de Ana por el plan finca no se aprobó.',
    );
    expect(de('pago_cerrado', { ...pago, estado: 'revisar' })).toBe(
      'Un pago de Ana por el plan finca quedó en revisión.',
    );
  });

  it('el resto de los hechos, y quien ya no está', () => {
    expect(de('entrada')).toBe('Ana entró con Google.');
    expect(de('invitacion_aceptada', { rol: 'operario' })).toBe('Ana se unió como operario.');
    expect(de('persona_quitada', { persona: 'u-otro' })).toBe(
      'Ana quitó a una persona que ya no está del espacio.',
    );
    expect(de('telefono_retirado')).toBe('Ana retiró el acceso de un teléfono.');
    expect(frase({ accion: 'entrada', detalle: null, quien: null }, () => '')).toBe(
      'Alguien entró con Google.',
    );
  });
});
