/**
 * El resumen del soporte del mes por sede (HU-Q10.3). El registro es un CSV que el dueño lleva
 * fuera del repositorio (`docs/runbooks/parqueadero-soporte.md`); corre en Windows con solo Node.
 *
 *   node scripts/soporte-parqueadero.ts <registro.csv> [--mes AAAA-MM] [--costo-minuto <pesos>]
 *
 * Sin `--mes`, el mes anterior en Bogotá. Una fila mal escrita no se cuenta: el script dice cuál y
 * por qué, y termina con error.
 */
import { readFileSync } from 'node:fs';
import {
  leerRegistroDeSoporte,
  mesAnterior,
  resumenDelMes,
  textoDelResumen,
} from './lib/soporte-parqueadero.ts';

const USO =
  'Uso: node scripts/soporte-parqueadero.ts <registro.csv> [--mes AAAA-MM] [--costo-minuto <pesos>]';

const args = process.argv.slice(2);
const opcion = (nombre: string) => {
  const i = args.indexOf(nombre);
  return i >= 0 ? args[i + 1] : undefined;
};
const archivo = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const hoy = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
const mes = opcion('--mes') ?? mesAnterior(hoy);
const costoTexto = opcion('--costo-minuto');
const costo = costoTexto === undefined ? null : Number(costoTexto);

if (!archivo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || (costo !== null && !(costo >= 0))) {
  console.error(USO);
  process.exit(2);
}

const { atenciones, errores } = leerRegistroDeSoporte(readFileSync(archivo, 'utf8'));
process.stdout.write(textoDelResumen(resumenDelMes(atenciones, mes), costo));
if (errores.length > 0) {
  console.error(
    `\n${errores.length} ${errores.length === 1 ? 'fila no se contó' : 'filas no se contaron'}:`,
  );
  for (const e of errores) console.error(`  línea ${e.linea}: ${e.motivo}`);
  process.exit(1);
}
