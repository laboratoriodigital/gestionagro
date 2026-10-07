import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AJUSTE_ENSAYO,
  ENTRADA_ENSAYO,
  SALIDA_ENSAYO,
  SEDE_ENSAYO_UNO,
  TARIFA_CARRO,
  TARIFA_MOTO,
} from './ensayos.fixture.ts';
import {
  armarExport,
  csvDeRegistros,
  parqueaderoExportV1,
  type Registro,
  verificarExport,
} from './index.ts';

const CONTENIDO = {
  generado: '2026-10-07T03:00:00.000Z',
  app: 'caja 0.1.0',
  dispositivo: { id: 'caja-ensayo-1', serie: 'A' },
  sede_id: SEDE_ENSAYO_UNO.id,
  catalogo: [SEDE_ENSAYO_UNO, TARIFA_CARRO, TARIFA_MOTO, AJUSTE_ENSAYO],
  registro: [ENTRADA_ENSAYO, SALIDA_ENSAYO],
  historial: [],
};

/** El ejemplo guardado: un contrato desde el primer respaldo (HU-Q1.3 CA3, P10). */
const EJEMPLO = JSON.parse(
  readFileSync(new URL('../contrato/parqueadero-export-1.json', import.meta.url), 'utf8'),
) as unknown;

describe('parqueadero-export/1 (HU-Q1.3 CA2)', () => {
  it('arma el archivo de la caja de prueba y se verifica entero', async () => {
    const archivo = await armarExport(CONTENIDO);
    expect(archivo.tablas.registro.recuento).toBe(2);
    expect(await verificarExport(archivo)).toEqual([]);
  });

  it('el ejemplo guardado sigue abriendo: si el esquema pierde un campo, esto se pone en rojo', async () => {
    expect(parqueaderoExportV1.safeParse(EJEMPLO).success).toBe(true);
    expect(await verificarExport(EJEMPLO)).toEqual([]);
    // Y es el que arma el código de hoy: cambiar el formato obliga a pensar en el ejemplo.
    expect(await armarExport(CONTENIDO)).toEqual(EJEMPLO);
  });

  it('control: un esquema sin un campo rechaza el ejemplo', () => {
    const recortado = parqueaderoExportV1.omit({ app: true });
    expect(recortado.safeParse(EJEMPLO).success).toBe(false);
  });

  it('una fila editada a mano o una cortada se detectan (P21)', async () => {
    const archivo = structuredClone(await armarExport(CONTENIDO));
    const datos = archivo.tablas.registro.filas[1]?.datos as {
      total: number;
      subtotal: number;
      lineas: { valor: number }[];
    };
    datos.total = 3_000;
    datos.subtotal = 3_000;
    datos.lineas = [{ ...datos.lineas[0], valor: 3_000 }];
    expect(await verificarExport(archivo)).toEqual([
      '«registro» no coincide con su huella: el archivo se cortó o se editó',
    ]);
    const cortado = structuredClone(await armarExport(CONTENIDO));
    cortado.tablas.catalogo.filas.pop();
    expect((await verificarExport(cortado)).join()).toContain('«catalogo» dice 4 filas y trae 3');
  });

  it('un archivo que no es del formato dice qué falta', async () => {
    expect((await verificarExport({ formato: 'agro-export' })).join()).toContain('formato');
  });
});

describe('el CSV para Excel', () => {
  it('una fila por registro, con hora de Bogotá y sin fórmulas', () => {
    const anulacion: Registro = {
      ...ENTRADA_ENSAYO,
      id: '0199bd00-0000-7000-8000-000000000301',
      tipo: 'anulacion',
      instante_evento: '2026-10-07T02:10:00.000Z',
      estadia_id: ENTRADA_ENSAYO.id,
      anula_id: SALIDA_ENSAYO.id,
      serie: null,
      consecutivo: null,
      datos: { motivo: '=HIPERVINCULO("x")' },
    };
    const csv = csvDeRegistros([SALIDA_ENSAYO, anulacion, ENTRADA_ENSAYO]);
    const lineas = csv.split('\r\n');
    expect(lineas[0]).toBe(
      '﻿numero;tipo;fecha;hora;placa;vehiculo;minutos;total;medio_pago;anulado;id',
    );
    expect(lineas[1]).toBe(
      `A-000123;entrada;2026-10-06;18:05;ABC123;Carro;;;;no;${ENTRADA_ENSAYO.id}`,
    );
    expect(lineas[2]).toBe(
      `A-000124;salida;2026-10-06;21:05;ABC123;Carro;180;30000;efectivo;sí;${SALIDA_ENSAYO.id}`,
    );
    expect(lineas[3]).toMatch(/^;anulacion;2026-10-06;21:10;/);
    expect(csv).not.toContain('=HIPERVINCULO');
  });
});
