import { problemasDeTopes, type TopesDeCiudades } from '@ed1/parqueadero-schema';
import { describe, expect, it } from 'vitest';
import contenido from '../../../../content/parqueadero/topes.json' with { type: 'json' };
import { avisoDeTopeViejo, claveDeCiudad, topeDeLaCiudad } from './topes.ts';

const HOY = '2026-10-07';

describe('los topes de cada ciudad (HU-Q1.2)', () => {
  it('Bogotá desde el 30 ene 2026: 230 carro, 161 moto; 253 y 177 con sello de oro (CA1)', () => {
    // La puerta del CI: el archivo de verdad, contra el día de hoy.
    expect(problemasDeTopes(contenido, new Date().toISOString().slice(0, 10))).toEqual([]);
    const bogota = (contenido as TopesDeCiudades).ciudades.find((c) => c.ciudad === 'Bogotá');
    expect(bogota).toMatchObject({ vigente_desde: '2026-01-30', minuto_iniciado: true });
    expect(bogota?.topes).toEqual(
      expect.arrayContaining([
        { vehiculo: 'carro', por_minuto: 230, con_sello_de_oro: 253 },
        { vehiculo: 'moto', por_minuto: 161, con_sello_de_oro: 177 },
      ]),
    );
  });

  it('un valor no entero, sin norma o con vigencia futura no pasa el CI (CA3 ❌)', () => {
    const copia = () => JSON.parse(JSON.stringify(contenido)) as TopesDeCiudades;
    const decimal = copia();
    Object.assign(decimal.ciudades[0]?.topes[0] ?? {}, { por_minuto: 230.5 });
    expect(problemasDeTopes(decimal, HOY).join()).toContain('número entero');
    const sinNorma = copia();
    Object.assign(sinNorma.ciudades[0] ?? {}, { norma: '' });
    expect(problemasDeTopes(sinNorma, HOY)).not.toEqual([]);
    const futura = copia();
    Object.assign(futura.ciudades[0] ?? {}, { vigente_desde: '2026-12-01' });
    expect(problemasDeTopes(futura, HOY).join()).toContain('vigencia futura');
  });

  it('la ciudad se reconoce como la escriba la sede', () => {
    for (const c of ['Bogotá', 'bogota', ' BOGOTÁ D.C.', 'Bogotá, D.C.']) {
      expect(claveDeCiudad(c), c).toBe('bogota');
    }
    expect(topeDeLaCiudad('Bogotá D.C.', 'carro')?.porMinuto).toBe(230);
    expect(topeDeLaCiudad('Tunja', 'carro')).toBeNull();
  });

  it('con el reloj 14 meses adelante el aviso aparece; con 12, no (CA3)', () => {
    expect(avisoDeTopeViejo('Bogotá', '2027-01-30')).toBeNull();
    expect(avisoDeTopeViejo('Bogotá', '2027-03-30')).toBe('El tope de Bogotá no está actualizado');
    expect(avisoDeTopeViejo('Tunja', '2030-01-01')).toBeNull();
  });
});
