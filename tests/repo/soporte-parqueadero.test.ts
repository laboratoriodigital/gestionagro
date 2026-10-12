/**
 * El soporte, medido (HU-Q10.3): el registro solo acepta sus cinco columnas (CA1), cada causa
 * nombra un runbook que existe o dice que no tiene (CA2), y un mes sin filas no es cero (CA3).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAIZ } from '../../scripts/lib/repo.ts';
import {
  CANALES_DE_SOPORTE,
  CAUSAS_DE_SOPORTE,
  leerRegistroDeSoporte,
  mesAnterior,
  resumenDelMes,
  textoDelResumen,
} from '../../scripts/lib/soporte-parqueadero.ts';

const REGISTRO = [
  '﻿fecha;sede;canal;minutos;causa',
  '2026-10-03;Parqueadero Ensayo Uno;whatsapp;15;impresora',
  '2026-10-07;Parqueadero Ensayo Uno;llamada;20;uso_de_la_caja',
  '2026-10-08;Parqueadero Ensayo Uno;whatsapp;10;impresora',
  '2026-10-09;Parqueadero Ensayo Dos;presencial;40;cobro_y_tarifas',
  '2026-11-02;Parqueadero Ensayo Uno;whatsapp;5;impresora',
  '2026-11-30;Parqueadero Ensayo Dos;whatsapp;0;ninguna',
  '',
].join('\r\n');

describe('el registro del soporte (HU-Q10.3)', () => {
  it('suma los minutos del mes por sede, por causa y por canal', () => {
    const { atenciones, errores } = leerRegistroDeSoporte(REGISTRO);
    expect(errores).toEqual([]);
    const r = resumenDelMes(atenciones, '2026-10');
    expect(r.sedes).toEqual([
      {
        sede: 'Parqueadero Ensayo Dos',
        estado: 'con_atenciones',
        atenciones: 1,
        minutos: 40,
        porCausa: { cobro_y_tarifas: 40 },
        porCanal: { presencial: 40 },
      },
      {
        sede: 'Parqueadero Ensayo Uno',
        estado: 'con_atenciones',
        atenciones: 3,
        minutos: 45,
        porCausa: { impresora: 25, uso_de_la_caja: 20 },
        porCanal: { whatsapp: 25, llamada: 20 },
      },
    ]);
    // CA2: las tres causas con más minutos, con su runbook o sin él.
    expect(r.causas).toEqual([
      { causa: 'cobro_y_tarifas', minutos: 40, atenciones: 1, runbook: null },
      {
        causa: 'impresora',
        minutos: 25,
        atenciones: 2,
        runbook: 'docs/runbooks/parqueadero-impresora-no-imprime.md',
      },
      {
        causa: 'uso_de_la_caja',
        minutos: 20,
        atenciones: 1,
        runbook: 'docs/runbooks/parqueadero-hoja-del-cajero.md',
      },
    ]);
    const texto = textoDelResumen(r, 500);
    expect(texto).toContain('Parqueadero Ensayo Uno: 45 minutos en 3 atenciones, $22.500.');
    expect(texto).toContain('cobro_y_tarifas: 40 minutos en 1. Sin runbook: llévela al backlog.');
  });

  it('❌ un mes sin filas de una sede no es cero: dice «sin registros» (CA3)', () => {
    const { atenciones } = leerRegistroDeSoporte(REGISTRO);
    const noviembre = resumenDelMes(atenciones, '2026-11');
    expect(noviembre.sedes.map((s) => [s.sede, s.estado])).toEqual([
      ['Parqueadero Ensayo Dos', 'sin_atenciones'],
      ['Parqueadero Ensayo Uno', 'con_atenciones'],
    ]);
    const diciembre = resumenDelMes(atenciones, '2026-12');
    expect(diciembre.sedes.every((s) => s.estado === 'sin_registros')).toBe(true);
    const texto = textoDelResumen(diciembre);
    expect(texto).toContain('Parqueadero Ensayo Uno: sin registros este mes. No cuenta como cero');
    expect(texto).toContain('Mes incompleto: 2 de 2 sedes sin registros.');
    expect(texto).not.toMatch(/\b0 minutos/);
    expect(textoDelResumen(resumenDelMes([], '2026-10'))).toContain('sin registros no hay minutos');
  });

  it('❌ no entra una columna de más, un teléfono en la sede ni una fila mal escrita (CA1)', () => {
    const { atenciones, errores } = leerRegistroDeSoporte(
      [
        'fecha;sede;canal;minutos;causa',
        '2026-10-03;Parqueadero Ensayo Uno;whatsapp;15;impresora;el conductor de ABC123',
        '2026-10-03;Parqueadero 300 123 4567;whatsapp;15;impresora',
        '2026-02-30;Parqueadero Ensayo Uno;fax;0;impresora',
        '2026-10-03;Parqueadero Ensayo Uno;whatsapp;10;ninguna',
        '2026-10-03,Parqueadero Ensayo Uno,whatsapp,15,impresora',
      ].join('\n'),
    );
    expect(atenciones).toEqual([]);
    expect(errores.map((e) => e.linea)).toEqual([2, 3, 4, 4, 4, 5, 6]);
    expect(errores[0]?.motivo).toContain('no lleva notas ni datos del conductor');
    expect(errores[1]?.motivo).toBe('La sede no lleva números de teléfono: solo su nombre');
    expect(leerRegistroDeSoporte('fecha;sede;minutos\n').errores[0]?.linea).toBe(1);
  });

  it('cada runbook que nombra una causa existe (CA2)', () => {
    for (const ruta of Object.values(CAUSAS_DE_SOPORTE)) {
      if (ruta !== null) expect(existsSync(join(RAIZ, ruta)), ruta).toBe(true);
    }
  });

  it('el runbook dice cada causa y cada canal que el registro acepta (P18)', () => {
    const runbook = readFileSync(join(RAIZ, 'docs/runbooks/parqueadero-soporte.md'), 'utf8');
    for (const [causa, ruta] of Object.entries(CAUSAS_DE_SOPORTE)) {
      const fila = runbook.split('\n').find((l) => l.startsWith(`| \`${causa}\` |`));
      expect(fila, causa).toBeDefined();
      if (ruta) expect(fila).toContain(`\`${ruta}\``);
    }
    for (const canal of CANALES_DE_SOPORTE) expect(runbook).toContain(`\`${canal}\``);
  });

  it('sin --mes, el resumen es del mes anterior', () => {
    expect(mesAnterior('2026-10-09')).toBe('2026-09');
    expect(mesAnterior('2027-01-01')).toBe('2026-12');
  });
});
