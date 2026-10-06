import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  diasHabilesEntre,
  domingoDePascua,
  esFestivo,
  esHabil,
  fechaEnBogota,
  festivosDe,
  sumarDiasCalendario,
  sumarDiasHabiles,
} from './index.ts';

// Escritas a mano, día por día, con el calendario y la Ley 51 de 1983 (no con la función).
const FESTIVOS_2026 = [
  '2026-01-01', // Año Nuevo
  '2026-01-12', // Reyes (6, martes → lunes)
  '2026-03-23', // San José (19, jueves → lunes)
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Trabajo
  '2026-05-18', // Ascensión
  '2026-06-08', // Corpus Christi
  '2026-06-15', // Sagrado Corazón
  '2026-06-29', // San Pedro y San Pablo (ya es lunes)
  '2026-07-20', // Independencia
  '2026-08-07', // Batalla de Boyacá
  '2026-08-17', // Asunción (15, sábado → lunes)
  '2026-10-12', // Día de la Raza (ya es lunes)
  '2026-11-02', // Todos los Santos (1, domingo → lunes)
  '2026-11-16', // Independencia de Cartagena (11, miércoles → lunes)
  '2026-12-08', // Inmaculada Concepción
  '2026-12-25', // Navidad
];

const FESTIVOS_2027 = [
  '2027-01-01',
  '2027-01-11', // Reyes (6, miércoles → lunes)
  '2027-03-22', // San José (19, viernes → lunes)
  '2027-03-25', // Jueves Santo
  '2027-03-26', // Viernes Santo
  '2027-05-01', // cae sábado: sigue siendo festivo, no se corre
  '2027-05-10', // Ascensión
  '2027-05-31', // Corpus Christi
  '2027-06-07', // Sagrado Corazón
  '2027-07-05', // San Pedro y San Pablo (29 jun, martes → lunes)
  '2027-07-20',
  '2027-08-07', // sábado
  '2027-08-16', // Asunción (15, domingo → lunes)
  '2027-10-18', // Día de la Raza (12, martes → lunes)
  '2027-11-01', // Todos los Santos (ya es lunes)
  '2027-11-15', // Cartagena (11, jueves → lunes)
  '2027-12-08',
  '2027-12-25', // sábado
];

function bateria() {
  it('Pascua: 2026, 2027 y casos conocidos', () => {
    expect(domingoDePascua(2026)).toBe('2026-04-05');
    expect(domingoDePascua(2027)).toBe('2027-03-28');
    expect(domingoDePascua(2024)).toBe('2024-03-31');
    expect(domingoDePascua(2038)).toBe('2038-04-25'); // la más tardía posible
  });

  it('los festivos de 2026 y 2027 son los de la tabla escrita a mano', () => {
    expect(festivosDe(2026)).toEqual(FESTIVOS_2026);
    expect(festivosDe(2027)).toEqual(FESTIVOS_2027);
  });

  it('18 festivos al año, salvo cuando dos caen el mismo lunes', () => {
    for (let a = 2026; a <= 2035; a++) {
      expect(festivosDe(a).length, String(a)).toBe(a === 2030 ? 17 : 18);
    }
    // 2030: Pascua el 21 de abril; Sagrado Corazón (+71) y San Pedro (29 jun, sábado) caen el 1 de julio.
    expect(festivosDe(2030)).toContain('2030-07-01');
  });

  it('hábil: ni fin de semana ni festivo', () => {
    expect(esHabil('2026-10-09')).toBe(true); // viernes
    expect(esHabil('2026-10-10')).toBe(false); // sábado
    expect(esHabil('2026-10-11')).toBe(false); // domingo
    expect(esHabil('2026-10-12')).toBe(false); // festivo
    expect(esFestivo('2026-03-19')).toBe(false); // San José se corrió al 23
  });

  it('15 días hábiles con Semana Santa en medio', () => {
    // Radicada el lunes 30 de marzo de 2026: Jueves y Viernes Santos no cuentan.
    expect(sumarDiasHabiles('2026-03-30', 15)).toBe('2026-04-22');
    expect(diasHabilesEntre('2026-03-30', '2026-04-22')).toBe(15);
  });

  it('un plazo que cae en festivo se corre al siguiente hábil', () => {
    // Viernes 9 de oct + 1 hábil: el lunes 12 es festivo, va al martes 13.
    expect(sumarDiasHabiles('2026-10-09', 1)).toBe('2026-10-13');
    expect(sumarDiasHabiles('2026-10-09', 0)).toBe('2026-10-09');
  });

  it('días calendario: el reembolso del retracto (15 días)', () => {
    expect(sumarDiasCalendario('2026-12-20', 15)).toBe('2027-01-04');
  });

  it('la fecha de Bogotá de un instante (UTC−5, todo el año)', () => {
    expect(fechaEnBogota(Date.UTC(2026, 9, 7, 4, 59))).toBe('2026-10-06'); // 23:59 en Bogotá
    expect(fechaEnBogota(Date.UTC(2026, 9, 7, 5, 0))).toBe('2026-10-07');
  });

  it('lo que no existe o está fuera del rango lanza, no inventa (P1)', () => {
    expect(() => esHabil('2026-02-30')).toThrow(/no existe/);
    expect(() => esHabil('7/10/2026')).toThrow(/AAAA-MM-DD/);
    expect(() => festivosDe(2041)).toThrow(/revisar la ley/);
    expect(() => sumarDiasHabiles('2026-01-01', -1)).toThrow(RangeError);
  });
}

describe('calendario en el huso de la máquina', bateria);

describe('calendario con otro huso (P8): Pacific/Kiritimati, UTC+14', () => {
  const antes = process.env['TZ'];
  beforeAll(() => {
    process.env['TZ'] = 'Pacific/Kiritimati';
    // Prueba de que el cambio de huso sí llegó al proceso: si no, este bloque no probaría nada (P5).
    expect(new Date(Date.UTC(2026, 0, 1, 12)).getHours()).toBe(2);
  });
  afterAll(() => {
    if (antes === undefined) delete process.env['TZ'];
    else process.env['TZ'] = antes;
  });
  bateria();
});
