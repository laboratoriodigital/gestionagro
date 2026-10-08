import { describe, expect, it } from 'vitest';
import {
  datosDelFormulario,
  desdeHoraLocal,
  horaLocal,
  siguienteNumero,
} from './recibo-de-entrada.ts';

describe('el generador de recibo de entrada (HU-Q11.4)', () => {
  it('lee y escribe la hora de Bogotá, sin depender de la zona del navegador', () => {
    const instante = Date.UTC(2026, 9, 8, 14, 30);
    expect(horaLocal(instante)).toBe('2026-10-08T09:30');
    expect(desdeHoraLocal('2026-10-08T09:30')).toBe(instante);
    expect(desdeHoraLocal('')).toBeNaN();
    expect(desdeHoraLocal('8 de octubre')).toBeNaN();
  });

  it('el número siguiente del talonario conserva sus ceros', () => {
    expect(siguienteNumero('0457')).toBe('0458');
    expect(siguienteNumero('9')).toBe('10');
    expect(siguienteNumero('A-000001')).toBe('');
  });

  it('sin las dos partes de la póliza, el recibo no la menciona; la fracción solo en su modo', () => {
    const campos: Record<string, string> = {
      nombre: 'Parqueadero Uno',
      aseguradora: 'Aseguradora',
      poliza: '',
      modo: 'minuto',
      valor: '70',
      fraccion: '15',
      vehiculo: 'moto',
      entrada: '2026-10-08T09:30',
      estado: 'Rayón puerta\n\nSin espejo',
    };
    const d = datosDelFormulario((n) => campos[n] ?? '');
    expect(d.sede.poliza).toBeNull();
    expect(d.tarifa).toEqual({ modo: 'minuto', valor: 70, fraccion_min: null });
    expect(d.vehiculo).toBe('moto');
    expect(d.estado).toEqual(['Rayón puerta', '', 'Sin espejo']);
    const fraccion = datosDelFormulario(
      (n) => ({ ...campos, modo: 'fraccion', poliza: '123' })[n] ?? '',
    );
    expect(fraccion.tarifa.fraccion_min).toBe(15);
    expect(fraccion.sede.poliza).toEqual({ aseguradora: 'Aseguradora', numero: '123' });
  });

  it('❌ un valor que no es un entero, o un modo o vehículo inventado, no pasa por bueno', () => {
    const d = datosDelFormulario(
      (n) => ({ valor: '70,5', modo: 'gratis', vehiculo: 'avion' })[n] ?? '',
    );
    expect(d.tarifa.valor).toBeNaN();
    expect(d.tarifa.modo).toBe('minuto');
    expect(d.vehiculo).toBe('carro');
  });
});
