/**
 * `node scripts/tienda/restaurar.ts <respaldo.json> --sql <salida.sql>` (HU-T17.4, TIENDA §15.4):
 * arma el SQL que restaura una tienda desde su respaldo semanal (`tienda-respaldo/2`), para correrlo
 * con `wrangler d1 execute <base> --remote --file <salida.sql>`. Cada fila entra con `ON CONFLICT DO
 * NOTHING`: une lo que falta y nunca reemplaza lo que la base ya tiene. Correrlo dos veces no
 * cambia nada.
 *
 * Dice, por tabla, cuántas filas trae el respaldo, y deja al lado (`<salida>.contar.sql`) la
 * consulta que cuenta las mismas tablas en la base, para comparar después de restaurar. El paso a
 * paso del simulacro está en `docs/runbooks/tienda-restaurar.md`.
 *
 * Los sobres viajan cifrados, en hexadecimal: el archivo no tiene ningún dato personal en claro,
 * pero sí los datos de la tienda. Se guarda fuera del repositorio y se borra al terminar.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { type Respaldo, TABLAS_DEL_RESPALDO } from '../../apps/tienda-api/src/respaldos.ts';
import { revisarRespaldo, sqlDeRestauracion } from '../../apps/tienda-api/src/restaurar.ts';

/** La consulta que cuenta, por tabla, las filas de la tienda en la base restaurada. */
export function sqlParaContar(org: string): string {
  const id = `'${org.replaceAll("'", "''")}'`;
  return `${TABLAS_DEL_RESPALDO.map(
    ([tabla]) =>
      `SELECT '${tabla}' AS tabla, count(*) AS filas FROM ${tabla} WHERE org_id = ${id}${tabla === 'llave' ? " AND proposito <> 'credenciales'" : ''}`,
  ).join('\nUNION ALL\n')};\n`;
}

/** Arma los dos archivos y devuelve las líneas que se le dicen al operador. */
export function prepararRestauracion(
  respaldo: unknown,
  salida: string,
  escribir: (ruta: string, texto: string) => void = writeFileSync,
): string[] {
  const r: Respaldo = revisarRespaldo(respaldo);
  escribir(salida, sqlDeRestauracion(r));
  const contar = `${salida.replace(/\.sql$/, '')}.contar.sql`;
  escribir(contar, sqlParaContar(r.org));
  return [
    `Respaldo de ${r.org}, hecho el ${r.hecho}.`,
    ...TABLAS_DEL_RESPALDO.map(([t]) => `  ${t}: ${r.filas[t].length} filas`),
    `SQL listo en ${salida}. Para contar después: ${contar}.`,
    'Las llaves de Bold no viajan en el respaldo: el comercio las pega otra vez en Más › Cobro en línea.',
  ];
}

if (process.argv[1]?.endsWith('restaurar.ts')) {
  const [archivo] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const i = process.argv.indexOf('--sql');
  const salida = i > 0 ? process.argv[i + 1] : undefined;
  if (!archivo || !salida?.endsWith('.sql')) {
    console.error('Uso: node scripts/tienda/restaurar.ts <respaldo.json> --sql <salida.sql>');
    process.exit(2);
  }
  try {
    for (const l of prepararRestauracion(JSON.parse(readFileSync(archivo, 'utf8')), salida))
      console.log(l);
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
