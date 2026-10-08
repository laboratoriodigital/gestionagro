import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENTRADA_ENSAYO, SALIDA_ENSAYO, TARIFA_CARRO, TARIFA_MOTO } from './ensayos.fixture.ts';
import {
  catalogo,
  ENTIDADES,
  ErrorDeValidacion,
  numeroDeRecibo,
  ORIGENES,
  TIPOS_DE_REGISTRO,
  tarifa,
  validarRegistro,
  vehiculoPorPlaca,
} from './index.ts';

/** El anexo A sin comentarios: un `;` dentro de un comentario no corta una sentencia. */
const SQL = readFileSync(
  new URL('../../../docs/parking/sql/parqueadero/0001_parqueadero_v1.sql', import.meta.url),
  'utf8',
).replace(/--[^\n]*/g, '');

/** Las filas de un `INSERT INTO <tabla> … VALUES (…), (…);` del anexo A. */
function filasDelSql(tabla: string): string[][] {
  const m = SQL.match(new RegExp(`INSERT INTO ${tabla} [^;]*?VALUES([^;]*);`));
  if (!m?.[1]) throw new Error(`No está el INSERT de ${tabla} en el anexo A`);
  return [...m[1].matchAll(/\(([^)]*)\)/g)].map((f) =>
    (f[1] ?? '').split(',').map((x) => x.trim().replace(/^'|'$/g, '')),
  );
}

describe('los tipos coinciden con el anexo A (HU-Q1.3 CA1)', () => {
  it('ref_tipo_registro: los mismos tipos con las mismas banderas', () => {
    const delSql = Object.fromEntries(
      filasDelSql('ref_tipo_registro').map(([id, numero, estadia, anula]) => [
        id,
        { lleva_numero: numero === '1', abre_estadia: estadia === '1', pide_anula: anula === '1' },
      ]),
    );
    expect(delSql).toEqual(TIPOS_DE_REGISTRO);
  });

  it('ref_entidad y ref_origen', () => {
    expect(filasDelSql('ref_entidad').map(([id]) => id)).toEqual([...ENTIDADES]);
    expect(filasDelSql('ref_origen').map(([id]) => id)).toEqual([...ORIGENES]);
  });

  it('control: la lectura del SQL ve una bandera cambiada', () => {
    const cambiado = {
      ...TIPOS_DE_REGISTRO,
      salida: { ...TIPOS_DE_REGISTRO.salida, lleva_numero: false },
    };
    const delSql = Object.fromEntries(
      filasDelSql('ref_tipo_registro').map(([id, n, e, a]) => [
        id,
        { lleva_numero: n === '1', abre_estadia: e === '1', pide_anula: a === '1' },
      ]),
    );
    expect(delSql).not.toEqual(cambiado);
  });
});

const motivos = (f: () => unknown): string[] => {
  try {
    f();
  } catch (e) {
    if (e instanceof ErrorDeValidacion) return e.campos.map((c) => `${c.campo}: ${c.motivo}`);
    throw e;
  }
  return [];
};

describe('registros', () => {
  it('la entrada y la salida de la maqueta pasan', () => {
    expect(validarRegistro(ENTRADA_ENSAYO)).toEqual(ENTRADA_ENSAYO);
    expect(validarRegistro(SALIDA_ENSAYO)).toEqual(SALIDA_ENSAYO);
  });

  // HU-Q1.3 CA3 ❌
  it.each([
    ['sin id UUIDv7', { id: '1234' }, 'id: debe ser un UUIDv7'],
    ['con un UUID v4', { id: '0b8c4f3e-1d2a-4c5b-9e8f-7a6b5c4d3e2f' }, 'id: debe ser un UUIDv7'],
    ['sin serie', { serie: null }, 'serie: este tipo de registro es un recibo'],
    [
      'con un consecutivo no entero',
      { consecutivo: 12.5 },
      'consecutivo: debe ser un número entero',
    ],
    ['con consecutivo 0', { consecutivo: 0 }, 'consecutivo'],
    ['con una serie en minúscula', { serie: 'a' }, 'serie: debe ser de 1 a 3'],
    ['una entrada que no abre su estadía', { estadia_id: null }, 'estadia_id: una entrada abre'],
    ['de un tipo que no existe', { tipo: 'regalo' }, 'tipo'],
    ['de una versión que no existe', { v: 9 }, 'v: no hay esquema para «entrada» versión 9'],
  ])('una entrada %s no pasa', (_, cambio, motivo) => {
    expect(motivos(() => validarRegistro({ ...ENTRADA_ENSAYO, ...cambio })).join(' | ')).toContain(
      motivo,
    );
  });

  it('una nota no lleva número, y una anulación nombra lo que anula', () => {
    const nota = {
      ...ENTRADA_ENSAYO,
      id: '0199bc3e-3b40-7000-8000-000000000201',
      tipo: 'nota',
      estadia_id: null,
      datos: { texto: 'Se fue la luz' },
    };
    expect(motivos(() => validarRegistro(nota)).join()).toContain('no lleva número de recibo');
    expect(validarRegistro({ ...nota, serie: null, consecutivo: null }).tipo).toBe('nota');
    const anulacion = {
      ...nota,
      tipo: 'anulacion',
      serie: null,
      consecutivo: null,
      datos: { motivo: 'placa mal', operador: 'Caja 1' },
    };
    expect(motivos(() => validarRegistro(anulacion)).join()).toContain(
      'necesita el registro que anula',
    );
    expect(validarRegistro({ ...anulacion, anula_id: ENTRADA_ENSAYO.id }).tipo).toBe('anulacion');
  });

  it('una salida cuadra: líneas, redondeo, cambio y cortesía', () => {
    const d = SALIDA_ENSAYO.datos as Record<string, unknown>;
    const con = (cambio: Record<string, unknown>) =>
      motivos(() => validarRegistro({ ...SALIDA_ENSAYO, datos: { ...d, ...cambio } })).join(' | ');
    expect(con({ subtotal: 31_000, total: 31_000, cambio: 19_000 })).toContain(
      'no es la suma de las líneas',
    );
    expect(con({ total: 29_000 })).toContain('no es subtotal menos redondeo');
    expect(con({ cambio: 10_000 })).toContain('no es recibido menos total');
    expect(con({ medio_pago: 'datafono' })).toContain('solo en efectivo');
    expect(con({ medio_pago: 'cortesia', recibido: null, cambio: null })).toContain(
      'una cortesía lleva su motivo',
    );
    expect(con({ total: -1 })).toContain('total');
    expect(motivos(() => validarRegistro({ ...SALIDA_ENSAYO, estadia_id: null })).join()).toContain(
      'una salida cierra una estadía',
    );
  });

  it('un monto con decimales no pasa: pesos enteros (P1)', () => {
    const d = SALIDA_ENSAYO.datos as Record<string, unknown>;
    expect(
      motivos(() =>
        validarRegistro({
          ...SALIDA_ENSAYO,
          datos: { ...d, recibido: 50_000.5, cambio: 20_000.5 },
        }),
      ).join(),
    ).toContain('entero en pesos');
  });
});

describe('catálogos', () => {
  it('las tarifas de prueba pasan, y la fracción va solo en su modo', () => {
    expect(catalogo.parse(TARIFA_CARRO)).toEqual(TARIFA_CARRO);
    expect(catalogo.parse(TARIFA_MOTO)).toEqual(TARIFA_MOTO);
    expect(tarifa.safeParse({ ...TARIFA_CARRO, fraccion_min: 15 }).success).toBe(false);
    expect(tarifa.safeParse({ ...TARIFA_CARRO, modo: 'fraccion' }).success).toBe(false);
    expect(tarifa.safeParse({ ...TARIFA_CARRO, modo: 'fraccion', fraccion_min: 15 }).success).toBe(
      true,
    );
  });

  it('ningún campo tiene valor de fábrica: un catálogo vacío nombra cada campo (HU-Q3.2 CA3)', () => {
    const r = tarifa.safeParse({ entidad: 'tarifa' });
    expect(r.success).toBe(false);
    const campos = new Set(r.error?.issues.map((i) => i.path[0]));
    for (const campo of ['valor', 'gracia_min', 'redondeo', 'tope_minuto', 'perdido', 'nocturna']) {
      expect(campos.has(campo), campo).toBe(true);
    }
  });

  it('no hay redondeo hacia arriba (HU-Q1.1 CA3)', () => {
    expect(tarifa.safeParse({ ...TARIFA_CARRO, redondeo: 'arriba_100' }).success).toBe(false);
  });
});

describe('placas y números', () => {
  it.each([
    ['ABC123', 'carro'],
    ['ABC12D', 'moto'],
    ['AB1234', null],
    ['CD1234', null],
    ['R12345', null],
  ])('%s propone %s', (placa, tipo) => {
    expect(vehiculoPorPlaca(placa)).toBe(tipo);
  });

  it('A-000123, y más de seis cifras cuando llegue', () => {
    expect(numeroDeRecibo('A', 123)).toBe('A-000123');
    expect(numeroDeRecibo('B', 1_234_567)).toBe('B-1234567');
    expect(() => numeroDeRecibo('A', 0)).toThrow(RangeError);
  });
});

describe('el ajuste papel (HU-Q4.3)', () => {
  it('siempre o salvo recibo digital; «nunca» no existe (CA3 ❌)', async () => {
    const { sede, papelDeLaSede, SEDE_ENSAYO_UNO } = {
      ...(await import('./index.ts')),
      ...(await import('./ensayos.fixture.ts')),
    };
    expect(sede.safeParse({ ...SEDE_ENSAYO_UNO, papel: 'salvo_digital' }).success).toBe(true);
    expect(sede.safeParse({ ...SEDE_ENSAYO_UNO, papel: 'nunca' }).success).toBe(false);
    // @ts-expect-error: el tipo tampoco lo admite.
    expect(papelDeLaSede({ papel: 'nunca' })).toBe('nunca');
  });

  it('una sede de antes de HU-Q4.3 se lee igual; sin nada, siempre', async () => {
    const { papelDeLaSede } = await import('./index.ts');
    expect(papelDeLaSede({ imprimir_siempre: true })).toBe('siempre');
    expect(papelDeLaSede({ imprimir_siempre: false })).toBe('salvo_digital');
    expect(papelDeLaSede({})).toBe('siempre');
  });
});

describe('el texto de responsabilidad del ajuste del recibo (HU-Q4.5)', () => {
  it('opcional, nulo o de hasta 200 letras; más, o vacío, no (CA3 ❌)', async () => {
    const { ajusteRecibo, AJUSTE_ENSAYO } = {
      ...(await import('./index.ts')),
      ...(await import('./ensayos.fixture.ts')),
    };
    const con = (responsabilidad: unknown) =>
      ajusteRecibo.safeParse({ ...AJUSTE_ENSAYO, responsabilidad }).success;
    expect(ajusteRecibo.safeParse(AJUSTE_ENSAYO).success).toBe(true);
    expect(con(null)).toBe(true);
    expect(con('a'.repeat(200))).toBe(true);
    expect(con('a'.repeat(201))).toBe(false);
    expect(con('   ')).toBe(false);
  });
});
