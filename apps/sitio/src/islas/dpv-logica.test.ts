import { describe, expect, it } from 'vitest';
import { calcular, type Entradas } from './dpv-logica.ts';

const con = (e: Partial<Entradas>): Entradas => ({
  temperatura: '',
  humedad: '',
  temperaturaHoja: '',
  cultivoEtapa: '',
  ...e,
});

describe('calculadora de DPV (HU-E2.2)', () => {
  it('CA1: 24 y 70 → «0,90 kPa»', () => {
    expect(calcular(con({ temperatura: '24', humedad: '70' })).aire?.texto).toBe('0,90 kPa');
  });

  it('CA3: acepta coma y punto', () => {
    expect(calcular(con({ temperatura: '24,5', humedad: '70' })).aire?.texto).toBe('0,92 kPa');
    expect(calcular(con({ temperatura: '24.5', humedad: '70' })).aire?.texto).toBe('0,92 kPa');
  });

  it('CA3: «24,,5» da un error junto al campo y no calcula', () => {
    const r = calcular(con({ temperatura: '24,,5', humedad: '70' }));
    expect(r.errores.temperatura).toMatch(/No es un número válido/);
    expect(r.aire).toBeNull();
  });

  it('vacío no es error ni cero: solo espera', () => {
    const r = calcular(con({ temperatura: '24' }));
    expect(r.errores).toEqual({});
    expect(r.aire).toBeNull();
  });

  it('fuera de rango dice el rango junto al campo correcto', () => {
    expect(calcular(con({ temperatura: '24', humedad: '120' })).errores).toEqual({
      humedad: 'La humedad debe estar entre 0 y 100 %.',
    });
    expect(calcular(con({ temperatura: '75', humedad: '70' })).errores).toEqual({
      temperatura: 'La temperatura debe estar entre −10 y 60 °C.',
    });
    expect(
      calcular(con({ temperatura: '24', humedad: '70', temperaturaHoja: '80' })).errores,
    ).toEqual({
      temperaturaHoja: 'La temperatura de la hoja debe estar entre −10 y 60 °C.',
    });
  });

  it('CA2: tomate en producción indica el rango con su fuente', () => {
    const r = calcular(
      con({ temperatura: '24', humedad: '80', cultivoEtapa: 'tomate:produccion' }),
    );
    expect(r.indicacion).toMatchObject({ nivel: 'en-rango', titulo: 'En rango' });
    expect(r.indicacion?.fuente).toMatch(/Shamshiri/);
  });

  it('sin cultivo elegido, calcula sin inventar una indicación', () => {
    expect(calcular(con({ temperatura: '24', humedad: '80' })).indicacion).toBeNull();
  });

  it('CA4: con temperatura de hoja calcula el DPV de hoja', () => {
    const r = calcular(con({ temperatura: '26', humedad: '60', temperaturaHoja: '24' }));
    expect(r.hoja?.texto).toBe('0,97 kPa');
  });
});
