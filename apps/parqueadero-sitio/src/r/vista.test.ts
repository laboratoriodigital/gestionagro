import { enlaceCompleto, enlaceCorto, type Recibo } from '@ed1/parqueadero-recibos';
import { describe, expect, it } from 'vitest';
import { vistaDelEnlace } from './vista.ts';

const RECIBO: Recibo = {
  clase: 'entrada',
  numero: 'A-000123',
  sede: {
    nombre: 'Parqueadero Ensayo Dos',
    nit: '800123456-7',
    direccion: 'Carrera 10 # 20-30 Local 4',
    ciudad: 'Tunja',
    telefono: '+57 310 000 0000',
    poliza: null,
  },
  placa: 'ABC123',
  vehiculo: 'carro',
  entrada: Date.UTC(2026, 9, 6, 23, 5),
  estado: [],
  tarifa: {
    modo: 'minuto',
    valor: 230,
    fraccion_min: null,
    gracia_min: 5,
    tope_dia: null,
    plena: null,
    nocturna: null,
    tope_minuto: 230,
  },
  salida: null,
  pie: null,
  responsabilidad: null,
  prueba: true,
};

const fragmento = (enlace: string) => enlace.slice(enlace.indexOf('#'));

describe('la página del recibo /r/ (HU-Q4.2)', () => {
  it('la forma completa muestra el recibo como copia digital, con la marca de prueba', async () => {
    const v = await vistaDelEnlace(fragmento(await enlaceCompleto(RECIBO)));
    expect(v).toMatchObject({ es: 'completa', titulo: 'Recibo de entrada A-000123', prueba: true });
    if (v.es !== 'completa') throw new Error(v.es);
    expect(v.filas).toContainEqual(['Placa', 'ABC123 · Carro']);
    expect(v.notas[0]).toBe('Copia digital del recibo.');
  });

  it('la forma corta muestra número, placa y hora, y explica cómo pedir la completa', async () => {
    const v = await vistaDelEnlace(fragmento(enlaceCorto(RECIBO)));
    expect(v).toMatchObject({
      es: 'corta',
      titulo: 'Recibo A-000123',
      filas: [
        ['Placa', 'ABC123 · Carro'],
        ['Entrada', '06/10/2026 18:05'],
      ],
    });
  });

  it('un fragmento alterado, vacío o de otra versión no muestra un recibo a medias (CA3 ❌)', async () => {
    const bueno = fragmento(await enlaceCompleto(RECIBO));
    const alterado = `${bueno.slice(0, 20)}${bueno[20] === 'A' ? 'B' : 'A'}${bueno.slice(21)}`;
    for (const f of [alterado, '', '#', '#2.abc', '#1.%E0%A4%A', '#c.A-1.ABC123.c.1']) {
      expect(await vistaDelEnlace(f), f).toMatchObject({
        es: 'ilegible',
        titulo: 'No pudimos leer este recibo',
      });
    }
  });
});
