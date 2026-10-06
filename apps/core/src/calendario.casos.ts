/**
 * Los casos de HU-C5.1, en un solo lugar: los usa la prueba y la misma batería corrida con
 * `TZ=Pacific/Kiritimati` en otro proceso (la zona se fija al arrancar Node).
 * Cada caso: desde y esperado en hora de Bogotá (ISO con -05:00) y los meses que se suman.
 */
export const CASOS_DE_MESES: readonly {
  nombre: string;
  desde: string;
  meses: number;
  esperado: string;
}[] = [
  {
    nombre: '31 de enero + 1 mes',
    desde: '2027-01-31T10:00:00-05:00',
    meses: 1,
    esperado: '2027-02-28T10:00:00-05:00',
  },
  {
    nombre: '31 de enero de bisiesto + 1 mes',
    desde: '2028-01-31T10:00:00-05:00',
    meses: 1,
    esperado: '2028-02-29T10:00:00-05:00',
  },
  {
    nombre: '29 de febrero de 2028 + 12 meses',
    desde: '2028-02-29T08:30:00-05:00',
    meses: 12,
    esperado: '2029-02-28T08:30:00-05:00',
  },
  {
    nombre: '15 de marzo + 3 meses',
    desde: '2026-03-15T12:00:00-05:00',
    meses: 3,
    esperado: '2026-06-15T12:00:00-05:00',
  },
  {
    nombre: '30 de noviembre + 6 meses, cruza el año',
    desde: '2026-11-30T09:00:00-05:00',
    meses: 6,
    esperado: '2027-05-30T09:00:00-05:00',
  },
  // 18:59 y 19:01 de Bogotá caen en días UTC distintos (23:59 y 00:01): cuenta la fecha de Bogotá.
  {
    nombre: 'pagado a las 18:59 de Bogotá el 31 de enero',
    desde: '2027-01-31T18:59:00-05:00',
    meses: 1,
    esperado: '2027-02-28T18:59:00-05:00',
  },
  {
    nombre: 'pagado a las 19:01 de Bogotá el 31 de enero',
    desde: '2027-01-31T19:01:00-05:00',
    meses: 1,
    esperado: '2027-02-28T19:01:00-05:00',
  },
  {
    nombre: 'pagado a las 23:30 de Bogotá el 31 de diciembre + 2',
    desde: '2026-12-31T23:30:00-05:00',
    meses: 2,
    esperado: '2027-02-28T23:30:00-05:00',
  },
];
