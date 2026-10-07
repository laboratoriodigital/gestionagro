/**
 * Corre la tabla de casos e imprime los totales. La prueba lo lanza con varios `TZ` y exige el
 * mismo texto (HU-Q1.1 CA2): un `Date` local escondido en la liquidación lo cambiaría.
 */
import { CASOS } from './casos.fixture.ts';
import { liquidar } from './index.ts';

const totales = CASOS.map((c) => {
  const l = liquidar(c.entrada, c.salida, c.tarifa, c.tope, c.abonado ?? null, c.perdido ?? false);
  return [c.nombre, l.minutos, l.total, l.lineas.map((x) => x.minutos)];
});
process.stdout.write(JSON.stringify(totales));
