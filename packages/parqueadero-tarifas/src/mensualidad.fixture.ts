/**
 * La tabla de mensualidades (HU-Q11.6 WI-Q11.6.2), compartida por el liquidador del sitio y la
 * caja: el primer periodo de cada caso es el que la caja cobra con «Solo hasta fin de mes», o un
 * mes completo sin él (`periodoPorCobrar`). Si un lado cambia la cuenta, la prueba del otro falla.
 */
export interface CasoDeMensualidad {
  readonly nombre: string;
  readonly valor: number;
  readonly desde: string;
  readonly meses: number;
  readonly hastaFinDeMes: boolean;
  /** Cada periodo: `[desde, hasta, valor]`. */
  readonly periodos: readonly (readonly [string, string, number])[];
  readonly total: number;
}

export const CASOS_DE_MENSUALIDAD: readonly CasoDeMensualidad[] = [
  {
    nombre: 'carro desde el 20: 12 de 31 días y dos meses completos',
    valor: 300_000,
    desde: '2026-10-20',
    meses: 2,
    hastaFinDeMes: true,
    periodos: [
      ['2026-10-20', '2026-10-31', 116_100],
      ['2026-11-01', '2026-11-30', 300_000],
      ['2026-12-01', '2026-12-31', 300_000],
    ],
    total: 716_100,
  },
  {
    nombre: 'moto desde el 20, solo hasta fin de mes',
    valor: 60_000,
    desde: '2026-10-20',
    meses: 0,
    hastaFinDeMes: true,
    periodos: [['2026-10-20', '2026-10-31', 23_200]],
    total: 23_200,
  },
  {
    nombre: 'desde el día 1, hasta fin de mes es el mes entero',
    valor: 300_000,
    desde: '2026-10-01',
    meses: 0,
    hastaFinDeMes: true,
    periodos: [['2026-10-01', '2026-10-31', 300_000]],
    total: 300_000,
  },
  {
    nombre: 'desde el 31 de enero, sin cortar: febrero no tiene 31',
    valor: 300_000,
    desde: '2026-01-31',
    meses: 2,
    hastaFinDeMes: false,
    periodos: [
      ['2026-01-31', '2026-02-28', 300_000],
      ['2026-03-01', '2026-03-31', 300_000],
    ],
    total: 600_000,
  },
  {
    nombre: 'febrero desde el 15: 14 de 28 días',
    valor: 300_000,
    desde: '2026-02-15',
    meses: 0,
    hastaFinDeMes: true,
    periodos: [['2026-02-15', '2026-02-28', 150_000]],
    total: 150_000,
  },
  {
    nombre: 'febrero bisiesto desde el 20: 10 de 29 días',
    valor: 300_000,
    desde: '2028-02-20',
    meses: 0,
    hastaFinDeMes: true,
    periodos: [['2028-02-20', '2028-02-29', 103_400]],
    total: 103_400,
  },
];
