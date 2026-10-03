import { describe, expect, it } from 'vitest';
import {
  calcular,
  type Entradas,
  enlaceAlCuaderno,
  entradasDeEnlace,
  PARAMETROS_COMPARTIDOS,
  paraCompartir,
} from './dpv-logica.ts';

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

describe('compartir por WhatsApp (HU-E2.4)', () => {
  const URL_DPV = 'https://cultivopro.co/herramientas/agro/calculadora-dpv/';

  it('CA1: el texto trae T, HR, DPV, la indicación y el enlace con los valores', () => {
    const e = con({ temperatura: '24', humedad: '70', cultivoEtapa: 'tomate:produccion' });
    const c = paraCompartir(e, calcular(e), URL_DPV);
    expect(c?.texto).toBe(
      `DPV de mi invernadero: 0,90 kPa (24 °C y 70 % de humedad). Para tomate en producción: algo alto. Calcúlalo aquí: ${URL_DPV}?t=24&hr=70`,
    );
    expect(c?.enlaceWhatsApp).toBe(`https://wa.me/?text=${encodeURIComponent(c?.texto ?? '')}`);
  });

  it('sin cultivo, no inventa una indicación', () => {
    const e = con({ temperatura: '24,5', humedad: '70' });
    const c = paraCompartir(e, calcular(e), URL_DPV);
    expect(c?.texto).toBe(
      `DPV de mi invernadero: 0,92 kPa (24,5 °C y 70 % de humedad). Calcúlalo aquí: ${URL_DPV}?t=24.5&hr=70`,
    );
  });

  it('CA2: el enlace lleva solo t y hr, aunque haya hoja, cultivo o parámetros previos', () => {
    const e = con({
      temperatura: '26',
      humedad: '60',
      temperaturaHoja: '24',
      cultivoEtapa: 'tomate:produccion',
    });
    const c = paraCompartir(e, calcular(e), `${URL_DPV}?utm=x&nombre=alguien#arriba`);
    const enlace = new URL(c?.enlaceCalculadora ?? '');
    expect([...enlace.searchParams.keys()]).toEqual([...PARAMETROS_COMPARTIDOS]);
    expect(enlace.hash).toBe('');
  });

  it('sin resultado válido no hay nada que compartir', () => {
    const e = con({ temperatura: '24,,5', humedad: '70' });
    expect(paraCompartir(e, calcular(e), URL_DPV)).toBeNull();
  });

  it('CA3: el enlace se lee de vuelta y da el mismo resultado; lo demás se ignora', () => {
    const leidas = entradasDeEnlace('?t=24&hr=70&nombre=alguien');
    expect(leidas).toEqual({ temperatura: '24', humedad: '70' });
    expect(calcular(con(leidas)).aire?.texto).toBe('0,90 kPa');
  });

  it('un enlace con valores ilegibles no calcula: el error queda en el campo', () => {
    const r = calcular(con(entradasDeEnlace('?t=abc&hr=70')));
    expect(r.aire).toBeNull();
    expect(r.errores.temperatura).toMatch(/No es un número válido/);
  });
});

describe('de la calculadora al cuaderno (HU-E2.7, CA1)', () => {
  const entradas = (cambios: Partial<Entradas> = {}): Entradas => ({
    temperatura: '24,5',
    humedad: '70',
    temperaturaHoja: '',
    cultivoEtapa: '',
    ...cambios,
  });
  const enlace = (e: Entradas) => enlaceAlCuaderno(e, calcular(e));

  it('lleva T y HR en el fragmento, con punto decimal, hacia Registrar', () => {
    expect(enlace(entradas())).toBe('/agro/app/registrar/#t=24.5&hr=70');
  });

  it('con temperatura de hoja válida la lleva; ilegible, no hay resultado ni enlace', () => {
    expect(enlace(entradas({ temperaturaHoja: '22' }))).toBe(
      '/agro/app/registrar/#t=24.5&hr=70&th=22',
    );
    expect(enlace(entradas({ temperaturaHoja: '22,,1' }))).toBeNull();
  });

  it('sin resultado válido no hay enlace: nada a medias', () => {
    expect(enlace(entradas({ humedad: '' }))).toBeNull();
    expect(enlace(entradas({ humedad: '120' }))).toBeNull();
  });

  it('no lleva nada más que la lectura: ni cultivo ni otros datos (P13)', () => {
    const url = enlace(entradas({ cultivoEtapa: 'tomate:produccion' })) ?? '';
    expect([...new URLSearchParams(url.split('#')[1]).keys()]).toEqual(['t', 'hr']);
    expect(url).not.toContain('?');
  });
});
